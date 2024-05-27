import pytest

from typing import cast

from itertools import permutations
import json

from svgs import get_svg

from slidie.builds import (
    NumericStep,
    Plus,
    Dot,
    Start,
    End,
    Range,
    InputStep,
    Stage1Step,
    Stage2Step,
    Stage2Atom,
    Stage3Step,
    LayerNameParseError,
    UnexpectedTagSuffixError,
    InvalidStepError,
    parse_build_specification_step,
    parse_build_specification,
    parse_tags,
    resolve_step_auto,
    get_first_numeric_step,
    resolve_autos,
    iter_referenced_tags,
    IdentifierNotFoundError,
    CyclicDependencyError,
    compute_tag_resolution_order,
    resolve_tag_suffix,
    resolve_step_tag,
    resolve_tags,
    resolve_step_bound,
    resolve_bounds,
    resolve_ranges,
    normalise_specs,
    evaluate_build_steps,
)


class TestParseBuildSpecificationStep:
    @pytest.mark.parametrize(
        "spec, exp",
        [
            ("0", 0),
            ("123", 123),
            ("@foo", "foo"),
            ("@foo.before", ("foo", "before")),
            ("@foo.start", ("foo", "start")),
            ("@foo.end", ("foo", "end")),
            ("@foo.after", ("foo", "after")),
            ("+", Plus()),
            (".", Dot()),
            ("", Start()),
        ],
    )
    def test_valid(self, spec: str, exp: InputStep) -> None:
        assert parse_build_specification_step(spec, Start()) == exp

    @pytest.mark.parametrize(
        "spec",
        [
            # No empty spec specified in call to parse_build_specification_step
            "",
            # Invalid name
            "@",
            "@ foo",
            # Invalid suffix
            "@foo.bar",
            # Non-numerical
            "fooA",
            "++",
            "..",
            # Not a non-negative integer
            "1.2",
            "-1",
        ],
    )
    def test_invalid(self, spec: str) -> None:
        with pytest.raises(LayerNameParseError):
            parse_build_specification_step(spec)

    def test_invalid_suffix(self) -> None:
        with pytest.raises(UnexpectedTagSuffixError) as excinfo:
            parse_build_specification_step("@foo.bar")

        assert str(excinfo.value) == "Unexpected suffix 'bar' in step '@foo.bar'."

    def test_invalid_step(self) -> None:
        with pytest.raises(InvalidStepError) as excinfo:
            parse_build_specification_step("woah!")

        assert str(excinfo.value) == "Invalid step specification 'woah!'."


@pytest.mark.parametrize(
    "layer_name, exp",
    [
        # No specs = full range
        ("", None),
        ("foo", None),
        ("foo <", None),
        # Explicitly empty range
        ("foo <>", []),
        ("foo < >", []),
        # Simple specs and whitespace
        ("foo <1>", [1]),
        ("foo <1,2,3>", [1, 2, 3]),
        ("foo < 1 , 2 , 3 >", [1, 2, 3]),
        # Ranges
        ("foo <1-2>", [Range(1, 2)]),
        ("foo <1->", [Range(1, End())]),
        ("foo <-2>", [Range(Start(), 2)]),
        # Merge multiple specs
        ("foo <1> <2,3>", [1, 2, 3]),
    ],
)
def test_parse_build_specification(
    layer_name: str, exp: list[InputStep] | None
) -> None:
    assert parse_build_specification(layer_name) == exp


@pytest.mark.parametrize(
    "layer_name, exp",
    [
        # No identifiers
        ("", set()),
        ("foo", set()),
        # Decoy! identifier within spec is not an identifier for this layer!
        ("foo <@foo>", set()),
        # Not valid identifiers
        ("foo @", set()),
        ("foo @ bar", set()),
        ("foo @bar.baz", set()),
        # Valid identifiers
        ("foo @bar", {"bar"}),
        ("foo @bar baz", {"bar"}),
        # Multiple identifiers
        ("foo @bar @baz", {"bar", "baz"}),
        ("foo @bar@baz", {"bar", "baz"}),
    ],
)
def test_parse_tags(layer_name: str, exp: set[str]) -> None:
    assert parse_tags(layer_name) == exp


