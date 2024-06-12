.. _speaker-notes:

Speaker notes
=============

Speaker notes can be added to a slide by creating a text box whose first line
contains ``###`` (three hashes). The remainder of the textbox contains the
speaker notes in markdown_ format. SVG text formatting is ignored.

.. _markdown: https://en.wikipedia.org/wiki/Markdown

.. image:: _static/speaker_notes_source_screenshot.png
    :alt:
        A screenshot of Inkscape with a set of speaker notes.

When rendered, the text box containing the speaker notes will be made invisible
and so its doesn't *need* to be placed off the edge of the page -- though this
is often convenient. At the time of writing, :ref:`only the XHTML output format
supports displaying speaker notes <rendering-formats>`. In other formats, the
speaker notes are simply removed.

.. image:: _static/speaker_notes_viewer_screenshot.png
    :alt:
        A screenshot of the XHTML viewer showing some speaker notes.

.. tip::

    If you want to create a text box in your slide whose first line is ``###``
    without it being interpreted as a speaker note, add a trailing space to the
    first line. It will not be visible in the resulting document but will
    prevent Slidie treating it as a speaker note.


Per-:ref:`build step <builds>` speaker notes
--------------------------------------------

If multiple text boxes containing speaker notes are addded to your document,
the notes are concatenated together in the order they appear in the SVG
document. This means that the top-most notes on the top-most layers will be
shown first.

Speaker note text boxes placed on layers with :ref:`build steps <builds>` are
treated as only being relevant whilst that layer is visible: these notes are
shown dimmed out when the layer they're on is not visible.
