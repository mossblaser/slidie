from svgs import get_svg

from slidie.inkscape import Inkscape
from slidie.xml_namespaces import SVG_NAMESPACE
from slidie.text_to_selectable_paths import text_to_selectable_paths


def test_text_to_selectable_paths(inkscape: Inkscape) -> None:
    svg = get_svg("simple_text.svg")
    text_to_selectable_paths(svg, inkscape)

    # Sanity check: Old text is now not a <text> element
    new_text = svg.find(".//*[@id='text1']")
    assert new_text is not None
    assert new_text.tag != f"{{{SVG_NAMESPACE}}}text"

    # Sanity check: Selectable text is a <text> element
    selectable_text = svg.find(".//*[@id='text1-selectable']")
    assert selectable_text is not None
    assert selectable_text.tag == f"{{{SVG_NAMESPACE}}}text"
