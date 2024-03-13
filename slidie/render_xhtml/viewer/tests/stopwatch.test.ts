import { test } from "node:test";
import { strict as assert } from "node:assert";

import { formatDuration, Stopwatch } from "../ts/stopwatch.ts";

test("stopwatch", async (t) => {
  await t.test("formatDuration", async (t) => {
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
    ] as [number, string][]) {
      await t.test(`expect ${duration} -> ${exp}`, (t) => {
        assert.strictEqual(formatDuration(duration), exp);
      });
    }
  });

  await t.test("Stopwatch", async (t) => {
    t.mock.timers.enable({ apis: ["Date"] });

    const sw = new Stopwatch();

    // Initially not running
    assert.strictEqual(sw.read(), 0);
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 0);

    // Run for a while
    sw.resume();
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 100);
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 200);

    // Resuming again does nothing
    sw.resume();
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 300);

    // Pausing works
    sw.pause();
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 300);

    // Pausing again does nothing
    sw.pause();
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 300);

    // Toggle pause works
    sw.togglePause(); // Now running
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 400);

    sw.togglePause(); // Now paused
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 400);

    // Reset works
    sw.reset();
    assert.strictEqual(sw.read(), 0);
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 0); // Still paused

    // Reset while running
    sw.resume();
    t.mock.timers.tick(50);
    assert.strictEqual(sw.read(), 50);

    sw.reset();
    assert.strictEqual(sw.read(), 0);
    t.mock.timers.tick(100);
    assert.strictEqual(sw.read(), 100); // Still running
  });
});
