/**
 * Sample data for edit mode's stories (src/site/editor/stories/, shown on the dev-only parts library): made-up
 * pages, sections, people and codes, and the design library's sample paintings for pictures. Never the site's
 * content: a story must look the same on any site, and nothing private may appear in one.
 */
import { sample } from '../../design/samples';
import type { Article, Block, Person, PlanetStructure, SiteSettings, SiteStructure } from '../../content/schema';
import type { Issue } from '../../content/load';
import type { Thumb } from '../model/inspectorFields';
import type { ListedGrant, ScopeSection, SharingView } from '../model/access';
import type { Recommendation } from '../model/recommendations';
import type { ArticleRow, ListedPage } from '../server/screens';
import type { AiService } from '../server/aiSettings';
import type { Runner } from '../model/aiServices';

const pond = sample('pond');
const bridge = sample('bridge');
const workshop = sample('workshop');
const plaza = sample('plaza');

/** A picture as a form shows it. */
const thumbOf = (s: ReturnType<typeof sample>): Thumb => ({ thumb: s.thumb, alt: s.alt, width: s.width, height: s.height });

/** The pictures a page's forms can show, by media ID. */
export const MEDIA: Record<string, Thumb> = {
  'samples/pond': thumbOf(pond),
  'samples/bridge': thumbOf(bridge),
  'samples/workshop': thumbOf(workshop),
  'samples/plaza': thumbOf(plaza),
};

/** Sections a page can go in (a Select's options). */
export const SECTION_OPTIONS = [
  { value: 'work', label: 'Work' },
  { value: 'writing', label: 'Writing' },
  { value: 'about', label: 'About' },
];

/** A page, as the page's settings edit it. */
export const ARTICLE = {
  id: 'a-walk-round-the-pond',
  type: 'article',
  kind: 'note',
  slug: 'a-walk-round-the-pond',
  title: 'A walk round the pond',
  summary: 'What a small pond taught a team about pace: a story in three pictures and a few paragraphs.',
  status: 'draft',
  visibility: 'public',
  updatedAt: '2026-10-12',
  locale: 'en',
  hero: { media: 'samples/pond' },
  body: [],
} as unknown as Article;

/** One of each kind of block the stories show a form for. */
export const BLOCKS = {
  text: { type: 'text', markdown: 'The ducks keep their nest on the far bank.' },
  heading: { type: 'heading', level: 2, text: 'Starting small' },
  quote: { type: 'quote', text: 'Go slowly, and you arrive.', cite: 'A sign by the pond', variant: 'pull' },
  figure: { type: 'figure', media: 'samples/bridge', caption: 'The bridge between the workshop and the town hall.', width: 'content' },
  gallery: { type: 'gallery', items: [{ media: 'samples/pond' }, { media: 'samples/bridge', caption: 'The bridge.' }, { media: 'samples/workshop' }], layout: 'grid' },
  carousel: { type: 'carousel', items: [{ media: 'samples/plaza' }, { media: 'samples/workshop' }], label: 'Around the plaza' },
  collection: {
    type: 'collection',
    layout: 'tiles',
    heading: 'What we tried',
    items: [
      { heading: 'Walk first', subtext: 'Week one', text: 'Every morning, once round the pond before a word was written.', media: 'samples/pond' },
      { heading: 'Then build', when: '2025', text: 'Small pieces, each **finished** before the next.' },
    ],
  },
} as unknown as Record<'text' | 'heading' | 'quote' | 'figure' | 'gallery' | 'carousel' | 'collection', Block>;

/** A collection, a gallery and a carousel, as their fields take them. */
export const COLLECTION_BLOCK = BLOCKS.collection as Extract<Block, { type: 'collection' }>;
export const GALLERY_BLOCK = BLOCKS.gallery as Extract<Block, { type: 'gallery' }>;
export const CAROUSEL_BLOCK = BLOCKS.carousel as Extract<Block, { type: 'carousel' }>;

