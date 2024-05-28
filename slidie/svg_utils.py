"""
Utilities for probing and interacting with (primarily) Inkscape-derrived SVGs.
"""

from typing import NamedTuple, Iterator, Iterable

from xml.etree import ElementTree as ET
from copy import deepcopy
import json

from slidie.builds import evaluate_build_steps

from slidie.xml_namespaces import (
    SVG_NAMESPACE,
    INKSCAPE_NAMESPACE,
    SODIPODI_NAMESPACE,
    SLIDIE_NAMESPACE,
)


class InkscapeLayer(NamedTuple):
    element: ET.Element
    children: list["InkscapeLayer"]

    def __repr__(self) -> str:
        if self.children:
            return f"<InkscapeLayer {get_inkscape_layer_name(self.element)!r} {self.children!r}>"
        else:
            return f"<InkscapeLayer {get_inkscape_layer_name(self.element)!r}>"


def is_inkscape_layer(elem: ET.Element) -> bool:
    """Test whether an element is an Inkscape layer."""
    return (
        elem.tag == f"{{{SVG_NAMESPACE}}}g"
        and elem.attrib.get(f"{{{INKSCAPE_NAMESPACE}}}groupmode", None) == "layer"
    )


def enumerate_inkscape_layers(root: ET.Element) -> list[InkscapeLayer]:
    """
    Enumerate all of the layers in an Inkscape SVG, in the order (and nesting)
    shown in Inkscape's Layers view (i.e. reverse drawing order).
    """
    layers: list[InkscapeLayer] = []
    to_visit: list[tuple[list[InkscapeLayer], ET.Element]] = [(layers, root)]

    while to_visit:
        parent, element = to_visit.pop(0)
        if is_inkscape_layer(element):
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


def enumerate_elem_parents(root: ET.Element, target: ET.Element) -> list[ET.Element]:
    """
    Given an element, return a list [root, ..., target] giving the complete
    hiearchy of elements.
    """

    def find(elem: ET.Element, parents: list[ET.Element]) -> list[ET.Element] | None:
        elem_path = parents + [elem]
        if elem is target:
            return elem_path
        else:
            for child in elem:
                if result := find(child, elem_path):
                    return result
            return None

    parents = find(root, [])
    assert parents is not None
    return parents


def get_elem_inksape_layers(svg: ET.Element, elem: ET.Element) -> tuple[str, ...]:
    """
    Given an element, return the hierarchy of layer names that element resides
    in.
    """
    return tuple(
        get_inkscape_layer_name(elem)
        for elem in enumerate_elem_parents(svg, elem)
        if is_inkscape_layer(elem)
    )


def annotate_build_steps(svg: ET.Element) -> None:
    """
    Evaluate the build steps defined on layers in an Inkscape SVG and add the
    following attributes to them:

    * ``slidie:steps`` giving the visible step numbers as a JSON array.
    * ``slidie:tags`` giving the tag names given to that name (if any) as a
      JSON array. Omitted if no tags assigned.

    Modifies 'svg' in-place.
    """
    layers = list(iter_layers(enumerate_inkscape_layers(svg)))

    layer_steps = evaluate_build_steps(list(map(get_inkscape_layer_name, layers)))

    for layer, (steps, tags) in zip(layers, layer_steps):
        if steps is not None:
            layer.set(f"{{{SLIDIE_NAMESPACE}}}steps", json.dumps(steps))
        if tags:
            layer.set(f"{{{SLIDIE_NAMESPACE}}}tags", json.dumps(sorted(tags)))


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


def get_build_tags(svg: ET.Element) -> dict[str, set[int]]:
    """
    Returns the step numbers associated with each build spec tag.
    """
    out: dict[str, set[int]] = {}

    for elem, steps in find_build_elements(svg).items():
        for tag in json.loads(elem.get(f"{{{SLIDIE_NAMESPACE}}}tags", "[]")):
            for step in steps:
                out.setdefault(tag, set()).add(step)

    return out


def get_visible_build_steps(parents: Iterable[ET.Element]) -> tuple[int, ...] | None:
    """
    Given the element heirarchy leading from the root to a particular element,
    enumerate the build steps during which it will be visible. Returns None if
    always visible.

    Requires :py:func:`annotate_build_steps` to have been run beforehand.
    """
    steps: set[int] | None = None

    for elem in parents:
        if steps_json := elem.attrib.get(f"{{{SLIDIE_NAMESPACE}}}steps"):
            this_steps = set(json.loads(steps_json))
            if steps is not None:
                steps &= this_steps
            else:
                steps = this_steps

    if steps is not None:
        return tuple(sorted(steps))
    else:
        return None


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


