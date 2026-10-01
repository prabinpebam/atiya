/**
 * The Navigation screen (documentation/sections/spec.md §7.3): every change to the site's top
 * navigation, `menus.primary` in the site structure. Each change is one store transaction (PUT
 * structure, with its version), checked against the content contract (V17); a refusal says why.
 */
import { api, describeIssue, saveStatus } from './client';
import { MENU_MAX, addLink, menuOf, moveEntry, relabelEntry, removeEntry, setInMenu } from '../model/structure';
import type { SiteStructure } from '../../content/schema';

const STRUCTURE = '/content/structures/site.json';
const FOCUS = 'editor.navigation.focus';
const LINK = /^(https?:\/\/\S+|mailto:\S+|\/[^\s]*)$/;

export function initNavigation(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-editor-navigation-state]')?.textContent ?? '{}') as { structure: SiteStructure; version: string };
  const issue = root.querySelector<HTMLElement>('[data-editor-form-issue]');
  const say = (text: string) => {
    if (!issue) return;
    issue.textContent = text;
    issue.hidden = !text;
  };

  /** Saves the structure; on success the screen reloads, with the focus on `focus` (a selector). */
  const put = async (next: SiteStructure, focus?: string) => {
    saveStatus.saving();
    const r = await api('PUT', 'structure', { structure: next, ifMatch: { [STRUCTURE]: state.version } });
    if (r.ok) {
      if (focus) sessionStorage.setItem(FOCUS, focus);
      saveStatus.carry('Saved the navigation');
      location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    saveStatus.failed(`Not saved: ${why}`);
    say(why);
  };

  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const mv = t.closest<HTMLElement>('[data-nav-move]');
      if (mv) {
        const i = Number(mv.dataset.index);
        const by = mv.dataset.navMove === 'up' ? -1 : 1;
        return void put(moveEntry(state.structure, i, by), `[data-nav-move="${mv.dataset.navMove}"][data-index="${i + by}"]`);
      }
      const rm = t.closest<HTMLElement>('[data-nav-remove]');
      if (rm) {
        const i = Number(rm.dataset.navRemove);
        // the focus goes to the entry that takes its place, else the one before, else the first way to add one
        const next = Math.min(i, menuOf(state.structure).length - 2);
        return void put(removeEntry(state.structure, i), next >= 0 ? `[data-nav-label="${next}"] input` : '[data-nav-add] [role="combobox"], [data-nav-add] input');
      }
    },
    { signal },
  );

  // an entry's own label saves when it changes (Enter or leaving the field)
  root.addEventListener(
    'change',
    (e) => {
      const input = e.target as HTMLInputElement;
      const field = input.closest<HTMLElement>('[data-nav-label]');
      if (!field) return;
      const i = Number(field.dataset.navLabel);
      const text = input.value.trim();
      if (text.length > 24) return say('A label is at most 24 characters.');
      const entry = menuOf(state.structure)[i];
      if (entry && 'href' in entry && !text) return say('A link needs a label.');
      void put(relabelEntry(state.structure, i, text), `[data-nav-label="${i}"] input`);
    },
    { signal },
  );
  root.addEventListener(
    'keydown',
    (e) => {
      // Enter in a label field saves it, rather than submitting nothing
      if (e.key === 'Enter' && (e.target as Element).closest('[data-nav-label]')) {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
    },
    { signal },
  );

  root.addEventListener(
    'submit',
    (e) => {
      const form = (e.target as Element).closest<HTMLFormElement>('[data-nav-add]');
      if (!form) return;
      e.preventDefault();
      say('');
      if (menuOf(state.structure).length >= MENU_MAX) return say(`The navigation holds at most ${MENU_MAX} entries: remove one first.`);
      const d = new FormData(form);
      const kind = form.dataset.navAdd;
      if (kind === 'section' || kind === 'page') {
        const node = String(d.get('node') ?? '');
        if (!node) return say(`Choose a ${kind} to add.`);
        return void put(setInMenu(state.structure, node, true), `[data-nav-add="${kind}"] button[type="submit"]`);
      }
      const label = String(d.get('label') ?? '').trim();
      const href = String(d.get('href') ?? '').trim();
      if (!label) return say('A link needs a label.');
      if (label.length > 24) return say('A label is at most 24 characters.');
      if (!LINK.test(href)) return say('Give the link an https, http or mailto address, or a path on this site that starts with /.');
      void put(addLink(state.structure, label, href), '[data-nav-add="link"] input[name="label"]');
    },
    { signal },
  );

  // back where the last change left off
  const last = sessionStorage.getItem(FOCUS);
  if (last) {
    sessionStorage.removeItem(FOCUS);
    root.querySelector<HTMLElement>(last)?.focus();
  }
}
