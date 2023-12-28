# NB: This file also exists to ensure the 'svgs' package (in this directory) is
# added to the python path by pytest for all tests.

import pytest

from typing import Iterator

from slidie.inkscape import Inkscape


@pytest.fixture(scope="module")
def inkscape() -> Iterator[Inkscape]:
    with Inkscape() as i:
        yield i
