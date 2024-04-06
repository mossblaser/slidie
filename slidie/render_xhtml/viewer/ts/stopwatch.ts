/**
 * State machine implementing a simple stopwatch-style timer.
 */

/**
 * Given a duration in milliseconds, format this in human-readable terms of
 * hours, minutes and seconds.
 */
export function formatDuration(milliseconds: number): string {
  let seconds = Math.floor(milliseconds / 1000);

  const hours = Math.floor(seconds / (60 * 60));
  seconds -= hours * 60 * 60;

  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;

  const hh = hours.toString();
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hh}:${mm}:${ss}`;
  } else {
    return `${minutes}:${ss}`;
  }
}

/**
 * Simple state machine for a stopwatch-style timer intended for the presenter
 * view.
 */
export class Stopwatch {
  protected timerRunning: boolean;
  protected timerStart: number;
  protected timerEnd: number;

  constructor(timerRunning: boolean = false) {
    this.timerStart = Date.now();
    this.timerEnd = this.timerStart;
    this.timerRunning = timerRunning;
  }

  get running(): boolean {
    return this.timerRunning;
  }

  /** Pause the timer. */
  pause() {
    if (this.timerRunning) {
      this.timerEnd = Date.now();
      this.timerRunning = false;
    }
  }

  /** Resume the timer. */
  resume() {
    if (!this.timerRunning) {
      const now = Date.now();
      this.timerStart += now - this.timerEnd;
      this.timerEnd = now;
      this.timerRunning = true;
    }
  }

  /** Toggle the pause state. Returns 'true' iff now running. */
  togglePause() {
    if (this.timerRunning) {
      this.pause();
    } else {
      this.resume();
    }

    return this.timerRunning;
  }

  /** Reset the timer */
  reset() {
    this.timerStart = Date.now();
    this.timerEnd = this.timerStart;
  }

  /** Return the number of milliseconds on the timer. */
  read(): number {
    if (this.timerRunning) {
      this.timerEnd = Date.now();
    }
    return this.timerEnd - this.timerStart;
  }
}
