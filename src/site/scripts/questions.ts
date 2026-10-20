/**
 * Questions' DOM wiring (tier 0; docs: documentation/home-views/questions.md §5, §9). Wide, the list is a vertical
 * tab list (the WAI-ARIA tabs pattern, manual activation), each answer its tab panel; on a phone (the component
 * narrower than its phone query, which it names in `data-phone`) the answers are an accordion, the first few questions then Show more
 * questions. One answer is open at a time (question 1 at rest); `#q<n>` opens one, a press puts it in the address (no
 * history entry). Next and a found answer move the focus to the answer. Ask something else finds the closest answers
 * to a typed question in the page's own index (the words never leave it). Questions.astro's script runs it on each
 * Questions view through `each`; the rules are pure (scripts/questionsRules.ts) and unit-tested.
 */
import { askAbout } from './keywordsRules';
import { narrowerThan } from './media';
import { FIRST_ROWS, answerFrom, askedStatus, closest, moreLabel, type IndexedAnswer } from './questionsRules';
import { track } from './telemetry';

type Mode = 'tabs' | 'accordion';
/** How an answer was opened: pressed (its address, telemetry), pressed and focused (Next, a found answer), asked (a found answer: its own event), or by its address (nothing else). */
interface How {
  press?: boolean;
  focus?: boolean;
  asked?: boolean;
}

const ms = (v: string) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) || 0;

export function setupQuestions(root: HTMLElement, signal: AbortSignal): void {
  const index = JSON.parse(root.querySelector('[data-q-index]')?.textContent || '[]') as IndexedAnswer[];
  const count = index.length;
  const tabs = [...root.querySelectorAll<HTMLAnchorElement>('[data-q-tab]')];
  const sections = [...root.querySelectorAll<HTMLElement>('[data-q-answer]')];
  const panels = sections.map((s) => s.querySelector<HTMLElement>('[data-q-panel]')!);
  const rows = sections.map((s) => s.querySelector<HTMLElement>('[data-q-row]'));
  const tablist = root.querySelector<HTMLElement>('[data-q-tabs]');
  const more = root.querySelector<HTMLElement>('[data-q-more]');
  const note = root.querySelector<HTMLElement>('[data-q-closest]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const css = () => getComputedStyle(root);
  const narrower = (token = '') => narrowerThan(root.clientWidth, css().getPropertyValue(token), parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  let mode: Mode | undefined;
  let open: number | null = answerFrom(location.hash, count) ?? (count ? 1 : null);

  const render = () => {
    sections.forEach((s, i) => {
      const on = i + 1 === open;
      panels[i].hidden = !on;
      s.toggleAttribute('data-open', on);
      rows[i]?.setAttribute('aria-expanded', String(on));
      if (mode === 'tabs' && tabs[i]) {
        tabs[i].setAttribute('aria-selected', String(on));
        tabs[i].tabIndex = on ? 0 : -1;
      }
    });
    // a phone's Show more questions: how many it adds, gone once pressed or when there are no more
    const rest = sections.filter((_, i) => i >= FIRST_ROWS && i + 1 !== open).length;
    const label = more?.querySelector('[data-q-more-label]');
    if (label) label.textContent = moreLabel(rest);
    if (more) more.hidden = rest === 0 || root.hasAttribute('data-more');
  };

  const show = (n: number | null, how: How = {}) => {
    const was = open;
    open = n;
    if (!how.asked && note) note.hidden = true;
    render();
    if (how.press || how.focus) {
      history.replaceState(history.state, '', `${location.pathname}${location.search}${n ? `#q${n}` : ''}`);
      if (n && !how.asked) track('question_open', { id: index[n - 1]?.id });
    }
    if (!n) return;
    const panel = panels[n - 1];
    if (n !== was && (how.press || how.focus) && !reduce.matches) {
      const style = css();
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(style.getPropertyValue('--duration-base')), easing: style.getPropertyValue('--ease-enter').trim() || 'ease' });
    }
    if (how.focus) {
      // an answer reads from its start: brought to the top when its start is out of view or it's taller than the view
      const target = mode === 'accordion' ? sections[n - 1] : panel;
      const box = target.getBoundingClientRect();
      const clear = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(target).scrollMarginBlockStart) || 0);
      const start = box.top < clear || box.height + clear > innerHeight;
      target.scrollIntoView({ block: start ? 'start' : 'nearest' });
      panel.focus({ preventScroll: true });
    }
  };

  /** Tabs or an accordion, by the component's own width; the roles follow. */
  const applyMode = () => {
    const m: Mode = narrower(root.dataset.phone) ? 'accordion' : 'tabs';
    const orient = () => mode === 'tabs' && tablist?.setAttribute('aria-orientation', narrower(root.dataset.stack) ? 'horizontal' : 'vertical');
    if (m === mode) return void orient();
    mode = m;
    root.dataset.mode = m;
    const on = m === 'tabs';
    const label = tablist?.closest('nav')?.getAttribute('aria-labelledby');
    if (tablist) {
      for (const [k, v] of [['role', 'tablist'], ['aria-labelledby', label ?? '']]) on ? tablist.setAttribute(k, v) : tablist.removeAttribute(k);
      if (!on) tablist.removeAttribute('aria-orientation');
    }
    tabs.forEach((t, i) => {
      t.parentElement?.setAttribute('role', 'presentation');
      if (!on) t.parentElement?.removeAttribute('role');
      for (const [k, v] of [['role', 'tab'], ['aria-controls', panels[i].id]]) on ? t.setAttribute(k, v) : t.removeAttribute(k);
      if (!on) {
        t.removeAttribute('aria-selected');
        t.removeAttribute('tabindex');
      }
    });
    panels.forEach((p, i) => {
      for (const [k, v] of [['role', 'tabpanel'], ['aria-labelledby', tabs[i]?.id ?? '']]) on ? p.setAttribute(k, v) : p.removeAttribute(k);
      p.tabIndex = on ? 0 : -1;
    });
    if (on && open === null) open = 1;
    orient();
    render();
  };

  rows.forEach((r, i) => r?.setAttribute('aria-controls', panels[i].id));

  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const tab = t.closest<HTMLElement>('[data-q-tab]');
    const next = t.closest<HTMLElement>('[data-q-next]');
    const row = t.closest<HTMLElement>('[data-q-row]');
    if (tab || next) {
      e.preventDefault();
      show(Number((tab ?? next)!.dataset[tab ? 'qTab' : 'qNext']), { press: true, focus: !!next });
    } else if (row) {
      const n = Number(row.closest<HTMLElement>('[data-q-answer]')?.dataset.qAnswer);
      show(open === n ? null : n, { press: true });
    } else if (t.closest('[data-q-more] button')) {
      const first = sections.findIndex((_, i) => i >= FIRST_ROWS && i + 1 !== open);
      root.toggleAttribute('data-more', true);
      render();
      rows[first]?.focus();
    }
  });

  // the tab list's keys (manual activation): the arrows, Home and End move; Enter or Space opens
  tablist?.addEventListener('keydown', (e) => {
    const tab = (e.target as Element).closest<HTMLAnchorElement>('[data-q-tab]');
    if (mode !== 'tabs' || !tab || e.altKey || e.ctrlKey || e.metaKey) return;
    const i = tabs.indexOf(tab);
    const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to !== undefined) {
      e.preventDefault();
      tabs[(to + tabs.length) % tabs.length].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      show(i + 1, { press: true });
    }
  });

  window.addEventListener(
    'hashchange',
    () => {
      const n = answerFrom(location.hash, count);
      if (n) show(n);
    },
    { signal },
  );
  const resize = new ResizeObserver(applyMode);
  resize.observe(root);
  signal.addEventListener('abort', () => {
    resize.disconnect();
    root.removeAttribute('data-ready');
  });

  setupAsk(root, index, (n, text) => {
    const panel = panels[n - 1];
    if (note) {
      const words = note.querySelector('[data-q-closest-text]');
      if (words) words.textContent = `Closest answer to “${text}”`;
      const ask = note.querySelector<HTMLAnchorElement>('[data-q-closest-ask]');
      const href = askAbout(root.dataset.contact, [text]);
      if (ask && href) ask.href = href;
      (panel.querySelector('[data-q-label]') ?? panel.firstElementChild)?.after(note);
      note.hidden = false;
    }
    show(n, { asked: true, focus: true });
  });

  applyMode();
  root.toggleAttribute('data-ready', true);
}

