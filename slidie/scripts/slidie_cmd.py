"""
The `slidie` command is used to render a directory full of SVGs into one of the
supported output formats.
"""

from argparse import ArgumentParser
from pathlib import Path

from slidie.render_xhtml import render_xhtml


def main() -> None:
    parser = ArgumentParser(
        description="""
            Render a slidie slide show.
        """
    )
    parser.add_argument(
        "source",
        type=Path,
        nargs="?",
        default=Path(),
        help="""
            The source directory containing SVG slides. Defaults to current directory.
        """,
    )
    parser.add_argument(
        "--output",
        "-",
        type=Path,
        default=Path("out.xhtml"),
        help="""
            The output file name to generate. The extension will be used to
            determine the output format. Defaults to 'out.xhtml'.
        """,
    )

    args = parser.parse_args()

    # TODO: Make error reporting sensible
    match args.output.suffix:
        case ".xhtml":
            render_xhtml(args.source, args.output)
        case suffix:
            raise NotImplementedError(suffix)


if __name__ == "__main__":
    main()