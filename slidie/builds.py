"""
Parsing and evaluation of slide build specifications. That is, the
specifications which control how elements of the slide are revealed (or hidden)
step by step to illustrate some point over time.

The :py:func:`evaluate_build_steps` function in this module takes a list of
layer names and returns selected step numbers during which each slide is
visible.

See :ref:`builds` for an introduction to the syntax and user-facing concepts.

At a high level, build specifications are parsed and then resolved from their
initial, more abstract form (containing things like ranges, '+' and '@tag'
references) into a concrete list of step numbers.

Before getting started, lets define a few extra terms:

* A *spec* (build specification) consists of a list of steps
* A *step* may be one of the following:
  * A *numeric* value
  * An *auto* (automatically numbered) value, i.e. '+' or '.'.
  * A *tag* (a reference to a tag with no suffix added)
  * A *tag-and-suffix* (a reference to a tag with some suffix)
  * A *bound* referencing either the very first or very last step
  * A *range* which references all of the steps between a start and end,
    inclusively.
* An *atom* is any kind of step except a range (whose start and end steps are
  always defined by an atom).

The spec resolution process is performed in a series of distinct (numbered)
stages:

1. First, automatic step numbers (i.e. '+' and '.') are resolved
2. Next references to tags (e.g. '@foo' or '@foo.start') are resolved
3. Then the bounds (i.e. first/last step number) are resolved
4. Finally, ranges are expanded into concrete lists of step numbers
"""


from typing import cast, overload, TypeVar, Generic, Iterator, Any, Sequence

from dataclasses import dataclass
from collections import defaultdict
from functools import total_ordering

import re


################################################################################
# Atomic step type definitions
################################################################################


NumericStep = int


@dataclass
class Plus:
    """Representation of a '+' automatic numbering step."""

    pass


@dataclass
class Dot:
    """Representation of a '.' automatic numbering step."""

    pass


AutoStep = Plus | Dot


@dataclass
@total_ordering
class Start:
    """
    Representation of the 'first step' bound reference. Sorts before any int value.
    """

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, type(self)):
            return True
        else:
            return False

    def __lt__(self, other: Any) -> bool:
        if isinstance(other, Start):
            return False
        else:
            return True


@dataclass
@total_ordering
class End:
    """
    Representation of the 'last step' bound reference. Sorts after any int value.
    """

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, type(self)):
            return True
        else:
            return False

    def __gt__(self, other: Any) -> bool:
        if isinstance(other, End):
            return False
        else:
            return True


BoundStep = Start | End


TagStep = str | tuple[str, str]
"""
Representation of a tag step.

For tag references without a suffix, the bare string is used (with the leading
'@' stripped off). 

For tag references with a suffix, a tuple of strings (tag, suffix).
"""


################################################################################
# Aggregate atom and step types
################################################################################


InputAtom = BoundStep | NumericStep | AutoStep | TagStep
Stage1Atom = BoundStep | NumericStep | TagStep
Stage2Atom = BoundStep | NumericStep
Stage3Atom = NumericStep
Stage4Atom = NumericStep  # Included for completenes...


T = TypeVar("T", bound=InputAtom)


@dataclass(frozen=True)
class Range(Generic[T]):
    """Represents a continuous range of steps between start and end, inclusive."""

    start: T
    end: T


InputStep = InputAtom | Range[InputAtom]
Stage1Step = Stage1Atom | Range[Stage1Atom]
Stage2Step = Stage2Atom | Range[Stage2Atom]
Stage3Step = Stage3Atom | Range[Stage3Atom]
Stage4Step = Stage4Atom  # Included for completeness


################################################################################
# Layer name parsing routines
################################################################################


@dataclass
class LayerNameParseError(Exception):
    """Thrown when an annotation in a layer name is not parsable."""


@dataclass
class UnexpectedTagSuffixError(LayerNameParseError):
    """Thrown when an unrecognised tag suffix is used."""

    step: str
    """The step definition."""

    suffix: str
    """The unrecognised suffix."""

    def __str__(self) -> str:
        return f"Unexpected suffix '{self.suffix}' in step '{self.step}'."


