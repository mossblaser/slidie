"""
This module contains logic for rendering Slidie presentations into XHTML pages.

NB: XHTML, rather than HTML, is required since we depend on the true XML-ness
of SVG to drive the presentation within the browser (e.g. by adding annotations
to SVG elements in Slidie's own XML namespace). Don't be too worried: this is
just bog-standard HTML5, but lightly tweaked to become valid XML!
"""

from pathlib import Path

from xml.etree import ElementTree as ET

from uuid import uuid4

from slidie.xml_namespaces import XHTML_NAMESPACE
from slidie.inkscape import Inkscape
from slidie.text_to_selectable_paths import text_to_selectable_paths
from slidie.svg_utils import (
    annotate_build_steps,
    fill_inkscape_page_background,
    clip_to_inkscape_pages,
)
from slidie.file_numbering import extract_numerical_prefix


BASE_TEMPLATE_FILENAME = Path(__file__).parent / "base.xhtml"


def inline_css_and_js(root: ET.Element, path: Path) -> None:
    """
    Given an XHTML document, inline any external CSS and Javascript files
    referenced by <link> and <script> tags in-place.
    """
    # Substitute <link rel="stylesheet" href="..." /> for <style>...</style>
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}link"):
        if elem.attrib.get("rel") == "stylesheet":
            del elem.attrib["rel"]

            href = elem.attrib.pop("href")
            if href is None:
                raise ValueError("Template <link> missing 'http'")

            elem.tag = f"{{{XHTML_NAMESPACE}}}style"
            css_filename = path / Path(href)
            elem.text = css_filename.read_text()

    # Substitute <script src="..."> for <script>...</script>
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}script"):
        if "src" in elem.attrib:
            src = elem.attrib.pop("src")
            assert src is not None

            script_filename = path / Path(src)
            elem.text = script_filename.read_text()


def get_base_template() -> tuple[ET.Element, ET.Element]:
    """
    Get the basic template for a self-contained Slidie XHTML output.

    Returns two elements: the root element for the XHTML document and the element
    within that into which the SVGs for each slide should be inserted.
    """
    root = ET.parse(BASE_TEMPLATE_FILENAME).getroot()

    # For ease of editing, the template has its CSS and Javascript stored in
    # separate files with the base.xhtml file referencing them using <link> and
    # <script src="..."> tags. We substitute those for inline <style> and
    # <script> tags.
    inline_css_and_js(root, BASE_TEMPLATE_FILENAME.parent)

    # To split the (text-based) document at an arbitrary point, we insert a
    # unique string which we'll later split the file on.
    split_string = str(uuid4())

    (slides_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}*[@id='slides']")

    return (root, slides_elem)


def render_slide(
    svg: ET.Element,
    inkscape: Inkscape,
) -> ET.Element:
    """
    Render a single slide into a form ready for including in the XHTML file.

    The passed SVG may (or may not) be mutated arbitrarily as a side effect of
    this function. The returned value should be used in any case.
    """
    # Since there isn't a good way to do self-contained font embedding,
    # convert text to paths and include invisible selectable text for
    # screen readers and copy-paste purposes.
    svg = text_to_selectable_paths(svg, inkscape)

    # We probably want the background displayed in Inkscape since otherwise
    # you'll just get a transparent background onto the black background of the
    # presentation viewer.
    fill_inkscape_page_background(svg)

    # The Javascript presentation runner will use these annotations to step
    # through builds
    annotate_build_steps(svg)

    # We probably want to clip the SVG to just the viewbox (i.e. to behave like
    # an ordinary bounded image when scaled to fill the screen)
    clip_to_inkscape_pages(svg)

    return svg


def render_xhtml(source_directory: Path, output: Path) -> None:
    """
    Render a slidie show into a self-contained XHTML file.
    """
    xhtml_root, slide_container = get_base_template()

    slide_filenames = sorted(Path().glob("*.svg"), key=extract_numerical_prefix)

    with Inkscape() as inkscape:
        for filename in slide_filenames:
            svg = ET.parse(filename).getroot()
            svg = render_slide(svg, inkscape)
            slide_container.append(svg)

    with output.open("wb") as f:
        ET.ElementTree(xhtml_root).write(f, encoding="utf-8")
