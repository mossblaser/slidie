import pytest

from svgs import get_svg

from slidie.magic import (
    extract_magic,
    MagicTOMLDecodeError,
    NotEnoughMagicError,
    TooMuchMagicError,
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
