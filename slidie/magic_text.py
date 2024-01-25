"""
Logic for locating and labelling 'magic' text blocks within an SVG.


What is a magic text block?
===========================

Text blocks starting with '###' are treated as speaker notes. The body text
(with the '###' prefix stripped) is typically treated as Markdown.

Text blocks starting with '@@@' are parsed as TOML and may be used to trigger
advanced functionality (such as embedding video).


What does this module do?
=========================

This module only implements the *locating* of these text blocks within an SVG,
and not any kind of processing of anything within these blocks.
"""

from collections.abc import Iterator

from xml.etree import ElementTree as ET
import json

from slidie.svg_utils import extract_multiline_text
from slidie.xml_namespaces import SVG_NAMESPACE, SLIDIE_NAMESPACE


def find_magic_text(
    root: ET.Element,
    prefix: str,
    _parents: tuple[ET.Element, ...] = (),
) -> Iterator[tuple[tuple[ET.Element, ...], str]]:
    """
    Iterate over all text blocks within a document with the given prefix.

    Generates a series of (path, str) pairs. Here the string is the text
    embedded in the <text> with the leading prefix removed. The path is a tuple
    starting with the passed in element and all intermediate elements until the
    matched <text> block. This may be useful for magic text objects which are
    sensitive to sibling or parent objects (since ElementTree doesn't include
    parent references!).

    The _parents argument is for internal use only.
    """
    if root.tag == f"{{{SVG_NAMESPACE}}}text":
        text = extract_multiline_text(root)
        if text.startswith(prefix):
            yield (_parents + (root,), text.removeprefix(prefix))
    elif root.tag.startswith(f"{{{SVG_NAMESPACE}}}"):
        for child in root:
            yield from find_magic_text(child, prefix, _parents + (root,))
