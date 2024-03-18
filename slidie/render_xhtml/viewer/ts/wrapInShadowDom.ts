/**
 * Wraps an element in a shadow DOM within its parent document. Returns the
 * wrapper element.
 *
 * The tag argument sets the element type to use for the wrapper whilst the
 * className argument gives the class name(s) to assign to that element.
 *
 * The mode argument gives the shadow DOM mode to use, defaulting to open
 * (allowing access to the contained element from the containing page's
 * Javascript).
 *
 * NB: A declarative shadow DOM mechanism based on `<template
 * shadowdommode="...">` is gradually becoming available (see
 * https://caniuse.com/mdn-html_elements_template_shadowrootmode) but due to
 * its bleeding-edgeness it is not used here.
 */
export function wrapInShadowDom(
  elem: Element,
  className: string = "shadow-dom-wrapper",
  tag: string = "div",
  mode: "open" | "closed" = "open",
): Element {
  // Create container
  const container = document.createElement(tag);
  container.setAttribute("class", className);
  elem.parentNode!.insertBefore(container, elem);

  // Move elem into new shadow DOM
  const shadowDom = container.attachShadow({ mode });
  shadowDom.append(elem);

  return container;
}
