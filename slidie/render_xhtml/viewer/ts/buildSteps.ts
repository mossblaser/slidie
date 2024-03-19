/**
 * The following functions are used for extracting information slidie specific
 * information from SVGs (e.g. build steps, thumbnails etc.).
 */

import ns from "./xmlNamespaces.ts";

export interface BuildStepVisibility {
  // The SVG element whose visibility is controlled by the build step
  elem: SVGElement;

  // The step numbers (not necessarily zero-indexed) at which this build step
  // is visible.
  stepNumbers: number[];

  // The step indices (zero-indexed) at which the build step is visible.
  steps: number[];

  // The build step tags assigned to this element (if any)
  tags: string[];
}

/**
 * Given an SVG root node, find all SVG elements containing a slidie
 * 'steps' attribute.
 */
export function findBuildSteps(svgRoot: SVGSVGElement): BuildStepVisibility[] {
  // Find all steps
  const out: BuildStepVisibility[] = [];
  for (const elem of svgRoot.querySelectorAll("*")) {
    if (
      elem.namespaceURI == ns("svg") &&
      elem.hasAttributeNS(ns("slidie"), "steps")
    ) {
      const stepNumbers = JSON.parse(
        elem.getAttributeNS(ns("slidie"), "steps")!,
      ) as number[];
      const tags = JSON.parse(
        elem.getAttributeNS(ns("slidie"), "tags") || "[]",
      ) as string[];
      out.push({
        elem: elem as SVGElement,
        stepNumbers,
        tags,
        steps: [], // Placeholder, populated below
      });
    }
  }

  // Add zero-indexed step indices
  const firstStepNumber = Math.min(
    ...out
      .map(({ stepNumbers }) => stepNumbers)
      .flat()
      .concat([0]),
  );
  for (const obj of out) {
    obj.steps = obj.stepNumbers.map((n) => n - firstStepNumber);
  }

  return out;
}

/**
 * Given an array [{stepNumbers, ...}, ...] (e.g. from findBuildSteps), returns
 * an array enumerating the full set of (maybe-not-zero-indexed) step numbers
 * used by any build specs provided.
 */
export function layerStepNumbers(
  layerSteps: { stepNumbers: number[] }[],
): number[] {
  const allSteps = layerSteps
    .map(({ stepNumbers }) => stepNumbers)
    .flat()
    .concat([0]);
  const first = Math.min(...allSteps);
  const last = Math.max(...allSteps);

  const out = [];
  for (let i = first; i <= last; i++) {
    out.push(i);
  }
  return out;
}

/**
 * Given an array [{steps, tags}, ...], returns an Map from tag names to
 * (zero-indexed) step indices.
 */
export function layerStepTags(
  layerSteps: { steps: number[]; tags: string[] }[],
): Map<string, number[]> {
  const map = new Map();
  for (const { steps, tags } of layerSteps) {
    for (const tag of tags) {
      if (!map.has(tag)) {
        map.set(tag, []);
      }
      for (const step of steps) {
        if (map.get(tag).indexOf(step) == -1) {
          map.get(tag).push(step);
        }
      }
      map.get(tag).sort();
    }
  }

  return map;
}

/**
 * Given an SVG element, returns a {stepNumbers, tags} for the build steps of
 * the nearest parent element with build steps specified. If no parent has any
 * build steps specified, returns null.
 */
export function findElementBuildSteps(
  elem: Element,
): { stepNumbers: number[]; tags: string[] } | null {
  let curElem: Element | null = elem;
  while (curElem) {
    if (
      curElem.namespaceURI == ns("svg") &&
      curElem.hasAttributeNS(ns("slidie"), "steps")
    ) {
      const stepNumbers = JSON.parse(
        curElem.getAttributeNS(ns("slidie"), "steps")!,
      );
      const tags = JSON.parse(
        curElem.getAttributeNS(ns("slidie"), "tags") || "[]",
      );
      return { stepNumbers, tags };
    }
    curElem = curElem.parentElement;
  }
  return null;
}
