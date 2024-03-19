/**
 * The SlideLookups object provides a kitchen-sink of lookup mappings from
 * slide/step numbers to slides/SVG elements. Since many UI functions require
 * some combination of these, this singular object provides a conventient way
 * to pass these around and reuse them.
 */

import ns from "./xmlNamespaces.ts";
import {
  BuildStepVisibility,
  findBuildSteps,
  layerStepNumbers,
  layerStepTags,
} from "./buildSteps.ts";

/**
 * Extract the ID assigned to a slide.
 */
function getSlideId(svg: SVGSVGElement): string | null {
  if (svg.hasAttributeNS(ns("slidie"), "id")) {
    return svg.getAttributeNS(ns("slidie"), "id");
  } else {
    return null;
  }
}

/**
 * Given a series of slides, return a lookup from slide ID to slide index.
 */
function makeIdToSlideLookup(slides: SVGSVGElement[]): Map<string, number> {
  return new Map(
    slides
      .map((svg, slide) => [getSlideId(svg), slide] as [string | null, number])
      .filter(([id]) => id !== null),
  ) as Map<string, number>;
}

/**
 * A collection of lookups relating to slides in the currently loaded
 * presentation.
 */
export class SlideLookups {
  /**
   * Takes the SVGs (one per slide) and their corresponding container elements,
   * e.g. as produced by loadSlidesIntoContainers.
   */
  constructor(svgs: SVGSVGElement[], containers: HTMLDivElement[]) {
    this.svgs = svgs;
    this.containers = containers;

    this.buildSteps = this.svgs.map((slide) => findBuildSteps(slide));
    this.buildStepTags = this.buildSteps.map((buildSteps) =>
      layerStepTags(buildSteps),
    );
    this.buildStepNumbers = this.buildSteps.map((buildSteps) =>
      layerStepNumbers(buildSteps),
    );
    this.buildStepCounts = this.buildStepNumbers.map(
      (numbers) => numbers.length,
    );

    this.ids = makeIdToSlideLookup(this.svgs);
  }

  // The SVG for each slide
  svgs: SVGSVGElement[];

  // The container <div> hosting the shadow DOM for each slide
  containers: HTMLDivElement[];

  // For each slide, gives the number of build steps (one or more).
  buildStepCounts: number[];

  // For each slide, the visibility information for each layer controlled by a
  // build step.
  buildSteps: BuildStepVisibility[][];

  // For each slide, the list of (not-necessarily-zero-indexed) build step
  // numbers (in order).
  buildStepNumbers: number[][];

  // For each slide, lookup from tag to list of step indices with that tag.
  buildStepTags: Map<string, number[]>[];

  // Lookup from slide ID to slide index
  ids: Map<string, number>;
}
