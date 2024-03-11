import { test } from "node:test";
import { strict as assert } from "node:assert";

import { access } from "node:fs/promises";

import ns from "../ts/xml_namespaces.ts";
import { getSvgFilename, getSvg, getProcessedSvg } from "./svgs.ts";

test("svgs", async (t) => {
  await t.test("getSvgFilename", async (t) => {
    // NB: access throws an exception if the file does not exist
    await access(getSvgFilename("empty.svg"));
  });

  await t.test("getSvg", async (t) => {
    const dom = await getSvg("simple_text.svg");
    const textElems = dom.window.document.getElementsByTagNameNS(
      ns("svg"),
      "tspan",
    );
    assert.equal(textElems.length, 1);
    const textElem = textElems[0] as SVGTSpanElement;
    assert.equal(textElem.innerHTML, "Hello");
  });

  await t.test("getProcessedSvg", async (t) => {
    const dom = await getProcessedSvg("speaker_notes.svg");
    const notes = dom.window.document.getElementsByTagNameNS(
      ns("slidie"),
      "notes",
    );
    assert(notes.length > 0);
  });
});
