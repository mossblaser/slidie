/**
 * The main Slidie viewer application UI code.
 *
 * A good test of whether a function lives here or not is does it poke at
 * hard-coded element IDs and does it concern itself entirely with presentation
 * rather than other program logic. If the answers to these questions is yes,
 * this is probably the place.
 */
import { marked } from "marked";

import { BuildStepVisibility } from "./buildSteps.ts";
import {
  eventInvolvesHyperlinkOrButton,
  keyboardEventInterferesWithElement,
} from "./eventFilters.ts";
import { setupForeignObjectScaling } from "./foreignObjectScaling.ts";
import { KeyboardShortcut, matchKeypress } from "./keyboard.ts";
import { showPresenterView } from "./presenterView.ts";
import { resizeOnBorderDrag } from "./resizeOnBorderDrag.ts";
import { setClassWhileMouseIdle } from "./setClassWhileMouseIdle.ts";
import { connectStepperToSlideEvents } from "./slideChangeEvents.ts";
import { SlideLookups } from "./slideLookups.ts";
import { getSpeakerNotes } from "./speakerNotes.ts";
import { Stepper, StepperState } from "./stepper.ts";
import { Stopwatch } from "./stopwatch.ts";
import { getThumbnails } from "./thumbnails.ts";
import {
  enumerateAbsoluteHashes,
  parseUrlHash,
  toUrlHash,
} from "./urlHashes.ts";
import { setupMagicVideoPlayback } from "./video.ts";
import {
  workaroundDeclarativeShadowDOMXHTMLBug,
  workaroundSVGLinkTargetBug,
} from "./workarounds.ts";
import ns from "./xmlNamespaces.ts";

/**
 * Find the all slide SVGs within the document.
 */
function findSlides(): SlideLookups {
  const containers = Array.from(
    document.querySelectorAll("#slides .slide-container"),
  ) as HTMLElement[];

  const svgs = containers.map(
    (container) => container.shadowRoot!.firstElementChild!,
  ) as SVGSVGElement[];

  return new SlideLookups(svgs, containers);
}

/**
 * Show/hide slides (and build step controlled elements) based on the state of
 * the provided Stepper.
 */
function connectStepperToSlideVisibility(
  stepper: Stepper,
  slides: {
    containers: HTMLElement[];
    buildSteps: BuildStepVisibility[][];
  },
) {
  function updateVisibility(state: StepperState) {
    for (const [slide, container] of slides.containers.entries()) {
      // Set blanking mode
      container.style.visibility = state.blanked ? "hidden" : "visible";

      // Show only current slide
      container.style.display = state.slide == slide ? "block" : "none";
    }

    // Show only the appropriate build steps for the current slide
    for (const build of slides.buildSteps[state.slide]) {
      build.elem.style.display =
        build.steps.indexOf(state.step) >= 0 ? "block" : "none";
    }
  }

  updateVisibility(stepper.state);
  stepper.onChange(updateVisibility);
}

/**
 * Enable mouse-based resizing of the thumbnail/speaker notes panes.
 */
function makeViewerPanesResizable() {
  resizeOnBorderDrag(document.getElementById("thumbnails")!);
  resizeOnBorderDrag(document.getElementById("notes")!);
}

/** Toggle the visibility of a <dialog> element. */
export function toggleDialog(dialog: HTMLDialogElement) {
  if (dialog.open) {
    dialog.close();
  } else {
    dialog.showModal();
    dialog.focus();
  }
}

/** Toggles the open state of the help dialog */
function toggleHelp(document: HTMLDocument = window.document) {
  const dialog = document.getElementById("help") as HTMLDialogElement;
  toggleDialog(dialog);
}

/**
 * Toggle hiding the viewier UI.
 */
function toggleHideUI() {
  document.body.classList.toggle("hide-ui");
}

/**
 * Toggle full screen state of viewer (starts the stopwatch when entering full
 * screen mode).
 */
function toggleFullScreen(stopwatch: Stopwatch) {
  const slidePane = document.getElementById("slides")!;
  if (document.fullscreenElement === null) {
    slidePane.requestFullscreen();
    stopwatch.resume();
  } else {
    document.exitFullscreen();
  }
}

