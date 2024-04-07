import { SlideChangeEvent } from "./slideChangeEvents.ts";
import ns from "./xmlNamespaces.ts";

/**
 * Setup automatic video play/pause on slide entry/exit for videos inserted
 * using magic text.
 */
export function setupMagicVideoPlayback(slide: SVGSVGElement) {
  for (const video of slide.getElementsByTagNameNS(
    ns("xhtml"),
    "video",
  ) as HTMLCollectionOf<HTMLVideoElement>) {
    if (video.hasAttributeNS(ns("slidie"), "magic")) {
      const start = parseFloat(
        video.getAttributeNS(ns("slidie"), "start") || "0",
      );
      const stepNumbers = JSON.parse(
        video.getAttributeNS(ns("slidie"), "steps") || "null",
      );

      video.currentTime = start;

      const onEnterOrChange = ({ stepNumber }: SlideChangeEvent) => {
        if (stepNumbers === null || stepNumbers.indexOf(stepNumber) >= 0) {
          video.play(); // NB: NOP if already playing
        } else {
          video.pause();
          video.currentTime = start;
        }
      };

      // @ts-expect-error: I CBA setting up type checking for custom events for now
      slide.addEventListener("slideenter", onEnterOrChange);
      // @ts-expect-error: I CBA setting up type checking for custom events for now
      slide.addEventListener("stepchange", onEnterOrChange);

      slide.addEventListener("slideleave", () => {
        video.pause();
        video.currentTime = start;
      });
    }
  }
}
