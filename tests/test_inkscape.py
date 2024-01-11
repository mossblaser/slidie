import pytest

from pathlib import Path
from xml.etree import ElementTree as ET

from svgs import get_svg_filename

from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.inkscape import Inkscape, InkscapeError, FileOpenError


class TestInkscape:
    def test_quit(self) -> None:
        with Inkscape() as i:
            i.quit()

    def test_file_open_invalid(self, inkscape: Inkscape, tmp_path: Path) -> None:
        with pytest.raises(FileOpenError) as exc_info:
            inkscape.file_open(tmp_path / "nope.svg")
        assert "nope.svg" in str(exc_info.value)

    def test_file_open_valid(self, inkscape: Inkscape) -> None:
        # Shouldn't crash...
        inkscape.file_open(get_svg_filename("empty.svg"))

    def test_file_close(self, inkscape: Inkscape) -> None:
        inkscape.file_open(get_svg_filename("empty.svg"))
        inkscape.file_close()
        with pytest.raises(InkscapeError):
            inkscape.file_close()

    def test_file_export_svg(self, inkscape: Inkscape, tmp_path: Path) -> None:
        inkscape.file_open(get_svg_filename("simple_text.svg"))
        inkscape.export(tmp_path / "out.svg")

        exported = ET.parse(tmp_path / "out.svg").getroot()

        # Sanity check: exported file is SVG with the same text as the input
        (text_elem,) = exported.findall(f".//{{{SVG_NAMESPACE}}}text")
        text = "".join(text_elem.itertext())
        assert text == "Hello"

    def test_file_export_text_to_path(self, inkscape: Inkscape, tmp_path: Path) -> None:
        inkscape.file_open(get_svg_filename("simple_text.svg"))
        inkscape.export(tmp_path / "out.svg", text_to_path=True)

        exported = ET.parse(tmp_path / "out.svg").getroot()

        # No text in the exported file
        assert exported.findall(f".//{{{SVG_NAMESPACE}}}text") == []
