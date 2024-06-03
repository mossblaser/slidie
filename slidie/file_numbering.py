"""
Utilities for working with files with numerically-prefixed names.

The :py:func:`extract_numerical_prefix` and :py:func:`replace_numerical_prefix`
functions are provided for extracting (or updating) these prefixes in
filenames.

The :py:func:`insert_numbers` function implements the logic required to pick new
numbers which place slides at a desired positions in the ordering. This
function also handles situations where no gap in the number sequence exists by
renumbering other slides to create a suitable gap. It does this inteligently
such that the number of renaming operations is minimised.

See :ref:`file-numbering` for more information on naming and numbering slides.

"""

from typing import NamedTuple

from pathlib import Path

import re

from fractions import Fraction


class InvalidNumericalPrefixError(ValueError):
    """
    Thrown when a filename does not have a valid numerical prefix.
    """

    def __str__(self) -> str:
        return f"Filename '{self.args[0]}' does not start with a number"


def extract_numerical_prefix_str(filename: Path) -> str:
    """
    Return the numerical prefix as a string, as it is formatted in the
    filename.

    Raises an InvalidNumericalPrefixError if no valid prefix is found.
    """

    if match := re.match(r"^[-+]?[0-9]+", filename.name):
        return match.group(0)
    else:
        raise InvalidNumericalPrefixError(filename.name)


def extract_numerical_prefix(filename: Path) -> int:
    """
    Return the value of the numerical prefix in a filename.

    Raises an InvalidNumericalPrefixError if no valid prefix is found.
    """
    return int(extract_numerical_prefix_str(filename))


def replace_numerical_prefix(filename: Path, number: int, digits: int = 5) -> Path:
    """
    Replace the numerical prefix of a file with the specified value. Zero-pads the
    number to the specified number of digits.

    Raises an InvalidNumericalPrefixError if no existing prefix is found.
    """
    suffix = filename.name.removeprefix(extract_numerical_prefix_str(filename))
    return filename.parent / f"{number:0{digits}d}{suffix}"


class DuplicateSlideNumberError(ValueError):
    """
    Thrown when two slides have the same numerical prefix.
    """

    def __str__(self) -> str:
        f1, f2 = self.args
        num = int(extract_numerical_prefix(f1))
        return f"'{f1}' and '{f2}' have the same number"


class NoSlidesFoundError(Exception):
    """
    Thrown when no slides are found in a directory.
    """

    def __str__(self) -> str:
        return f"No SVG files found in {self.args[0]}"


def enumerate_slides(directory: Path) -> list[Path]:
    """
    Enumerate the slides in a given directory, returning them in presentation
    order.

    If any SVG files without numerical prefixes are present, an
    InvalidNumericalPrefixError is thrown.

    If any numerical prefix is reused, a DuplicateSlideNumberError is thrown.

    If no slides are found, throws a NoSlidesFoundError.
    """
    slides = sorted(directory.glob("*.svg"), key=extract_numerical_prefix)

    # Check not empty
    if not slides:
        raise NoSlidesFoundError(directory)

    # Check for duplicate numbers
    slides_by_number: dict[int, Path] = {}
    for slide in slides:
        number = extract_numerical_prefix(slide)
        if number in slides_by_number:
            raise DuplicateSlideNumberError(slides_by_number[number], slide)

        slides_by_number[number] = slide

    return slides