/**
 * Exit fullscreen and show the UI
 */
function exitFullScreenAndShowUI() {
  if (document.fullscreenElement !== null) {
    document.exitFullscreen();
  }
  document.body.classList.remove("hide-ui");
}

/**
 * Setup the click handlers for the toolbar buttons in the slidie viewer.
 */
function setupToolbarButtons(
  stepper: Stepper,
  slides: SlideLookups,
  stopwatch: Stopwatch,
) {
  const helpButton = document.getElementById("show-help")!;
  helpButton.addEventListener("click", () => toggleHelp());

  const presenterViewButton = document.getElementById("presenter-view")!;
  presenterViewButton.addEventListener("click", () =>
    showPresenterView(stepper, slides, stopwatch),
  );

  const hideUIButton = document.getElementById("hide-ui")!;
  hideUIButton.addEventListener("click", () => toggleHideUI());

  const fullScreenButton = document.getElementById("full-screen")!;
  fullScreenButton.addEventListener("click", () => toggleFullScreen(stopwatch));
}

/** Set the window title based on the slide metadata. */
function showTitle(slides: { svgs: SVGSVGElement[] }) {
  if (slides.svgs[0].hasAttributeNS(ns("slidie"), "title")) {
    const title = slides.svgs[0].getAttributeNS(ns("slidie"), "title")!;
    document.title = `${title} - ${document.title}`;
    document.getElementById("title")!.innerText = title;
  }
}

/**
 * Setup the help dialog
 */
function populateKeyboardHelp() {
  const container = document.getElementById("help-keyboard-shortcuts")!;
  for (const { keys, description } of KEYBOARD_SHORTCUTS) {
    const keysElem = document.createElementNS(ns("xhtml"), "dt");
    for (const [i, key] of keys.entries()) {
      if (i > 0) {
        keysElem.append(" or ");
      }
      const kbd = document.createElementNS(ns("xhtml"), "kbd") as HTMLElement;
      if (KEYBOARD_KEYS_TO_SYMBOLS.has(key)) {
        kbd.innerText = KEYBOARD_KEYS_TO_SYMBOLS.get(key)!;
      } else {
        kbd.innerText = key;
      }
      keysElem.append(kbd);
    }

    const descriptionElem = document.createElementNS(
      ns("xhtml"),
      "dd",
    ) as HTMLElement;
    descriptionElem.innerText = description;

    container.append(keysElem, descriptionElem);
  }
}

/** Create a thumbnail for a single step. */
function makeStepThumbnail(
  image: string,
  link: string,
  alt: string,
): DocumentFragment {
  const fragment = (
    document.getElementById("step-thumbnail")! as HTMLTemplateElement
  ).content.cloneNode(true) as DocumentFragment;

  const a = fragment.querySelector("a")!;
  a.href = link;

  const img = fragment.querySelector("img")!;
  img.src = image;
  img.alt = alt;

  return fragment;
}

/** Create the thumbnail group for all the steps in a slide. */
function makeSlideThumbnails(
  slide: number,
  numberTooltip: string,
  steps: {
    image: string;
    link: string;
  }[],
): DocumentFragment {
  const fragment = (
    document.getElementById("slide-thumbnails")! as HTMLTemplateElement
  ).content.cloneNode(true) as DocumentFragment;

  const number = fragment.querySelector(".slide-number")! as HTMLElement;
  number.innerText = (slide + 1).toString();
  number.title = numberTooltip;

  const stepThumbnailContainer = fragment.querySelector(".step-thumbnails")!;
  for (const [step, { image, link }] of steps.entries()) {
    stepThumbnailContainer.append(
      makeStepThumbnail(
        image,
        link,
        step == 0 ? `Slide {slide + 1}, step {step + 1}` : `Slide {slide + 1}`,
      ),
    );
  }

  return fragment;
}

