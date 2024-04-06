/**
 * Misc browser bug workarounds.
 */

import ns from "./xmlNamespaces.ts";

/**
 * Workaround for spec bug/shortcoming which causes the declarative shadow DOM
 * mechanism not to work in XHTML documents.
 *
 * Bonus: This also works as a polyfill for older browsers which don't support
 * the declarative shadow DOM feature.
 *
 * As of March 2024, this bug appears to effect all the major browser families:
 *
 * * HTML Spec: https://github.com/whatwg/html/issues/10237
 * * Firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1887436
 * * Chromium: https://issues.chromium.org/issues/330967152
 * * Epiphany (WebKit): https://bugs.webkit.org/show_bug.cgi?id=271645
 */
export function workaroundDeclarativeShadowDOMXHTMLBug(
  root: Document | DocumentFragment = document,
) {
  for (const template of root.querySelectorAll(
    "template[shadowrootmode]",
  ) as NodeListOf<HTMLTemplateElement>) {
    if (template.namespaceURI === ns("xhtml")) {
      // Work-around bug which prevents us attaching a shadow root in Chrome
      const parentNode = workaroundAttachShadowToNamespacedNodeBug(
        template.parentNode as HTMLElement,
      );

      const mode = template.getAttribute("shadowrootmode")! as ShadowRootMode;
      const shadowRoot = parentNode.attachShadow({ mode });
      shadowRoot.appendChild(template.content);
      template.remove();

      // Also workaround bugs resulting from having moved a video into a
      // shadow root...
      workaroundVideoMovedFromTemplateBug(shadowRoot);

      // Recurse
      workaroundDeclarativeShadowDOMXHTMLBug(shadowRoot);
    }
  }
}

/**
 * Workaround for bug which causes <video> elements moved out of a <template>
 * to fail to resolve a valid media file.
 *
 * Apply this function to a shadow DOM immediately after populating it with
 * content moved out of a <template> to ensure all <video> elements can be
 * played.
 *
 * As of March 2024, this bug observed in:
 *
 * * Firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1887573
 * * Epiphany (WebKit): https://bugs.webkit.org/show_bug.cgi?id=271629
 */
export function workaroundVideoMovedFromTemplateBug(
  root: Document | DocumentFragment,
) {
  for (const videoElem of root.querySelectorAll("video")) {
    if (videoElem.namespaceURI === ns("xhtml")) {
      const innerHTML = videoElem.innerHTML;
      videoElem.innerHTML = "";
      videoElem.innerHTML = innerHTML;
    }
  }
}

/**
 * Workaround for bug which prevents Chrome attaching a shadow DOM to an
 * element if it has an XML namespace in the tag name.
 *
 * Replaces the provided element with one without a namespace name in the tag
 * name. Returns the new element. The existing element is removed from the DOM
 * and all children migrated.
 *
 * This bug only appears to effect Chrome as of March 2024:
 * https://issues.chromium.org/issues/331239166
 */
export function workaroundAttachShadowToNamespacedNodeBug<T extends Element>(
  elem: T,
): T {
  // Create replacement element
  const replacement = elem.ownerDocument.createElementNS(
    elem.namespaceURI,
    elem.localName,
  ) as T;
  elem.parentNode!.insertBefore(replacement, elem);
  // ...migrating the existing attributes
  for (let i = 0; i < elem.attributes.length; i++) {
    const { namespaceURI, localName } = elem.attributes.item(i)!;
    replacement.attributes.setNamedItemNS(
      elem.attributes.removeNamedItemNS(namespaceURI, localName),
    );
  }
  // ...and children
  replacement.append(...elem.childNodes);

  elem.remove();

  return replacement;
}

/**
 * Workaround for bug which causes hyperlinks in an SVG targeting an iframe to
 * open a new tab rather than navigating within the iframe.
 *
 * As of March 2024, this bug only appears to effect Firefox:
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1887648
 */
export function workaroundSVGLinkTargetBug(svg: SVGSVGElement) {
  // Create a lookup from name to iframe for this SVG
  const iframes: Map<string, HTMLIFrameElement> = new Map();
  for (const iframe of svg.getElementsByTagNameNS(
    ns("xhtml"),
    "iframe",
  ) as HTMLCollectionOf<HTMLIFrameElement>) {
    const name = iframe.getAttribute("name");
    if (name) {
      iframes.set(name, iframe);
    }
  }

  // Manually handle opening of links targeting an iframe
  for (const link of svg.getElementsByTagNameNS(ns("svg"), "a")) {
    link.addEventListener("click", (evt) => {
      const href =
        link.getAttributeNS(ns("xlink"), "href") || link.getAttribute("href");
      const target = link.getAttribute("target");
      if (href && target) {
        const iframe = iframes.get(target);
        if (iframe) {
          iframe.contentWindow!.location = href;
          evt.preventDefault();
        }
      }
    });
  }
}
