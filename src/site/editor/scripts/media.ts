/**
 * The media library (documentation/editor/spec.md §6): opening a picture's details from the grid (the
 * address keeps it, so Back works), and the details' own changes: the focus point, the sidecar's fields,
 * Replace and Delete. Each saves to the picture at once, in one store transaction, and the grid and the
 * details are rendered again from the server. Gallery spec §4: Find the focus (measured by the server, saved
 * with the details), Make it standard, and Replace's choices (an SVG's two ways, Keep it large).
 */
import { announce, api, feedbackTiming, refused, saveStatus, startTask, swapRegions } from './client';
import { openCrop } from './crop';
import { initAltSuggest } from './altSuggest';
import { showUploadOptions, sizeOf, uploadNote } from './uploadOptions';
import { APNG_NOTE, isApng, refusedFormat, removedNote, typeOf } from '../model/upload';
import type { ImageMedia, VideoMedia } from '../../content/schema';

const nameOf = (id: string) => id.split('/').pop() ?? id;

// a media ID is [a-z0-9-/] only, so it goes in the address as it is (readable, slashes and all)
/** The screen's address with this item open, keeping the view (the list's `view=list`). */
const urlFor = (id: string | null) => {
  const view = new URL(location.href).searchParams.get('view');
  const query = [view ? `view=${encodeURIComponent(view)}` : '', id ? `id=${id}` : ''].filter(Boolean).join('&');
  return new URL(`${location.pathname}${query ? `?${query}` : ''}`, location.href);
};

/** The grid's card for a picture marked as the one open, at once (spec §3.6): the details follow. */
function markCurrent(id: string | null) {
  document.querySelectorAll<HTMLElement>('[data-editor-media-grid][data-mode="library"] [data-editor-media]').forEach((c) => {
    if (c.dataset.editorMedia === id) c.setAttribute('aria-current', 'true');
    else c.removeAttribute('aria-current');
  });
}

/** Opens a picture's details: its card is current at once, and only the details are drawn again (R11). */
async function show(id: string | null, push = true) {
  const url = urlFor(id);
  if (push) history.pushState(null, '', url);
  markCurrent(id);
  await swapRegions(['media-details'], url.href, undefined, { label: id ? `Showing ${nameOf(id)}…` : 'Updating…' });
}

