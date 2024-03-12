/**
 * This module contains logic for encoding and decoding slide/step identifiers
 * in URL hashes following the scheme defined in `slidie/links.py`.
 */

import ns from "./xmlNamespaces.ts";
import {
  findBuildSteps,
  layerStepNumbers,
  layerStepTags,
} from "./buildSteps.ts";

/**
 * Given a zero-indexed slide number and zero-indexed step index, return a URL
 * hash which encodes that position.
 */
export function toUrlHash(slide: number, step: number = 0): string {
  if (step == 0) {
    return `#${slide + 1}`;
  } else {
    return `#${slide + 1}#${step + 1}`;
  }
}

/**
 * Regex which matches any potentially valid URL hash.
 */
const LINK_REGEX = new RegExp(
  "^#" +
    // Slide spec
    "(?:" +
    "(?<slideIndex>[0-9]+)" +
    "|" +
    "(?<slideId>[^0-9#@<][^#@<]*)" +
    ")?" +
    // Build step spec
    "(?:" +
    "(?:#(?<stepIndex>[0-9]+))" +
    "|" +
    "(?:<(?<stepNumber>[-+]?[0-9]+)>)" +
    "|" +
    "(?:@(?<stepTag>[^\\s<>.@]+))" +
    ")?" +
    "$",
);

/**
 * Parse an (already-uri-decoded) URL hash, resolving the specification into a
 * [slide, step] pair.
 *
 * Returns null if an *syntactically* invalid link is provided.
 *
 * Out-of-range slide/step numbers are returned as-is.
 *
 * When an unknown slideId is given, returns null. Conversely an unknown build
 * step tag or out-of-range build step number is given, the step is treated as
 * zero instead.
 *
 * @param currentSlide The current 0-indexed slide number. Pass a negative
 *        number to act as if no slide is currently selected.
 * @param slideIds A Map() from slide ID to slide index.
 * @param slideStepNumbers An array of arrays giving the
 *        (not-necessarily-zero-indexed) step numbers of each step for each
 *        slide.
 * @param slideTags An array of Map() from tag to an array of step
 *        indices, one per slide.
 */
export function parseUrlHash(
  hash: string,
  currentSlide: number,
  slideIds: Map<string, number>,
  slideStepNumbers: number[][],
  slideTags: Map<string, number[]>[],
): [number, number] | null {
  const match = LINK_REGEX.exec(hash);
  if (match === null) {
    return null;
  }
  const groups = match.groups!;

  // Work out slide index
  let slide = currentSlide;
  if (groups.slideIndex !== undefined) {
    slide = parseInt(groups.slideIndex) - 1;
  } else if (groups.slideId !== undefined) {
    const slideId = groups.slideId;
    if (slideIds.has(slideId)) {
      slide = slideIds.get(slideId)!;
    } else {
      // Unknown slide ID
      return null;
    }
  }
  if (slide < 0 || slide >= slideStepNumbers.length) {
    // Slide number out of range
    return null;
  }

  // Work out step index
  let step = 0;
  if (groups.stepIndex !== undefined) {
    step = parseInt(groups.stepIndex) - 1;
  } else if (groups.stepNumber !== undefined) {
    step = slideStepNumbers[slide].indexOf(parseInt(groups.stepNumber));
    if (step < 0) {
      // Treat non-existant step number as zero
      step = 0;
    }
  } else if (groups.stepTag !== undefined) {
    const tag = groups.stepTag;
    if (slideTags[slide].has(tag)) {
      step = slideTags[slide].get(tag)![0];
    }
  }

  return [slide, step];
}

/**
 * Enumerate the complete set of absolute slide hashes.
 *
 * Does not include 'relative' hashes where the current slide is implied.
 */
export function enumerateAbsoluteHashes(slides: SVGSVGElement[]): string[] {
  const out = [];

  for (const [slideNum, slide] of slides.entries()) {
    // Enumerate ways of identifying the slide
    const slideValues = [`#${slideNum + 1}`];
    if (slide.hasAttributeNS(ns("slidie"), "id")) {
      slideValues.push(`#${slide.getAttributeNS(ns("slidie"), "id")}`);
    }

    // Enumerate ways of identifying the step
    const stepValues = [];
    const layerSteps = findBuildSteps(slide);
    for (const [step, stepNumber] of layerStepNumbers(layerSteps).entries()) {
      stepValues.push(`#${step + 1}`);
      stepValues.push(`<${stepNumber}>`);
    }
    for (const tag of layerStepTags(layerSteps).keys()) {
      stepValues.push(`@${tag}`);
    }

    // Enumerate all combinations of the above
    for (const slideValue of slideValues) {
      out.push(`${slideValue}`);
      for (const stepValue of stepValues) {
        out.push(`${slideValue}${stepValue}`);
      }
    }
  }

  return out;
}
