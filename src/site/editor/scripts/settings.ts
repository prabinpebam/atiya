/**
 * The settings screen (documentation/editor/spec.md §2): the site settings and the owner's profile, each
 * saved to its own file with its version; pictures chosen with the media picker (one at a time; an upload
 * goes to the field's own folder: site/ for the social image, people/<id>/ for the portrait); links added
 * and removed as rows.
 */
import { api, describeIssue, saveStatus, swapRegions } from './client';
import type { Person, SiteSettings } from '../../content/schema';

interface State {
  site: SiteSettings;
  siteVersion: string;
  person: Person;
  personVersion: string;
}

let fresh = 0;

export function initSettings(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-settings-state]')?.textContent ?? '{}') as State;
  const picker = document.getElementById('settings-picker') as HTMLDialogElement | null;
  let field: HTMLElement | null = null;
  const say = (form: Element, text: string) => {
    const p = form.querySelector<HTMLElement>('[data-editor-form-issue]')!;
    p.textContent = text;
    p.hidden = !text;
  };

  // ---------- pictures ----------
  const setPicture = (el: HTMLElement, id: string, card?: HTMLElement | null) => {
    el.querySelector<HTMLInputElement>('input[type="hidden"]')!.value = id;
    const preview = el.querySelector<HTMLElement>('[data-settings-preview]')!;
    const img = card?.querySelector('img');
    // the card's picture, as the Image fundamental draws it for this field (a square crop)
    const copy = img?.cloneNode() as HTMLImageElement | undefined;
    if (copy) Object.assign(copy.dataset, { ratio: '1/1', fit: 'cover' });
    preview.replaceChildren(...(copy ? [copy] : []));
    const alt = el.querySelector<HTMLElement>('[data-settings-alt] > *');
    if (alt) alt.textContent = id ? card?.getAttribute('aria-label') || id : 'None';
    const clear = el.querySelector<HTMLButtonElement>('[data-settings-clear]');
    if (clear) clear.disabled = !id;
    const pick = el.querySelector('[data-settings-pick] span:last-child');
    if (pick) pick.textContent = id ? 'Replace' : 'Choose';
  };
  /** A change in a form that isn't saved until its Save is pressed: the status says so. */
  const pending = (el: Element | null, text: string) => {
    const form = el?.closest('form');
    if (form) form.dataset.unsaved = '';
    saveStatus.dirty(text);
  };
  const choose = (id: string) => {
    if (!field) return;
    setPicture(field, id, document.querySelector<HTMLElement>(`#settings-picker [data-editor-media="${CSS.escape(id)}"]`));
    pending(field, 'Picture chosen: save to keep it');
    picker?.close();
    field.querySelector<HTMLElement>('[data-settings-pick]')?.focus();
    field = null;
  };

  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const pick = t.closest<HTMLElement>('[data-settings-pick]');
      if (pick && picker) {
        field = pick.closest<HTMLElement>('[data-settings-picture]');
        const grid = picker.querySelector<HTMLElement>('[data-editor-media-grid]');
        if (grid && field) grid.dataset.owner = field.dataset.owner;
        const current = field?.querySelector<HTMLInputElement>('input[type="hidden"]')?.value;
        picker.querySelectorAll('[data-editor-media]').forEach((c) => c.setAttribute('aria-pressed', String(c.getAttribute('data-editor-media') === current)));
        picker.querySelector<HTMLElement>('.pick-actions')?.setAttribute('hidden', '');
        picker.showModal();
        return;
      }
      const clear = t.closest<HTMLElement>('[data-settings-clear]');
      if (clear) {
        const el = clear.closest<HTMLElement>('[data-settings-picture]');
        if (el) setPicture(el, '');
        pending(el, 'Picture removed: save to keep it');
        return;
      }
      if (t.closest('[data-settings-add-link]')) {
        const list = root.querySelector<HTMLElement>('[data-settings-links]')!;
        const tpl = root.querySelector<HTMLTemplateElement>('[data-settings-link-template]')!;
        const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        // each new row's fields get their own ids (and their labels and hints follow)
        const n = ++fresh;
        row.querySelectorAll<HTMLElement>('[id]').forEach((el) => (el.id = `${el.id}-${n}`));
        row.querySelectorAll<HTMLElement>('[for]').forEach((el) => el.setAttribute('for', `${el.getAttribute('for')}-${n}`));
        row.querySelectorAll<HTMLElement>('[aria-describedby]').forEach((el) => el.setAttribute('aria-describedby', el.getAttribute('aria-describedby')!.split(' ').map((d) => `${d}-${n}`).join(' ')));
        list.append(row);
        row.querySelector<HTMLInputElement>('input')?.focus();
        return;
      }
      const remove = t.closest<HTMLElement>('[data-settings-remove-link]');
      if (remove) {
        const row = remove.closest('[data-settings-link]');
        const next = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLInputElement>('input');
        pending(row, 'Link removed: save to keep it');
        row?.remove();
        (next ?? root.querySelector<HTMLElement>('[data-settings-add-link]'))?.focus();
      }
    },
    { signal },
  );

  // the picker is the page's (a dialog beside the forms)
  picker?.addEventListener(
    'click',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('[data-editor-media]');
      if (card) choose(card.dataset.editorMedia!);
    },
    { signal },
  );
  picker?.addEventListener(
    'media:uploaded',
    async (e) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      const owner = picker.querySelector<HTMLElement>('[data-editor-media-grid]')?.dataset.owner;
      await swapRegions(['media-grid']);
      const grid = picker.querySelector<HTMLElement>('[data-editor-media-grid]');
      if (grid && owner) grid.dataset.owner = owner;
      picker.querySelector<HTMLElement>('.pick-actions')?.setAttribute('hidden', '');
      choose(id);
    },
    { signal },
  );

  // ---------- saving ----------
  const save = async (form: HTMLFormElement, path: string, body: Record<string, unknown>, what: string) => {
    say(form, '');
    saveStatus.saving();
    const r = await api('PUT', path, body);
    if (!r.ok) {
      const why = (r.data.issues ?? []).map(describeIssue).join(' ') || `${what} weren't saved.`;
      saveStatus.failed(`Not saved: ${why}`);
      return say(form, r.status === 409 ? 'This file changed elsewhere since you opened it. Reload the page to see it, then make your change again.' : why);
    }
    await swapRegions(['settings']);
    saveStatus.saved(`Saved ${what.toLowerCase()}`);
  };

  root.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      e.preventDefault();
      const d = new FormData(form);
      const text = (k: string) => String(d.get(k) ?? '').trim();
      if (!text('name')) return say(form, 'Give it a name.');
      if (form.dataset.settingsForm === 'site') {
        const description = text('description');
        if (!description) return say(form, 'Describe the site in a sentence: search results show it.');
        if (description.length > 160) return say(form, `The description is ${description.length} characters: keep it to 160.`);
        // a copy of what's on disk, so its keys keep their order
        const site: SiteSettings = { ...state.site, name: text('name'), description };
        for (const k of ['positioning', 'contactEmail', 'socialImage'] as const) {
          if (text(k)) site[k] = text(k);
          else delete site[k];
        }
        void save(form, 'site', { site, ifMatch: { '/content/site.json': state.siteVersion } }, 'The site settings');
      } else {
        const person: Person = { ...state.person, name: text('name') };
        for (const k of ['role', 'bio', 'avatar'] as const) {
          if (text(k)) person[k] = text(k);
          else delete person[k];
        }
        const labels = d.getAll('link-label').map((v) => String(v).trim());
        const hrefs = d.getAll('link-href').map((v) => String(v).trim());
        const links = labels.map((label, i) => ({ label, href: hrefs[i] ?? '' })).filter((l) => l.label || l.href);
        const half = links.find((l) => !l.label || !l.href);
        if (half) return say(form, `Every link needs a label and an address (${half.label || half.href}).`);
        const bad = links.find((l) => !/^https?:\/\/|^mailto:/i.test(l.href));
        if (bad) return say(form, `Use an address that starts with https:// or mailto: for ${bad.label}.`);
        if (links.length) person.links = links;
        else delete person.links;
        void save(form, `people/${state.person.id}`, { person, ifMatch: { [`/content/people/${state.person.id}.json`]: state.personVersion } }, 'Your profile');
      }
    },
    { signal },
  );
}
