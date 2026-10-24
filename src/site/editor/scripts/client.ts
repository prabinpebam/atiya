/**
 * Edit mode's browser client: calls to the editor API (with the header the guard asks for, and this
 * tab's id, so a change this tab makes comes back to it as its own), the changes made elsewhere (another
 * tab, or a file changed by hand: the dev server pushes them to every open page), and the top bar's save
 * status. Every editor screen's script uses it.
 */
import { savedLine, SAVE_TEXT, type SaveState } from '../model/status';
import { cssTime, describeIssue, refusal, taskLine, type TaskView } from '../model/feedback';
import { ALWAYS, REGIONS_HEADER, regionsHeader } from '../model/regions';

export interface Issue {
  file: string;
  path?: string;
  message: string;
}

export interface Reply<T = Record<string, unknown>> {
  status: number;
  ok: boolean;
  data: T & { ok?: boolean; issues?: Issue[]; versions?: Record<string, string | null> };
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const editorUrl = (path = '') => `${BASE}/_edit/${path}`;

/** This page's id among the open editor pages: its saves come back to it as its own, not as news. */
export const TAB = crypto.randomUUID();

/** Calls the editor API. A body that's FormData goes as multipart; anything else as JSON. */
export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
  const headers: Record<string, string> = { 'X-Editor': '1', 'X-Editor-Tab': TAB };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined || method === 'POST' || method === 'PUT') {
    // the guard takes a POST or PUT only with a JSON (or multipart) body: an action with nothing to send sends {}
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body ?? {});
  }
  const res = await fetch(`${BASE}/_edit/api/${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  let data: Reply<T>['data'];
  try {
    data = await res.json();
  } catch {
    data = { ok: false, issues: [{ file: '', message: `the editor couldn't read the answer (${res.status})` }] } as Reply<T>['data'];
  }
  return { status: res.status, ok: res.ok && data.ok !== false, data };
}

/** A change pushed by the dev server: the files, the editor tab that made it (null: by hand), and the content generation it brought the content to. */
export interface ContentChange {
  files: string[];
  origin: string | null;
  generation?: number;
}

/** The content generation this screen was drawn at (the app's data-generation; a full redraw moves it on). */
const drawnAt = () => Number(document.querySelector<HTMLElement>('[data-editor-app]')?.dataset.generation ?? -1);

/**
 * Calls `fn` for every change to the content made somewhere else: another tab, another screen's save,
 * or a file changed by hand. This tab's own saves are left out, and so is a change the screen already
 * shows (it was drawn after it: a screen that reloads after its save hears the save late). Until
 * `signal` aborts.
 */
export function onContentChange(fn: (c: ContentChange) => void, signal: AbortSignal) {
  const hot = import.meta.hot;
  if (!hot) return;
  const heard = (d: Partial<ContentChange>) => {
    if (d.origin === TAB) return;
    if (typeof d.generation === 'number' && d.generation >= 0 && d.generation <= drawnAt()) return;
    fn({ files: d.files ?? [], origin: d.origin ?? null, generation: d.generation });
  };
  hot.on('site:content-changed', heard);
  signal.addEventListener('abort', () => hot.off?.('site:content-changed', heard));
}

// ---------- the save status ----------
// Two layers: the save state, which stays (unsaved, saving, saved and when, not saved, offline), and a
// note, which shows for a moment and then gives way to it again (Moved, Uploaded, Showing…).

const status = { state: 'idle' as SaveState, detail: '', savedAt: 0, offline: false, note: '', noteTone: 'default' as 'default' | 'negative', noteTimer: 0, tick: 0, leaving: false };
const CARRY = 'editor.saved';

function paint() {
  const box = document.querySelector<HTMLElement>('[data-editor-save]');
  const el = document.querySelector<HTMLElement>('[data-editor-status]');
  const time = document.querySelector<HTMLTimeElement>('[data-editor-save-time]');
  if (!el) return;
  const state: SaveState = status.offline ? 'offline' : status.state;
  const noting = !!status.note;
  if (box) {
    // the mark always shows the save state; the line shows a note while there is one
    box.dataset.state = noting && status.noteTone === 'negative' ? 'failed' : state;
    if (noting) box.dataset.note = '';
    else delete box.dataset.note;
  }
  const text = noting ? status.note : state === 'failed' || state === 'dirty' || state === 'saved' ? status.detail || SAVE_TEXT[state] : SAVE_TEXT[state];
  if (el.textContent !== text) el.textContent = text;
  if (noting && status.noteTone === 'negative') el.dataset.tone = 'negative';
  else if (state === 'failed' || state === 'offline') el.dataset.tone = 'negative';
  else delete el.dataset.tone;
  if (time) {
    const show = !noting && state === 'saved' && status.savedAt > 0;
    time.hidden = !show;
    if (show) {
      const at = new Date(status.savedAt);
      time.dateTime = at.toISOString();
      time.textContent = savedLine(status.savedAt, Date.now());
      time.title = `Saved at ${at.toLocaleTimeString()}`;
    }
  }
}

