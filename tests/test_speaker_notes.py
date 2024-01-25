from svgs import get_svg

from itertools import zip_longest
import json

from slidie.xml_namespaces import SVG_NAMESPACE, SLIDIE_NAMESPACE
from slidie.svg_utils import annotate_build_steps
from slidie.speaker_notes import (
    extract_speaker_notes,
    embed_speaker_notes,
)


def test_extract_speaker_notes() -> None:
    svg = get_svg("speaker_notes.svg")
    annotate_build_steps(svg)
    notes = extract_speaker_notes(svg)

    assert notes == [
        ((2,), "Note on step 2 only"),
        ((1, 2), "Note on step 1 and 2"),
        (None, "Slide-wide speaker's note.\nThat was a newline."),
    ]

    # Verify no notes remain in tree
    for elem in svg.findall(f".//{{{SVG_NAMESPACE}}}text"):
        text = "".join(elem.itertext())
        assert not text.startswith("###")


def test_embed_speaker_notes() -> None:
    svg = get_svg("speaker_notes.svg")
    annotate_build_steps(svg)
    embed_speaker_notes(svg)

    (notes_elem,) = svg.findall(f".//{{{SLIDIE_NAMESPACE}}}notes")

    for note_elem, (exp_steps, exp_text) in zip_longest(
        notes_elem,
        [
            ((2,), "Note on step 2 only"),
            ((1, 2), "Note on step 1 and 2"),
            (None, "Slide-wide speaker's note.\nThat was a newline."),
        ],
    ):
        assert note_elem.text == exp_text
        if exp_steps is None:
            assert "steps" not in note_elem.attrib
        else:
            assert tuple(json.loads(note_elem.attrib["steps"])) == exp_steps