@dataclass
class InvalidStepError(LayerNameParseError):
    """Thrown when a step in a build specification is not valid."""

    step: str
    """The invalid step definition."""

    def __str__(self) -> str:
        return f"Invalid step specification '{self.step}'."


def parse_build_specification_step(
    step_str: str, empty_value: BoundStep | None = None
) -> InputAtom:
    """
    Parse a single step (e.g. '123', '+', '.', '@foo').

    If empty_value is not None, an empty string is parsed as that value.
    """
    step_str = step_str.strip()
    if re.fullmatch(r"@[^\s]+", step_str):
        name, dot, suffix = step_str[1:].partition(".")
        if dot:
            if suffix not in ("before", "start", "end", "after"):
                raise UnexpectedTagSuffixError(step_str, suffix)
            return (name, suffix)
        else:
            return name
    elif step_str == "+":
        return Plus()
    elif step_str == ".":
        return Dot()
    elif step_str == "" and empty_value is not None:
        return empty_value
    elif re.fullmatch(r"[0-9]+", step_str):
        return int(step_str)
    else:
        raise InvalidStepError(step_str)


def parse_build_specification(layer_name: str) -> list[InputStep] | None:
    """
    Parse the build specifications within a layer name.

    If one ore more is given, the steps within them will be concatenated into a
    single list and returned.

    If none are present, returns None.
    """
    try:
        build_specification: list[InputStep] = []

        contains_build_specification = False
        for match in re.findall(r"<[^>]*>", layer_name):
            contains_build_specification = True

            if steps_str := match[1:-1].strip():
                for step_or_range_str in steps_str.split(","):
                    if "-" in step_or_range_str:
                        start_str, _, end_str = step_or_range_str.partition("-")
                        build_specification.append(
                            Range(
                                parse_build_specification_step(start_str, Start()),
                                parse_build_specification_step(end_str, End()),
                            )
                        )
                    else:
                        build_specification.append(
                            parse_build_specification_step(step_or_range_str)
                        )

        if contains_build_specification:
            return build_specification
        else:
            return None
    except Exception as exc:
        exc.add_note(f"While parsing layer named '{layer_name}'")
        raise


def parse_tags(layer_name: str) -> set[str]:
    """
    Parse tags within a layer name.
    """
    # Remove build specifications from layer name since these may contain
    # references to tags which would confuse matters!
    layer_name = re.sub(r"<[^>]+>", "", layer_name)

    return set(re.findall(r"@([^\s<>.@]+)(?=\s|@|$)", layer_name))


################################################################################
# Stage 1: Resolving automatically numbered steps (autos)
################################################################################


@overload
def resolve_step_auto(step: InputAtom, last_number: int) -> Stage1Atom:
    ...


@overload
def resolve_step_auto(step: InputStep, last_number: int) -> Stage1Step:
    ...


def resolve_step_auto(step: InputStep, last_number: int) -> Stage1Step:
    """
    Resolve automatic numbering steps (i.e. Plus() and Dot()) into numeric
    steps.
    """
    match step:
        case Plus():
            return last_number + 1
        case Dot():
            return last_number
        case Range(start, end):
            return Range(
                resolve_step_auto(start, last_number),
                resolve_step_auto(end, last_number),
            )
        case _:
            return step


def get_first_numeric_step(steps: list[Stage1Step]) -> int | None:
    """
    Get the first (in terms of position, not value) numbered step to appear in
    the provided list of steps.  Returns None if no numbered steps exist.
    """
    for step in steps:
        match step:
            case int():
                return step
            case Range(int(start), _):
                return start
            case Range(_, int(end)):
                return end
            case _:
                pass  # Ignore all other types

    return None


