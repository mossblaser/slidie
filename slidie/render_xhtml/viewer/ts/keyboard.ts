/**
 * A tiny stub of a framework for processing key presses.
 */

export interface KeyboardShortcut {
  // A list of key names for keys to match (e.g.['PageDown', 'J'] will match
  // PageDown or the J key.). The case of letter names is ignored (e.g. 'T' and
  // 't' both currently match a press of the 'T' key regardless of whether
  // shift or capslock are pressed.)
  //
  // Modifiers are not currently supported: if a modifier key is pressed, the
  // shortcut will never match.
  keys: string[];
}

/**
 * Given a KeyboardEvent, match it against one of the provided shortcut
 * definitions.
 */
export function matchKeypress<T extends KeyboardShortcut>(
  evt: KeyboardEvent,
  shortcuts: T[],
): T | null {
  // For now we don't support matching on modifiers so just check none are
  // pressed. (NB: We ignore shift/capslock as a special case.)
  if (evt.altKey || evt.ctrlKey || evt.metaKey) {
    return null;
  }

  for (const entry of shortcuts) {
    for (const key of entry.keys) {
      if (key.match(/^[a-zA-Z]$/) !== null) {
        // Special case: Case-insensitive comparison of single letter keys
        if (key.toLowerCase() == evt.key.toLowerCase()) {
          return entry;
        }
      } else if (key == evt.key) {
        return entry;
      }
    }
  }

  // No match
  return null;
}
