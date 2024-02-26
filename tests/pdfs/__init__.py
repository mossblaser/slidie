from collections.abc import Callable

from pathlib import Path


PDF_DIR = Path(__file__).parent


def get_pdf(name: str) -> Path:
    """
    Return the full path of a PDF in this directory.
    """
    return PDF_DIR / name
