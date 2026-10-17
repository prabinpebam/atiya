/**
 * Recommendations (documentation/sections/recommendations.md): what a recommendation is, how a section shows them,
 * and the small rules the page and edit mode share (the link's label, the initials, the month, the layout's
 * opening). Pure and dependency-free: the content contract, the site's compound and edit mode read it.
 */

export const RECOMMENDATION_LAYOUTS = ['tiles', 'rows', 'wall', 'spotlight'] as const;
export type RecommendationLayout = (typeof RECOMMENDATION_LAYOUTS)[number];
export const RECOMMENDATION_OPENINGS = ['dialog', 'inline'] as const;
export type RecommendationOpening = (typeof RECOMMENDATION_OPENINGS)[number];
export const RECOMMENDATION_PLACES = ['start', 'end', 'after'] as const;
export type RecommendationPlace = (typeof RECOMMENDATION_PLACES)[number];

/** The limits the contract and the form share. */
export const LIMITS = { name: 80, title: 120, relationship: 120, text: 3000, heading: 60, intro: 160 } as const;

export interface Recommendation {
  id: string;
  name: string;
  /** Their role and where, as they'd write it. */
  title: string;
  /** Their profile: LinkedIn, or their own site (https). */
  link?: string;
  /** How they know the site's owner ("Managed me at Microsoft"). */
  relationship?: string;
  /** The month it was written: YYYY-MM. */
  date?: string;
  /** Plain words, paragraphs separated by a blank line. */
  text: string;
  /** Their photo: a picture in content/media/ (uploaded, or taken once from their LinkedIn profile). */
  photo?: string;
  /** Show their initials, and never take a photo from their profile. */
  noPhoto?: true;
  /** Kept out of the site without being deleted. */
  hidden?: boolean;
}

/** A section's own settings for showing them. */
export interface RecommendationSettings {
  show: boolean;
  at: RecommendationPlace;
  /** The page of the section they follow, when `at` is `after`. */
  after?: string;
  layout: RecommendationLayout;
  open: RecommendationOpening;
  heading?: string;
  intro?: string;
}

export const DEFAULT_SETTINGS: RecommendationSettings = { show: false, at: 'end', layout: 'tiles', open: 'dialog' };
export const DEFAULT_HEADING = 'Recommendations';

/** What each layout is, for edit mode's choices. */
export const LAYOUT_ABOUT: Record<RecommendationLayout, { label: string; about: string }> = {
  tiles: { label: 'Tiles', about: 'An even grid of cards, each the same height.' },
  rows: { label: 'Rows', about: 'One under another, in the reading measure.' },
  wall: { label: 'Wall', about: 'Columns of cards, each as tall as its words.' },
  spotlight: { label: 'Spotlight', about: 'The first one large, the others as tiles under it.' },
};

/** Expanding in place would break an even grid: tiles and the spotlight's tiles always open a dialog. */
export const opensInline = (layout: RecommendationLayout, open: RecommendationOpening): boolean => open === 'inline' && (layout === 'rows' || layout === 'wall');

/** The link's words: LinkedIn's profile by name, any other site by its host. */
export function linkLabel(href: string): string {
  try {
    const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'linkedin.com' || host.endsWith('.linkedin.com') ? 'LinkedIn profile' : host;
  } catch {
    return 'Profile';
  }
}

/** A LinkedIn profile's address (linkedin.com/in/…): the one kind of link a photo can be taken from. */
export function isLinkedInProfile(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && (host === 'linkedin.com' || host.endsWith('.linkedin.com')) && /^\/in\/[^/]+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** No photo of their own, not told to keep initials, and a LinkedIn profile to take one from. */
export const wantsProfilePhoto = (r: Pick<Recommendation, 'photo' | 'noPhoto' | 'link'>): boolean => !r.photo && !r.noPhoto && isLinkedInProfile(r.link);

/** Up to two initials from a name ("Ada Lovelace" → "AL"). */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => [...w][0] ?? '')
    .filter((c) => /\p{L}|\p{N}/u.test(c))
    .slice(0, 2)
    .join('')
    .toUpperCase();

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2025-03` → `March 2025`. */
export function monthLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(date);
  const i = m ? Number(m[2]) - 1 : -1;
  return m && i >= 0 && i < 12 ? `${MONTHS[i]} ${m[1]}` : date;
}

/** The words' paragraphs. */
export const paragraphs = (text: string): string[] =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** A new recommendation's ID from the person's name, never one taken. */
export function recommendationIdFor(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'recommendation';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** The ones a page shows: not hidden, in the list's order. */
export const visibleRecommendations = (items: readonly Recommendation[]): Recommendation[] => items.filter((r) => !r.hidden);

/** Where a section's band goes among its pages: before them, after them, or after one of them (after them all when that page isn't shown: a draft, or one of the private pages). */
export function bandPlace(s: RecommendationSettings, pageIds: readonly string[]): { at: 'start' | 'end' } | { after: string } {
  if (s.at === 'after') return s.after && pageIds.includes(s.after) ? { after: s.after } : { at: 'end' };
  return { at: s.at };
}

/** One moved up or down the list (unchanged at an end). */
export function moveRecommendation(items: readonly Recommendation[], id: string, by: -1 | 1): Recommendation[] {
  const out = [...items];
  const i = out.findIndex((r) => r.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** A card as the page draws it: every word worked out (the compound takes plain props). */
export interface RecommendationCardData {
  id: string;
  name: string;
  title: string;
  link?: { href: string; label: string };
  meta?: string;
  paragraphs: string[];
  /** Their photo's media ID (the page turns it into a picture). */
  photo?: string;
}

/** The band a section's page shows (null: off, or nothing visible), placed among the pages it shows. */
export function recommendationBand(
  settings: RecommendationSettings | undefined,
  items: readonly Recommendation[],
  pageIds: readonly string[],
): { heading: string; intro?: string; items: RecommendationCardData[]; layout: RecommendationLayout; open: RecommendationOpening; place: ReturnType<typeof bandPlace> } | null {
  if (!settings?.show) return null;
  const shown = visibleRecommendations(items);
  if (!shown.length) return null;
  return {
    heading: settings.heading?.trim() || DEFAULT_HEADING,
    intro: settings.intro?.trim() || undefined,
    layout: settings.layout,
    open: opensInline(settings.layout, settings.open) ? 'inline' : 'dialog',
    place: bandPlace(settings, pageIds),
    items: shown.map((r) => {
      const meta = [r.relationship?.trim(), r.date ? monthLabel(r.date) : undefined].filter(Boolean).join(' · ');
      return {
        id: r.id,
        name: r.name,
        title: r.title,
        link: r.link ? { href: r.link, label: linkLabel(r.link) } : undefined,
        meta: meta || undefined,
        paragraphs: paragraphs(r.text),
        ...(r.photo && !r.noPhoto ? { photo: r.photo } : {}),
      };
    }),
  };
}
