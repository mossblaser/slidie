"""
A utility which converts text within an SVG into paths (making them render
correctly regardless of whether the fonts are available) whilst still allowing
the text to be selected.
"""

from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
from itertools import chain

from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.inkscape import Inkscape, open_etree_in_inkscape


def text_to_selectable_paths(svg: ET.Element, inkscape: Inkscape) -> None:
    """
    Converts all <text> elements in an SVG into <paths> with an invisible (but
    selectable) <text> element. This preserves correct appearance when fonts
    are not available whilst preserving selectability.

    Requires a running Inkscape instance to perform the text-to-path conversion.

    Modifies svg in-place.
    """
    # Sanity check all <text> have IDs: we'll need these to cross-reference the
    # generated <path>s to the input <text>
    assert all(
        elem.get("id", None) is not None
        for elem in svg.findall(f".//{{{SVG_NAMESPACE}}}text")
    ), "All <text> elements must have an id"

    # Use Inkscape to produce <path> for all <text>
    with TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_file = tmp_path / "input.svg"
        output_file = tmp_path / "output.svg"

        # Use Inkscape to convert text to paths
        with open_etree_in_inkscape(inkscape, svg):
            inkscape.export(output_file, text_to_path=True)

        processed_svg = ET.parse(output_file).getroot()

    # Extract the <path> from the Inkscape output and insert into the input SVG
    def process(parent):
        for i, child in reversed(list(enumerate(parent))):
            if child.tag == f"{{{SVG_NAMESPACE}}}text":
                # Insert the replacement path
                #
                # NB: Strip aria-label since we'll be keeping the <text> element
                id = child.attrib["id"]
                replacement = processed_svg.find(f".//{{{SVG_NAMESPACE}}}*[@id={id!r}]")
                replacement.attrib.pop("aria-label", None)
                parent.insert(i, replacement)

                child.attrib["id"] = f"{id}-selectable"

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
                    [child], child.iterfind(f".//{{{SVG_NAMESPACE}}}tspan")
                ):
                    style = elem.get("style", "").strip()
                    if style and not style.endswith(";"):
                        style += ";"
                    style += "fill:transparent;stroke:none"
                    elem.set("style", style)
            else:
                process(child)

    process(svg)
