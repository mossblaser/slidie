"""
Browser-specific magic substitutions (e.g. iframes, Javascript etc.).
"""

from xml.etree import ElementTree as ET

import json
import mimetypes

from slidie.xml_namespaces import XHTML_NAMESPACE, SVG_NAMESPACE, SLIDIE_NAMESPACE
from slidie.magic import MagicText, MagicRectangle
from slidie.video import find_video_magic


def substitute_foreign_object(magic_rectangle: MagicRectangle) -> ET.Element:
    """
    Substitute an <image> or <rect> for a <foreignObject> of equivalent size
    and identity.
    """
    magic_rectangle.container.remove(magic_rectangle.rectangle)

    foreign_object = ET.SubElement(
        magic_rectangle.container, f"{{{SVG_NAMESPACE}}}foreignObject"
    )

    for attrib in ["id", "x", "y", "width", "height", "transform"]:
        if attrib in magic_rectangle.rectangle.attrib:
            foreign_object.attrib[attrib] = magic_rectangle.rectangle.attrib[attrib]

    return foreign_object


def embed_videos(magic: dict[str, list[MagicText]]) -> None:
    """
    Given any magic video specifications, inserts <video> elements within a
    <foreignObject> where the placeholder <rect> or <image> was.
    """
    for video in find_video_magic(magic):
        foreign_object = substitute_foreign_object(video.magic_rectangle)

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
