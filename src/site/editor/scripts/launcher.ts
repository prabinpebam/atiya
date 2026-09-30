/**
 * The way into edit mode from the site (documentation/editor/spec.md §2), in dev only: the editor
 * integration injects this into every page `astro dev` serves, never into a build. It adds one button at
 * the page's corner: "Edit this page" on a page the editor can open (an article), "Edit mode" elsewhere.
 * It lives in a shadow root so nothing on the page styles it, and its styles read only the site's tokens
 * (custom properties reach into a shadow root), so it looks like the rest of the site in both themes.
 * Not inside the editor's own frames, the editor itself, or the planet.
 */
import { svgOf } from '../../design/icons';

export const LAUNCHER_CSS = `
:host { all: initial; }
.launch {
  position: fixed;
  inset-block-end: var(--space-5);
  inset-inline-start: var(--space-5);
  z-index: var(--layer-toast);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-block-size: var(--size-touch);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--color-text);
  color: var(--color-bg);
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-ui);
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition: background-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard);
}
@media (hover: hover) {
  .launch:hover { background: var(--color-accent); color: var(--color-on-accent); }
}
.launch:active { background: var(--color-accent); color: var(--color-on-accent); }
.launch:focus-visible { outline: var(--border-focus) solid var(--color-focus); outline-offset: var(--border-focus-offset); }
.icon { inline-size: var(--size-icon); block-size: var(--size-icon); }
.icon-primary { fill: currentColor; }
.icon-secondary { fill: currentColor; opacity: var(--c-icon-tonal-opacity); }
`;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

async function show() {
  if (window.frameElement || document.querySelector('[data-editor-launcher], [data-editor-app]') || document.body.classList.contains('play')) return;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = location.pathname.slice(base.length) || '/';
  let target = { label: 'Edit mode', href: '/_edit/' };
  try {
    const r = await fetch(`${base}/_edit/api/where?path=${encodeURIComponent(path)}`);
    if (r.ok) target = await r.json();
  } catch {
    // the dev server without the editor: the dashboard is still the way in
  }
  const icon = svgOf('edit');
  const host = document.createElement('div');
  host.dataset.editorLauncher = '';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${LAUNCHER_CSS}</style><a class="launch" href="${escape(base + target.href)}"><svg class="icon" viewBox="${icon.viewBox}" aria-hidden="true" focusable="false">${icon.body}</svg><span>${escape(target.label)}</span></a>`;
  document.body.append(host);
}

export function launch() {
  void show();
  // the design library changes pages without a reload
  document.addEventListener('astro:page-load', () => void show());
}