/** Create the thumbnail group for all the steps in a slide. */
function showThumbnails(slides: { svgs: SVGSVGElement[] }) {
  const thumnailsContainer = document.getElementById("thumbnails")!;

  for (const [slide, svg] of slides.svgs.entries()) {
    const images = getThumbnails(svg);
    const sourceFilename = svg.getAttributeNS(ns("slidie"), "source")!;
    thumnailsContainer.append(
      makeSlideThumbnails(
        slide,
        sourceFilename,
        images.map(({ dataUrl }, step) => ({
          image: dataUrl,
          link: toUrlHash(slide, step),
        })),
      ),
    );
  }
}

/**
 * Highlight the current slide's thumbnails (and scroll it into view).
 */
function connectStepperToThumbnailHighlight(stepper: Stepper) {
  function updateHighlight(state: StepperState) {
    for (const [slide, stepsContainer] of Array.from(
      document.querySelectorAll(".step-thumbnails"),
    ).entries()) {
      for (const [step, stepContainer] of Array.from(
        stepsContainer.querySelectorAll(".thumbnail"),
      ).entries()) {
        if (slide === state.slide && step === state.step) {
          stepContainer.classList.add("selected");
          stepContainer.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
          stepContainer.classList.remove("selected");
        }
      }
    }
  }

  updateHighlight(stepper.state);
  stepper.onChange(updateHighlight);
}

/**
 * A wrapper around the Marked markdown parser which parses the generated HTML
 * and returns a NodeList of the corresponding elements.
 */
function markdownToElements(source: string): NodeList {
  const html = marked.parse(source) as string; // Not using async mode
  const mdDocument = new DOMParser().parseFromString(html, "text/html");
  return mdDocument.body.childNodes;
}

/**
 * Show the current slide's speaker notes (and highlight notes for the current
 * step).
 */
export function connectStepperToSpeakerNotes(
  stepper: Stepper,
  slides: { svgs: SVGSVGElement[]; buildStepNumbers: number[][] },
  notesContainer: HTMLElement,
) {
  function showSpeakerNotes(
    state: StepperState,
    lastState: StepperState | null,
  ) {
    const noteTemplate = document.getElementById(
      "note",
    )! as HTMLTemplateElement;

    const speakerNotes = getSpeakerNotes(slides.svgs[state.slide]);
    const stepNumber = slides.buildStepNumbers[state.slide][state.step];

    // On slide change, load the slide's notes
    if (lastState === null || state.slide !== lastState.slide) {
      while (notesContainer.lastChild) {
        notesContainer.removeChild(notesContainer.lastChild);
      }
      for (const { text } of speakerNotes) {
        const noteElem = noteTemplate.content.firstElementChild!.cloneNode(
          true,
        )! as HTMLElement;
        markdownToElements(text).forEach((n) => noteElem.appendChild(n));
        notesContainer.append(noteElem);
      }
    }

    // Highlight notes for current step
    for (const [i, { stepNumbers }] of speakerNotes.entries()) {
      const noteElem = notesContainer.childNodes[i] as HTMLElement;

      if (stepNumbers === null || stepNumbers.indexOf(stepNumber) >= 0) {
        noteElem.classList.add("current");
      } else {
        noteElem.classList.remove("current");
      }
    }
  }

  showSpeakerNotes(stepper.state, null);
  stepper.onChange(showSpeakerNotes);
}

/**
 * Connect a Stepper to the URL hash (bidirectionally).
 *
 * Do this first-thing after creating the stepper since it will immediately
 * switch to the slide indicated in the current URL hash and thus may give a
 * false slide transition.
 */
function connectStepperToHash(
  stepper: Stepper,
  slides: {
    ids: Map<string, number>;
    buildStepNumbers: number[][];
    buildStepTags: Map<string, number[]>[];
  },
) {
  /** Navigate to the step indicated in the URL hash. */
  function fromHash(state: StepperState | null = null) {
    const hash = decodeURI(window.location.hash);
    const slideStep = parseUrlHash(
      hash,
      state !== null ? state.slide : -1,
      slides.ids,
      slides.buildStepNumbers,
      slides.buildStepTags,
    );
    const valid =
      slideStep !== null && stepper.show(slideStep[0], slideStep[1], hash);

    // Invalid hash: reset to the current slide
    if (state !== null && !valid) {
      console.log(state.userUrlHash);
      window.location.hash =
        state.userUrlHash || toUrlHash(state.slide, state.step);
    }
  }

  /** Set the URL hash to match the stepper state */
  function toHash(state: StepperState) {
    window.location.hash =
      state.userUrlHash || toUrlHash(state.slide, state.step);
  }

  // Set the initial stepper position based on the URL hash (if possible).
  fromHash();
  // ...and then make sure the URL hash is set (in the event that it was
  // invalid or not set).
  toHash(stepper.state);

  // Connect up event listeners
  stepper.onChange(toHash);
  window.addEventListener("hashchange", () => fromHash(stepper.state));
}