/** The save state of the screen: what the top bar keeps showing until it changes. */
export const saveStatus = {
  /** Something is changed here and not saved yet. */
  dirty(detail = '') {
    status.state = 'dirty';
    status.detail = detail;
    paint();
  },
  saving() {
    // the save's round trip, as the person waits for it (documentation/engineering/performance.md §3.2)
    if (status.state !== 'saving') performance.mark('editor:save-start');
    status.state = 'saving';
    status.detail = '';
    paint();
  },
  /** Saved now: "Saved" (or what was saved, `what`) and how long ago, until the next change. */
  saved(what = '') {
    if (performance.getEntriesByName('editor:save-start', 'mark').length) {
      performance.measure('editor:save', 'editor:save-start');
      performance.clearMarks('editor:save-start');
    }
    status.state = 'saved';
    status.detail = what;
    status.savedAt = Date.now();
    // what was saved is the news: it takes the line from a note
    if (what) clearNote();
    else paint();
    clearInterval(status.tick);
    status.tick = window.setInterval(paint, 15_000);
  },
  /** Saved, and the screen is about to load again: the next page shows it (what, and when) as saved. */
  carry(what = '') {
    this.saved(what);
    // this load is the editor's own, after a save: leaving doesn't ask
    status.leaving = true;
    try {
      sessionStorage.setItem(CARRY, JSON.stringify({ what, at: status.savedAt }));
    } catch {
      /* private mode: the reloaded screen just says everything's saved */
    }
  },
  failed(why: string) {
    status.state = 'failed';
    status.detail = why;
    clearNote();
  },
  /** The screen has nothing unsaved (a fresh form, after a reload). */
  clean() {
    if (status.state === 'dirty') {
      status.state = status.savedAt ? 'saved' : 'idle';
      status.detail = '';
    }
    paint();
  },
  get state(): SaveState {
    return status.offline ? 'offline' : status.state;
  },
  /** Leaving now would lose something. */
  get unsaved(): boolean {
    return status.state === 'dirty' || status.state === 'saving';
  },
};

type RemoteSaveState = 'idle' | 'saving' | 'saved' | 'failed';
const remote = { state: 'idle' as RemoteSaveState, detail: '' };

function paintRemoteStatus() {
  const el = document.querySelector<HTMLElement>('[data-editor-remote-status]');
  if (!el) return;
  el.hidden = remote.state === 'idle';
  el.dataset.state = remote.state;
  el.textContent = remote.detail;
}

/** The article top bar's independent status for a Save to remote operation. */
export const remoteSaveStatus = {
  saving(detail = 'Saving to remote…') {
    remote.state = 'saving';
    remote.detail = detail;
    paintRemoteStatus();
  },
  saved(detail = 'Saved to remote') {
    remote.state = 'saved';
    remote.detail = detail;
    paintRemoteStatus();
  },
  failed(detail: string) {
    remote.state = 'failed';
    remote.detail = detail;
    paintRemoteStatus();
  },
};

function clearNote() {
  clearTimeout(status.noteTimer);
  status.note = '';
  paint();
}

/**
 * Says something in the top bar's status (a live region), optionally as a problem: a note that shows for
 * a few seconds (a problem for longer), then gives way to the save state again.
 */
export function announce(text: string, tone: 'default' | 'negative' = 'default') {
  clearTimeout(status.noteTimer);
  status.note = text;
  status.noteTone = tone;
  paint();
  if (text) status.noteTimer = window.setTimeout(clearNote, tone === 'negative' ? 12_000 : 4_000);
}

// ---------- tasks: never a silent wait (documentation/editor/spec.md §2.2) ----------
// Every wait goes through one tracker, which drives both layers: the inline sign on the element the work
// affects (its data-busy, which its component styles: "ack" at once, "on" past the delay, "done" for a
// brief check), and the status line's words. Under the delay only the acknowledgement shows, so nothing
// flashes; once shown, a sign stays its minimum. The status line is heard only for a wait past 1 s.