/** The grid in the library: a picture opens its details; an upload opens the new picture's. */
export function initMediaLibrary(root: HTMLElement, signal: AbortSignal) {
  root.addEventListener(
    'click',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('[data-editor-media]');
      if (!card) return;
      const id = card.dataset.editorMedia!;
      void show(id).then(() => {
        announce(`Showing ${nameOf(id)}`);
        const details = document.querySelector<HTMLElement>('[data-editor-media-details]');
        if (details && details.getBoundingClientRect().top > innerHeight) details.scrollIntoView({ block: 'start' });
        document.querySelector<HTMLElement>(`[data-editor-media="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      });
    },
    { signal },
  );
  root.addEventListener(
    'media:uploaded',
    (e) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      // a new card: the grid is drawn again with it, and its details open; the address follows once they're there
      void (async () => {
        await swapRegions(['media-details', 'media-grid'], urlFor(id).href, undefined, { label: `Showing ${nameOf(id)}…` });
        history.pushState(null, '', urlFor(id));
        announce(`Uploaded ${nameOf(id)}`);
      })();
    },
    { signal },
  );
  window.addEventListener(
    'popstate',
    () => {
      markCurrent(new URL(location.href).searchParams.get('id'));
      void swapRegions(['media-details']);
    },
    { signal },
  );
}

/** A picture's card, changed in place after its details are saved: its name and its "No alt text" mark. */
function updateCard(id: string, alt: string, decorative: boolean) {
  const card = document.querySelector<HTMLElement>(`[data-editor-media-grid] [data-editor-media="${CSS.escape(id)}"]`);
  if (!card) return;
  const video = card.closest<HTMLElement>('[data-media-card]')?.dataset.mediaKind === 'video';
  card.setAttribute('aria-label', video ? `Video: ${alt || id}` : alt || id);
  const li = card.closest<HTMLElement>('[data-media-card]');
  if (li) li.dataset.find = `${id} ${alt}`.toLowerCase();
  if (alt || decorative) card.querySelector('.missing')?.remove();
}

/** Draws the grid and the details again, quietly, unless something is being typed in the details meanwhile. */
function confirmLater() {
  const inDetails = (el: Element | null) => !!el?.closest('[data-editor-media-details]');
  const typing = () => {
    const a = document.activeElement;
    return !!document.querySelector('[data-editor-media-details] [data-unsaved]') || (inDetails(a) && !!a?.matches('input:not([type="checkbox"]):not([type="radio"]), textarea'));
  };
  let focused: string | null = null;
  const landing = () => {
    const a = document.activeElement as HTMLElement | null;
    focused = a && inDetails(a) ? (a.id ? `#${CSS.escape(a.id)}` : a.matches('button[type="submit"]') ? '[data-editor-media-details] [data-editor-media-form] button[type="submit"]' : null) : null;
  };
  void swapRegions(['media-details', 'media-grid'], location.href, typing, { quiet: true, landing })
    .then((next) => {
      if (next && focused) document.querySelector<HTMLElement>(focused)?.focus({ preventScroll: true });
    })
    .catch(() => {});
}

/** A picture's details: the focus point, the fields, Replace and Delete; a video's: its fields and Delete. */
export function initMediaDetails(root: HTMLElement, signal: AbortSignal) {
  const stateEl = root.querySelector('[data-editor-media-state]');
  if (!stateEl) return;
  const parsed = JSON.parse(stateEl.textContent ?? '{}') as { id: string; key: string; version: string; sidecar: ImageMedia | VideoMedia };
  wireDelete(root, parsed.id, signal);
  if (parsed.sidecar.kind === 'video') return initVideoDetails(root, parsed as { id: string; key: string; version: string; sidecar: VideoMedia }, signal);
  const state = parsed as { id: string; key: string; version: string; sidecar: ImageMedia };
  const form = root.querySelector<HTMLFormElement>('[data-editor-media-form]')!;
  const box = root.querySelector<HTMLElement>('[data-editor-focus]')!;
  const hit = root.querySelector<HTMLButtonElement>('[data-editor-focus-set]')!;
  const focusInput = form.querySelector<HTMLInputElement>('input[name="focus"]')!;
  const focusText = root.querySelector<HTMLElement>('#media-focus-value');
  const issueOf = (f: Element) => f.querySelector<HTMLElement>('[data-editor-form-issue]')!;
  const say = (f: Element, text: string) => {
    const p = issueOf(f);
    p.textContent = text;
    p.hidden = !text;
  };
  // Suggest beside an empty alt text field (gallery spec §9.6)
  initAltSuggest(form, signal, { media: () => state.id });
  initAltSuggest(form, signal, { media: () => state.id }, { field: 'caption' });
  // its words saved beside it (the library's info panel): the new version, so the focus point's save isn't refused
  document.addEventListener(
    'media:saved',
    (e) => {
      const d = (e as CustomEvent<{ key: string; version: string; sidecar: ImageMedia }>).detail;
      if (d.key !== state.key || d.version === state.version) return;
      state.version = d.version;
      state.sidecar = d.sidecar;
    },
    { signal },
  );

  // ---------- the focus point ----------
  let focus: [number, number] | null = state.sidecar.focus ? (state.sidecar.focus.split(' ').map((v) => parseInt(v, 10)) as [number, number]) : null;
  const setFocus = (next: [number, number] | null) => {
    focus = next && [Math.max(0, Math.min(100, Math.round(next[0]))), Math.max(0, Math.min(100, Math.round(next[1])))];
    const [x, y] = focus ?? [50, 50];
    box.style.setProperty('--focus-x', `${x}%`);
    box.style.setProperty('--focus-y', `${y}%`);
    focusInput.value = focus ? `${x}% ${y}%` : '';
    if (focusText) focusText.textContent = focus ? `Focus at ${x}% across, ${y}% down` : 'Focus in the centre';
  };
  hit.addEventListener(
    'click',
    (e) => {
      if (e.detail === 0) return; // a key's click: the keys below move it
      const r = hit.getBoundingClientRect();
      setFocus([((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]);
    },
    { signal },
  );
  hit.addEventListener(
    'keydown',
    (e) => {
      const [x, y] = focus ?? [50, 50];
      const step: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] };
      if (step[e.key]) {
        e.preventDefault();
        setFocus([x + step[e.key][0], y + step[e.key][1]]);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocus(null);
      }
    },
    { signal },
  );
  root.querySelector('[data-editor-focus-clear]')?.addEventListener('click', () => setFocus(null), { signal });
  // Find the focus (gallery spec §4): the server measures where the subject is; the point moves there, saved with the details
  const find = root.querySelector<HTMLButtonElement>('[data-editor-focus-find]');
  find?.addEventListener(
    'click',
    async () => {
      if (find.getAttribute('aria-busy') === 'true') return;
      const task = startTask('Finding the focus…', { el: find, busyLabel: 'Finding…' });
      const r = await api<{ focus?: string | null }>('POST', `media/${state.id}/focus`);
      if (!r.ok) {
        task.failed();
        return announce(refused(r, 'The focus wasn’t found.', { lead: true }), 'negative');
      }
      void task.done();
      if (!r.data.focus) return announce('No clear subject: the focus point stays where it is.');
      setFocus(r.data.focus.split(' ').map((v) => parseFloat(v)) as [number, number]);
      form.dataset.unsaved = '';
      saveStatus.dirty('Focus point found: save the details to keep it');
    },
    { signal },
  );

  // ---------- the details ----------
  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const text = (k: string) => String(d.get(k) ?? '').trim();
      // beside the library's info panel, the form holds only the focus point: its words are saved there
      const focusOnly = !form.querySelector('[name="alt"]');
      const decorative = focusOnly ? !!state.sidecar.decorative : d.get('decorative') !== null;
      const alt = focusOnly ? (state.sidecar.alt ?? '') : text('alt');
      if (!focusOnly && !decorative && !alt) return say(form, 'Say what the picture shows (its alt text), or mark it decorative.');
      if (alt.length > 250) return say(form, `The alt text is ${alt.length} characters: keep it to 250.`);
      if (!focusOnly && /^(image|picture|photo) of\b/i.test(alt)) return say(form, 'Start the alt text with what it shows, not "image of".');
      // a copy of what's on disk, so its keys keep their order (and the diff shows only what changed)
      const next: ImageMedia = { ...state.sidecar, file: state.sidecar.file };
      const put = <K extends 'alt' | 'caption' | 'credit' | 'source' | 'focus' | 'taken'>(k: K, v: string) => {
        if (v) next[k] = v;
        else delete next[k];
      };
      if (focusOnly) put('focus', text('focus'));
      else {
      put('alt', alt);
      if (decorative) next.decorative = true;
      else delete next.decorative;
      for (const k of ['caption', 'credit', 'source', 'focus', 'taken'] as const) put(k, text(k));
      const licence = { ...state.sidecar.licence, name: text('licence.name'), url: text('licence.url') || undefined };
      if (licence.name) next.licence = JSON.parse(JSON.stringify(licence));
      else if (licence.url) return say(form, 'Name the licence, or leave its address empty.');
      else delete next.licence;
      }
      say(form, '');
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button?.getAttribute('aria-busy') === 'true') return;
      const task = startTask('Saving the details…', { el: button, busyLabel: 'Saving the details…' });
      saveStatus.saving();
      const r = await api('PUT', `media/${state.id}`, { sidecar: next, ifMatch: { [state.key]: state.version } });
      if (!r.ok) {
        task.failed();
        const why = refused(r, "The details weren't saved.");
        saveStatus.failed(`Not saved: ${why}`);
        return say(form, r.status === 409 ? 'Its details changed elsewhere since you opened it. Open it again to see them.' : why);
      }
      // saved: said at once, and the card changed in place (§3.6); the grid and the details confirm it quietly
      state.version = r.data.versions?.[state.key] ?? state.version;
      state.sidecar = next;
      document.dispatchEvent(new CustomEvent('media:saved', { detail: { key: state.key, version: state.version, sidecar: next } }));
      delete form.dataset.unsaved;
      updateCard(state.id, next.alt ?? '', !!next.decorative);
      saveStatus.saved(`Saved the details of ${nameOf(state.id)}: every page that shows it has them now`);
      void task.done({ check: true }).then(() => window.setTimeout(confirmLater, feedbackTiming().done));
    },
    { signal },
  );

  // ---------- crop: a new copy opens; a copy cut again shows its new crop ----------
  root.querySelector('[data-editor-media-crop]')?.addEventListener(
    'click',
    () =>
      openCrop({
        id: state.id,
        onSaved: (next) => void show(next, next !== state.id).then(() => announce(next === state.id ? 'Cropped' : `Cropped into ${nameOf(next)}`)),
      }),
    { signal },
  );

  // ---------- its dark mode version: added or replaced, or removed ----------
  const darkForm = root.querySelector<HTMLFormElement>('[data-editor-media-dark]');
  darkForm?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(darkForm);
      const file = d.get('file');
      if (!(file instanceof File) || !file.size) return say(darkForm, 'Choose the dark version.');
      say(darkForm, '');
      const button = darkForm.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button?.getAttribute('aria-busy') === 'true') return;
      const task = startTask('Saving the dark version…', { el: button, busyLabel: 'Saving…' });
      saveStatus.saving();
      const r = await api<{ width: number; height: number; lightWidth: number; lightHeight: number; removed?: string[] }>('POST', `media/${state.id}/dark`, d);
      if (!r.ok) {
        task.failed();
        const why = refused(r, "The dark version wasn't saved.");
        saveStatus.failed(`Not saved: ${why}`);
        return say(darkForm, why);
      }
      void task.done();
      delete darkForm.dataset.unsaved;
      await swapRegions(['media-details', 'media-grid']);
      const { width, height, lightWidth, lightHeight } = r.data;
      const differs = lightWidth && lightHeight && Math.abs(width / height / (lightWidth / lightHeight) - 1) > 0.01;
      saveStatus.saved(`Saved the dark version of ${nameOf(state.id)}${differs ? ': its shape differs from the picture\u2019s' : ''}${r.data.removed?.length ? `. ${removedNote(r.data.removed)}` : ''}`);
    },
    { signal },
  );
  root.querySelector('[data-editor-media-dark-remove]')?.addEventListener(
    'click',
    async () => {
      saveStatus.saving();
      const r = await api('DELETE', `media/${state.id}/dark`);
      if (!r.ok) return saveStatus.failed(refused(r, 'It wasn’t removed.', { lead: true }));
      await swapRegions(['media-details', 'media-grid']);
      saveStatus.saved(`Removed the dark version of ${nameOf(state.id)}: the picture shows in both modes`);
    },
    { signal },
  );

  // ---------- replace: with an SVG's two ways and Keep it large, as an upload offers them ----------
  const replace = root.querySelector<HTMLFormElement>('[data-editor-media-replace]');
  const replaceFile = replace?.querySelector<HTMLInputElement>('input[type="file"]');
  let choosing = 0;
  replaceFile?.addEventListener(
    'change',
    async () => {
      const mine = ++choosing;
      const file = replaceFile.files?.[0];
      say(replace!, '');
      showUploadOptions(replace!, null);
      uploadNote(replace!, '');
      if (!file) return;
      const badFormat = refusedFormat(file);
      if (badFormat) return say(replace!, badFormat);
      const type = typeOf(file);
      const apng = type === 'image/png' && (await file.arrayBuffer().then((b) => isApng(new Uint8Array(b)), () => false));
      const { width, height } = await sizeOf(file);
      if (mine !== choosing) return;
      showUploadOptions(replace!, { type, bytes: file.size, width, height, animated: apng });
      uploadNote(replace!, apng ? APNG_NOTE : '');
    },
    { signal },
  );
  replace?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(replace);
      const file = d.get('file');
      if (!(file instanceof File) || !file.size) return say(replace, 'Choose the new picture.');
      const badFormat = refusedFormat(file);
      if (badFormat) return say(replace, badFormat);
      say(replace, '');
      const button = replace.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button?.getAttribute('aria-busy') === 'true') return;
      const task = startTask(`Replacing ${nameOf(state.id)}…`, { el: button, busyLabel: 'Replacing…' });
      saveStatus.saving();
      const r = await api<{ removed?: string[] }>('POST', `media/${state.id}/replace`, d);
      if (!r.ok) {
        task.failed();
        const why = refused(r, "It wasn't replaced.");
        saveStatus.failed(`Not replaced: ${why}`);
        return say(replace, why);
      }
      void task.done();
      await swapRegions(['media-details', 'media-grid']);
      saveStatus.saved(`Replaced ${nameOf(state.id)}${r.data.removed?.length ? `. ${removedNote(r.data.removed)}` : ''}`);
    },
    { signal },
  );

  // ---------- make it standard: a picture kept large saved again at 2560 px ----------
  const standard = root.querySelector<HTMLButtonElement>('[data-editor-media-standard]');
  standard?.addEventListener(
    'click',
    async () => {
      if (standard.getAttribute('aria-busy') === 'true') return;
      const task = startTask(`Making ${nameOf(state.id)} standard…`, { el: standard, busyLabel: 'Saving at 2560 px…' });
      saveStatus.saving();
      const r = await api('POST', `media/${state.id}/standard`);
      if (!r.ok) {
        task.failed();
        return saveStatus.failed(refused(r, 'It wasn’t made standard.', { lead: true }));
      }
      void task.done();
      await swapRegions(['media-details', 'media-grid']);
      saveStatus.saved(`Made ${nameOf(state.id)} standard: saved again at 2560 px`);
    },
    { signal },
  );
}

