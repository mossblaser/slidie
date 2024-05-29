from xml.etree import ElementTree as ET

from slidie.xml_namespaces import SVG_NAMESPACE


def placeholder_to_image(svg: ET.Element, placeholder_id: str, data_url: str) -> None:
    """
    Given an SVG containing a magic video specification whose placeholder
    <rect> or <image> has the ID placeholder_id, replace that placeholder with
    an <image> showing the image in the provided data URL.
    """
    # Find placeholder
    (placeholder_elem,) = svg.findall(f".//*[@id={placeholder_id!r}]")

    # Turn into an <image>
    placeholder_elem.tag = f"{{{SVG_NAMESPACE}}}image"
    placeholder_elem.attrib["href"] = data_url

    # Remove any <image> preserveAspectRatio attribute to
    # ensure image is centered and scaled within the defined
    # area.
    placeholder_elem.attrib.pop("preserveAspectRatio", None)

    # Remove <rect>-specific attributes
    placeholder_elem.attrib.pop("rx", None)
    placeholder_elem.attrib.pop("ry", None)
    placeholder_elem.attrib.pop("pathLength", None)
