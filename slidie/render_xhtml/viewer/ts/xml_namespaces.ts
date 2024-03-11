export type NamespaceName =
  | "svg"
  | "xhtml"
  | "xlink"
  | "inkscape"
  | "sodipodi"
  | "slidie";

/**
 * XML namespace resolver for namespaces used by Slidie SVGs (and this
 * viewer).
 */
export default function ns(name: NamespaceName): string {
  return {
    svg: "http://www.w3.org/2000/svg",
    xhtml: "http://www.w3.org/1999/xhtml",
    xlink: "http://www.w3.org/1999/xlink",
    inkscape: "http://www.inkscape.org/namespaces/inkscape",
    sodipodi: "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
    slidie: "http://xmlns.jhnet.co.uk/slidie/1.0",
  }[name];
}
