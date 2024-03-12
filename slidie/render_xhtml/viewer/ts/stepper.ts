/**
 * This module defines the `Stepper` class which is responsible for advancing
 * through a slide show by hiding/revealing SVGs (or parts within them).
 */

import { BuildStepVisibility } from "./buildSteps.ts";
import { toUrlHash, parseUrlHash } from "./urlHashes.ts";

/**
 * Base type for Events dispatched on changes to the visible slide by
 * Stepper objects.
 *
 * The 'composed' argument can be set to false to prevent the event bubbling
 * out of the slide in which it was sent to.
 */
export class StepperEvent extends Event {
  // The <svg> root element of the slide
  slideElem: SVGSVGElement;

  // The (zero-indexed) slide number
  slide: number;

  // The (zero-indexed) step index
  step: number;

  // The step number (as used in the build spec, may start from
  // a number other than zero.)
  stepNumber: number;

  // Tags assigned to currently visible build steps.
  tags: string[];

  constructor(type: string, stepper: Stepper, composed: boolean = true) {
    super(type, { composed, cancelable: false, bubbles: true });
    this.slideElem = stepper.curSlideElem;
    this.slide = stepper.curSlide;
    this.step = stepper.curStep;
    this.stepNumber = stepper.curStepNumber;

    this.tags = [];
    const buildStepTags = stepper.slideTags[this.slide];
    for (const [tag, steps] of buildStepTags.entries()) {
      if (steps.indexOf(this.step) >= 0) {
        this.tags.push(tag);
      }
    }
  }
}

/**
 * A class which steps through a slide show by showing/hiding SVGs and layers.
 *
 * Also dispatches the following events to the SVG root of the current slide
 * (which will non-cancellably bubble all the way to the non-shaddow document
 * root):
 *
 * * slideenter: When entering a slide (but not between steps)
 * * slideexit: When leaving a slide. NB: Contains the slide details of the
 *   slide which replaces it. NB: Unlike other events, this does not bubble out
 *   of the slide it is raised in.
 * * stepchange: When the visible build step changes OR the slide changes.
 * * slideblank: When the screen is blanked
 * * slideunblank: When the screen is unblanked
 *
 * All events include a 'slide' and 'step' attribute giving the current
 * slide/step
 */
export class Stepper {
  // The following attributes broadly define the slides and their indices

  // The slides in the show
  slides: SVGSVGElement[];
  // The elements which contain the slides in slides (a 1:1 mapping)
  containers: Element[];
  // Lookup from slide ID to slide index (where IDs are given)
  slideIds: Map<string, number>;
  // The elements to show/hide during slide builds
  slideBuilds: BuildStepVisibility[];
  // For each slide, gives the full list of (possibly-not-zero-indexed) step
  // numbers
  slideStepNumbers: number[][];
  // For each slide, gives a lookup from tag to step indices.
  slideTags: Map<string, number[]>[];

  // The following attributes broadly define the current state of the show

  // The current slide index (zero-indexed)
  curSlide: number;
  // The current step index (zero-indexed)
  curStep: number;
  // Is the screen currently blanked?
  blanked: boolean;

  /**
   * @param slides An array of SVG root elements, one per slide
   * @param containers A corresponding array of elements to show/hide to cause
   *                   that slide to be made visible/invisible.
   */
  constructor(slides: SVGSVGElement[], containers: Element[]) {
    this.slides = slides;
    this.containers = containers;

    // Extract IDs from slides which have them
    this.slideIds = new Map();
    for (const [slide, elem] of this.slides.entries()) {
      if (elem.hasAttributeNS(ns("slidie"), "id")) {
        const id = elem.getAttributeNS(ns("slidie"), "id");
        this.slideIds.set(id, slide);
      }
    }

    // Extract the build steps from all slides. NB: Build step numbers can
    // start from < 0. To keep things simpler, in all public functions of this
    // class we take build step indices (which are always zero based).
    this.slideBuilds = this.slides.map((slide) => findBuildSteps(slide));
    this.slideStepNumbers = this.slideBuilds.map((layerSteps) =>
      layerStepIndices(layerSteps),
    );
    this.slideTags = this.slideBuilds.map((layerSteps) =>
      layerStepTags(layerSteps),
    );

    // Initially don't blank the screen
    this.blanked = false;

    // Start on the slide specified in the URL hash
    this.curSlide = -1;
    this.curStep = -1;
    if (!this.showFromHash()) {
      // Fall back on the first slide if URL hash invalid/out of range
      this.show(0, 0);
    }

    // Move between slides based on URL changes
    window.addEventListener("hashchange", () => this.showFromHash());
  }

  /** The current slide's <svg> element. */
  get curSlideElem(): SVGSVGElement {
    return this.slides[this.curSlide];
  }

  /** The current slide's (maybe-non-zero-indexed) step number. */
  get curStepNumber(): number {
    return this.slideStepNumbers[this.curSlide][this.curStep];
  }

