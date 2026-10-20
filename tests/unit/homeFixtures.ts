/**
 * Made-up picks for the home views' unit tests (documentation/home-views/foundation.md §7): a strength with two
 * pages of proof by default, the picks for the goal Get hired, and addresses as a site at /base/ gives them.
 */
import type { HomePicks, Pick, StrengthPicks } from '../../src/site/home/curate';
import type { PresentEnv } from '../../src/site/home/present';

const PEOPLE: Record<string, { name: string; title?: string }> = { ana: { name: 'Ana Ruiz', title: 'VP, Example Co' }, bo: { name: 'Bo Chen' } };

/** Every page is open but `draft`. */
export const env: PresentEnv = {
  pageHref: (id) => (id === 'draft' ? undefined : `/base/work/${id}/`),
  resumeHref: '/base/resume/',
  contactHref: '/base/contact/',
  person: (id) => PEOPLE[id],
};

export const page = (id: string, kind?: Pick['kind'], over: Partial<Pick> = {}): Pick => ({ source: 'page', ref: `ref:article/${id}`, id, title: `Title ${id}`, ...(kind ? { kind } : {}), pinned: false, reason: 'Auto', ...over });
export const resume = (line: string, kind?: Pick['kind']): Pick => ({ source: 'resume', resume: line, ...(kind ? { kind } : {}), pinned: true, reason: 'Pinned by you' });
export const said = (who: string): Pick => ({ source: 'recommendation', recommendation: who, kind: 'said', pinned: true, reason: 'Pinned by you' });

export const strength = (id: string, over: Partial<StrengthPicks> = {}): StrengthPicks => {
  const details = over.details ?? [page(`${id}-a`, 'built'), page(`${id}-b`, 'wrote')];
  return {
    capability: { id, name: `Name ${id}`, short: id.slice(0, 10), line: `Line of ${id}` },
    id,
    shown: true,
    headline: details[0],
    details,
    all: over.all ?? details,
    total: over.total ?? details.length,
    keywords: [],
    weight: 1,
    ...over,
  };
};

export const picks = (strengths: StrengthPicks[], over: Partial<HomePicks> = {}): HomePicks => ({ goal: 'hired', strengths, highlights: [], reel: [], held: false, ...over });

export const highlight = (id: string, capability: string, picture?: string): HomePicks['highlights'][number] => ({ ref: `ref:article/${id}`, id, title: `Title ${id}`, capability, ...(picture ? { picture } : {}), pinned: false, reason: 'Auto' });
