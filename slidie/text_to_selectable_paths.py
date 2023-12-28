"""
A utility which converts text within an SVG into paths (making them render
correctly regardless of whether the fonts are available) whilst still allowing
the text to be selected.
"""

from pathlib import Path
from tempfile import TemporaryDirectory
from copy import deepcopy
from xml.etree import ElementTree as ET
from itertools import chain

from slidie.svg_utils import SVG_NAMESPACE
from slidie.inkscape import Inkscape


def text_to_selectable_paths(input_svg: ET.Element, inkscape: Inkscape) -> ET.Element:
    """
    Converts all <text> elements in an SVG into <paths> with an invisible (but
    selectable) <text> element. This preserves correct appearance when fonts
    are not available whilst preserving selectability.

    Requires a running Inkscape instance to perform the text-to-path conversion.
    """
    with TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_file = tmp_path / "input.svg"
        output_file = tmp_path / "output.svg"

        # Use Inkscape to convert text to paths
        with input_file.open("wb") as f:
            ET.ElementTree(input_svg).write(f)

        inkscape.file_open(input_file)
        inkscape.export(output_file, text_to_path=True)

        output_svg = ET.parse(output_file).getroot()

    # Find text elements in the source
    input_text_elements = deepcopy(input_svg.findall(f".//{{{SVG_NAMESPACE}}}text"))

    assert all(
        elem.get("id", None) is not None for elem in input_text_elements
    ), "All <text> elements must have an id"

    # Insert a copy of the <text> element after each corresponding <path> in
    # the text-free output.
    for text_elem in input_text_elements:
        text_id = text_elem.get("id")

        # Rename to avoid ID collision
        text_elem.set("id", f"{text_id}-selectable")

        # Make text have transparent fill and no stroke.
        #
        # NB: If we made the opacity 0 the text would still be selectable
        # but the selection typically shows up as invisible too! Instead,
        # setting fill/stroke to transparent will make the text visible
        # when selected.
        #
        # NB: The fill/stroke may be set on both the <text> element and
        # <tspan> we need to override it on all of these.
        for elem in chain(
            [text_elem], text_elem.iterfind(f".//{{{SVG_NAMESPACE}}}tspan")
        ):
            style = elem.get("style", "").strip()
            if style and not style.endswith(";"):
                style += ";"
            style += "fill:transparent;stroke:none"
            elem.set("style", style)

        # Insert (now invisible) text element on top (i.e. after) the
        # substituted text
        parent = output_svg.find(f".//*[@id={text_id!r}]/..")
        assert parent is not None
        for index, child in enumerate(parent):
            if child.get("id", None) == text_id:
                break
        else:
            # Child with matching ID not found. Should be unreachable since
            # we're matching on elements with a child with the desired
            # ID...
            assert False
        parent.insert(index + 1, text_elem)

    return output_svg
