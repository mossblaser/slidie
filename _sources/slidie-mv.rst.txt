.. _slidie-mv:

``slidie-mv``: Slide renumbering tool
=====================================

The ``slidie-mv`` command can be used to reorder slides by renumbering them.


Reordering slides
-----------------

The following example illustrates how two slides could be renumbered to move
them later in a show::

    $ slidie-mv 100-foo.svg 200-bar.svg --after 300-bar.svg

As well as ``--after <slide>`` you can also use ``--before <slide>``,
``--start`` or ``--end`` to specify the destination.

Whenever possible ``slidie-mv`` will attempt to rename as few files as
possible. Only when necessary will slides which aren't actively being moved be
renamed.


.. note::

    ``slidie-mv`` will attempt to infer the numbering pattern in use. That is,
    it will guess the 'normal' gap between slide numbers and the number of
    digits to zero-pad to.


Creating a gap
--------------

If you want to create a gab between two adjacently numbered slides for a new
slide you can use the ``--insert <count>`` argument instead of a list of
existing slides to move.

For example say we have two slides ``299-foo.svg`` and ``300-bar.svg`` and we
want to insert a new slide between them we could use::

    $ slidie-mv --insert 1 --before 300-bar.svg
    400

In the example above, ``slidie-mv`` will automatically renumber either
``299-foo.svg`` or ``300-bar.svg`` to make room and print the slide number(s)
to use for your new slides.

.. note::

    ``slidie-mv`` will prefer o to move whichever file results in the last
    number of renaming operations, or all else being equal, whichever leads to
    leaving the biggest gaps between the new file numbers.


Renumbering all slides
----------------------

You can renumber all slides to produce a clean numbering scheme using the
following idiom::

    $ slidie-mv *.svg --start


Managing slides in Git
----------------------

If your slides are being tracked by Git, ``slidie-mv`` will attempt to use
``git mv`` to rename files. You can disable this behaviour using the
``--no-git-mv`` argument.


Argument reference
------------------

.. program-output:: slidie-mv --help
