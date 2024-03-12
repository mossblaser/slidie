/**
 * This module contains logic for encoding and decoding slide/step identifiers
 * in URL hashes following the scheme defined in `slidie/links.py`.
 */

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
    "(?<slide_index>[0-9]+)" +
    "|" +
    "(?<slide_id>[^0-9#@<][^#@<]*)" +
    ")?" +
    // Build step spec
    "(?:" +
    "(?:#(?<step_index>[0-9]+))" +
    "|" +
    "(?:<(?<step_number>[-+]?[0-9]+)>)" +
    "|" +
    "(?:@(?<step_tag>[^\\s<>.@]+))" +
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
 * When an unknown slide_id is given, returns null. Conversely an unknown build
 * step tag or out-of-range build step number is given, the step is treated as
 * zero instead.
 *
 * @param currentSlide The current 0-indexed slide number.
 * @param slideIds A Map() from slide ID to slide index.
 * @param slideBuildStepNumbers An array of arrays giving the
 *        (not-necessarily-zero-indexed) step numbers of each step for each
 *        slide.
 * @param slideBuildStepTags An array of Map() from tag to an array of step
 *        indices, one per slide.
 */
export function parseUrlHash(
  hash: string,
  currentSlide: number,
  slideIds: Map<string, number>,
  slideBuildStepNumbers: number[][],
  slideBuildStepTags: Map<string, number[]>[],
): [number, number] | null {
  const match = LINK_REGEX.exec(hash);
  if (match === null) {
    return null;
  }
  const groups = match.groups!;

  // Work out slide index
  let slide = currentSlide;
  if (groups.slide_index !== undefined) {
    slide = parseInt(groups.slide_index) - 1;
  } else if (groups.slide_id !== undefined) {
    const slideId = groups.slide_id;
    if (slideIds.has(slideId)) {
      slide = slideIds.get(slideId)!;
    } else {
      // Unknown slide ID
      return null;
    }
  }

  // Work out step index
  let step = 0;
  if (groups.step_index !== undefined) {
    step = parseInt(groups.step_index) - 1;
  } else if (groups.step_number !== undefined) {
    if (slide < slideBuildStepNumbers.length) {
      step = slideBuildStepNumbers[slide].indexOf(parseInt(groups.step_number));
      if (step < 0) {
        // Treat non-existant step number as zero
        step = 0;
      }
    }
  } else if (groups.step_tag !== undefined) {
    if (slide < slideBuildStepTags.length) {
      const tag = groups.step_tag;
      if (slideBuildStepTags[slide].has(tag)) {
        step = slideBuildStepTags[slide].get(tag)![0];
      }
    }
  }

  return [slide, step];
}
