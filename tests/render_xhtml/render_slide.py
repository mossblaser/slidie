#!/usr/bin/env python

"""
A wrapper around the :py:func:`slidie.render_xhtml.render_xhtml` function for
use as a script by the Javascript test suite.
"""

from argparse import ArgumentParser
from xml.etree import ElementTree as ET

from slidie.inkscape import Inkscape
from slidie.render_xhtml import render_slide

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    args = parser.parse_args()

    with Inkscape() as inkscape:
        out = render_slide(args.input, inkscape)
        ET.ElementTree(out).write(args.output)
