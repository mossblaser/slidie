Slidie
======

*Slidie is a slide preparation system which makes illustrations easy and bullet
points hard.*

Slidie converts a directory full of Inkscape SVGs into a slide show to
accompany a presentation.


Guided tour
-----------

To get a brief overview of how to get started with Slidie, see the
:ref:`Slidie guided tour <tour>`:

.. toctree::
    :maxdepth: 2
    
    tour.rst


Reference manual
----------------

The following documentation describes each of Slidie's features in detail.


File numbering
``````````````

Slidie orders SVG files in a directory :ref:`based on numbers at the start of their
filename <file-numbering>`. Slidie also provides the :ref:`slidie-mv <slidie-mv>`
command for conveniently renumbering SVG files to reorganise slides in a show.

.. toctree::
    :maxdepth: 2
    
    file-numbering.rst
    slidie-mv.rst


Slide builds
````````````

Slides can be built up step-by-step by showing (or hiding) groups Inkscape
layers. Slidie provides :ref:`syntax for defining builds <builds>` using
special annotations in layer names.


.. toctree::
    :maxdepth: 2
    
    builds.rst


Links
`````

Slidie supports :ref:`hyperlinks between slides <links>` using anchor-style
(``#...``) URIs.

.. toctree::
    :maxdepth: 2
    
    links.rst


Output formats
``````````````

Slidie supports rendering slide shows as :ref:`XHTML <rendering-xhtml>`,
:ref:`PDF <rendering-pdf>` and :ref:`PNG <rendering-png>` formats, albeit with
slightly different sets of supported features.

.. toctree::
    :maxdepth: 2
    
    rendering.rst
    xhtml-viewer.rst


Speaker notes
`````````````

Speaker notes can be embedded within a slide using ``<text>`` elements whose
contents begin with ``###``. These notes may be written in markdown and can
also be associated with specific build steps.

.. toctree::
    :maxdepth: 2
    
    speaker-notes.rst


Magic text
``````````

Slidie provides a convenient mechanism for embedding non-SVG-native content
such as :ref:`videos <video>` and :ref:`iframes <iframe>`, as well as certain
:ref:`metadata <metadata>`, based on 'magic' text boxes. Magic text boxes are
ordinary text boxes whose contents begin with ``@@@`` and contain TOML_ data.

.. _TOML: https://toml.io/en/

.. toctree::
    :maxdepth: 2
    
    magic-text.rst
    video.rst
    iframe.rst
    metadata.rst

