"""
Utilities for working with files with numerically-prefixed names.


Filename parsing/editing
========================

The order in which slides are included is determined by numerical prefixes in
their filenames. For example:

    * 100_first_slide.svg
    * 200_second_slide.svg
    * 300_third_slide.svg

The :py:func:`extract_numerical_prefix` and :py:func:`replace_numerical_prefix`
functions are provided for extracting (or updating) these prefixes in
filenames.


Number assignment
=================

By using BASIC-line-number-style numbering, it becomes possible to insert and
reorder slides in many situations without having to rename other files. This
may help minimise noise in version control systems. For example, we could move
the third slide in the example above between the first and second slides by
renaming it like so:

    * 100_first_slide.svg
    * 150_third_slide.svg (renumbered)
    * 200_second_slide.svg

The :py:func:`insert_number` function implements the logic required to pick new
numbers which place a slide at a desired position in the ordering. This
function also handles situations where no gap in the number sequence exists by
renumbering other slides to create a suitable gap. It does this inteligently
such that the number of renaming operations is minimised.
"""

from pathlib import Path

import re

from fractions import Fraction


def extract_numerical_prefix(filename: Path) -> int:
    """
    Return the value of the numerical prefix in a filename.

    Raises a ValueError if no valid prefix is found.
    """

    if match := re.match(r"^[-+]?[0-9]+", filename.name):
        return int(match.group(0))
    else:
        raise ValueError(filename.name)


def replace_numerical_prefix(filename: Path, number: int, digits: int = 5) -> Path:
    """
    Replace the numerical prefix of a file with the specified value. Zero-pads the
    number to the specified number of digits.

    Raises a ValueError if no existing prefix is found.
    """

    if match := re.match(r"^[-+]?[0-9]+(.*)$", filename.name):
        suffix = match.group(1)
        return filename.parent / f"{number:0{digits}d}{suffix}"
    else:
        raise ValueError(filename.name)


class NoFreeNumberError(ValueError):
    """Thrown when try_insert_number fails to find a solution."""


class NegativeNumberError(ValueError):
    """
    Thrown when allow_negative is False but the numbers passed in contain a
    negative number.
    """


