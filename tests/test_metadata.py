import pytest

from svgs import get_svg

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, extract_magic
from slidie.metadata import (
    MultipleMetadataDefinitionsError,
    annotate_metadata_from_magic,
)


class TestAnnotateMetadataFromMagic:
    def test_no_metadata(self) -> None:
        # Shouldn't crash...
        annotate_metadata_from_magic({})

    def test_too_many_ids(self) -> None:
        magic = extract_magic(get_svg("repeated_metadata_magic.svg"))
        with pytest.raises(MultipleMetadataDefinitionsError):
            annotate_metadata_from_magic(magic)

    def test_works(self) -> None:
        svg = get_svg("metadata_magic.svg")
        magic = extract_magic(svg)
        annotate_metadata_from_magic(magic)
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}title"] == "Foo"
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}author"] == "Bar"
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}date"] == "Tomorrow"
