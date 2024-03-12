import { test } from "node:test";
import { strict as assert } from "node:assert";

import { getProcessedSvg } from "./svgs.ts";

import {
  toUrlHash,
  parseUrlHash,
  enumerateAbsoluteHashes,
} from "../ts/urlHashes.ts";

test("urlHashes", async (t) => {
  await t.test("toUrlHash", async (t) => {
    assert.deepEqual(toUrlHash(0, 0), "#1");
    assert.deepEqual(toUrlHash(99, 0), "#100");
    assert.deepEqual(toUrlHash(99, 9), "#100#10");
  });

  await t.test("parseUrlHash", async (t) => {
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

  await t.test("enumerateSlideHashes", async (t) => {
    const slides = [
      await getProcessedSvg("empty.svg"),
      await getProcessedSvg("negative_build_step_number.svg"),
    ];
    assert.deepEqual(
      enumerateAbsoluteHashes(slides).sort(),
      [
        // Single step slide (empty.svg)
        "#1", // Implicit first step
        "#1#1", // Explicit step index
        "#1<0>", // Implicit step number
        // Multi-step-slide (negative_build_step_number.svg)
        "#2", // Implicit first step
        "#2#1", // Explicit step index
        "#2#2",
        "#2#3",
        "#2<-1>", // Implicit step number
        "#2<0>",
        "#2<1>",
        "#2@foo", // Tag
        "#2@bar",
        // And now for the above slide's ID
        "#negative_build_step_number", // Implicit first step
        "#negative_build_step_number#1", // Explicit step index
        "#negative_build_step_number#2",
        "#negative_build_step_number#3",
        "#negative_build_step_number<-1>", // Implicit step number
        "#negative_build_step_number<0>",
        "#negative_build_step_number<1>",
        "#negative_build_step_number@foo", // Tag
        "#negative_build_step_number@bar",
      ].sort(),
    );
  });
});
