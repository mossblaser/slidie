import pytest

from svgs import get_svg

from slidie.magic import (
    extract_magic,
    MagicTOMLDecodeError,
    NotEnoughMagicError,
    TooMuchMagicError,
    SingleRectOrImageExpectedError,
    get_magic_rectangle,
)


class TestExtractMagic:
    def test_invalid_toml(self) -> None:
        svg = get_svg("invalid_toml_magic.svg")
        with pytest.raises(MagicTOMLDecodeError):
            extract_magic(svg)

    def test_not_enough_magic(self) -> None:
        svg = get_svg("too_little_magic.svg")
        with pytest.raises(NotEnoughMagicError):
            extract_magic(svg)

    def test_too_much_magic(self) -> None:
        svg = get_svg("too_much_magic.svg")
        with pytest.raises(TooMuchMagicError):
            extract_magic(svg)

    def test_extract_magic(self) -> None:
        svg = get_svg("example_magic.svg")
        magic = extract_magic(svg)

        assert set(magic) == {"foo", "qux"}

        assert len(magic["foo"]) == 2

        assert magic["foo"][0].parameters == "bar"
        assert magic["foo"][0].parents[-1].attrib["id"] == "layer1"

        assert magic["foo"][1].parameters == {"bar": "baz"}
        assert magic["foo"][1].parents[-1].attrib["id"] == "layer2"

        assert len(magic["qux"]) == 1
        assert magic["qux"][0].parameters == [{"quo": 123}]
        assert magic["qux"][0].parents[-1].attrib["id"] == "layer1"


class TestGetMagicRectangle:
    def test_no_rects(self) -> None:
        svg = get_svg("example_magic.svg")
        magic_text = extract_magic(svg)["foo"][0]
        with pytest.raises(SingleRectOrImageExpectedError):
            get_magic_rectangle(magic_text)

    def test_too_many_rects(self) -> None:
        svg = get_svg("magic_rectangle_too_many_rects.svg")
        (magic_text,) = extract_magic(svg)["video"]
        with pytest.raises(SingleRectOrImageExpectedError):
            get_magic_rectangle(magic_text)

    def test_wrong_element_type(self) -> None:
        svg = get_svg("magic_rectangle_not_rect.svg")
        (magic_text,) = extract_magic(svg)["video"]
        with pytest.raises(SingleRectOrImageExpectedError):
            get_magic_rectangle(magic_text)

    def test_valid(self) -> None:
        svg = get_svg("video_magic.svg")
        magic_text = extract_magic(svg)["video"][0]
        magic_rectangle = get_magic_rectangle(magic_text)
        assert magic_rectangle.rectangle in magic_rectangle.container