/** The outline's rows: a few blocks of a page. */
export const OUTLINE_BLOCKS = [
  { kind: 'Heading 2', excerpt: 'Starting small', icon: 'heading' as const, type: 'heading' },
  { kind: 'Paragraph', excerpt: 'The ducks keep their nest on the far bank.', icon: 'paragraph' as const, type: 'text' },
  { kind: 'Picture', excerpt: 'The bridge between the workshop and the town hall.', icon: 'image' as const, type: 'figure' },
];

/** Each block type's icon, for the outline's own redraws. */
export const OUTLINE_ICONS = { text: 'paragraph', heading: 'heading', figure: 'image', quote: 'quote', gallery: 'gallery', collection: 'collection', table: 'table' } as const;

/** Pages as the Pages screen and the dashboard list them. */
export const ARTICLE_ROWS: ArticleRow[] = [
  { id: 'a-walk-round-the-pond', title: 'A walk round the pond', kind: 'note', status: 'draft', published: false, updatedAt: '2026-10-12', section: { id: 'writing', title: 'Writing' }, path: null, access: 'open' },
  { id: 'the-bridge', title: 'The bridge', kind: 'gallery', status: 'published', published: true, updatedAt: '2026-09-30', section: { id: 'work', title: 'Work' }, path: '/work/the-bridge/', access: 'open' },
  { id: 'a-case-for-later', title: 'A case for later', kind: 'page', status: 'published', published: true, updatedAt: '2026-09-02', section: { id: 'work', title: 'Work' }, path: '/work/x7k2/', access: 'private' },
];

const page = (id: string, title: string, published: boolean): ListedPage => ({ id, title, kind: 'Article', status: published ? 'Published' : 'Draft', tone: published ? 'positive' : 'neutral', published, href: '#' });

/** A site's sections with their pages, as the Sections screen manages them. */
export const MANAGED_SECTIONS = [
  { id: 'home', title: 'Home', meta: '/', icon: 'home' as const, settings: false, about: 'The home page lists the sections.' },
  {
    id: 'work',
    title: 'Work',
    meta: '/work/',
    icon: 'sections' as const,
    pages: [
      { ...page('the-bridge', 'The bridge', true), note: '/work/the-bridge/', movable: true },
      { ...page('a-case-for-later', 'A case for later', true), note: 'A private address', movable: true, private: true },
    ],
    settings: false,
    about: 'Its settings would be here.',
  },
  { id: 'writing', title: 'Writing', meta: '/writing/', icon: 'sections' as const, pages: [{ ...page('a-walk-round-the-pond', 'A walk round the pond', false), note: 'Not on the site yet', movable: true }], settings: false, about: 'Its settings would be here.' },
  { id: '_off', title: 'Not on the site', meta: 'Pages in no section', pages: [], settings: false, about: 'Pages in no section have no settings.' },
];

/** Sections as their settings forms edit them. */
export const SECTION_SETTINGS = [
  { id: 'home', title: 'Ada Lovelace', summary: 'Engines, notes and the odd poem.', slug: '', view: 'list', inNav: false, path: '/', home: true },
  { id: 'work', title: 'Work', navLabel: 'Work', summary: 'What I made, and how.', slug: 'work', view: 'tiles', inNav: true, path: '/work/' },
];

/** A small site structure (a form's state carries it). */
export const STRUCTURE = { home: { id: 'home', kind: 'hub', slug: '', title: 'Ada Lovelace', children: [{ id: 'work', kind: 'hub', slug: 'work', title: 'Work' }] } } as SiteStructure;

/** The planet's buildings, as their settings forms edit them. */
export const PLACES = [
  { id: 'workshop', title: 'Workshop', kicker: 'Things I made', summary: 'Projects, start to finish.', site: 'work' },
  { id: 'library', title: 'Library', kicker: 'Things I wrote', summary: 'Notes and essays.', site: 'writing' },
];
export const PLANET = { places: [] } as unknown as PlanetStructure;