const timing = { delay: 300, min: 500, elapsed: 3000, done: 2000, read: false };
/** The feedback timings (spec §2.2), read once from their c.editor tokens: the delay, the minimum, when the elapsed time shows, the done check. */
export const feedbackTiming = () => timings();
function timings() {
  if (!timing.read) {
    const css = getComputedStyle(document.documentElement);
    timing.delay = cssTime(css.getPropertyValue('--c-editor-feedback-delay'), 300);
    timing.min = cssTime(css.getPropertyValue('--c-editor-feedback-min'), 500);
    timing.elapsed = cssTime(css.getPropertyValue('--c-editor-feedback-elapsed'), 3000);
    timing.done = cssTime(css.getPropertyValue('--c-editor-feedback-done'), 2000);
    timing.read = true;
  }
  return timing;
}

interface TaskState extends TaskView {
  els: HTMLElement[];
  quiet: boolean;
  /** Shown in the status line too (a background check isn't: its sign at the place is enough). */
  line: boolean;
  shownAt: number;
  announced: boolean;
  timers: number[];
}
const tasks = new Set<TaskState>();
/** How many running tasks hold each element busy. */
const holds = new WeakMap<HTMLElement, number>();
let taskTick = 0;

function shownTasks() {
  return [...tasks].filter((t) => t.shownAt && !t.quiet && t.line);
}

function paintTasks() {
  const box = document.querySelector<HTMLElement>('[data-editor-save]');
  const line = document.querySelector<HTMLElement>('[data-editor-task]');
  const shown = shownTasks();
  const text = taskLine(shown, performance.now(), timings().elapsed);
  if (box) {
    if (shown.length) box.dataset.task = '';
    else delete box.dataset.task;
  }
  if (line && line.textContent !== text) line.textContent = text;
  for (const t of tasks) {
    if (!t.shownAt || t.quiet) continue;
    const words = taskLine([t], performance.now(), timing.elapsed);
    for (const el of t.els) if (el.dataset.busyText !== words) el.dataset.busyText = words;
  }
  const ticking = [...tasks].some((t) => t.shownAt && !t.quiet && performance.now() - t.started >= timing.elapsed - 1000);
  if (ticking && !taskTick) taskTick = window.setInterval(paintTasks, 1000);
  if (!ticking && taskTick) {
    clearInterval(taskTick);
    taskTick = 0;
  }
}

function sayTask(text: string) {
  const live = document.querySelector<HTMLElement>('[data-editor-task-live]');
  if (live) live.textContent = text;
}

function hold(el: HTMLElement) {
  holds.set(el, (holds.get(el) ?? 0) + 1);
  el.setAttribute('aria-busy', 'true');
  if (el.dataset.busy !== 'on') el.dataset.busy = 'ack';
}

function release(el: HTMLElement, check: boolean, words?: string) {
  const n = (holds.get(el) ?? 1) - 1;
  holds.set(el, n);
  if (n > 0) return;
  el.removeAttribute('aria-busy');
  delete el.dataset.busyText;
  restoreLabel(el);
  if (!check) {
    delete el.dataset.busy;
    return;
  }
  el.dataset.busy = 'done';
  // a button says what it did for a moment ("Saved"), then its own label again
  if (words) setLabel(el, words);
  window.setTimeout(() => {
    if (el.dataset.busy !== 'done') return;
    delete el.dataset.busy;
    restoreLabel(el);
  }, timings().done);
}

/** A button's own label while it says what it's doing ("Saving the details…"), kept at its width so nothing moves. */
const labels = new WeakMap<HTMLElement, { text: string; width: string }>();
function setLabel(el: HTMLElement, text: string) {
  const label = el.querySelector<HTMLElement>(':scope > .label');
  if (!label) return;
  if (!labels.has(el)) labels.set(el, { text: label.textContent ?? '', width: el.style.minInlineSize });
  el.style.minInlineSize = `${el.getBoundingClientRect().width}px`;
  label.textContent = text;
}
function restoreLabel(el: HTMLElement) {
  const was = labels.get(el);
  if (!was) return;
  labels.delete(el);
  const label = el.querySelector<HTMLElement>(':scope > .label');
  if (label) label.textContent = was.text;
  el.style.minInlineSize = was.width;
}

