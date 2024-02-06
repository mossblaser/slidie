const {test} = require("node:test");
const {strict: assert} = require("node:assert");

// NB: Not using JS modules...
eval(require("fs").readFileSync(__dirname + "/base.js")+"");


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
        null
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
  ]) {
    await t.test(`${name} ('${hash}')`, (t) => {
      const currentSlide = 1;
      const slideIds = new Map([
        ["third-slide", 2]
      ]);
      const slideBuildStepNumbers = [
        [-1, 0, 1],
        [-2, -1, 0],
        [0, 1],
      ];
      const slideBuildStepTags = [
        new Map([["first-step", 0], ["last-step", 2]]),
        new Map([["first-step", 0]]),
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

test("formatDuration", async (t) => {
  for (const [duration, exp] of [
    [0, "0:00"],
    // Should round-down
    [999, "0:00"],
    [1000, "0:01"],
    [59000, "0:59"],
    // Roll-over to minutes
    [60000, "1:00"],
    [600000, "10:00"],
    // Roll-over to hours
    [3600000, "1:00:00"],
    [3661000, "1:01:01"],
  ]) {
    await t.test(`expect ${duration} -> ${exp}`, (t) => {
      assert.strictEqual(formatDuration(duration), exp);
    });
  }
});
