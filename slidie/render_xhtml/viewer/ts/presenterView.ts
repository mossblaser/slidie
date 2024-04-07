/**
 * Implementation of the presenter view UI.
 */
import {
  connectStepperToSpeakerNotes,
  setupMouseClicks,
  toggleDialog,
} from "./app.ts";
import { keyboardEventInterferesWithHyperlink } from "./eventFilters.ts";
import { KeyboardShortcut, matchKeypress } from "./keyboard.ts";
import { Stepper, StepperState } from "./stepper.ts";
import { Stopwatch, formatDuration } from "./stopwatch.ts";
import { toUrlHash } from "./urlHashes.ts";

/**
 * Wrapper around window.open which will return focus (and return) the same
 * window previously created with the same target if it is still open.
 *
 * Returns a [window, newlyOpened] pair.
 */
function openOrFocusWindow(
  url: string,
  target: string,
  windowFeatures: string = "",
): [WindowProxy, boolean] {
  const existingWindows: Map<string, WindowProxy> =
    (openOrFocusWindow as any).existingWindows || new Map();
  (openOrFocusWindow as any).existingWindows = existingWindows;

  // Focus an existing presenter view window if present
  const existingWindow = existingWindows.get(target);
  if (existingWindow && !existingWindow.closed) {
    existingWindow.focus();
    return [existingWindow, false];
  }

  // Otherwise open a new window
  const wnd = window.open(url, target, windowFeatures)!;
  existingWindows.set(target, wnd);
  return [wnd, true];
}

/**
 * Show the current slide number in the provided presenter view.
 */
function connectStepperToPresenterViewSlideNumber(
  stepper: Stepper,
  slides: { svgs: SVGSVGElement[] },
  presenterViewDocument: HTMLDocument,
) {
  const slideCount = presenterViewDocument.querySelector(
    "#slide-count",
  )! as HTMLElement;
  const slideNumber = presenterViewDocument.querySelector(
    "#slide-number",
  )! as HTMLElement;

  // Show the slide count
  slideCount.innerText = slides.svgs.length.toString();

  // Show current slide number
  function showSlideNumber(state: StepperState) {
    slideNumber.innerText = toUrlHash(state.slide, state.step).slice(1);
  }
  stepper.onChange(showSlideNumber);
  showSlideNumber(stepper.state);
}

/**
 * Show the current and next slide thumbnails in the presenter view.
 */
function connectStepperToPresenterViewThumbnails(
  stepper: Stepper,
  slides: { buildStepNumbers: number[][] },
  presenterViewDocument: HTMLDocument,
) {
  // Grab the thumbnail Image elements from the main Slidie window (as a flat
  // array).
  //
  // Storing references to the Image elments avoids both keeping an extra copy
  // of the thumbnail data URLs hanging around or manually extracting them from
  // slide SVGs on every step.
  const flatThumbnails = Array.from(
    document.querySelectorAll("#thumbnails .thumbnail img"),
  ) as HTMLImageElement[];

  // Assemble a [slide][step] -> {now: Image, next: Image|null} lookup
  type NowNext = { now: HTMLImageElement; next: HTMLImageElement | null };
  const thumbnails: NowNext[][] = slides.buildStepNumbers.map((stepNumbers) =>
    stepNumbers.map(() => ({
      now: flatThumbnails.shift()!,
      next: flatThumbnails[0] || null,
    })),
  );

  const nowImage = presenterViewDocument.getElementById(
    "thumbnail-now",
  )! as HTMLImageElement;
  const nextImage = presenterViewDocument.getElementById(
    "thumbnail-next",
  )! as HTMLImageElement;

  function showNowNextThumbnails(state: StepperState) {
    const { now, next } = thumbnails[state.slide][state.step];
    nowImage.src = now.src;
    if (next !== null) {
      nextImage.src = next.src;
    } else {
      nextImage.src = "";
    }
  }
  stepper.onChange(showNowNextThumbnails);
  showNowNextThumbnails(stepper.state);
}

/**
 * Display the time and stopwatch, along with control buttons.
 */
