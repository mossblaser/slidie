import pytest

from pathlib import Path

from itertools import product, repeat

from slidie.file_numbering import (
    extract_numerical_prefix,
    replace_numerical_prefix,
    NoFreeNumberError,
    NegativeNumberError,
    try_insert_number,
    evenly_spaced_numbers_between,
    squeeze_in_leading_number,
    score_candidate_numbering,
    insert_number,
)


@pytest.mark.parametrize(
    "filename, exp",
    [
        # No number
        (Path("foo"), None),
        (Path("foo/bar"), None),
        (Path("foo/bar.baz"), None),
        (Path("+"), None),
        (Path("-"), None),
        # Just a number
        (Path("1"), 1),
        (Path("123"), 123),
        (Path("foo/123"), 123),
        # A number with other stuff afterwards
        (Path("1foo"), 1),
        (Path("1.foo"), 1),
        (Path("1.9foo"), 1),
        # Signed numbers
        (Path("+123"), 123),
        (Path("-123"), -123),
    ],
)
def test_extract_numerical_prefix(filename: Path, exp: int | None) -> None:
    if exp is not None:
        assert extract_numerical_prefix(filename) == exp
    else:
        with pytest.raises(ValueError):
            extract_numerical_prefix(filename)


@pytest.mark.parametrize(
    "filename, number, exp",
    [
        # Basic functionality (and padding)
        (Path("00100 foo"), 1234, Path("01234 foo")),
        # Negative number treatment
        (Path("00100 foo"), -123, Path("-0123 foo")),
        # Nested path
        (Path("foo/12 bar"), 123, Path("foo/00123 bar")),
    ],
)
def test_replace_numerical_prefix(filename: Path, number: int, exp: Path) -> None:
    assert replace_numerical_prefix(filename, number) == exp


class TestTryInsertNumber:
    @pytest.mark.parametrize("position", [-1, 4])
    def test_invalid_position(self, position: int) -> None:
        with pytest.raises(IndexError):
            try_insert_number([100, 200, 300], position)

    @pytest.mark.parametrize(
        "existing_numbers, position, allow_negative, exp",
        # Cases with negative numbers not required or used (i.e. allow_negative
        # should have no effect)
        [
            (existing_numbers, position, allow_negative, exp)
            for existing_numbers, position, exp in [
                # Empty
                ([], 0, 100),
                # Append
                ([500], 1, 600),
                ([100, 500], 2, 600),
                # Insert between (not tight)
                ([10, 20], 1, 15),
                ([10, 20, 30], 1, 15),
                ([9, 10, 20, 30], 2, 15),
                # Insert between (tight fit)
                ([10, 12], 1, 11),
                # Insert between (tightish fit)
                ([10, 13], 1, 11),
            ]
            for allow_negative in [False, True]
            # Cases where the specific negative number mode matters
        ]
        + [
            # Insert at start (current start is already negative)
            ([-1], 0, True, -101),
            ([-1, 1], 0, True, -101),
            # Insert at start, when +ve only split between 0 and number
            ([500], 0, False, 249),
            # Insert at start, only just room whilst positive
            ([1], 0, False, 0),
            # Insert at start near zero, negative allowed
            ([1], 0, True, -99),
        ],
    )
    def test_possible(
        self,
        existing_numbers: list[int],
        position: int,
        allow_negative: bool,
        exp: int,
    ) -> None:
        assert try_insert_number(existing_numbers, position, allow_negative) == exp

    @pytest.mark.parametrize(
        "existing_numbers, position, allow_negative",
        [
            # No space between
            ([10, 11], 1, True),
            ([10, 11], 1, False),
            # No space before (and negative numbers not allowed)
            ([0], 0, False),
        ],
    )
    def test_impossible(
        self,
        existing_numbers: list[int],
        position: int,
        allow_negative: bool,
    ) -> None:
        with pytest.raises(NoFreeNumberError):
            try_insert_number(existing_numbers, position, allow_negative)

    def test_negative_check(self) -> None:
        with pytest.raises(NegativeNumberError):
            try_insert_number([-1], 0, allow_negative=False)


class TestEvenlySpacedNumbersBetween:
    @pytest.mark.parametrize(
        "start, end, count, exp",
        [
            # No choices
            (10, 12, 1, [11]),
            (10, 14, 3, [11, 12, 13]),
            # Evenly space
            (10, 20, 1, [15]),
            (10, 20, 4, [12, 14, 16, 18]),
        ],
    )
    def test_by_cases(self, start: int, end: int, count: int, exp: list[int]) -> None:
        assert evenly_spaced_numbers_between(start, end, count) == exp

    def test_brute_force(self) -> None:
        start = 100
        for count in range(1, 10):
            for space in range(count, count * 3):
                end = start + space + 1
                out = evenly_spaced_numbers_between(start, end, count)
                assert all(x > start for x in out)
                assert all(x < end for x in out)
                assert out == sorted(out)
                assert len(out) == len(set(out))