@pytest.mark.parametrize(
    "step, exp",
    [
        # Auto numbers turned into numbers
        (Plus(), 101),
        (Dot(), 100),
        # Other primitives just passed through
        (Start(), Start()),
        (End(), End()),
        (123, 123),
        ("foo", "foo"),
        ("foo.start", "foo.start"),
        # Ranges treated recursively
        (Range(Plus(), Dot()), Range(101, 100)),
        (Range(Dot(), Plus()), Range(100, 101)),
        (Range(123, "foo"), Range(123, "foo")),
    ],
)
def test_resolve_step_auto(
    step: InputStep,
    exp: Stage1Step,
) -> None:
    assert resolve_step_auto(step, 100) == exp


@pytest.mark.parametrize(
    "step, exp",
    [
        # Singleton ignored types
        ([Start()], None),
        ([End()], None),
        (["foo"], None),
        # Singleton numeric type
        ([123], 123),
        # First value picked
        ([1, 2, 3], 1),
        ([3, 2, 1], 3),
        # Ignored types ignored if first
        (["foo", 2, 3], 2),
        # Range start picked if numeric, otherwise end if that is numeric
        ([Range(123, 456)], 123),
        ([Range(123, "foo")], 123),
        ([Range("foo", 123)], 123),
        ([Range("foo", "bar")], None),
    ],
)
def test_get_first_numeric_step(step: list[Stage1Step], exp: int | None) -> None:
    assert get_first_numeric_step(step) == exp


@pytest.mark.parametrize(
    "layer_steps, exp",
    [
        # Empty case
        ([], []),
        # Already free of automatic steps
        (["<1>", "<2, @three>"], ["<1>", "<2, @three>"]),
        # Simple case
        (
            [
                "<+>",
                "<.>",
                "<.>",
                "<+>",
                "<.>",
                "<.>",
            ],
            [
                "<1>",
                "<1>",
                "<1>",
                "<2>",
                "<2>",
                "<2>",
            ],
        ),
        # Interleaved unnumbered steps
        (
            [
                "<+>",
                "<->",
                "<.>",
                "<+>",
                "<@foo>",
                "<.>",
            ],
            [
                "<1>",
                "<->",
                "<1>",
                "<2>",
                "<@foo>",
                "<2>",
            ],
        ),
        # Ranges
        (
            [
                "<-3>",
                "<+->",
                "<1->",
                "<-.>",
            ],
            [
                "<-3>",
                "<4->",
                "<1->",
                "<-1>",
            ],
        ),
    ],
)
def test_resolve_autos(layer_steps: list[str], exp: list[str]) -> None:
    assert resolve_autos(
        [cast(list[InputStep], parse_build_specification(spec)) for spec in layer_steps]
    ) == [cast(list[Stage1Step], parse_build_specification(spec)) for spec in exp]


@pytest.mark.parametrize(
    "spec, exp",
    [
        # Empty case
        ("<>", []),
        # No named values
        ("<.-+, 123>", []),
        # Some names
        ("<@foo>", ["foo"]),
        ("<@foo, @bar>", ["foo", "bar"]),
        # With suffixies
        ("<@foo.start>", ["foo"]),
        # Within ranges
        ("<@foo-@bar>", ["foo", "bar"]),
    ],
)
def test_iter_referenced_tags(spec: str, exp: list[str]) -> None:
    assert (
        list(
            iter_referenced_tags(
                cast(list[Stage1Step], parse_build_specification(spec))
            )
        )
        == exp
    )


