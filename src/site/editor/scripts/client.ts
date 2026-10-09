/**
 * Edit mode's browser client: calls to the editor API (with the header the guard asks for, and this
 * tab's id, so a change this tab makes comes back to it as its own), the changes made elsewhere (another
 * tab, or a file changed by hand: the dev server pushes them to every open page), and the top bar's save
 * status. Every editor screen's script uses it.
 */
import { savedLine, SAVE_TEXT, type SaveState } from '../model/status';

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
    status.state = 'saving';
    status.detail = '';
    paint();
  },
  /** Saved now: "Saved" (or what was saved, `what`) and how long ago, until the next change. */
  saved(what = '') {
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

/**
 * Renders a screen again on the server and swaps in its named regions (`data-region`), so a change shows
 * without a reload: the rest of the page keeps its state, scroll and focus. The components in the new
 * regions are set up again (astro:page-load, which `each` listens for), and a region that scrolls keeps
 * its place. The counts of changes to publish (the top bar's, the navigation's) always come along.
 */
export async function swapRegions(names: string[], url = location.href, keep?: () => boolean): Promise<Document | null> {
  const html = await (await fetch(url, { headers: { 'X-Editor': '1' } })).text();
  const next = new DOMParser().parseFromString(html, 'text/html');
  // the screen may have become busy while it was fetched (someone started typing): then it stays as it is
  if (keep?.()) return null;
  for (const name of new Set([...names, 'editor-pending', 'editor-nav'])) {
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
  return next;
}

/** An issue in words, for the status and field messages. */
export const describeIssue = (i: Issue) => `${i.path ? `${i.path}: ` : ''}${i.message}`;
