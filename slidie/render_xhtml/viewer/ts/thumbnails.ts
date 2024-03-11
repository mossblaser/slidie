import ns from "./xmlNamespaces.ts";

/**
 * Given an SVG with embedded slidie thumbnails, return an array of
 * (non-zerp-indexed) numbered image data URLs.
 */
export function getThumbnails(
  svgRoot: SVGSVGElement,
): { stepNumber: number; dataUrl: string }[] {
  const out = [];
  for (const parentElem of svgRoot.getElementsByTagNameNS(
    ns("slidie"),
    "thumbnails",
  )) {
    for (const elem of parentElem.getElementsByTagNameNS(
      ns("slidie"),
      "thumbnail",
    )) {
      const stepNumber = JSON.parse(elem.getAttribute("step")!) as number;
      const type = elem.getAttribute("type")!;
      const encoding = elem.getAttribute("encoding")!;
      const codedData = elem.innerHTML;

      const dataUrl = `data:${type};${encoding},${codedData}`;

      out.push({ stepNumber, dataUrl });
    }
  }

  return out;
}
