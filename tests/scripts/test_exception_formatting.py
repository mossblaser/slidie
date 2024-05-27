import pytest

from typing import Any

from slidie.builds import parse_build_specification_step

from slidie.scripts.exception_formatting import slidie_exception_formatting


class TestSlidieExceptionFormatting:
    def test_slidie_exception(self, capsys: Any) -> None:
        with pytest.raises(SystemExit):
            with slidie_exception_formatting():
                try:
                    parse_build_specification_step("<invalid>")
                except Exception as exc:
                    exc.add_note("Hey look! A note!")
                    raise

        out, err = capsys.readouterr()
        assert out == ""
        assert err == (
            "InvalidStepError: Invalid step specification '<invalid>'.\n"
            "Hey look! A note!\n"
        )

    def test_other_exception(self) -> None:
        with pytest.raises(ValueError):
            with slidie_exception_formatting():
                raise ValueError("I'm not a slidie error!")
