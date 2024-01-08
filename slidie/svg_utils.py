"""
Utilities for probing and interacting with (primarily) Inkscape-derrived SVGs.
"""

from typing import NamedTuple, Iterator

from xml.etree import ElementTree as ET

import json

from slidie.builds import evaluate_build_steps


# Relevant XML namespace URIs used by SVGs
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
INKSCAPE_NAMESPACE = "http://www.inkscape.org/namespaces/inkscape"
SODIPODI_NAMESPACE = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"
SLIDIE_NAMESPACE = "http://xmlns.jhnet.co.uk/slidie/1.0"

namespaces = {
    "svg": SVG_NAMESPACE,
    "inkscape": INKSCAPE_NAMESPACE,
    "sodipodi": SODIPODI_NAMESPACE,
    "xlink": XLINK_NAMESPACE,
    "slidie": SLIDIE_NAMESPACE,
}

ET.register_namespace("", SVG_NAMESPACE)
for name, uri in namespaces.items():
    if uri != SVG_NAMESPACE:
        ET.register_namespace(name, uri)


class InkscapeLayer(NamedTuple):
    element: ET.Element
    children: list["InkscapeLayer"]

    def __repr__(self) -> str:
        if self.children:
            return f"<InkscapeLayer {get_inkscape_layer_name(self.element)!r} {self.children!r}>"
        else:
            return f"<InkscapeLayer {get_inkscape_layer_name(self.element)!r}>"


def enumerate_inkscape_layers(root: ET.Element) -> list[InkscapeLayer]:
    """
    Enumerate all of the layers in an Inkscape SVG, in the order (and nesting)
    shown in Inkscape's Layers view (i.e. reverse drawing order).
    """
    layers: list[InkscapeLayer] = []
    to_visit: list[tuple[list[InkscapeLayer], ET.Element]] = [(layers, root)]

    while to_visit:
        parent, element = to_visit.pop(0)
        if (
            element.tag == f"{{{SVG_NAMESPACE}}}g"
            and element.attrib.get(f"{{{INKSCAPE_NAMESPACE}}}groupmode", None)
            == "layer"
        ):
            layer = InkscapeLayer(element, [])
            parent.insert(0, layer)
            for child in element:
                to_visit.append((layer.children, child))
        else:
            for child in element:
                to_visit.append((parent, child))

    return layers


def iter_layers(layers: list[InkscapeLayer]) -> Iterator[ET.Element]:
    """
    Given a hierarchy of layers (e.g. produced by
    :py:func:`enumerate_inkscape_layers`), iterate over the layers in a
    flattened fashion in the order they are displayed in the Inkscape GUI.
    """
    for layer in layers:
        yield layer.element
        for child in layer.children:
            yield from iter_layers([child])


def get_inkscape_layer_name(layer: ET.Element) -> str:
    """Get the layer name from an Inkscape layer <g>."""
    name = layer.attrib.get(f"{{{INKSCAPE_NAMESPACE}}}label")
    assert name is not None
    return name


def annotate_build_steps(svg: ET.Element) -> None:
    """
    Evaluate the build steps defined on layers in an Inkscape SVG and add a
    slidie:steps attribute to them giving the visible step numbers as a JSON
    array.

    Modifies 'svg' in-place.
    """
    layers = list(iter_layers(enumerate_inkscape_layers(svg)))

    layer_steps = evaluate_build_steps(list(map(get_inkscape_layer_name, layers)))

    for layer, steps in zip(layers, layer_steps):
        if steps is not None:
            layer.set(f"{{{SLIDIE_NAMESPACE}}}steps", json.dumps(steps))


def find_build_elements(svg: ET.Element) -> dict[ET.Element, list[int]]:
    """
    Find all elements with build steps defined and return a dictionary from
    SVG element to build steps.
    """
    return {
        elem: json.loads(elem.attrib[f"{{{SLIDIE_NAMESPACE}}}steps"])
        for elem in svg.findall(
            f".//{{{SVG_NAMESPACE}}}*[@{{{SLIDIE_NAMESPACE}}}steps]"
        )
    }


