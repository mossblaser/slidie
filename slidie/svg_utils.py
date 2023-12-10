"""
Utilities for probing and interacting with (primarily) Inkscape-derrived SVGs.
"""

from typing import NamedTuple

from xml.etree import ElementTree as ET


# Relevant XML namespace URIs used by SVGs
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
INKSCAPE_NAMESPACE = "http://www.inkscape.org/namespaces/inkscape"
XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"

namespaces = {
    "svg": SVG_NAMESPACE,
    "inkscape": INKSCAPE_NAMESPACE,
    "xlink": XLINK_NAMESPACE,
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
            element.tag == f"{{{SVG_NAMESPACE}}}g" and
            element.attrib.get(f"{{{INKSCAPE_NAMESPACE}}}groupmode", None) == "layer"
        ):
            layer = InkscapeLayer(element, [])
            parent.insert(0, layer)
            for child in element:
                to_visit.append((layer.children, child))
        else:
            for child in element:
                to_visit.append((parent, child))

    return layers


def get_inkscape_layer_name(layer: ET.Element) -> str:
    """Get the layer name from an Inkscape layer <g>."""
    name = layer.attrib.get(f"{{{INKSCAPE_NAMESPACE}}}label")
    assert name is not None
    return name