class TestComputeTagResolutionOrder:
    def test_empty(self) -> None:
        assert compute_tag_resolution_order([]) == []

    def test_missing_dependency(self) -> None:
        with pytest.raises(IdentifierNotFoundError) as exc_info:
            assert compute_tag_resolution_order(
                [
                    (set(), {"foo"}),
                    ({"bar"}, set()),
                ]
            )

        assert exc_info.value.identifier == "foo"
        assert exc_info.value.layer_index == 0

    def test_cyclic_dependency_self(self) -> None:
        with pytest.raises(CyclicDependencyError) as exc_info:
            assert compute_tag_resolution_order(
                [
                    ({"foo"}, {"foo"}),
                ]
            )

        assert exc_info.value.layer_indices == [0, 0]

    def test_cyclic_dependency_self_and_other(self) -> None:
        with pytest.raises(CyclicDependencyError) as exc_info:
            assert compute_tag_resolution_order(
                [
                    ({"foo"}, {"foo", "bar"}),
                    ({"bar"}, set()),
                ]
            )

        assert exc_info.value.layer_indices == [
            0,
            0,
        ] or exc_info.value.layer_indices == [0, 1, 0]

    def test_cyclic_dependency_multiple_steps(self) -> None:
        with pytest.raises(CyclicDependencyError) as exc_info:
            assert compute_tag_resolution_order(
                [
                    ({"l0"}, {"l1"}),
                    ({"l1"}, {"l2"}),
                    ({"l2"}, {"l3"}),
                    ({"l3"}, {"l0"}),
                ]
            )

        assert exc_info.value.layer_indices == [0, 1, 2, 3, 0]

    def test_cyclic_dependency_multiple_steps_but_not_all(self) -> None:
        with pytest.raises(CyclicDependencyError) as exc_info:
            assert compute_tag_resolution_order(
                [
                    ({"l0"}, {"l1"}),
                    ({"l1"}, {"l2"}),
                    ({"l2"}, {"l3"}),
                    ({"l3"}, {"l1"}),
                ]
            )

        assert exc_info.value.layer_indices == [1, 2, 3, 1]

    @pytest.mark.parametrize(
        "layer_names",
        # NB: We try all permutations of layer orderings to ensure the
        # algorithm isn't order dependent
        (
            layers
            for case in [
                # No dependencies
                ["<>", "<>"],
                ["<->", "<->"],
                ["<+>", "<+>"],
                # Singular dependency
                ["<@foo>", "@foo <->"],
                # Chain
                ["<@foo>", "@foo <@bar>", "@bar <->"],
                # Tree
                ["<@foo, @bar>", "@foo <->", "@bar <->"],
                # Diamond
                ["<@foo, @bar>", "@foo <@baz>", "@bar <@baz>", "@baz <->"],
                # Multiple aliases referenced
                ["<@foo, @bar>", "@foo @bar <->"],
            ]
            for layers in permutations(case)
        ),
    )
    def test_orderings(self, layer_names: list[str]) -> None:
        layer_identifiers = [parse_tags(n) for n in layer_names]
        layer_dependency_names = [
            set(
                iter_referenced_tags(
                    cast(list[Stage1Step], parse_build_specification(n))
                )
            )
            for n in layer_names
        ]

        ordering = compute_tag_resolution_order(
            list(zip(layer_identifiers, layer_dependency_names))
        )

        # Check all layers appear in the ordering exactly once
        assert set(ordering) == set(range(len(layer_names)))
        assert len(ordering) == len(layer_names)

        # Check dependencies are always processed before dependents
        name_to_index = {
            name: index
            for index, names in enumerate(layer_identifiers)
            for name in names
        }
        for index in range(len(layer_names)):
            for dep_name in layer_dependency_names[index]:
                dep_index = name_to_index[dep_name]
                assert ordering.index(dep_index) < ordering.index(index)


@pytest.mark.parametrize(
    "spec, suffix, exp",
    [
        # .start
        ([], "start", None),
        ([1, 2, 3], "start", 1),
        ([3, 2, 1], "start", 1),
        ([Start(), 1, 2, 3], "start", Start()),
        ([1, 2, 3, End()], "start", 1),
        ([End()], "start", End()),
        # .before
        ([], "before", None),
        ([1, 2, 3], "before", 0),
        ([3, 2, 1], "before", 0),
        ([Start(), 1, 2, 3], "before", Start()),
        ([1, 2, 3, End()], "before", 0),
        ([End()], "before", End()),
        # .end
        ([], "end", None),
        ([1, 2, 3], "end", 3),
        ([3, 2, 1], "end", 3),
        ([Start(), 1, 2, 3], "end", 3),
        ([1, 2, 3, End()], "end", End()),
        ([Start()], "end", Start()),
        # .after
        ([], "after", None),
        ([1, 2, 3], "after", 4),
        ([3, 2, 1], "after", 4),
        ([Start(), 1, 2, 3], "after", 4),
        ([1, 2, 3, End()], "after", End()),
        ([Start()], "after", Start()),
    ],
)
def test_resolve_tag_suffix(
    spec: list[Stage2Step],
    suffix: str,
    exp: Stage2Atom | None,
) -> None:
    assert resolve_tag_suffix(spec, suffix) == exp


