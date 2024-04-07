/**
 * This module implements scaling of <foreignObject> elements such that thier
 * contents are shown a native size (or some multiple thereof).
 */
import ns from "./xmlNamespaces.ts";

/**
 * Return the DOMMatrix which represents the Current Transform Matrix (from the
 * object's coordinate system to the top level user units (i.e. within the
 * viewBox, not on the screen)).
 *
 * By contrast with the built-in getCTM() method, this function uses only the
 * transforms statically declared in the SVG meaning it can be used on
 * non-displayed SVGs.  This does mean that the matrix returned does not
 * account for other (e.g. CSS-applied) transforms.
 */
export function getSvgStaticCTM(elem: SVGGraphicsElement) {
  // Get the parents in root-to-leaf order
  const parents = [elem];
  while (parents[0].parentElement) {
    // XXX: Typescript type for SVGGraphicsElement.parentElement is incorrect
    // here
    parents.splice(
      0,
      0,
      parents[0].parentElement as Element as SVGGraphicsElement,
    );
  }
  // Drop the top level 'svg' element since its transform matrix applies to
  // the final SVG canvas, not to elements within it.
  parents.splice(0, 1);

  // Assemble a DOMMatrix from all of the transforms
  const ctm = new DOMMatrix();
  for (const elem of parents) {
    for (const transform of elem.transform.baseVal) {
      ctm.multiplySelf(transform.matrix);
    }
  }
  return ctm;
}

/**
 * Return the size of user units in an SVG in pixels in the X and Y axes
 * (respectively) in a 2-element array.
 */
export function getSvgUserUnitSize(svg: SVGSVGElement): [number, number] {
  if (svg.viewBox.baseVal === null) {
    // Special case: viewBox not defined, the SVG is rendered with one user
    // unit per pixel
    return [1, 1];
  }

  const svgWidth = svg.width.baseVal.value;
  const svgHeight = svg.height.baseVal.value;

  const svgVBWidth = svg.viewBox.baseVal.width;
  const svgVBHeight = svg.viewBox.baseVal.height;

  const hScale = svgWidth / svgVBWidth;
  const vScale = svgHeight / svgVBHeight;

  const par = svg.preserveAspectRatio.baseVal;
  if (par.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE) {
    // Case: Uniform scaling not used so whatever distorted aspect ratio we
    // happen to have is what we'll get
    return [hScale, vScale];
  } else {
    // Case: Uniform scaling used.
    const viewBoxWiderThanSVG = svgVBWidth / svgVBHeight > svgWidth / svgHeight;
    const meet =
      par.meetOrSlice === SVGPreserveAspectRatio.SVG_MEETORSLICE_MEET;
    if (meet == viewBoxWiderThanSVG) {
      return [hScale, hScale];
    } else {
      return [vScale, vScale];
    }
  }
}

/**
 * Return the width and height, in SVG pixels, of the provided element after
 * all relevant transform matrices have been applied.
 */
export function getForeignObjectSizePx(
  elem: SVGForeignObjectElement,
): [number, number] {
  const ctm = getSvgStaticCTM(elem);

  const [sx, sy] = getSvgUserUnitSize(elem.ownerSVGElement!);
  ctm.scaleSelf(sx, sy);

  const topLeft = ctm.transformPoint(
    new DOMPoint(elem.x.baseVal.value, elem.y.baseVal.value),
  );
  const topRight = ctm.transformPoint(
    new DOMPoint(
      elem.x.baseVal.value + elem.width.baseVal.value,
      elem.y.baseVal.value,
    ),
  );
  const bottomLeft = ctm.transformPoint(
    new DOMPoint(
      elem.x.baseVal.value,
      elem.y.baseVal.value + elem.height.baseVal.value,
    ),
  );

  const dxW = topRight.x - topLeft.x;
  const dyW = topRight.y - topLeft.y;
  const width = Math.sqrt(dxW * dxW + dyW * dyW);

  const dxH = bottomLeft.x - topLeft.x;
  const dyH = bottomLeft.y - topLeft.y;
  const height = Math.sqrt(dxH * dxH + dyH * dyH);

  return [width, height];
}

/**
 * Scale a <foreignObject> element's contents according to the "native" size
 * of the SVG. That is, if the SVG is viewed at native size, the
 * <foreignObject> contents will be shown at native size too (regardless of any
 * scaling applied to the <foreignObject> element within the SVG).
 *
 * The scaling factor can be adjusted with the 'scale' argument. For example,
 * setting this to 2 will cause the contents of the <foreignObject> to be shown
 * at double native size (when the SVG is viewed at native size).
 */
export function scaleForeignObjectContents(
  foreignObject: SVGForeignObjectElement,
  scale: number = 1.0,
) {
  // The size of pixels within a <foreignObject> is determined by its width and
  // height attributes. This means that if we have an <iframe> in a
  // <foreignObject> with a width of 300 and height of 200, the iframe will
  // be rendered as if on a 300x200 pixel display.
  //
  // Unfortunately, the width/height of a <foreignObject> is ordinarily given
  // with reference to the local coordinate system potentially under the
  // effect of some artbirary transformation matrix. This usually results in
  // entirely unpredictable rendering sizes.
  //
  // To work around this we can set the width/height attributes to the
  // desired size in pixels and then add a scale transform to resize the
  // elemnt back to its original size.

  // First we'll grab the actual size in pixels of the element after all
  // transforms are applied.
  const [widthPx, heightPx] = getForeignObjectSizePx(foreignObject);

  // Next we'll adjust this to achieve the desired scaling factor
  const width = widthPx / scale;
  const height = heightPx / scale;

  // Next we'll set the size attributes of the <foreignObject> to its size in
  // pixels so that its contents are rendered at "native" size
  const widthOrig = parseFloat(foreignObject.getAttribute("width")!);
  const heightOrig = parseFloat(foreignObject.getAttribute("height")!);
  foreignObject.setAttribute("width", width.toString());
  foreignObject.setAttribute("height", height.toString());

  // Compute the corrective scale factor to restore the intended size of the
  // <foreignObject>
  const sx = widthOrig / width;
  const sy = heightOrig / height;

  // We'll also need to move any x and y attributes into a translate
  // transform which happens prior to scaling to avoid needing to scale these
  // too.
  const x = parseFloat(foreignObject.getAttribute("x") || "0");
  const y = parseFloat(foreignObject.getAttribute("y") || "0");
  foreignObject.removeAttribute("x");
  foreignObject.removeAttribute("y");

  // Finally apply the corrective transform
  const existingTransform = foreignObject.getAttribute("transform") || "";
  foreignObject.setAttribute(
    "transform",
    `${existingTransform} translate(${x}, ${y}) scale(${sx}, ${sy})`,
  );
}

/**
 * Scale the contents of all <foreignObject> elements with a slidie:scale
 * attribute such that their contents are displayed at the indicated proportion
 * of native size when the slide is viewed at native size.
 */
export function setupForeignObjectScaling(svg: SVGSVGElement) {
  // XXX: Typescript incorrectly types getElementsByTagNameNS on an SVG as
  // returning a HTMLCollectionOf which can only hold HTMLElements (of which
  // SVGForeignObjectElement is not a decendent)
  for (const foreignObject of svg.getElementsByTagNameNS(
    ns("svg"),
    "foreignObject",
  ) as unknown as HTMLCollectionOf<SVGForeignObjectElement>) {
    if (foreignObject.hasAttributeNS(ns("slidie"), "scale")) {
      const scale = parseFloat(
        foreignObject.getAttributeNS(ns("slidie"), "scale")!,
      );
      scaleForeignObjectContents(foreignObject, scale);
    }
  }
}
