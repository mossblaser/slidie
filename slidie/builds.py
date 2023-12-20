"""
Support for slide builds. That is, the process of revealing/hiding components
on a slide step-by-step to illustrate some point.

Syntax
======

Builds are controlled by the presence of specifications in angle brackets (`<`
and `>`) included in layer names. The syntax is inspired by Beamer.

The top level syntax is described informally by the following grammar::

    build ::= '<' range_list '>'
    range_list ::= range | range ',' range_list?
    range ::= step | step '-' | '-' step | step '-' step
    step ::= number | '+' | '.' | '@' name
    number ::= /[0-9]+/
    name ::= identifier | identifier '.' qualifier
    qualifier ::= 'before' | 'start' | 'end' | 'after'


Simple numerical specifications
-------------------------------

Some examples of simple numbered specifications are:

* `<1>` -- Show in step 1 only
* `<3->` -- Show from step 3 onward (inclusive)
* `<-3>` -- Show up until step 3 (inclusive)
* `<3-5>` -- Show on steps 3 until 5 (inclusive)
* `<1,4-6>` -- Show on step 1 and then steps 4 to 6 (inclusive)

The numbers given should be considered to be more like sorting keys than
indices into generated slides. Slides are only generated for numbers explicitly
used in a specification.

For example given a series of layers named like so:

    * Always visible on entering the slide
    * Becomes visible after first click <3->
    * Becomes visible after second click <6->

This slide would be displayed in three steps even though the numbers chosen
leave gaps. This choice allows BASIC line numbering style number choices which
allow for easier renumbering as desired.


Automatic numerical specifications (`+` and `.`)
------------------------------------------------

The `+` specification is substituted with 1 + last-used-number. That is,
searching upward through the layers (in the order they're shown in Inkscape's
GUI), find the next numbered (or automatically numbered) specification and add
one to that layer's first listed (automatic/numeric) step.

For example, given layers like so:

    * Always visible on entering the slide
    * Becomes visible after first click <+->
    * Becomes visible after second click <+->

This allows for more convenient specification of simple orderings which is
easily edited by moving layers around in Inkscape.

As a special case, if no numbered slides are found, the first '+' will be
numbered as '1'.

The '.' specification is similar except it does not increment the last used
number. For example:

    * Always visible on entering the slide
    * Becomes visible after first click <+->
    * Becomes visible after first click too <.->
    * Becomes visible after second click <+->
    * Becomes visible after second click as well <.->

This can be useful when several layers are revealed at the same moment in time.


Named specifications
--------------------

Because layers are used for, you know, layering things, it is often useful to
have groups of layers appear/disappear in sync. Since these layers are not
likely to be adjacent, the '.' primitive is not useful so we introduce the
notion of named layers.

A layer is named by including an '@'-prefixed identifier outside of the layer's
build specification.

In the most simple case, a specification of `<@name>` indicates that a layer
should be visible at the same points in time as the named layer. For example:

    * Visible at various points in time <2,4-7,10> @foo
    * Visible iff the 'foo' layer is visible <@foo>

When used at the start of a range, the name resolves to the first moment the
referenced layer is visible. When used at the end of a range, the name resolves
to the last point at which it was visible. For example:

    * Visible at various points in time <2,4-7,10> @foo
    * Visible from 2 onward <@foo->
    * Visible until (and including) 10 <-@foo>
    * Visible between 2 and 10 inclusive, even if 'foo' isnt <@foo-@foo>

You can also be explicit by adding `.before`, `.start`, `.end` and `.after`
suffixes like so:

    * Visible at various points in time <2,4-7,10> @foo
    * Visible at step 1 <@foo.before>
    * Visible at step 2 <@foo.start>
    * Visible at step 10 <@foo.end>
    * Visible at step 11 <@foo.after>

Named step specifications are processed *after* all automatic and numeric steps
are resolved. This means that '+' and '.' will not act relative to any step
defined by name.
"""

from typing import cast, TypeVar, Generic, Literal, NamedTuple, Iterator, Any
from collections.abc import Sequence