@pytest.mark.parametrize(
    "numbers, exp",
    [
        # Singleton case (renumber from scratch)
        ([11], [110, 210]),
        # No gaps (renumber from scratch)
        ([11, 12, 13], [110, 210, 310, 410]),
        # Tight gap
        ([10, 12], [10, 11, 12]),
        ([10, 11, 12, 14, 20], [10, 11, 12, 13, 14, 20]),
        # Loose gap
        #  9  10  11  12  13  14  15  16  17  18
        #  <          ##          ##          >
        ([10, 18], [12, 15, 18]),
        ([10, 18, 20], [12, 15, 18, 20]),
    ],
)
def test_squeeze_in_leading_number(numbers: list[int], exp: list[int]) -> None:
    assert squeeze_in_leading_number(numbers) == exp


class TestScoreCandidateNumbering:
    @pytest.mark.parametrize(
        "previous_numbers, position, candidate_numbers, exp",
        [
            # Push top number up (1 change)
            ([1, 2, 3], 2, [1, 2, 3, 4], 1),
            # Push bottom numbers down (2 changes)
            ([1, 2, 3], 2, [0, 1, 2, 3], 2),
        ],
    )
    def test_num_renumberings(
        self,
        previous_numbers: list[int],
        position: int,
        candidate_numbers: list[int],
        exp: tuple[int, float],
    ) -> None:
        assert (
            score_candidate_numbering(previous_numbers, position, candidate_numbers)[0]
            == exp
        )

    def test_spacing_score(self) -> None:
        tight_score = score_candidate_numbering([1, 2], 1, [1, 2, 3])[1]
        loose_score = score_candidate_numbering([1, 2], 1, [1, 2, 102])[1]

        assert tight_score > loose_score


class TestInsertNumber:
    @pytest.mark.parametrize(
        "existing_numbers, position, allow_negative, exp",
        [
            # Empty
            ([], 0, False, (100, [])),
            ([], 0, True, (100, [])),
            # Append
            ([100], 1, False, (200, [])),
            ([100], 1, True, (200, [])),
            # Insert (space available)
            ([100, 200], 1, False, (150, [])),
            ([100, 200], 1, True, (150, [])),
            # Insert below zero, negative allowed
            ([0], 0, True, (-100, [])),
            # Dense, insert near end (should favour pushing to end)
            (
                [1, 2, 3, 4, 5],
                3,
                True,
                (103, [(5, 303), (4, 203)]),
            ),
            # Dense, insert near start, negatives allowed (should favour pushing to start)
            (
                [1, 2, 3, 4, 5],
                1,
                True,
                (-98, [(1, -198)]),
            ),
            # Dense, insert near start, negatives disallowed (should favour pushing to start)
            (
                [1, 2, 3, 4, 5],
                1,
                False,
                (1, [(1, 0)]),
            ),
            # Dense, insert near start, negatives disallowed but no space at
            # start so forced to push everything up instead
            (
                [0, 1, 2, 3, 4, 5],
                1,
                False,
                (100, [(5, 600), (4, 500), (3, 400), (2, 300), (1, 200)]),
            ),
            # Dense, insert near start, negatives allowed: should push down
            (
                [0, 1, 2, 3, 4, 5],
                1,
                True,
                (-99, [(0, -199)]),
            ),
            # When equal changes required on either side (in this case two
            # edits), pick option with largest gaps (which here is the
            # leading numbers since after spacing between 0 and 301 we end up
            # with larger gaps (>100) than renumbering the trailing numbers
            # (with a fixed gap of 100 each)
            (
                [998, 999, 1000, 1001],
                2,
                False,
                (750, [(998, 250), (999, 500)]),
            ),
        ],
    )
    def test_cases(
        self,
        existing_numbers: list[int],
        position: int,
        allow_negative: bool,
        exp: tuple[int, list[tuple[int, int]]],
    ) -> None:
        assert (
            insert_number(
                existing_numbers,
                position,
                allow_negative,
            )
            == exp
        )

    def test_exhaustive(self) -> None:
        n = 0
        for count in range(1, 6):
            for start in [0, 1, 10, 1000]:
                for gaps in product(*repeat([1, 10, 500], count - 1)):
                    existing_numbers = [start]
                    for gap in gaps:
                        existing_numbers.append(existing_numbers[-1] + gap)
                    assert len(existing_numbers) == count

                    for position in range(count + 1):
                        for allow_negative in [False, True]:
                            n += 1

                            new_number, renumberings = insert_number(
                                existing_numbers,
                                position,
                                allow_negative,
                            )

                            # Make the suggested edits don't result in any
                            # collisions
                            order = {
                                n: float(i) for i, n in enumerate(existing_numbers)
                            }
                            for before, after in renumberings:
                                order[after] = order.pop(before)
                            order[new_number] = position - 0.5
                            resulting_order = [order[n] for n in sorted(order)]

                            # No negatives (if reuqired)
                            if not allow_negative:
                                assert all(n >= 0 for n in order)

                            # Check resulting sequence is in-order
                            assert resulting_order == sorted(resulting_order)

                            # Check no collisions caused an entry to go missing
                            assert len(resulting_order) == count + 1

                            # Our new insertion should be in the correct
                            # position in the ordering
                            assert resulting_order[position] == position - 0.5

                            # Sanity check the ordering doesn't have any
                            # extras/missing entries
                            assert set(resulting_order) == (
                                set(range(count)) | {position - 0.5}
                            )
