"""
The tests in this file test the HTML/CSS/SVG/Typescript-based viewer
application. These tests are, unsurprisingly, largely written in Typescript and
so we simply run them here.
"""

import pytest

from typing import Callable

import os
import sys
from pathlib import Path
from subprocess import run


VIEWER_DIR = Path(__file__).parent.parent.parent / "slidie" / "render_xhtml" / "viewer"

NpmRunFn = Callable[[str, str | None], None]


@pytest.fixture(scope="module")
def npm_run() -> NpmRunFn:
    """
    This fixture provides a "npm_run" function which runs a NPM script in the
    viewer application.

    The fixture will also cause tests to be skipped when the ``node_modules``
    directory is absent indicating that the build environment has not been
    initialised.
    """
    if not (VIEWER_DIR / "node_modules").is_dir():
        raise pytest.skip(
            "Typescript build environment not initialised.\n"
            f"Run `npm install` in {VIEWER_DIR}."
        )

    def npm_run(command: str, fail_message: str | None):
        if fail_message is None:
            fail_message = f"'npm run {command}' failed"

        result = run(
            ["npm", "run", command],
            cwd=VIEWER_DIR,
            env=dict(
                os.environ,
                # Make sure the same Python interpreter gets used
                PATH=f"{Path(sys.executable).parent}:{os.environ.get('PATH', '')}",
                # Make sure the same Python library search path is used
                PYTHONPATH=":".join(sys.path),
            ),
        )

        assert result.returncode == 0, fail_message

    return npm_run


def test_check_bundle_up_to_date(npm_run: NpmRunFn) -> None:
    # Verify that the index.js file in the viewer directory matches what
    # building the sources would generate.
    npm_run(
        "check-up-to-date",
        (
            "Viewer JS bundle does not match Typescript source.\n"
            f"Run `npm run build` in {VIEWER_DIR}."
        ),
    )


def test_run_ts_test_suite(npm_run: NpmRunFn) -> None:
    npm_run("test", None)
