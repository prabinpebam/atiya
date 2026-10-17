/**
 * The action center's side of edit mode (documentation/desktop/action-center.md §8.2, §8.3): edit mode's screens
 * with the other words they're found by, a page's body as plain text, and the site's settings a card can change.
 * Pure: the index (server/find.ts) and the side navigation (EditorLayout) read the same screens.
 */
import type { Article, SiteSettings } from '../../content/schema';
import { plainText } from '../../content/markdown';
import type { Ways } from '../../modes/contract';
import { setMode } from './ways';

/** One of edit mode's screens, as the side navigation lists it and the action center finds it. */
export interface EditScreen {
  id: string;
  label: string;
  /** Under /_edit/. */
  path: string;
  /** The side navigation's group. */
  group: 'Content' | 'Site' | 'Checks';
  /** What it's for, in a newcomer's words (§4.4). */
  words: string[];
  about: string;
  icon: string;
}

const SCREENS: (EditScreen & { needs?: 'planet' | 'source' })[] = [
  { id: 'dashboard', label: 'Dashboard', path: '', group: 'Content', words: ['home', 'overview', 'start'], about: 'What needs doing, and what changed lately.', icon: 'dashboard' },
  { id: 'articles', label: 'Pages', path: 'articles/', group: 'Content', words: ['articles', 'posts', 'writing', 'all pages'], about: 'Every page: find one, start one, see what state each is in.', icon: 'page' },
  { id: 'sections', label: 'Sections', path: 'sections/', group: 'Content', words: ['structure', 'categories', 'order'], about: "The site's sections and the pages in each.", icon: 'sections' },
  { id: 'navigation', label: 'Navigation', path: 'navigation/', group: 'Content', words: ['menu', 'header', 'links'], about: "What the site's header menu shows.", icon: 'menu' },
  { id: 'planet', label: 'Planet', path: 'planet/', group: 'Content', words: ['buildings', 'game', 'little planet'], about: "The little planet's buildings and the section each shows.", icon: 'planet', needs: 'planet' },
  { id: 'media', label: 'Media', path: 'media/', group: 'Content', words: ['pictures', 'images', 'photos', 'videos', 'uploads', 'library'], about: 'Every picture and video, to upload, describe and crop.', icon: 'gallery' },
  { id: 'recommendations', label: 'Recommendations', path: 'recommendations/', group: 'Content', words: ['testimonials', 'references', 'endorsements', 'quotes', 'what people say', 'linkedin'], about: 'What people you have worked with say about you, and where a section shows it.', icon: 'quote' },
  { id: 'settings', label: 'Settings', path: 'settings/', group: 'Site', words: ['site name', 'description', 'profile', 'about me'], about: "The site's own settings and your profile.", icon: 'settings' },
  { id: 'theme', label: 'Theme', path: 'theme/', group: 'Site', words: ['look', 'colours', 'colors', 'fonts', 'typography', 'type', 'spacing', 'corners', 'palette', 'style', 'appearance', 'design'], about: "The site's look: colours, fonts, type, spacing and corners, tried live on the site.", icon: 'palette' },
  { id: 'ways', label: 'Ways to explore', path: 'ways/', group: 'Site', words: ['game mode', 'planet', 'modes', 'navigation modes'], about: 'Other ways into the same pages, like the little planet.', icon: 'planet' },
  { id: 'access', label: 'Access', path: 'access/', group: 'Site', words: ['private', 'share', 'codes', 'links', 'sharing'], about: 'Who your private pages are shared with.', icon: 'lock' },
  { id: 'publish', label: 'Save to remote', path: 'publish/', group: 'Site', words: ['publish', 'push', 'deploy', 'git', 'upload', 'go live'], about: 'Put your changes on the live site.', icon: 'publish' },
  { id: 'tests', label: 'Tests', path: 'tests/', group: 'Checks', words: ['checks', 'e2e', 'test runs'], about: "The site's test runs, live.", icon: 'success', needs: 'source' },
];

/** Edit mode's screens, as this site has them: the Planet while it's on, Tests on a source checkout. */
export function editScreens(features: { planet: boolean; managed: boolean }): EditScreen[] {
  return SCREENS.filter((s) => (s.needs === 'planet' ? features.planet : s.needs === 'source' ? !features.managed : true)).map(({ needs: _, ...s }) => s);
}