/**
 * Connect the numerical slide selector/display box to the current slide show
 * position.
 */
function connectStepperToSlideSelector(
  stepper: Stepper,
  slides: {
    svgs: SVGSVGElement[];
    ids: Map<string, number>;
    buildStepNumbers: number[][];
    buildStepTags: Map<string, number[]>[];
  },
) {
  // Show the slide count
  const slideCount = document.querySelector(
    "#slide-selector .slide-count",
  )! as HTMLElement;
  slideCount.innerText = slides.svgs.length.toString();

  // Populate auto-complete for slide numbers
  const slideList = document.getElementById(
    "slide-list",
  )! as HTMLDataListElement;
  for (const value of enumerateAbsoluteHashes(slides.svgs)) {
    const option = document.createElementNS(
      ns("xhtml"),
      "option",
    ) as HTMLOptionElement;
    option.value = value.slice(1);
    slideList.appendChild(option);
  }

  const input = document.querySelector(
    "#slide-selector input.slide-number",
  )! as HTMLInputElement;

  /** Navigate to the step indicated in the input. */
  function fromInput(evt: Event, state: StepperState) {
    const hash = `#${input.value}`;
    const slideStep = parseUrlHash(
      hash,
      state.slide,
      slides.ids,
      slides.buildStepNumbers,
      slides.buildStepTags,
    );
    const valid =
      slideStep !== null && stepper.show(slideStep[0], slideStep[1], hash);

    if (valid) {
      input.blur();
      input.classList.remove("invalid");
    } else {
      input.classList.add("invalid");
    }
  }

  /** Set the input to match the stepper state */
  function toInput(state: StepperState) {
    const hash = state.userUrlHash || toUrlHash(state.slide, state.step);
    input.value = hash.slice(1);

    input.classList.remove("invalid");

    input.style.width = `${Math.max(3, input.value.length)}em`;
  }

  // Show the current location
  stepper.onChange(toInput);
  toInput(stepper.state);

  // Connect up event listeners
  input.addEventListener("change", (evt) => fromInput(evt, stepper.state));

  // Select existing text on focus
  input.addEventListener("focus", () => {
    input.select();
  });

  // On escape, reset to match current value and unfocus
  input.addEventListener("keydown", (evt) => {
    if (evt.key == "Escape") {
      toInput(stepper.state);
      input.blur();
    }
  });
}

/**
 * Defines the keyboard shortcuts supported by the viewer.
 */
interface ViewerKeyboardShortcut extends KeyboardShortcut {
  // Displayed in the 'help' dialog
  description: string;

