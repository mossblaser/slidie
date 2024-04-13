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
from dataclasses import dataclass

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, MagicError


@dataclass
class SlideIDMagicError(MagicError):
    """Base class for errors involving slide ID magics."""


@dataclass
class MultipleIdsError(SlideIDMagicError):
    """Thrown when more than one ID is specified."""

    def __str__(self) -> str:
        return f"{super().__str__()}\n'id' redefined again elsewhere."


@dataclass
class InvalidIdError(SlideIDMagicError):
    """Thrown when an invalid ID is used."""

    slide_id: str
    """The (invalid) slide ID provided."""

    def __str__(self) -> str:
        return f"{super().__str__()}\n{self.slide_id!r} is not a valid ID."


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
        raise MultipleIdsError(id_magic[0].parents, id_magic[0].text)

    slide_id = id_magic[0].parameters

    # Check ID is valid
    if not re.fullmatch(r"[^0-9#@<][^@#<]*", slide_id):
        raise InvalidIdError(id_magic[0].parents, id_magic[0].text, slide_id)

    # Annotate SVG
    svg = id_magic[0].parents[0]
    svg.attrib[f"{{{SLIDIE_NAMESPACE}}}id"] = slide_id


# fmt: off
LINK_REGEX = re.compile(
    "^#"
    # Slide spec
    "(?:"
        "(?P<slide_index>[0-9]+)"
        "|"
        "(?P<slide_id>[^0-9#@<][^#@<]*)"
    ")?"
    # Build step spec
    "(?:"
        "(?:#(?P<step_index>[0-9]+))"
        "|"
        "(?:<(?P<step_number>[-+]?[0-9]+)>)"
        "|"
        "(?:@(?P<step_tag>[^\\s<>.@]+))"
    ")?"
    "$"
)
# fmt: on
"""
Regular expression matching valid link syntax.
"""


def resolve_link(
    link: str,
    slide_ids: dict[str, int],
    slide_step_numbers: list[list[int]],
    slide_build_tags: list[dict[str, set[int]]],
    current_slide_index: int,
) -> tuple[int, int] | None:
    """
    If passed a valid link, returns the (slide_index, step_index) for the
    referenced slide.

    Parameters
    ==========
    link: str
        The link to resolve (including leading hash).
    slide_ids: {"slide_id": slide_index, ...}
        Lookup for all defined slide IDs.
    slide_step_numbers: [[step_number, ...], ...]
        For each slide, an enumeration of the user-defined step numbers.
    slide_build_tags: [{"tag": {step_number}}, ...]
        For each slide, a lookup from tag to step numbers (not indices) with
        that tag.
    current_slide_index: int
        The index of the currently displayed slide (not step).

    Returns
    =======
    (slide_index, step_index)
        If the provided link is valid.
    None
        Otherwise.
    """
    match = LINK_REGEX.fullmatch(link)
    if not match:
        return None

    # Work out the slide index
    if slide_index_str := match.group("slide_index"):
        slide_index = int(slide_index_str) - 1
    elif slide_id := match.group("slide_id"):
        if slide_id in slide_ids:
            slide_index = slide_ids[slide_id]
        else:
            return None  # Unknown slide ID
    else:
        slide_index = current_slide_index  # Default to current slide

    # Work out step index
    if step_index_str := match.group("step_index"):
        step_index = int(step_index_str) - 1
    elif step_number_str := match.group("step_number"):
        try:
            step_index = slide_step_numbers[slide_index].index(int(step_number_str))
        except IndexError:
            step_index = 0  # For out-of-range slide indices always resolve to zero
        except ValueError:
            step_index = 0  # Treat out-of-range step number as zero
    elif step_tag := match.group("step_tag"):
        try:
            step_number = min(slide_build_tags[slide_index].get(step_tag, set()))
            step_index = slide_step_numbers[slide_index].index(step_number)
        except IndexError:
            step_index = 0  # For out-of-range slide indices always resolve to zero
        except ValueError:
            step_index = 0  # Treat tags with no steps as zero
    else:
        step_index = 0  # Default to first step

    return (slide_index, step_index)
