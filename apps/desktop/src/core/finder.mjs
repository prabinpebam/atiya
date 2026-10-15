// @ts-check
/**
 * The action center's rules in the main process (documentation/desktop/action-center.md §8.4): what a chosen
 * result opens, built here from edit mode's own index, never an address from the panel; and Recent, per site,
 * never a private page. Pure.
 */
import { remember } from '../ui/find-rank.mjs';

/** An id the panel may name: a page's, a section's, a picture's (which may sit in folders), a screen's. */
const ID = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i;
const KINDS = new Set(['action', 'command', 'setting', 'page', 'section', 'media', 'go', 'switch', 'sign-out']);

/**
 * A target from the frame, checked: a known kind, an id of the right shape and length; null otherwise.
 * @param {unknown} t
 * @returns {{ kind: string, id: string, value?: string, alt: boolean } | null}
 */
export function checkTarget(t) {
  if (!t || typeof t !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (t);
  if (typeof o.kind !== 'string' || !KINDS.has(o.kind)) return null;
  const id = typeof o.id === 'string' ? o.id : '';
  if (o.kind !== 'sign-out' && o.kind !== 'switch' && (!id || id.length > 200 || !ID.test(id))) return null;
  if (o.kind === 'switch' && (!id || id.length > 400)) return null;
  return { kind: o.kind, id, alt: o.alt === true, ...(typeof o.value === 'string' && o.value.length <= 60 ? { value: o.value } : {}) };
}

/**
 * @typedef {{ id: string, path?: string | null, href?: string, screen?: string }} Entry
 */

/**
 * Where a page, section, picture or screen opens: edit mode, or the site (`alt`, Ctrl+Enter), at a path built
 * from the index. Null when the index doesn't hold it.
 * @param {{ kind: string, id: string, alt: boolean }} t
 * @param {{ pages?: Entry[], sections?: Entry[], media?: Entry[], screens?: Entry[], settings?: Entry[] } | null | undefined} index edit mode's answer to GET /_edit/api/find
 * @returns {{ view: 'editor' | 'site', path: string } | null}
 */
export function addressFor(t, index) {
  const enc = (/** @type {string} */ s) => encodeURIComponent(s);
  const sitePath = (/** @type {unknown} */ p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : null);
  /** @param {string | null} path @returns {{ view: 'site', path: string } | null} */
  const onSite = (path) => (path ? { view: 'site', path } : null);
  if (t.kind === 'page') {
    const p = (index?.pages ?? []).find((x) => x.id === t.id);
    if (!p) return null;
    if (t.alt) return onSite(sitePath(p.path));
    return { view: 'editor', path: `/_edit/articles/${enc(p.id)}/` };
  }
  if (t.kind === 'section') {
    const s = (index?.sections ?? []).find((x) => x.id === t.id);
    if (!s) return null;
    if (t.alt) return onSite(sitePath(s.path));
    return { view: 'editor', path: `/_edit/sections/?section=${enc(s.id)}` };
  }
  if (t.kind === 'media') {
    const m = (index?.media ?? []).find((x) => x.id === t.id);
    return m ? { view: 'editor', path: `/_edit/media/?id=${enc(m.id)}` } : null;
  }
  if (t.kind === 'go') {
    const g = (index?.screens ?? []).find((x) => x.id === t.id);
    return g && typeof g.href === 'string' && /^\/_edit\/[a-z0-9/?=&-]*$/.test(g.href) ? { view: 'editor', path: g.href } : null;
  }
  if (t.kind === 'setting') {
    // a site setting's own screen (Ctrl+Enter on its card)
    const st = (index?.settings ?? []).find((x) => x.id === t.id);
    const g = st?.screen && (index?.screens ?? []).find((x) => x.id === st.screen);
    return t.alt && g && typeof g.href === 'string' && /^\/_edit\/[a-z0-9/-]*$/.test(g.href) ? { view: 'editor', path: g.href } : null;
  }
  return null;
}

/**
 * Recent for a site with a result just chosen added: kept per site, the last first; a private page or picture is
 * never written down (§4.5, §8.5).
 * @param {Record<string, string[]>} all every site's Recent
 * @param {string} site the open site's folder
 * @param {string} key the result's key
 * @param {boolean} isPrivate
 */
export function rememberFor(all, site, key, isPrivate) {
  if (isPrivate || typeof key !== 'string' || key.length > 400 || !site) return all;
  const id = site.toLowerCase();
  return { ...all, [id]: remember(all[id] ?? [], key) };
}

/** A site's Recent. @param {Record<string, string[]> | undefined} all @param {string | undefined} site */
export const recentFor = (all, site) => (site && all?.[site.toLowerCase()]) || [];
