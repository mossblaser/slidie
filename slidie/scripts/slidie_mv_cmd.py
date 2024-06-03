"""
The `slidie-mv` command is used to reorder slides within a show by renumbering
them. If necessary, other slides will be renumbered to make room.

Example usage::

    $ slidie-mv 100-foo.svg 200-bar.svg --after 300-bar.baz
    $ slidie-mv 400-qux.svg 500-quo.svg --before 300-bar.baz

See :ref:`slidie-mv` for more detailed usage info.

"""

from typing import NamedTuple, Iterable

from argparse import ArgumentParser
from pathlib import Path
from subprocess import run, DEVNULL

from slidie.file_numbering import (
    enumerate_slides,
    extract_numerical_prefix_str,
    extract_numerical_prefix,
    replace_numerical_prefix,
    Renumbering,
    insert_numbers,
)

from slidie.scripts.exception_formatting import slidie_exception_formatting


class FilesNotInSameDirectoryError(Exception):
    pass


def common_parent_directory(files: Iterable[Path]) -> Path:
    """
    Return the common parent directory of a collection of files.

    Raises ValueError if empty and FilesNotInSameDirectoryError if the files do
    not reside in a common parent directory.
    """
    parent_dirs = {f.parent.resolve() for f in files}

    if len(parent_dirs) == 0:
        raise ValueError("common_parent_directory() arg is empty")
    elif len(parent_dirs) > 1:
        raise FilesNotInSameDirectoryError()
    else:  # len(parent_dirs) == 1
        return next(iter(parent_dirs))


class NumberingParams(NamedTuple):
    num_digits: int
    allow_negative: bool
    preferred_step_size: int


