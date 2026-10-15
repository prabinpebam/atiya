/**
 * Edit mode inside Atiya Studio (documentation/desktop/spec.md §7.2, plan stage 7B). The app draws one title bar
 * row, so edit mode draws no header of its own there (`data-studio`, from the app's `X-Atiya-Studio` request
 * header): its header stays in the page, hidden, and this describes it to the app (the screen's title and its
 * controls, in order), again whenever it changes, and carries out what the app's row asks: pressing the original
 * control, or choosing a theme. So every screen's header, whatever it holds, keeps working as it is.
 *
 * The description is plain data (text, an icon's Font Awesome name, states), never markup: the app draws it with
 * its own controls. The bridge (`window.atiyaStudio`) exists only in the app's view of edit mode.
 */

export type StudioItem =
  | { kind: 'text'; text: string; strong?: boolean; busy?: boolean }
  | { kind: 'tag'; text: string; tone?: string; icon?: string }
  | { kind: 'link' | 'button'; id: string; label: string; text?: string; icon?: string; variant?: string; pressed?: boolean; disabled?: boolean; tone?: string }
  | { kind: 'status'; state: string; text: string }
  | { kind: 'select'; id: string; label: string; value: string; options: { value: string; label: string; icon?: string }[] };

export interface StudioHeader {
  /** The screen's title: where it is and what it is (a breadcrumb, a name, its status). */
  context: StudioItem[];
  /** Its controls, in the header's order: the save status, the tools, the theme, Save to remote. */
  controls: StudioItem[];
  /** The theme edit mode shows, so the app's row follows it. */
  theme: 'light' | 'dark' | 'system';
  /** A screen is opening, or a wait is under way (the header's busy line). */
  busy: boolean;
}

export interface StudioCommand {
  id: string;
  action: 'click' | 'select';
  value?: string;
}

interface Bridge {
  publish(header: StudioHeader | null): void;
  onCommand(cb: (c: StudioCommand) => void): () => void;
}

let next = 0;
/** A control's id for commands: given once, kept while the element lives. */
const idOf = (el: HTMLElement) => (el.dataset.studioId ??= `s${++next}`);

/** Text as a reader sees it: without what's only for screen readers or hidden. */
function words(el: Element): string {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
    else if (n instanceof HTMLElement && !n.hidden && !n.classList.contains('sr-only') && n.getAttribute('aria-hidden') !== 'true') out += words(n);
  }
  return out.replace(/\s+/g, ' ').trim();
}

const iconOf = (el: Element) => el.querySelector('svg[data-icon]')?.getAttribute('data-icon') ?? undefined;
const hiddenIn = (el: Element, root: Element) => {
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) if ((e as HTMLElement).hidden) return true;
  return false;
};

