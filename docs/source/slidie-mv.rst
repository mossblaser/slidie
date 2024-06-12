.. _slidie-mv:

``slidie-mv``: Slide renumbering tool
=====================================

The ``slidie-mv`` command can be used to reorder slides by :ref:`renumbering
<file-numbering>` them.


Reordering slides
-----------------

The following example illustrates how two slides could be renumbered to move
them later in a show::

    $ slidie-mv 100-foo.svg 200-bar.svg --after 300-baz.svg

The result would be that the slides ``100-foo.svg`` and ``100-bar.svg`` would
be given new numerical prefixes like ``400-foo.svg`` and ``500-bar.svg``.

As well as ``--after <slide>`` you can also use ``--before <slide>``,
``--start`` or ``--end`` to specify the destination.

Whenever possible ``slidie-mv`` will attempt to rename as few files as
possible. Only when necessary will slides which aren't actively being moved be
renamed.


.. note::

    ``slidie-mv`` will attempt to infer the numbering pattern in use. That is,
    it will guess the 'normal' gap between slide numbers and the number of
    digits to zero-pad to.


Inserting new slides
--------------------

``slidie-mv`` can also suggest new slide numbers to use to insert new slides
into your presentation using ``--insert <count>``, for example::

    $ slidie-mv --insert 1 --after 300-foo.svg
    400

In the example above, ``slidie-mv`` suggested we asign our new slide the number
400.


Creating gaps
-------------

For example say we have two slides ``300-foo.svg`` and ``301-bar.svg`` and we
want to move a slide in between them, Slidie will have to rename not just the
moved slide but also either ``300-foo.svg`` or ``301-bar.svg`` (and potentially
any further immediate adjacent slides).

The ``slidie-mv`` command will determine which files to rename, prioritising
keeping the number of files renamed to a minimum (to keep version control
history cleaner) and maximise the spacing of the resulting numbers (to maximise
the chances of gaps existing in the future).


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