function connectStopwatchToPresenterView(
  stopwatch: Stopwatch,
  presenterViewDocument: HTMLDocument,
) {
  const clockElem = presenterViewDocument.getElementById("clock")!;
  const timerElem = presenterViewDocument.getElementById("timer")!;
  const pauseButton = presenterViewDocument.getElementById("timer-pause")!;
  const resetButton = presenterViewDocument.getElementById("timer-reset")!;

  // Continuously refresh time
  function updateTimers() {
    clockElem.innerText = new Date().toLocaleTimeString();
    timerElem.innerText = formatDuration(stopwatch.read());

    if (stopwatch.running) {
      pauseButton.innerText = "Pause";
      pauseButton.classList.add("pause");
      pauseButton.classList.remove("resume");
    } else {
      if (stopwatch.read() == 0) {
        pauseButton.innerText = "Start";
      } else {
        pauseButton.innerText = "Resume";
      }
      pauseButton.classList.add("resume");
      pauseButton.classList.remove("pause");
    }
  }
  window.setInterval(updateTimers, 1000);
  updateTimers();

  // Setup buttons
  pauseButton.addEventListener("click", (evt) => {
    stopwatch.togglePause();
    updateTimers();
    evt.stopPropagation();
  });
  resetButton.addEventListener("click", (evt) => {
    stopwatch.reset();
    updateTimers();
    evt.stopPropagation();
  });
}

/**
 * Defines the keyboard shortcuts specifically for presenter view
 */
interface PresenterViewKeyboardShortcut extends KeyboardShortcut {
  // Displayed in the 'help' dialog
  description: string;

  // Called on matching keypress
  action: (helpDialog: HTMLDialogElement) => void;
}
const PRESENTER_VIEW_KEYBOARD_SHORTCUTS: PresenterViewKeyboardShortcut[] = [
  {
    description: "Show help",
    keys: ["F1", "?"],
    action: (helpDialog) => toggleDialog(helpDialog),
  },
];

/** Clone an event object to enable it to be re-dispatched. */
function cloneEvent<T extends Event>(evt: T): T {
  // @ts-expect-error: Typescript doesn't realise we have access to the
  // constructor...
  return new evt.constructor(evt.type, evt);
}

/**
 * Connect up all keyboard shortcuts in the presenter view UI.
 *
 * Forwards all unrecognised keyboard shortcuts back to the main window.
 */
function setupPresenterViewKeyboardShortcuts(
  presenterViewWindow: WindowProxy,
  helpDialog: HTMLDialogElement,
) {
  presenterViewWindow.addEventListener("keydown", (evt) => {
    if (keyboardEventInterferesWithHyperlink(evt)) {
      return;
    }

    const match = matchKeypress(evt, PRESENTER_VIEW_KEYBOARD_SHORTCUTS);
    if (match !== null) {
      match.action(helpDialog);
      evt.preventDefault();
      evt.stopPropagation();
    } else {
      window.dispatchEvent(cloneEvent(evt));
    }
  });
}

/**
 * Create (or focus an existing) presenter view window and link it up to the
 * main Slidie UI. Returns a reference to the created window.
 */
export function showPresenterView(
  stepper: Stepper,
  slides: { svgs: SVGSVGElement[]; buildStepNumbers: number[][] },
  stopwatch: Stopwatch,
) {
  const [wnd, newlyOpened] = openOrFocusWindow(
    "",
    "presenter-view",
    "popup=true",
  );

  if (!newlyOpened) {
    // Don't re-populate existing window!
    return;
  }

  // Close the presenter view if the main Slidie window navigates away
  window.addEventListener("pagehide", () => wnd.close());

  // Instantiate the presenter view template
  const presenterViewTemplaate = document.getElementById(
    "presenter-view-template",
  ) as HTMLTemplateElement;
  const root = (presenterViewTemplaate.content.cloneNode(true) as HTMLElement)
    .firstElementChild!;
  wnd.document.removeChild(wnd.document.firstElementChild!);
  wnd.document.appendChild(root);

  // Copy the (presumed fully-populated) help dialog from the main window
  const helpDialog = document
    .getElementById("help")!
    .cloneNode(true) as HTMLDialogElement;
  helpDialog.close(); // Incase it is already open
  wnd.document.body.appendChild(helpDialog);

  // Setup UI
  connectStepperToPresenterViewSlideNumber(stepper, slides, wnd.document);
  connectStepperToSpeakerNotes(
    stepper,
    slides,
    wnd.document.getElementById("notes")!,
  );
  connectStepperToPresenterViewThumbnails(stepper, slides, wnd.document);
  connectStopwatchToPresenterView(stopwatch, wnd.document);

  // Setup keyboard and mouse shortcuts
  setupMouseClicks(stepper, wnd);
  setupPresenterViewKeyboardShortcuts(wnd, helpDialog);
}
