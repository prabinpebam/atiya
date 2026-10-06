/**
 * The way into edit mode from the site (documentation/editor/spec.md §2), in dev only: the editor
 * integration injects this into every page `astro dev` serves, never into a build. It adds one icon
 * button to the site header, just before the colour theme switch, looking like the header's other quiet
 * icon buttons: "Edit this page" on a page the editor can open (an article), "Edit this section" on a
 * section, "Edit mode" elsewhere; the label is its accessible name and its tooltip. It never changes the
 * header's layout (dev must look like the site): where the header has no room for it, it sits over the
 * free space before the switch, and where even that would cover the name or a section, it floats in the
 * page's lower corner, as it does on a page without the header.
 * It lives in a shadow root so nothing on the page styles it, and its styles read only the site's tokens
 * (custom properties reach into a shadow root), so it looks like the rest of the site in both themes.
 * Not inside the editor's own frames, the editor itself, or the planet.
 */
import { svgOf } from '../../design/icons';

export const LAUNCHER_CSS = `
:host { all: initial; display: inline-grid; flex: none; }
:host([data-place='over']) {
  position: absolute;
  margin-inline-start: calc(var(--space-0) - var(--c-control-height-md));
}
.launch {
  position: relative;
  display: inline-grid;
  place-items: center;
  inline-size: var(--c-control-height-md);
  block-size: var(--c-control-height-md);
  border-radius: var(--radius-round);
  background: transparent;
  color: var(--color-text);
  text-decoration: none;
  transition: background-color var(--duration-instant) var(--ease-standard);
}
.launch[data-float] {
  position: fixed;
  inset-block-end: var(--space-5);
  inset-inline-start: var(--space-5);
  z-index: var(--layer-toast);
  background: var(--color-bg-raised);
  box-shadow: var(--shadow-md);
}
@media (hover: hover) {
  .launch:hover { background: var(--color-bg-hover); }
  .launch:hover::after { visibility: visible; transition-delay: var(--duration-slow); }
}
.launch:active { background: var(--color-bg-hover); }
.launch:focus-visible { outline: var(--border-focus) solid var(--color-focus); outline-offset: var(--border-focus-offset); }
.launch:focus-visible::after { visibility: visible; }
.launch::after {
  content: attr(aria-label);
  position: absolute;
  inset-block-start: calc(var(--c-control-height-md) + var(--space-2));
  inset-inline-end: var(--space-0);
  z-index: var(--layer-dropdown);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-text);
  color: var(--color-bg);
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  line-height: var(--leading-ui);
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
  transition-property: visibility;
}
.launch[data-float]::after {
  inset-block-start: auto;
  inset-block-end: calc(var(--c-control-height-md) + var(--space-2));
  inset-inline-start: var(--space-0);
  inset-inline-end: auto;
}
.icon { inline-size: var(--size-icon); block-size: var(--size-icon); }
.icon-primary { fill: currentColor; }
.icon-secondary { fill: var(--c-icon-secondary); opacity: var(--c-icon-secondary-opacity); }
@media (forced-colors: active) {
  .icon-secondary { fill: currentColor; opacity: var(--c-icon-tonal-opacity); }
}
`;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** What the header's layout looks like: if the button changes any of it, it isn't left in the flow. */
const layoutOf = (header: Element) =>
  [header, header.querySelector('.bar'), header.querySelector('.brand'), header.querySelector('nav'), header.querySelector('nav ul')]
    .map((el) => (el instanceof HTMLElement ? `${el.offsetWidth}x${el.offsetHeight}/${el.scrollWidth}` : '-'))
    .join(' ');

const overlaps = (a: DOMRect, b: DOMRect) => b.width > 0 && b.height > 0 && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Puts the button beside the theme switch without changing the site's header (dev must look like the
 * site): in the flow when the header has the room; else over the free space before the switch, taking
 * none; else, when that would cover the name or a section, floating in the page's corner.
 */
function place(host: HTMLElement, link: HTMLElement, header: Element, theme: Element) {
  host.removeAttribute('data-place');
  delete link.dataset.float;
  host.remove();
  const before = layoutOf(header);
  theme.before(host);
  if (layoutOf(header) === before) return;
  host.dataset.place = 'over';
  const r = link.getBoundingClientRect();
  if (![...header.querySelectorAll('.brand a, nav li')].some((el) => overlaps(r, el.getBoundingClientRect()))) return;
  host.removeAttribute('data-place');
  link.dataset.float = '';
  document.body.append(host);
}

let stop: (() => void) | null = null;

async function show() {
  if (window.frameElement || document.querySelector('[data-editor-app]') || document.body.classList.contains('play')) return;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = location.pathname.slice(base.length) || '/';
  let target = { label: 'Edit mode', href: '/_edit/' };
  try {
    const r = await fetch(`${base}/_edit/api/where?path=${encodeURIComponent(path)}`);
    if (r.ok) target = await r.json();
  } catch {
    // the dev server without the editor: the dashboard is still the way in
  }
  // a pen whose body is the strong layer: the pen-to-square's big square is the light second layer, and read as disabled here
  const icon = svgOf('edit-page');
  const host = document.createElement('div');
  host.dataset.editorLauncher = '';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${LAUNCHER_CSS}</style><a class="launch" href="${escape(base + target.href)}" aria-label="${escape(target.label)}"><svg class="icon" viewBox="${icon.viewBox}" aria-hidden="true" focusable="false">${icon.body}</svg></a>`;
  const link = root.querySelector<HTMLElement>('.launch')!;
  // a page change keeps a persisted header: replace the old button so it leads to the new page
  stop?.();
  stop = null;
  document.querySelectorAll('[data-editor-launcher]').forEach((old) => old.remove());
  // the first header is the page's own (the design library's stories show more below it)
  const header = document.querySelector('[data-site-header]');
  const theme = header?.querySelector('[data-theme-switch]');
  if (!header || !theme) {
    link.dataset.float = '';
    document.body.append(host);
    return;
  }
  place(host, link, header, theme);
  // the header's room changes with the window and the fonts: place it again
  let frame = 0;
  const again = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!root.activeElement) place(host, link, header, theme);
    });
  };
  const watch = new ResizeObserver(again);
  [header, header.querySelector('.brand'), header.querySelector('nav ul')].forEach((el) => el && watch.observe(el));
  void document.fonts?.ready.then(again);
  stop = () => {
    watch.disconnect();
    cancelAnimationFrame(frame);
  };
}

export function launch() {
  void show();
  // the design library changes pages without a reload
  document.addEventListener('astro:page-load', () => void show());
}
