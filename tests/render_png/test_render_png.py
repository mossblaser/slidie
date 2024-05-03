import pytest

from svgs import get_svg_filename

from pathlib import Path
from itertools import islice

from PIL import Image

from slidie.render_png import (
    iter_output_filenames,
    render_png,
)


class TestIterOutputFilenames:
    def test_no_template(self) -> None:
        assert list(islice(iter_output_filenames(Path("foo/bar.png")), 3)) == [
            Path("foo/001_bar.png"),
            Path("foo/002_bar.png"),
            Path("foo/003_bar.png"),
        ]

    def test_no_template_with_curly_brackets(self) -> None:
        assert list(islice(iter_output_filenames(Path("foo/bar{{}}.png")), 3)) == [
            Path("foo/001_bar{}.png"),
            Path("foo/002_bar{}.png"),
            Path("foo/003_bar{}.png"),
        ]

    def test_with_template(self) -> None:
        assert list(islice(iter_output_filenames(Path("foo/bar{:02d}.png")), 3)) == [
            Path("foo/bar01.png"),
            Path("foo/bar02.png"),
            Path("foo/bar03.png"),
        ]


def test_render_png(tmp_path: Path) -> None:
    src = tmp_path / "src"
    out = tmp_path / "out"
    src.mkdir()
    out.mkdir()

    # Copy source files
    for i, filename in enumerate(["empty.svg", "build_rgb.svg"]):
        svg_bytes = get_svg_filename(filename).read_bytes()
        (src / f"{i}.svg").write_bytes(svg_bytes)

    dpmm = 1
    dpi = dpmm * 25.4
    background_opacity = 0.75

    # Render
    out_files = render_png(
        src,
        out / "out.png",
        dpi=dpi,
        background_opacity=background_opacity,
    )

    # Check only the expected files were created
    exp_files = [out / f"{page:03d}_out.png" for page in range(1, 5)]
    assert out_files == exp_files
    assert set(out.iterdir()) == set(exp_files)

    # Load images
    ims = [Image.open(filename) for filename in exp_files]

    # Verify each page is rendered the correct shape
    for im, (exp_width_mm, exp_height_mm) in zip(
        ims,
        [
            (210, 297),  # empty.svg
            (10, 10),  # build_rgb.svg
            (10, 10),  # "
            (10, 10),  # "
        ],
    ):
        width_px, height_px = im.size
        width_mm = width_px / dpmm
        height_mm = height_px / dpmm
        assert width_px == pytest.approx(exp_width_mm)
        assert height_px == pytest.approx(exp_height_mm)

    # Verify each page has the correct colour/opacity
    for im, (exp_r, exp_g, exp_b, exp_a) in zip(
        ims,
        [
            (255, 255, 255, round(background_opacity * 255)),  # empty.svg
            (255, 0, 0, 255),  # build_rgb.svg
            (0, 255, 0, 255),  # "
            (0, 0, 255, 255),  # "
        ],
    ):
        print(im.getpixel((1, 1)))
        r, g, b, a = im.getpixel((1, 1))
        assert r == exp_r
        assert g == exp_g
        assert b == exp_b
        assert a == exp_a
