/**
 * Test utility which provides access to SVG files in the main pytest suite's
 * `tests/svgs/` directory.
 */

import { join, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import * as readline from "node:readline/promises";

import { JSDOM } from "jsdom";

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
export async function getSvg(name: string): Promise<JSDOM> {
  const filename = getSvgFilename(name);
  return new JSDOM(await readFile(filename), { contentType: "image/svg+xml" });
}

/**
 * Return the JSDOM object containing the loaded svg from the pytest tests/svgs
 * directory after processing by the slidie.render_xhtml.render_slide
 * function.
 */
export async function getProcessedSvg(name: string): Promise<JSDOM> {
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
    ]);
    await new Promise((resolve) => proc.on("close", resolve));
    return new JSDOM(await readFile(outputFile), {
      contentType: "image/svg+xml",
    });
  } finally {
    await rm(buildDir, { recursive: true });
  }
}
