import { strict as assert } from "node:assert";
import { test } from "node:test";

import { getSpeakerNotes } from "../ts/speakerNotes.ts";

import { getProcessedSvg } from "./svgs.ts";

test("speakerNotes", async (t) => {
  const negativeBuildStepNumber = await getProcessedSvg(
    "negative_build_step_number.svg",
  );
  await t.test("getSpeakerNotes", async (t) => {
    assert.deepEqual(getSpeakerNotes(negativeBuildStepNumber), [
      {
        stepNumbers: [-1, 0, 1],
        text: "First slide notes",
      },
      {
        stepNumbers: null,
        text: "Always notes",
      },
    ]);
  });
});
