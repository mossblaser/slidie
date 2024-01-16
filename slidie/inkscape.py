"""
Thin wrapper around Inkscape's `--shell` mode.
"""

from typing import TextIO, Self
from types import TracebackType

import os
from subprocess import Popen, PIPE, STDOUT
from pathlib import Path


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

    def _run_cmd(self, cmd: str) -> str:
        """
        Run a command and return any output it produces, up to and including
        the next prompt.
        """
        assert self._proc.stdin  # For mypy's benefit...
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
        out = "".join(line for line in out.splitlines() if "Gtk-WARNING" not in line)

        return out

    def quit(self) -> None:
        self._run_cmd("quit")
        self._proc.wait()

    def file_open(self, filename: Path) -> None:
        # NB: Resolving to absolute path to avoid having to special-case
        # filenames which start with a space... (Filenames with newlines in?
        # You get what you deserve...)
        if out := self._run_cmd(f"file-open: {str(filename.resolve())}"):
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
