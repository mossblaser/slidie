import pytest

from svgs import get_svg

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, extract_magic
from slidie.links import (
    MultipleIdsError,
    InvalidIdError,
    annotate_slide_id_from_magic,
)


class TestAnnotateSlideIdFromMagic:
    def test_no_id(self) -> None:
        # Shouldn't crash...
        annotate_slide_id_from_magic({})

    def test_too_many_ids(self) -> None:
        magic = extract_magic(get_svg("too_many_ids_magic.svg"))
        with pytest.raises(MultipleIdsError):
            annotate_slide_id_from_magic(magic)

    def test_works(self) -> None:
        svg = get_svg("id_magic.svg")
        magic = extract_magic(svg)
        annotate_slide_id_from_magic(magic)
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}id"] == "example"

    @pytest.mark.parametrize(
        "slide_id",
        [
            # Empty
            "",
            # Starts with a number
            "0",
            "9foo",
            # Starts with other banned char
            "#",
            "@",
            "<",
            # Contains banned char
            "xx#",
            "xx@",
            "xx<",
        ],
    )
    def test_invalid_ids(self, slide_id: str) -> None:
        magic = {
            "id": [
                MagicText(
                    parameters=slide_id,
                    parents=(get_svg("id_magic.svg"),),
                    text=f"id = {slide_id}",
                )
            ]
        }
        with pytest.raises(InvalidIdError):
            annotate_slide_id_from_magic(magic)

    @pytest.mark.parametrize(
        "slide_id",
        [
            "a-very-sensible-looking-id",
            # Minimum length
            "x",
            # Contains digits
            "x1234",
            # Contains special chars
            "->",
        ],
    )
    def test_valid_ids(self, slide_id: str) -> None:
        svg = get_svg("id_magic.svg")
        magic = {
            "id": [
                MagicText(
                    parameters=slide_id,
                    parents=(svg,),
                    text=f"id = {slide_id}",
                )
            ]
        }
        annotate_slide_id_from_magic(magic)
        assert svg.attrib[f"{{{SLIDIE_NAMESPACE}}}id"] == slide_id
