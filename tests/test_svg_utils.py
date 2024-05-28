import pytest

from svgs import get_svg

import json
from itertools import zip_longest

from slidie.xml_namespaces import SLIDIE_NAMESPACE, SVG_NAMESPACE

from slidie.svg_utils import (
    enumerate_inkscape_layers,
    iter_layers,
    get_inkscape_layer_name,
    enumerate_elem_parents,
    get_elem_inksape_layers,
    annotate_build_steps,
    find_build_elements,
    get_build_step_range,
    get_build_tags,
    get_visible_build_steps,
    get_inkscape_page_colour,
    ViewBox,
    get_view_box,
    get_inkscape_pages,
    extract_multiline_text,
    find_text_with_prefix,
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


def test_enumerate_elem_parents() -> None:
    root = get_svg("nested_element.svg")

    elem = root.find(f".//*[@id='elem']")
    assert elem is not None

    parents = enumerate_elem_parents(root, elem)
    assert parents[0] is root
    assert parents[-1] is elem

    for parent, child in zip(parents, parents[1:]):
        assert child in parent


def test_elem_inkscape_layers() -> None:
    root = get_svg("nested_element.svg")

    elem = root.find(f".//*[@id='elem']")
    assert elem is not None

    assert get_elem_inksape_layers(root, elem) == ("outer", "inner")


def test_annotate_build_steps() -> None:
    svg = get_svg("simple_build.svg")

    # Get references to these elements first to verify we're editing in place
    always, first, second, third = iter_layers(enumerate_inkscape_layers(svg))

    annotate_build_steps(svg)

    assert always.get(f"{{{SLIDIE_NAMESPACE}}}steps") is None
    assert json.loads(always.get(f"{{{SLIDIE_NAMESPACE}}}tags", "null")) == ["always"]

    assert json.loads(first.get(f"{{{SLIDIE_NAMESPACE}}}steps", "null")) == [
        1,
        2,
        3,
    ]
    assert json.loads(first.get(f"{{{SLIDIE_NAMESPACE}}}tags", "null")) == [
        "first",
        "foo",
    ]

    assert json.loads(second.get(f"{{{SLIDIE_NAMESPACE}}}steps", "null")) == [2, 3]
    assert second.get(f"{{{SLIDIE_NAMESPACE}}}tags") is None

    assert json.loads(third.get(f"{{{SLIDIE_NAMESPACE}}}steps", "null")) == [3]
    assert third.get(f"{{{SLIDIE_NAMESPACE}}}tags") is None


def test_find_build_elements() -> None:
    svg = get_svg("simple_build.svg")
    annotate_build_steps(svg)
    elems = find_build_elements(svg)
    elems_by_name = {
        get_inkscape_layer_name(elem): steps for elem, steps in elems.items()
    }

    assert elems_by_name == {
        "First <+-> @first @foo": [1, 2, 3],
        "Second <+->": [2, 3],
        "Third <+->": [3],
    }


@pytest.mark.parametrize(
    "filename, exp",
    [
        ("empty.svg", range(1)),
        ("no_layers.svg", range(1)),
        ("simple_build.svg", range(4)),
    ],
)
def test_get_build_step_range(filename: str, exp: range) -> None:
    svg = get_svg(filename)
    annotate_build_steps(svg)
    assert get_build_step_range(svg) == exp


@pytest.mark.parametrize(
    "filename, exp",
    [
        ("empty.svg", {}),
        ("no_layers.svg", {}),
        (
            "simple_build.svg",
            {
                "first": {1, 2, 3},
                "foo": {1, 2, 3},
            },
        ),
    ],
)
def test_get_build_tags(filename: str, exp: range) -> None:
    svg = get_svg(filename)
    annotate_build_steps(svg)
    assert get_build_tags(svg) == exp


def test_get_visible_build_steps() -> None:
    svg = get_svg("get_visible_build_steps.svg")
    annotate_build_steps(svg)
    for parents, text in find_text_with_prefix(svg, "assert steps == "):
        exp = json.loads(text)
        actual = get_visible_build_steps(parents)
        if exp is None:
            assert actual is None
        else:
            assert actual == tuple(exp)


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


@pytest.mark.parametrize(
    "svg, exp",
    [
        # Simple one-line cases
        ("oneline_text_inkscape_unbounded.svg", "one two three"),
        ("oneline_text_inkscape_bounded.svg", "one two three"),
        # Simple Inkscape multi-line cases
        ("multiline_text_inkscape_unbounded.svg", "zero\n one\n  two\n   three"),
        ("multiline_text_inkscape_bounded.svg", "zero\n one\n  two\n   three"),
        (
            "multiline_text_inkscape_unbounded_trailing_newline.svg",
            "zero\n one\n  two\n   three\n",
        ),
        (
            "multiline_text_inkscape_unbounded_trailing_newline.svg",
            "zero\n one\n  two\n   three\n",
        ),
        # Simple non-inkscape multi-line case
        ("multiline_text_plain.svg", "zero\n one\n  two\n   three"),
        (
            "multiline_text_plain_trailing_newline.svg",
            "zero\n one\n  two\n   three\n",
        ),
        # Multiline text with soft line breaks (which should be ignored)
        (
            "oneline_text_inkscape_bounded_wrapped.svg",
            "One two three four.\nFive six seven.",
        ),
        # Messy Inkscape one-line case with extra <tspans>
        ("oneline_text_formatted.svg", "one two three"),
        ("oneline_text_shifted.svg", "one two three"),
        ("oneline_text_supertext.svg", "one two three"),
        # XXX: Inkscape's Line-wrapping is indistinguishable from non-inkscape
        # multiline text when only a single logical line is present. As such
        # this case is actually handled wrong but there isn't much we can do!
        ("oneline_text_bounded_wrapped.svg", "one two \nthree"),
        # Test Inkscape's horizontal-only line wrapping feature
        ("inline_multiline_text_wrapped.svg", "zero one two three"),
        ("inline_multiline_text_trailing_whitespace.svg", "zero one  two   three    "),
        ("inline_multiline_text_line_breaks.svg", "zero\none\ntwo\nthree"),
        ("inline_multiline_text_trailing_newline.svg", "zero\none\ntwo\nthree\n"),
    ],
)
def test_extract_multiline_text(svg: str, exp: str) -> None:
    (text,) = get_svg(svg).findall(f".//{{{SVG_NAMESPACE}}}text")
    assert text is not None
    assert extract_multiline_text(text) == exp


def test_find_text_with_prefix() -> None:
    svg = get_svg("speaker_notes.svg")

    for (elems, text), exp in zip_longest(
        find_text_with_prefix(svg, "###\n"),
        [
            "Note on step 2 only",
            "Note on step 1 and 2",
            "Slide-wide speaker's note.\nThat was a newline.",
        ],
    ):
        # Check text extraction
        assert text == exp

        # Check element hierarchy
        assert elems[0] is svg
        for parent, child in zip(elems[:-1], elems[1:]):
            assert child in parent
        assert elems[-1].tag == f"{{{SVG_NAMESPACE}}}text"