/** The site's settings and its owner's profile. */
export const SITE = { name: 'Ada Lovelace', description: 'Engines, notes and the odd poem.', owner: 'ada', locale: 'en', positioning: 'A designer of engines.', socialImage: 'samples/plaza' } as SiteSettings;
export const PERSON = { id: 'ada', name: 'Ada Lovelace', role: 'Analyst of engines', bio: 'Writes notes longer than the papers they annotate.', avatar: 'samples/workshop', links: [{ label: 'Notes', href: 'https://example.com/notes' }] } as Person;
export const SETTINGS_THUMBS = { 'samples/plaza': thumbOf(plaza), 'samples/workshop': thumbOf(workshop) };

const day = (d: number) => new Date(Date.UTC(2026, 9, 19 + d)).toISOString();
const grant = (g: Partial<ListedGrant> & Pick<ListedGrant, 'id' | 'kind' | 'state'>): ListedGrant =>
  ({ recipient: { name: 'Grace Hopper', organisation: 'Navy Research' }, purpose: 'Reviewing the engine notes', scope: { sections: ['work'] }, createdAt: day(-10), secret: { salt: 'sample' }, opens: ['Every private page in Work'], ...g }) as ListedGrant;

/** Access codes and magic links, one in each state. */
export const GRANTS: ListedGrant[] = [
  grant({ id: 'g-grace', kind: 'code', state: 'active', name: 'engine', expiresAt: day(20) }),
  grant({ id: 'g-charles', kind: 'link', state: 'expiring', recipient: { name: 'Charles Babbage', organisation: 'Analytical Engines Ltd' }, expiresAt: day(2) }),
  grant({ id: 'g-mary', kind: 'code', state: 'expired', recipient: { name: 'Mary Somerville' }, expiresAt: day(-1) }),
  grant({ id: 'g-augustus', kind: 'link', state: 'withdrawn', recipient: { name: 'Augustus De Morgan' }, revokedAt: day(-3) }),
];

/** The sections and private pages a code or link can open. */
export const SCOPE: { sections: ScopeSection[]; unknown: { sections: string[]; pages: string[] } } = {
  sections: [
    { id: 'work', title: 'Work', pages: [{ id: 'a-case-for-later', title: 'A case for later', section: 'Work', sectionId: 'work', published: true }] },
    { id: 'writing', title: 'Writing', pages: [] },
  ],
  unknown: { sections: [], pages: [] },
};

/** A private page's Share dialog's view. */
export const SHARING: SharingView = {
  grants: [GRANTS[0]],
  pages: [{ id: 'a-case-for-later', title: 'A case for later', section: 'Work', sectionId: 'work', published: true }],
  sections: [
    { id: 'work', title: 'Work' },
    { id: 'writing', title: 'Writing' },
  ],
};

/** People recommending, and the sections they can show on. */
export const RECOMMENDATIONS = [
  { id: 'grace-hopper', name: 'Grace Hopper', title: 'Rear admiral, Navy Research', relationship: 'Worked with Ada on the notes', date: '2025-03', text: 'Ada sees the machine behind the sums.\n\nShe writes it down so others can too.' },
  { id: 'charles-babbage', name: 'Charles Babbage', title: 'Inventor, Analytical Engines Ltd', text: 'The best notes the engine ever had.', hidden: true },
] as Recommendation[];
export const REC_SECTIONS = [{ id: 'about', title: 'About', pages: [{ id: 'cv', title: 'CV' }], settings: { show: true, at: 'end' as const, layout: 'tiles' as const, open: 'dialog' as const } }];

/** Problems the content check found. */
export const ISSUES: Issue[] = [
  { file: 'content/articles/a-walk-round-the-pond.json', path: 'summary', message: 'is longer than 240 characters' },
  { file: 'content/structures/site.json', message: 'places a page that does not exist: the-old-bridge' },
];

