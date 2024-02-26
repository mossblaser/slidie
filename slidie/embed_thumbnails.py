"""
Provides the :py:func:`embed_thumbnails` function which renders a PNG thumbnail
of each build step of an SVG and embeds it (base64 encoded) within the SVG for
later use.
"""

from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
from base64 import b64encode

from slidie.inkscape import Inkscape, set_visible_step, open_etree_in_inkscape
from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.svg_utils import find_build_elements, get_build_step_range, get_view_box


def get_thumbnail_dimensions(svg: ET.Element, max_dimension: int) -> tuple[int, int]:
    """
    Return a thumbnail dimension (with a maximum length of max_dimension
    pixels) for an SVG document.
    """
    # Work out export dimensions for this file
    if view_box := get_view_box(svg):
        if view_box.width >= view_box.height:
            width = max_dimension
            height = round(width * (view_box.height / view_box.width))
        else:
            height = max_dimension
            width = round(height * (view_box.width / view_box.height))
    else:
        width = max_dimension
        height = max_dimension

    return width, height


def embed_thumbnails(
    svg: ET.Element, inkscape: Inkscape, max_dimension: int = 512
) -> None:
    """
    Given an SVG, generate thumbnails for all build steps (a maximum of
    max_dimension pixels square).

    It is assumed that build steps have already been annotated (e.g. using
    :py:func:`slidie.svg_utils.annotate_build_steps`).

    The thumbnails are embedded using the following XML structure added to the
    root of the SVG::

        <slidie:thumbnails>
            <slidie:thumbnail step="NNN" type="image/png" encoding="base64">...</slidie:thumbnail>
            ...
        </slidie:thumbnails>
    """
    width, height = get_thumbnail_dimensions(svg, max_dimension)

    with TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # Use Inkscape to render each build step
        build_elements = find_build_elements(svg)
        output_filenames = {}
        with open_etree_in_inkscape(inkscape, svg):
            for step in get_build_step_range(svg):
                set_visible_step(inkscape, build_elements, step)

                # Generate thumbnail
                output_filename = tmp_path / f"{step}.png"
                output_filenames[step] = output_filename
                inkscape.export(
                    output_filename,
                    width=width,
                    height=height,
                )

        # Embed generated thumbnails in the SVG
        thumbnails = ET.SubElement(svg, f"{{{SLIDIE_NAMESPACE}}}thumbnails")
        thumbnails.text = "\n"
        thumbnails.tail = "\n"
        for step, filename in output_filenames.items():
            thumbnail = ET.SubElement(thumbnails, f"{{{SLIDIE_NAMESPACE}}}thumbnail")
            thumbnail.attrib["step"] = str(step)
            thumbnail.attrib["type"] = "image/png"
            thumbnail.attrib["encoding"] = "base64"
            thumbnail.text = b64encode(filename.read_bytes()).decode("ascii")
            thumbnail.tail = "\n"
