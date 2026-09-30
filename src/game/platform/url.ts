import { withBase } from './base';

export interface PlayUrlState {
  at: string | null;
  open: boolean;
  /** The page being read in the building (documentation/sections/spec.md §6.6), when it's open at one. */
  page: string | null;
  mode: 'classic' | 'play' | null;
}

export function parsePlayUrl(search: string): PlayUrlState {
  const p = new URLSearchParams(search);
  const mode = p.get('mode');
  const at = p.get('at');
  const page = p.get('page');
  return {
    at: at && /^[a-z0-9-]+$/.test(at) ? at : at ? '__invalid__' : null,
    open: p.get('open') === '1',
    page: page && /^[a-z0-9-]+$/.test(page) ? page : null,
    mode: mode === 'classic' || mode === 'play' ? mode : null,
  };
}

export function buildPlaySearch(at: string | null, open = false, page: string | null = null): string {
  if (!at) return '';
  return open ? `?at=${encodeURIComponent(at)}&open=1${page ? `&page=${encodeURIComponent(page)}` : ''}` : `?at=${encodeURIComponent(at)}`;
}

/** The site's list of sections (a building's own page on the site is its `siteHref`, from the planet structure). */
export function classicHrefFor(): string {
  return withBase('/#sections');
}

export function playHrefFor(id: string | null): string {
  return withBase(`/play/${buildPlaySearch(id)}`);
}
