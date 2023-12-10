from collections.abc import Callable

from pathlib import Path
from xml.etree import ElementTree as ET


SVG_DIR = Path(__file__).parent


def get_svg(name: str) -> ET.Element:
    """
    Parse one of the SVGs in this test directory, returning the root element.
    """
    return ET.parse(SVG_DIR / name).getroot()
