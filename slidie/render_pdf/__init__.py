from pathlib import Path

from typing import NamedTuple

from xml.etree import ElementTree as ET
from tempfile import TemporaryDirectory

from pikepdf import Pdf

from slidie.xml_namespaces import SLIDIE_NAMESPACE
from slidie.inkscape import Inkscape, open_etree_in_inkscape, set_visible_step
from slidie.svg_utils import (
    annotate_build_steps,
    fill_inkscape_page_background,
    find_build_elements,
    get_build_step_range,
    get_build_tags,
)
from slidie.speaker_notes import extract_speaker_notes
from slidie.magic import extract_magic
from slidie.links import annotate_slide_id_from_magic, resolve_link
from slidie.metadata import annotate_metadata

from slidie.render_pdf.pdf import (
    rewrite_internal_links,
    deduplicate_xobjects,
    SlidePageInfo,
    setup_outline,
    setup_page_numbering,
)


class RenderedSlideStep(NamedTuple):
    """
    The result of rendering a single slide step.
    """

    pdf_file: Path
    """The generated PDF."""

    step_number: int
    """
    The number the user used to define this build step (as distinct from its
    zero-indexed step index.
    """

    notes: list[str]
    """The speaker notes associated with this step."""


class RenderedSlide(NamedTuple):
    """
    The result of rendering a slide (and all of its steps).
    """

    steps: list[RenderedSlideStep]
    """The steps of this slide."""

    build_tags: dict[str, set[int]]
    """Lookup from build tag to the step indices"""

    id: str | None
    """The identifier assigned to the slide using the 'id' magic."""

    title: str | None
    author: str | None
    date: str | None
    """General slide metadata."""


def render_slide(svg: ET.Element, inkscape: Inkscape, tmp_dir: Path) -> RenderedSlide:
    """
    Render a single slide into a set of PDFs, one per step. Returns a
    dictionary from step number to PDF filename.

    The generated PDFs will be written with arbitrary names into the provided
    tmp_dir (which is expected to be empty).
    """
    annotate_build_steps(svg)
    build_elements = find_build_elements(svg)
    build_tags = get_build_tags(svg)

    notes = extract_speaker_notes(svg)

    magic = extract_magic(svg)
    annotate_slide_id_from_magic(magic)
    annotate_metadata(svg, magic)

    slide_id = svg.get(f"{{{SLIDIE_NAMESPACE}}}id", None)
    slide_title = svg.get(f"{{{SLIDIE_NAMESPACE}}}title", None)
    slide_author = svg.get(f"{{{SLIDIE_NAMESPACE}}}author", None)
    slide_date = svg.get(f"{{{SLIDIE_NAMESPACE}}}date", None)

    fill_inkscape_page_background(svg)

    steps = []
    with open_etree_in_inkscape(inkscape, svg):
        for step_number in get_build_step_range(svg):
            set_visible_step(inkscape, build_elements, step_number)
            pdf_file = tmp_dir / f"{step_number}.pdf"
            inkscape.export(pdf_file)

            step_notes = [
                text
                for step_numbers, text in notes
                if step_numbers is None or step_number in step_numbers
            ]

            steps.append(
                RenderedSlideStep(
                    pdf_file=pdf_file,
                    step_number=step_number,
                    notes=step_notes,
                )
            )

    return RenderedSlide(
        steps=steps,
        build_tags=build_tags,
        id=slide_id,
        title=slide_title,
        author=slide_author,
        date=slide_date,
    )


def resolve_internal_links(pdf: Pdf, slides: list[RenderedSlide]) -> None:
    """
    Resolve all internal links (e.g. like #123) into PDF inter-page links.
    """
    # Resolve internal links
    slide_ids = {
        slide.id: slide_index
        for slide_index, slide in enumerate(slides)
        if slide.id is not None
    }
    slide_step_numbers = [
        [step.step_number for step in slide.steps] for slide in slides
    ]
    slide_build_tags = [slide.build_tags for slide in slides]
    slide_step_to_page = [
        (slide_index, step_index)
        for slide_index, slide in enumerate(slides)
        for step_index in range(len(slide.steps))
    ]

    def resolve(page: int, url: str) -> int | None:
        target = resolve_link(
            str(url),
            slide_ids,
            slide_step_numbers,
            slide_build_tags,
            slide_step_to_page[page][0],
        )
        if target is None:
            return None  # Link is not a valid internal link
        try:
            return slide_step_to_page.index(target)
        except ValueError:
            # The slide/step referenced did not exist.
            return None

    rewrite_internal_links(pdf, resolve)


def render_pdf(slide_filenames: list[Path], output: Path) -> None:
    """
    Render a slidie show into a PDF.
    """
    with Pdf.new() as out_pdf:
        with TemporaryDirectory() as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str)

            # Render slides to PDF
            slides = []
            with Inkscape() as inkscape:
                for slide_index, svg_filename in enumerate(slide_filenames):
                    try:
                        svg = ET.parse(svg_filename).getroot()
                        slide_tmp_dir = tmp_dir / str(slide_index)
                        slide_tmp_dir.mkdir()
                        slides.append(render_slide(svg, inkscape, slide_tmp_dir))
                    except Exception as exc:
                        exc.add_note(f"While processing {svg_filename}")
                        raise

            # Concatenate into single PDF
            version = out_pdf.pdf_version
            for slide in slides:
                for step in slide.steps:
                    with Pdf.open(step.pdf_file) as step_pdf:
                        version = max(version, step_pdf.pdf_version)
                        out_pdf.pages.append(step_pdf.pages[0])

        resolve_internal_links(out_pdf, slides)

        # Setup page numbering/outlines
        slide_infos = [
            SlidePageInfo(
                slide_index=slide_index,
                step_index=step_index,
                title=slide.title if step_index == 0 else None,
            )
            for slide_index, slide in enumerate(slides)
            for step_index, step in enumerate(slide.steps)
        ]
        setup_page_numbering(out_pdf, slide_infos)
        setup_outline(out_pdf, slide_infos)

        # Setup PDF-wide metadata
        with out_pdf.open_metadata() as meta:
            if title := slides[0].title:
                meta["dc:title"] = title
            if author := slides[0].author:
                meta["dc:creator"] = author
            if date := slides[0].date:
                meta["dc:date"] = date

        # De-duplicate embedded images
        deduplicate_xobjects(out_pdf)
        out_pdf.remove_unreferenced_resources()

        out_pdf.save(output, min_version=version)
