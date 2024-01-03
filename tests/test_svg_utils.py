import pytest

from svgs import get_svg

import json

from slidie.svg_utils import (
    SLIDIE_NAMESPACE,
    enumerate_inkscape_layers,
    iter_layers,
    get_inkscape_layer_name,
    annotate_build_steps,
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


def test_iter_layers() -> None:
    root = get_svg("layers.svg")
    layers = enumerate_inkscape_layers(root)

    assert list(map(get_inkscape_layer_name, iter_layers(layers))) == [
        "Top layer",
        "Middle layer",
        "Middle layer, top sublayer",
        "Middle layer, bottom sublayer",
        "Bottom layer",
    ]


class TestAnnotateBuildSteps:
    def test_no_layers(self) -> None:
        svg = get_svg("no_layers.svg")
        first, last = annotate_build_steps(svg)
        assert first == 0
        assert last == 0

    def test_no_builds(self) -> None:
        svg = get_svg("empty.svg")
        first, last = annotate_build_steps(svg)
        assert first == 0
        assert last == 0

    def test_annotations(self) -> None:
        svg = get_svg("simple_build.svg")
        assert annotate_build_steps(svg) == (0, 3)

        always, first, second, third = iter_layers(enumerate_inkscape_layers(svg))

        assert always.get(f"{{{SLIDIE_NAMESPACE}}}steps") is None
        assert json.loads(first.get(f"{{{SLIDIE_NAMESPACE}}}steps", "null")) == [
            1,
            2,
            3,
        ]
        assert json.loads(second.get(f"{{{SLIDIE_NAMESPACE}}}steps", "null")) == [2, 3]
        assert json.loads(third.get(f"{{{SLIDIE_NAMESPACE}}}steps", "null")) == [3]


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
