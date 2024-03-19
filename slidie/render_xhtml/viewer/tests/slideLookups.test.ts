import { test } from "node:test";
import { strict as assert } from "node:assert";

import ns from "../ts/xmlNamespaces.ts";
import { getProcessedSvg } from "./svgs.ts";

import { SlideLookups } from "../ts/slideLookups.ts";

test("slideLookups", async (t) => {
  const empty = await getProcessedSvg("empty.svg");
  const negativeBuildStepNumber = await getProcessedSvg(
    "negative_build_step_number.svg",
  );

  await t.test("SlideLookups", async (t) => {
    const svgs = [empty, negativeBuildStepNumber];
    const containers = [100, 200] as any as HTMLDivElement[]; // Mock values

    const slides = new SlideLookups(svgs, containers);

    // Easy bits
    assert.deepEqual(slides.svgs, svgs);
    assert.deepEqual(slides.containers, containers);

    // Build steps: take as read as most other lookups are derived from it and
    // all we could sensibly do here is run findBuildSteps again...

    assert.deepEqual(slides.buildStepCounts, [1, 3]);

    assert.deepEqual(slides.buildStepNumbers, [[0], [-1, 0, 1]]);

    assert.deepEqual(slides.buildStepTags, [
      new Map(),
      new Map([
        ["foo", [1]],
        ["bar", [1, 2]],
      ]),
    ]);

    assert.deepEqual(slides.ids, new Map([["negative_build_step_number", 1]]));
  });
});
