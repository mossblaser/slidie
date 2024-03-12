import { test } from "node:test";
import { strict as assert } from "node:assert";

import { JSDOM } from "jsdom";

import ns from "../ts/xmlNamespaces.ts";

import { wrapInShadowDom } from "../ts/wrapInShadowDom.ts";

test("wrapInShadowDom", async (t) => {
  const jsdom = new JSDOM(
    `
      <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <h1 id="duplicate-id-outside-shadow-dom">Foo</h1>
          <h1 id="duplicate-id-outside-shadow-dom">Bar</h1>
        </body>
      </html>
    `,
    { contentType: "application/xhtml+xml" },
  );

  const [foo, bar] = jsdom.window.document.getElementsByTagNameNS(
    ns("xhtml"),
    "h1",
  );

  const fooContainer = wrapInShadowDom(foo);
  const barContainer = wrapInShadowDom(bar, "bar-container", "span");

  // Check container properties set
  assert.deepEqual(fooContainer.tagName, "div");

  assert.deepEqual(barContainer.tagName, "span");
  assert.deepEqual(barContainer.className, "bar-container");

  // XXX: JSDOM's shadowdom implementation is barely more than a NOP so we
  // can't currently verify that the embedded documents really are isolated
  // (e.g. by looking up the elements by ID).
  //
  // TODO: Amend this test if support for this feature is introduced...
});
