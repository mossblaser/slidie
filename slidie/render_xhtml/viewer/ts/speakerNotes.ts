import ns from "./xmlNamespaces.ts";

/**
 * Given an SVG with embedded slidie speaker notes, return an array [{steps,
 * text}, ...].
 */
export function getSpeakerNotes(
  svgRoot: SVGSVGElement,
): { stepNumbers: number[] | null; text: string }[] {
  const out = [];
  for (const parentElem of svgRoot.getElementsByTagNameNS(
    ns("slidie"),
    "notes",
  )) {
    for (const elem of parentElem.getElementsByTagNameNS(
      ns("slidie"),
      "note",
    )) {
      let stepNumbers = null;
      if (elem.hasAttribute("steps")) {
        stepNumbers = JSON.parse(elem.getAttribute("steps")!);
      }
      const text = elem.innerHTML;

      out.push({ stepNumbers, text });
    }
  }

  return out;
}
