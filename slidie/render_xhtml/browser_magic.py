"""
Browser-specific magic substitutions (e.g. iframes, Javascript etc.).
"""

from typing import NamedTuple, Any

from xml.etree import ElementTree as ET

import json
import mimetypes
from urllib.parse import urlparse, parse_qsl, urlencode

from slidie.xml_namespaces import XHTML_NAMESPACE, SVG_NAMESPACE, SLIDIE_NAMESPACE
from slidie.magic import MagicText, MagicRectangle, get_magic_rectangle
from slidie.video import find_video_magic


def substitute_foreign_object(
    magic_rectangle: MagicRectangle,
    scale: float | None = 1.0,
) -> ET.Element:
    """
    Substitute an <image> or <rect> for a <foreignObject> of equivalent size
    and identity.

    The scale argument indicates the scale at which the foreign object should
    be scaled relative to its native size. If set to None, no scaling will be
    performed and it will be shown at whatever size the <foreignObject> element
    happens to be in its own local coordinate system.
    """
    magic_rectangle.container.remove(magic_rectangle.rectangle)

    foreign_object = ET.SubElement(
        magic_rectangle.container, f"{{{SVG_NAMESPACE}}}foreignObject"
    )
    if scale is not None:
        foreign_object.attrib[f"{{{SLIDIE_NAMESPACE}}}scale"] = json.dumps(scale)

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


class IFrameMagicParameters(NamedTuple):
    url: str
    scale: float
    name: str | None


def normalise_iframe_magic_parameters(
    parameters: str | dict[str, Any]
) -> IFrameMagicParameters:
    """
    Given an iframe magic text definition, return the information contained
    within it in normalised form.
    """
    if isinstance(parameters, str):
        parameters = {"url": parameters}

    url = parameters.get("url", "about:blank")

    # Normalise query parameter into [{"name": ..., "value": ...}, ...]
    query: list[dict[str, str]] | dict[str, str | list[str]] = parameters.get(
        "query", []
    )
    if isinstance(query, dict):
        query = [
            {"name": name, "value": value}
            for name, values in query.items()
            for value in (values if isinstance(values, list) else [values])
        ]

    # Add extra query strings to URL.
    #
    # NB: We only do this step if some extra query values are given since it
    # involves parsing and reconstituting the URL which may be a lossy process
    # if the URL is not valid. (Better to pass an invalid URL to the browser
    # (when possible) than to corrupt it silently here!)
    if query:
        url_parts = urlparse(url)
        url_parts = url_parts._replace(
            query=urlencode(
                parse_qsl(url_parts.query, keep_blank_values=True)
                + [(nv["name"], nv["value"]) for nv in query]
            )
        )
        url = url_parts.geturl()

    scale = parameters.get("scale", 1.0)
    name = parameters.get("name")

    return IFrameMagicParameters(url=url, scale=scale, name=name)


def embed_iframes(magic: dict[str, list[MagicText]]) -> None:
    """
    Embed an <iframe> when an 'iframe' magic is used.

    The 'iframe' magic may either be a string (a URL to show) or a table
    containing the following entries:

    * url: The URL to display. Defaults to ``about:blank``.
    * query: Additional URL query parameters to append to the URL (after URL
      encoding). This is intended to make it easier to build and control custom
      widgets which reside in iframes. This value can either be a table or a
      list of {name: ..., value: ...} tables.  When a table of values, values
      must be either a string or a list of strings. A list of strings results
      in the provided argument being repeated.
    * scale: The scale factor to use for the displayed contents. Defaults to 1.
      Set to 0 to disable scaling correction. This will result in the iframe
      being rendered at a resolution determined by the local coordinate system
      the iframe ends up in within the SVG.
    * name: The name attribute for the resultant <iframe>. This makes the
      iframe 'targetable' by links on the slide.
    """
    for magic_text in magic.pop("iframe", []):
        parameters = normalise_iframe_magic_parameters(magic_text.parameters)

        magic_rectangle = get_magic_rectangle(magic_text)
        foreign_object = substitute_foreign_object(
            magic_rectangle, parameters.scale or None
        )

        iframe_elem = ET.SubElement(foreign_object, f"{{{XHTML_NAMESPACE}}}iframe")
        iframe_elem.attrib["style"] = "border: none; width: 100%; height: 100%;"
        iframe_elem.attrib["src"] = parameters.url
        if parameters.name is not None:
            iframe_elem.attrib["name"] = parameters.name
