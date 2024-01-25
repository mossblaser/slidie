from svgs import get_svg

from itertools import zip_longest

from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.magic_text import find_magic_text


def test_find_text_with_prefix() -> None:
    svg = get_svg("speaker_notes.svg")

    for (elems, text), exp in zip_longest(
        find_magic_text(svg, "###\n"),
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
