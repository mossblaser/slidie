"""
Defines relevant XML namespace URIs used by SVGs and XHTML and XHTML
"""

from xml.etree import ElementTree as ET


SVG_NAMESPACE = "http://www.w3.org/2000/svg"
XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml"
INKSCAPE_NAMESPACE = "http://www.inkscape.org/namespaces/inkscape"
SODIPODI_NAMESPACE = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"
SLIDIE_NAMESPACE = "http://xmlns.jhnet.co.uk/slidie/1.0"


xml_namespaces = {
    "svg": SVG_NAMESPACE,
    "xhtml": XHTML_NAMESPACE,
    "inkscape": INKSCAPE_NAMESPACE,
    "sodipodi": SODIPODI_NAMESPACE,
    "xlink": XLINK_NAMESPACE,
    "slidie": SLIDIE_NAMESPACE,
}

# Default to using the names above in exported documents
for name, uri in xml_namespaces.items():
    ET.register_namespace(name, uri)

# Use XHTML as the default namespace in output files
ET.register_namespace("", XHTML_NAMESPACE)
