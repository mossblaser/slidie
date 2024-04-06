"""
Logic for assembling the XHTML/CSS/JS viewer application from template files.

These scripts will inline CSS and Javascript referenced within the provided
template file to generate a single standalone XHTML document -- unless in debug
mode.

In debug mode, the template will instead reference CSS and Javascript using
absolute ``file://`` URLs to files in the local slidie installation. The
primary benefit of debug mode is that it enables changes to CSS and Javascript
to be made without re-running slidie. It also works-around bugs in (2024)
browser handling of inline source maps in linelined scripts which lead to less
helpful tracebacks in normal mode.
"""

from pathlib import Path
from xml.etree import ElementTree as ET
from base64 import b64encode
import re

from slidie.xml_namespaces import XHTML_NAMESPACE


def inline_css(root: ET.Element, path: Path) -> None:
    """
    Substitute ``<link rel="stylesheet" href="..." />`` for
    ``<style>...</style>``.
    """
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}link"):
        if elem.attrib.get("rel") == "stylesheet":
            del elem.attrib["rel"]

            href = elem.attrib.pop("href")
            if href is None:
                raise ValueError("Template <link> missing 'http'")

            elem.tag = f"{{{XHTML_NAMESPACE}}}style"
            css_filename = path / Path(href)
            elem.text = css_filename.read_text()


def inline_sourcemap(script_filename: Path) -> str:
    """
    Read a Javascript file and inline (via data URLs) any external
    sourceMappingURL and add a ``//# sourceURL`` comment giving the script's
    filename.
    """

    def convert_sourcemap_to_dataurl(match: re.Match) -> str:
        sourcemap_filename = script_filename.parent / match.group("filename")
        sourcemap = sourcemap_filename.read_bytes()
        dataurl = f"data:application/json;base64,{b64encode(sourcemap).decode('ascii')}"
        return f"{match.group('prefix')}{dataurl}"

    # NB: This could potentially find false positives if we start including
    # multiline backtick strings with decoy source mapping URLs in our
    # sources... But lets assume we're not our own adversary...
    return (
        re.sub(
            r"^(?P<prefix>\s*//#\s+sourceMappingURL=)(?P<filename>.+)$",
            convert_sourcemap_to_dataurl,
            script_filename.read_text(),
            flags=re.MULTILINE,
        ).rstrip()
        + f"\n//# sourceURL={script_filename.name}\n"
    )


def inline_js(root: ET.Element, path: Path) -> None:
    """
    Substitute ``<script src="...">`` for ``<script>...</script>``.
    """
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}script"):
        if "src" in elem.attrib:
            src = elem.attrib.pop("src")
            assert src is not None

            script_filename = path / Path(src)
            elem.text = inline_sourcemap(script_filename)


def inline_templates(root: ET.Element, path: Path, debug: bool) -> None:
    """
    Substitute ``<template src="...">`` for ``<template>...</template>``.

    Note that the 'src' argument is not a non-standard attribute of the
    template tag which only has meaning in this module.
    """
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}template"):
        if "src" in elem.attrib:
            src = elem.attrib.pop("src")
            assert src is not None

            template_path = path / Path(src)
            template = ET.parse(template_path).getroot()
            inline_or_replace_css_js_and_templates(  # Recurse!
                template,
                template_path.parent,
                debug,
            )
            elem.append(template)


def replace_css_paths_with_absolute_file_path(root: ET.Element, path: Path) -> None:
    """
    Given an XHTML document, replace hrefs to local CSS files with file://...
    URLs with a full, absolute path.
    """
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}link"):
        if elem.attrib.get("rel") == "stylesheet":
            href = elem.attrib.pop("href")
            if href is None:
                raise ValueError("Template <link> missing 'http'")
            css_filename = path / Path(href)
            elem.attrib["href"] = f"file://{css_filename.resolve()}"


def replace_js_paths_with_absolute_file_path(root: ET.Element, path: Path) -> None:
    """
    Given an XHTML document, replace hrefs to local CSS files with file://...
    URLs with a full, absolute path.
    """
    for elem in root.iterfind(f".//{{{XHTML_NAMESPACE}}}script"):
        if "src" in elem.attrib:
            src = elem.attrib.pop("src")
            assert src is not None
            script_filename = path / Path(src)
            elem.attrib["src"] = f"file://{script_filename.resolve()}"


def inline_or_replace_css_js_and_templates(
    root: ET.Element, path: Path, debug: bool
) -> None:
    """
    In normal mode, inlines all CSS, JS and templates referenced in external
    files. In debug mode, replaces file references with absolute file:// URLs.
    """
    if debug:
        replace_css_paths_with_absolute_file_path(root, path)
        replace_js_paths_with_absolute_file_path(root, path)
    else:
        inline_css(root, path)
        inline_js(root, path)
    inline_templates(root, path, debug)


def render_template(
    template: Path,
    slides: list[ET.Element],
    debug: bool,
) -> ET.Element:
    """
    Render the XHTML template, substituting in the provided series of SVG
    slides.

    Returns the root element for the XHTML document.
    """
    root = ET.parse(template).getroot()

    # For ease of editing, the template has its CSS and Javascript stored in
    # separate files with the base.xhtml file referencing them using <link> and
    # <script src="..."> tags. We substitute those for inline <style> and
    # <script> tags.
    inline_or_replace_css_js_and_templates(root, template.parent, debug)

    (slides_container,) = root.findall(f".//{{{XHTML_NAMESPACE}}}*[@id='slides']")

    for slide in slides:
        # The following slightly mysterious structure invokes the
        # 'declarative shadow DOM' feature available in modern browsers.
        # This effectively inserts each SVG inside a `<div
        # class="slide-container">` element but with each SVG residing in a
        # 'shadow DOM'. This has the effect of giving each SVG its own
        # (mostly) isolated namespace and DOM for IDs, CSS and Javascript.
        slide_container = ET.SubElement(
            slides_container,
            f"{{{XHTML_NAMESPACE}}}div",
            {"class": "slide-container"},
        )
        template_elem = ET.SubElement(
            slide_container,
            f"{{{XHTML_NAMESPACE}}}template",
            {"shadowrootmode": "open"},
        )
        template_elem.append(slide)

        # Style the SVG to ensure it fills the available space.
        #
        # This must be done explicitly here (rather than in CSS) because the
        # <svg> exists in its own isolated shadow DOM where the main document's
        # CSS cannot reach it.
        slide.attrib[
            "style"
        ] = f"display:block;width:100%;height:100%;{slide.attrib.get('style', '')}"

    return root