/** Delete (a picture or a video), once nothing uses it. */
function wireDelete(root: HTMLElement, id: string, signal: AbortSignal) {
  root.querySelector('[data-editor-media-delete]')?.addEventListener(
    'click',
    async () => {
      saveStatus.saving();
      const r = await api('DELETE', `media/${id}`);
      (root.querySelector('#delete-media') as HTMLDialogElement | null)?.close();
      if (!r.ok) return saveStatus.failed(refused(r, 'It wasn’t deleted: something still uses it. Check where it’s used first.', { lead: true }));
      await show(null, false).then(() => history.replaceState(null, '', urlFor(null)));
      saveStatus.saved(`Deleted ${nameOf(id)}`);
    },
    { signal },
  );
}

/** A video's details: its title, caption, credit, licence and source, saved to its sidecar. */
function initVideoDetails(root: HTMLElement, state: { id: string; key: string; version: string; sidecar: VideoMedia }, signal: AbortSignal) {
  const form = root.querySelector<HTMLFormElement>('[data-editor-media-form]');
  if (!form) return;
  const say = (text: string) => {
    const p = form.querySelector<HTMLElement>('[data-editor-form-issue]')!;
    p.textContent = text;
    p.hidden = !text;
  };
  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const text = (k: string) => String(d.get(k) ?? '').trim();
      const title = text('title');
      if (!title) return say('Give the video a title: what it is, in a few words.');
      if (title.length > 250) return say(`The title is ${title.length} characters: keep it to 250.`);
      const next: VideoMedia = { ...state.sidecar, title };
      for (const k of ['caption', 'credit', 'source'] as const) {
        if (text(k)) next[k] = text(k);
        else delete next[k];
      }
      const licence = { ...state.sidecar.licence, name: text('licence.name'), url: text('licence.url') || undefined };
      if (licence.name) next.licence = JSON.parse(JSON.stringify(licence));
      else if (licence.url) return say('Name the licence, or leave its address empty.');
      else delete next.licence;
      say('');
      saveStatus.saving();
      const r = await api('PUT', `media/${state.id}`, { sidecar: next, ifMatch: { [state.key]: state.version } });
      if (!r.ok) {
        const why = refused(r, "The details weren't saved.");
        saveStatus.failed(`Not saved: ${why}`);
        return say(r.status === 409 ? 'Its details changed elsewhere since you opened it. Open it again to see them.' : why);
      }
      await swapRegions(['media-details', 'media-grid']);
      saveStatus.saved(`Saved the details of ${nameOf(state.id)}: every page that shows it has them now`);
    },
    { signal },
  );
}
