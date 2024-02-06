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
import mimetypes
import json

from slidie.xml_namespaces import XHTML_NAMESPACE, SVG_NAMESPACE, SLIDIE_NAMESPACE
from slidie.inkscape import Inkscape
from slidie.text_to_selectable_paths import text_to_selectable_paths
from slidie.embed_thumbnails import embed_thumbnails
from slidie.svg_utils import (
    annotate_build_steps,
    fill_inkscape_page_background,
    clip_to_inkscape_pages,
)
from slidie.file_numbering import extract_numerical_prefix
from slidie.speaker_notes import embed_speaker_notes
from slidie.magic import MagicText, extract_magic
from slidie.video import find_video_magic
from slidie.links import annotate_slide_id_from_magic
from slidie.metadata import annotate_metadata_from_magic


BASE_TEMPLATE_FILENAME = Path(__file__).parent / "base.xhtml"


def inline_css_and_js_and_templates(root: ET.Element, path: Path) -> None:
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

    # Substitute <template src="..."> for <template>...</template>
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}template"):
        if "src" in elem.attrib:
            src = elem.attrib.pop("src")
            assert src is not None

            template_path = path / Path(src)
            template = ET.parse(template_path).getroot()
            inline_css_and_js_and_templates(template, template_path.parent)  # Recurse!
            elem.append(template)


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
    inline_css_and_js_and_templates(root, BASE_TEMPLATE_FILENAME.parent)

    # To split the (text-based) document at an arbitrary point, we insert a
    # unique string which we'll later split the file on.
    split_string = str(uuid4())

    (slides_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}*[@id='slides']")

    return (root, slides_elem)


def embed_videos(magic: dict[str, list[MagicText]]) -> None:
    """
    Given any magic video specifications, inserts <video> elements within a
    <foreignObject> where the placeholder <rect> or <image> was.
    """
    for video in find_video_magic(magic):
        video.container.remove(video.placeholder)

        # Swap the placeholder for a <foreignObject> of equivalent size and
        # identity
        foreign_object = ET.SubElement(
            video.container, f"{{{SVG_NAMESPACE}}}foreignObject"
        )
        for attrib in ["id", "x", "y", "width", "height", "transform"]:
            if attrib in video.placeholder.attrib:
                foreign_object.attrib[attrib] = video.placeholder.attrib[attrib]

        # Setup <video> element
        video_elem = ET.SubElement(foreign_object, f"{{{XHTML_NAMESPACE}}}video")
        if video.loop:
            video_elem.attrib["loop"] = "true"
        if video.mute:
            video_elem.attrib["muted"] = "true"
        video_elem.attrib["preload"] = "auto"
        video_elem.attrib["style"] = "display: block; width: 100%; height: 100%"
        video_elem.attrib[f"{{{SLIDIE_NAMESPACE}}}steps"] = json.dumps(video.steps)
        video_elem.attrib[f"{{{SLIDIE_NAMESPACE}}}start"] = str(video.start)
        video_elem.attrib[f"{{{SLIDIE_NAMESPACE}}}magic"] = "ta-da!"

        source_elem = ET.SubElement(video_elem, f"{{{XHTML_NAMESPACE}}}source")
        source_elem.attrib["src"] = video.url
        if mimetype := mimetypes.guess_type(video.url)[0]:
            source_elem.attrib["type"] = mimetype


def render_slide(
    svg: ET.Element,
    inkscape: Inkscape,
) -> ET.Element:
    """
    Render a single slide into a form ready for including in the XHTML file.

    The passed SVG may (or may not) be mutated arbitrarily as a side effect of
    this function. The returned value should be used in any case.
    """

    # The Javascript presentation runner will use these annotations to step
    # through builds
    #
    # NB: These annotations are required for many of the steps which follow and
    # so must be performed early on
    annotate_build_steps(svg)

    # Extract speaker notes into a <slidie:notes> element
    #
    # NB: Must come before text_to_selectable_paths and embed_thumbnails since
    # this will remove the magic <text> elements and we don't want them
    # appearing later.
    embed_speaker_notes(svg)

    # Extract magic text
    #
    # NB: Must also be done before text_to_selectable_paths and
    # embed_thumbnails
    magic = extract_magic(svg)

    annotate_slide_id_from_magic(magic)
    annotate_metadata_from_magic(magic)

    # We (probably) want the background displayed in Inkscape to back the SVG
    # since otherwise you'll just get a transparent background onto the black
    # background of the presentation viewer.
    fill_inkscape_page_background(svg)

    # Since there isn't a good way to do self-contained font embedding,
    # convert text to paths and include invisible selectable text for
    # screen readers and copy-paste purposes.
    text_to_selectable_paths(svg, inkscape)

    # Embed thumbnail renders of each build step (for use in slide listing)
    #
    # NB: Called *before* clip_to_inkscape_pages because that will add a
    # <style> tag which Inkscape will warn about but which has no effect on
    # what we're about to do.
    embed_thumbnails(svg, inkscape)

    # Clip the SVG to just the viewbox (i.e. to behave like an ordinary bounded
    # image when scaled to fill the screen)
    clip_to_inkscape_pages(svg)

    embed_videos(magic)

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
            svg.attrib[f"{{{SLIDIE_NAMESPACE}}}source"] = str(filename)
            svg = render_slide(svg, inkscape)
            slide_container.append(svg)

    with output.open("wb") as f:
        ET.ElementTree(xhtml_root).write(f, encoding="utf-8")
