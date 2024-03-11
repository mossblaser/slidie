import { test } from "node:test";
import { strict as assert } from "node:assert";

import { getProcessedSvg } from "./svgs.ts";

import { getThumbnails } from "../ts/thumbnails.ts";

test("thumbnails", async (t) => {
  const negativeBuildStepNumber = await getProcessedSvg(
    "negative_build_step_number.svg",
  );
  await t.test("getThumbnails", async (t) => {
    const thumbs = getThumbnails(negativeBuildStepNumber);

    // Check numbers
    assert.deepEqual(
      thumbs.map(({ stepNumber }) => stepNumber),
      [-1, 0, 1],
    );

    // Check we get valid-looking PNG data URLs
    for (const { dataUrl } of thumbs) {
      assert(dataUrl.startsWith("data:image/png;base64,"));
    }
  });
});
