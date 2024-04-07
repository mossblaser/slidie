import { JSDOM } from "jsdom";
import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  eventInvolvesHyperlink,
  keyboardEventInterferesWithHyperlink,
} from "../ts/eventFilters.ts";
import ns from "../ts/xmlNamespaces.ts";

/**
 * Run the provided function within an event handler for an event dispatched to
 * the provided element. Returns a promise resolving to the value returned by
 * that function.
 */
function runInEventHandler<T>(
  jsdom: JSDOM,
  element: Element,
  fn: (event: Event) => T,
  makeEvent: (jsdom: JSDOM) => Event = (jsdom) =>
    new jsdom.window.Event("click"),
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      const evt = makeEvent(jsdom);
      element.addEventListener(evt.type, (evt) => {
        resolve(fn(evt));
      });
      element.dispatchEvent(evt);
    } catch (err) {
      reject(err);
    }
  });
}

test("eventFilters", async (t) => {
  await t.test("eventInvolvesHyperlink", async (t) => {
    await t.test("xhtml", async (t) => {
      const jsdom = new JSDOM(
        `
          <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <head><meta charset="utf-8"/></head>
            <body>
              <h1 id="not-link">Not a link</h1>
              <a href="#"><span id="is-link">Is a link</span></a>
              <button id="is-button">Is a button</button>
              <input id="is-input" />
            </body>
          </html>
        `,
        {
          contentType: "application/xhtml+xml",
        },
      );

      const notLink = jsdom.window.document.getElementById("not-link")!;
      const isLink = jsdom.window.document.getElementById("is-link")!;
      const isButton = jsdom.window.document.getElementById("is-button")!;
      const isInput = jsdom.window.document.getElementById("is-input")!;

      assert.deepEqual(
        await runInEventHandler(jsdom, notLink, eventInvolvesHyperlink),
        false,
      );
      assert.deepEqual(
        await runInEventHandler(jsdom, isLink, eventInvolvesHyperlink),
        true,
      );
      assert.deepEqual(
        await runInEventHandler(jsdom, isButton, eventInvolvesHyperlink),
        true,
      );
      assert.deepEqual(
        await runInEventHandler(jsdom, isInput, eventInvolvesHyperlink),
        true,
      );
    });

    await t.test("svg", async (t) => {
      const jsdom = new JSDOM(
        `
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
          >
            <a xlink:href="#"><text id="is-link" /></a>
            <text id="not-link" />
          </svg>
        `,
        {
          contentType: "image/svg+xml",
        },
      );

      const notLink = jsdom.window.document.getElementById("not-link")!;
      const isLink = jsdom.window.document.getElementById("is-link")!;

      assert.deepEqual(
        await runInEventHandler(jsdom, notLink, eventInvolvesHyperlink),
        false,
      );
      assert.deepEqual(
        await runInEventHandler(jsdom, isLink, eventInvolvesHyperlink),
        true,
      );
    });
  });

  await t.test("keyboardEventInterferesWithHyperlink", async (t) => {
    const jsdom = new JSDOM(
      `
        <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
          <head><meta charset="utf-8"/></head>
          <body>
            <h1 id="not-link">Not a link</h1>
            <input id="is-input" />
          </body>
        </html>
      `,
      {
        contentType: "application/xhtml+xml",
      },
    );

    const notLink = jsdom.window.document.getElementById("not-link")!;
    const isInput = jsdom.window.document.getElementById("is-input")!;

    assert.deepEqual(
      await runInEventHandler(
        jsdom,
        notLink,
        (evt) => keyboardEventInterferesWithHyperlink(evt as KeyboardEvent),
        (jsdom) => new jsdom.window.KeyboardEvent("keydown", { key: "Enter" }),
      ),
      false,
    );
    assert.deepEqual(
      await runInEventHandler(
        jsdom,
        isInput,
        (evt) => keyboardEventInterferesWithHyperlink(evt as KeyboardEvent),
        (jsdom) => new jsdom.window.KeyboardEvent("keydown", { key: "X" }),
      ),
      false,
    );
    assert.deepEqual(
      await runInEventHandler(
        jsdom,
        isInput,
        (evt) => keyboardEventInterferesWithHyperlink(evt as KeyboardEvent),
        (jsdom) => new jsdom.window.KeyboardEvent("keydown", { key: "Enter" }),
      ),
      true,
    );
  });
});