def extract_multiline_text(text: ET.Element) -> str:
    """
    Attempt to extract a sensible plain-text representation of multi-line text
    within an SVG <text> element.

    This task is rendered difficult because SVG doesn't natively support a
    generic mechanism for multi-line text.  As such, this function depends on
    heuristics and so is not completely robust.

    In the easiest possible case, some tools (e.g. Inkscape for bounded text
    areas only) will actually embed newline characters in the SVG.

    In many cases, however, all we're left with is a series of <tspan>s to
    interpret.  Inkscape, at least, does include extra annotations for these in
    the form of sodipodi:role="line" attributes which may be useful in an
    Inkscape-originated document.  In the worst case, however, we just have to
    assume any <tspan> with the same 'x' coordinate as the first line start a
    new line.

    """
    if text.tag != f"{{{SVG_NAMESPACE}}}text":
        raise TypeError("Expected an SVG <text> element")

    # Best case: The text includes newline literals which we will assume
    # correctly indicate the locations of all line breaks.
    naive = "".join(text.itertext())
    if "\n" in naive:
        return naive

    # Next-best-case: The text was generated by Inkscape and includes
    # sodipodi:role="line" hints (we'll assume it hasn't been manually tampered
    # with).
    #
    # In this case, we'll insert a newline at the start of all annotated
    # tspans.
    text = deepcopy(text)
    first_annotated_tspan = None
    for elem in text.iterfind(
        f".//{{{SVG_NAMESPACE}}}tspan[@{{{SODIPODI_NAMESPACE}}}role='line']"
    ):
        elem.text = "\n" + (elem.text or "")

        if first_annotated_tspan is None:
            first_annotated_tspan = elem

    # ...and then remove the newline before the first annotated tspan because
    # it represents the first line, rather than a newline.
    if first_annotated_tspan is not None:
        first_annotated_tspan.text = (first_annotated_tspan.text or "").removeprefix(
            "\n"
        )

    if first_annotated_tspan is not None:
        return "".join(text.itertext())

    # Next-best-case: The text was generated by Inkscape for a text box with a
    # horizontal bound specified. This is is identifiable by the presence of an
    # 'inline-size' style attribute (which defines the wrapping interval). In
    # this mode, newlines are represented by literal newlines within the XML.
    if style := text.attrib.get("style"):
        # XXX: Not properly parsing the CSS here...
        if "inline-size" in style:
            return "".join(text.itertext())

    # Worst-case: We have nothing but bare <tspan> objects to go on.
    #
    # XXX: For now, we'll very crudely only pay attention to top-level <tspan>s
    # and assume any tspan which sets the 'y' or 'dy' attribute is starting a
    # newline. We could do a lot better than this (e.g. working out effective
    # coordinates and looking at those) but lets keep things simple until a
    # concrete case comes up...
    first_line_tspan = None
    for elem in text.iterfind(f".//{{{SVG_NAMESPACE}}}tspan"):
        if "y" in elem.attrib or "dy" in elem.attrib:
            elem.text = "\n" + (elem.text or "")
            if first_line_tspan is None:
                first_line_tspan = elem

    # Remove leading newline added to first tspan unless there was already text before it
    if first_line_tspan is not None and not text.text:
        first_line_tspan.text = (first_line_tspan.text or "").removeprefix("\n")

    return "".join(text.itertext())


def find_text_with_prefix(
    root: ET.Element,
    prefix: str,
    _parents: tuple[ET.Element, ...] = (),
) -> Iterator[tuple[tuple[ET.Element, ...], str]]:
    """
    Iterate over all text blocks within a document with the given prefix.

    Generates a series of (path, str) pairs. Here the string is the text
    embedded in the <text> with the leading prefix removed. The path is a tuple
    starting with the passed in root element and all intermediate elements
    until the matched <text> block. This may be useful for 'magic' text objects
    which are sensitive to sibling or parent objects (since ElementTree doesn't
    include parent references!).

    The _parents argument is for internal use only.
    """
    if root.tag == f"{{{SVG_NAMESPACE}}}text":
        text = extract_multiline_text(root)
        if text.startswith(prefix):
            yield (_parents + (root,), text.removeprefix(prefix))
    elif root.tag.startswith(f"{{{SVG_NAMESPACE}}}"):
        for child in root:
            yield from find_text_with_prefix(child, prefix, _parents + (root,))
