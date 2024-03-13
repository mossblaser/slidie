import { test, mock } from "node:test";
import { strict as assert } from "node:assert";

import { getProcessedSvg } from "./svgs.ts";

import { StepperState, Stepper } from "../ts/stepper.ts";

test("stepper", async (t) => {
  const exampleSlideStepCounts = [1, 2, 3];

  await t.test("rejects empty show", async (t) => {
    assert.throws(() => new Stepper([]));
  });

  await t.test("initial defaults to step 0, slide 0", async (t) => {
    assert.deepEqual(new Stepper(exampleSlideStepCounts).state, {
      slide: 0,
      step: 0,
      blanked: false,
    });
  });

  await t.test("initial slide/step can be changed", async (t) => {
    assert.deepEqual(new Stepper(exampleSlideStepCounts, 2, 1).state, {
      slide: 2,
      step: 1,
      blanked: false,
    });
  });

  await t.test("initial slide/step out of range", async (t) => {
    assert.deepEqual(new Stepper(exampleSlideStepCounts, 1, 99).state, {
      slide: 0,
      step: 0,
      blanked: false,
    });
  });

  await t.test("initial slide out of range", async (t) => {
    assert.deepEqual(new Stepper(exampleSlideStepCounts, 9, 99).state, {
      slide: 0,
      step: 0,
      blanked: false,
    });
  });

  await t.test("onChange callback", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    const onChange = mock.fn();
    stepper.onChange(onChange);

    // Callback on navigation change
    stepper.show(1, 0);
    assert.deepEqual(onChange.mock.calls.length, 1);
    assert.deepEqual(onChange.mock.calls[0].arguments, [
      { slide: 1, step: 0, blanked: false },
      { slide: 0, step: 0, blanked: false },
    ]);

    // Callback on blanking
    stepper.toggleBlank();
    assert.deepEqual(onChange.mock.calls.length, 2);
    assert.deepEqual(onChange.mock.calls[1].arguments, [
      { slide: 1, step: 0, blanked: true },
      { slide: 1, step: 0, blanked: false },
    ]);

    // Single callback on combined show/unblank
    stepper.show(2, 1);
    assert.deepEqual(onChange.mock.calls.length, 3);
    assert.deepEqual(onChange.mock.calls[2].arguments, [
      { slide: 2, step: 1, blanked: false },
      { slide: 1, step: 0, blanked: true },
    ]);

    // No extra callbacks if no state change
    stepper.show(2, 1);
    assert.deepEqual(onChange.mock.calls.length, 3);

    // But do produce call back if unblanking as a side effect
    stepper.toggleBlank();
    assert.deepEqual(onChange.mock.calls.length, 4);
    stepper.show(2, 1);
    assert.deepEqual(onChange.mock.calls.length, 5);
    assert.deepEqual(onChange.mock.calls[4].arguments, [
      { slide: 2, step: 1, blanked: false },
      { slide: 2, step: 1, blanked: true },
    ]);
  });

  await t.test("show() range checking", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    const onChange = mock.fn();
    stepper.onChange(onChange);

    // Slide out of range
    assert.deepEqual(stepper.show(-1, 0), false);
    assert.deepEqual(stepper.show(99, 0), false);

    // Step out of range
    assert.deepEqual(stepper.show(1, -1), false);
    assert.deepEqual(stepper.show(1, 99), false);

    assert.deepEqual(onChange.mock.calls.length, 0);

    // In range (just!)
    assert.deepEqual(stepper.show(2, 2), true);
    assert.deepEqual(onChange.mock.calls.length, 1);
  });

  await t.test("nextStep()", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    // Advance over slide boundary
    assert.deepEqual(stepper.nextStep(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: false,
    });

    // Advance over steps within slide
    assert.deepEqual(stepper.nextStep(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 1,
      blanked: false,
    });

    // Don't advance when coming out of blanking
    stepper.toggleBlank();
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 1,
      blanked: true,
    });
    assert.deepEqual(stepper.nextStep(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 1,
      blanked: false,
    });

    // Don't advance past end
    stepper.show(2, 2);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 2,
      blanked: false,
    });
    assert.deepEqual(stepper.nextStep(), false);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 2,
      blanked: false,
    });
  });

  await t.test("previousStep()", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    // Don't advance before start
    assert.deepEqual(stepper.previousStep(), false);
    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    stepper.show(2, 0);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 0,
      blanked: false,
    });

    // Advance over slide boundary
    assert.deepEqual(stepper.previousStep(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 1,
      blanked: false,
    });

    // Advance over steps within slide
    assert.deepEqual(stepper.previousStep(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: false,
    });

    // Don't advance when coming out of blanking
    stepper.toggleBlank();
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: true,
    });
    assert.deepEqual(stepper.previousStep(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: false,
    });
  });

  await t.test("nextSlide()", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    // Should always advance to first step of next slide
    assert.deepEqual(stepper.nextSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: false,
    });

    assert.deepEqual(stepper.nextSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 0,
      blanked: false,
    });

    // Don't advance past end
    stepper.show(2, 1);
    assert.deepEqual(stepper.nextSlide(), false);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 1,
      blanked: false,
    });

    // Don't advance when coming out of blanking
    stepper.show(1, 0);
    stepper.toggleBlank();
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: true,
    });
    assert.deepEqual(stepper.nextSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: false,
    });
  });

  await t.test("previousSlide()", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    // Should always advance to first step of previous slide, starting with the
    // current slide if not already on the first step
    stepper.show(2, 2);
    assert.deepEqual(stepper.previousSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 0,
      blanked: false,
    });

    assert.deepEqual(stepper.previousSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 1,
      step: 0,
      blanked: false,
    });

    assert.deepEqual(stepper.previousSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    // Don't advance past start
    assert.deepEqual(stepper.previousSlide(), false);
    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });

    // Don't advance when coming out of blanking
    stepper.show(2, 1);
    stepper.toggleBlank();
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 1,
      blanked: true,
    });
    assert.deepEqual(stepper.previousSlide(), true);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 1,
      blanked: false,
    });
  });

  await t.test("start()", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    stepper.show(1, 0);

    assert.deepEqual(stepper.start(), true);
    assert.deepEqual(stepper.state, {
      slide: 0,
      step: 0,
      blanked: false,
    });
  });

  await t.test("end()", async (t) => {
    const stepper = new Stepper(exampleSlideStepCounts);

    stepper.show(1, 0);

    assert.deepEqual(stepper.end(), true);
    assert.deepEqual(stepper.state, {
      slide: 2,
      step: 2,
      blanked: false,
    });
  });
});
