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
  // Ideally we would use 'inline' source map however both Firefox and Chrome's
  // handling of inline sourcemaps is extremely buggy to the point of not being
  // usable for debugging at present. As a result we use a linked sourcemap
  // here (which will be loaded in debug builds of the viewer where the JS is
  // not inlined). In non-debug builds, the magic 'sourceMappingURL' comment
  // will be amended to include the data-URL version of the source map
  // instead. For present day browsers this at least makes the source available
  // in the debug panel and maybe for future browsers will actually be useful
  // for debugging too!
  sourcemap: "linked" as "linked",
  banner: {
    js:
      "\n" +
      "// Though the code below is the mangled result of the Typescript\n" +
      "// compiler and esbuild bundler (hence the absent comments) it isn't\n" +
      "// minified so may still be readable... The full Typescript sources are\n" +
      "// embedded in the source map at the end of the script file and should\n" +
      "// show up in your Browser's debug tools. At the time of writing (2024)\n" +
      "// most browsers, however, still fail to resolve names/line numbers\n" +
      "// using the inline source maps within an inline script tag. Sorry.\n" +
      "//\n" +
      "// The following Javascript is built from the Typescript sources in the\n" +
      "// `slidie/render_xhtml/viewer/ts` directory of the Slidie source code\n" +
      "// which should be online at https://github.com/mossblaser/slidie.\n",
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
