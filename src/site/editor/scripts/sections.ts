/**
 * The Sections screen (documentation/editor/spec.md §5): what a move in the list writes (pages into a
 * section, at their place, or off the site), each section's settings, its place among the sections, and a
 * new section. Each change is one store transaction (PUT structure, with its version). Any page can move,
 * published or not: its old address simply goes (§7.2 of the sections spec). A page on the planet taken
 * off the site is refused (V13), and the screen says why.
 */
import { api, describeIssue, saveStatus } from './client';
import { addHub, nodeIds, placeAll, reorder, setInMenu, unplace, updateHub } from '../model/structure';
import { slugify, unique } from '../model/ids';
import type { ManagerMove, ManagerReorder } from './manager';
import type { SiteStructure } from '../../content/schema';

const STRUCTURE = '/content/structures/site.json';
const FOCUS = 'editor.sections.focus';

export function initSections(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-editor-sections-state]')?.textContent ?? '{}') as { structure: SiteStructure; version: string };
  const on = (type: string, fn: (e: Event) => void) => root.addEventListener(type, fn, { signal });
  const titleOf = (id: string) => root.querySelector(`[data-manager-section="${id}"] .section-name`)?.textContent?.trim() ?? id;
  const nameOf = (page: string) => root.querySelector<HTMLElement>(`[data-manager-row="${page}"]`)?.dataset.name ?? page;
  const say = (form: Element | null, text: string) => {
    const p = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
    if (p) {
      p.textContent = text;
      p.hidden = !text;
    } else root.dispatchEvent(new CustomEvent('manager:issue', { detail: text }));
  };

  /**
   * Saves the structure. On success the screen reloads (or opens `go`), with the focus on `focus` (a
   * selector) and `notice` announced; a refusal says why, in the form or over the list.
   */
  const put = async (next: SiteStructure, o: { focus?: string; form?: Element | null; notice?: string; go?: URL } = {}) => {
    saveStatus.saving();
    const r = await api('PUT', 'structure', { structure: next, ifMatch: { [STRUCTURE]: state.version } });
    if (r.ok) {
      if (o.focus) sessionStorage.setItem(FOCUS, o.focus);
      saveStatus.carry(o.notice ?? 'Saved');
      if (o.go) location.assign(o.go);
      else location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    saveStatus.failed(`Not saved: ${why}`);
    say(o.form ?? null, why);
  };

  // ---------- pages moved in the list ----------
  on('manager:move', (e) => {
    const m = (e as CustomEvent<ManagerMove>).detail;
    const items = m.pages.map((id) => ({ type: 'article' as const, id }));
    let next: SiteStructure;
    if (m.to === '_off') next = items.reduce((s, item) => unplace(s, item), state.structure);
    else {
      const taken = nodeIds(state.structure);
      next = placeAll(
        state.structure,
        m.to,
        items.map((item) => {
          const nodeId = unique(item.id, taken);
          taken.add(nodeId);
          return { item, nodeId };
        }),
        m.index,
      );
    }
    const what = m.pages.length === 1 ? nameOf(m.pages[0]) : `${m.pages.length} pages`;
    const moved = m.to === m.from ? `Moved ${what}` : m.to === '_off' ? `Took ${what} off the site` : `Moved ${what} to ${titleOf(m.to)}`;
    void put(next, { focus: m.to === m.from ? `[data-manager-grip="${m.pages[0]}"]` : `[data-manager-section="${m.to}"]`, notice: moved });
  });

  // ---------- a section's place among the sections (the keys on its link, or its settings' buttons) ----------
  const move = (id: string, by: number, form?: Element | null) => {
    const sections = state.structure.home.children ?? [];
    const from = sections.findIndex((c) => c.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= sections.length) return;
    void put(reorder(state.structure, state.structure.home.id, from, to), { focus: form ? `[data-sections-move="${by < 0 ? 'up' : 'down'}"][data-node="${id}"]` : `[data-manager-section="${id}"]`, form, notice: `Moved ${titleOf(id)} ${by < 0 ? 'up' : 'down'}` });
  };
  on('manager:reorder', (e) => {
    const { section, by } = (e as CustomEvent<ManagerReorder>).detail;
    move(section, by);
  });
  on('click', (e) => {
    const mv = (e.target as Element).closest<HTMLButtonElement>('[data-sections-move]');
    if (mv && !mv.disabled) move(mv.dataset.node!, mv.dataset.sectionsMove === 'up' ? -1 : 1, mv.closest('form'));
  });

  // ---------- a section's settings, and a new section ----------
  on('submit', (e) => {
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
      if (view === 'features' || view === 'list' || view === 'tiles' || view === 'bento') fields.view = view;
      let next = updateHub(state.structure, hub, fields);
      // its entry in the top navigation (the same menu the Navigation screen edits)
      if (nav) next = setInMenu(next, hub, nav.checked);
      void put(next, { focus: `[data-sections-hub="${hub}"] button[type="submit"]`, form, notice: `Saved ${title}` });
    } else if (form.hasAttribute('data-sections-new')) {
      e.preventDefault();
      const title = get('title');
      if (!title) return say(form, 'A section needs a title.');
      const id = unique(slugify(title), nodeIds(state.structure));
      const summary = get('summary');
      const v = get('view');
      const view = v === 'list' || v === 'tiles' || v === 'bento' ? v : 'features';
      // a section is always directly under the home page (three levels: V22), after the others
      const added = addHub(state.structure, state.structure.home.id, { id, kind: 'hub', slug: slugify(title), title, ...(summary ? { summary } : {}), view, children: [] });
      const go = new URL(location.href);
      go.searchParams.set(root.dataset.param ?? 'section', id);
      go.searchParams.delete('tab');
      void put(nav?.checked ? setInMenu(added, id, true) : added, { focus: `[data-manager-section="${id}"]`, form, notice: `Added ${title}`, go });
    }
  });

  // back where the last change left off (the status says what it was)
  const last = sessionStorage.getItem(FOCUS);
  sessionStorage.removeItem(FOCUS);
  if (last) document.querySelector<HTMLElement>(last)?.focus();
}
