"""
Wrappers around specific ffmpeg functionality.
"""

import os
from pathlib import Path
from subprocess import run, PIPE, STDOUT


class FrameExtractionError(Exception):
    """
    Thrown if extract_video_frame fails for some reason.
    """


def extract_video_frame(
    video: Path | str,
    out: Path,
    time: float = 10.0,
    cwd: Path | None = None,
) -> None:
    """
    Extract a frame of video from a file at the approximate point in time
    given.

    Note the video argument may be anything which ffmpeg accepts which includes
    both local files and web URLs.

    The 'cwd' argument gives the working directory to run ffmpeg in. This may
    be useful if you need to open a file given using a relative path.
    """
    # Remove existing output file (allows us to easily detect failures due to
    # the 'time' supplied being beyond the end of the video.
    if out.is_file():
        out.unlink()

    # Attempt to grab a frame from the specified moment in time, trying 0.0 if
    # that fails.
    for actual_time in sorted({time, 0.0}, reverse=True):
        result = run(
            [
                "ffmpeg",
                # Seek (approximately) to a given point in the video. By
                # specifiying this before the -i argument we indicate that we don't
                # mind selecting a conveninent nearby keyframe.
                "-ss",
                str(actual_time),
                # Specify input file
                "-i",
                str(video),
                # Grab a single frame
                "-frames:v",
                "1",
                # Tell the output 'image2' module we're providing a fixed output
                # filename (and not a pattern)
                "-update",
                "1",
                # Overwrite any existing files
                "-y",
                # Specify output filename
                str(out),
            ],
            cwd=cwd,
            stdout=PIPE,
            stderr=STDOUT,
            text=True,
        )
        if result.returncode == 0 and out.is_file():
            # Success!
            break

    if result.returncode != 0 or not out.is_file():
        raise FrameExtractionError(result.stdout)
