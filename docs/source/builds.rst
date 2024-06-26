.. _builds:

Builds
======

Complex slides can often benefit from being build up (revealed) step-by-step
during a presentation. Slidie supports this by allowing Inkscape layers to be
incrementally shown (or hidden) according to `Beamer
<https://en.wikipedia.org/wiki/Beamer_(LaTeX)>`_-inspired annotations added to
layer names.

Build specifications are given in angle brackets (``<`` and ``>``) anywhere
within the layer name and consist of a comma separated list of *step* numbers
during which that layer is visible.

For example if you have a slide with four layers named like so:

* A
* B <1>
* C <2>
* D <1, 2>.

.. image:: _static/examples/simple_steps_inkscape_screenshot.png
    :alt: 
        An Inkscape SVG with layers named 'A', 'B <1>', 'C <2>' and 'D <1, 2>'.

This describes a slide which builds in three steps (numbered 0, 1 and 2):

* In step 0 (the initial state of the slide), only layer A is visible.
* In step 1 (after the first click), layers A, B and D are visible.
* In step 2 (after the second click), layers A, C and D are visible.

.. image:: _static/examples/simple_steps.png
    :alt: 
        The three slides, side by side.

The Inkscape layer visibility setting for layers annotated with build
specifications is is ignored in rendered outputs. Layer visibility is instead
set according to the build steps specified. Non-annotated layers, however, will
remain visible (or hidden) as usual.


Ranges
------

You can also specify ranges of steps, for example, given the following layers:

* A <1>
* B <2>
* C <3>
* D <0-2>

.. image:: _static/examples/simple_range_inkscape_screenshot.png
    :alt: 
        An Inkscape SVG with layers named 'A <1>', 'B <2>', 'C <3>' and 'D
        <0-2>'.

This slide will build in four steps like so:

* In step 0 (the initial state of the slide), only layer D is visible.
* In step 1 (after the first click), layers A, D are visible.
* In step 2 (after the second click), layers B and D are visible.
* In step 3 (after the third click), only layer C is visible.

.. image:: _static/examples/simple_range.png
    :alt: 
        The four slides, side by side.

Open-ended ranges
-----------------

If the start or end of a range is omitted, this defines a range from the first
step or to last step respectively. For example ``<2->`` means 'from the second
click onward'.


Automatic step numbering
------------------------

For the common case where consecutive layers are revealed in consecutive steps
the ``+`` shorthand means the step after the first step in the previous layer
with a specification. For example:

* A
* B <+>
* C <+>

.. image:: _static/examples/simple_auto_numbering_inkscape_screenshot.png
    :alt: 
        An Inkscape SVG with layers named 'A', 'B <+>' and 'C <+>'.

Here, layer A is always visible whilst layers B C appear (then disappear) after
the first and second clicks respectively.

.. image:: _static/examples/simple_auto_numbering.png
    :alt: 
        The three slides, side by side.

A '+' can be used as part of a range specification. In addition the ``.``
shorthand works like ``+`` but without incrementing the step number. Used
together this allows you to achieve things like the following where elements
are highlighted as they're revealed:

* Title
* First bullet <+->
* First bullet highlight <.>
* Second bullet <+->
* Second bullet highlight <.>
* Third bullet <+->
* Third bullet highlight <.>

.. image:: _static/examples/simple_auto_ranges_inkscape_screenshot.png
    :alt: 
        An Inkscape SVG with layers named as above.


This slide has four steps with (for example) a bullet being reveled after each
click. The most recently shown bullet might be highlighted in some way in the
'highlight' layers.

.. image:: _static/examples/simple_auto_ranges.png
    :alt: 
        The four slides, side by side.

.. _builds-tags:

Tags
----

For advanced (or fiddly) usecases, it is possible to add one or more tags to a
layer by adding ``@tag_name_here`` to the layer name. These tags may be
referenced in other layers' build specifications to make layers appear in sync
with the tagged layer.

A typical use of this feature is for cases where graphics are split between
foreground and background layers and the foreground and background parts need
to be kept in sync. For example, consider the following layers:

* Foreground
    * Foreground A <+-> @a
    * Foreground B <+-> @b
    * Foreground C <+-> @c
* Background
    * Background A <@a>
    * Background B <@b>
    * Background C <@c>

This slide builds in four steps with foreground layers A, B and C being
revealed after each click. The corresponding background layers are revealed in
sync with their foreground counterparts.

.. seealso::

    :ref:`links_tags`
        Tag names are also used as named references in inter-slide hyperlinks.
        For example, ``#10@foo`` to link to the first build step on slide 10
        with the tag 'foo'.


Tag suffixes
````````````

When you use a tag in a build specification, *all* of the steps of *all* of the
layers tagged with that tag are copied into your specification.  By adding a
``.start``, ``.end``, ``.before``, or ``.after`` suffix, however, you can
instead reference the first or last steps in that set, or the steps immediately
before or after them. For example, given the following layers:

* Foo <1, 2, 3> @foo
* A <@foo.before>
* B <@foo.start>
* C <@foo.end>
* D <@foo.after>

.. image:: _static/examples/simple_tag_suffixes_inkscape_screenshot.png
    :alt: 
        An Inkscape SVG with layers named as above.

This defines a slide with five build steps:

* In step 0, just layer A is visible
* In step 1, layers Foo and B are visible
* In step 2, just layer Foo is visible
* In step 3, layers Foo and C are visible
* In step 4, just layer D is visible

.. image:: _static/examples/simple_tag_suffixes.png
    :alt: 
        The five slides, side by side.

.. _negative_step_numbers:

.. note::

    The astute reader may have noticed that ``@*.before`` syntax can lead to
    implicitly referencing steps numbered below zero. Slidie will handle this scenario
    (steps will start from -1, or -2, or whatever is necessary, on that slide)
    but it is best avoided: there is no other way to directly specify a
    negative step number.


Tags in ranges
``````````````

When a tag is used in a range specification without a suffix, the ``.start``
and ``.end`` suffixes are implied for the start end end of the range unless
otherwise specified. That is, ``<@foo-@bar>`` is treated as
``<@foo.start-@bar.end>``.


Sharing tags
````````````

Multiple layers can be labelled with the same tag. In this case, references to
that tag refer to the union of all steps those layers are visible on. For
example, given the layers:

* A <1> @foo
* B <2> @foo
* C <@foo>

Layer 'C' will be visible whenever layer 'A' or 'B' is -- steps 1 and 2 in this
example.


Limitations of tags
```````````````````

There are two major limitations to the use of tags in build specifications:

Firstly, circular dependencies between layers via tags are not permitted and
will result in an error.

Secondly, automatic step numbering (i.e. ``+`` and ``.``) ignore tag references
when computing the number to use. For example given the layers:

* A <1> @foo
* B <@foo, 2>
* C <.>

Here the ``.`` in layer C resolves to 2 (not 1) because 2 is the first non-tag
step in the layer B's build specification.