/** Ask something else: a combobox over the questions, its options the closest answers (WAI-ARIA combobox with a listbox). */
function setupAsk(root: HTMLElement, index: IndexedAnswer[], found: (n: number, text: string) => void) {
  const box = root.querySelector<HTMLElement>('[data-q-ask]');
  const input = box?.querySelector<HTMLInputElement>('input');
  const listbox = box?.querySelector<HTMLElement>('[data-q-suggestions]');
  if (!box || !input || !listbox) return;
  const none = box.querySelector<HTMLElement>('[data-q-none]');
  const noneAsk = box.querySelector<HTMLAnchorElement>('[data-q-none-ask]');
  const status = root.querySelector<HTMLElement>('[data-q-status]');
  const options = new Map([...listbox.querySelectorAll<HTMLElement>('[data-q-option]')].map((o) => [Number(o.dataset.qOption), o]));
  let shown: IndexedAnswer[] = [];
  let active = -1;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listbox.id);
  input.setAttribute('aria-expanded', 'false');

  const mark = (i: number) => {
    active = i;
    shown.forEach((a, j) => options.get(a.n)?.setAttribute('aria-selected', String(j === i)));
    const on = shown[i] && options.get(shown[i].n);
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
    shown = closest(text, index, !/\s$/.test(text));
    for (const o of options.values()) o.hidden = true;
    for (const a of shown) {
      const o = options.get(a.n);
      if (!o) continue;
      listbox.append(o);
      o.hidden = false;
    }
    listbox.hidden = shown.length === 0;
    input.setAttribute('aria-expanded', String(shown.length > 0));
    mark(-1);
  };
  const choose = (a: IndexedAnswer) => {
    const text = input.value.trim();
    input.value = '';
    close();
    if (none) none.hidden = true;
    if (status) status.textContent = askedStatus(a);
    track('question_asked', { matched: a.id });
    found(a.n, text || a.question);
  };
  const nothing = (text: string) => {
    close();
    const href = askAbout(root.dataset.contact, [text]);
    if (noneAsk && href) noneAsk.href = href;
    if (none) none.hidden = false;
    if (status) status.textContent = askedStatus();
    track('question_asked', { matched: 'none' });
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
      const a = shown[active] ?? closest(text, index)[0];
      if (a) choose(a);
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
    const n = Number((e.target as Element).closest<HTMLElement>('[data-q-option]')?.dataset.qOption);
    const a = index.find((x) => x.n === n);
    if (a) choose(a);
  });
}
