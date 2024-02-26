"""
Various routines for generating PDF structures.
"""

from typing import Callable, Any

from dataclasses import dataclass
from pathlib import Path
from collections import defaultdict

import hashlib

from pikepdf import Pdf, Object, Name, Stream, OutlineItem


def rewrite_internal_links(
    pdf: Pdf, resolver: Callable[[int, str], int | None]
) -> None:
    """
    Rewrite link annotations to jump to pages within a PDF as defined by a
    provided resolver function.

    Parameters
    ==========
    pdf : Pdf
        The PDF to resolve links within.
    resolver: fn(page, url) -> page | None
        A function which takes URL and the page number on which the link
        appears. If the link should resolve to an internal page, the function
        should return the page number. Otherwise it should return None and the
        link will be left unchanged.
    """
    for page_number, page in enumerate(pdf.pages):
        # XXX: Pikepdf's .get() method doesn't correctly type its default
        # argument
        for annotation in page.get("/Annots", []):  # type: ignore
            if (
                annotation
                and
                # Link annotations...
                annotation.Subtype == Name.Link
                and
                # ...with a URI action
                "/A" in annotation
                and annotation.A.S == Name.URI
            ):
                destination_page = resolver(page_number, annotation.A.URI)
                if destination_page is not None:
                    # Replace URI action with a page Destination
                    del annotation.A
                    annotation.Dest = [pdf.pages[destination_page].obj, Name.Fit]


def deduplicate_xobjects(pdf: Pdf) -> None:
    """
    Replace duplicate XObjects (e.g. embedded images) within a PDF. Ensures,
    for example, that a single image included on several slides/steps will only
    be stored once.
    """
    # A bucket-style-hashtable like lookup with shape::
    #
    #     {prefix: [xobject_ref, ...], ...}
    #
    # The 'prefix' key is the first 1kb of the stream data mapping to a
    # list of indirect XObject references whose

    seen_xobjects: dict[bytes, list[Object]] = defaultdict(list)

    for page in pdf.pages:
        # XXX: Pikepdf's .get() method doesn't correctly type its default
        # argument
        page_xobjects = page.get(Name.Resources, {}).get(Name.XObject, {})  # type: ignore
        assert page_xobjects is not None
        for name, xobject in list(page_xobjects.items()):
            if not (isinstance(xobject, Stream) and xobject.is_indirect):
                # Should never occur because:
                #   a) XObjects are always streams
                #   b) Streams are always indirect objects
                # ... at least in PDF 1.5 anyway. But this keeps us safe from
                # future PDF standards changing things.
                continue

            prefix = xobject.read_raw_bytes()[:1024]

            # Substitute for previously seen object if possible
            for other_xobject in seen_xobjects.get(prefix, []):
                if other_xobject == xobject:
                    page_xobjects[name] = other_xobject
                    break
            else:
                # This is a previously unseen object
                seen_xobjects[prefix].append(xobject)


@dataclass
class SlidePageInfo:
    """
    Defines various pieces of metadata defined for a given slide.
    """

    slide_index: int
    """
    The 0-based index of the position of the slide (not step) in the show.
    """

    step_index: int
    """
    The 0-based index of the step within its slide.
    """

    title: str | None = None
    """The title assigned to this step (if any)."""


def setup_outline(pdf, slide_infos: list[SlidePageInfo]) -> None:
    """
    Create an outline (a.k.a. bookmarks/ToC) in the PDF based on the provided
    per-step (i.e. per-page) information.
    """
    with pdf.open_outline() as outline:
        cur_slide_index = None
        cur_outline_parent = None
        for page_index, slide_info in enumerate(slide_infos):
            # Top-level entry for the first step of a slide
            if cur_slide_index != slide_info.slide_index:
                cur_outline_parent = outline.root
                cur_outline_parent.append(
                    OutlineItem(
                        (
                            f"Slide {slide_info.slide_index + 1}"
                            if slide_info.title is None
                            else slide_info.title
                        ),
                        page_index,
                    )
                )
                cur_outline_parent = cur_outline_parent[-1].children
                cur_slide_index = slide_info.slide_index
            else:
                # Subsequent steps within the current slide
                assert cur_outline_parent is not None
                cur_outline_parent.append(
                    OutlineItem(
                        (
                            f"Step {slide_info.step_index + 1}"
                            if slide_info.title is None
                            else slide_info.title
                        ),
                        page_index,
                    )
                )


def setup_page_numbering(pdf, slide_infos: list[SlidePageInfo]) -> None:
    """
    Sets up custom page numbering of the form ``123`` for the first step of
    each slide and ``123#456`` for subsequent steps in that slide -- just like
    the generic URL-hash scheme used for URLs.
    """
    # A /PageLabels./Nums structure (see 'Page labels' in PDF spec)
    #
    # In brief, every entry is a list which contains alternating page_number
    # and page label dicts. The page numbers define the page starting from
    # which a numbering format should be used. The page label dicts define the
    # numbering format to be used and look as follows:
    #
    #    {
    #       /Type: /PageLabel
    #       /S: <number format, e.g. /D for Arabic decimals>,
    #       /St: <starting number>,
    #       /P: <prefix string (optional)>,
    #    }
    numbering_scheme: list[int | dict[Any, Any]] = []

    with pdf.open_outline() as outline:
        cur_slide_index = None
        cur_outline_parent = None
        for page_index, slide_info in enumerate(slide_infos):
            if cur_slide_index != slide_info.slide_index:
                # The first step of a slide
                numbering_scheme.append(page_index)
                numbering_scheme.append(
                    {
                        "/Type": Name.PageLabel,
                        "/S": Name.D,  # Arabic decimals
                        "/St": slide_info.slide_index + 1,
                    }
                )
                cur_slide_index = slide_info.slide_index
            elif slide_info.step_index == 1:
                # The first of subsequent steps within the current slide
                numbering_scheme.append(page_index)
                numbering_scheme.append(
                    {
                        "/Type": Name.PageLabel,
                        "/S": Name.D,  # Arabic decimals
                        "/St": 2,
                        "/P": f"{slide_info.slide_index + 1}#",
                    }
                )
            else:
                pass  # All subsequent steps will be numbered automatically

    pdf.Root.PageLabels = {"/Nums": numbering_scheme}