/** Places within a screen the action center goes to as if they were screens (never in the side navigation). */
export const SCREEN_PLACES: EditScreen[] = [
  { id: 'settings-contact', label: 'Contact', path: 'settings/#settings-contact', group: 'Site', words: ['contact form', 'email me', 'web3forms', 'tally', 'google forms', 'booking', 'messages'], about: 'How visitors reach you: Email me, a form, or a booking page.', icon: 'mail' },
  { id: 'settings-counts', label: 'Visitor counts', path: 'settings/#settings-counts', group: 'Site', words: ['analytics', 'statistics', 'visits', 'traffic', 'goatcounter', 'umami', 'google analytics', 'clarity', 'cookies'], about: 'Whether and how visits to your site are counted.', icon: 'dashboard' },
];

/** How much of a page's body the index carries (§8.2). */
export const BODY_TEXT_MAX = 4000;

/** A page's words as plain text: its headings and paragraphs, in order, at most BODY_TEXT_MAX characters. */
export function bodyText(article: Pick<Article, 'body'>, max = BODY_TEXT_MAX): string {
  const parts: string[] = [];
  let length = 0;
  for (const b of article.body) {
    const t = b.type === 'text' ? plainText(b.markdown) : b.type === 'heading' || b.type === 'subheading' ? b.text : '';
    const clean = t.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    parts.push(clean);
    length += clean.length + 1;
    if (length >= max) break;
  }
  return parts.join(' ').slice(0, max);
}

/** A site setting as the action center's card shows it. */
export interface FindSetting {
  id: string;
  title: string;
  about: string;
  control: 'text' | 'switch';
  value: string | boolean;
  version: string | null;
  max?: number;
  words: string[];
  /** Its screen (Ctrl+Enter on its card). */
  screen: 'settings' | 'ways';
  screenLabel: string;
  /** Changing it starts edit mode's server again (a way to explore). */
  restarts?: boolean;
  icon: string;
}

/** The site's own words a card can change (§4.3): the name and the description. */
export const SITE_TEXT = {
  'site-name': { field: 'name', title: 'Site name', about: "The site's name: in its header and in its pages' titles.", max: 80, words: ['title', 'name', 'site title'], empty: 'The site needs a name.' },
  'site-description': { field: 'description', title: 'Site description', about: 'A line about the site, for search engines and shared links.', max: 160, words: ['description', 'tagline', 'summary', 'seo'], empty: 'The site needs a line about it.' },
} as const;
export type SiteTextId = keyof typeof SITE_TEXT;

export const isSiteText = (id: string): id is SiteTextId => Object.hasOwn(SITE_TEXT, id);

/** A site text's new value, checked as its screen checks it: words, of a bounded length. */
export function checkSiteText(id: SiteTextId, value: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const def = SITE_TEXT[id];
  if (typeof value !== 'string') return { ok: false, message: def.empty };
  const v = value.replace(/\s+/g, ' ').trim();
  if (!v) return { ok: false, message: def.empty };
  if (v.length > def.max) return { ok: false, message: `Keep it to ${def.max} characters: it has ${v.length}.` };
  return { ok: true, value: v };
}

/** The site settings with a new text. */
export const withSiteText = (site: SiteSettings, id: SiteTextId, value: string): SiteSettings => ({ ...site, [SITE_TEXT[id].field]: value });

/** A way to explore's setting id, and back. */
export const wayId = (mode: string) => `way:${mode}`;
export const modeOf = (id: string) => (id.startsWith('way:') ? id.slice(4) : null);

/** The site's settings, as the action center's cards show them. */
export function findSettings(o: {
  site: SiteSettings;
  siteVersion: string | null;
  ways: Ways;
  waysVersion: string | null;
  modes: { id: string; name: string; summary: string }[];
}): FindSetting[] {
  const text = (Object.keys(SITE_TEXT) as SiteTextId[]).map((id): FindSetting => {
    const d = SITE_TEXT[id];
    return { id, title: d.title, about: d.about, control: 'text', value: String(o.site[d.field] ?? ''), version: o.siteVersion, max: d.max, words: [...d.words], screen: 'settings', screenLabel: 'Settings', icon: 'settings' };
  });
  const ways = o.modes.map(
    (m): FindSetting => ({
      id: wayId(m.id),
      title: m.name,
      about: `${m.summary} Turning it on or off starts the site again, which takes a little while.`,
      control: 'switch',
      value: o.ways.modes.some((w) => w.id === m.id && w.on),
      version: o.waysVersion,
      words: ['way to explore', 'game mode', 'mode', 'navigation'],
      screen: 'ways',
      screenLabel: 'Ways to explore',
      restarts: true,
      icon: 'planet',
    }),
  );
  return [...text, ...ways];
}

/** The ways with one turned on or off, as the Ways to explore screen would save them. */
export const waysWith = (ways: Ways, mode: string, on: boolean, mount: string): Ways => setMode(ways, mode, on, mount);
