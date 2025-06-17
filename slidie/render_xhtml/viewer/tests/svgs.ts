/**
 * Test utility which provides access to SVG files in the main pytest suite's
 * `tests/svgs/` directory.
 */
import { JSDOM } from "jsdom";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { Readable } from "node:stream";

/**
 * Return the path to a named SVG in the pytest tests/svg directory.
 */
export function getSvgFilename(name: string): string {
  return join(basename(__filename), "../../../../tests/svgs/", name);
}

/**
 * Return the JSDOM object containing the loaded svg from the pytest tests/svgs
 * directory.
 */
export async function getSvg(name: string): Promise<SVGSVGElement> {
  const filename = getSvgFilename(name);
  const jsdom = new JSDOM(await readFile(filename), {
    contentType: "image/svg+xml",
  });
  return jsdom.window.document.documentElement as any as SVGSVGElement;
}

/**
 * Return the JSDOM object containing the loaded svg from the pytest tests/svgs
 * directory after processing by the slidie.render_xhtml.render_slide
 * function.
 */
export async function getProcessedSvg(name: string): Promise<SVGSVGElement> {
  const inputFile = getSvgFilename(name);

  const buildDir = await mkdtemp(
    join(tmpdir(), "slidie-test-viewer-render-slide-wrapper-"),
  );
  const outputFile = join(buildDir, name);

  try {
    const proc = await spawn("python3", [
      join(
        basename(__filename),
        "../../../../tests/render_xhtml/render_slide.py",
      ),
      resolve(inputFile),
      resolve(outputFile),
    ], {"stdio": "inherit"});
    await new Promise((resolve) => proc.on("close", resolve));
    const jsdom = new JSDOM(await readFile(outputFile), {
      contentType: "image/svg+xml",
    });
    return jsdom.window.document.documentElement as any as SVGSVGElement;
  } finally {
    await rm(buildDir, { recursive: true });
  }
}
