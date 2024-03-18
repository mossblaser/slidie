import pytest

from pathlib import Path
from xml.etree import ElementTree as ET

from slidie.xml_namespaces import XHTML_NAMESPACE
from slidie.render_xhtml.template import (
    inline_css,
    inline_sourcemap,
    inline_js,
    inline_templates,
    replace_css_paths_with_absolute_file_path,
    replace_js_paths_with_absolute_file_path,
    get_template,
)


def test_inline_css(tmp_path: Path) -> None:
    style_filename = tmp_path / "style.css"
    xhtml_filename = tmp_path / "template.xhtml"

    style_filename.write_text("body { color: red; }")
    xhtml_filename.write_text(
        """
          <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <head>
              <meta charset="utf-8"/>
              <link rel="stylesheet" href="style.css"/>
            </head>
            <body/>
          </html>
        """
    )

    root = ET.parse(xhtml_filename).getroot()
    inline_css(root, tmp_path)

    assert root.findall(f".//{{{XHTML_NAMESPACE}}}link") == []
    (style_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}style")
    assert style_elem.text == style_filename.read_text()


def test_inline_sourcemap(tmp_path: Path) -> None:
    script_filename = tmp_path / "script.js"
    sourcemap_filename = tmp_path / "script.js.map"

    script_filename.write_text("console.log(123)\n//# sourceMappingURL=script.js.map")
    sourcemap_filename.write_text("PLACEHOLDER")

    script = inline_sourcemap(script_filename)

    lines = script.splitlines()
    assert len(lines) == 3
    assert lines[0] == "console.log(123)"
    assert lines[1].startswith("//# sourceMappingURL=data:")
    assert lines[2] == "//# sourceURL=script.js"


def test_inline_js(tmp_path: Path) -> None:
    script_filename = tmp_path / "script.js"
    xhtml_filename = tmp_path / "template.xhtml"

    script_filename.write_text("console.log(123)")
    xhtml_filename.write_text(
        """
          <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <head>
              <meta charset="utf-8"/>
            </head>
            <body>
              <script src="script.js"/>
            </body>
          </html>
        """
    )

    root = ET.parse(xhtml_filename).getroot()
    inline_js(root, tmp_path)

    (script_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}script")
    assert (
        script_elem.text == script_filename.read_text() + "\n//# sourceURL=script.js\n"
    )


def test_inline_template(tmp_path: Path) -> None:
    nested_dir = tmp_path / "nested"
    nested_script_filename = nested_dir / "script.js"
    nested_style_filename = nested_dir / "style.css"
    template_filename = nested_dir / "template.xhtml"
    xhtml_filename = tmp_path / "template.xhtml"

    nested_dir.mkdir()
    nested_script_filename.write_text("console.log(123)")
    nested_style_filename.write_text("body { color: red }")
    template_filename.write_text(
        """
          <div xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <script src="script.js"/>
            <link rel="stylesheet" href="style.css"/>
            <h1>Hello!</h1>
          </div>
        """
    )

    xhtml_filename.write_text(
        """
          <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <head>
              <meta charset="utf-8"/>
            </head>
            <body>
              <template src="nested/template.xhtml"/>
            </body>
          </html>
        """
    )

    root = ET.parse(xhtml_filename).getroot()
    inline_templates(root, tmp_path, debug=False)

    (h1_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}h1")
    assert h1_elem.text == "Hello!"

    # Also check we recursively expanded the style/script inside the template
    (style_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}style")
    assert style_elem.text == nested_style_filename.read_text()
    (script_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}script")
    assert script_elem.text.startswith(nested_script_filename.read_text())


def test_replace_css_paths_with_absolute_file_path(tmp_path: Path) -> None:
    style_filename = tmp_path / "style.css"
    xhtml_filename = tmp_path / "template.xhtml"

    style_filename.write_text("body { color: red }")
    xhtml_filename.write_text(
        """
          <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <head>
              <meta charset="utf-8"/>
              <link rel="stylesheet" href="style.css"/>
            </head>
            <body />
          </html>
        """
    )

    root = ET.parse(xhtml_filename).getroot()
    replace_css_paths_with_absolute_file_path(root, tmp_path)

    (link_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}link")
    assert link_elem.attrib["href"] == f"file://{style_filename.resolve()}"


def test_replace_js_paths_with_absolute_file_path(tmp_path: Path) -> None:
    script_filename = tmp_path / "script.js"
    xhtml_filename = tmp_path / "template.xhtml"

    script_filename.write_text("console.log(123)")
    xhtml_filename.write_text(
        """
          <html xmlns="http://www.w3.org/1999/xhtml" lang="en" >
            <head>
              <meta charset="utf-8"/>
            </head>
            <body>
              <script src="script.js"/>
            </body>
          </html>
        """
    )

    root = ET.parse(xhtml_filename).getroot()
    replace_js_paths_with_absolute_file_path(root, tmp_path)

    (script_elem,) = root.findall(f".//{{{XHTML_NAMESPACE}}}script")
    assert script_elem.attrib["src"] == f"file://{script_filename.resolve()}"
