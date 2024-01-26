import pytest

from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image
import numpy as np

from svgs import get_svg_filename

from slidie.xml_namespaces import SVG_NAMESPACE, SLIDIE_NAMESPACE
from slidie.inkscape import Inkscape, InkscapeError, FileOpenError


class TestInkscape:
    def test_quit(self) -> None:
        with Inkscape() as i:
            i.quit()

    def test_terminal_width_command(self, inkscape: Inkscape, tmp_path: Path) -> None:
        # Test that we correctly work-around commands which lead to the prompt
        # + command being a multiple of 80 characters long.
        #
        cmd = "file-new"
        padding = 80 - len("> ") - len(cmd)
        cmd += padding * ";"

        assert inkscape._run_cmd(cmd) == ""

    def test_file_open_invalid(self, inkscape: Inkscape, tmp_path: Path) -> None:
        with pytest.raises(FileOpenError) as exc_info:
            inkscape.file_open(tmp_path / "nope.svg")
        assert "nope.svg" in str(exc_info.value)

    def test_file_open_valid(self, inkscape: Inkscape) -> None:
        # Shouldn't crash...
        inkscape.file_open(get_svg_filename("empty.svg"))

    def test_file_open_with_non_svg_tags(
        self, inkscape: Inkscape, tmp_path: Path
    ) -> None:
        # Shouldn't crash...
        inkscape.file_open(get_svg_filename("non_svg_tags.svg"))

        inkscape.export(tmp_path / "out.svg")
        exported = ET.parse(tmp_path / "out.svg").getroot()

        # Sanity check: Non-SVG elements should still be present
        (elem,) = exported.findall(f".//{{{SLIDIE_NAMESPACE}}}foo")
        assert elem.text == "Bar"

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

    def test_file_export_size(self, inkscape: Inkscape, tmp_path: Path) -> None:
        inkscape.file_open(get_svg_filename("simple_text.svg"))
        inkscape.export(tmp_path / "out.svg", text_to_path=True)

        exported = ET.parse(tmp_path / "out.svg").getroot()

        # No text in the exported file
        assert exported.findall(f".//{{{SVG_NAMESPACE}}}text") == []

    def test_file_export_text_to_path(self, inkscape: Inkscape, tmp_path: Path) -> None:
        inkscape.file_open(get_svg_filename("simple_text.svg"))
        inkscape.export(tmp_path / "out.svg", text_to_path=True)

        exported = ET.parse(tmp_path / "out.svg").getroot()

        # No text in the exported file
        assert exported.findall(f".//{{{SVG_NAMESPACE}}}text") == []

    def test_export_png(self, inkscape: Inkscape, tmp_path: Path) -> None:
        inkscape.file_open(get_svg_filename("wide.svg"))

        # Render at double resolution
        inkscape.export(
            tmp_path / "wide.png",
            width=200,
            height=100,
        )

        im = np.array(Image.open(tmp_path / "wide.png"))

        # Check shape
        assert im.shape == (100, 200, 4)  # NB: width/height swapped!

        # Check content matches page
        # Central area is green
        assert np.all(im[2:-2, 2:-2, :4] == (0, 255, 0, 255))
        # Edges are blue
        im[2:-2, 2:-2, :4] = (0, 0, 255, 255)
        assert np.all(im == (0, 0, 255, 255))

    def test_select_by_id_clear_hide_and_unhide(
        self, inkscape: Inkscape, tmp_path: Path
    ) -> None:
        inkscape.file_open(get_svg_filename("layers_with_ids.svg"))
        exported_file = tmp_path / "out.png"

        # Initially should be red
        inkscape.export(exported_file)
        assert Image.open(exported_file).getpixel((0, 0)) == (255, 0, 0, 255)

        # Hide the red layer
        inkscape.select_by_id("red")
        inkscape.selection_hide()

        # Should now be white
        inkscape.export(exported_file)
        assert Image.open(exported_file).getpixel((0, 0)) == (255, 255, 255, 255)

        # Show the (initially hidden) black layer
        inkscape.select_clear()
        inkscape.select_by_id("black")
        inkscape.selection_unhide()

        # Should now be black
        inkscape.export(exported_file)
        assert Image.open(exported_file).getpixel((0, 0)) == (0, 0, 0, 255)
