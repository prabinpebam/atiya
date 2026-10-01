/**
 * The top bar's save status (documentation/editor/spec.md §2.1), as words: pure, so the unit tests hold
 * it. A screen is in one save state at a time; "saved" also says how long ago, the way a document app
 * does ("Saved just now", "Saved 3 min ago", then the time).
 */

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'offline';

/** What each state says (a failed save and unsaved changes can say more: why, or what's unsaved). */
export const SAVE_TEXT: Record<SaveState, string> = {
  idle: 'All changes saved',
  dirty: 'Unsaved changes',
  saving: 'Saving\u2026',
  saved: 'Saved',
  failed: 'Not saved',
  offline: "Offline: the dev server isn't answering, so nothing saves",
};

/** How long ago a save was, for the line beside "Saved". */
export function savedLine(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const d = new Date(at);
  return `at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