@pytest.mark.parametrize(
    "step, exp",
    [
        # Pass-through general values
        (1, [1]),
        (Start(), [Start()]),
        (End(), [End()]),
        # Substitute bare name for all items
        ("empty", []),  # To empty
        ("one_two_three", [1, 2, 3]),  # To multiple
        ("start_two_end", [Start(), 2, End()]),  # To bounded
        # Substitute suffixes
        (("one_two_three", "before"), [0]),
        (("one_two_three", "end"), [3]),
        # Range start position: Defaults to start
        (Range("one_two_three", 4), [Range(1, 4)]),
        # Range start position: Suffix can be overridden
        (Range(("one_two_three", "end"), 4), [Range(3, 4)]),
        # Range start position: Empty start resolves to absent
        (Range("empty", 4), []),
        # Range end position: Defaults to end
        (Range(0, "one_two_three"), [Range(0, 3)]),
        # Range end position: Suffix can be overridden
        (Range(0, ("one_two_three", "start")), [Range(0, 1)]),
        # Range end position: Empty start resolves to absent
        (Range(0, "empty"), []),
    ],
)
def test_resolve_step_tag(step: Stage1Step, exp: list[Stage2Step]) -> None:
    resolved_names: dict[str, list[Stage2Step]] = {
        "empty": [],
        "one_two_three": [1, 2, 3],
        "just_start": [Start()],
        "just_end": [End()],
        "start_two_end": [Start(), 2, End()],
    }
    assert resolve_step_tag(step, resolved_names) == exp


@pytest.mark.parametrize(
    "layers, exp",
    [
        # Empty
        ([], []),
        # Simple chain substitution (order independent)
        (["<@foo, 2>", "@foo <1>"], ["<1, 2>", "<1>"]),
        (["@foo <1>", "<@foo, 2>"], ["<1>", "<1, 2>"]),
        # Reference multiple items sharing a name
        (["<@foo, 3>", "@foo <1>", "@foo <2>"], ["<1, 2, 3>", "<1>", "<2>"]),
        # Multiple names for same thing
        (["<@foo, 2>", "<@bar, 3>", "@foo @bar <1>"], ["<1, 2>", "<1, 3>", "<1>"]),
    ],
)
def test_resolve_tags(layers: list[str], exp: list[str]) -> None:
    layer_identifiers = [parse_tags(layer) for layer in layers]
    layer_steps = [
        cast(list[Stage1Step], parse_build_specification(layer)) for layer in layers
    ]

    exp_steps = [
        cast(list[Stage2Step], parse_build_specification(layer)) for layer in exp
    ]

    assert resolve_tags(layer_identifiers, layer_steps) == exp_steps


@pytest.mark.parametrize(
    "step, exp",
    [
        # Pass through numeric values unchanged
        (123, 123),
        (Range(12, 34), Range(12, 34)),
        # Substitute Start
        (Start(), 1),
        (Range(Start(), 999), Range(1, 999)),
        (Range(999, Start()), Range(999, 1)),
        # Substitute End
        (End(), 2),
        (Range(End(), 999), Range(2, 999)),
        (Range(999, End()), Range(999, 2)),
    ],
)
def test_resolve_step_bound(step: Stage2Step, exp: Stage3Step) -> None:
    assert resolve_step_bound(step, 1, 2) == exp


