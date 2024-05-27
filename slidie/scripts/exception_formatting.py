"""
Simple exception formatting for internal exceptions (which are intended as
error messages), regular tracebacks otherwise.
"""

from typing import Iterator

import sys
import re
from contextlib import contextmanager
from traceback import format_exception_only

module = __name__.partition(".")[0]


@contextmanager
def slidie_exception_formatting(code: int = 1) -> Iterator[None]:
    """
    If an exception is produced by the slidie module, just print the exception
    (without a traceback) and exit with the provided error code. NB: Slidie
    exceptions are intended to be user-facing.

    Other exceptions are not caught and are allowed to bubble through.
    """
    try:
        yield
    except Exception as exc:
        exc_module = getattr(exc, "__module__", "").partition(".")[0]
        if exc_module == module:
            msg = "".join(format_exception_only(exc))

            # Strip fully qualified exception name to just the class name
            msg = re.sub(
                r"^" + re.escape(module) + r"[^:]*\.([^.:]+):",
                r"\1:",
                msg,
            )

            print(msg, end="", file=sys.stderr)
            sys.exit(code)
        else:
            raise
