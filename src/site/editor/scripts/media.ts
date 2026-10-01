/**
 * The media library (documentation/editor/spec.md §6): opening a picture's details from the grid (the
 * address keeps it, so Back works), and the details' own changes: the focus point, the sidecar's fields,
 * Replace and Delete. Each saves to the picture at once, in one store transaction, and the grid and the
 * details are rendered again from the server.
 */
import { api, announce, describeIssue, saveStatus, swapRegions } from './client';
import { openCrop } from './crop';
import type { ImageMedia } from '../../content/schema';

const sidecarKey = (id: string) => `/content/media/${id}.json`;
const nameOf = (id: string) => id.split('/').pop() ?? id;

// a media ID is [a-z0-9-/] only, so it goes in the address as it is (readable, slashes and all)
const urlFor = (id: string | null) => new URL(`${location.pathname}${id ? `?id=${id}` : ''}`, location.href);

async function show(id: string | null, push = true) {
  const url = urlFor(id);
  if (push) history.pushState(null, '', url);
  await swapRegions(['media-details', 'media-grid'], url.href);
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
      void show(id).then(() => announce(`Uploaded ${nameOf(id)}`));
    },
    { signal },
  );
  window.addEventListener('popstate', () => void swapRegions(['media-details', 'media-grid']), { signal });
}

/** A picture's details: the focus point, the fields, Replace and Delete. */
export function initMediaDetails(root: HTMLElement, signal: AbortSignal) {
  const stateEl = root.querySelector('[data-editor-media-state]');
  if (!stateEl) return;
  const state = JSON.parse(stateEl.textContent ?? '{}') as { id: string; version: string; sidecar: ImageMedia };
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

  // ---------- the details ----------
  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const text = (k: string) => String(d.get(k) ?? '').trim();
      const decorative = d.get('decorative') !== null;
      const alt = text('alt');
      if (!decorative && !alt) return say(form, 'Say what the picture shows (its alt text), or mark it decorative.');
      if (alt.length > 250) return say(form, `The alt text is ${alt.length} characters: keep it to 250.`);
      if (/^(image|picture|photo) of\b/i.test(alt)) return say(form, 'Start the alt text with what it shows, not "image of".');
      // a copy of what's on disk, so its keys keep their order (and the diff shows only what changed)
      const next: ImageMedia = { ...state.sidecar, file: state.sidecar.file };
      const put = <K extends 'alt' | 'caption' | 'credit' | 'source' | 'focus'>(k: K, v: string) => {
        if (v) next[k] = v;
        else delete next[k];
      };
      put('alt', alt);
      if (decorative) next.decorative = true;
      else delete next.decorative;
      for (const k of ['caption', 'credit', 'source', 'focus'] as const) put(k, text(k));
      const licence = { ...state.sidecar.licence, name: text('licence.name'), url: text('licence.url') || undefined };
      if (licence.name) next.licence = JSON.parse(JSON.stringify(licence));
      else if (licence.url) return say(form, 'Name the licence, or leave its address empty.');
      else delete next.licence;
      say(form, '');
      saveStatus.saving();
      const r = await api('PUT', `media/${state.id}`, { sidecar: next, ifMatch: { [sidecarKey(state.id)]: state.version } });
      if (!r.ok) {
        const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The details weren't saved.";
        saveStatus.failed(`Not saved: ${why}`);
        return say(form, r.status === 409 ? 'Its details changed elsewhere since you opened it. Open it again to see them.' : why);
      }
      await swapRegions(['media-details', 'media-grid']);
      saveStatus.saved(`Saved the details of ${nameOf(state.id)}: every page that shows it has them now`);
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

  // ---------- replace ----------
  const replace = root.querySelector<HTMLFormElement>('[data-editor-media-replace]');
  replace?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const d = new FormData(replace);
      const file = d.get('file');
      if (!(file instanceof File) || !file.size) return say(replace, 'Choose the new picture.');
      say(replace, '');
      saveStatus.saving();
      const r = await api('POST', `media/${state.id}/replace`, d);
      if (!r.ok) {
        const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "It wasn't replaced.";
        saveStatus.failed(`Not replaced: ${why}`);
        return say(replace, why);
      }
      await swapRegions(['media-details', 'media-grid']);
      saveStatus.saved(`Replaced ${nameOf(state.id)}`);
    },
    { signal },
  );

  // ---------- delete ----------
  root.querySelector('[data-editor-media-delete]')?.addEventListener(
    'click',
    async () => {
      saveStatus.saving();
      const r = await api('DELETE', `media/${state.id}`);
      (root.querySelector('#delete-media') as HTMLDialogElement | null)?.close();
      if (!r.ok) return saveStatus.failed(`Not deleted: ${(r.data.issues ?? []).map(describeIssue).join(' ') || 'something still uses it'}`);
      await show(null, false).then(() => history.replaceState(null, '', urlFor(null)));
      saveStatus.saved(`Deleted ${nameOf(state.id)}`);
    },
    { signal },
  );
}
