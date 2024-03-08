/**
 * Build and bundle the viewer Javascript source.
 *
 * Usage:
 *
 *     $ # Builds the viewer
 *     $ ts-node build.ts
 *
 *     $ # Builds the viewer whenever a file changes
 *     $ ts-node build.ts watch
 *
 *     $ # Check if the built files are up-to-date
 *     $ ts-node build.ts check-up-to-date
 */

import * as esbuild from "esbuild";

import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";

const buildOptions = {
  entryPoints: ["./ts/index.js"],
  outdir: ".",
  bundle: true,
  sourcemap: "inline" as "inline",
  banner: {
    js:
      "// The following Javascript is built from the Typescript sources in\n" +
      "//   slidie/render_xhtml/viewer/ts\n" +
      "// Unfortunately comments and type information are lost in the process.\n" +
      "// Sorry about that. There is an inline source map, though, and the\n" +
      "// original sources should be online at https://github.com/mossblaser/slidie.\n",
  },
};

/**
 * Run a single build.
 */
async function build() {
  await esbuild.build(buildOptions);
}

/**
 * Watch and rebuild automatically
 */
async function watch() {
  const context = await esbuild.context(buildOptions);
  await context.watch();
}

/**
 * Check whether the currently built artefacts match what the compiler would
 * produce.
 */
async function checkUpToDate() {
  let upToDate = true;
  const result = await esbuild.build({ write: false, ...buildOptions });
  for (const { path, contents } of result.outputFiles) {
    const filename = relative(buildOptions.outdir, path);
    try {
      const actualContents = await readFile(path);
      if (Buffer.compare(contents, actualContents) !== 0) {
        console.error(`${filename} is out of date`);
        upToDate = false;
      }
    } catch (e) {
      console.error(`${filename} doesn't exist`);
      upToDate = false;
    }
  }
  return upToDate;
}

(async () => {
  switch (process.argv[2]) {
    case undefined:
    case "build":
      await build();
      break;

    case "watch":
      await watch();
      break;

    case "check-up-to-date":
      if (!(await checkUpToDate())) {
        process.exit(1);
      }
      break;

    default:
      console.error(`Unrecognised command: ${process.argv[2]}`);
      process.exit(2);
  }
})();