/** A wait under way: what it does, and how it ends. */
export interface Task {
  /** Says what it's doing now (a step: "Making the master…"). */
  step(label: string): void;
  /** How far along (0 to 1), when it can say; null when it can't. */
  progress(fraction: number | null): void;
  /**
   * It's done: its sign goes (after its minimum, if it showed), with a brief check at the place when
   * `check` (only where nothing else shows the result: a button then says `words`, "Saved" by default,
   * for a moment), and its end is heard if its start was.
   */
  done(opts?: { check?: boolean; words?: string }): Promise<void>;
  /** It failed: its sign goes at once; the caller says why, where it happened. */
  failed(): void;
  /** Whether it's still under way (a button pressed twice does nothing meanwhile). */
  readonly running: boolean;
}

/**
 * Starts tracking a wait. `el` is what it affects (a button, a field, a row, a region, the canvas): it's
 * marked busy at once and shows its sign past the delay. `quiet` tracks without any sign (a redraw that
 * only confirms what the screen already shows, §3.6).
 */
export function startTask(label: string, opts: { el?: Element | null | (Element | null | undefined)[]; quiet?: boolean; line?: boolean; busyLabel?: string } = {}): Task {
  const t0 = timings();
  const els = (Array.isArray(opts.el) ? opts.el : [opts.el]).filter((e): e is HTMLElement => e instanceof HTMLElement);
  const t: TaskState = { label, started: performance.now(), progress: null, els: opts.quiet ? [] : els, quiet: !!opts.quiet, line: opts.line !== false, shownAt: 0, announced: false, timers: [] };
  tasks.add(t);
  for (const el of t.els) hold(el);
  if (!t.quiet) {
    t.timers.push(
      window.setTimeout(() => {
        t.shownAt = performance.now();
        for (const el of t.els) {
          if (el.dataset.busy === 'ack') el.dataset.busy = 'on';
          if (opts.busyLabel && el.matches('button, a')) setLabel(el, opts.busyLabel);
        }
        paintTasks();
      }, t0.delay),
      window.setTimeout(() => {
        if (!t.line) return;
        t.announced = true;
        sayTask(t.label);
      }, 1000),
    );
  }
  let ended = false;
  const end = (check: boolean, words?: string) => {
    ended = true;
    for (const id of t.timers) clearTimeout(id);
    tasks.delete(t);
    for (const el of t.els) release(el, check, check && el.matches('button, a') ? (words ?? 'Saved') : undefined);
    if (t.announced) sayTask(words ?? 'Done');
    paintTasks();
  };
  return {
    step(text) {
      t.label = text;
      paintTasks();
    },
    progress(fraction) {
      t.progress = fraction;
      for (const el of t.els) {
        if (fraction === null) el.style.removeProperty('--busy-progress');
        else el.style.setProperty('--busy-progress', String(Math.min(1, Math.max(0, fraction))));
      }
      paintTasks();
    },
    async done(o = {}) {
      if (ended) return;
      // once shown, a sign stays its minimum: it never flickers
      const left = t.shownAt ? t.shownAt + timing.min - performance.now() : 0;
      if (left > 0) {
        for (const id of t.timers) clearTimeout(id);
        await new Promise((r) => setTimeout(r, left));
      }
      end(!!o.check, o.words);
    },
    failed() {
      if (!ended) end(false);
    },
    get running() {
      return !ended;
    },
  };
}

/** Runs `work` as a tracked wait (see {@link startTask}); its sign goes when it settles, either way. */
export async function track<T>(label: string, opts: Parameters<typeof startTask>[1], work: () => Promise<T>): Promise<T> {
  const task = startTask(label, opts);
  try {
    const r = await work();
    void task.done();
    return r;
  } catch (e) {
    task.failed();
    throw e;
  }
}

// the dev server's socket: when it drops, nothing can save, and the status says so
if (import.meta.hot) {
  import.meta.hot.on('vite:ws:disconnect', () => {
    status.offline = true;
    paint();
  });
  import.meta.hot.on('vite:ws:connect', () => {
    status.offline = false;
    paint();
  });
}

// leaving with something unsaved, or a save under way, asks first (not the editor's own reload after a save)
addEventListener('beforeunload', (e) => {
  if (saveStatus.unsaved && !status.leaving) e.preventDefault();
});

// the status as the screen opens: a save the last page made before it loaded this one, or all saved
try {
  const carried = JSON.parse(sessionStorage.getItem(CARRY) ?? 'null') as { what: string; at: number } | null;
  sessionStorage.removeItem(CARRY);
  if (carried && Date.now() - carried.at < 60_000) {
    saveStatus.saved(carried.what);
    status.savedAt = carried.at;
  }
} catch {
  /* nothing carried */
}
paint();

