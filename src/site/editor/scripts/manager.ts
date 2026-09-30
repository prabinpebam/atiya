/**
 * The Sections and Planet screens' two columns (documentation/sections/spec.md §7.2, §7.4): choosing a
 * section (kept in the address, so Back works), and moving its pages: dragging a handle to another place in
 * the list or onto a section on the left, Alt with Up or Down, or Move (the dialog a handle's click and Move
 * selected open: the single-pointer way, WCAG 2.5.7). Find, the status filter and the selection work per
 * section, and a selection moves together. A move is reported as a `manager:move` event on the root
 * ({ pages, from, to, index }, `index` being where they land among the pages that stay, the end if left
 * out), and a section's reorder as `manager:reorder` ({ section, by }); the screen decides what they
 * write, and reports a refusal back with `manager:issue`.
 */
export interface ManagerMove {
  /** The pages that move, in their order. */
  pages: string[];
  /** The section they leave. */
  from: string;
  /** The section they go to (`_off`: none). */
  to: string;
  /** Where they land among the pages that stay in `to`: the end if left out. */
  index?: number;
}

export interface ManagerReorder {
  section: string;
  by: -1 | 1;
}

const SCROLL = (path: string) => `editor.manager.scroll.${path}`;
const EDGE = 48;
const STEP = 16;
const pages = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;

