import ns from "./xmlNamespaces.ts";

/**
 * Given an Event, test whether that event involves any kind of hyperlink or
 * button not (specifically an XHTML or SVG <a> or <button> tag). If
 * it does, returns true.  Otherwise returns false.
 */
export function eventInvolvesHyperlinkOrButton(evt: Event): boolean {
  for (const elem of evt.composedPath() as HTMLElement[]) {
    if (
      ((elem.namespaceURI == ns("xhtml") || elem.namespaceURI == ns("svg")) &&
        elem.localName == "a") ||
      (elem.namespaceURI == ns("xhtml") && elem.localName == "button")
    ) {
      return true;
    }
  }
  return false;
}

export function eventInvolvesInput(evt: Event): boolean {
  for (const elem of evt.composedPath() as HTMLElement[]) {
    if (elem.namespaceURI == ns("xhtml") && elem.localName == "input") {
      return true;
    }
  }
  return false;
}

/**
 * Given a keydown event, test whether handling this event may interfere with
 * keyboard operation of a <button>, hyperlink or <input>.
 */
export function keyboardEventInterferesWithElement(
  evt: KeyboardEvent,
): boolean {
  if (eventInvolvesInput(evt)) {
    return true;
  }

  switch (evt.key) {
    case "Enter":
    case "Space":
      return eventInvolvesHyperlinkOrButton(evt);

    default:
      return false;
  }
}
