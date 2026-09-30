/**
 * The Sections screen (documentation/editor/spec.md §5): the tree's keys, and every change to the site
 * structure: reorder, place, take off the site, a hub's settings, a new section. Each change is one
 * store transaction (PUT structure, with its version); the store refuses a change that would move a
 * published page, and the screen says why.
 */
import { api, announce, describeIssue } from './client';
import { addHub, nodeIds, place, reorder, setInMenu, unplace, updateHub } from '../model/structure';
import { slugify, unique } from '../model/ids';
import type { SiteStructure } from '../../content/schema';

const STRUCTURE = '/content/structures/site.json';

export function initSections(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(document.querySelector('[data-editor-sections-state]')?.textContent ?? '{}') as { structure: SiteStructure; version: string };
  const items = [...root.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  const say = (form: Element | null, text: string) => {
    const p = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
    if (p) {
      p.textContent = text;
      p.hidden = !text;
    }
  };

  const put = async (next: SiteStructure, focusNode?: string, form?: Element | null) => {
    announce('Saving\u2026');
    const r = await api('PUT', 'structure', { structure: next, ifMatch: { [STRUCTURE]: state.version } });
    if (r.ok) {
      if (focusNode) sessionStorage.setItem('editor.sections.focus', focusNode);
      location.reload();
      return;
    }
    const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
    announce(`Not saved: ${why}`, 'negative');
    say(form ?? null, why);
  };

  // ---------- the tree ----------
  const focusItem = (el: HTMLElement | undefined) => {
    if (!el) return;
    items.forEach((i) => (i.tabIndex = i === el ? 0 : -1));
    el.focus();
  };
  const selectHub = (el: HTMLElement) => {
    items.forEach((i) => i.setAttribute('aria-selected', i === el ? 'true' : 'false'));
    root.querySelectorAll<HTMLFormElement>('[data-sections-hub]').forEach((f) => (f.hidden = f.dataset.sectionsHub !== el.dataset.node));
    const hint = root.querySelector<HTMLElement>('[data-sections-hint]');
    if (hint) hint.hidden = true;
  };
  const open = (el: HTMLElement) => {
    if (el.dataset.kind === 'hub') selectHub(el);
    else if (el.dataset.href) location.assign(el.dataset.href);
  };
  const move = (el: HTMLElement, by: -1 | 1) => {
    const hub = el.dataset.parent;
    const from = Number(el.dataset.position);
    if (!hub) return;
    announce(`Moving ${by < 0 ? 'up' : 'down'}\u2026`);
    void put(reorder(state.structure, hub, from, from + by), el.dataset.node);
  };

  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const mv = t.closest<HTMLElement>('[data-sections-move]');
      if (mv) {
        const el = items.find((i) => i.dataset.node === mv.dataset.node);
        if (el) move(el, mv.dataset.sectionsMove === 'up' ? -1 : 1);
        return;
      }
      const off = t.closest<HTMLElement>('[data-sections-unplace]');
      if (off) return void put(unplace(state.structure, { type: 'article', id: off.dataset.sectionsUnplace! }));
      const item = t.closest<HTMLElement>('[role="treeitem"]');
      if (item) {
        focusItem(item);
        open(item);
      }
    },
    { signal },
  );
  root.addEventListener(
    'keydown',
    (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[role="treeitem"]');
      if (!el || (e.target as Element) !== el) return;
      const i = items.indexOf(el);
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        move(el, e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusItem(items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        focusItem(items[e.key === 'Home' ? 0 : items.length - 1]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        open(el);
      }
    },
    { signal },
  );

  // ---------- a hub's settings ----------
  root.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement;
      if (form.dataset.sectionsHub) {
        e.preventDefault();
        const d = new FormData(form);
        const get = (k: string) => (d.has(k) ? String(d.get(k) ?? '').trim() : undefined);
        const title = get('title');
        if (!title) return say(form, 'A section needs a title.');
        const fields: Parameters<typeof updateHub>[2] = { title, navLabel: get('navLabel'), summary: get('summary') };
        const slug = get('slug');
        if (slug !== undefined && !form.querySelector<HTMLInputElement>('input[name="slug"]')?.disabled) fields.slug = slug;
        const view = get('view');
        if (view === 'list' || view === 'tiles' || view === 'bento') fields.view = view;
        let next = updateHub(state.structure, form.dataset.sectionsHub, fields);
        // the section's entry in the top navigation (the same menu the Navigation screen edits)
        const nav = form.querySelector<HTMLInputElement>('[data-sections-in-nav] input');
        if (nav) next = setInMenu(next, form.dataset.sectionsHub, nav.checked);
        void put(next, form.dataset.sectionsHub, form);
      } else if (form.hasAttribute('data-sections-new')) {
        e.preventDefault();
        const d = new FormData(form);
        const title = String(d.get('title') ?? '').trim();
        if (!title) return say(form, 'A section needs a title.');
        const id = unique(slugify(title), nodeIds(state.structure));
        const summary = String(d.get('summary') ?? '').trim();
        const v = String(d.get('view') ?? 'tiles');
        const view = v === 'list' || v === 'bento' ? v : 'tiles';
        // a section is always directly under the home page (three levels: V22)
        const added = addHub(state.structure, state.structure.home.id, { id, kind: 'hub', slug: slugify(title), title, ...(summary ? { summary } : {}), view, children: [] });
        const nav = form.querySelector<HTMLInputElement>('[data-sections-in-nav] input');
        void put(nav?.checked ? setInMenu(added, id, true) : added, id, form);
      }
    },
    { signal },
  );

  // ---------- placing an article ----------
  root.querySelectorAll<HTMLElement>('[data-sections-place]').forEach((sel) =>
    sel.addEventListener(
      'select-change',
      (e) => {
        const hub = (e as CustomEvent<{ value: string }>).detail.value;
        const id = sel.dataset.sectionsPlace!;
        if (hub) void put(place(state.structure, hub, { type: 'article', id }, unique(id, nodeIds(state.structure))), undefined);
      },
      { signal },
    ),
  );

  // back where the last change left off
  const last = sessionStorage.getItem('editor.sections.focus');
  if (last) {
    sessionStorage.removeItem('editor.sections.focus');
    const el = items.find((i) => i.dataset.node === last);
    if (el) {
      focusItem(el);
      if (el.dataset.kind === 'hub') selectHub(el);
    }
  }
}