def get_build_step_range(svg: ET.Element) -> range:
    """
    Get a range covering all of the build step numbers for a given slide (as
    annotated in slidie:steps attributes).
    """
    # NB: We include the starting [0] firstly to handle the case where no
    # builds are used and secondly to constrain the step indices to include zero
    # (which is always present).
    steps_and_zero = sum(find_build_elements(svg).values(), start=[0])
    return range(min(steps_and_zero), max(steps_and_zero) + 1)


def get_inkscape_page_colour(svg: ET.Element) -> str | None:
    """
    Get the Inkscape page colour specified in an SVG, or None for a
    non-Inkscape SVG.
    """
    named_view = svg.find(f".//{{{SODIPODI_NAMESPACE}}}namedview")
    if named_view is None:  # Probably not an Inkscape SVG
        return None
    return named_view.get("pagecolor", None)


class ViewBox(NamedTuple):
    x: float
    y: float
    width: float
    height: float


def get_view_box(svg: ET.Element) -> ViewBox | None:
    """Get the view box for an SVG (if defined)."""
    if view_box_str := svg.get("viewBox", None):
        return ViewBox(*map(float, view_box_str.split()))
    else:
        return None


def get_inkscape_pages(svg: ET.Element) -> list[ViewBox]:
    """
    Get the extents of pages in an Inkscape (1.2+) multi-page SVG.

    For older Inkscape SVGs (without multiple pages) or non-Inkscape SVGs,
    returns an empty list.
    """
    # Also consider pages as candidates (in Inkscape 1.2+)
    if view_box := get_view_box(svg):
        x = view_box.x
        y = view_box.y
    else:
        x = y = 0

    return [
        ViewBox(
            float(page_elem.get("x", 0)) + x,
            float(page_elem.get("y", 0)) + y,
            float(page_elem.get("width", 0)),
            float(page_elem.get("height", 0)),
        )
        for page_elem in svg.findall(
            f".//{{{SODIPODI_NAMESPACE}}}namedview/{{{INKSCAPE_NAMESPACE}}}page"
        )
    ]


def fill_inkscape_page_background(svg: ET.Element) -> None:
    """
    Given an Inkscape SVG, add a <rect> behind every page which explicitly
    draws the Inkscape 'page' colour (100% opaquely).

    Does nothing for non-Inkscape SVGs.
    """
    if page_colour := get_inkscape_page_colour(svg):
        pages = get_inkscape_pages(svg)
        if view_box := get_view_box(svg):
            pages.append(view_box)

        for page in set(pages):
            rect = ET.Element(f"{{{SVG_NAMESPACE}}}rect")
            rect.set("x", str(page.x))
            rect.set("y", str(page.y))
            rect.set("width", str(page.width))
            rect.set("height", str(page.height))
            rect.set("style", f"fill:{page_colour}")

            svg.insert(0, rect)


def clip_to_inkscape_pages(svg: ET.Element) -> None:
    """
    Given an Inkscape SVG, clip the image to only include content within a
    page.

    Warning: This will result in an SVG with a <style> tag which is not
    well supported by Inkscape. Specifically the clip-path will be impossible
    to remove within Inkscape and a warning will be emitted when loading the
    file.
    """
    pages = get_inkscape_pages(svg)
    if view_box := get_view_box(svg):
        pages.append(view_box)

    defs = ET.SubElement(svg, f"{{{SVG_NAMESPACE}}}defs")
    clip_path = ET.SubElement(defs, f"{{{SVG_NAMESPACE}}}clipPath")
    clip_path.attrib["id"] = "slidie-clip-to-inkscpae-pages-clip-path"
    for page in set(pages):
        rect = ET.SubElement(clip_path, f"{{{SVG_NAMESPACE}}}rect")
        rect.set("x", str(page.x))
        rect.set("y", str(page.y))
        rect.set("width", str(page.width))
        rect.set("height", str(page.height))

    style = ET.SubElement(svg, f"{{{SVG_NAMESPACE}}}style")
    style.text = "svg > * { clip-path: url(#slidie-clip-to-inkscpae-pages-clip-path); }"
