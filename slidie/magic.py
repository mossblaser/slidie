"""
All <text> elemtns beginning with '@@@' followed by a newline are treated as
"magic text". The remaining text is interpreted as a TOML document which must
define *exactly one* top-level value. The name of this value identifies the
"magical" functionality to be invoked and the value are treated as parameters.

This module implements the locating, parsing and removal of these elements from
an SVG document. Implementation of the "magical" functionality is deferred to
the caller!
"""

from typing import Any, NamedTuple

from xml.etree import ElementTree as ET
from collections import defaultdict
import tomllib

from slidie.svg_utils import find_text_with_prefix


class MagicText(NamedTuple):
    """
    Represents the result of a piece of magic text found within a document.
    """

    parameters: Any
    """The parsed parameters passed for this magic."""

    parents: tuple[ET.Element, ...]
    """
    The full hierarchy of parent elements to the (now removed) <text>
    element which contained the magic text.
    """

    text: str
    """
    The text provided in this magic string, for error reporting purposes only.
    """


class MagicError(Exception):
    """Base class for errors resulting from parsing magic text."""


class MagicTOMLDecodeError(MagicError):
    """Thrown when a magic <text> element contains invalid TOML."""


class NotEnoughMagicError(MagicError):
    """Thrown when a magic <text> element defines no values."""


class TooMuchMagicError(MagicError):
    """Thrown when a magic <text> element defines more than one top-level value."""


def extract_magic(svg: ET.Element) -> dict[str, list[MagicText]]:
    """
    Find, parse and remove from the SVG all magic text.
    """
    out = defaultdict(list)

    # NB: Capture in list to allow safe mutation as we iterate
    for elems, text in list(find_text_with_prefix(svg, "@@@\n")):
        # Remove the <text> element from the document
        elems[-2].remove(elems[-1])
        parents = elems[:-1]

        try:
            parsed = tomllib.loads(text)
        except tomllib.TOMLDecodeError as e:
            raise MagicTOMLDecodeError(parents, text, e)

        if len(parsed) == 0:
            raise NotEnoughMagicError(parents, text)
        elif len(parsed) > 1:
            raise TooMuchMagicError(parents, text, list(parsed))

        (name,) = parsed.keys()
        parameters = parsed[name]

        out[name].append(MagicText(parameters, parents, text))

    return out
