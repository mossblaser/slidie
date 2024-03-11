import { test } from "node:test";
import { strict as assert } from "node:assert";

import ns from "../ts/xmlNamespaces.ts";
import { getProcessedSvg } from "./svgs.ts";

import {
  findBuildSteps,
  layerStepIndices,
  layerStepTags,
  findElementBuildSteps,
} from "../ts/buildSteps.ts";

test("buildSteps", async (t) => {
  const empty = await getProcessedSvg("empty.svg");
  const negativeBuildStepNumber = await getProcessedSvg(
    "negative_build_step_number.svg",
  );

  await t.test("findBuildSteps", async (t) => {
    await t.test("no steps", async (t) => {
      assert.deepEqual(findBuildSteps(empty), []);
    });

    await t.test("tags and negative steps", async (t) => {
      const buildSteps = findBuildSteps(negativeBuildStepNumber);
      assert.deepEqual(
        buildSteps.map(({ elem, ...rest }) => ({
          layer: elem.getAttributeNS(ns("inkscape"), "label"),
          ...rest,
        })),
        [
          {
            layer: "Third <+-> @bar",
            stepNumbers: [1],
            steps: [2],
            tags: ["bar"],
          },
          {
            layer: "Second <.> @foo @bar",
            stepNumbers: [0],
            steps: [1],
            tags: ["bar", "foo"],
          },
          {
            layer: "Always (explicit) <@foo.before->",
            stepNumbers: [-1, 0, 1],
            steps: [0, 1, 2],
            tags: [],
          },
        ],
      );
    });
  });

  await t.test("layerStepIndices", async (t) => {
    await t.test("no steps", async (t) => {
      assert.deepEqual(layerStepIndices(findBuildSteps(empty)), [0]);
    });
    await t.test("negative steps", async (t) => {
      assert.deepEqual(
        layerStepIndices(findBuildSteps(negativeBuildStepNumber)),
        [0, 1, 2],
      );
    });
  });

  await t.test("layerStepTags", async (t) => {
    await t.test("no tags", async (t) => {
      assert.deepEqual(layerStepTags(findBuildSteps(empty)), new Map());
    });
    await t.test("has tags", async (t) => {
      assert.deepEqual(
        layerStepTags(findBuildSteps(negativeBuildStepNumber)),
        new Map([
          ["foo", [1]],
          ["bar", [1, 2]],
        ]),
      );
    });
  });

  await t.test("findElementBuildSteps", async (t) => {
    await t.test("not on build step", async (t) => {
      assert.deepEqual(
        findElementBuildSteps(
          negativeBuildStepNumber.ownerDocument.getElementById(
            "not-on-build-step",
          ) as Element,
        ),
        null,
      );
    });

    await t.test("immediate child of layer", async (t) => {
      assert.deepEqual(
        findElementBuildSteps(
          negativeBuildStepNumber.ownerDocument.getElementById(
            "on-second",
          ) as Element,
        ),
        {
          stepNumbers: [0],
          tags: ["bar", "foo"],
        },
      );
    });

    await t.test("nested child of layer", async (t) => {
      assert.deepEqual(
        findElementBuildSteps(
          negativeBuildStepNumber.ownerDocument.getElementById(
            "in-group-on-second",
          ) as Element,
        ),
        {
          stepNumbers: [0],
          tags: ["bar", "foo"],
        },
      );
    });
  });
});
