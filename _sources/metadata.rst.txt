.. _metadata:

Metadata
========

Various pieces of slide and show metadata can be added to slides via either
:ref:`magic text <magic-text>` annotations or naming relevant text boxes within
a slide.


Slide metadata
--------------

A title, author and date may be defined for a slide by giving a text element an
XML ID of ``title``, ``author`` or ``date``. This mechanism ensures that slide
metadata is consistent with the actual text on slides.

.. tip::

    You can change the XML ID of an element in Inkscape by right clicking on
    it, choosing 'Object Properties' and entering a name in the 'ID' box and
    clicking the 'Set' button (the last step being easily forgotten!).

.. image:: _static/metadata_text_id_screenshot.png
    :alt: A text element with an XML ID set to 'title' in Inkscape.

Alternatively, you can create a :ref:`magic text box <magic-text>` defining one
of ``title``, ``author`` or ``date`` to define the relevant metadata without
any text appearing on the slide. For example::

    @@@
    title = "My slide's title"

This can be useful when the title as written on the slide does not match what
you'd prefer to appear in the slide show table of contents.

Metadata assigned to the first slide is treated as the document-level metadata.
For example, :ref:`PDF <rendering-pdf>` document-level metadata and the title
of the :ref:`XHTML viewer <xhtml-viewer>`.

At the moment, slide metadata beyond the first slide is largely unused. An
exception is that PDF tables of contents are populated using slide 'title'
data.


.. _slide-ids:

Slide IDs
---------

Each slide may also be assigned a slide ID for use in :ref:`intra-show
hyperlinks <links>`. To assign a slide ID to a slide, add a :ref:`magic text
<magic-text>` box anywhere on the slide which sets the ``id`` value like so::

    @@@
    id = "my-id-here"

.. seealso::

    :ref:`links`
        **TL;DR:** To create a hyperlink to a slide with the ID 'foo', use the
        URI ``#foo``.
