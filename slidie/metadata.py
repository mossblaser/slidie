"""
Utilities for extracting slide show metadata from magic variables in slides.
"""

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, MagicError


class MetadataMagicError(MagicError):
    """Base class for errors involving slide metadata magics."""


class MultipleMetadataDefinitionsError(MetadataMagicError):
    """Thrown when more than one value is given for a metadata field."""


def annotate_metadata_from_magic(magic: dict[str, list[MagicText]]) -> None:
    """
    Annotates the <svg> element with the following attributes based on their
    corresponding magic values:

    * slidie:title
    * slidie:author
    * slidie:date
    """
    for field in ["title", "author", "date"]:
        field_magic = magic.pop(field, [])
        if len(field_magic) == 0:
            continue

        # Check for singular definition
        if len(field_magic) > 1:
            raise MultipleMetadataDefinitionsError(
                field_magic[1].parents, field_magic[1].text
            )

        # Annotate SVG
        svg = field_magic[0].parents[0]
        value = field_magic[0].parameters
        svg.attrib[f"{{{SLIDIE_NAMESPACE}}}{field}"] = value