def resolve_autos(layer_specs: list[list[InputStep]]) -> list[list[Stage1Step]]:
    """
    Given a list of parsed layer build specifications (one for each layer in
    the order presented in the Inkscape GUI) resolves '+' and '.' components
    into concrete numeric steps.
    """
    out: list[list[Stage1Step]] = []

    # The step number of the last layer which had one.
    last_number = 0

    for spec in layer_specs:
        new_spec = [resolve_step_auto(step, last_number) for step in spec]
        out.append(new_spec)

        new_number = get_first_numeric_step(new_spec)
        if new_number is not None:
            last_number = new_number

    return out


################################################################################
# Stage 2: Resolving tag references
################################################################################


def iter_referenced_tags(steps: list[Stage1Step]) -> Iterator[str]:
    """
    Enumerate the names of any tags used within a build specification. (Tag
    suffixes are not reported).
    """
    for step in steps:
        match step:
            case str():
                yield step
            case (str(identifier), _):
                yield identifier
            case Range(start, end):
                yield from iter_referenced_tags([start, end])
            case _:
                pass  # Other types are not names


@dataclass
class IdentifierNotFoundError(ValueError):
    """
    Thrown when a name is used in a step which doesn't correspond to any layer.
    """

    identifier: str
    layer_index: int

    # May be populated later
    layer_name: str | None = None

    def __str__(self) -> str:
        loc = ""
        if self.layer_name is not None:
            loc = f" used in '{self.layer_name}'"
        return f"Undefined tag '@{self.identifier}'{loc}."


@dataclass
class CyclicDependencyError(ValueError):
    """
    Thrown when a a series of names form a cyclic dependency
    """

    layer_indices: list[int]

    # May be populated later
    layer_names: list[str] | None = None

    def __str__(self) -> str:
        layers = ""
        if self.layer_names is not None:
            layers = ":\n   " + "\n-> ".join(f"'{n}'" for n in self.layer_names)
        return f"Cyclic dependency in tag references{layers}."


def compute_tag_resolution_order(
    layer_tags_and_dependencies: list[tuple[set[str], set[str]]],
) -> list[int]:
    """
    Return an ordering of layers to process which ensures that each layer is
    processed before any other layer which depends on it.

    Takes a list of (tags, dependencies) tuples which give, for each layer, the
    tags given to that layer and the tags of layers that layer depends on.

    Returns a list of layer indices in an order which ensures dependencies are
    processed before their dependants.
    """
    # Map tags to indices
    tag_to_indices: dict[str, set[int]] = defaultdict(set)
    for i, (tags, _deps) in enumerate(layer_tags_and_dependencies):
        for tag in tags:
            tag_to_indices[tag].add(i)

    # Create an index-based dependency graph (checking all dependencies exist
    # as we go)
    index_to_deps: dict[int, set[int]] = defaultdict(set)
    for i, (_tags, deps) in enumerate(layer_tags_and_dependencies):
        for dep in deps:
            if dep not in tag_to_indices:
                raise IdentifierNotFoundError(dep, i)
            index_to_deps[i].update(tag_to_indices[dep])

    # The output ordering
    ordering: list[int] = []

    # We use a simple depth-first traversal through the dependency graph to
    # find our ordering.

    def resolve(index: int, visited_indices: list[int]) -> None:
        # If already resolved, do nothing
        if index in ordering:
            return

        # Check for dependency cycles
        if index in visited_indices:
            loop_indices = visited_indices[visited_indices.index(index) :]
            raise CyclicDependencyError(loop_indices + [index])

        # Process all dependencies first
        for dep_index in index_to_deps[index]:
            resolve(dep_index, visited_indices + [index])

        # Now process this item
        ordering.append(index)

    for i in range(len(layer_tags_and_dependencies)):
        resolve(i, [])

    return ordering


