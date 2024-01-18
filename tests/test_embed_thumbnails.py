import pytest

from pathlib import Path
from base64 import b64decode

from PIL import Image
import numpy as np

from svgs import get_svg

from slidie.svg_utils import annotate_build_steps
from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.inkscape import Inkscape

from slidie.embed_thumbnails import (
    get_thumbnail_dimensions,
    embed_thumbnails,
)


@pytest.mark.parametrize(
    "svg, exp_width, exp_height",
    [
        ("square.svg", 1000, 1000),
        ("wide.svg", 1000, 500),
        ("tall.svg", 500, 1000),
    ],
)
def test_get_thumbnail_dimensions(svg: str, exp_width: int, exp_height: int) -> None:
    assert get_thumbnail_dimensions(get_svg(svg), 1000) == (exp_width, exp_height)


def test_embed_thumbnails(tmp_path: Path) -> None:
    svg = get_svg("build_rgb.svg")
    annotate_build_steps(svg)
    with Inkscape() as inkscape:
        embed_thumbnails(svg, inkscape, max_dimension=128)

    (thumbnails_elem,) = svg.findall(f".//{{{SLIDIE_NAMESPACE}}}thumbnails")
    assert len(thumbnails_elem) == 3
    for i, (thumbnail_elem, exp_rgba) in enumerate(
        zip(
            thumbnails_elem,
            [
                (255, 0, 0, 255),
                (0, 255, 0, 255),
                (0, 0, 255, 255),
            ],
        )
    ):
        # Verify metadata
        assert thumbnail_elem.tag == f"{{{SLIDIE_NAMESPACE}}}thumbnail"
        assert thumbnail_elem.attrib["step"] == str(i)
        assert thumbnail_elem.attrib["type"] == "image/png"
        assert thumbnail_elem.attrib["encoding"] == "base64"
        assert thumbnail_elem.text is not None

        # Extract image data
        filename = tmp_path / "file.png"
        filename.write_bytes(b64decode(thumbnail_elem.text))

        # Verify correct step visible
        im = np.array(Image.open(filename))
        assert im.shape == (128, 128, 4)
        assert np.all(im == exp_rgba)
