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
from dataclasses import dataclass
from textwrap import indent
import tomllib

from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.svg_utils import (
    find_text_with_prefix,
    is_inkscape_layer,
    get_inkscape_layer_name,
)


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


@dataclass
class MagicError(Exception):
    """Base class for errors resulting from parsing magic text."""

    parents: tuple[ET.Element, ...]
    """The parent elements of the magic text."""

    text: str
    """The literal text in the magic string."""

    def _str_configurable(self, number_lines: bool = False) -> str:
        """
        Version of the base ``__str__`` implementation with customisable
        options. Intended for use by descendents who need greater control.
        """
        layer = " > ".join(
            get_inkscape_layer_name(elem)
            for elem in self.parents
            if is_inkscape_layer(elem)
        )

        if number_lines:
            text = "    0| @@@\n"
            text += "".join(
                f"{i + 1:5d}| {line}"
                for i, line in enumerate(self.text.rstrip().splitlines(keepends=True))
            )
        else:
            text = "    @@@\n" + indent(self.text.rstrip(), "    ")

        if layer:
            return f"on {layer} in:\n{text}"
        else:
            return f"in:\n{text}"

    def __str__(self) -> str:
        return self._str_configurable()


@dataclass
class MagicTOMLDecodeError(MagicError):
    """Thrown when a magic <text> element contains invalid TOML."""

    error: tomllib.TOMLDecodeError
    """The TOML decoding error which ocurred."""

    def __str__(self) -> str:
        prefix = self._str_configurable(number_lines=True)
        return f"{prefix}\n{self.error}"


@dataclass
class NotEnoughMagicError(MagicError):
    """Thrown when a magic <text> element defines no values."""

    def __str__(self) -> str:
        return f"{super().__str__()}\nExpected a value to be defined."


@dataclass
class TooMuchMagicError(MagicError):
    """Thrown when a magic <text> element defines more than one top-level value."""

    keys: list[str]
    """
    List of keys defined simultaneously.
    """

    def __str__(self) -> str:
        values = ", ".join(map(repr, self.keys))
        return f"{super().__str__()}\nExactly one value must be defined (got {values})"


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
            raise MagicTOMLDecodeError(parents, text, e) from None

        if len(parsed) == 0:
            raise NotEnoughMagicError(parents, text)
        elif len(parsed) > 1:
            raise TooMuchMagicError(parents, text, list(parsed))

        (name,) = parsed.keys()
        parameters = parsed[name]

        out[name].append(MagicText(parameters, parents, text))

    return out


@dataclass
class SingleRectOrImageExpectedError(MagicError):
    """
    Thrown if a magic text which applies some effect to a rectangular region
    was placed into a container with more than just a <rect> or <image> element
    in it.
    """

    def __str__(self) -> str:
        container = self.parents[-1]

        if len(container) == 0:
            got = "no elements present"
        else:
            tags = " and ".join(
                "<" + elem.tag.removeprefix(f"{{{SVG_NAMESPACE}}}") + ">"
                for elem in container
            )
            got = f"got {tags}"

        return (
            f"{super().__str__()}\n"
            f"Expected text to be grouped with a single <rect> or <image> ({got})"
        )


class MagicRectangle(NamedTuple):
    """Output of :py:func:`check_magic_rectangle`."""

    container: ET.Element
    """
    The container element with a single child: :py:attr:`rectangle`.
    """

    rectangle: ET.Element
    """
    The <image> or <rect> element defining the rectangle.
    """


def get_magic_rectangle(magic_text: MagicText) -> MagicRectangle:
    """
    Given a :py:class:`MagicText`, verify that the magic text appeared in a <g>
    containing only that text and either an <image> or <rect> object.

    Throws a :py:exc:`SingleRectOrImageExpectedError` exception if the
    """
    container = magic_text.parents[-1]

    # Check we have a single <image> or <rect>
    if len(container) != 1:
        raise SingleRectOrImageExpectedError(magic_text.parents, magic_text.text)
    rectangle = container[0]
    if rectangle.tag not in (
        f"{{{SVG_NAMESPACE}}}rect",
        f"{{{SVG_NAMESPACE}}}image",
    ):
        raise SingleRectOrImageExpectedError(magic_text.parents, magic_text.text)

    return MagicRectangle(container, rectangle)
