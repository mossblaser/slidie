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

from slidie.svg_utils import find_text_with_prefix, get_visible_build_steps
from slidie.magic import MagicText, get_magic_rectangle, MagicRectangle


class VideoMagic(NamedTuple):
    """
    A 'magic' video definition found in a slide.
    """

    # The rectangle (and its container) which will be replaced with a video
    magic_rectangle: MagicRectangle

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
        magic_rectangle = get_magic_rectangle(magic_text)

        # Handle short-form
        if not isinstance(magic_text.parameters, dict):
            parameters = {"url": magic_text.parameters}
        else:
            parameters = magic_text.parameters

        out.append(
            VideoMagic(
                magic_rectangle=magic_rectangle,
                steps=get_visible_build_steps(magic_text.parents),
                url=parameters["url"],
                start=parameters.get("start", 0.0),
                loop=parameters.get("loop", False),
                mute=parameters.get("mute", False),
            )
        )

    return out
