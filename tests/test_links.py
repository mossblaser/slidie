import pytest

from svgs import get_svg

from textwrap import dedent

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.magic import MagicText, extract_magic
from slidie.links import (
    MultipleIdsError,
    InvalidIdError,
    annotate_slide_id_from_magic,
    resolve_link,
)


class TestAnnotateSlideIdFromMagic:
    def test_no_id(self) -> None:
        # Shouldn't crash...
        annotate_slide_id_from_magic({})

    def test_too_many_ids(self) -> None:
        magic = extract_magic(get_svg("too_many_ids_magic.svg"))
        with pytest.raises(MultipleIdsError) as excinfo:
            annotate_slide_id_from_magic(magic)

        assert (
            str(excinfo.value)
            == dedent(
                """
                on Layer 1 in:
                    @@@
                    id = "example"
                'id' redefined again elsewhere.
            """
            ).strip()
        )

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
                    text=f'id = "{slide_id}"',
                )
            ]
        }
        with pytest.raises(InvalidIdError) as excinfo:
            annotate_slide_id_from_magic(magic)

        assert (
            str(excinfo.value)
            == dedent(
                f"""
                in:
                    @@@
                    id = "{slide_id}"
                '{slide_id}' is not a valid ID.
            """
            ).strip()
        )

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


class TestResolveLink:
    @pytest.mark.parametrize(
        "link",
        [
            # No hash prefix
            "",
            "123",
            # Multiple step specs
            "##1#2",
            "##1<2>",
            "##1@foo",
            "#<1>#2",
            "#<1><2>",
            "#<1>@two",
            "#@one@two",
            # Unknown ID
            "#who-knows",
        ],
    )
    def test_invalid(self, link: str) -> None:
        assert resolve_link(link, {}, [[0]], [{}], 0) is None

    @pytest.mark.parametrize(
        "link, exp_slide_index, exp_step_index",
        [
            # Current slide
            ("#", 1, 0),
            # Current slide, step index
            ("##2", 1, 1),
            # Current slide, step number
            ("#<-1>", 1, 1),
            # Current slide, step tag
            ("#@first-step", 1, 0),
            # Numbered slide
            ("#1", 0, 0),
            # Numbered slide with step
            ("#1#2", 0, 1),
            # Slide by ID
            ("#third-slide", 2, 0),
            # Slide by ID with step
            ("#third-slide#2", 2, 1),
            # Tag with multiple steps
            ("#1@last-two-steps", 0, 1),
            # Unknown tag
            ("#3@nope", 2, 0),
            # Tag on out of range slide
            ("#99@nope", 98, 0),
            # Unknown step number
            ("#3<99>", 2, 0),
            # Step number on out of range slide
            ("#99<99>", 98, 0),
        ],
    )
    def test_valid(self, link: str, exp_slide_index: int, exp_step_index: int) -> None:
        assert resolve_link(
            link,
            slide_ids={"third-slide": 2},
            slide_step_numbers=[
                [-1, 0, 1],
                [-2, -1, 0],
                [0, 1],
            ],
            slide_build_tags=[
                {
                    "first-step": {-1},
                    "last-step": {0},
                    "last-two-steps": {0, 1},
                },
                {"first-step": {-2}},
                {},
            ],
            current_slide_index=1,
        ) == (exp_slide_index, exp_step_index)