def try_insert_number(
    existing_numbers: list[int],
    position: int,
    allow_negative: bool = False,
    preferred_step_size: int = 100,
) -> int:
    """
    Given a list of file numbers, return a new file number which would appear
    at the specified position in the order.

    If no such integral number exists, throws a NoFreeNumberError. This occurs
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
        return max(existing_numbers, default=0) + preferred_step_size

    # Check numbers aren't already negative if allow_negative is False
    if not allow_negative and existing_numbers[0] < 0:
        raise NegativeNumberError(existing_numbers)

    if position == 0:
        # Easy-ish case: inserting at start
        after = existing_numbers[0]
        if allow_negative or after < 0:
            # If negative numbers are permitted (or the first number is already
            # negative), generate a potentially negative number with impunity
            return after - preferred_step_size
        else:
            before = -1
    else:
        # More general case: inserting inbetween existing values
        before = existing_numbers[position - 1]
        after = existing_numbers[position]

    if after - before >= 2:
        # Pick something half-way between the two
        return before + ((after - before) // 2)
    else:
        # No gap available!
        raise NoFreeNumberError()


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


def squeeze_in_leading_number(
    numbers: list[int],
    preferred_step_size: int = 100,
) -> list[int]:
    """
    Given a list of file numbers, insert a new file number at the beginning
    whose value is at least `numbers[0]`. (i.e. we make the assumption that
    the number `numbers[0] - 1` is already in use).

    This function is intended for use in situations where we need to
    insert a value between two adjacent numbers and we need to renumber other
    files to create a gap.

    This will result in one or more of the input numbers having to be
    incremented to make room for the new number.

    As few numbers will be changed as possible.

    Changed numbers will be spaced evenly within the available gap. (It is
    assumed there is a number at numbers[0] - 1 so a gap is left at the start
    accordingly).

    If all numbers need to be changed, they will be re-numbered with a gap of
    preferred_step_size.
    """
    # Sanity checks
    assert len(numbers) > 0  # Non-empty
    assert numbers == sorted(numbers)  # In order
    assert len(set(numbers)) == len(numbers)  # No repeats

    # Find first gap in the numbers (gap_index = index of element after the
    # gap)
    last_number = numbers[0] - 1
    for gap_index, number in enumerate(numbers):
        if number != last_number + 1:
            break
        last_number = number
    else:
        # Special case: All numbers need incrementing (no gaps)
        return [
            numbers[0] - 1 + (i * preferred_step_size)
            for i in range(1, len(numbers) + 2)
        ]

    # More general case, evenly spread the numbers in the gap
    start = numbers[0] - 1
    end = numbers[gap_index]
    return (
        evenly_spaced_numbers_between(start, end, gap_index + 1) + numbers[gap_index:]
    )


def score_candidate_numbering(
    previous_numbers: list[int],
    position: int,
    candidate_numbers: list[int],
) -> tuple[int, float]:
    """
    Produce a disruptiveness score of a candidate renumbering solution. A
    lower score is less disriptive.

    The score is based on two key metrics (given in decreasing order of
    priority):

    * Number of renumberings (having to rename fewer files is less disriptive)
    * Spacing score. The result of sum(1/gap for gap between
      candidate_renumberings). This penalises solutions which leave smaller
      gaps between files.
    """

    num_renumberings = sum(
        a != b
        for a, b in zip(
            (
                previous_numbers[:position]
                + [candidate_numbers[position]]
                + previous_numbers[position:]
            ),
            candidate_numbers,
        )
    )

    spacing_score = sum(
        1 / (b - a) for a, b in zip(candidate_numbers[:-1], candidate_numbers[1:])
    )

    return (num_renumberings, spacing_score)


def insert_number(
    existing_numbers: list[int],
    position: int,
    allow_negative: bool = False,
    preferred_step_size: int = 100,
) -> tuple[int, list[tuple[int, int]]]:
    """
    Given a list of file numbers, pick a new file number which slots into the
    numbering at the desired position.

    In the event that there is no gap in the numbers around that position, a
    minimal number of neighbouring numbers will be renumbered to accomodate.

    If allow_negative is False, will not generate negative file numbers (unless
    necessary to fit between two already negative numbers).

    Returns a tuple (new_number, renumberings) where new_number is the number
    assigned to the newly inserted entry. renumberings is a list of
    (old_number, new_number) pairs giving renumbering operations to perform.
    The order of this list ensures changes won't collide.
    """

    # First, try insertion without renumbering
    try:
        # NB: Sanity checks performed by try_insert_number so no need to repeat
        # here.
        new_number = try_insert_number(
            existing_numbers,
            position,
            allow_negative,
            preferred_step_size,
        )
        return (new_number, [])
    except NoFreeNumberError:
        pass

    # If we couldn't find a space, we'll have to renumber things. We can either
    # shove all of the higher numbered files up or shove the lower numbered
    # files down to make room. Below we'll try both options and, assuming both
    # are possible, choose the least disruptive.
    candidate_renumberings = []

    # Try renumbering numbers after the target position
    candidate_renumberings.append(
        existing_numbers[:position]
        + squeeze_in_leading_number(existing_numbers[position:], preferred_step_size)
    )

    # Now try renumbering numbers before the target position.
    #
    # In the case of allow_negative=False (and the input doesn't have any
    # negative numbers) we internally add dummy a -1 numbered file. If this
    # ends up being renumbered we know the renumbering is not possible without
    # negative numbers. Otherwise, it serves to keep numbers evenly spaced
    # between 0 and subsequent file numbers.
    leading_numbers = existing_numbers[:position]
    if not allow_negative:
        leading_numbers.insert(0, -1)

    # To allow reuse of the squeeze_in_leading_number function, we flip the
    # signs of the numbers to make it operate in the opposite direction.
    inverted_leading_numbers = [-n for n in reversed(leading_numbers)]
    inverted_candidate_leading_numbers = squeeze_in_leading_number(
        inverted_leading_numbers, preferred_step_size
    )
    candidate_leading_numbers = [
        -n for n in reversed(inverted_candidate_leading_numbers)
    ]

    # Keep the candidate unless we went negative (and weren't allowed to)
    if not (not allow_negative and candidate_leading_numbers.pop(0) != -1):
        candidate_renumberings.append(
            candidate_leading_numbers + existing_numbers[position:]
        )

    # Pick the least disruptive candidate
    new_numbers = min(
        candidate_renumberings,
        key=lambda candidate_numbers: score_candidate_numbering(
            existing_numbers,
            position,
            candidate_numbers,
        ),
    )

    new_number = new_numbers[position]

    # Produce a list of number changes
    #
    # Decreases are listed with loweest first to avoid collisions.
    renumbering_decrease = [
        (before, after)
        for before, after in zip(
            existing_numbers[:position],
            new_numbers[:position],
        )
        if before != after
    ]
    # Increases are listed with largest first to avoid collisions.
    renumbering_increase = [
        (before, after)
        for before, after in zip(
            existing_numbers[position:],
            new_numbers[position + 1 :],
        )
        if before != after
    ][::-1]

    return (new_number, (renumbering_decrease + renumbering_increase))
