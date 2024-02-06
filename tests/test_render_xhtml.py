import pytest

from svgs import get_svg_filename

from pathlib import Path
import shutil

from xml.etree import ElementTree as ET

from slidie.xml_namespaces import XHTML_NAMESPACE
from slidie.render_xhtml import (
    inline_css_and_js_and_templates,
    get_base_template,
    render_xhtml,
)


def test_inline_css_and_js(tmp_path: Path) -> None:
    style_filename = tmp_path / "style.css"
    script_filename = tmp_path / "script.js"

    template_dir = tmp_path / "template_dir"
    template_dir.mkdir()
    template_filename = template_dir / "template.xhtml"
    template_script_filename = template_dir / "template_script.js"

    # NB: Both of these contain reserved XML chars
    style_filename.write_text("body > h1 { color: red; }")
    script_filename.write_text("console.log('3 < 4', 3 < 4);")

    template_filename.write_text(
        """
            <div xmlns="http://www.w3.org/1999/xhtml">
                <h1 xmlns="http://www.w3.org/1999/xhtml">Hello</h1>
                <script src="template_script.js" />
            </div>
        """
    )
    template_script_filename.write_text("console.log('hi!');")

    xhtml = """
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
          <head>
            <meta charset="utf-8"/>
            <link rel="stylesheet" href="style.css"/>
          </head>
          <body>
            <h1>Hello!</h1>
            <script src="script.js" />
            <template src="template_dir/template.xhtml" id="my-template" />
          </body>
        </html>
    """

    root = ET.fromstring(xhtml)
    inline_css_and_js_and_templates(root, tmp_path)

    # <link> swapped for <style>
    assert root.findall(f".//{{{XHTML_NAMESPACE}}}link") == []
    (style_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}style")
    assert style_elem.attrib == {}
    assert style_elem.text == style_filename.read_text()

    # <script> inlined
    (script_elem,) = root.findall(
        f".//{{{XHTML_NAMESPACE}}}body/{{{XHTML_NAMESPACE}}}script"
    )
    assert script_elem.attrib == {}
    assert script_elem.text == script_filename.read_text()

    # <template> inlined
    (template_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}template")
    assert template_elem.attrib == {"id": "my-template"}
    assert template_elem[0].tag == f"{{{XHTML_NAMESPACE}}}div"
    assert template_elem[0][0].tag == f"{{{XHTML_NAMESPACE}}}h1"
    assert template_elem[0][0].text == "Hello"

    # Recursively expanded template
    assert template_elem[0][1].tag == f"{{{XHTML_NAMESPACE}}}script"
    assert template_elem[0][1].text == "console.log('hi!');"


def test_get_base_template() -> None:
    # XXX: Just check doesn't crash...
    #
    # Also indirectly checks the base template doesn't have any broken file
    # names in it!
    root, slides_elem = get_base_template()


def test_render_xhtml(tmp_path: Path) -> None:
    src_dir = tmp_path / "src"
    src_dir.mkdir()

    shutil.copy(get_svg_filename("simple_text.svg"), src_dir / "010 - first.svg")
    shutil.copy(get_svg_filename("simple_build.svg"), src_dir / "020 - second.svg")
    (src_dir / "015 - decoy.txt").write_text("I am a decoy! >.<")

    # XXX: Basically just sanity check this doesn't crash -- can't really
    # verify what we get is a useful slideshow without running a browser and
    # poking it...
    render_xhtml(src_dir, tmp_path / "out.xhtml")
