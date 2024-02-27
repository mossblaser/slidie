import pytest

from svgs import get_svg

from slidie.svg_utils import annotate_build_steps
from slidie.magic import extract_magic
from slidie.video import VideoMagic, find_video_magic


class TestFindVideoMagic:
    def test_no_videos(self) -> None:
        assert find_video_magic({}) == []

    def test_valid(self) -> None:
        svg = get_svg("video_magic.svg")
        annotate_build_steps(svg)
        magic = extract_magic(svg)
        videos = find_video_magic(magic)

        # Check all videos are included exactly once
        by_url = {video.url: video for video in videos}
        assert len(by_url) == len(videos)

        # Check Defaults
        short_form = by_url.pop("shortform.mp4")
        assert short_form.start == 0
        assert short_form.loop is False
        assert short_form.mute is False
        assert short_form.steps is None

        minimal = by_url.pop("minimal.mp4")
        assert minimal.start == 0
        assert minimal.loop is False
        assert minimal.mute is False
        assert minimal.steps is None

        # Check ability to override
        full = by_url.pop("full.mp4")
        assert full.start == 123.4
        assert full.loop is True
        assert full.mute is True
        assert full.steps is None

        # Check image-containing video worked
        image = by_url.pop("image.mp4")
        assert image.steps is None

        # Check steps detected correctly
        next_steps = by_url.pop("next_steps.mp4")
        assert next_steps.steps == (2, 4)

        # Check we got everything
        assert len(by_url) == 0