def resolve_tag_suffix(
    referenced_spec: list[Stage2Step],
    suffix: str,
) -> Stage2Atom | None:
    """
    Given the build specification referenced by a tag, resolve this into the
    atom implied by the tag reference's suffix.

    As a special case, returns None when the referenced spec is empty.
    """
    if len(referenced_spec) == 0:
        return None

    # Flatten the spec into individual atoms
    flat_spec = [
        atom
        for step in referenced_spec
        for atom in ([step.start, step.end] if isinstance(step, Range) else [step])
    ]

    if suffix == "start":
        return min(flat_spec)
    elif suffix == "end":
        return max(flat_spec)
    elif suffix == "before":
        match min(flat_spec):
            case int(step):
                return step - 1
            case start_or_end:
                return start_or_end
    elif suffix == "after":
        match max(flat_spec):
            case int(step):
                return step + 1
            case start_or_end:
                return start_or_end
    else:
        # Should be unreachable: The parser should have already rejected all
        # other (invalid) suffixes.
        raise NotImplementedError(suffix)


@overload
def resolve_step_tag(
    step: Stage1Atom,
    resolved_tags: dict[str, list[Stage2Step]],
    _default_suffix: str | None = None,
) -> Sequence[Stage2Atom]:
    ...


@overload
def resolve_step_tag(
    step: Stage1Step,
    resolved_tags: dict[str, list[Stage2Step]],
    _default_suffix: str | None = None,
) -> Sequence[Stage2Step]:
    ...


def resolve_step_tag(
    step: Stage1Step,
    resolved_tags: dict[str, list[Stage2Step]],
    _default_suffix: str | None = None,
) -> Sequence[Stage2Step]:
    """
    Resolve any tags in a step. Note that tags may resolve into more than one
    step so a list of steps is returned.
    """
    # The _default_suffix argument is used internally and specifies the suffix
    # to add to any tag references which don't already have one. This is used
    # to recursively resolve the start/end components of a range step in which
    # `.start` and `.end` are implied if not given.

    if _default_suffix is not None and isinstance(step, str):
        step = (step, _default_suffix)

    match step:
        case str():
            return resolved_tags[step]
        case (str(tag), str(suffix)):
            new_step = resolve_tag_suffix(resolved_tags[tag], suffix)
            if new_step is not None:
                return [new_step]
            else:
                return []
        case Range(start, end):
            # Resolve
            new_start = resolve_step_tag(start, resolved_tags, "start")
            new_end = resolve_step_tag(end, resolved_tags, "end")

            if new_start and new_end:
                assert len(new_start) == 1
                assert len(new_end) == 1
                return [Range(new_start[0], new_end[0])]
            else:
                return []
        case _:
            return [cast(Stage2Step, step)]


def resolve_tags(
    layer_tags: list[set[str]],
    layer_specs: list[list[Stage1Step]],
) -> list[list[Stage2Step]]:
    """
    Resolve all tag references in a set of layer build specifications.

    Parameters
    ==========
    layer_tags : [{tag, ...}, ...]
        For each layer, the tags associated with it.
    layer_specs : [{spec, ...}, ...]
        The build specs of each layer (in the same order as layer_tags).
    """
    # Work out the order in which to resolve tags in specs which ensures we've
    # already expanded any tags in a spec before it is used by a later spec.
    layer_dependencies = [set(iter_referenced_tags(spec)) for spec in layer_specs]
    resolution_order = compute_tag_resolution_order(
        list(zip(layer_tags, layer_dependencies))
    )

    # Lookup {layer_index: resolved_steps, ...}
    resolved_specs: dict[int, list[Stage2Step]] = {}

    # Lookup from tag to the combined set of steps of all layers which have
    # that tag. (Remember: multiple layers can share the same tag!)
    resolved_tags: dict[str, list[Stage2Step]] = defaultdict(list)

    for index in resolution_order:
        new_spec = [
            new_step
            for step in layer_specs[index]
            for new_step in resolve_step_tag(step, resolved_tags)
        ]
        resolved_specs[index] = new_spec
        for name in layer_tags[index]:
            resolved_tags[name].extend(new_spec)

    # Return back in order
    return [resolved_specs[index] for index in range(len(layer_tags))]