@pytest.mark.parametrize(
    "layers, exp",
    [
        # Empty
        ([], []),
        (["<>"], ["<>"]),
        # No steps listed, should resolve to 0
        (["<->"], ["<0-0>"]),
        # Single number listed should resolve as start/end, even if in a range
        (["<->", "<99>"], ["<0-99>", "<99>"]),
        (["<->", "<-99>"], ["<0-99>", "<0-99>"]),
        (["<->", "<99->"], ["<0-99>", "<99-99>"]),
        # Pull start/end appart
        (["<11>", "<99>", "<->"], ["<11>", "<99>", "<0-99>"]),
        (["<11-99>", "<->"], ["<11-99>", "<0-99>"]),
        # Should be taking min/max not first/last
        (["<1>", "<3>", "<2>", "<->"], ["<1>", "<3>", "<2>", "<0-3>"]),
        # Shouldn't fall over on layer with empty spec
        (["<->", "<>"], ["<0-0>", "<>"]),
    ],
)
def test_resolve_bounds(layers: list[str], exp: list[str]) -> None:
    layer_steps = [
        cast(list[Stage2Step], parse_build_specification(layer)) for layer in layers
    ]
    exp_steps = [
        cast(list[Stage3Step], parse_build_specification(layer)) for layer in exp
    ]

    assert resolve_bounds(layer_steps) == exp_steps


@pytest.mark.parametrize(
    "layers, exp",
    [
        # Empty
        ([], []),
        # Pass-through numeric values as is
        (["<123>"], ["<123>"]),
        # Singleton range
        (["<1-1>"], ["<1>"]),
        # Multiple entry range
        (["<1-3>"], ["<1, 2, 3>"]),
        # Reverse-entry becomes empty
        (["<3-1>"], ["<>"]),
        # Expanded within other values
        (["<0, 1-3, 4>"], ["<0, 1, 2, 3, 4>"]),
    ],
)
def test_resolve_ranges(layers: list[str], exp: list[str]) -> None:
    layer_steps = [
        cast(list[Stage3Step], parse_build_specification(layer)) for layer in layers
    ]
    exp_steps = [
        cast(list[NumericStep], parse_build_specification(layer)) for layer in exp
    ]

    assert resolve_ranges(layer_steps) == exp_steps


@pytest.mark.parametrize(
    "layers, exp",
    [
        # Empty
        ([], []),
        # Sort
        (["<1>"], ["<1>"]),
        (["<1, 3, 2>"], ["<1, 2, 3>"]),
        # De-duplicate
        (["<1, 3, 2, 3>"], ["<1, 2, 3>"]),
    ],
)
def test_normalise_specs(layers: list[str], exp: list[str]) -> None:
    layer_steps = [
        cast(list[NumericStep], parse_build_specification(layer)) for layer in layers
    ]
    exp_steps = [
        cast(list[NumericStep], parse_build_specification(layer)) for layer in exp
    ]

    assert normalise_specs(layer_steps) == exp_steps


class TestEvaluateBuildSteps:
    def test_integration(self) -> None:
        assert evaluate_build_steps(
            [
                "A <2> @foo",
                "B <+>",
                "C <@foo>",
                "D <->",
                # Test handling of absent specs
                "E @bar",
                # Test reference to absent spec = always visible
                "F <@bar>",
            ]
        ) == [
            ([2], {"foo"}),
            ([3], set()),
            ([2], set()),
            ([0, 1, 2, 3], set()),
            (None, {"bar"}),
            ([0, 1, 2, 3], set()),
        ]

    def test_identifier_not_found_layer_names(self) -> None:
        with pytest.raises(IdentifierNotFoundError) as exc_info:
            evaluate_build_steps(["Who knows what <@foo> is?"])

        assert exc_info.value.layer_name == "Who knows what <@foo> is?"
        assert str(exc_info.value) == (
            "Undefined tag '@foo' used in 'Who knows what <@foo> is?'."
        )

    def test_cyclic_dependency_error(self) -> None:
        with pytest.raises(CyclicDependencyError) as exc_info:
            evaluate_build_steps(
                [
                    "A <@b> @a",
                    "B <@c> @b",
                    "C <@a> @c",
                ]
            )

        assert exc_info.value.layer_names == [
            "A <@b> @a",
            "B <@c> @b",
            "C <@a> @c",
            "A <@b> @a",
        ]
        assert str(exc_info.value) == (
            "Cyclic dependency in tag references:\n"
            "   'A <@b> @a'\n"
            "-> 'B <@c> @b'\n"
            "-> 'C <@a> @c'\n"
            "-> 'A <@b> @a'."
        )
