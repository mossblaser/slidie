"""
Process video magic text within a slide.

To insert a video in a slide, a <rect> or <image> should be grouped with some
magic <text> with the following contents::

    @@@
    # Short-form
    video = "url/or/path/to/video.mp4"

    # Long-form
    [video]
    url = "url/or/path/to/video.mp4"
    start = 0.0   # Start time (optional)
    loop = false   # Loop playback (optional)
    mute = false   # Mute audio (optional)
"""

from typing import NamedTuple

from xml.etree import ElementTree as ET
import json

from slidie.xml_namespaces import SLIDIE_NAMESPACE, SVG_NAMESPACE
from slidie.svg_utils import find_text_with_prefix, get_visible_build_steps
from slidie.magic import MagicText, MagicError


class VideoMagic(NamedTuple):
    """
    A 'magic' video definition found in a slide.
    """

    # The SVG element which contains the video (usually a <g>)
    container: ET.Element

    # The placeholder SVG element (a <rect> or an <image>) which should be
    # replaced with the video
    placeholder: ET.Element

    # The step numbers during which the video is visible (or None if always
    # visible)
    steps: tuple[int, ...] | None

    # The Video URL or filename
    url: str

    # The video playback start time
    start: float

    # Should the video be played in a loop?
    loop: bool

    # Should the audio be muted?
    mute: bool


class VideoMagicError(MagicError):
    """Base class for errors involving invalid video specifications."""


class SingleRectOrImageExpectedError(VideoMagicError):
    """
    Thrown if a video magic text was placed into a container with more than
    just a <rect> or <image> element in it.
    """


def find_video_magic(magic: dict[str, list[MagicText]]) -> list[VideoMagic]:
    """
    Find (and sanity check) all video magic text definitions.

    Iff :py:func:`slidie.svg_utils.annotate_build_steps` has been used on the
    SVG, the build steps during which the video is visible will be included in
    the 'steps' attribute of each :py:class:`VideoMagic`.

    Also removes all corresponding entries from the provided magic dictionary.
    """
    out = []

    for magic_text in magic.pop("video", []):
        container = magic_text.parents[-1]

        # Check we have a single placeholder <image> or <rect>
        if len(container) != 1:
            raise SingleRectOrImageExpectedError(magic_text.parents, magic_text.text)
        placeholder = container[0]
        if placeholder.tag not in (
            f"{{{SVG_NAMESPACE}}}rect",
            f"{{{SVG_NAMESPACE}}}image",
        ):
            raise SingleRectOrImageExpectedError(magic_text.parents, magic_text.text)

        # Handle short-form
        if not isinstance(magic_text.parameters, dict):
            parameters = {"url": magic_text.parameters}
        else:
            parameters = magic_text.parameters

        out.append(
            VideoMagic(
                container=container,
                placeholder=placeholder,
                steps=get_visible_build_steps(magic_text.parents),
                url=parameters["url"],
                start=parameters.get("start", 0.0),
                loop=parameters.get("loop", False),
                mute=parameters.get("mute", False),
            )
        )

    return out