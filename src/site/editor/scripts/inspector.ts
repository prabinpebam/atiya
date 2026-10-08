/**
 * The inspector's sections (documentation/editor/spec.md §3.5): in a wide inspector, the list of sections
 * beside the chosen one's fields. Which one is chosen is kept for each kind of form (a collection, a
 * picture, the page) while the editor is open, so it survives the inspector being drawn again after a
 * change; it follows a collection's item when the item moves (the rules are pure, in model/inspector.ts).
 * A narrow inspector shows every section in turn, so none of this changes what it shows.
 */

const chosen = new Map<string, string>();

const panesOf = (host: Element) => [...host.querySelectorAll<HTMLElement>('[data-section]')];

/** Marks a section of a form as the one shown (the first, when the key names none). */
function show(host: HTMLElement, key: string | undefined): void {
  const panes = panesOf(host);
  const pick = panes.find((p) => p.dataset.section === key) ?? panes[0];
  for (const p of panes) p.toggleAttribute('data-current', p === pick);
  for (const b of host.querySelectorAll<HTMLElement>('[data-section-pick]')) {
    if (pick && b.dataset.sectionPick === pick.dataset.section) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  }
}

/** Shows each form's chosen section: after the inspector is drawn, or a block selected. */
export function applySections(root: ParentNode): void {
  for (const host of root.querySelectorAll<HTMLElement>('[data-sections]')) show(host, chosen.get(host.dataset.sections!));
}

/** Chooses a section of a form, and keeps the choice for that kind of form. */
export function chooseSection(host: HTMLElement, key: string): void {
  chosen.set(host.dataset.sections!, key);
  show(host, key);
}

/** The section a kind of form shows next, from the one it shows now (a collection's item that moved). */
export function followSection(kind: string, next: (current: string | undefined) => string | undefined): void {
  const key = next(chosen.get(kind));
  if (key === undefined) chosen.delete(kind);
  else chosen.set(kind, key);
}

/** Shows the section a field is in (a value refused there, so it isn't hidden in another section). */
export function revealField(field: Element): void {
  const pane = field.closest<HTMLElement>('[data-section]');
  const host = field.closest<HTMLElement>('[data-sections]');
  if (pane && host) chooseSection(host, pane.dataset.section!);
}

export function initSections(root: HTMLElement, signal: AbortSignal): void {
  root.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-section-pick]');
      const host = b?.closest<HTMLElement>('[data-sections]');
      if (b && host) chooseSection(host, b.dataset.sectionPick!);
    },
    { signal },
  );
  // Up and Down (Home and End) move along the list of sections, across its groups
  root.addEventListener(
    'keydown',
    (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-section-pick]');
      const nav = b?.closest('nav');
      if (!b || !nav || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      const all = [...nav.querySelectorAll<HTMLElement>('[data-section-pick]')];
      const at = all.indexOf(b);
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : at + (e.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= all.length) return;
      e.preventDefault();
      all[to].focus();
    },
    { signal },
  );
}
