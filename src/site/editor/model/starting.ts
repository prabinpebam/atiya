/**
 * Edit mode's starting page (performance-report.md R12): what the dev server shows while edit mode warms
 * up, at `<base>/_edit/__starting?to=…` or in place of a screen opened before it's ready. Pure, so the
 * integration (integrations/editor.mjs) only wires it up and every rule is unit-tested
 * (tests/unit/editorStarting.test.ts; security review F1, P1).
 *
 * - `to` is never trusted: it opens only a screen under edit mode's own address, made of plain path
 *   characters (no dots, no percent, no backslash, no empty segment), with an optional plain query;
 *   anything else opens edit mode's dashboard.
 * - The page's script is a constant: it reads where to go and what to poll from the page's markup
 *   (escaped attributes), so no request value is ever written into a script, and the page's CSP allows
 *   only that script and style by their hashes.
 * - The page loads only as a top-level page on this computer: edit mode's guard (loopback, a local Host),
 *   GET or HEAD, never marked cross-site or same-site by `Sec-Fetch-Site`, never in a frame.
 */
import { createHash } from 'node:crypto';
import { guard, type GuardRequest, type Verdict } from './guard';

/** What may follow edit mode's address: path segments of plain characters (the trailing `/` included). */
const TARGET_PATH = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$|^$/;
/** An optional query of plain characters: screens keep their state there (`?id=`, `?tab=`, `?picker=`). */
const TARGET_QUERY = /^\?[A-Za-z0-9_\-.~%=&+,:]*$/;
/** `Sec-Fetch-Site` values a page load may carry: a link on edit mode's own origin, or one typed or opened by the app. */
const FETCH_SITES = new Set(['same-origin', 'none']);
/** `Sec-Fetch-Dest` values a page load may carry: never a frame, an object or a subresource. */
const FETCH_DESTS = new Set(['document', 'empty']);

/**
 * The screen the starting page opens: `value` if it's edit mode's address (`edit`, e.g. `/_edit/` or
 * `/atiya/_edit/`) followed by plain path characters and an optional plain query; else `edit` itself.
 */
export function startingTarget(value: string | null | undefined, edit: string): string {
  if (typeof value !== 'string' || !value.startsWith(edit)) return edit;
  const rest = value.slice(edit.length);
  const q = rest.indexOf('?');
  const path = q < 0 ? rest : rest.slice(0, q);
  const query = q < 0 ? '' : rest.slice(q);
  // the dev server's own addresses (`__starting`, `__warm`) are never a screen: the page would open itself
  if (!TARGET_PATH.test(path) || path.startsWith('__')) return edit;
  if (query && !TARGET_QUERY.test(query)) return edit;
  return value;
}

/** Edit mode's guard for the starting page and the screens it stands in for: a top-level page load, from here. */
export function startingGuard(req: GuardRequest): Verdict {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return { ok: false, reason: 'not a page load' };
  const verdict = guard(req);
  if (!verdict.ok) return verdict;
  const site = req.header('sec-fetch-site');
  if (site && !FETCH_SITES.has(site.toLowerCase())) return { ok: false, reason: 'marked cross-site' };
  const dest = req.header('sec-fetch-dest');
  if (dest && !FETCH_DESTS.has(dest.toLowerCase())) return { ok: false, reason: 'not a top-level page' };
  return { ok: true };
}

/** Text for an HTML attribute or element: every character that could end one is a character reference. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const STYLE =
  ':root{color-scheme:light dark;font-family:system-ui,sans-serif}body{display:grid;place-items:center;min-height:100dvh;margin:0}main{display:grid;gap:.75rem;width:min(28rem,90vw)}h1{margin:0;font-size:1.5rem}p{margin:0}progress{width:100%}@media (prefers-reduced-motion:reduce){progress:indeterminate{opacity:.6}}';

/** The page's one script, the same for every request: it reads the target and the status address from the page. */
const SCRIPT = `
const page = document.body;
const to = document.querySelector('[data-starting-open]').getAttribute('href');
const what = document.querySelector('[data-starting-what]');
const bar = document.querySelector('[data-starting-progress]');
async function poll() {
  try {
    const w = await (await fetch(page.dataset.startingStatus, { cache: 'no-store' })).json();
    if (!w.running) return location.replace(to);
    const [label, p] = w.phase === 'pictures' ? ['Preparing pictures', w.pictures] : ['Compiling the screens', w.screens];
    what.textContent = p.total ? label + ': ' + p.done + ' of ' + p.total : label + '…';
    if (p.total) { bar.max = p.total; bar.value = p.done; }
  } catch {}
  setTimeout(poll, 400);
}
poll();
`;

const hash = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

/** The starting page's headers: never cached, never framed, and only its own script and style run. */
export const STARTING_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': `default-src 'none'; script-src ${hash(SCRIPT)}; style-src ${hash(STYLE)}; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
});

/**
 * The starting page: plain, at once, and honest about what it waits for; it opens the screen asked for
 * once edit mode is ready (or at once, with Open it now).
 * @param wanted the screen asked for (checked here with `startingTarget`)
 * @param edit edit mode's address on this server (`<base>/_edit/`)
 */
export function startingPage(wanted: string | null | undefined, edit: string): string {
  const to = startingTarget(wanted, edit);
  const status = `${edit}__warm`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Starting edit mode</title>
<style>${STYLE}</style></head>
<body data-editor-starting data-starting-status="${escapeHtml(status)}"><main aria-busy="true"><h1>Starting edit mode</h1><p role="status" aria-live="polite" data-starting-what>Compiling the screens…</p><progress data-starting-progress></progress><p><a href="${escapeHtml(to)}" data-starting-open>Open it now</a></p></main>
<script>${SCRIPT}</script></body></html>`;
}
