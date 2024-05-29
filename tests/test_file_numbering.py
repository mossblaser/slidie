import pytest

from pathlib import Path

from itertools import product, repeat

from slidie.file_numbering import (
    InvalidNumericalPrefixError,
    extract_numerical_prefix,
    extract_numerical_prefix_str,
    replace_numerical_prefix,
    DuplicateSlideNumberError,
    NoSlidesFoundError,
    enumerate_slides,
    evenly_spaced_numbers_between,
    NoFreeNumberError,
    NegativeNumberError,
    try_insert_numbers,
    Renumbering,
    Insertion,
    insert_numbers,
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
        with pytest.raises(InvalidNumericalPrefixError):
            extract_numerical_prefix(filename)


@pytest.mark.parametrize(
    "filename, exp",
    [
        # No number (NB: more thoroughly tested via
        # test_extract_numerical_prefix)
        (Path("foo"), None),
        # Plain numbers
        (Path("123-foo.svg"), "123"),
        (Path("-321-foo.svg"), "-321"),
        (Path("00100-foo.svg"), "00100"),
        (Path("-00100-foo.svg"), "-00100"),
        (Path("+00100-foo.svg"), "+00100"),
    ],
)
def test_extract_numerical_prefix_str(filename: Path, exp: str | None) -> None:
    if exp is not None:
        assert extract_numerical_prefix_str(filename) == exp
    else:
        with pytest.raises(InvalidNumericalPrefixError):
            extract_numerical_prefix_str(filename)


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


@pytest.mark.parametrize(
    "filenames, exp",
    [
        # Empty directory
        ([], NoSlidesFoundError),
        # Single file
        (["0.svg"], ["0.svg"]),
        # Verify ordering is numerical
        (["1.svg", "11.svg", "2.svg"], ["1.svg", "2.svg", "11.svg"]),
        # Should ignore non-SVGs
        (["0.svg", "foo.txt"], ["0.svg"]),
        # Reject files without numbers
        (["0.svg", "foo.svg"], InvalidNumericalPrefixError),
        # Reject files with duplicate numbers
        (["0.svg", "00-foo.svg"], DuplicateSlideNumberError),
    ],
)
def test_enumerate_slides(
    filenames: list[str], exp: list[str] | type[Exception], tmp_path: Path
) -> None:
    for filename in filenames:
        (tmp_path / filename).touch()

    if isinstance(exp, list):
        assert [f.name for f in enumerate_slides(tmp_path)] == exp
    else:
        with pytest.raises(exp):
            enumerate_slides(tmp_path)


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


class TestTryInsertNumbers:
    @pytest.mark.parametrize("position", [-1, 4])
    def test_invalid_position(self, position: int) -> None:
        with pytest.raises(IndexError):
            try_insert_numbers([100, 200, 300], position, 1)

    @pytest.mark.parametrize(
        "existing_numbers, position, count, allow_negative, exp",
        [
            # Cases with negative numbers not required or used (i.e.
            # allow_negative should have no effect)
            (existing_numbers, position, count, allow_negative, exp)
            for existing_numbers, position, count, exp in [
                # Empty
                ([], 0, 1, [100]),
                ([], 0, 3, [100, 200, 300]),
                # Append
                ([500], 1, 1, [600]),
                ([100, 500], 2, 1, [600]),
                ([500], 1, 3, [600, 700, 800]),
                # Insert between (not tight)
                ([10, 20], 1, 1, [15]),
                ([10, 20, 30], 1, 1, [15]),
                ([9, 10, 20, 30], 2, 1, [15]),
                ([10, 20], 1, 4, [12, 14, 16, 18]),
                # Insert between (tight fit)
                ([10, 12], 1, 1, [11]),
                ([10, 15], 1, 4, [11, 12, 13, 14]),
                # Insert between (tightish fit)
                ([10, 13], 1, 1, [11]),
                ([10, 15], 1, 3, [11, 12, 13]),
            ]
            for allow_negative in [False, True]
        ]
        + [
            # Cases where the specific negative number mode matters
            #
            # Insert at start
            ([-1], 0, 1, True, [-101]),
            ([-1, 1], 0, 1, True, [-101]),
            ([-1], 0, 3, True, [-301, -201, -101]),
            # Insert at start, when +ve only split between 0 and number
            ([500], 0, 1, False, [249]),
            ([500], 0, 4, False, [99, 199, 299, 399]),
            # Insert at start, only just room whilst positive
            ([1], 0, 1, False, [0]),
            ([2], 0, 2, False, [0, 1]),
            # Insert at start near zero, negative allowed
            ([1], 0, 1, True, [-99]),
            ([1], 0, 3, True, [-299, -199, -99]),
        ],
    )
    def test_possible(
        self,
        existing_numbers: list[int],
        position: int,
        count: int,
        allow_negative: bool,
        exp: list[int],
    ) -> None:
        assert (
            try_insert_numbers(existing_numbers, position, count, allow_negative) == exp
        )

    @pytest.mark.parametrize(
        "existing_numbers, position, count, allow_negative",
        [
            # No space between
            ([10, 11], 1, 1, True),
            ([10, 11], 1, 1, False),
            ([10, 11], 1, 3, True),
            ([10, 11], 1, 3, False),
            ([10, 13], 1, 3, True),
            ([10, 13], 1, 3, False),
            # No space before (and negative numbers not allowed)
            ([0], 0, 1, False),
            ([2], 0, 3, False),
        ],
    )
    def test_impossible(
        self,
        existing_numbers: list[int],
        position: int,
        count: int,
        allow_negative: bool,
    ) -> None:
        with pytest.raises(NoFreeNumberError):
            try_insert_numbers(existing_numbers, position, count, allow_negative)

    def test_negative_check(self) -> None:
        with pytest.raises(NegativeNumberError):
            try_insert_numbers([-1], 0, 1, allow_negative=False)


class TestInsertNumbers:
    @pytest.mark.parametrize(
        "existing_numbers, position, count, allow_negative, exp",
        [
            # Empty
            ([], 0, 1, False, ([], [100])),
            ([], 0, 1, True, ([], [100])),
            ([], 0, 3, True, ([], [100, 200, 300])),
            # Append
            ([100], 1, 1, False, ([], [200])),
            ([100], 1, 1, True, ([], [200])),
            ([100], 1, 3, True, ([], [200, 300, 400])),
            # Insert (space available)
            ([100, 200], 1, 1, False, ([], [150])),
            ([100, 200], 1, 1, True, ([], [150])),
            ([100, 200], 1, 3, False, ([], [125, 150, 175])),
            ([100, 200], 1, 3, True, ([], [125, 150, 175])),
            # Insert below zero, negative allowed
            ([0], 0, 1, True, ([], [-100])),
            ([0], 0, 3, True, ([], [-300, -200, -100])),
            # Dense, insert near end (should favour pushing to end)
            (
                [1, 2, 3, 4, 5],
                3,
                1,
                True,
                ([(5, 303), (4, 203)], [103]),
            ),
            (
                [1, 2, 3, 4, 5],
                3,
                3,
                True,
                ([(5, 503), (4, 403)], [103, 203, 303]),
            ),
            # Dense, insert near start, negatives allowed (should favour pushing to start)
            (
                [1, 2, 3, 4, 5],
                1,
                1,
                True,
                ([(1, -198)], [-98]),
            ),
            (
                [1, 2, 3, 4, 5],
                1,
                3,
                True,
                ([(1, -398)], [-298, -198, -98]),
            ),
            # Dense, insert near start, negatives disallowed (should favour pushing to start)
            (
                [1, 2, 3, 4, 5],
                1,
                1,
                False,
                ([(1, 0)], [1]),
            ),
            (
                [3, 4, 5, 6, 7],
                1,
                3,
                False,
                ([(3, 0)], [1, 2, 3]),
            ),
            # Dense, insert near start, negatives disallowed but no space at
            # start so forced to push everything up instead
            (
                [0, 1, 2, 3, 4, 5],
                1,
                1,
                False,
                ([(5, 600), (4, 500), (3, 400), (2, 300), (1, 200)], [100]),
            ),
            (
                [0, 1, 2, 3, 4, 5],
                1,
                3,
                False,
                ([(5, 800), (4, 700), (3, 600), (2, 500), (1, 400)], [100, 200, 300]),
            ),
            # Dense, insert at start, negatives disallowed, push everything up
            (
                [0, 1, 2, 3, 4, 5],
                0,
                1,
                False,
                ([(5, 700), (4, 600), (3, 500), (2, 400), (1, 300), (0, 200)], [100]),
            ),
            (
                [0, 1, 2, 3, 4, 5],
                0,
                3,
                False,
                (
                    [(5, 900), (4, 800), (3, 700), (2, 600), (1, 500), (0, 400)],
                    [100, 200, 300],
                ),
            ),
            # Dense, insert near start, negatives allowed: should push down
            (
                [0, 1, 2, 3, 4, 5],
                1,
                1,
                True,
                ([(0, -199)], [-99]),
            ),
            # When equal changes required on either side (in this case two
            # edits), pick option with largest gaps (which here is the
            # leading numbers since after spacing between 0 and 301 we end up
            # with larger gaps (>100) than renumbering the trailing numbers
            # (with a fixed gap of 100 each)
            (
                [998, 999, 1000, 1001],
                2,
                1,
                False,
                ([(998, 249), (999, 499)], [749]),
            ),
            (
                [998, 999, 1000, 1001],
                2,
                3,
                False,
                ([(998, 165), (999, 332)], [499, 666, 833]),
            ),
        ],
    )
    def test_cases(
        self,
        existing_numbers: list[int],
        position: int,
        count: int,
        allow_negative: bool,
        exp: tuple[list[tuple[int, int]], list[int]],
    ) -> None:
        result = insert_numbers(
            existing_numbers,
            position,
            count,
            allow_negative,
        )
        exp_insertion = Insertion(
            renumberings=[Renumbering(old, new) for old, new in exp[0]],
            new_numbers=exp[1],
        )

        assert set(result.renumberings) == set(exp_insertion.renumberings)
        assert len(result.renumberings) == len(exp_insertion.renumberings)

        assert result.new_numbers == exp_insertion.new_numbers

    def test_exhaustive(self) -> None:
        # A relatively exhaustive test of modest length numberings and
        # insertion combinations. Just sanity checks the output meets all of
        # the supposed requirements. (Does not check for optimality of
        # solution, however!)
        for existing_count in range(1, 6):
            for count in range(1, 3):
                for start in [0, 1, 10, 1000]:
                    for gaps in product(*repeat([1, 10, 500], existing_count - 1)):
                        existing_numbers = [start]
                        for gap in gaps:
                            existing_numbers.append(existing_numbers[-1] + gap)
                        assert len(existing_numbers) == existing_count

                        for position in range(existing_count + 1):
                            for allow_negative in [False, True]:
                                result = insert_numbers(
                                    existing_numbers,
                                    position,
                                    count,
                                    allow_negative,
                                )

                                assert len(result.new_numbers) == count

                                # Check renumberings don't mess up the order
                                order = {
                                    n: float(i) for i, n in enumerate(existing_numbers)
                                }
                                to_reinsert = [
                                    (new, order.pop(old))
                                    for old, new in result.renumberings
                                ]
                                for new, n in to_reinsert:
                                    order[new] = n
                                for i, new_number in enumerate(result.new_numbers):
                                    order[new_number] = (
                                        position - 1 + ((i + 1) / (count + 1))
                                    )
                                resulting_order = [order[n] for n in sorted(order)]

                                # No negatives (if reuqired)
                                if not allow_negative:
                                    assert all(n >= 0 for n in order)

                                # Check resulting sequence is in-order
                                assert resulting_order == sorted(resulting_order)

                                # Check no collisions caused an entry to go missing
                                assert len(resulting_order) == existing_count + count

                                # Our new insertions should be in the correct
                                # position in the ordering
                                assert resulting_order[position : position + count] == [
                                    position - 1 + ((i + 1) / (count + 1))
                                    for i in range(count)
                                ]
