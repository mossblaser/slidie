.. _metadata:

Metadata
========

Various pieces of slide and show metadata can be added to slides via a
combination of :ref:`magic text <magic-text>` annotations and the assignment of
specific IDs to text boxes within a slide.


Slide metadata
--------------

A title, author and date may be defined for a slide by either giving a text
element an XML ID of ``title``, ``author`` or ``date``. Thus the slide metadata
can be tied to the actual text on slides.

.. tip::

    You can change the XML ID of an element in Inkscape by right clicking on
    it, choosing 'Object Properties' and entering a name in the 'ID' box and
    clicking the 'Set' button (the latter step being easily forgotten!).

.. image:: _static/metadata_text_id_screenshot.png
    :alt: A text element with an XML ID set to 'title' in Inkscape.

Alternatively, you can create a :ref:`magic text box <magic-text>` defining one
of ``title``, ``author`` or ``date`` to define the relevant metadata without
any text appearing on the slide. This can be useful when the title as written
on the slide does not match what you'd prefer to appear in the slide show table
of contents.

At the moment, metadata assigned to the first slide is used to set :ref:`PDF
<rendering-pdf>` metadata. The title metadata alone on subsequent slides is
then used to populate PDF table of contents entries.

The :ref:`XHTML viewer <rendering-xhtml>` currently only uses the first slide's
title metadata to populate the show title in the toolbar.


.. _slide-ids:

Slide IDs
---------

Each slide may be assigned an ID for use in :ref:`intra-show hyperlinks
<links>`. To assign an ID to a slide, add a :ref:`magic text <magic-text>` box
anywhere on the slide which sets the ``id`` value like so::

    @@@
    id = "my-id-here"

.. seealso::

    :ref:`links`
        **TL;DR:** To create a hyperlink to a slide with the ID 'foo', use the
        URI ``#foo``.
