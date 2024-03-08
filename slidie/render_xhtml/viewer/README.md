Slidie XHTML Viewer Application
===============================

Slidie's XHTML output format is a single page web application -- actually a
single *file* web application. The template for this file lives in this
directory.

The XHTML viewer consists of HTML, CSS and Javascript with slide SVGs embedded
as inline `<svg>` elements inside it. Slidie pre-processes these SVGs,
evaluating 'magic' text and injecting all manner of metadata into them. For
example build steps specifications are written into slidie-namespaced XML
attributes. The output format is designed to produce self-contained files which
can be opened directly without being served by a web server.


Quick-start
-----------

Install all Javascript-land build dependencies by running (from this
directory):

    $ npm install

The viewer is built using:

    $ npm run build

Or to build whenever a source file changes:

    $ npm run watch

The test suite can be run using:

    $ npm run test

Code auto-formatting can be applied using:

    $ npm run format



Why XHTML (not HTML)?
---------------------

Whilst HTML supports inline SVG, you lose XML namespace support which is
absolutely essential for passing in Slidie metadata. Fortunately XHTML, the
XML-embedding of HTML5, is almost indistinguishable from HTML and widely
supported. SVGs can be embedded in an XHTML document in all of their namespaced
glory whilst the rest of the document remains (almost) bog-standard HTML.


Why is Javascript Required?
---------------------------

At the moment a non-Javascript fallback mode is not implemented because of the
difficulty of handling build steps correctly. Rather than embedding multiple
copies of a slide (one for each build step) we instead use Javascript to
hide/reveal content on a slide as we progress.


Shadow DOMs
-----------

Unfortunately, when SVGs are inlined into an (X)HTML document they all resides
in the same global identifier namespace. As a result, ID collisions will be
rife causing all manner of things to break (e.g. gradients, clipping paths,
...).

In principle we could pre-process the SVGs to uniquify their IDs but this is
highly problematic. For example we would need to correctly locate all ID-based
references and, in the case of any embedded Javascript, deal with that too.
Essentially this would be a lot of work and won't work in all cases anyway.

Instead we use Javascript to place every SVG into its own [shadow
DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM).
This gives each of them an isolated environment, including their own ID
namespaces. (NB: 'open' shadow DOMs are used to allow Javascript to reach into
slides, for example to advance through build steps.

NB: There is a [new
mechanism](https://github.com/mfreed7/declarative-shadow-dom/blob/master/README.md#proposed-solution)
for declaratively creating shadow DOMs in HTML directly. At the time of
writing, however, this is still a bit [bleeding
edge](https://github.com/mfreed7/declarative-shadow-dom/blob/master/README.md#proposed-solution).


How is the Javascript built and tested?
---------------------------------------

When it became apparent that the viewer would include more than a trivial
amount of Javascript (e.g. for UI finesse and fancier features) it became hard
to excuse not using proper module structure and TypeScript. Together, these
mean mean some kind of build and bundling step is necessary.

> Side note: I have been burned a *lot* of times by the Javascript and Node
> ecosystem accumulating breaking changes at such a breathtaking rate as to
> render projects unbuildable after a year or two. As such, I don't take
> introducing a build step lightly and I am being deliberately very
> conservative.  Specifically I've tried to avoid anything complicated to
> configure (i.e. with a large breaking change attack surface), anything with a
> history of breaking changes and anything which requires your code to diverge
> from completely standard TypeScript/Javascript features (i.e. lock-in).

The viewer itself is built using [esbuild](https://esbuild.github.io/). This
traverses the import dependency tree from [`./ts/index.ts`](./ts/index.ts) and
produces a single inlineable Javascript file complete with inline source map,
[`./index.js`](./index.js).

The bundled Javascript is deliberately *not* minified to maximise bodgeability
and inspectability if the sources or slidie are unavailable in the future.
Unfortunately esbuild strips all comments during the build process, but
tidy source code is better than a name-free mess.

While esbuild transforms the viewer's TypeScript sources into Javascript, it
does not run the TypeScript type checker. This is only run (implicitly) as part
of the test suite.

The test suite lives in [`./tests/`](./tests/`) in files named `*.test.ts`.
The test suite is built on top of node's standard library
[testing](https://nodejs.org/api/test.html) and
[assertion](https://nodejs.org/api/assert.html#strict-assertion-mode)
libraries. All tests are run via [ts-node](https://typestrong.org/ts-node/) to
avoid an explicit compilation step. The real TypeScript type checker is
implicitly executed by ts-node and any type errors will result in a failure of
the test suite.


Compiled assets
---------------

A matching, compiled version of the viewer Javascript is included in the
repository. This way, the slidie Python package remains buildable even without
a working Javascript build environment.

Whenever a change to the viewer sources is made, a new bundle should be built
using `npm run build` and committed with the relevant TypeScript code.


Python test suite integration
-----------------------------

The viewer test suite will be invoked by the main pytest test suite. Likewise, it
will verify that the TypeScript and built Javascript are in sync to minimise
opportunity for mistakes.
