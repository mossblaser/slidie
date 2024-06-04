"""
The `slidie` command is used to render a directory full of SVGs into one of the
supported output formats.
"""

from argparse import ArgumentParser
from pathlib import Path

from slidie.file_numbering import enumerate_slides
from slidie.scripts.exception_formatting import slidie_exception_formatting

from slidie.render_xhtml import render_xhtml
from slidie.render_pdf import render_pdf
from slidie.render_png import render_png


def main() -> None:
    parser = ArgumentParser(
        description="""
            Render a slidie slide show.
        """
    )
    parser.add_argument(
        "source",
        type=Path,
        nargs="*",
        default=[Path()],
        help="""
            The source directory containing SVG slides, or a sequence of
            specific SVG files (e.g. to allow quickly re-rending just a
            particular slide). Defaults to current directory.
        """,
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("out.xhtml"),
        help="""
            The output file name to generate. The extension will be used to
            determine the output format. Supported extensions are '.xhtml',
            '.pdf' and '.png'. Defaults to 'out.xhtml'.
        """,
    )
    parser.add_argument(
        "--png-dpi",
        default=96.0,
        type=float,
        help="""
            The DPI to use when rendering slides to PNG images. (Ignored for
            other formats). Default: %(default)s.
        """,
    )
    parser.add_argument(
        "--png-background-opacity",
        default=1.0,
        type=float,
        help="""
            The background opacity (0.0 - 1.0) for rendering slides to PNG
            images. (Ignored for other formats). Default: %(default)s.
        """,
    )
    parser.add_argument(
        "--debug",
        default=False,
        action="store_true",
        help="""
            For slidie development use only. Generate outputs in development
            debug mode.
        """,
    )

    args = parser.parse_args()

    with slidie_exception_formatting():
        sources = []
        for svg_or_dir in args.source:
            if svg_or_dir.is_file():
                sources.append(svg_or_dir)
            if svg_or_dir.is_dir():
                sources.extend(enumerate_slides(svg_or_dir))

        match args.output.suffix:
            case ".xhtml":
                render_xhtml(sources, args.output, args.debug)
            case ".pdf":
                render_pdf(sources, args.output)
            case ".png":
                render_png(
                    sources,
                    args.output,
                    dpi=args.png_dpi,
                    background_opacity=args.png_background_opacity,
                )
            case ".html" | ".htm" as suffix:
                parser.error(
                    f"Unsupported --output suffix: {suffix} (did you mean .xhtml?)"
                )
            case suffix:
                parser.error(f"Unsupported --output suffix: {suffix}")


if __name__ == "__main__":
    main()
