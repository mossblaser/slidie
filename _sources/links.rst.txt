.. _links:

Creating hyperlinks between slides
==================================

You can create hyperlinks between slides (and :ref:`build steps <builds>`)
by adding hyperlinks to anchor-style (``#...``) URIs in your SVGs using the
formats described below.

Links are supported by both the XHTML viewer and in PDF output formats. In the
case of the viewer, the ``#...`` URL fragment can be added to the viewer
URL to open the viewer at the specified slide.

.. tip::

    You can create hyperlinks directly in Inkscape by right-clicking an object
    and picking 'Create anchor (hyperlink)'. Enter the destination URI in the
    'Href' box.
    
    For links to external resources, you may wish to set the 'Target' to
    ``_blank`` to ensure the link opens in a new window. For inter-slide links,
    leave this box empty.
    
    .. image:: _static/hyperlink_screenshot.png
        :alt:
            A screenshot showing setting up a hyperlink in Inkscape


.. _links_slides:

Linking to slides
-----------------

You can link to the Nth slide by creating a link to ``#N``. For example, to
link to slide 4, use ``#4``. Slide indices count sequentially from '1' and are
not related to the numbers used :ref:`in filenames <file-numbering>`.
:ref:`Build steps <builds>` within a slide are not counted as separate slides.

You can also link to slides :ref:`by ID <slide-ids>`. For example, to link to a
slide with the ID 'foo', use ``#foo``.

.. seealso::

    :ref:`slide-ids`
        **TL;DR:** To give a slide an ID, create a text box containing the
        following anywhere in the slide::
        
            @@@
            id = "slide-id-here"

When linking to a slide with :ref:`multiple build steps <builds>`, the link
will always take you to the first step on that slide. See the next section to
create links to a specific step.


.. _links_tags:

Linking to build steps
----------------------

To link to :ref:`build step <builds>` 'M', add ``<M>`` to your link. For
example, to link to step 2 of slide 4, use ``#4<2>``, or for step 2 of the
slide with id 'foo' use ``#foo<2>``.

You can also link to build steps by tag name. For example, to link to the first
step of slide 4 with the tag 'foo', use ``#4@foo``.

.. seealso::
    :ref:`Build step tags <builds-tags>`

Finally, you can link to build steps by their 1-indexed position within the
show using the syntax ``#N#M`` which links to the Mth step of the Nth slide,
with both indices starting from 1.

.. note::

    The reason the ``#N#M`` syntax exists is because whilst step numbers
    *almost* always count from 0, it is possible for them to start from :ref:`a
    negative number  in certain (degenerate) edge
    cases<negative_step_numbers>`. The ``#N#M`` syntax is therefore useful in
    providing a guaranteed way to reference, say, the first step of a slide
    which is *always* ``#N#1`` but only *usually*  ``#N<0>``.

To directly link to build steps in the current slide, omit the
slide number part of the link. For example, to link to step 2 on the current
slide, use ``#<2>``.
