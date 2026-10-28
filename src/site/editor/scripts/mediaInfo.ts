/**
 * The viewer's info panel (components/MediaInfo.astro; documentation/gallery/spec.md §9.5): each word saved to the
 * library item's sidecar as it's typed (one save at a time, through the media API the Media screen uses), the
 * album's own settings for the item handed to the album editor (`album:item`), Find the focus and Make it
 * standard, and the review's Enter: saved, then on to the next picture that needs alt text. A change made
 * elsewhere draws it again, unless something here waits to be saved.
 */
import { announce, api, onContentChange, refused, saveStatus, startTask, TAB } from './client';
import { initRichFields } from './richtext';
import { initAltSuggest } from './altSuggest';
import { SaveQueue } from '../model/queue';
import { nextToReview, withWords, wordsProblem, type Words, type WordsKind } from '../model/albumViewer';

interface InfoState {
  media: { id: string; key: string; version: string | null; sidecar: Record<string, unknown> };
  kind: WordsKind;
  item: string;
  review: boolean;
}

const WAIT_MS = 700;
const OWN = new Set(['download', 'autoplay', 'loop']);

export function initMediaInfo(panel: HTMLElement, signal: AbortSignal) {
  let state: InfoState;
  try {
    state = JSON.parse(panel.querySelector('[data-media-info-state]')?.textContent ?? '');
  } catch {
    return;
  }
  if (!state?.media) return;
  // in an album, the editor hears it; in the library (spec §9.9), the library does
  const root = panel.closest<HTMLElement>('[data-album-editor]') ?? document.querySelector<HTMLElement>('[data-media-library]');
  const send = (type: string, detail: unknown) => root?.dispatchEvent(new CustomEvent(type, { detail }));
  // docked in the album's inspector (scripts/albumInspector.ts), it's drawn again there, not in the viewer
  const docked = !!panel.closest('[data-album-inspector]');
  const again = () => (docked ? send('album:selection-redraw', null) : send('viewer:go', { id: state.item }));
  const problem = panel.querySelector<HTMLElement>('[data-info-problem]');
  const say = (text: string) => {
    if (!problem) return;
    problem.textContent = text;
    problem.hidden = !text;
  };
  const named = (n: string) => panel.querySelector<HTMLInputElement>(`[name="${n}"]`);
  const val = (n: string) => named(n)?.value ?? '';
  const words = (): Words => ({
    caption: val('caption'),
    description: val('description'),
    alt: val('alt'),
    decorative: named('decorative')?.checked ?? false,
    taken: val('taken'),
    place: val('place'),
    title: val('title'),
    credit: val('credit'),
    licenceName: val('licenceName'),
    licenceUrl: val('licenceUrl'),
  });

  // ---------- saving: one at a time, the words as they are when it runs ----------
  let typed = false;
  let failed = false;
  let timer = 0;
  const queue = new SaveQueue<object>(
    () => ({}),
    async (_job, more) => {
      const w = words();
      const why = wordsProblem(state.kind, w);
      if (why) {
        failed = true;
        say(why);
        saveStatus.failed(`Not saved: ${why}`);
        return 'failed';
      }
      saveStatus.saving();
      const next = withWords(state.media.sidecar, state.kind, w);
      const r = await api('PUT', `media/${state.media.id}`, { sidecar: next, ifMatch: { [state.media.key]: state.media.version } });
      if (!r.ok) {
        failed = true;
        if (r.status === 409) {
          say('Its words were changed elsewhere since you opened it: open it again to see them.');
          saveStatus.failed('Not saved: its words were changed elsewhere.');
          return 'stop';
        }
        const why = refused(r, 'The words weren’t saved.');
        say(why);
        saveStatus.failed(why);
        return 'failed';
      }
      failed = false;
      say('');
      state.media.version = (r.data.versions as Record<string, string> | undefined)?.[state.media.key] ?? state.media.version;
      state.media.sidecar = next;
      document.dispatchEvent(new CustomEvent('media:saved', { detail: { key: state.media.key, version: state.media.version, sidecar: next } }));
      saveStatus.saved('Saved its words: every album and page that shows it has them now');
      // the grid's alt text marks and the facts line follow
      if (!more()) send('album:redraw', null);
      return 'ok';
    },
  );
  // the same sidecar saved beside it (the library's focus point): its new version, so the next save isn't refused
  document.addEventListener(
    'media:saved',
    (e) => {
      const d = (e as CustomEvent<{ key: string; version: string; sidecar: typeof state.media.sidecar }>).detail;
      if (d.key !== state.media.key || d.version === state.media.version) return;
      state.media.version = d.version;
      state.media.sidecar = d.sidecar;
    },
    { signal },
  );
  const now = () => {
    clearTimeout(timer);
    if (!typed) return;
    typed = false;
    void queue.push({});
  };
  const soon = () => {
    typed = true;
    saveStatus.dirty();
    clearTimeout(timer);
    timer = window.setTimeout(now, WAIT_MS);
  };
  /** Saves what's typed now; resolves once nothing is left to save. */
  const flush = async () => {
    now();
    while (queue.pending) await new Promise((r) => setTimeout(r, 40));
  };

  panel.addEventListener(
    'input',
    (e) => {
      const n = (e.target as HTMLInputElement).name;
      if (n && !OWN.has(n)) soon();
    },
    { signal },
  );
  panel.addEventListener(
    'change',
    (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'autoplay' || t.name === 'loop') return send('album:item', { id: state.item, play: { [t.name]: t.checked } });
      if (t.name && !OWN.has(t.name)) soon();
    },
    { signal },
  );
  panel.addEventListener(
    'select-change',
    (e) => {
      if (!(e.target as Element).closest('[data-info-download]')) return;
      const v = (e as CustomEvent<{ value: string }>).detail.value;
      send('album:item', { id: state.item, download: v === 'allow' ? true : v === 'deny' ? false : null });
    },
    { signal },
  );
  panel.addEventListener('viewer:flush', (e) => (e as CustomEvent<{ waits: Promise<unknown>[] }>).detail.waits.push(flush()), { signal });
  panel.addEventListener(
    'focusout',
    (e) => {
      if (!panel.contains(e.relatedTarget as Node | null)) now();
    },
    { signal },
  );

  // ---------- the tools ----------
  panel.addEventListener(
    'click',
    async (e) => {
      const t = e.target as Element;
      const clear = t.closest<HTMLElement>('[data-info-clear]');
      if (clear) {
        const f = named(clear.dataset.infoClear!);
        if (f && f.value) {
          f.value = '';
          soon();
        }
        return;
      }
      const find = t.closest<HTMLElement>('[data-info-focus]');
      if (find && find.getAttribute('aria-busy') !== 'true') {
        const task = startTask('Finding the focus…', { el: find, busyLabel: 'Finding…' });
        const r = await api<{ focus?: string | null }>('POST', `media/${state.media.id}/focus`);
        if (!r.ok) {
          task.failed();
          return announce(refused(r, 'The focus wasn’t found.', { lead: true }), 'negative');
        }
        void task.done();
        if (!r.data.focus) return announce('No clear subject: the focus point stays where it is.');
        state.media.sidecar = { ...state.media.sidecar, focus: r.data.focus };
        typed = true;
        return void flush();
      }
      const standard = t.closest<HTMLElement>('[data-info-standard]');
      if (standard && standard.getAttribute('aria-busy') !== 'true') {
        await flush();
        const task = startTask('Making it standard…', { el: standard, busyLabel: 'Saving at 2560 px…' });
        saveStatus.saving();
        const r = await api('POST', `media/${state.media.id}/standard`);
        if (!r.ok) {
          task.failed();
          return saveStatus.failed(refused(r, 'It wasn’t made standard.', { lead: true }));
        }
        void task.done();
        saveStatus.saved('Made it standard: saved again at 2560 px');
        return again();
      }
      // the review: Accept saves the alt text's suggestion and goes on
      if (state.review && t.closest('[data-alt-kind="alt"] [data-alt-accept]')) void onward();
    },
    { signal },
  );

  // ---------- the description's links, and the alt text's suggestion ----------
  initRichFields(panel, signal, (href, apply) => {
    const v = window.prompt('The link’s address', href);
    if (v !== null) apply(v.trim());
  });
  const suggester = state.kind === 'image' ? initAltSuggest(panel, signal, { media: () => state.media.id }) : null;
  if (state.kind === 'image') initAltSuggest(panel, signal, { media: () => state.media.id }, { field: 'caption' });
  if (suggester && state.review && !val('alt')) {
    const asked = { media: state.media.id, alt: undefined as string | null | undefined };
    send('viewer:known', asked);
    if (asked.alt !== undefined) void suggester.suggest({ known: asked.alt });
    else
      void suggester.suggest({ asked: true }).then((ok) => {
        const text = ok ? (panel.querySelector<HTMLElement>('[data-alt-kind="alt"] [data-alt-offer]')?.dataset.altText ?? null) : null;
        send('viewer:suggested', { media: state.media.id, alt: text });
      });
  }

  /** The review's next step: this one saved, then the next that needs alt text (or the end). */
  const onward = async () => {
    if (!val('alt').trim() && !named('decorative')?.checked) return say('Say what it shows, or mark it decorative, to go on.');
    typed = true;
    await flush();
    if (failed) return;
    let list: { id: string }[] = [];
    try {
      list = JSON.parse(panel.closest('dialog')?.querySelector<HTMLElement>('[data-viewer-review]')?.dataset.viewerReview ?? '[]');
    } catch {
      list = [];
    }
    const next = nextToReview(
      list.map((s) => ({ id: s.id, needsAlt: s.id !== state.item })),
      state.item,
    );
    send(next ? 'viewer:go' : 'viewer:done', next ? { id: next } : null);
  };
  named('alt')?.addEventListener(
    'keydown',
    (e) => {
      if (!state.review || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      if (!val('alt').trim()) suggester?.accept();
      void onward();
    },
    { signal },
  );

  // ---------- a change made elsewhere: drawn again, unless something here waits to be saved ----------
  onContentChange((c) => {
    if (c.origin === TAB || typed || queue.pending || !c.files.includes(state.media.key)) return;
    again();
  }, signal);
  window.addEventListener(
    'beforeunload',
    (e) => {
      if (typed || queue.pending) e.preventDefault();
    },
    { signal },
  );
}
