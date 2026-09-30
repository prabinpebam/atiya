import { withBase } from './base';

export interface PlayUrlState {
  at: string | null;
  open: boolean;
  mode: 'classic' | 'play' | null;
}

export function parsePlayUrl(search: string): PlayUrlState {
  const p = new URLSearchParams(search);
  const mode = p.get('mode');
  const at = p.get('at');
  return {
    at: at && /^[a-z0-9-]+$/.test(at) ? at : at ? '__invalid__' : null,
    open: p.get('open') === '1',
    mode: mode === 'classic' || mode === 'play' ? mode : null,
  };
}

export function buildPlaySearch(at: string | null, open = false): string {
  if (!at) return '';
  return open ? `?at=${encodeURIComponent(at)}&open=1` : `?at=${encodeURIComponent(at)}`;
}

export function classicHrefFor(id: string | null): string {
  // a building's classic page is its old address, which redirects to its section; the site's is its home page's list of sections
  return withBase(id ? `/classic/${id}/` : '/#sections');
}

export function playHrefFor(id: string | null): string {
  return withBase(`/play/${buildPlaySearch(id)}`);
}