def evenly_spaced_numbers_between(start: int, end: int, count: int) -> list[int]:
    """
    Return `count` distinct, monotonically increasing integers strictly greater
    than start and strictly less than end.
    """
    # Sanity check
    assert end - start > count

    return [
        start + ((step * (end - start)) // (count + 1)) for step in range(1, count + 1)
    ]


class NoFreeNumberError(ValueError):
    """Thrown when try_insert_number fails to find a solution."""


class NegativeNumberError(ValueError):
    """
    Thrown when allow_negative is False but the numbers passed in contain a
    negative number.
    """


def try_insert_numbers(
    existing_numbers: list[int],
    position: int,
    count: int = 1,
    allow_negative: bool = False,
    preferred_step_size: int = 100,
) -> list[int]:
    """
    Given a list of file numbers, return a list of 'count' new file numbers
    which would appear at the specified position in the existing order.

    If no such integral numbers exist, throws a NoFreeNumberError. This occurs
    when no gap in the existing_numbers is available in which to insert a new
    number.

    If allow_negative is False, will not generate negative file numbers and
    will throw a NoFreeNumberError if there is no suitable non-negative number.
    Will throw a NegativeNumberError if existing_numbers contains a negative
    number.
    """
    # Sanity checks
    assert existing_numbers == sorted(existing_numbers)  # In order
    assert len(set(existing_numbers)) == len(existing_numbers)  # No repeats

    # Check new position is valid
    if position < 0 or position > len(existing_numbers):
        raise IndexError(position)

    # Easy case: appending (or empty -- just another case of appending)
    if position == len(existing_numbers):
        first_new_number = max(existing_numbers, default=0) + preferred_step_size
        return [first_new_number + (i * preferred_step_size) for i in range(count)]

    # Check numbers aren't already negative if allow_negative is False
    if not allow_negative and existing_numbers[0] < 0:
        raise NegativeNumberError(existing_numbers)

    # Determine the numbers immediately before and after the gap we're hoping
    # to insert into.
    if position == 0:
        # Special case: inserting at start
        after = existing_numbers[0]
        before = -1  # I.e. 0 is the first available number
        if allow_negative:
            # Even more special case: Negative numbers are permitted too: We
            # should stretch out the range beyond zero if necessary to achieve
            # the preferred_step_size spacing between the inserted values
            before = min(before, after - (preferred_step_size * (count + 1)))
    else:
        # More general case: inserting inbetween existing values
        before = existing_numbers[position - 1]
        after = existing_numbers[position]

    if after - before >= count + 1:
        # Spread the new values evenly over the available space
        return evenly_spaced_numbers_between(before, after, count)
    else:
        # No gap available!
        raise NoFreeNumberError()


class Renumbering(NamedTuple):
    """Defines a re-numbering for a file."""

    old: int
    new: int


class Insertion(NamedTuple):
    """
    Description of how to insert a set of new file numbers into a sequence.
    """

    renumberings: list[Renumbering]
    """
    The renumbering operations to perform on existing numbered files. Note that
    all files to be renumbered must be moved into a temporary location before
    being moved into their final numberings to avoid accidentally overwriting
    files.
    """

    new_numbers: list[int]
    """
    The new numbers to insert into the sequence (at the position requested).
    """


def insert_numbers(
    existing_numbers: list[int],
    position: int,
    count: int = 1,
    allow_negative: bool = False,
    preferred_step_size: int = 100,
) -> Insertion:
    """
    Given a list of file numbers, return 'count' new file numbers which would
    appear at the specified position in the existing order, along with any
    renumberings needed to make room if necessary.

    This function will always return the solution which results in the minimum
    number of files being renumbered (i.e. to minimise disruption). Where
    multiple solutions requiring the same number of files to be renumbered
    exist, the solution which results in the largest spaces between newly
    inserted/renumbered entries is used.
    """
    # Special case: try and fit the new numbers in without renumbering anything
    try:
        return Insertion(
            renumberings=[],
            new_numbers=try_insert_numbers(
                existing_numbers=existing_numbers,
                position=position,
                count=count,
                allow_negative=allow_negative,
                preferred_step_size=preferred_step_size,
            ),
        )
    except NoFreeNumberError:
        pass

    # Given there's an insufficient gap in the numbers, we'll repeatedly
    # attempt to insert `count` new numbers whilst renumbering
    # 'num_renumberings' neughbouring entries, going with a solution which uses
    # the least possible renumberings.
    for num_renumberings in range(1, len(existing_numbers) + 1):
        # There are `num_renumberings + 1` ways to renumber `num_renumberings`
        # existing entries centered on the target position (think of a sliding
        # window). We'll try all of these and, if any produce valid solutions
        # (i.e. create a large enough gap) we'll pick the best one.
        #
        # [(renumber_start, renumber_end, new_numbers), ...]
        candidate_renumberings = []
        for renumber_window_offset in range(num_renumberings + 1):
            # The indices of the first and one-after-the-last entries in
            # existing_numbers to be renumbered
            renumber_start = position - num_renumberings + renumber_window_offset
            renumber_end = renumber_start + num_renumberings

            # Skip cases where window runs off the ends of the existing input
            if renumber_start < 0 or renumber_end > len(existing_numbers):
                continue

            # Attempt to generate new numbers for both the renumbered values
            # and the newly inserted values
            fixed_existing_numbers = (
                existing_numbers[:renumber_start] + existing_numbers[renumber_end:]
            )
            try:
                new_numbers = try_insert_numbers(
                    existing_numbers=fixed_existing_numbers,
                    position=renumber_start,
                    count=count + num_renumberings,
                    allow_negative=allow_negative,
                    preferred_step_size=preferred_step_size,
                )
                candidate_renumberings.append(
                    (renumber_start, renumber_end, new_numbers)
                )
            except NoFreeNumberError:
                continue

        # No solutions? Try renumbering more entries
        if not candidate_renumberings:
            continue

        # Pick the solution which spreads the the numbers out over the largest
        # range (thus leaving the largest spaces between them, improving the
        # chances of future insertions not requiring renumbering)
        renumber_start, renumber_end, new_numbers = max(
            candidate_renumberings,
            key=lambda candidate: candidate[2][-1] - candidate[2][0],
        )
        num_leading_renumberings = position - renumber_start

        renumber_old = existing_numbers[renumber_start:renumber_end]
        renumber_new = (
            new_numbers[:num_leading_renumberings]
            + new_numbers[num_leading_renumberings + count :]
        )

        return Insertion(
            [Renumbering(old, new) for old, new in zip(renumber_old, renumber_new)],
            new_numbers[num_leading_renumberings : num_leading_renumberings + count],
        )

    # Unreachable: We will have renumbered all values in the last iteration
    # which should always succeed
    assert False
