"""
Utilities for probing and interacting with (primarily) Inkscape-derrived SVGs.
"""

from typing import NamedTuple, Iterator

from xml.etree import ElementTree as ET


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


def flatten_layers(layers: list[InkscapeLayer]) -> Iterator[ET.Element]:
    """
    Given a hierarchy of layers (e.g. produced by
    :py:func:`enumerate_inkscape_layers`), iterate over the layers in a
    flattened fashion in the order they are displayed in the Inkscape GUI.
    """
    for layer in layers:
        yield layer.element
        for child in layer.children:
            yield from flatten_layers([child])


def get_inkscape_layer_name(layer: ET.Element) -> str:
    """Get the layer name from an Inkscape layer <g>."""
    name = layer.attrib.get(f"{{{INKSCAPE_NAMESPACE}}}label")
    assert name is not None
    return name


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
