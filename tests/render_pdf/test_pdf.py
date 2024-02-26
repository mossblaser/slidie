import pytest

from typing import cast

from pdfs import get_pdf

from pathlib import Path
from subprocess import run

from PIL import Image
import numpy as np
from pikepdf import Pdf, Object, OutlineItem, Name

from slidie.render_pdf.pdf import (
    rewrite_internal_links,
    deduplicate_xobjects,
    SlidePageInfo,
    setup_outline,
    setup_page_numbering,
)


def test_rewrite_internal_links() -> None:
    def resolve(page: int, link: str) -> int | None:
        if link == "#this":
            return page
        elif link == "#other":
            return (page + 1) % 2
        else:
            return None

    with Pdf.open(get_pdf("links.pdf")) as pdf:
        rewrite_internal_links(pdf, resolve)

        page_0_annots = list(filter(None, cast(list[Object], pdf.pages[0].Annots)))
        page_1_annots = list(filter(None, cast(list[Object], pdf.pages[1].Annots)))

        assert page_0_annots[0].Dest == [pdf.pages[0].obj, Name.Fit]
        assert page_0_annots[1].Dest == [pdf.pages[1].obj, Name.Fit]
        assert "/A" not in page_0_annots[0]
        assert "/A" not in page_0_annots[1]
        assert page_0_annots[2].A.URI == "#nowhere"  # Untouched

        assert page_1_annots[0].Dest == [pdf.pages[1].obj, Name.Fit]
        assert page_1_annots[1].Dest == [pdf.pages[0].obj, Name.Fit]
        assert "/A" not in page_1_annots[0]
        assert "/A" not in page_1_annots[1]
        assert page_1_annots[2].A.URI == "#nowhere"  # Untouched


def test_deduplicate_xobjects(tmp_path: Path) -> None:
    src_pdf_file = get_pdf("duplicated_images.pdf")

    orig_file = tmp_path / "orig.pdf"
    out_file = tmp_path / "out.pdf"

    # Generate a deduplicated file
    with Pdf.open(src_pdf_file) as pdf:
        # NB: Run just in case file already had dangling references
        pdf.remove_unreferenced_resources()
        # NB: Re-export just in case pikepdf renders the PDF in a way which
        # changes its size too
        pdf.save(orig_file)

        deduplicate_xobjects(pdf)
        pdf.remove_unreferenced_resources()
        pdf.save(out_file)

    # Check deduplicated file is smaller
    assert out_file.stat().st_size < orig_file.stat().st_size

    # Check the rendered PDFs still look identical
    for file in [orig_file, out_file]:
        run(["convert", str(file), str(file.with_suffix(".png"))], check=True)
    orig_img = np.array(Image.open(orig_file.with_suffix(".png")))
    out_img = np.array(Image.open(out_file.with_suffix(".png")))
    assert np.array_equal(orig_img, out_img)


@pytest.fixture
def example_slide_page_info() -> list[SlidePageInfo]:
    return [
        SlidePageInfo(0, 0),
        SlidePageInfo(1, 0),
        SlidePageInfo(1, 1),
        SlidePageInfo(1, 2),
        SlidePageInfo(2, 0, "Three"),
        SlidePageInfo(2, 1, "Second step of the third slide"),
        SlidePageInfo(2, 2),
    ]


def test_setup_outline(example_slide_page_info: list[SlidePageInfo]) -> None:
    with Pdf.new() as pdf:
        for _ in example_slide_page_info:
            pdf.add_blank_page()

        setup_outline(pdf, example_slide_page_info)

        with pdf.open_outline() as outline:
            # One per top-level entry per slide
            assert len(outline.root) == 3

            # Only a single step for slide 0
            assert outline.root[0].destination[0] == pdf.pages[0].obj
            assert outline.root[0].title == "Slide 1"
            assert len(outline.root[0].children) == 0

            # Three steps for slide 1
            assert outline.root[1].destination[0] == pdf.pages[1].obj
            assert outline.root[1].title == "Slide 2"
            assert len(outline.root[1].children) == 2
            assert outline.root[1].children[0].destination[0] == pdf.pages[2].obj
            assert outline.root[1].children[0].title == "Step 2"
            assert outline.root[1].children[1].destination[0] == pdf.pages[3].obj
            assert outline.root[1].children[1].title == "Step 3"

            # Three more for slide 2
            assert outline.root[2].destination[0] == pdf.pages[4].obj
            assert outline.root[2].title == "Three"
            assert len(outline.root[2].children) == 2
            assert outline.root[2].children[0].destination[0] == pdf.pages[5].obj
            assert outline.root[2].children[0].title == "Second step of the third slide"
            assert outline.root[2].children[1].destination[0] == pdf.pages[6].obj
            assert outline.root[2].children[1].title == "Step 3"


def test_setup_page_numbering(example_slide_page_info: list[SlidePageInfo]) -> None:
    with Pdf.new() as pdf:
        for _ in example_slide_page_info:
            pdf.add_blank_page()

        setup_page_numbering(pdf, example_slide_page_info)

        assert pdf.Root.PageLabels.Nums == [
            # Slide 1
            0,
            {"/Type": Name.PageLabel, "/S": Name.D, "/St": 1},
            # Slide 2
            1,
            {"/Type": Name.PageLabel, "/S": Name.D, "/St": 2},
            2,
            {"/Type": Name.PageLabel, "/S": Name.D, "/St": 2, "/P": "2#"},
            # Slide 3
            4,
            {"/Type": Name.PageLabel, "/S": Name.D, "/St": 3},
            5,
            {"/Type": Name.PageLabel, "/S": Name.D, "/St": 2, "/P": "3#"},
        ]