from dataclasses import dataclass, Field
from collections import defaultdict
from functools import total_ordering

import re


T = TypeVar("T")

# NB: For some reason MyPy fails to typecheck this when we use the equivalent
# NamedTuple...
@dataclass(frozen=True)
class Range(Generic[T]):
    start: T
    end: T

class Plus(NamedTuple):
    pass

class Dot(NamedTuple):
    pass

# NB: Implemented as mixins to ensure that total_ordering creates all six
# comparisons since it would otherwise be prevented from doing so on a
# NamedTuple since they are already defined!
@total_ordering
class StartOrderingMixin:

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
    
@total_ordering
class EndOrderingMixin:

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

class Start(StartOrderingMixin, NamedTuple("Start", [])):
    pass

class End(EndOrderingMixin, NamedTuple("End", [])):
    pass

BoundsStep = Start | End
NumericStep = int
AutoStep = Plus | Dot
NamedStep = str | tuple[str, str]


# The type of specs as parsed from a layer name
UnprocessedStepAtom = BoundsStep | NumericStep | AutoStep | NamedStep
UnprocessedStep = UnprocessedStepAtom | Range[UnprocessedStepAtom]

# The type of specs after automatic numbers (+ and .) are resolved
AutoFreeStepAtom = BoundsStep | NumericStep | NamedStep
AutoFreeStep = AutoFreeStepAtom | Range[AutoFreeStepAtom]

# The type of specs after both automatic numbers and names are resolved
NameFreeStepAtom = BoundsStep | NumericStep
NameFreeStep = NameFreeStepAtom | Range[NameFreeStepAtom]

# The type of specs after automatic numbers, names and Start/End bounds have
# been resolved
BoundsFreeStepAtom = NumericStep
BoundsFreeStep = BoundsFreeStepAtom | Range[BoundsFreeStepAtom]


class LayerNameParseError(ValueError):
    pass


def parse_step(
    step_spec: str,
    empty_value: BoundsStep | None = None,
) -> UnprocessedStepAtom:
    """
    Parse a single step (e.g. '123', '+', '.', '@foo'). If empty_value is
    given, parses and empty string as the given BoundsStep.
    """
    step_spec = step_spec.strip()
    if re.fullmatch(r"@[^\s]+", step_spec):
        name, dot, suffix = step_spec[1:].partition(".")
        if dot:
            if suffix not in ("before", "start", "end", "after"):
                raise LayerNameParseError(f"Unexpected suffix: {step_spec!r}")
            return (name, suffix)
        else:
            return name
    elif step_spec == "+":
        return Plus()
    elif step_spec == ".":
        return Dot()
    elif step_spec == "" and empty_value is not None:
        return empty_value
    elif re.fullmatch(r"[0-9]+", step_spec):
        return int(step_spec)
    else:
        raise LayerNameParseError(f"Invalid step: {step_spec!r}")


def parse_builds_in_layer_name(layer_name: str) -> list[UnprocessedStep]:
    """
    Parse the build steps/ranges specified in a layer name.
    """
    steps_and_ranges: list[UnprocessedStep] = []
    
    contains_step_list = False
    for match in re.findall(r"<[^>]*>", layer_name):
        contains_step_list = True
        
        if match[1:-1].strip():
            for step_or_range in match[1:-1].split(","):
                if '-' in step_or_range:
                    before, _, after = step_or_range.partition("-")
                    steps_and_ranges.append(
                        Range(parse_step(before, Start()), parse_step(after, End()))
                    )
                else:
                    steps_and_ranges.append(parse_step(step_or_range))
    
    if not contains_step_list:
        steps_and_ranges = [Range(Start(), End())]
    
    return steps_and_ranges


def parse_identifiers_in_layer_name(layer_name: str) -> set[str]:
    """
    Find any/all layer names specified inside a layer's name.
    """
    layer_name_without_builds = re.sub(r"<[^>]+>", "", layer_name)
    return set(re.findall(r"@([^\s<>.@]+)(?=\s|@|$)", layer_name_without_builds))


