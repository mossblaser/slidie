import pytest

from svgs import get_svg

from slidie.svg_utils import (
    enumerate_inkscape_layers,
    get_inkscape_layer_name,
    get_inkscape_page_colour,
    ViewBox,
    get_view_box,
    get_inkscape_pages,
    fill_inkscape_page_background,
)


def test_enumerate_inkscape_layers() -> None:
    root = get_svg("layers.svg")
    layers = enumerate_inkscape_layers(root)

    assert len(layers) == 3

    assert get_inkscape_layer_name(layers[0].element) == "Top layer"
    assert get_inkscape_layer_name(layers[1].element) == "Middle layer"
    assert get_inkscape_layer_name(layers[2].element) == "Bottom layer"

    assert len(layers[0].children) == 0
    assert len(layers[1].children) == 2
    assert len(layers[2].children) == 0

    assert len(layers[1].children) == 2
    assert (
        get_inkscape_layer_name(layers[1].children[0].element)
        == "Middle layer, top sublayer"
    )
    assert (
        get_inkscape_layer_name(layers[1].children[1].element)
        == "Middle layer, bottom sublayer"
    )

    assert len(layers[1].children[0].children) == 0
    assert len(layers[1].children[1].children) == 0


@pytest.mark.parametrize(
    "test_file",
    [
        "red_page_colour.svg",
        "transparent_red_page_colour.svg",
    ],
)
def test_get_inkscape_page_colour(test_file: str) -> None:
    assert get_inkscape_page_colour(get_svg(test_file)) == "#ff0000"


class TestGetViewBox:

    def test_has_view_box(self) -> None:
        assert get_view_box(get_svg("view_box.svg")) == ViewBox(1, 2, 3, 4)
    
    def test_no_view_box(self) -> None:
        assert get_view_box(get_svg("no_view_box.svg")) is None


class TestGetInkscapePages:
    
    def test_pages(self) -> None:
        assert get_inkscape_pages(get_svg("multiple_pages.svg")) == [
            ViewBox(10, 20, 30, 40),
            ViewBox(50, 20, 50, 60),
        ]
    
    def test_old_inkscape_file(self) -> None:
        assert get_inkscape_pages(get_svg("old_inkscape_file.svg")) == []

