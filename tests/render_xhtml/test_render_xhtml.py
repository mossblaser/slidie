import pytest

from svgs import get_svg_filename

from pathlib import Path
import shutil


from slidie.render_xhtml import render_xhtml


def test_render_xhtml(tmp_path: Path) -> None:
    src_dir = tmp_path / "src"
    src_dir.mkdir()

    shutil.copy(get_svg_filename("simple_text.svg"), src_dir / "010 - first.svg")
    shutil.copy(get_svg_filename("simple_build.svg"), src_dir / "020 - second.svg")

    # XXX: Basically just sanity check this doesn't crash -- can't really
    # verify what we get is a useful slideshow without running a browser and
    # poking it...
    render_xhtml(
        [
            src_dir / "010 - first.svg",
            src_dir / "020 - second.svg",
        ],
        tmp_path / "out.xhtml",
    )
