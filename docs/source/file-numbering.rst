.. _file-numbering:

Slidie file numbering/naming rules
==================================

The order in which slides are included is determined by numerical prefixes in
their filenames. For example:

    * 00100_first_slide.svg
    * 00200_second_slide.svg
    * 00300_third_slide.svg

Slide filenames *must* have an integer prefix and end with ``.svg``.

Slides are displayed in numerical rather than lexicographic order.

No two slides may start with the same number (even if formatted differently).

Slidie treats all digits at the start of its filename as the slide number,
ending with the first non-digit. Slide numbers may be negative (start with
``-``). They may also have explicit leading ``+``. Leading zeros are ignored.
Everything after the slide number is ignored.


.. _file-numbering-tips:

Practical tips
--------------

Naming
``````

Whilst it is completely valid to name your slides with *only* a number (e.g.
``1234.svg``), doing so makes it difficult to find the right one, especially as
you reorganise them. Using the slide title is often a helpful choice.

Feel free to use spaces, underscores, hyphens or anything else in your file
names according to taste. For example ``100 - Foo.svg`` and ``100_foo.svg`` are
equally valid.


BASIC-style numbering
`````````````````````

Using BASIC-line-number-style numbering makes it easier to reorganise slides at
a later point in time. For example, given the following:

* 100 - a.svg
* 200 - b.svg
* 300 - c.svg

You can move the slide 'C' between 'A' and 'B' by renumbering it to 150.

The gap you leave between numbers is a matter of taste. Larger gaps make it
less likely you'll have to rename extra files when reorganising your slides
whilst smaller gaps lead to smaller numbers. You could try 100 (as in the
example above) as a starting point if unsure.

Slidie provides the :ref:`slidie-mv <slidie-mv>` utility for conveniently
reordering slides based on this scheme (whilst handling the awkward case where
you run out of numbers).

Zero padding
````````````

Most file management utilities do not sort files lexicographically. As a
result, zero padding your file numbers to the same number of digits ensures
correctly sorted display.

Make sure to start out with at least one leading zero unless you're sure you'll
have fewer than ten slides!
