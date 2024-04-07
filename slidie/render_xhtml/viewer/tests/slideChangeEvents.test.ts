import { strict as assert } from "node:assert";
import { mock, test } from "node:test";

import {
  SlideChangeEvent,
  connectStepperToSlideEvents,
} from "../ts/slideChangeEvents.ts";
import { Stepper } from "../ts/stepper.ts";

test("slideChangeEvents", async (t) => {
  // A dummy setup roughly mimicing a show consisting of empty.svg followed by
  // negative_build_step_number.svg.
  function makeSlides() {
    return {
      svgs: [
        { dispatchEvent: mock.fn((evt: SlideChangeEvent) => {}) },
        { dispatchEvent: mock.fn((evt: SlideChangeEvent) => {}) },
      ] as any[] as SVGSVGElement[],
      buildStepCounts: [1, 3],
      buildStepNumbers: [[0], [-1, 0, 1]],
      buildStepTags: [
        new Map(),
        new Map([
          ["foo", [1]],
          ["bar", [1, 2]],
        ]),
      ],
    };
  }

  /**
   * Return newly received SlideChangeEvents dispatched to the given slide
   * since the last call to this function.
   */
  function dispatches(
    slides: { svgs: SVGSVGElement[] },
    slide: number,
  ): SlideChangeEvent[] {
    // Excuse the slack typing... the mock types are not exported by the node
    // and I'm too lazy to do anything more precise here...
    const mock = (slides.svgs[slide] as any).dispatchEvent.mock;
    const events = mock.calls.map(
      (call: any) => call.arguments[0],
    ) as SlideChangeEvent[];
    mock.resetCalls();
    return events;
  }

  await t.test("connectStepperToSlideEvents", async (t) => {
    await t.test("event sequencing", async (t) => {
      const slides = makeSlides();
      const stepper = new Stepper(slides.buildStepCounts);
      connectStepperToSlideEvents(stepper, slides);

      // Should initially enter the selected slide
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        ["slideenter"],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        [],
      );

      // Changing slide
      stepper.show(1, 0);
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        ["slideleave"],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["slideenter"],
      );

      // Changing step within a slide
      stepper.show(1, 1);
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        [],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["stepchange"],
      );

      // Blanking
      stepper.toggleBlank();
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        [],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["slideblank"],
      );

      // Unblanking
      stepper.toggleBlank();
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        [],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["slideunblank"],
      );

      // Implicit unblanking
      stepper.toggleBlank();
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        [],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["slideblank"],
      );
      stepper.show(1, 0); // During step change
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        [],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["stepchange", "slideunblank"],
      );
      stepper.toggleBlank();
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        [],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["slideblank"],
      );
      stepper.show(0, 0); // During slide change
      assert.deepEqual(
        dispatches(slides, 0).map((evt) => evt.type),
        ["slideenter"],
      );
      assert.deepEqual(
        dispatches(slides, 1).map((evt) => evt.type),
        ["slideleave", "slideunblank"],
      );
    });
  });

  await t.test("SlideChangeEvent properties", async (t) => {
    const slides = makeSlides();
    const stepper = new Stepper(slides.buildStepCounts);
    connectStepperToSlideEvents(stepper, slides);

    // No tags for this step
    const events0 = dispatches(slides, 0);
    assert.deepEqual(events0.length, 1);
    assert.deepEqual(events0[0].type, "slideenter");
    assert.deepEqual(events0[0].slide, 0);
    assert.deepEqual(events0[0].step, 0);
    assert.deepEqual(events0[0].stepNumber, 0);
    assert.deepEqual(events0[0].tags, []);

    // No step with tags and different start offset for step numbers
    stepper.show(1, 2);
    const events1 = dispatches(slides, 1);
    assert.deepEqual(events1.length, 1);
    assert.deepEqual(events1[0].type, "slideenter");
    assert.deepEqual(events1[0].slide, 1);
    assert.deepEqual(events1[0].step, 2);
    assert.deepEqual(events1[0].stepNumber, 1);
    assert.deepEqual(events1[0].tags, ["bar"]);
  });
});