  // Called on matching keypress
  action: (
    stepper: Stepper,
    slides: SlideLookups,
    stopwatch: Stopwatch,
  ) => void;
}
const KEYBOARD_SHORTCUTS: ViewerKeyboardShortcut[] = [
  {
    description: "Next step/slide",
    keys: ["Backspace", "ArrowUp", "ArrowLeft", "K"],
    action: (stepper) => stepper.previousStep(),
  },
  {
    description: "Previous step/slide",
    keys: ["Enter", "ArrowDown", "ArrowRight", "J"],
    action: (stepper) => stepper.nextStep(),
  },
  {
    description: "Jump to previous slide (skip build steps)",
    keys: ["PageUp"],
    action: (stepper) => stepper.previousSlide(),
  },
  {
    description: "Jump to next slide (skip build steps)",
    keys: ["PageDown"],
    action: (stepper) => stepper.nextSlide(),
  },
  {
    description: "Jump to start",
    keys: ["Home"],
    action: (stepper) => stepper.start(),
  },
  {
    description: "Jump to end",
    keys: ["End"],
    action: (stepper) => stepper.end(),
  },
  {
    description: "Black screen",
    keys: ["Z", "B", "."],
    action: (stepper) => stepper.toggleBlank(),
  },
  {
    description: "Toggle user interface",
    keys: ["U"],
    action: (_stepper, _slides, _stopwatch) => toggleHideUI(),
  },
  {
    description: "Toggle full screen",
    keys: ["F"],
    action: (_stepper, _slides, stopwatch) => toggleFullScreen(stopwatch),
  },
  {
    description: "Exit full screen and show UI",
    keys: ["Escape"],
    action: (_stepper, _slides, _stopwatch) => exitFullScreenAndShowUI(),
  },
  {
    description: "Open presenter view",
    keys: ["P"],
    action: (stepper, slides, stopwatch) =>
      showPresenterView(stepper, slides, stopwatch),
  },
  {
    description: "Show help",
    keys: ["F1", "?"],
    action: () => toggleHelp(),
  },
];

/**
 * Connect up all keyboard shortcuts in the UI.
 */
function setupKeyboardShortcuts(
  stepper: Stepper,
  slides: SlideLookups,
  stopwatch: Stopwatch,
) {
  window.addEventListener("keydown", (evt) => {
    if (keyboardEventInterferesWithElement(evt)) {
      return;
    }

    const match = matchKeypress(evt, KEYBOARD_SHORTCUTS);
    if (match !== null) {
      match.action(stepper, slides, stopwatch);
      evt.preventDefault();
      evt.stopPropagation();
    }
  });
}

/**
 * Setup mouse event handlers for changing slide.
 */
export function setupMouseClicks(
  stepper: Stepper,
  element: HTMLElement | Window | WindowProxy,
) {
  element.addEventListener("click", (evt) => {
    if (!eventInvolvesHyperlinkOrButton(evt)) {
      stepper.nextStep();
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }
  });
}

/**
 * Lookup table from KeyboardEvent key names to equivalent unicode symbols.
 */
const KEYBOARD_KEYS_TO_SYMBOLS = new Map<string, string>([
  ["ArrowLeft", "\u2190"],
  ["ArrowUp", "\u2191"],
  ["ArrowRight", "\u2192"],
  ["ArrowDown", "\u2193"],
  ["Backspace", "\u232B"],
  ["Enter", "\u23CE"],
]);

/**
 * The top-level function which starts the Slidie viewer app running.
 */
export default function app() {
  // Enumerate slides
  workaroundDeclarativeShadowDOMXHTMLBug();
  const slides = findSlides();

  // Workaround link targets in SVGs
  slides.svgs.map(workaroundSVGLinkTargetBug);

  // Setup extra SVG display features
  slides.svgs.map(setupForeignObjectScaling);
  slides.svgs.map(setupMagicVideoPlayback);

  // Setup Presentation state
  const stepper = new Stepper(slides.buildStepCounts);
  const stopwatch = new Stopwatch();

  // Setup slide changing
  connectStepperToSlideVisibility(stepper, slides);
  connectStepperToSlideEvents(stepper, slides);

  // Setup UI
  makeViewerPanesResizable();
  setupToolbarButtons(stepper, slides, stopwatch);
  showTitle(slides);
  populateKeyboardHelp();
  showThumbnails(slides);
  connectStepperToThumbnailHighlight(stepper);
  connectStepperToSpeakerNotes(
    stepper,
    slides,
    document.getElementById("notes")!,
  );
  connectStepperToHash(stepper, slides);
  connectStepperToSlideSelector(stepper, slides);

  const slidePane = document.getElementById("slides")!;

  // Hide idle mouse cursor when in full screen
  setClassWhileMouseIdle(slidePane);

  // Setup keyboard and mouse shortcuts
  setupKeyboardShortcuts(stepper, slides, stopwatch);
  setupMouseClicks(stepper, slidePane);
}