def resolve_step_autos(
    step: UnprocessedStep,
    last_number: int,
) -> AutoFreeStep:
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
                cast(AutoFreeStepAtom, resolve_step_autos(start, last_number)),
                cast(AutoFreeStepAtom, resolve_step_autos(end, last_number)),
            )
        case _:
            return step


def get_first_numeric_step(steps: Sequence[AutoFreeStep]) -> int | None:
    """
    Get the first numbered step to appear in the provided list of steps.
    Returns None if no numbered steps exist.
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


def resolve_autos(
    layer_steps: Sequence[Sequence[UnprocessedStep]]
) -> list[list[AutoFreeStep]]:
    """
    Resolves '+' and '.' components of layer numberings into concrete numeric
    steps.
    """
    out: list[list[AutoFreeStep]] = []
    
    last_number = 0
    for steps in layer_steps:
        new_steps = [resolve_step_autos(step, last_number) for step in steps]
        out.append(new_steps)
        
        new_steps_number = get_first_numeric_step(new_steps)
        if new_steps_number is not None:
            last_number = new_steps_number
    
    return out


def iter_referenced_identifiers(steps: Sequence[AutoFreeStep]) -> Iterator[str]:
    """
    Enumerate the named identifiers used in a build specification.
    """
    for step in steps:
        match step:
            case str():
                yield step
            case (str(identifier), _):
                yield identifier
            case Range(start, end):
                yield from iter_referenced_identifiers([start, end])
            case _:
                pass  # Other types are not names


@dataclass
class IdentifierNotFoundError(ValueError):
    """
    Thrown when a name is used in a step which doesn't correspond to any layer.
    """
    identifier: str
    layer_index: int


@dataclass
class CyclicDependencyError(ValueError):
    """
    Thrown when a a series of names form a cyclic dependency
    """
    layer_indices: list[int]


def compute_name_resolution_order(
    layer_names_and_dependencies: list[tuple[set[str], set[str]]],
) -> list[int]:
    """
    Return an ordering of layers to process such that each layer is processed
    before any other layer which depends on it.
    
    `layer_names_and_dependencies` is a list of (identifiers, dependencies) pairs. A permuted
    sequence of indices into this list is returned.
    """
    # Map names to indices
    name_to_indices: dict[str, set[int]] = defaultdict(set)
    for i, (names, _deps) in enumerate(layer_names_and_dependencies):
        for name in names:
            name_to_indices[name].add(i)
    
    # Create an index-based dependency graph (checking all dependencies are
    # defined)
    index_to_deps: dict[int, set[int]] = defaultdict(set)
    for i, (names, deps) in enumerate(layer_names_and_dependencies):
        for dep in deps:
            if dep not in name_to_indices:
                raise IdentifierNotFoundError(dep, i)
            index_to_deps[i].update(name_to_indices[dep])
    
    ordering: list[int] = []
    
    def resolve(index: int, visited_indices: list[int]) -> None:
        # If already resolved, do nothing
        if index in ordering:
            return
        
        # Detect dependency cycles
        if index in visited_indices:
            loop_indices = visited_indices[visited_indices.index(index):]
            raise CyclicDependencyError(loop_indices + [index])
        
        # Process all dependencies
        for dep_index in index_to_deps[index]:
            resolve(dep_index, visited_indices + [index])
        
        # Now process this item
        ordering.append(index)
    
    for i in range(len(layer_names_and_dependencies)):
        resolve(i, [])
    
    return ordering


def resolve_suffix(
    named_spec: Sequence[NameFreeStep],
    suffix: str,
) -> NameFreeStepAtom | None:
    """
    Given a spec which has been referenced by name, and the suffix used with
    that reference, return the singular step it resolves to (or None if the
    named_spec is empty).
    """
    if len(named_spec) == 0:
        return None
    
    # Flatten the spec (including range elements)
    flat_spec = [
        atom
        for step in named_spec
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
        raise NotImplementedError(suffix)


def resolve_step_names(
    step: AutoFreeStep,
    resolved_names: dict[str, list[NameFreeStep]],
    _default_suffix: str | None = None,
) -> list[NameFreeStep]:
    """
    Resolve any names in a step. Note that names may resolve into more than one
    step.
    """
    if _default_suffix is not None and isinstance(step, str):
        step = (step, _default_suffix)
    
    match step:
        case str():
            return resolved_names[step]
        case (str(name), str(suffix)):
            new_step = resolve_suffix(resolved_names[name], suffix)
            if new_step is not None:
                return [new_step]
            else:
                return []
        case Range(start, end):
            # Resolve
            new_start = resolve_step_names(start, resolved_names, "start")
            new_end = resolve_step_names(end, resolved_names, "end")
            
            if new_start and new_end:
                assert len(new_start) == 1
                assert len(new_end) == 1
                return [
                    Range(
                        cast(NameFreeStepAtom, new_start[0]),
                        cast(NameFreeStepAtom, new_end[0]),
                    )
                ]
            else:
                return []
        case _:
            return [cast(NameFreeStep, step)]


def resolve_names(
    layer_identifers: list[set[str]],
    layer_steps: list[list[AutoFreeStep]],
) -> list[list[NameFreeStep]]:
    """
    Resolve all identifiers in layer build specifications.
    """
    # Work out the order in which to resolve names in specs which ensures we've
    # already expanded any names in a spec before it is used by a later spec.
    layer_dependencies = [
        set(iter_referenced_identifiers(steps))
        for steps in layer_steps
    ]
    resolution_order = compute_name_resolution_order(
        list(zip(layer_identifers, layer_dependencies))
    )
    
    # Lookup {layer_index: resolved_steps, ...}
    resolved_layers_by_index: dict[int, list[NameFreeStep]] = {}
    
    # Lookup from name to the combined set of steps for all layers which have
    # that name
    resolved_layers_by_name: dict[str, list[NameFreeStep]] = defaultdict(list)
    
    # Resolve names
    for index in resolution_order:
        new_steps = [
            new_step
            for step in layer_steps[index]
            for new_step in resolve_step_names(step, resolved_layers_by_name)
        ]
        resolved_layers_by_index[index] = new_steps
        for name in layer_identifers[index]:
            resolved_layers_by_name[name].extend(new_steps)
    
    # Return back in order
    return [
        resolved_layers_by_index[index]
        for index in range(len(layer_identifers))
    ]


def resolve_step_bounds(
    step: NameFreeStep,
    resolved_start: NumericStep,
    resolved_end: NumericStep,
) -> BoundsFreeStep:
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
                cast(
                    BoundsFreeStepAtom,
                    resolve_step_bounds(start, resolved_start, resolved_end),
                ),
                cast(
                    BoundsFreeStepAtom,
                    resolve_step_bounds(end, resolved_start, resolved_end),
                ),
            )
        case _:
            return step


def resolve_bounds(
    layer_steps: Sequence[Sequence[NameFreeStep]]
) -> list[list[BoundsFreeStep]]:
    """
    Resolve all Start/End instances into concrete integer values.
    """
    # Find the true start/end indices
    all_numeric_atoms = [
        atom
        for spec in layer_steps
        for step in spec
        for atom in ([step.start, step.end] if isinstance(step, Range) else [step])
        if not isinstance(atom, (Start, End))
    ] + [0]
    start = min(all_numeric_atoms)
    end = max(all_numeric_atoms)
    
    # Resolve Start/End accordingly
    return [
        [resolve_step_bounds(step, start, end) for step in spec]
        for spec in layer_steps
    ]


def resolve_ranges(
    layer_steps: Sequence[Sequence[BoundsFreeStep]]
) -> list[list[NumericStep]]:
    """
    Resolve all ranges into individual steps.
    """
    return [
        [
            atom
            for step in spec
            for atom in (range(step.start, step.end + 1) if isinstance(step, Range) else [step])
        ]
        for spec in layer_steps
    ]


def normalise_steps(
    layer_steps: Sequence[Sequence[NumericStep]]
) -> list[list[NumericStep]]:
    """
    Remove sort and remove duplicate steps.
    """
    return [sorted(set(spec)) for spec in layer_steps]
