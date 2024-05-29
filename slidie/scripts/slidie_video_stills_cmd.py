"""
A simple tool for substituting <rect>s (or out-of-date <image>s) for stills
from video magic text entries within an SVG.
"""

import os
import sys
from pathlib import Path
from argparse import ArgumentParser
from xml.etree import ElementTree as ET
from copy import deepcopy
from tempfile import TemporaryDirectory
from base64 import b64encode

from slidie.magic import extract_magic
from slidie.video import find_video_magic
from slidie.ffmpeg import extract_video_frame
from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.scripts.placeholders import placeholder_to_image
from slidie.scripts.exception_formatting import slidie_exception_formatting


def video_to_data_url(url: str, time: float, cwd: Path | None) -> str:
    """
    Given a video filename or URL, return a data URL containing a still from a
    frame at the approximate time given.
    """
    with TemporaryDirectory() as tmp_dir:
        tmp_png = Path(tmp_dir) / "frame.png"
        extract_video_frame(url, tmp_png, time, cwd=cwd)
        base64 = b64encode(tmp_png.read_bytes()).decode("ascii")
        return f"data:image/png;base64,{base64}"


def main(test_args: list[str] | None = None):
    parser = ArgumentParser(
        description="""
            Insert/update video stills into video magic text areas within an
            SVG (or several SVGs).
        """
    )
    parser.add_argument(
        "svg",
        nargs="*",
        default=[str(p) for p in Path().glob("*.svg")],
        help="""
            The SVG to process (modifies the SVG in-place). Use '-' for stdin.
            Defaults to all SVGs in current directory.
        """,
    )
    args = parser.parse_args(test_args)

    with slidie_exception_formatting():
        for filename in args.svg:
            try:
                if filename == "-":
                    source_directory = None
                else:
                    source_directory = Path(filename).parent

                with open(filename, "rb") if filename != "-" else sys.stdin.buffer as f:
                    svg = ET.parse(f).getroot()

                # NB: We work on a copy because extract_magic is a mutating
                # operation (and find_video_magic depends on that mutation)
                videos = find_video_magic(extract_magic(deepcopy(svg)))

                for video in videos:
                    # Load still from video (just skipping this video if it fails)
                    try:
                        data_url = video_to_data_url(
                            video.url, video.start or 10.0, cwd=source_directory
                        )
                    except Exception as exc:
                        rule = "-" * 80
                        print(
                            f"Failed to load {video.url}, see ffmpeg output:\n{rule}\n{exc}\n{rule}",
                            file=sys.stderr,
                        )
                        continue

                    # Replace placeholder with image
                    placeholder_id = video.magic_rectangle.rectangle.attrib["id"]
                    placeholder_to_image(svg, placeholder_id, data_url)

                with open(
                    filename, "wb"
                ) if filename != "-" else sys.stdout.buffer as f:
                    ET.ElementTree(svg).write(f, encoding="utf-8")
            except Exception as exc:
                exc.add_note(f"While processing {filename}")
                raise


if __name__ == "__main__":
    main()
