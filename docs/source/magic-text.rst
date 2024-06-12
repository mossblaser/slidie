.. _magic-text:

Magic text
==========

To support easy embedding of non-native content within SVGs like :ref:`videos
<video>`, :ref:`iframes <iframe>` or :ref:`custom metadata <metadata>`, Slidie
provides the 'magic' text feature.

A magic text box is an ordinary SVG text box whose first line is ``@@@`` (three
'at' signs). The remainder of the text box's contents is interpreted as a TOML_
document and must define *exactly one* value.

As an example, both of the following are valid magic text values: both define a
single top-level value -- ``video`` -- though in the latter case that value
contains a complex datastructure with multiple sub-values.

.. _TOML: https://toml.io/en/

::

    @@@
    video = "http://example.com/example.mp4"

::

    @@@
    # A more complex example...
    [video]
    url = "http://example.com/example.mp4"
    start = 12.3
    mute = true

Magic text boxes are removed from slides during rendering and do not appear in
the output. As a result they can be placed wherever is convenient on a slide.

.. tip::

    If you want to create a text box in your slide whose first line is ``@@@``
    without it being interpreted as magic text, add a trailing space to the
    first line. It will not be visible in the resulting document but will
    prevent Slidie treating it as magic text.

.. seealso::

    See the following supported magic-text-based functions:

    :ref:`video`
        Uses the ``video`` magic text value.
    :ref:`iframe`
        Uses the ``iframe`` magic text value.
    :ref:`metadata`
        Various magic text values may be used to define document and slide
        metadata, including ``name``, ``author`` and ``date``.


.. warning::

    Unrecognised top-level magic text values are silently ignored. If your
    magic text is not working as intended, look out for typos!
    
    This is purely an artefact of a lazy implementation in Slidie and may one
    day be addressed...



.. _magic-rectangles:

Magic rectangles
----------------

In some cases (such as :ref:`videos <video>` and :ref:`iframes <iframe>`), a
magic text definition must be associated with a rectangular region on a slide.
To do this you should group a placeholder SVG rectangle or image object with
the magic text box.

.. warning::

    Only SVG rectangles (``<rect>``) and images (``<image>``) are supported as
    placeholders. For example, a ``<path>`` defining a rectangle is not
    suitable.

.. warning::

    Take care to put the placeholder and magic text alone within their group.
    Slidie will produce an error if other elements are included.

In supported output formats, both the magic text and associated placeholder
will be removed and replaced with the desired non-native object. In other
formats, the placeholder will be shown instead (though the magic text will
still be removed). This allows you to produce slides which render sensibly in
several output formats.

