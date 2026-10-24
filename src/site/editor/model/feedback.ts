/**
 * Never a silent wait (documentation/editor/spec.md §2.2): the words the status line shows for the work
 * under way. Pure: the tracker in scripts/client.ts drives the timing and the marks; this says what the
 * line reads.
 */

/** How long a wait has taken, in words: "4 s", "1 min 5 s". */
export function elapsedText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}

export interface TaskView {
  /** What it's doing, as a verb under way ("Updating the canvas…"). */
  label: string;
  /** When it started (ms, the same clock as `now`). */
  started: number;
  /** How far along, 0 to 1, when it can say. */
  progress?: number | null;
}

/**
 * The status line for the waits shown: the latest one's words, how far along (when it can say), how long
 * it's taken once that passes `elapsedAfter`, and how many there are when there's more than one.
 */
export function taskLine(tasks: TaskView[], now: number, elapsedAfter = 3000): string {
  if (!tasks.length) return '';
  const t = tasks[tasks.length - 1];
  const words = t.label.replace(/[.…]+$/, '');
  const parts = [typeof t.progress === 'number' ? `${words}: ${Math.round(Math.min(1, Math.max(0, t.progress)) * 100)}%` : t.label];
  if (now - t.started >= elapsedAfter) parts[0] = parts[0].replace(/[.…]+$/, '');
  if (now - t.started >= elapsedAfter) parts.push(elapsedText(now - t.started));
  if (tasks.length > 1) parts.push(`${tasks.length} tasks`);
  return parts.join(' · ');
}

/** A CSS time (a token's value: "300ms", "2s") in milliseconds, or `fallback`. */
export function cssTime(value: string, fallback: number): number {
  const v = value.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}
const UNDER_WAY: Record<string, string> = { Saved: 'Saving', Added: 'Adding', Moved: 'Moving', Removed: 'Removing', Deleted: 'Deleting' };

/** A wait's words from what its status says once done: "Moved slide to place 2" is "Moving slide to place 2". */
export function underWay(done: string): string {
  const [first, ...rest] = done.split(' ');
  const verb = UNDER_WAY[first];
  return verb ? [verb, ...rest].join(' ') : `Saving: ${done}`;
}
