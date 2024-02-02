import pytest

from pathlib import Path
from subprocess import run


def test_javascript() -> None:
    try:
        run(
            [
                "node",
                "--test",
                str(Path(__file__).parent.parent / "slidie"),
            ],
            check=True,
        )
    except FileNotFoundError:
        pytest.skip("'node' (nodejs) command not found")
