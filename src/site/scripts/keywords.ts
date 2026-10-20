/**
 * Keywords' DOM wiring (tier 0; docs: documentation/home-views/keywords.md §5, §8, §9). A press on a keyword picks
 * or unpicks it; the tray, the matches and the address (`?pick=`, no history entry) follow, and the status line says
 * what changed. The field is one Tab stop (a roving tabindex across the groups' keywords); on a phone a group's row
 * opens its keywords. Or type a skill is a combobox over the same keywords (their labels and synonyms). Opening a
 * match shows its links; Show all shows every match. The matches slide to their new places only when the person's
 * motion allows and less motion isn't asked for. Nothing moves on its own. Keywords.astro's script runs it on each
 * Keywords view through `each`; the rules are pure (scripts/keywordsRules.ts) and unit-tested.
 */
import { askAbout, matchesFor, pickStatus, picksFrom, suggest, withPicks, type IndexedKeyword } from './keywordsRules';
import { track } from './telemetry';

/** Matches shown before Show all. */
const SHOWN = 6;

const ms = (v: string) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) || 0;

export function setupKeywords(root: HTMLElement, signal: AbortSignal): void {
  const index = JSON.parse(root.querySelector('[data-kw-index]')?.textContent || '[]') as IndexedKeyword[];
  const byId = new Map(index.map((k) => [k.id, k]));
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-kw]')];
  const cards = [...root.querySelectorAll<HTMLElement>('[data-kw-item]')];
  const order = cards.map((c) => c.dataset.kwItem!);
  const cardOf = new Map(cards.map((c) => [c.dataset.kwItem!, c]));
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);
  const tray = q('[data-kw-tray]');
  const picked = q('[data-kw-picked]');
  const list = q('[data-kw-cards]');
  const summaries = q('[data-kw-summaries]');
  const heading = q('[data-kw-heading]');
  const all = q('[data-kw-all]');
  const status = q('[data-kw-status]');
  const ask = q<HTMLAnchorElement>('[data-kw-ask]');
  const contact = root.dataset.contact || undefined;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let picks: string[] = picksFrom(location.search, new Set(byId.keys()));
  let showAll = false;

  const labelOf = (id: string) => byId.get(id)?.label ?? id;
  const trayItem = (id: string) => q(`[data-kw-tray-item="${CSS.escape(id)}"]`);

  /** The keywords a Tab or an arrow can reach: those in a group that's open (a phone's rows), never a hidden one. */
  const reachable = () => chips.filter((c) => c.checkVisibility());
  const setStop = (chip: HTMLButtonElement) => {
    for (const c of chips) c.tabIndex = c === chip ? 0 : -1;
  };
  const ensureStop = () => {
    const r = reachable();
    if (r.length && !r.some((c) => c.tabIndex === 0)) setStop(r[0]);
  };

  /** Slides the shown matches from where they were to where they are, and fades in the new ones. */
  const settle = (before: Map<string, number>) => {
    if (root.dataset.motion === 'still' || reduce.matches) return;
    const css = getComputedStyle(root);
    const timing = { duration: ms(css.getPropertyValue('--duration-base')), easing: css.getPropertyValue('--ease-standard').trim() || 'ease' };
    for (const card of cards) {
      if (card.hidden) continue;
      const was = before.get(card.dataset.kwItem!);
      const dy = was === undefined ? 0 : was - card.getBoundingClientRect().top;
      if (was === undefined) card.animate([{ opacity: 0 }, { opacity: 1 }], timing);
      else if (Math.abs(dy) > 1) card.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], timing);
    }
  };

  const render = (change?: Parameters<typeof pickStatus>[0]) => {
    const before = new Map(cards.filter((c) => !c.hidden).map((c) => [c.dataset.kwItem!, c.getBoundingClientRect().top]));
    for (const c of chips) c.setAttribute('aria-pressed', String(picks.includes(c.dataset.kw!)));
    for (const g of root.querySelectorAll<HTMLElement>('[data-kw-group]')) {
      const n = [...g.querySelectorAll<HTMLElement>('[data-kw]')].filter((c) => picks.includes(c.dataset.kw!)).length;
      const count = g.querySelector('[data-kw-count]');
      if (count) count.textContent = n ? `${n} picked` : '';
    }
    // the tray: the picks in the order they were made
    for (const item of picked?.querySelectorAll<HTMLElement>('[data-kw-tray-item]') ?? []) {
      const on = picks.includes(item.dataset.kwTrayItem!);
      if (!on) item.hidden = true;
    }
    for (const id of picks) {
      const item = trayItem(id);
      if (item?.hidden) {
        picked?.append(item);
        item.hidden = false;
      }
    }
    if (tray) tray.hidden = picks.length === 0;
    if (ask) {
      const href = askAbout(contact, picks.map(labelOf));
      if (href) ask.href = href;
    }

    const found = matchesFor(picks, index, order);
    const shown = showAll ? found : found.slice(0, SHOWN);
    if (summaries) summaries.hidden = picks.length > 0;
    if (list) list.hidden = picks.length === 0;
    if (heading) heading.textContent = picks.length ? `${found.length} ${found.length === 1 ? 'match' : 'matches'}, best first` : (heading.dataset.rest ?? '');
    for (const card of cards) card.hidden = true;
    for (const m of shown) {
      const card = cardOf.get(m.key);
      if (!card) continue;
      list?.append(card);
      card.hidden = false;
      const why = card.querySelector('[data-kw-why]');
      if (why) why.textContent = `Match: ${m.matched.map(labelOf).join(', ')}`;
    }
    if (all) {
      all.hidden = showAll || found.length <= SHOWN;
      const button = all.querySelector('button');
      if (button) button.textContent = `Show all ${found.length}`;
    }
    settle(before);
    ensureStop();
    if (change && status) status.textContent = pickStatus(change, found.length, picks.length);
    const search = withPicks(location.search, picks);
    if (search !== location.search) history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`);
  };

  const toggle = (id: string, on = !picks.includes(id)) => {
    if (!byId.has(id) || on === picks.includes(id)) return;
    picks = on ? [...picks, id] : picks.filter((p) => p !== id);
    showAll = false;
    render({ label: labelOf(id), on });
    track('keyword_pick', { id, on });
  };

  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    const chip = target.closest<HTMLButtonElement>('[data-kw]');
    if (chip) {
      setStop(chip);
      toggle(chip.dataset.kw!);
      return;
    }
    const remove = target.closest<HTMLElement>('[data-kw-remove]');
    if (remove) {
      const id = remove.dataset.kwRemove!;
      const next = picks[picks.indexOf(id) + 1] ?? picks[picks.indexOf(id) - 1];
      toggle(id, false);
      // the keyboard stays in the tray, else goes back to the field
      (next ? q(`[data-kw-remove="${CSS.escape(next)}"]`) : reachable().find((c) => c.tabIndex === 0))?.focus();
      return;
    }
    if (target.closest('[data-kw-clear]')) {
      picks = [];
      showAll = false;
      render({ cleared: true });
      reachable().find((c) => c.tabIndex === 0)?.focus();
      return;
    }
    if (target.closest('[data-kw-copy]')) {
      const say = (text: string) => status && (status.textContent = text);
      navigator.clipboard?.writeText(location.href).then(
        () => say('Link copied.'),
        () => say('Couldn’t copy the link. Copy the address from the address bar.'),
      ) ?? say('Couldn’t copy the link. Copy the address from the address bar.');
      return;
    }
    if (target.closest('[data-kw-show-all]')) {
      const at = cards.filter((c) => !c.hidden).length;
      showAll = true;
      render();
      list?.querySelectorAll<HTMLElement>('[data-kw-item]:not([hidden]) [data-kw-open]')[at]?.focus();
      return;
    }
    const open = target.closest<HTMLElement>('[data-kw-open]');
    if (open) {
      const more = document.getElementById(open.getAttribute('aria-controls') ?? '');
      const on = open.getAttribute('aria-expanded') !== 'true';
      open.setAttribute('aria-expanded', String(on));
      if (more) more.hidden = !on;
      if (on) track('capability_l3_open', { id: open.closest<HTMLElement>('[data-kw-strength]')?.dataset.kwStrength, view: 'keywords', kind: 'all' });
      return;
    }
    const row = target.closest<HTMLElement>('[data-kw-row]');
    if (row) {
      const group = row.closest<HTMLElement>('[data-kw-group]');
      const on = row.getAttribute('aria-expanded') !== 'true';
      row.setAttribute('aria-expanded', String(on));
      group?.toggleAttribute('data-open', on);
      const firstChip = group?.querySelector<HTMLButtonElement>('[data-kw]');
      if (on && firstChip) setStop(firstChip);
      else ensureStop();
    }
  });

  // a phone's rows are disclosures (shown only once this runs)
  for (const row of root.querySelectorAll<HTMLElement>('[data-kw-row]')) {
    row.setAttribute('aria-controls', row.dataset.kwRow!);
    row.setAttribute('aria-expanded', 'false');
  }

  // the field's arrow keys: across the groups' keywords, never out of the field
  root.querySelector('[data-kw-field] .groups')?.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    const chip = (ev.target as Element).closest<HTMLButtonElement>('[data-kw]');
    if (!chip || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const r = reachable();
    const i = r.indexOf(chip);
    const to =
      ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? r[(i + 1) % r.length]
      : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? r[(i - 1 + r.length) % r.length]
      : ev.key === 'Home' ? r[0]
      : ev.key === 'End' ? r[r.length - 1]
      : undefined;
    if (!to) return;
    ev.preventDefault();
    setStop(to);
    to.focus();
  });

  setupTyping(root, byId, (k) => toggle(k.id, true), contact, status);

  root.toggleAttribute('data-ready', true);
  if (picks.length) render();
  else ensureStop();
  signal.addEventListener('abort', () => root.removeAttribute('data-ready'));
}

/** Or type a skill: a combobox over the keywords, their labels and synonyms (WAI-ARIA combobox with a listbox). */
function setupTyping(root: HTMLElement, byId: Map<string, IndexedKeyword>, pick: (k: IndexedKeyword) => void, contact: string | undefined, status: HTMLElement | null) {
  const box = root.querySelector<HTMLElement>('[data-kw-type]');
  const input = box?.querySelector<HTMLInputElement>('input');
  const listbox = box?.querySelector<HTMLElement>('[data-kw-suggestions]');
  if (!box || !input || !listbox) return;
  const none = box.querySelector<HTMLElement>('[data-kw-none]');
  const noneText = box.querySelector<HTMLElement>('[data-kw-none-text]');
  const noneAsk = box.querySelector<HTMLAnchorElement>('[data-kw-none-ask]');
  const options = new Map([...listbox.querySelectorAll<HTMLElement>('[data-kw-option]')].map((o) => [o.dataset.kwOption!, o]));
  const keywords = [...byId.values()];
  let shown: IndexedKeyword[] = [];
  let active = -1;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listbox.id);
  input.setAttribute('aria-expanded', 'false');

  const mark = (i: number) => {
    active = i;
    shown.forEach((k, j) => options.get(k.id)?.setAttribute('aria-selected', String(j === i)));
    const on = shown[i] && options.get(shown[i].id);
    if (on) input.setAttribute('aria-activedescendant', on.id);
    else input.removeAttribute('aria-activedescendant');
  };
  const close = () => {
    shown = [];
    mark(-1);
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const open = (text: string) => {
    shown = suggest(text, keywords);
    for (const o of options.values()) o.hidden = true;
    for (const k of shown) {
      const o = options.get(k.id);
      if (!o) continue;
      listbox.append(o);
      o.hidden = false;
    }
    listbox.hidden = shown.length === 0;
    input.setAttribute('aria-expanded', String(shown.length > 0));
    mark(-1);
  };
  const choose = (k: IndexedKeyword) => {
    input.value = '';
    close();
    if (none) none.hidden = true;
    track('skill_typed', { matched: true });
    pick(k);
  };
  const nothing = (text: string) => {
    close();
    if (!none || !noneText) return;
    noneText.textContent = `Nothing on the site shows ${text} yet.`;
    if (noneAsk) {
      const href = askAbout(contact, [text]);
      if (href) noneAsk.href = href;
    }
    none.hidden = false;
    if (status) status.textContent = noneText.textContent;
    track('skill_typed', { matched: false });
  };

  input.addEventListener('input', () => {
    if (none) none.hidden = true;
    open(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!shown.length) open(input.value);
      if (!shown.length) return;
      e.preventDefault();
      const by = e.key === 'ArrowDown' ? 1 : -1;
      mark((active + by + shown.length + (active < 0 && by < 0 ? 1 : 0)) % shown.length);
    } else if (e.key === 'Enter') {
      const text = input.value.trim();
      if (!text) return;
      e.preventDefault();
      const k = shown[active] ?? suggest(text, keywords)[0];
      if (k) choose(k);
      else if (text.length >= 2) nothing(text);
    } else if (e.key === 'Escape') {
      if (!listbox.hidden) {
        e.preventDefault();
        close();
      } else if (input.value) {
        e.preventDefault();
        input.value = '';
      }
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 0));
  // a press on a suggestion keeps the keyboard in the field
  listbox.addEventListener('pointerdown', (e) => e.preventDefault());
  listbox.addEventListener('click', (e) => {
    const id = (e.target as Element).closest<HTMLElement>('[data-kw-option]')?.dataset.kwOption;
    const k = id && byId.get(id);
    if (k) choose(k);
  });
}
