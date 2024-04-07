import { strict as assert } from "node:assert";
import { access } from "node:fs/promises";
import { test } from "node:test";

import ns from "../ts/xmlNamespaces.ts";

import { getProcessedSvg, getSvg, getSvgFilename } from "./svgs.ts";

test("svgs", async (t) => {
  await t.test("getSvgFilename", async (t) => {
    // NB: access throws an exception if the file does not exist
    await access(getSvgFilename("empty.svg"));
  });

  await t.test("getSvg", async (t) => {
    const dom = await getSvg("simple_text.svg");
    const textElems = dom.ownerDocument.getElementsByTagNameNS(
      ns("svg"),
      "tspan",
    );
    assert.equal(textElems.length, 1);
    const textElem = textElems[0] as SVGTSpanElement;
    assert.equal(textElem.innerHTML, "Hello");
  });

  await t.test("getProcessedSvg", async (t) => {
    const dom = await getProcessedSvg("speaker_notes.svg");
    const notes = dom.ownerDocument.getElementsByTagNameNS(
      ns("slidie"),
      "notes",
    );
    assert(notes.length > 0);
  });
});