export interface SwapOptions {
  /** What the wait says if it passes the delay ("Showing lettering…"); "Updating…" by default. */
  label?: string;
  /** A redraw that only confirms what the screen already shows (§3.6): no sign, no words. */
  quiet?: boolean;
  /** Called just before the regions are replaced, once they've arrived: read what to keep now (the tab, the focus, the scroll), never when the swap was asked for. */
  landing?: () => void;
}

/**
 * Renders a screen's named regions (`data-region`) again on the server and swaps them in, so a change
 * shows without a reload: the rest of the page keeps its state, scroll and focus. The server is told which
 * regions (the X-Editor-Regions header) and draws only those (performance-report.md R4). The components
 * in the new regions are set up again (astro:page-load, which `each` listens for), and a region that
 * scrolls keeps its place. The counts of changes to save to remote always come along. The regions are
 * marked as updating while they're fetched (§2.2), unless `quiet`.
 */
export async function swapRegions(names: string[], url = location.href, keep?: () => boolean, opts: SwapOptions = {}): Promise<Document | null> {
  const start = performance.now();
  const els = names.map((n) => document.querySelector(`[data-region="${n}"]`));
  const task = startTask(opts.label ?? 'Updating…', { el: els, quiet: opts.quiet || !names.length });
  let html: string;
  try {
    html = await (await fetch(url, { headers: { 'X-Editor': '1', [REGIONS_HEADER]: regionsHeader(names) } })).text();
  } catch (e) {
    task.failed();
    throw e;
  }
  const fetched = performance.now();
  const next = new DOMParser().parseFromString(html, 'text/html');
  const parsed = performance.now();
  // the screen may have become busy while it was fetched (someone started typing): then it stays as it is
  if (keep?.()) {
    task.failed();
    return null;
  }
  opts.landing?.();
  for (const name of new Set([...names, ...ALWAYS])) {
    const old = document.querySelector(`[data-region="${name}"]`);
    const fresh = next.querySelector(`[data-region="${name}"]`);
    if (!old || !fresh) continue;
    const top = old.scrollTop;
    const el = document.importNode(fresh, true) as HTMLElement;
    old.replaceWith(el);
    if (top) el.scrollTop = top;
  }
  paintRemoteStatus();
  // as after a page swap: what left the page stops listening (each's signals), then the new regions are set up
  document.dispatchEvent(new Event('astro:after-swap'));
  document.dispatchEvent(new Event('astro:page-load'));
  // a whole screen fetched and parsed to change a few regions: how long, and of what
  performance.measure('editor:swap', { start, detail: { regions: names, bytes: html.length, fetch: fetched - start, parse: parsed - fetched, swap: performance.now() - parsed } });
  void task.done();
  return next;
}

export { describeIssue };

/** A refused reply in words: what the server found wrong, else what happened and how to put it right (`refusal`). */
export const refused = (r: { data: { issues?: Issue[] } }, happened: string, opts?: { lead?: boolean; sep?: string }) => refusal(r.data.issues, happened, opts);

// ---------- what waits to be saved to remote ----------
let pendingTimer = 0;
let pendingRunning = false;
let pendingAt = 0;
/**
 * Draws the counts of changes to save to remote again from git (the top bar's and the navigation's), a
 * moment after the last call: after a save made here, and when the window comes back (git can move outside
 * edit mode: a commit or a push in a terminal). Never under an open dialog (a refresh sets the page's
 * components up again); it runs again once the dialog is put away.
 */
export function refreshPending(delay = 800) {
  clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(async () => {
    if (pendingRunning) return refreshPending(delay || 800);
    if (document.querySelector('dialog[open]')) {
      pendingWaiting = true;
      return;
    }
    pendingWaiting = false;
    pendingRunning = true;
    // the counts show a small spinner while git is asked (§2.2, background check); the status line isn't used
    const task = startTask('Checking changes…', { el: document.querySelector('[data-region="editor-pending"]'), line: false });
    try {
      await swapRegions([], location.href, () => !!document.querySelector('dialog[open]'));
      pendingAt = Date.now();
    } catch {
      /* the dev server is away: the next save or return tries again */
    } finally {
      task.failed();
      pendingRunning = false;
    }
  }, delay);
}

let pendingWaiting = false;
/** A dialog was put away: a refresh that waited for it runs now. */
export function resumePending() {
  if (pendingWaiting && !document.querySelector('dialog[open]')) refreshPending(0);
}

/** When the counts were last drawn again by refreshPending (0: never). */
export const pendingCheckedAt = () => pendingAt;
