import pytest

from typing import Any

from pathlib import Path
from xml.etree import ElementTree as ET

from svgs import get_svg_filename

from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.scripts.slidie_video_stills_cmd import main


def test_slidie_video_stills_cmd(
    dummy_video: Path, tmp_path: Path, capsys: Any
) -> None:
    video_mp4 = tmp_path / "test_video.mp4"
    video_mp4.write_bytes(dummy_video.read_bytes())

    slide_svg = tmp_path / "slide.svg"
    slide_svg.write_bytes(get_svg_filename("slidie_video_stills.svg").read_bytes())

    main([str(slide_svg)])

    out, err = capsys.readouterr()
    assert out == ""

    # Check the valid video didn't appear in any errors
    assert "test_video.mp4" not in err

    # Check the missing one did
    assert "missing_video.mp4" in err

    svg = ET.parse(slide_svg).getroot()

    # Valid video should be replaced with an image (with rect-specific attribs
    # absent)
    (test_video_elem,) = svg.findall(".//*[@id='test_video']")
    assert test_video_elem.tag == f"{{{SVG_NAMESPACE}}}image"
    assert set(test_video_elem.attrib) == {
        "href",
        "x",
        "y",
        "width",
        "height",
        "id",
        "style",
    }

    # Missing video should have been left as-is
    (missing_video_elem,) = svg.findall(".//*[@id='missing_video']")
    assert missing_video_elem.tag == f"{{{SVG_NAMESPACE}}}rect"
