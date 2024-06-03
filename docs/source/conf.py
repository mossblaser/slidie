# Configuration file for the Sphinx documentation builder.
#
# -- Path setup --------------------------------------------------------------

# If extensions (or modules to document with autodoc) are in another directory,
# add these directories to sys.path here. If the directory is relative to the
# documentation root, use os.path.abspath to make it absolute, like shown here.

import os
import sys

sys.path.insert(0, os.path.abspath("../../slidie"))


# -- Project information -----------------------------------------------------

project = "Slidie"
copyright = "2024, Jonathan Heathcote"
author = "Jonathan Heathcote"

# The full version, including alpha/beta/rc tags
from slidie import __version__

release = __version__


# -- General configuration ---------------------------------------------------

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.intersphinx",
    "sphinxcontrib.programoutput",
    "numpydoc",
]

templates_path = []

exclude_patterns = []

# Fixes numpydoc autosummary errors
numpydoc_show_class_members = False

# Order members in source order, not alphabetically
autodoc_member_order = "bysource"

# Pull in references to other Python code's docs
intersphinx_mapping = {
    "python": ("http://docs.python.org/3", None),
}

# -- Options for HTML output -------------------------------------------------

import sphinx_readable_theme
html_theme = 'readable'
html_theme_path = [sphinx_readable_theme.get_html_theme_path()]

html_static_path = ["_static"]