function control(el: HTMLElement): StudioItem {
  const text = words(el);
  const label = el.getAttribute('aria-label') ?? text;
  const pressed = el.getAttribute('aria-pressed');
  return {
    kind: el.tagName === 'A' ? 'link' : 'button',
    id: idOf(el),
    label,
    ...(text ? { text } : {}),
    ...(iconOf(el) ? { icon: iconOf(el) } : {}),
    ...(el.dataset.variant ? { variant: el.dataset.variant } : {}),
    ...(pressed ? { pressed: pressed === 'true' } : {}),
    ...((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' ? { disabled: true } : {}),
    ...(el.dataset.health ? { tone: el.dataset.health } : {}),
  };
}

function select(el: HTMLElement): StudioItem {
  const combo = el.querySelector<HTMLElement>('[role="combobox"]');
  const options = [...el.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => ({
    value: o.dataset.value ?? words(o),
    label: o.dataset.label ?? words(o),
    ...(iconOf(o) ? { icon: iconOf(o) } : {}),
  }));
  const chosen = el.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
  const label = el.querySelector(`[id="${combo?.getAttribute('aria-labelledby')?.split(' ')[0] ?? ''}"]`)?.textContent?.trim() || combo?.getAttribute('aria-label') || 'Choose';
  return { kind: 'select', id: idOf(el), label, value: chosen?.dataset.value ?? options[0]?.value ?? '', options };
}

/** The header's pieces in order: what the app's row draws. Pure of the app: it reads the page alone. */
function atoms(el: Element, root: Element, out: StudioItem[]) {
  if (!(el instanceof HTMLElement) || hiddenIn(el, root) || el.classList.contains('sr-only')) return;
  // the app chooses the theme for the whole app, edit mode and the site included: its own switch isn't drawn
  if (el.matches('[data-editor-theme-switch]')) return;
  // what became of the last save to remote is said by Save to remote's own screen, not in the row
  if (el.matches('[data-editor-remote-status]')) return;
  // the device widths are one choice in the row: a single button opening a menu, not three toggles
  if (el.matches('[data-editor-device]')) {
    const group = [...root.querySelectorAll<HTMLElement>('[data-editor-device]')];
    if (el !== group[0]) return;
    const chosen = group.find((b) => b.getAttribute('aria-pressed') === 'true') ?? group[0];
    out.push({
      kind: 'select',
      id: idOf(el),
      label: 'Preview width',
      value: chosen.dataset.editorDevice ?? '',
      options: group.map((b) => ({ value: b.dataset.editorDevice ?? '', label: (b.getAttribute('aria-label') ?? words(b)).replace(/ width$/, ''), ...(iconOf(b) ? { icon: iconOf(b) } : {}) })),
    });
    return;
  }
  if (el.matches('[data-editor-save]')) {
    const text = [words(el.querySelector('[data-editor-status]') ?? el), words(el.querySelector('[data-editor-save-time]') ?? document.createElement('i'))].filter(Boolean).join(' ');
    out.push({ kind: 'status', state: el.dataset.state ?? 'idle', text });
    return;
  }
  if (el.matches('[data-select]')) return void out.push(select(el));
  if (el.matches('a, button')) return void out.push(control(el));
  if (el.matches('.tag')) {
    const text = words(el);
    if (text) out.push({ kind: 'tag', text, ...(el.dataset.tone ? { tone: el.dataset.tone } : {}), ...(iconOf(el) ? { icon: iconOf(el) } : {}) });
    return;
  }
  const interactive = el.querySelector('a, button, [data-select], [data-editor-save], .tag');
  if (!interactive) {
    const text = words(el);
    if (text) out.push({ kind: 'text', text, ...(el.querySelector('strong') || el.tagName === 'STRONG' ? { strong: true } : {}), ...(el.querySelector('.spinner') ? { busy: true } : {}) });
    return;
  }
  for (const child of el.children) atoms(child, root, out);
}

/** Describes the hidden header (`.top`): its title, then its controls. */
export function readHeader(top: HTMLElement, root: HTMLElement = document.documentElement): StudioHeader {
  const context: StudioItem[] = [];
  const controls: StudioItem[] = [];
  for (const part of top.children) {
    if (part.matches('.brand')) continue;
    atoms(part, top, part.matches('.title') ? context : controls);
  }
  const t = root.dataset.theme;
  return { context, controls, theme: t === 'light' || t === 'dark' ? t : 'system', busy: top.dataset.busy === 'on' };
}

/** Carries out a command from the app's row on the hidden header. */
export function runCommand(top: HTMLElement, c: StudioCommand): void {
  const el = top.querySelector<HTMLElement>(`[data-studio-id="${CSS.escape(c.id)}"]`);
  if (!el) return;
  // the device widths, one choice in the row: press the width chosen
  if (c.action === 'select' && el.matches('[data-editor-device]') && typeof c.value === 'string') {
    top.querySelector<HTMLElement>(`[data-editor-device="${CSS.escape(c.value)}"]`)?.click();
    return;
  }
  if (c.action === 'select' && el.matches('[data-select]') && typeof c.value === 'string') el.dispatchEvent(new CustomEvent('select-change', { detail: { value: c.value } }));
  else if (c.action === 'click') el.click();
}

/** In the app's view of edit mode: describe the header now and on every change, and take the row's commands. */
export function initStudio(app: HTMLElement, signal: AbortSignal): void {
  const bridge = (window as unknown as { atiyaStudio?: Bridge }).atiyaStudio;
  const top = app.querySelector<HTMLElement>('.top');
  if (!bridge || !top) return;
  let frame = 0;
  let last = '';
  const publish = () => {
    frame = 0;
    const h = readHeader(top);
    const json = JSON.stringify(h);
    if (json === last) return;
    last = json;
    bridge.publish(h);
  };
  const soon = () => (frame ||= requestAnimationFrame(publish));
  const watch = new MutationObserver(soon);
  watch.observe(top, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-pressed', 'aria-selected', 'disabled', 'aria-disabled', 'data-state', 'data-busy', 'data-variant', 'data-health', 'href'] });
  const themes = new MutationObserver(soon);
  themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const stop = bridge.onCommand((c) => runCommand(top, c));
  publish();
  signal.addEventListener('abort', () => {
    watch.disconnect();
    themes.disconnect();
    cancelAnimationFrame(frame);
    stop();
  });
}
