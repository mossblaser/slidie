"""
This module contains logic for rendering Slidie presentations into XHTML pages.

NB: XHTML, rather than HTML, is required since we depend on the true XML-ness
of SVG to drive the presentation within the browser (e.g. by adding annotations
to SVG elements in Slidie's own XML namespace). Don't be too worried: this is
just bog-standard HTML5, but lightly tweaked to become valid XML!
"""

from pathlib import Path

from xml.etree import ElementTree as ET

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.inkscape import Inkscape
from slidie.text_to_selectable_paths import text_to_selectable_paths
from slidie.embed_thumbnails import embed_thumbnails
from slidie.svg_utils import (
    annotate_build_steps,
    fill_inkscape_page_background,
    clip_to_inkscape_pages,
)
from slidie.speaker_notes import embed_speaker_notes
from slidie.magic import MagicText, extract_magic
from slidie.links import annotate_slide_id_from_magic
from slidie.metadata import annotate_metadata
from slidie.render_xhtml.browser_magic import embed_videos, embed_iframes
from slidie.render_xhtml.template import render_template


BASE_TEMPLATE_FILENAME = Path(__file__).parent / "base.xhtml"


def render_slide(
    filename: Path,
    inkscape: Inkscape,
) -> ET.Element:
    """
    Render a single slide into a form ready for including in the XHTML file.

    The passed SVG may (or may not) be mutated arbitrarily as a side effect of
    this function. The returned value should be used in any case.
    """
    svg = ET.parse(filename).getroot()
    svg.attrib[f"{{{SLIDIE_NAMESPACE}}}source"] = str(filename)

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
    annotate_metadata(svg, magic)

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
    embed_iframes(magic)

    return svg


def render_xhtml(
    slide_filenames: list[Path], output: Path, debug: bool = False
) -> None:
    """
    Render a slidie show into a self-contained XHTML file.
    """
    slides = []
    with Inkscape() as inkscape:
        for filename in slide_filenames:
            try:
                slides.append(render_slide(filename, inkscape))
            except Exception as exc:
                exc.add_note(f"While processing {filename}")
                raise

    xhtml_root = render_template(BASE_TEMPLATE_FILENAME, slides, debug)

    with output.open("wb") as f:
        ET.ElementTree(xhtml_root).write(f, encoding="utf-8")
