/**
 * This module defines the `Stepper` class which defines the state machine for
 * advancing through a slide show.
 */

import { layerStepNumbers } from "./buildSteps.ts";

/**
 * The a summary of the state of the Stepper.
 */
export interface StepperState {
  // The (zero-indexed) slide number
  slide: number;

  // The (zero-indexed) step index
  step: number;

  // Is the display blanked or not?
  blanked: boolean;
}

/**
 * Callback signature for Stepper state changes. The first argument gives the
 * current state, the second gives the new state.
 */
type StepperStateChangeCallback = (
  state: StepperState,
  previousState: StepperState,
) => void;

/**
 * State machine for advancing through a slide show.
 *
 * The 'state' attribute gives the current state of the stepper.
 *
 * Callbacks registered via onChangeCallbacks are called whenever the state
 * changes.
 */
export class Stepper {
  /**
   * The slideStepCounts parameter gives the number of build steps for each
   * slide.
   *
   * The initial slide and step (indices) set the initial slide/step to show.
   */
  constructor(
    slideStepCounts: number[],
    initialSlide: number = 0,
    initialStep: number = 0,
  ) {
    if (slideStepCounts.length < 1) {
      throw new Error("Slide show must have at least one slide.");
    }

    this.slideStepCounts = slideStepCounts;

    this.blanked = false;

    this.onChangeCallbacks = [];

    // Start on the specified slide
    this.curSlide = 0;
    this.curStep = 0;
    this.show(initialSlide, initialStep);
  }

  // For each slide, gives the full list of (possibly-not-zero-indexed) step
  // numbers
  protected slideStepCounts: number[];

  // The current slide index (zero-indexed)
  protected curSlide: number;
  // The current step index (zero-indexed)
  protected curStep: number;
  // Is the screen currently blanked?
  protected blanked: boolean;

  // State change callbacks
  protected onChangeCallbacks: StepperStateChangeCallback[];

  /**
   * The current state of the stepper.
   */
  get state(): StepperState {
    return {
      slide: this.curSlide,
      step: this.curStep,
      blanked: this.blanked,
    };
  }

  /**
   * Register a callback function to be called when the stepper's state
   * changes.
   */
  onChange(callback: StepperStateChangeCallback) {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Show a particular slide/step.
   *
   * Returns true iff the slide was valid and we've advanced to that point,
   * false otherwise (we'll stay where we are).
   */
  show(slide: number, step: number = 0): boolean {
    const beforeState = this.state;

    // Check in range
    if (
      slide < 0 ||
      slide >= this.slideStepCounts.length ||
      step < 0 ||
      step >= this.slideStepCounts[slide]
    ) {
      return false;
    }

    // Move to specified slide/step
    this.curSlide = slide;
    this.curStep = step;

    // Unblank if currently blanked
    this.blanked = false;

    // Only produce change event if we've actually changed state
    const afterState = this.state;
    const slideChanged = beforeState.slide !== afterState.slide;
    const stepChanged = beforeState.step !== afterState.step;
    const blankedChanged = beforeState.blanked !== afterState.blanked;
    if (slideChanged || stepChanged || blankedChanged) {
      for (const cb of this.onChangeCallbacks) {
        cb(afterState, beforeState);
      }
    }

    return true;
  }

  /**
   * Toggle blanking of the show. Returns true iff now blanked.
   *
   * NB: Blanking is automatically disabled when the slide/step is changed.
   */
  toggleBlank(): boolean {
    const beforeState = this.state;
    this.blanked = !this.blanked;
    const afterState = this.state;

    for (const cb of this.onChangeCallbacks) {
      cb(afterState, beforeState);
    }

    return this.blanked;
  }

  /** Advance to the next step (and then slide). Returns true iff one exists. */
  nextStep(): boolean {
    let slide = this.curSlide;
    let step = this.curStep;

    if (this.blanked) {
      // Don't advance if slide blanked, but do re-show the slide
    } else if (step + 1 < this.slideStepCounts[slide]) {
      step += 1;
    } else if (slide + 1 < this.slideStepCounts.length) {
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
    } else if (slide + 1 < this.slideStepCounts.length) {
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
      step = this.slideStepCounts[slide] - 1;
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
    const lastSlide = this.slideStepCounts.length - 1;
    const lastStep = this.slideStepCounts[lastSlide] - 1;
    return this.show(lastSlide, lastStep);
  }
}
