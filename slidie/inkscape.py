"""
A thin wrapper around Inkscape's `--shell` mode, along with a handful of
slidie-specific helper routines.
"""

from typing import TextIO, Self, Iterator
from types import TracebackType

import os
from subprocess import Popen, PIPE, STDOUT
from pathlib import Path
from xml.etree import ElementTree as ET
from contextlib import contextmanager
from tempfile import TemporaryDirectory


class InkscapeError(Exception):
    """
    Base class for errors thrown in response to issues reported by Inkscape.
    """


class FileOpenError(InkscapeError):
    """
    Thrown if there's a problem opening a file with Inkscape.
    """


class Inkscape:
    def __init__(self, inkscape_binary: str = "inkscape"):
        self._proc = Popen(
            [inkscape_binary, "--shell"],
            stdin=PIPE,
            stdout=PIPE,
            stderr=STDOUT,
            text=True,
            bufsize=0,
            env=dict(
                os.environ,
                # XXX: The following variables are to try and force consistent
                # behaviour of GNU Readline by disabling any locally customised
                # options and force it to assume a known terminal width. See
                # comment in _run_cmd for more details...
                COLUMNS="80",
                INPUTRC=os.devnull,
            ),
        )
        self._wait_for_prompt()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        self._proc.kill()
        self._proc.wait()

    def _wait_for_prompt(self) -> str:
        """
        Read from Inkscape's stdout until either a prompt is printed or the
        stream ends. Returns the read bytes.
        """
        assert self._proc.stdout  # For mypy's benefit...
        buf = ""
        while c := self._proc.stdout.read(1):
            buf += c
            if buf.endswith("\n> "):
                return buf
        return buf

    def _run_cmd(
        self,
        cmd: str,
        strip_warnings: bool = False,
        strip_gtk_warnings: bool = True,
    ) -> str:
        """
        Run a command and return any output it produces, up to but excluding
        the next prompt.

        If strip_warnings is true, all lines starting with "WARNING:" will be
        removed from the output.

        If strip_gtk_warnings is true, all lines containing "Gtk-WARNING" will
        be stripped from the output.
        """
        assert self._proc.stdin  # For mypy's benefit...

        # XXX: In certain builds of Inkscape since v1.1, GNU Readline is used
        # to handle input in --shell mode. Unfortunately, readline always
        # assumes it is connected to a TTY (and not a dumb pipe as in this
        # case). As well as echoing back all text sent to stdin (which we look
        # for and strip below) it also includes special-case behaviour when the
        # input exactly fits the width of a terminal.
        #
        # Specifically, pressing return at the end of a screen-width line of
        # text will result in the terminal's cursor ending up two lines below
        # the text, not one. To compensate, GNU Readline emits a series of
        # cursor movement escape sequences which move the cursor back to the
        # end of the line of text, followed by the last character in the line.
        # This way, the next character printed to the screen will end up
        # (correctly) on the line immediately below. All of this results in a
        # lot of junk ending up in stdout.
        #
        # This issue has Inkscape issue #9881.
        # https://gitlab.com/inkscape/inbox/-/issues/9881
        #
        # One potential solution we could look for this eventuality and handle
        # it by skipping past these characters. This solution, however, is
        # likely to be quite complex and brittle.
        #
        # The solution we use instead is to prevent the sending of any commands
        # which would end exactly at the edge of the screen. We do this by
        # adding a ';' to the command which Inkscape will then ignore.
        if (len("> ") + len(cmd)) % 80 == 0:
            cmd += ";"

        self._proc.stdin.write(f"{cmd}\n")
        self._proc.stdin.flush()

        out = self._wait_for_prompt()

        # Snip off the echo-back of the command
        out = out.partition("\n")[2]

        # Snip off the prompt (if present)
        if out == "> " or out.endswith("\n> "):
            out = out[:-3]
            if out.endswith("\r"):  # Windows...
                out = out[:-1]

        # XXX: Filter GTK warnings (ideally these could be suppressed another
        # way..)
        if strip_gtk_warnings:
            out = "\n".join(
                line for line in out.splitlines() if "Gtk-WARNING" not in line
            )

        # Filter out any Inkscape warnings
        if strip_warnings:
            out = "\n".join(
                line for line in out.splitlines() if not line.startswith("WARNING:")
            )

        return out

    def quit(self) -> None:
        self._run_cmd("quit")
        self._proc.wait()

    def file_open(self, filename: Path) -> None:
        # NB: Resolving to absolute path to avoid having to special-case
        # filenames which start with a space... (Filenames with newlines in?
        # You get what you deserve...)
        #
        # NB: We ignore Inkscape warnings as these are typically produced when
        # it encounters non-SVG (e.g. slidie) XML elements.
        if out := self._run_cmd(
            f"file-open: {str(filename.resolve())}", strip_warnings=True
        ):
            if out:
                raise FileOpenError(out)

    def file_close(self) -> None:
        if out := self._run_cmd(f"file-close"):
            raise InkscapeError(out)

    def export(
        self,
        filename: Path,
        text_to_path: bool = False,
        width: int | None = None,
        height: int | None = None,
        dpi: float | None = None,
        background_opacity: float | None = None,
    ) -> None:
        if text_to_path:
            if out := self._run_cmd("export-text-to-path"):
                InkscapeError(out)

        if width is not None:
            if out := self._run_cmd(f"export-width: {width}"):
                InkscapeError(out)
        if height is not None:
            if out := self._run_cmd(f"export-height: {height}"):
                InkscapeError(out)
        if dpi is not None:
            if out := self._run_cmd(f"export-dpi: {dpi}"):
                InkscapeError(out)
        if background_opacity is not None:
            if out := self._run_cmd(f"export-background-opacity: {background_opacity}"):
                InkscapeError(out)

        if out := self._run_cmd(f"export-area-page"):
            InkscapeError(out)

        # NB: Resolving to absolute path to avoid having to special-case
        # filenames which start with a space... (Filenames with newlines in?
        # You get what you deserve...)
        if out := self._run_cmd(f"export-filename: {filename.resolve()}"):
            InkscapeError(out)

        if out := self._run_cmd("export-do"):
            InkscapeError(out)

    def select_clear(self) -> None:
        if out := self._run_cmd(f"select-clear"):
            InkscapeError(out)

    def select_by_id(self, id: str) -> None:
        if out := self._run_cmd(f"select-by-id: {id}"):
            InkscapeError(out)

    def selection_hide(self) -> None:
        if out := self._run_cmd(f"selection-hide"):
            InkscapeError(out)

    def selection_unhide(self) -> None:
        if out := self._run_cmd(f"selection-unhide"):
            InkscapeError(out)


def set_visible_step(
    inkscape: Inkscape,
    build_elements: dict[ET.Element, list[int]],
    step: int,
) -> None:
    """
    Manipulate layer visibilities to make the state of the document match a
    particular step number.

    Takes a build_elements dictionary from
    :py:func:`svg_utils.find_build_elements` and a step number to show.
    """
    for elem, steps in build_elements.items():
        inkscape.select_clear()
        inkscape.select_by_id(elem.attrib["id"])
        if step in steps:
            inkscape.selection_unhide()
        else:
            inkscape.selection_hide()


@contextmanager
def open_etree_in_inkscape(inkscape: Inkscape, svg: ET.Element) -> Iterator[None]:
    """
    Context manager which opens an SVG residing in an SVG element by internally
    writing it to a temporary directory.
    """
    with TemporaryDirectory() as tmp_dir:
        input_file = Path(tmp_dir) / "input.svg"
        with input_file.open("wb") as f:
            ET.ElementTree(svg).write(f)

        inkscape.file_open(input_file)

        try:
            yield
        finally:
            inkscape.file_close()
