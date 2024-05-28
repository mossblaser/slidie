import pytest

from svgs import get_svg

from textwrap import dedent

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, extract_magic
from slidie.metadata import (
    MultipleMetadataDefinitionsError,
    annotate_metadata,
)


class TestAnnotateMetadata:
    def test_no_metadata(self) -> None:
        # Shouldn't crash...
        annotate_metadata(get_svg("empty.svg"), {})

    def test_too_many_definitions(self) -> None:
        svg = get_svg("repeated_metadata_magic.svg")
        magic = extract_magic(svg)
        with pytest.raises(MultipleMetadataDefinitionsError) as excinfo:
            annotate_metadata(svg, magic)

        assert (
            str(excinfo.value)
            == dedent(
                """
                    title defined multiple times:
                    * on Layer 1 in:
                        @@@
                        title = "foo"
                    * on Layer 1 in:
                        @@@
                        title = "foo"  # Again, whoops!
                    * on Layer 1 in <text> 'I have id "title"'
            """
            ).strip()
        )

    def test_works_magic(self) -> None:
        svg = get_svg("metadata_magic.svg")
        magic = extract_magic(svg)
        annotate_metadata(svg, magic)
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}title"] == "Foo"
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}author"] == "Bar"
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}date"] == "Tomorrow"

    def test_works_id(self) -> None:
        svg = get_svg("metadata_id.svg")
        annotate_metadata(svg, {})
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}title"] == "Foo"
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}author"] == "Bar"
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}date"] == "Tomorrow"