def infer_numbering_parameters(slides: list[Path]) -> NumberingParams:
    """
    Infer the existing numbering conventions in use using some fairly crude
    heuristics.
    """
    # This script should never make it past the argument parser if no slides
    # are defined so we won't bother handling that special case here!
    assert slides

    prefixes = list(map(extract_numerical_prefix_str, slides))
    numbers = list(map(int, prefixes))

    num_digits = max(map(len, prefixes))

    allow_negative = any(n < 0 for n in numbers)

    # As a heuristic we'll assume that a properly numbered set of files will
    # always have at least one leading zero (e.g. allowing for 99 slides).
    max_leading_zeros = max(len(p) - len(p.lstrip("-0")) for p in prefixes)
    proper_num_digits = num_digits + (1 if max_leading_zeros == 0 else 0)

    # We can then make a decent guess at the step size based on the number of
    # digits used and the size of the numbers: we'll assume we're trying to
    # make the middle digit increment.
    preferred_step_size = 10 ** (proper_num_digits // 2)
    preferred_step_size = max(10, preferred_step_size)  # Minimum sensible

    return NumberingParams(
        num_digits=num_digits,
        allow_negative=allow_negative,
        preferred_step_size=preferred_step_size,
    )


def move_file(src: Path, dst: Path, git_mv: bool = True) -> None:
    """
    Move a file from src to dst, attempting to use `git mv` and falling back on
    an ordinary move if this fails (e.g. due to not being a file in Git).
    """
    if dst.is_file():
        raise FileExistsError(dst)

    if git_mv:
        result = run(["git", "mv", str(src), str(dst)], stdout=DEVNULL, stderr=DEVNULL)
    if not git_mv or result.returncode != 0:
        src.rename(dst)


def main(cli_args: list[str] | None = None) -> None:
    parser = ArgumentParser(
        description="""
            Reorder (i.e. renumber) slides within a show.
        """
    )
    parser.add_argument(
        "slide",
        type=Path,
        nargs="*",
        default=[],
        help="""
            One or more slides to be moved. These slides will be reinserted in
            the same relative order into the sequence regardless of the order
            they are specified here.
        """,
    )
    parser.add_argument(
        "--insert",
        "-i",
        type=int,
        const=1,
        nargs="?",
        default=0,
        metavar="count",
        help="""
            Print count new slide numbers in the specified position, moving
            existing slides as necessary to make space. If not specified, count
            defaults to 1.
        """,
    )
    reorder_parser = parser.add_mutually_exclusive_group(required=True)
    reorder_parser.add_argument(
        "--before",
        type=Path,
        metavar="slide",
        default=None,
        help="""
            Move the specified slides immediately before this slide.
        """,
    )
    reorder_parser.add_argument(
        "--after",
        type=Path,
        metavar="slide",
        default=None,
        help="""
            Move the specified slides immediately after this slide.
        """,
    )
    reorder_parser.add_argument(
        "--start",
        action="store_true",
        help="""
            Move the specified slides to the start of the show.
        """,
    )
    reorder_parser.add_argument(
        "--end",
        action="store_true",
        help="""
            Move the specified slides to the end of the show.
        """,
    )
    parser.add_argument(
        "--no-git-mv",
        "-G",
        action="store_true",
        default=False,
        help="""
            By default this tool will attempt to use `git mv` to rename files,
            falling back on ordinary file moving if this fails (e.g. because
            we're not in a git repo or the file is not in the repository).
            If --no-git/-G is given, `git mv` will not be used.
        """,
    )
    parser.add_argument(
        "--allow-negative",
        "-n",
        action="store_true",
        default=False,
        help="""
            If given, slides may be assigned negative numbers. This option is
            automatically enabled if any existing slide which is not being
            moved has a negative number.
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="""
            If given, outputs the renumberings to be applied but does not move
            any files.
        """,
    )

    args = parser.parse_args(cli_args)

    with slidie_exception_formatting():
        if args.slide and args.insert:
            parser.error("either slides to move or --insert may be used, but not both")

        if not args.slide and not args.insert:
            parser.error("either slides to move or --insert must be specified")

        try:
            source_directory = common_parent_directory(
                args.slide
                + ([args.before] if args.before else [])
                + ([args.after] if args.after else [])
            )
        except ValueError:
            # Empty list provided: assume current working directory
            source_directory = Path(".")

        slides = {
            extract_numerical_prefix(f): f for f in enumerate_slides(source_directory)
        }

        # Remove the slides to be moved from the list
        moved_slides = {extract_numerical_prefix(f): f for f in args.slide}
        static_slides = slides.copy()
        for num in moved_slides:
            del static_slides[num]
        static_slide_numbers = sorted(static_slides)

        # Determine the pivot point
        if args.before or args.after:
            pivot_slide = args.before or args.after
            try:
                pivot_slide_number = static_slide_numbers.index(
                    extract_numerical_prefix(pivot_slide)
                )
            except ValueError:
                parser.error(
                    "--before/--after must refer to a slide which isn't being moved"
                )
            if args.after is not None:
                pivot_slide_number += 1
        elif args.start:
            pivot_slide_number = 0
        elif args.end:
            pivot_slide_number = len(static_slide_numbers)
        else:
            assert False  # Unreachable

        # Work out numbering
        numbering_params = infer_numbering_parameters(list(slides.values()))
        replacements, new_numbers = insert_numbers(
            existing_numbers=static_slide_numbers,
            position=pivot_slide_number,
            count=len(moved_slides) or args.insert,
            allow_negative=args.allow_negative or numbering_params.allow_negative,
            preferred_step_size=numbering_params.preferred_step_size,
        )

        if moved_slides:
            replacements.extend(
                Renumbering(old, new)
                for old, new in zip(sorted(moved_slides), new_numbers)
            )

        # Print changes on dry run
        if args.dry_run:
            for old, new in replacements:
                old_name = slides[old].relative_to(source_directory)
                new_name = replace_numerical_prefix(
                    old_name,
                    new,
                    numbering_params.num_digits,
                )
                print(f"{old_name} -> {new_name}")

        # Print new numbers to insert
        if args.insert:
            for number in new_numbers:
                print(
                    replace_numerical_prefix(
                        Path("0"),
                        number,
                        numbering_params.num_digits,
                    )
                )

        # Rename all files to be moved with a 'temp_' prefix before moving them
        # into their final destinations. This avoids us accidentally overwriting
        # them when moving them to their final destinations.
        if not args.dry_run:
            for old, _ in replacements:
                move_file(
                    slides[old],
                    slides[old].parent / f"temp_{slides[old].name}",
                    not args.no_git_mv,
                )
            for old, new in replacements:
                move_file(
                    slides[old].parent / f"temp_{slides[old].name}",
                    replace_numerical_prefix(
                        slides[old], new, numbering_params.num_digits
                    ),
                    not args.no_git_mv,
                )
