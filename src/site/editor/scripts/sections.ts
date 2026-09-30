/**
 * The Sections screen (documentation/editor/spec.md §5): what a move on the board writes (a page into a
 * section, at its place, or off the site), each section's settings, its place among the sections, and a
 * new section. Each change is one store transaction (PUT structure, with its version). Any page can move,
 * published or not: its old address simply goes (§7.2 of the sections spec). A page on the planet taken
 * off the site is refused (V13), and the board says why.
 */
import { api, announce, describeIssue } from './client';
import { addHub, nodeIds, place, reorder, setInMenu, unplace, updateHub } from '../model/structure';
import { slugify, unique } from '../model/ids';
import type { BoardMove } from './board';
import type { SiteStructure } from '../../content/schema';

const STRUCTURE = '/content/structures/site.json';
const FOCUS = 'editor.sections.focus';

export function initSections(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-editor-sections-state]')?.textContent ?? '{}') as { structure: SiteStructure; version: string };
  const board = document.querySelector<HTMLElement>('[data-board]');
  const say = (form: Element | null, text: string) => {
    const p = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
    if (p) {
      p.textContent = text;
      p.hidden = !text;
    } else board?.dispatchEvent(new CustomEvent('board:issue', { detail: text }));
  };

  /** Saves the structure; on success the screen reloads, with the focus on \`focus\` (a selector). */
  const put = async (next: SiteStructure, focus?: string, form?: Element | null) => {
    announce('Saving\u2026');
    const r = await api('PUT', 'structure', { structure: next, ifMatch: { [STRUCTURE]: state.version } });
    if (r.ok) {
      if (focus) sessionStorage.setItem(FOCUS, focus);
      location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    announce(`Not saved: ${why}`, 'negative');
    say(form ?? null, why);
  };

  // ---------- a page moved on the board ----------
  board?.addEventListener(
    'board:move',
    (e) => {
      const m = (e as CustomEvent<BoardMove>).detail;
      const item = { type: 'article', id: m.page };
      const next = m.to === '_off' ? unplace(state.structure, item) : place(state.structure, m.to, item, unique(m.page, nodeIds(state.structure)), m.index);
      void put(next, `[data-board-grip="${m.page}"]`);
    },
    { signal },
  );

  // ---------- a section's settings, its place, a new section ----------
  root.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      const d = new FormData(form);
      const get = (k: string) => (d.has(k) ? String(d.get(k) ?? '').trim() : undefined);
      const nav = form.querySelector<HTMLInputElement>('[data-sections-in-nav] input');
      if (form.dataset.sectionsHub) {
        e.preventDefault();
        const hub = form.dataset.sectionsHub;
        const title = get('title');
        if (!title) return say(form, 'A section needs a title.');
        const fields: Parameters<typeof updateHub>[2] = { title, navLabel: get('navLabel'), summary: get('summary') };
        const slug = get('slug');
        if (slug !== undefined) fields.slug = slug;
        const view = get('view');
        if (view === 'list' || view === 'tiles' || view === 'bento') fields.view = view;
        let next = updateHub(state.structure, hub, fields);
        // its entry in the top navigation (the same menu the Navigation screen edits)
        if (nav) next = setInMenu(next, hub, nav.checked);
        void put(next, `[data-dialog-open="section-settings-${hub}"]`, form);
      } else if (form.hasAttribute('data-sections-new')) {
        e.preventDefault();
        const title = get('title');
        if (!title) return say(form, 'A section needs a title.');
        const id = unique(slugify(title), nodeIds(state.structure));
        const summary = get('summary');
        const v = get('view');
        const view = v === 'list' || v === 'bento' ? v : 'tiles';
        // a section is always directly under the home page (three levels: V22), after the others
        const added = addHub(state.structure, state.structure.home.id, { id, kind: 'hub', slug: slugify(title), title, ...(summary ? { summary } : {}), view, children: [] });
        void put(nav?.checked ? setInMenu(added, id, true) : added, `[data-dialog-open="section-settings-${id}"]`, form);
      }
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (e) => {
      const mv = (e.target as Element).closest<HTMLElement>('[data-sections-move]');
      if (!mv) return;
      const sections = state.structure.home.children ?? [];
      const from = sections.findIndex((c) => c.id === mv.dataset.node);
      const to = from + (mv.dataset.sectionsMove === 'left' ? -1 : 1);
      if (from < 0 || to < 0 || to >= sections.length) return;
      void put(reorder(state.structure, state.structure.home.id, from, to), `[data-dialog-open="section-settings-${mv.dataset.node}"]`, mv.closest('form'));
    },
    { signal },
  );

  // back where the last change left off
  const last = sessionStorage.getItem(FOCUS);
  if (last) {
    sessionStorage.removeItem(FOCUS);
    document.querySelector<HTMLElement>(last)?.focus();
  }
}