/** What dev leaves out: only articles and media can be (a problem in the site itself still stops it). */
export const LEFT_OUT: Issue[] = [
  { file: 'content/articles/a-walk-round-the-pond.json', path: 'body.4.markdown', message: 'a text block is one paragraph or one list: split it into two blocks at the blank line' },
  { file: 'content/media/articles/a-walk-round-the-pond/ducks.json', message: 'its master content/media/articles/a-walk-round-the-pond/ducks.webp is missing' },
];

/** What changed since the last save to remote. */
export const CHANGES = [
  { resource: 'article:a-walk-round-the-pond', kind: 'Article', name: 'A walk round the pond', status: 'changed' as const, keys: ['/content/articles/a-walk-round-the-pond.json'], href: 'articles/a-walk-round-the-pond/' },
  { resource: 'media:samples/pond', kind: 'Media', name: 'pond', status: 'added' as const, keys: ['/content/media/samples/pond.json'] },
];

/** Pictures in the media library. */
export const MEDIA_CARDS = [
  { id: 'samples/pond', owner: 'samples', ownerLabel: 'Samples', thumb: pond.thumb, src: pond.src, alt: pond.alt, decorative: false, width: pond.width, height: pond.height, used: true },
  { id: 'samples/bridge', owner: 'samples', ownerLabel: 'Samples', thumb: bridge.thumb, src: bridge.src, alt: '', decorative: false, width: bridge.width, height: bridge.height, used: false, dark: true },
  { id: 'samples/workshop', owner: 'samples', ownerLabel: 'Samples', thumb: workshop.thumb, src: workshop.src, alt: workshop.alt, decorative: false, width: workshop.width, height: workshop.height, used: true, private: true },
];

/** A picture's details, as the media library's details show them. */
export const PICTURE = {
  id: 'samples/pond',
  src: pond.src,
  srcset: pond.srcset,
  width: pond.width,
  height: pond.height,
  sidecar: { kind: 'image' as const, file: 'pond.webp', alt: pond.alt, caption: pond.caption, visibility: 'public' as const, focus: '40% 60%' },
  key: '/content/media/samples/pond.json',
  version: 'sample',
};

/** The site's navigation entries, and the header they make. */
export const NAV_ENTRIES = [
  { index: 0, kind: 'section' as const, label: 'Work', target: '/work/', hidden: false },
  { index: 1, kind: 'page' as const, label: 'A walk round the pond', target: '/writing/a-walk-round-the-pond/', hidden: true },
  { index: 2, kind: 'link' as const, label: 'Notes', own: 'Notes', target: 'https://example.com/notes', hidden: false },
];
export const NAV_PREVIEW = [
  { label: 'Work', href: '#' },
  { label: 'Notes', href: '#' },
];

/** The AI screen: a service on this computer, one in the cloud, and runners found here (made up). */
export const AI_NOW = Date.parse('2026-10-20T12:00:00Z');
export const AI_SERVICES: AiService[] = [
  { id: 'ollama', kind: 'openai-compatible', provider: 'ollama', name: 'Ollama', base: 'http://localhost:11434/v1', model: 'qwen3:8b', local: true, privatePages: true, lastTest: { at: '2026-10-20T11:58:00Z', ok: true, ms: 1240 } },
  { id: 'openai', kind: 'openai-compatible', provider: 'openai', name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-5-mini', local: false, privatePages: false, acceptedAt: '2026-10-19T09:00:00Z' },
  { id: 'my-router', kind: 'openai-compatible', provider: 'openrouter', name: 'My router', base: 'https://openrouter.ai/api/v1', model: 'some/model', local: false, privatePages: true, acceptedAt: '2026-10-19T09:00:00Z', lastTest: { at: '2026-10-20T09:00:00Z', ok: false, state: 'no-credit' } },
];
export const AI_RUNNERS: Runner[] = [{ id: 'lmstudio', name: 'LM Studio', base: 'http://localhost:1234/v1', models: ['gemma-3-12b', 'qwen3-14b'] }];