/** What scrolls the screen: the nearest ancestor that scrolls, or the page. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

export function initManager(root: HTMLElement, signal: AbortSignal) {
  const param = root.dataset.param ?? 'section';
  const on = (el: EventTarget, type: string, fn: (e: Event) => void) => el.addEventListener(type, fn, { signal });
  const links = () => [...root.querySelectorAll<HTMLAnchorElement>('[data-manager-section]')];
  const nameOf = (id: string) => root.querySelector(`[data-manager-section="${id}"] .section-name`)?.textContent?.trim() ?? '';
  const panelOf = (id: string) => root.querySelector<HTMLElement>(`[data-manager-pages="${id}"]`);
  const rowsOf = (id: string) => [...(panelOf(id)?.querySelectorAll<HTMLElement>('[data-manager-row]') ?? [])];
  const pageOf = (row: HTMLElement) => row.dataset.managerRow!;
  const boxOf = (row: HTMLElement) => row.querySelector<HTMLInputElement>('[data-manager-pick] input');
  const issue = root.querySelector<HTMLElement>('[data-manager-issue]');
  let current = links().find((a) => a.getAttribute('aria-current') === 'true')?.dataset.managerSection ?? links()[0]?.dataset.managerSection ?? '';

  // ---------- the chosen section ----------
  const show = (id: string, push: boolean) => {
    if (!links().some((a) => a.dataset.managerSection === id)) return;
    current = id;
    for (const a of links()) {
      if (a.dataset.managerSection === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-manager-head], [data-manager-pages], [data-manager-settings]')) {
      el.hidden = (el.dataset.managerHead ?? el.dataset.managerPages ?? el.dataset.managerSettings) !== id;
    }
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set(param, id);
      history.pushState(history.state, '', url);
      // one column (a phone): the list is above, so bring the section's pages into view
      const list = root.querySelector<HTMLElement>('[data-manager-sections]');
      if (list && getComputedStyle(list).position !== 'sticky') root.querySelector<HTMLElement>('[data-manager-detail]')?.scrollIntoView({ block: 'start' });
    }
  };
  on(root, 'click', (e) => {
    const me = e as MouseEvent;
    const link = (me.target as Element).closest<HTMLAnchorElement>('[data-manager-section]');
    if (!link || me.button !== 0 || me.ctrlKey || me.metaKey || me.shiftKey || me.altKey) return;
    me.preventDefault();
    show(link.dataset.managerSection!, true);
  });
  on(window, 'popstate', () => show(new URL(location.href).searchParams.get(param) ?? links()[0]?.dataset.managerSection ?? '', false));
  // the tab shown stays in the address too, so a save (which reloads) comes back to it
  on(root, 'tabs:change', (e) => {
    const url = new URL(location.href);
    url.searchParams.set('tab', (e as CustomEvent<{ tab: string }>).detail.tab);
    history.replaceState(history.state, '', url);
  });

  // ---------- Find, Show, and the selection (each section its own) ----------
  const picked = (p: HTMLElement) => [...p.querySelectorAll<HTMLElement>('[data-manager-row]')].filter((r) => !r.hidden && boxOf(r)?.checked);
  const update = (p: HTMLElement) => {
    const rows = [...p.querySelectorAll<HTMLElement>('[data-manager-row]')];
    for (const r of rows) {
      const box = boxOf(r);
      if (box && r.hidden) box.checked = false;
      r.toggleAttribute('data-picked', !!box?.checked);
    }
    const sel = picked(p);
    const selectable = rows.filter((r) => !r.hidden && !boxOf(r)?.disabled);
    const all = p.querySelector<HTMLElement>('[data-manager-all]');
    const allBox = all?.querySelector<HTMLInputElement>('input');
    if (all && allBox) {
      allBox.checked = sel.length > 0 && sel.length === selectable.length;
      allBox.indeterminate = sel.length > 0 && sel.length < selectable.length;
      allBox.disabled = selectable.length === 0;
      all.toggleAttribute('data-disabled', allBox.disabled);
    }
    const move = p.querySelector<HTMLButtonElement>('[data-manager-move-selected]');
    if (move) move.disabled = sel.length === 0;
    const shown = rows.filter((r) => !r.hidden).length;
    const text = sel.length ? `${sel.length} selected` : shown < rows.length ? `${shown} of ${pages(rows.length)}` : pages(rows.length);
    // (the count is a polite live region: what the list now shows, or what's selected, is heard)
    const count = p.querySelector('[data-manager-count]')?.firstElementChild;
    if (count) count.textContent = text;
  };
  const filter = (p: HTMLElement) => {
    const q = (p.querySelector<HTMLInputElement>('[data-manager-find] input')?.value ?? '').trim().toLowerCase();
    const status = p.dataset.show ?? 'all';
    const rows = [...p.querySelectorAll<HTMLElement>('[data-manager-row]')];
    for (const r of rows) {
      const published = r.hasAttribute('data-published');
      r.hidden = (!!q && !(r.dataset.title ?? '').includes(q)) || (status === 'published' && !published) || (status === 'unpublished' && published);
    }
    const shown = rows.filter((r) => !r.hidden).length;
    const list = p.querySelector<HTMLElement>('[data-manager-list]');
    if (list) list.hidden = shown === 0;
    const none = p.querySelector<HTMLElement>('[data-manager-nomatch]');
    if (none) none.hidden = !(rows.length > 0 && shown === 0);
    update(p);
  };
  on(root, 'input', (e) => {
    const p = (e.target as Element).closest<HTMLElement>('[data-manager-pages]');
    if (p && (e.target as Element).closest('[data-manager-find]')) filter(p);
  });
  on(root, 'select-change', (e) => {
    const p = (e.target as Element).closest<HTMLElement>('[data-manager-pages]');
    if (!p || !(e.target as Element).closest('[data-manager-show]')) return;
    p.dataset.show = (e as CustomEvent<{ value: string }>).detail.value;
    filter(p);
  });
  on(root, 'change', (e) => {
    const box = e.target as HTMLInputElement;
    const p = box.closest<HTMLElement>('[data-manager-pages]');
    if (!p || box.type !== 'checkbox') return;
    if (box.closest('[data-manager-all]')) {
      for (const r of p.querySelectorAll<HTMLElement>('[data-manager-row]')) {
        const b = boxOf(r);
        if (b && !r.hidden && !b.disabled) b.checked = box.checked;
      }
    }
    update(p);
  });

  // ---------- a move, reported to the screen ----------
  const emit = (m: ManagerMove) => {
    if (m.from === m.to) {
      const order = rowsOf(m.from).map(pageOf);
      const stay = order.filter((id) => !m.pages.includes(id));
      const at = m.index ?? stay.length;
      if ([...stay.slice(0, at), ...m.pages, ...stay.slice(at)].join('\n') === order.join('\n')) return;
    }
    sessionStorage.setItem(SCROLL(location.pathname), String(scrollerOf(root).scrollTop));
    if (issue) issue.hidden = true;
    root.dispatchEvent(new CustomEvent<ManagerMove>('manager:move', { detail: m }));
  };
  on(root, 'manager:issue', (e) => {
    if (!issue) return;
    issue.textContent = (e as CustomEvent<string>).detail;
    issue.hidden = false;
  });

  // back where the last change left the screen
  const scrolled = Number(sessionStorage.getItem(SCROLL(location.pathname)) ?? 0);
  sessionStorage.removeItem(SCROLL(location.pathname));
  if (scrolled) scrollerOf(root).scrollTop = scrolled;

  // ---------- dragging a handle: in the list, or onto a section ----------
  const ghost = root.querySelector<HTMLElement>('[data-manager-ghost]');
  let dragged = false;
  on(root, 'pointerdown', (e) => {
    const pe = e as PointerEvent;
    const grip = (pe.target as Element).closest<HTMLButtonElement>('[data-manager-grip]');
    if (!grip || grip.disabled || pe.button !== 0 || !ghost) return;
    const row = grip.closest<HTMLElement>('[data-manager-row]')!;
    const panel = row.closest<HTMLElement>('[data-manager-pages]')!;
    const from = panel.dataset.managerPages!;
    const sel = picked(panel);
    // a handle of the selection drags all of it; any other drags its own page
    const group = sel.includes(row) ? sel : [row];
    const start = { x: pe.clientX, y: pe.clientY };
    const scroller = scrollerOf(root);
    let at = start;
    let frame = 0;
    let live = false;
    let target: { to: string; index?: number } | null = null;
    dragged = false;
    grip.setPointerCapture(pe.pointerId);

    const clear = () => {
      for (const el of root.querySelectorAll<HTMLElement>('[data-drop], [data-drop-target]')) {
        delete el.dataset.drop;
        delete el.dataset.dropTarget;
      }
    };
    const mark = () => {
      clear();
      target = null;
      const under = document.elementFromPoint(at.x, at.y);
      const link = under?.closest<HTMLElement>('[data-manager-section][data-holds]');
      if (link && link.dataset.managerSection !== from) {
        target = { to: link.dataset.managerSection! };
        link.dataset.dropTarget = '';
        return;
      }
      if (under?.closest('[data-manager-pages]') !== panel) return;
      const stay = rowsOf(from).filter((r) => !group.includes(r));
      const shown = stay.filter((r) => !r.hidden);
      const next = shown.findIndex((r) => {
        const b = r.getBoundingClientRect();
        return at.y < b.top + b.height / 2;
      });
      const last = shown[shown.length - 1];
      target = { to: from, index: next < 0 ? (last ? stay.indexOf(last) + 1 : stay.length) : stay.indexOf(shown[next]) };
      if (next >= 0) shown[next].dataset.drop = 'before';
      else if (last) last.dataset.drop = 'after';
    };
    /** Near the top or bottom, the screen scrolls along for as long as the pointer stays there. */
    const edges = () => {
      frame = 0;
      const box = scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : scroller.getBoundingClientRect();
      const before = scroller.scrollTop;
      if (at.y < box.top + EDGE) scroller.scrollTop -= STEP;
      else if (at.y > box.bottom - EDGE) scroller.scrollTop += STEP;
      if (scroller.scrollTop === before) return;
      mark();
      frame = requestAnimationFrame(edges);
    };
    const move = (ev: PointerEvent) => {
      if (!live) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        live = dragged = true;
        for (const r of group) r.dataset.dragging = '';
        const title = ghost.querySelector<HTMLElement>('[data-manager-ghost-title]');
        const count = ghost.querySelector<HTMLElement>('[data-manager-ghost-count]');
        if (title) title.textContent = row.dataset.name ?? '';
        if (count) {
          count.textContent = String(group.length);
          count.hidden = group.length < 2;
        }
        ghost.hidden = false;
      }
      ghost.style.setProperty('--x', `${ev.clientX}px`);
      ghost.style.setProperty('--y', `${ev.clientY}px`);
      at = { x: ev.clientX, y: ev.clientY };
      mark();
      if (!frame) frame = requestAnimationFrame(edges);
    };
    const end = (drop: boolean) => {
      cancelAnimationFrame(frame);
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', cancel);
      removeEventListener('keydown', escape, true);
      clear();
      for (const r of group) delete r.dataset.dragging;
      ghost.hidden = true;
      if (live && drop && target) emit({ pages: group.map(pageOf), from, to: target.to, index: target.index });
    };
    const up = () => end(true);
    const cancel = () => end(false);
    // Esc drops nothing: the pages stay where they were
    const escape = (k: KeyboardEvent) => {
      if (k.key !== 'Escape' || !live) return;
      k.preventDefault();
      k.stopPropagation();
      end(false);
    };
    grip.addEventListener('pointermove', move, { signal });
    grip.addEventListener('pointerup', up, { signal });
    grip.addEventListener('pointercancel', cancel, { signal });
    addEventListener('keydown', escape, { signal, capture: true });
  });

  // ---------- the keys: a page on its handle, a section on its link ----------
  on(root, 'keydown', (e) => {
    const k = e as KeyboardEvent;
    if (!k.altKey || (k.key !== 'ArrowUp' && k.key !== 'ArrowDown')) return;
    const by = k.key === 'ArrowUp' ? -1 : 1;
    const link = (k.target as Element).closest<HTMLElement>('[data-manager-section]');
    if (link && root.hasAttribute('data-reorder')) {
      k.preventDefault();
      root.dispatchEvent(new CustomEvent<ManagerReorder>('manager:reorder', { detail: { section: link.dataset.managerSection!, by } }));
      return;
    }
    const grip = (k.target as Element).closest<HTMLButtonElement>('[data-manager-grip]');
    if (!grip) return;
    k.preventDefault();
    const row = grip.closest<HTMLElement>('[data-manager-row]')!;
    const from = row.closest<HTMLElement>('[data-manager-pages]')!.dataset.managerPages!;
    const rows = rowsOf(from);
    const to = rows.indexOf(row) + by;
    if (to < 0 || to >= rows.length) return;
    emit({ pages: [pageOf(row)], from, to: from, index: to });
  });

  // ---------- Move: a handle's click (without dragging), or Move selected ----------
  const dialog = root.querySelector<HTMLDialogElement>('#manager-move');
  let moving: { pages: string[]; from: string; index: number; count: number } | null = null;
  const open = (rows: HTMLElement[], from: string) => {
    if (!dialog || !rows.length) return;
    const all = rowsOf(from);
    moving = { pages: rows.map(pageOf), from, index: all.indexOf(rows[0]), count: all.length };
    const name = dialog.querySelector('[data-manager-move-name]');
    if (name) name.textContent = rows.length === 1 ? `${rows[0].dataset.name}, in ${nameOf(from)}` : `${pages(rows.length)}, in ${nameOf(from)}`;
    const steps = dialog.querySelector<HTMLElement>('[data-manager-move-steps]');
    if (steps) steps.hidden = rows.length !== 1;
    for (const b of dialog.querySelectorAll<HTMLButtonElement>('[data-manager-move-by]')) {
      const i = moving.index + Number(b.dataset.managerMoveBy);
      b.disabled = i < 0 || i >= moving.count;
    }
    for (const b of dialog.querySelectorAll<HTMLButtonElement>('[data-manager-move-to]')) b.disabled = b.dataset.managerMoveTo === from;
    dialog.showModal();
  };
  on(root, 'click', (e) => {
    const t = e.target as Element;
    const grip = t.closest<HTMLButtonElement>('[data-manager-grip]');
    if (grip) {
      // (a drag ends in a click too: only a press that didn't move opens Move)
      if (dragged) return void (dragged = false);
      const row = grip.closest<HTMLElement>('[data-manager-row]')!;
      return open([row], row.closest<HTMLElement>('[data-manager-pages]')!.dataset.managerPages!);
    }
    const selected = t.closest<HTMLButtonElement>('[data-manager-move-selected]');
    if (selected) {
      const p = selected.closest<HTMLElement>('[data-manager-pages]')!;
      return open(picked(p), p.dataset.managerPages!);
    }
    const by = t.closest<HTMLElement>('[data-manager-move-by]');
    const to = t.closest<HTMLElement>('[data-manager-move-to]');
    if (!moving || (!by && !to)) return;
    const m = moving;
    dialog?.close();
    if (by) emit({ pages: m.pages, from: m.from, to: m.from, index: m.index + Number(by.dataset.managerMoveBy) });
    else emit({ pages: m.pages, from: m.from, to: to!.dataset.managerMoveTo! });
  });
}
