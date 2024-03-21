/**
 * Make a HTML element resizable by dragging any visible CSS border.
 *
 * NB: Currently only top/right border dragging is implemented.
 */
export function resizeOnBorderDrag(elem: HTMLElement) {
  // Show resize cursor when mouse over borders
  elem.addEventListener("mousemove", (evt) => {
    if (evt.offsetX - elem.clientWidth >= 0) {
      elem.style.cursor = "ew-resize";
    } else if (evt.offsetY < 0) {
      elem.style.cursor = "ns-resize";
    } else {
      // NB: Bottom/left edges not implemented...
      elem.style.cursor = "auto";
    }
  });

  // Implement resizing logic
  elem.addEventListener("mousedown", (evt) => {
    const style = getComputedStyle(elem);

    // Detect which adjustment is being made
    let adjust: "width" | "height";
    let scale: number;
    if (style.borderRightStyle == "solid") {
      if (evt.offsetX - elem.clientWidth < 0) {
        return; // Click wasn't on right border
      }
      adjust = "width";
      scale = 1;
    } else if (style.borderTopStyle == "solid") {
      if (evt.offsetY >= 0) {
        return; // Click wasn't on top border
      }
      adjust = "height";
      scale = -1;
    } else {
      console.warn("Not implemented: Adjusting bottom/left edges!");
    }

    // If we get this far, we're going to begin resizing
    evt.preventDefault();
    evt.stopPropagation();

    let lastX = evt.clientX;
    let lastY = evt.clientY;
    let width = elem.offsetWidth;
    let height = elem.offsetHeight;

    // Adjust height/width accordingly
    function onMouseMove(evt: MouseEvent) {
      const deltaX = evt.clientX - lastX;
      const deltaY = evt.clientY - lastY;
      lastX = evt.clientX;
      lastY = evt.clientY;

      if (adjust == "width") {
        width += deltaX * scale;
        elem.style.width = `${width}px`;
      } else if (adjust == "height") {
        height += deltaY * scale;
        elem.style.height = `${height}px`;
      }

      evt.preventDefault();
      evt.stopPropagation();
    }
    function onMouseUp(evt: MouseEvent) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      evt.preventDefault();
      evt.stopPropagation();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseMove); // Apply final position
    window.addEventListener("mouseup", onMouseUp);
  });
}
