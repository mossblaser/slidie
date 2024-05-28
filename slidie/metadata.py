"""
Utilities for extracting slide show metadata from magic variables and <text>
elements with appropriate IDs in slides.
"""

from dataclasses import dataclass
from xml.etree import ElementTree as ET

from slidie.xml_namespaces import SLIDIE_NAMESPACE, SVG_NAMESPACE
from slidie.svg_utils import (
    extract_multiline_text,
    get_elem_inksape_layers,
)
from slidie.magic import MagicText, MagicError


@dataclass
class MetadataError(Exception):
    """Base class for errors involving slide metadata."""


@dataclass
class MultipleMetadataDefinitionsError(MetadataError):
    """Thrown when more than one value is given for a metadata field."""

    field: str
    """The name of the field defined multiple times."""

    svg: ET.Element
    """The SVG root element."""

    magic_values: list[MagicText]
    """The list of magic text elements defining this value."""

    text_elems: list[ET.Element]
    """The list of <text> elements defining this value."""

    def __str__(self) -> str:
        source_descriptions = []

        # Describe locations of magic text
        for magic_value in self.magic_values:
            # Re-use the MagicError formatting of a reference to magic text
            source_descriptions.append(
                str(MagicError(magic_value.parents, magic_value.text))
            )

        # Describe locations of <text> elements
        for text_elem in self.text_elems:
            layer = " > ".join(get_elem_inksape_layers(self.svg, text_elem))
            text = extract_multiline_text(text_elem)
            source_descriptions.append(f"on {layer} in <text> {text!r}")

        descriptions = "\n* ".join(source_descriptions)
        return f"{self.field} defined multiple times:\n* {descriptions}"


def annotate_metadata(svg: ET.Element, magic: dict[str, list[MagicText]]) -> None:
    """
    Annotates the <svg> element with the following attributes when a value is
    provided elsewhere:

    * slidie:title
    * slidie:author
    * slidie:date

    The values are sourced from either the 'title', 'author' or 'date' magic
    values or from <text> elements whose XML IDs are 'title', 'author' or
    'date'.

    If a metadata value is specified in more than one place, an exception is
    thrown.
    """
    for field in ["title", "author", "date"]:
        # Get magic values
        magic_values = magic.pop(field, [])
        values = [v.parameters for v in magic_values]

        # Get identified <text> element (NB: there should be one, of course,
        # but that is no guarantee
        text_elems = svg.findall(f".//{{{SVG_NAMESPACE}}}text[@id='{field}']")
        if text_elems:
            values.extend(map(extract_multiline_text, text_elems))

        if len(values) == 0:
            continue
        if len(values) == 1:
            svg.attrib[f"{{{SLIDIE_NAMESPACE}}}{field}"] = values[0]
        else:
            raise MultipleMetadataDefinitionsError(field, svg, magic_values, text_elems)