################################################################################
# Stage 3: Resolving bounds
################################################################################


@overload
def resolve_step_bound(
    step: Stage2Atom,
    resolved_start: NumericStep,
    resolved_end: NumericStep,
) -> Stage3Atom:
    ...


@overload
def resolve_step_bound(
    step: Stage2Step,
    resolved_start: NumericStep,
    resolved_end: NumericStep,
) -> Stage3Step:
    ...


def resolve_step_bound(
    step: Stage2Step,
    resolved_start: NumericStep,
    resolved_end: NumericStep,
) -> Stage3Step:
    """
    Resolve Start/End into resolved_start and resolved_end respectively.
    """
    match step:
        case Start():
            return resolved_start
        case End():
            return resolved_end
        case Range(start, end):
            return Range(
                resolve_step_bound(start, resolved_start, resolved_end),
                resolve_step_bound(end, resolved_start, resolved_end),
            )
        case _:
            return step


def resolve_bounds(layer_specs: list[list[Stage2Step]]) -> list[list[Stage3Step]]:
    """Resolve all Start/End instances into concrete integer values."""
    # Find the true start/end indices
    all_numeric_atoms = [0] + [
        atom
        for spec in layer_specs
        for step in spec
        for atom in ([step.start, step.end] if isinstance(step, Range) else [step])
        if not isinstance(atom, (Start, End))
    ]
    start = min(all_numeric_atoms)
    end = max(all_numeric_atoms)

    # Resolve Start/End accordingly
    return [
        [resolve_step_bound(step, start, end) for step in spec] for spec in layer_specs
    ]


################################################################################
# Stage 4: Resolve ranges
################################################################################


def resolve_ranges(layer_specs: list[list[Stage3Step]]) -> list[list[Stage4Step]]:
    """Resolve all ranges into individual steps."""
    return [
        [
            atom
            for step in spec
            for atom in (
                range(step.start, step.end + 1) if isinstance(step, Range) else [step]
            )
        ]
        for spec in layer_specs
    ]


################################################################################
# Top-level interface
################################################################################


def normalise_specs(layer_specs: list[list[NumericStep]]) -> list[list[NumericStep]]:
    """
    Remove sort and remove duplicate steps.
    """
    return [sorted(set(spec)) for spec in layer_specs]


def evaluate_build_steps(
    layer_names: list[str],
) -> list[tuple[list[int] | None, set[str]]]:
    """
    Given a list of layer names, returns a (step_indices, tags) tuple for each.
    The step_indices list gives the step numbers during which each layer is
    visible. The 'tags' value gives the set of tags names given to that layer
    (if any).

    For layers which don't specify a build spec, step_indices will be None.
    """
    # Parse specs and tags from layer names.
    input_layer_specs = [parse_build_specification(name) for name in layer_names]
    layer_tags = [parse_tags(name) for name in layer_names]

    # Resolve into plain numeric steps
    try:
        # Internally we treat layers without a any build specs as having the spec
        # '<->' (i.e. always visible).
        s1_layer_specs = resolve_autos(
            [
                spec if spec is not None else [Range(Start(), End())]
                for spec in input_layer_specs
            ]
        )
        s2_layer_specs = resolve_tags(layer_tags, s1_layer_specs)
        s3_layer_specs = resolve_bounds(s2_layer_specs)
        s4_layer_specs = resolve_ranges(s3_layer_specs)
        layer_specs = normalise_specs(s4_layer_specs)
    except IdentifierNotFoundError as exc:
        exc.layer_name = layer_names[exc.layer_index]
        raise
    except CyclicDependencyError as exc:
        exc.layer_names = [layer_names[i] for i in exc.layer_indices]
        raise

    # Remove specs from layers without a build spec. This prevents these layers
    # being bogusly forced to be visible/invisible by the build process.
    return [
        (
            spec if input_spec is not None else None,
            tags,
        )
        for input_spec, spec, tags in zip(input_layer_specs, layer_specs, layer_tags)
    ]
