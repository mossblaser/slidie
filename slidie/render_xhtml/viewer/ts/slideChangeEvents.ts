/**
 * This module implements the events which are dispatched to slides to inform
 * them of progress during a presentation.
 *
 * The following events (all dispatching a SlideChangeEvent object) are
 * defined which are sent to the <svg> element of the effected slide:
 *
 * * slideenter: When entering a slide (but not when the step changes)
 * * slideleave: When leaving a slide. NB: Contains the slide details of the
 *   slide which replaces it.
 * * stepchange: When the step changes within the slide (but not when initially
 *   entering the slide.
 * * slideblank: When the screen is blanked
 * * slideunblank: When the screen is unblanked. If the slide is unblanked
 *   implicitly (i.e. when moving to another next slide), the event will
 *   contain the details of the slide which replaces this slide.
 *
 * Where multiple events are arise from a single change, the events are
 * dispatched in the order listed above.
 */
import { Stepper, StepperState } from "./stepper.ts";

/**
 * Valid event type names for a slide change event.
 */
export type SlideChangeEventType =
  | "slideenter"
  | "slideleave"
  | "stepchange"
  | "slideblank"
  | "slideunblank";

/**
 * An event fired when the slide (or step) changes. Contains various fields
 * which may be useful to embedded scripts.
 */
export class SlideChangeEvent extends Event {
  constructor(
    type: SlideChangeEventType,
    state: StepperState,
    slides: {
      buildStepNumbers: number[][];
      buildStepTags: Map<string, number[]>[];
    },
  ) {
    super(type, {
      // Don't bubble out of the SVG's shadow DOM
      composed: false,
      // The change has already occurred by the time this event is fired
      cancelable: false,
      // Allow bubbling up to the window of the shadow DOM
      bubbles: true,
    });

    this.slide = state.slide;
    this.step = state.step;

    this.stepNumber = slides.buildStepNumbers[state.slide][state.step];

    this.tags = [];
    for (const [tag, steps] of slides.buildStepTags[state.slide].entries()) {
      if (steps.indexOf(state.step) >= 0) {
        this.tags.push(tag);
      }
    }
  }

  // The (zero-based) slide index
  slide: number;

  // The (zero-based) step index
  step: number;

  // The (not-necessarily zero-based) step number
  stepNumber: number;

  // The tags associated with any currently visible build steps.
  tags: string[];
}

/**
 * Dispatch slide change events in response to changes made by the provided
 * stepper.
 */
export function connectStepperToSlideEvents(
  stepper: Stepper,
  slides: {
    svgs: SVGSVGElement[];
    buildStepNumbers: number[][];
    buildStepTags: Map<string, number[]>[];
  },
) {
  function dispatchEvents(state: StepperState, lastState: StepperState | null) {
    const svg = slides.svgs[state.slide];

    // Enter and leave
    if (lastState === null || state.slide != lastState.slide) {
      svg.dispatchEvent(new SlideChangeEvent("slideenter", state, slides));

      if (lastState !== null) {
        const lastSvg = slides.svgs[lastState.slide];
        lastSvg.dispatchEvent(
          new SlideChangeEvent("slideleave", state, slides),
        );
      }
    }

    // Step change
    if (
      lastState !== null &&
      state.slide == lastState.slide &&
      state.step != lastState.step
    ) {
      svg.dispatchEvent(new SlideChangeEvent("stepchange", state, slides));
    }

    // Blanking
    if (lastState !== null) {
      if (state.blanked && !lastState.blanked) {
        svg.dispatchEvent(new SlideChangeEvent("slideblank", state, slides));
      }
      if (!state.blanked && lastState.blanked) {
        const lastSvg = slides.svgs[lastState.slide];
        lastSvg.dispatchEvent(
          new SlideChangeEvent("slideunblank", state, slides),
        );
      }
    }
  }

  dispatchEvents(stepper.state, null);
  stepper.onChange(dispatchEvents);
}
