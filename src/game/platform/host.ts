/**
 * The mode host's calls (documentation/desktop/modes.md §5.3, plan M1.2), made for the mode the page shows.
 * It runs in the gate, before any of the mode's chunks, so it stays small and imports nothing heavy. The
 * section overlay (`open`) is generalized in M1.3; until then it asks for it with an event the planet's own
 * reading overlay can answer.
 */
import type { ModeData, ModeHost, ModeTarget } from '../../../packages/mode-kit/types';
import { withBase } from './base';
import { buildPlaySearch } from './url';

/** The most a mode may keep in the host's storage (modes.md §5.3). */
export const STORAGE_CAP_BYTES = 256 * 1024;

/** The site's address for a place in a mode: the page, else the slot's section, else the home page. */
export function siteAddress(data: ModeData, at: ModeTarget = {}): string {
  const section = data.sections.find((s) => s.id === data.slots.find((x) => x.id === at.slot)?.section);
  return section?.pages.find((p) => p.id === at.page)?.url ?? section?.url ?? data.links.home;
}

/** @param tier the capability gate's choice for this device @param signal aborted when the mode is unmounted */
export function createHost(data: ModeData, tier: 'high' | 'low', signal: AbortSignal): ModeHost {
  const ns = `mode.${data.mode.id}.`;
  const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const html = document.documentElement;
  let live: HTMLElement | null = null;
  const used = () => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k.startsWith(ns)) n += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
    return n * 2;
  };
  return {
    data,
    tier,
    signal,
    open: (target) => document.dispatchEvent(new CustomEvent('mode:open', { detail: target })),
    toSite: (at) => location.assign(siteAddress(data, at)),
    setAddress: (at) => history.replaceState(history.state, '', `${location.pathname}${buildPlaySearch(at.slot ?? null, !!at.page, at.page ?? null)}`),
    announce: (text, politeness = 'polite') => {
      if (!live) {
        live = document.createElement('div');
        live.className = 'sr-only';
        document.body.append(live);
      }
      live.setAttribute('aria-live', politeness);
      live.textContent = '';
      requestAnimationFrame(() => live && (live.textContent = text));
    },
    prefs: {
      reducedMotion: media('(prefers-reduced-motion: reduce)'),
      scheme: html.dataset.theme === 'dark' || (!html.dataset.theme && media('(prefers-color-scheme: dark)')) ? 'dark' : 'light',
      largerText: html.classList.contains('text-lg'),
      input: html.dataset.input === 'touch' ? 'touch' : 'mouse',
    },
    storage: {
      get: (key) => {
        try {
          const v = localStorage.getItem(ns + key);
          return v === null ? undefined : JSON.parse(v);
        } catch {
          return undefined;
        }
      },
      set: (key, value) => {
        const s = JSON.stringify(value);
        if (used() + (ns.length + key.length + s.length) * 2 > STORAGE_CAP_BYTES) throw new Error(`${data.mode.id} has used its ${STORAGE_CAP_BYTES / 1024} KB of storage`);
        localStorage.setItem(ns + key, s);
      },
      remove: (key) => localStorage.removeItem(ns + key),
    },
    asset: (path) => withBase(`/${path.replace(/^\//, '')}`),
    // the page passes on only its allowlist (play.astro's telemetry script)
    track: (event) => document.dispatchEvent(new CustomEvent('planet:event', { detail: { event: event.name, props: event.props ?? {} } })),
  };
}
