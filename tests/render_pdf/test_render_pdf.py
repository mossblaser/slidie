from svgs import get_svg_filename

from typing import cast, Iterator

import shutil
from pathlib import Path

from pikepdf import Pdf, Object, Name

from slidie.render_pdf import render_pdf


def enumerate_page_numbers(pdf: Pdf) -> list[str]:
    """
    Crude and quite limited function for enumerating the custom page
    numbering for all pages in a PDF.
    """
    it = iter(pdf.Root.PageLabels.Nums)
    numbering_scheme = dict(zip(cast(Iterator[int], it), cast(Iterator[Object], it)))

    out = []
    prefix = ""
    number = 1
    for page in range(len(pdf.pages)):
        if spec := numbering_scheme.get(page):
            assert spec.S == Name.D, "Only decimals supported."
            # XXX: Pikepdf's 'get' method is incorrectly typed w.r.t defaults
            prefix = cast(str, spec.get("/P", ""))  # type: ignore
            number = cast(int, spec.St)
        out.append(f"{prefix}{number}")
        number += 1

    return out


def test_render_pdf(tmp_path: Path) -> None:
    src_dir = tmp_path / "src"
    src_dir.mkdir()

    shutil.copy(
        get_svg_filename("links_test_slide_010.svg"), src_dir / "010 - first.svg"
    )
    shutil.copy(
        get_svg_filename("links_test_slide_020.svg"), src_dir / "020 - second.svg"
    )
    (src_dir / "015 - decoy.txt").write_text("I am a decoy! >.<")

    render_pdf(src_dir, tmp_path / "out.pdf")

    with Pdf.open(tmp_path / "out.pdf") as pdf:
        # Should have a page per step
        assert len(pdf.pages) == 1 + 4

        # Check links are resolved
        assert pdf.pages[0].Annots[0].Dest[0] == pdf.pages[0].obj  # #first
        assert pdf.pages[0].Annots[1].Dest[0] == pdf.pages[1].obj  # #second
        assert pdf.pages[0].Annots[2].Dest[0] == pdf.pages[2].obj  # #second#2
        assert pdf.pages[0].Annots[3].Dest[0] == pdf.pages[3].obj  # #second<1>
        assert pdf.pages[0].Annots[4].Dest[0] == pdf.pages[4].obj  # #second@last
        assert "/Dest" not in pdf.pages[0].Annots[5]  # http://jhnet.co.uk

        assert pdf.pages[1].Annots[0].Dest[0] == pdf.pages[0].obj  # #first
        assert pdf.pages[1].Annots[1].Dest[0] == pdf.pages[3].obj  # ##3

        # Check metadata comes from first slide
        with pdf.open_metadata() as meta:
            assert meta["dc:title"] == "Test slides"
            assert meta["dc:creator"] == "Jonathan"
            assert meta["dc:date"] == "Today"

        # Check custom page numbering
        assert enumerate_page_numbers(pdf) == ["1", "2", "2#2", "2#3", "2#4"]

        # Check outline
        with pdf.open_outline() as outline:
            assert outline.root[0].title == "Test slides"
            assert outline.root[0].destination[0] == pdf.pages[0].obj

            assert outline.root[1].title == "Slide 2"
            assert outline.root[1].destination[0] == pdf.pages[1].obj

            assert outline.root[1].children[0].title == "Step 2"
            assert outline.root[1].children[0].destination[0] == pdf.pages[2].obj

            assert outline.root[1].children[1].title == "Step 3"
            assert outline.root[1].children[1].destination[0] == pdf.pages[3].obj

            assert outline.root[1].children[2].title == "Step 4"
            assert outline.root[1].children[2].destination[0] == pdf.pages[4].obj
