"""
Provides logic for defining links within a presentation at the slide and step
level.

Various link formats are defined below, all in the style of a URL hash.


Numerical links
===============

At the lowest level, slides (and steps) may
be referred to numerically based on their position in the slide show:

* ``#123`` -- Refers to the 123rd slide (counting from 1), implying the first
  build step of that slide.
* ``#123#456`` -- Refers to the 456th build step (counting from 1) of the 123rd
  slide (counting from 1).
* ``##456`` -- Refers to the 456th build step (counting from 1) of the current
  slide (only applicable when contextually sensible).


Build step numbers
==================

You can also specify build steps by the numbers used in the build step
specifications (which typically count from 0, but sometimes before) by
enclosing them in triangular brackets. For example:

* ``#123<456>`` -- Refers to the build step with number 456 (as used in build
  specs) on the 123rd slide (still counting from 1)
* ``#<456>`` -- Refers to the build step with number 456 on the current slide.


Build step tags
===============

Build steps may also be referenced by tag using the ``@tag`` syntax. Where a
particular tag refers to more than one build step, the first of these is
assumed.

* ``#123@foo`` -- Refers to the first build step with the tag '@foo' on the
  123rd slide (counting from 1).
* ``#@foo`` -- Refers to the first build step with the tag '@foo' on the
  current slide.


Slide IDs
=========

Slides may also be referenced by ID. An show-unique ID may be assigned to a
slide by creating magic text like the following anywhere in the SVG:

    @@@
    id = "something-unique"

IDs must start with a letter and must not contain '#', '<' or '@'.

Slides may then be referenced by ID in links like so:

* ``#slide-id-here`` -- References the slide with ID ``slide-id-here``.
* ``#slide-id-here@foo`` -- References may also be added to build steps using
  the syntax outlined obove.
"""

import re

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, MagicError


class SlideIDMagicError(MagicError):
    """Base class for errors involving slide ID magics."""


class MultipleIdsError(SlideIDMagicError):
    """Thrown when more than one ID is specified."""


class InvalidIdError(SlideIDMagicError):
    """Thrown when an invalid ID is used."""


def annotate_slide_id_from_magic(magic: dict[str, list[MagicText]]) -> None:
    """
    Annotates the <svg> element with a slidie:id attribute based on an 'id'
    magic text value within the slide.
    """
    id_magic = magic.pop("id", [])

    if len(id_magic) == 0:
        return  # Nothing to do

    # Check only one ID given
    if len(id_magic) > 1:
        raise MultipleIdsError(id_magic[1].parents, id_magic[1].text)

    slide_id = id_magic[0].parameters

    # Check ID is valid
    if not re.fullmatch(r"[^0-9#@<][^@#<]*", slide_id):
        raise InvalidIdError(id_magic[0].parents, id_magic[0].text, slide_id)

    # Annotate SVG
    svg = id_magic[0].parents[0]
    svg.attrib[f"{{{SLIDIE_NAMESPACE}}}id"] = slide_id
