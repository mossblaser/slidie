import { test } from "node:test";
import { strict as assert } from "node:assert";

import { toUrlHash, parseUrlHash } from "../ts/urlHashes.ts";

test("toUrlHash", async (t) => {
  assert.deepEqual(toUrlHash(0, 0), "#1");
  assert.deepEqual(toUrlHash(99, 0), "#100");
  assert.deepEqual(toUrlHash(99, 9), "#100#10");
});

test("parseUrlHash", async (t) => {
  for (const hash of [
    // No hash prefix
    "",
    "123",
    // Multiple step specs
    "##1#2",
    "##1<2>",
    "##1@foo",
    "#<1>#2",
    "#<1><2>",
    "#<1>@two",
    "#@one@two",
    // Unknown ID
    "#who-knows",
  ]) {
    await t.test(`Invalid hash '${hash}'`, (t) => {
      const currentSlide = 10;
      const slideIds = new Map();
      const slideBuildStepNumbers = [[0]];
      const slideBuildStepTags = [new Map()];
      assert.strictEqual(
        parseUrlHash(
          hash,
          currentSlide,
          slideIds,
          slideBuildStepNumbers,
          slideBuildStepTags,
        ),
        null,
      );
    });
  }

  for (const [name, hash, expSlide, expStep] of [
    ["Current slide", "#", 1, 0],
    ["Current slide, step index", "##2", 1, 1],
    ["Current slide, step number", "#<-1>", 1, 1],
    ["Current slide, step tag", "#@first-step", 1, 0],
    ["Numbered slide", "#1", 0, 0],
    ["Numbered slide with step", "#1#2", 0, 1],
    ["Slide by ID", "#third-slide", 2, 0],
    ["Slide by ID with step", "#third-slide#2", 2, 1],
    ["Unknown tag", "#3@nope", 2, 0],
    ["Tag on out of range slide", "#99@nope", 98, 0],
    ["Unknown step number", "#3<99>", 2, 0],
    ["Step number on out of range slide", "#99<99>", 98, 0],
  ] as [string, string, number, number][]) {
    await t.test(`${name} ('${hash}')`, (t) => {
      const currentSlide = 1;
      const slideIds = new Map([["third-slide", 2]]);
      const slideBuildStepNumbers = [
        [-1, 0, 1],
        [-2, -1, 0],
        [0, 1],
      ];
      const slideBuildStepTags = [
        new Map([
          ["first-step", [0]],
          ["last-step", [2]],
        ]),
        new Map([["first-step", [0]]]),
        new Map(),
      ];
      assert.deepEqual(
        parseUrlHash(
          hash,
          currentSlide,
          slideIds,
          slideBuildStepNumbers,
          slideBuildStepTags,
        ),
        [expSlide, expStep],
      );
    });
  }
});
