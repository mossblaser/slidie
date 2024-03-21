import ns from "./xmlNamespaces.ts";

/**
 * Given an Event, test whether that event involves any kind of hyperlink or
 * button not (specifically an XHTML or SVG <a> or <button> or <input> tag). If
 * it does, returns true.  Otherwise returns false.
 */
export function eventInvolvesHyperlink(evt: Event): boolean {
  for (const elem of evt.composedPath() as HTMLElement[]) {
    if (
      ((elem.namespaceURI == ns("xhtml") || elem.namespaceURI == ns("svg")) &&
        elem.localName == "a") ||
      (elem.namespaceURI == ns("xhtml") &&
        (elem.localName == "button" || elem.localName == "input"))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Given a keydown event, test whether handling this event may interfere with
 * keyboard operation of a <button> or hyperlink.
 */
export function keyboardEventInterferesWithHyperlink(
  evt: KeyboardEvent,
): boolean {
  switch (evt.key) {
    case "Enter":
    case "Space":
      return eventInvolvesHyperlink(evt);

    default:
      return false;
  }
}