  /**
   * Show a particular slide/step.
   *
   * The updateHash argument is intended for internal use only by showFromHash
   * and may be used to prevent the hash in the URL from being changed to match
   * the current slide. This ensures that if the user uses a particular hash
   * format to specify the slide/step we don't immediately replace that.
   *
   * Returns true iff the slide exists (and we're now showing it), false
   * otherwise.
   */
  show(slide: number, step: number = 0, updateHash: boolean = true): boolean {
    // Check in range
    if (
      slide >= this.slides.length ||
      step >= this.slideStepNumbers[slide].length
    ) {
      return false;
    }

    // Unblank if currently blanked
    if (this.blanked) {
      this.toggleBlank();
    }

    // Do nothing if already on correct slide (avoids producing change events
    // when nothing has actually changed)
    const slideChanged = this.curSlide !== slide;
    const stepChanged = this.curStep !== step;
    if (!(slideChanged || stepChanged)) {
      return true;
    }

    const lastSlide = this.curSlide;
    const lastStep = this.curStep;
    this.curSlide = slide;
    this.curStep = step;

    // Show the slide (and hide the others)
    for (const [index, container] of this.containers.entries()) {
      container.style.display = index == slide ? "block" : "none";
    }

    // Show the appropriate layers for the given build step
    for (const build of this.slideBuilds[slide]) {
      if (build.steps.indexOf(step) >= 0) {
        build.elem.style.display = "block";
      } else {
        build.elem.style.display = "none";
      }
    }

    // Update the URL with the new offset
    if (updateHash) {
      window.location.hash = toUrlHash(this.curSlide, this.curStep);
    }

    // Fire change events
    if (slideChanged) {
      this.slides[this.curSlide].dispatchEvent(
        new StepperEvent("slideenter", this),
      );
      if (lastSlide !== null) {
        this.slides[lastSlide].dispatchEvent(
          new StepperEvent("slideexit", this, false),
        );
      }
    }
    this.slides[this.curSlide].dispatchEvent(
      new StepperEvent("stepchange", this),
    );

    return true;
  }

  /**
   * Toggle blanking of the show. Returns true iff now blanked.
   *
   * NB: Blanking is turned off when attempting to change slide.
   */
  toggleBlank(): boolean {
    this.blanked = !this.blanked;

    for (const container of this.containers) {
      // NB: We set 'visibility' rather than 'disblay' partly to keep things
      // easy and also to avoid triggering reflow or (over-zealous)
      // re-rendering of the SVGs
      container.style.visibility = this.blanked ? "hidden" : "visible";
    }

    // Fire blanking/unblanking event
    const eventType = this.blanked ? "slideblank" : "slideunblank";
    this.slides[this.curSlide].dispatchEvent(new StepperEvent(eventType, this));

    return this.blanked;
  }

  /**
   * Show the slide specified in the current URL hash. Returns true iff the
   * hash is valid and refers to an existing slide.
   *
   * There is no reason to call this method externally since it will already be
   * called on instantiation and after a hashchange event anyway.
   */
  showFromHash(): boolean {
    const match = parseUrlHash(
      decodeURI(window.location.hash),
      this.curSlide,
      this.slideIds,
      this.slideStepNumbers,
      this.slideTags,
    );
    if (match !== null) {
      return this.show(match[0], match[1], false);
    } else {
      return false;
    }
  }

  /** Advance to the next step (and then slide). Returns true iff one exists. */
  nextStep(): boolean {
    let slide = this.curSlide;
    let step = this.curStep;

    if (this.blanked) {
      // Don't advance if slide blanked, but do re-show the slide
    } else if (step + 1 < this.slideStepNumbers[slide].length) {
      step += 1;
    } else if (slide + 1 < this.slides.length) {
      step = 0;
      slide += 1;
    } else {
      // Already at end, no-op
      return false;
    }

    return this.show(slide, step);
  }

  /**
   * Advance to the first step of the next slide (skipping any remaining build
   * steps on the current slide). Returns true iff one exists.
   */
  nextSlide(): boolean {
    let slide = this.curSlide;
    let step = this.curStep;

    if (this.blanked) {
      // Don't advance if slide blanked, but do re-show the slide
    } else if (slide + 1 < this.slides.length) {
      step = 0;
      slide += 1;
    } else {
      // Already at end, no-op
      return false;
    }

    return this.show(slide, step);
  }

  /** Return to the previous step (and then slide). Returns true iff one exists. */
  previousStep(): boolean {
    let slide = this.curSlide;
    let step = this.curStep;

    if (this.blanked) {
      // Don't move back if slide blanked, but do re-show the slide
    } else if (step - 1 >= 0) {
      step -= 1;
    } else if (slide - 1 >= 0) {
      slide -= 1;
      step = this.slideStepNumbers[slide].length - 1;
    } else {
      // Already at start, no-op
      return false;
    }

    return this.show(slide, step);
  }

  /**
   * Return to the first step of the current slide if not already on it.
   * Otherwise, returns to the first step of the previous slide (skipping any
   * interevening build steps on the current slide). Returns true iff one
   * exists.
   */
  previousSlide(): boolean {
    let slide = this.curSlide;
    let step = this.curStep;

    if (this.blanked) {
      // Don't move back if slide blanked, but do re-show the slide
    } else if (step > 0) {
      step = 0;
    } else if (slide - 1 >= 0) {
      slide -= 1;
      step = 0;
    } else {
      // Already at start, no-op
      return false;
    }

    return this.show(slide, step);
  }

  /**
   * Go to the first build step of the first slide.
   */
  start(): boolean {
    return this.show(0, 0);
  }

  /**
   * Go to the last build step of the last slide.
   */
  end(): boolean {
    const lastSlide = this.slides.length - 1;
    const lastStep = this.slideStepNumbers[lastSlide].length - 1;
    return this.show(lastSlide, lastStep);
  }
}
