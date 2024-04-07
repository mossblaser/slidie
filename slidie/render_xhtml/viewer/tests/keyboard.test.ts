import { strict as assert } from "node:assert";
import { test } from "node:test";

import { KeyboardShortcut, matchKeypress } from "../ts/keyboard.ts";

test("keyboard", async (t) => {
  await t.test("matchKeypress", async (t) => {
    /** Produce a mock KeyboardEvent. */
    function kbdEvt(key: string, extras: object = {}): KeyboardEvent {
      return { key, ...extras } as KeyboardEvent;
    }

    await t.test("empty", (t) => {
      assert.strictEqual(matchKeypress(kbdEvt("x"), []), null);
    });

    await t.test("non-letters", (t) => {
      const shortcuts = [
        { id: 100, keys: ["PageUp", "PageDown"] },
        { id: 200, keys: ["Backspace"] },
      ];
      assert.strictEqual(matchKeypress(kbdEvt("PageUp"), shortcuts)!.id, 100);
      assert.strictEqual(matchKeypress(kbdEvt("PageDown"), shortcuts)!.id, 100);
      assert.strictEqual(
        matchKeypress(kbdEvt("Backspace"), shortcuts)!.id,
        200,
      );
      assert.strictEqual(matchKeypress(kbdEvt("Enter"), shortcuts), null);
    });

    await t.test("letters", (t) => {
      const shortcuts = [
        { id: 100, keys: ["a", "B"] },
        { id: 200, keys: ["c"] },
      ];
      assert.strictEqual(matchKeypress(kbdEvt("a"), shortcuts)!.id, 100);
      assert.strictEqual(matchKeypress(kbdEvt("A"), shortcuts)!.id, 100);
      assert.strictEqual(matchKeypress(kbdEvt("b"), shortcuts)!.id, 100);
      assert.strictEqual(matchKeypress(kbdEvt("B"), shortcuts)!.id, 100);
      assert.strictEqual(matchKeypress(kbdEvt("c"), shortcuts)!.id, 200);
      assert.strictEqual(matchKeypress(kbdEvt("C"), shortcuts)!.id, 200);
      assert.strictEqual(matchKeypress(kbdEvt("x"), shortcuts), null);
    });

    await t.test("modifiers", (t) => {
      // WIth a modifier set, our shortcut should never match
      const shortcuts = [{ keys: ["x"] }];
      assert.strictEqual(
        matchKeypress(kbdEvt("x", { altKey: true }), shortcuts),
        null,
      );
      assert.strictEqual(
        matchKeypress(kbdEvt("x", { ctrlKey: true }), shortcuts),
        null,
      );
      assert.strictEqual(
        matchKeypress(kbdEvt("x", { metaKey: true }), shortcuts),
        null,
      );
    });
  });
});
