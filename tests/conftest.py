# NB: This file also exists to ensure the 'svgs' package (in this directory) is
# added to the python path by pytest for all tests.

import pytest

from typing import Iterator

from subprocess import run, DEVNULL
from pathlib import Path

from slidie.inkscape import Inkscape


@pytest.fixture(scope="module")
def inkscape() -> Iterator[Inkscape]:
    """A running Inkscape instance."""
    with Inkscape() as i:
        yield i


@pytest.fixture(scope="module")
def dummy_video(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A dummy 10 second video of 200x100 blue frames at 25 FPS."""
    filename = tmp_path_factory.mktemp("dummy_video") / "blue.mp4"
    run(
        [
            "ffmpeg",
            # Generate a simple test stream blue frames...
            "-f",
            "lavfi",
            "-i",
            "color=blue",
            # ...at 25 FPS...
            "-r",
            "25",
            # ...200x100 pixels in size...
            "-s",
            "200x100",
            # ...250 frames (10 seconds) long...
            "-frames:v",
            "250",
            # ...with the given name!
            str(filename),
        ],
        check=True,
        stdout=DEVNULL,
        stderr=DEVNULL,
    )
    return filename
