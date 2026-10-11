/**
 * The select's DOM wiring (tier 0; docs: documentation/site-ui/design-system.md §2): opening, placing and
 * closing its list, the active option, choosing, and its events. Select.astro's script runs it on each
 * select through `each`; the keyboard model, typeahead and placement are pure in `listbox.ts`, and
 * unit-tested.
 */
import { keyAction, listLeft, listRoom, listTop, matchIndex, opensUp, typeahead, LIST_MARGIN, type Typed } from './listbox';

export function setupSelect(root: HTMLElement, signal: AbortSignal): void {
  if (root.dataset.ready) return;
  root.dataset.ready = '';
  const combo = root.querySelector<HTMLElement>('[data-combo]')!;
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const options = [...root.querySelectorAll<HTMLElement>('[data-option]')];
  const input = root.querySelector<HTMLInputElement>('[data-input]');
  const valueText = root.querySelector<HTMLElement>('[data-value-text]')!;
  const labels = options.map((o) => o.dataset.label ?? '');
  let open = false;
  let active = options.findIndex((o) => o.getAttribute('aria-selected') === 'true');
  let typed: Typed = { text: '', at: 0 };

  const usable = (i: number) => i >= 0 && options[i]?.getAttribute('aria-disabled') !== 'true';

  function setActive(i: number) {
    active = i;
    options.forEach((o, k) => o.toggleAttribute('data-active', k === i));
    if (open && i >= 0) {
      combo.setAttribute('aria-activedescendant', options[i].id);
      options[i].scrollIntoView({ block: 'nearest' });
    } else combo.removeAttribute('aria-activedescendant');
  }

  // the list opens in the top layer where the browser has one (the Popover API): no dialog or scrolling
  // panel around the select can clip it; elsewhere it opens in place
  const layered = typeof list.showPopover === 'function' && list.hasAttribute('popover') && CSS.supports('selector(:popover-open)');

  /** Places the open list against its button: below it, or above when there's more room there; in the window. */
  function position() {
    const r = combo.getBoundingClientRect();
    const below = innerHeight - r.bottom;
    const above = r.top;
    const up = opensUp(below, above, list.scrollHeight);
    if (up) root.dataset.placement = 'top';
    else root.removeAttribute('data-placement');
    if (!layered) return;
    list.style.setProperty('--list-width', `${r.width}px`);
    list.style.setProperty('--list-room', `${listRoom(up, above, below)}px`);
    const w = list.offsetWidth;
    list.style.setProperty('--list-left', `${listLeft(r, w, root.dataset.align === 'end', innerWidth, LIST_MARGIN)}px`);
    list.style.setProperty('--list-top', `${listTop(up, r, list.offsetHeight)}px`);
  }

  function place() {
    // shown again on each opening, so it's over whatever opened since (a modal dialog, the header)
    if (layered) {
      if (list.matches(':popover-open')) list.hidePopover();
      list.showPopover();
    }
    position();
  }

  if (layered) {
    document.addEventListener('scroll', () => open && position(), { capture: true, passive: true, signal });
    addEventListener('resize', () => open && position(), { signal });
    // once it has faded out, it leaves the top layer
    list.addEventListener('transitionend', () => !open && list.matches(':popover-open') && list.hidePopover(), { signal });
    signal.addEventListener('abort', () => list.matches(':popover-open') && list.hidePopover());
  }

  function setOpen(o: boolean) {
    if (combo.getAttribute('aria-disabled') === 'true') return;
    open = o;
    combo.setAttribute('aria-expanded', String(o));
    // placed (and, in the top layer, shown) before it's marked open, so it fades in from its closed look
    if (o) place();
    root.toggleAttribute('data-open', o);
    setActive(o ? active : -1);
    if (!o) active = options.findIndex((x) => x.getAttribute('aria-selected') === 'true');
  }

  function choose(i: number) {
    if (!usable(i)) return;
    const prev = options.findIndex((x) => x.getAttribute('aria-selected') === 'true');
    options.forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
    const o = options[i];
    valueText.textContent = o.dataset.label ?? '';
    valueText.classList.remove('placeholder');
    const icon = o.querySelector('.option-icon');
    const shown = root.querySelector('[data-value-icon]');
    if (icon && shown) {
      shown.setAttribute('viewBox', icon.getAttribute('viewBox') ?? '');
      shown.setAttribute('data-icon', icon.getAttribute('data-icon') ?? '');
      shown.innerHTML = icon.innerHTML;
    }
    active = i;
    if (prev === i) return;
    if (input) {
      input.value = o.dataset.value ?? '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    root.dispatchEvent(new CustomEvent('select-change', { bubbles: true, detail: { value: o.dataset.value } }));
  }

  combo.addEventListener('click', () => setOpen(!open));
  combo.addEventListener('keydown', (e) => {
    const act = keyAction(e, { open, active, count: options.length });
    switch (act.type) {
      case 'none':
        return;
      case 'open':
        e.preventDefault();
        setOpen(true);
        setActive(act.active);
        return;
      case 'move':
        e.preventDefault();
        setActive(act.active);
        return;
      case 'commit':
        if (act.keepFocus) e.preventDefault();
        choose(act.active);
        setOpen(false);
        return;
      case 'close':
        e.preventDefault();
        setOpen(false);
        return;
      case 'type': {
        typed = typeahead(typed, act.char, performance.now());
        const i = matchIndex(labels, typed.text, active);
        if (i < 0) return;
        if (!open) setOpen(true);
        setActive(i);
      }
    }
  });
  combo.addEventListener('blur', (e) => {
    if (!open) return;
    const to = (e as FocusEvent).relatedTarget as Node | null;
    if (to && list.contains(to)) return;
    setOpen(false);
  });
  options.forEach((o, i) => {
    o.addEventListener('pointermove', () => open && usable(i) && active !== i && setActive(i));
    // keep focus on the combobox while the pointer is down on an option
    o.addEventListener('pointerdown', (e) => e.preventDefault());
    o.addEventListener('click', () => {
      if (!usable(i)) return;
      choose(i);
      setOpen(false);
      combo.focus();
    });
  });
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (open && !root.contains(e.target as Node)) setOpen(false);
    },
    { signal },
  );
  // set from outside (the theme switch shows the saved theme): no change event if it's already chosen
  root.addEventListener('select-set', (e) => {
    const i = options.findIndex((o) => o.dataset.value === (e as CustomEvent<{ value: string }>).detail.value);
    if (i >= 0) choose(i);
  });
  root.dispatchEvent(new CustomEvent('select-ready', { bubbles: true }));
}
