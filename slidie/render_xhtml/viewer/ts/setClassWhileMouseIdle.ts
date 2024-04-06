/**
 * Sets the specified class on the specified element whenever the mouse hasn't
 * moved over it in the last timeout milliseconds.
 */
export function setClassWhileMouseIdle(
  elem: HTMLElement,
  className: string = "mouse-idle",
  timeout: number = 2000,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  elem.addEventListener("mousemove", () => {
    elem.classList.remove(className);

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      elem.classList.add(className);
      timeoutId = null;
    }, timeout);
  });
}
