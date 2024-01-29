from xml.etree import ElementTree as ET

import json

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.svg_utils import find_text_with_prefix, get_visible_build_steps


def extract_speaker_notes(svg: ET.Element) -> list[tuple[tuple[int, ...] | None, str]]:
    """
    Find (and remove) the speaker notes within magic '###' <text> elements
    within an SVG. Returns a list [(steps, note), ...] where 'note' is a string
    containing the note text.

    When :py:func:`slidie.svg_utils.annotate_build_steps` has been used, the
    'steps' value contains the build step numbers to which a given note applies
    will be given in the 'steps'. This value is None for notes on layers
    without any build step specifications.

    The extracted speaker notes are returned in the order in which they
    appeared in the SVG.

    """
    notes = []

    # NB: Capture in list to allow safe mutation as we iterate
    for elems, text in list(find_text_with_prefix(svg, "###\n")):
        steps = get_visible_build_steps(elems)
        notes.append((steps, text))

        # Remove the <text> element from the document
        elems[-2].remove(elems[-1])

    return notes


def embed_speaker_notes(svg: ET.Element) -> None:
    """
    Find all speaker notes in magic '###' prefixed <text> elements (see
    :py:func:`extract_speaker_notes`) and add an XML structure as follows to
    the SVG::

        <slidie:notes>
            <slidie:note>...</slidie:note>
            <slidie:note steps="[1,2,3]">...</slidie:note>
            ...
        </slidie:notes>

    The extracted speaker notes are given in the order in which they appeared
    in the SVG.

    When :py:func:`slidie.svg_utils.annotate_build_steps` has been used, notes
    which appear on a layer with a build spec are also labelled with a 'steps'
    attribute containing a JSON list of step numbers.
    """
    notes_elem = ET.SubElement(svg, f"{{{SLIDIE_NAMESPACE}}}notes")
    for steps, text in extract_speaker_notes(svg):
        note_elem = ET.SubElement(notes_elem, f"{{{SLIDIE_NAMESPACE}}}note")
        note_elem.text = text
        if steps is not None:
            note_elem.attrib["steps"] = json.dumps(steps)
