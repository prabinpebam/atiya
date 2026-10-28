/**
 * Sample data for edit mode's stories (src/site/editor/stories/, shown on the dev-only parts library): made-up
 * pages, sections, people and codes, and the design library's sample paintings for pictures. Never the site's
 * content: a story must look the same on any site, and nothing private may appear in one.
 */
import { CONTRIBUTION_SAMPLE, sample, SAMPLE_VIDEO } from '../../design/samples';
import { withBase } from '../../design/meta';
import type { Article, Block, Person, PlanetStructure, SiteSettings, SiteStructure } from '../../content/schema';
import type { Issue } from '../../content/load';
import type { Thumb } from '../model/inspectorFields';
import type { ListedGrant, ScopeSection, SharingView } from '../model/access';
import type { Recommendation } from '../model/recommendations';
import type { ArticleRow, ListedPage } from '../server/screens';
import type { AiService } from '../server/aiSettings';
import type { Runner } from '../model/aiServices';
import { reviewView } from '../model/aiReview';
import type { AlbumCardView } from '../components/AlbumCards.astro';
import type { Band } from '../../content/bands';
import type { BandTile } from '../../scripts/albumBandRules';
import type { CoverItem } from '../model/cover';
import type { PhotoCell } from '../kit/PhotoGrid.astro';
import type { ViewerItem } from '../model/albumViewer';
import type { LibrarySelection, SelectionView, SharedWordsView } from '../model/albumInspector';
import type { Picture } from '../../content/pictures';
import { rowLine, type AlbumRow, type Gallery } from '../model/gallery';
import { chartData } from '../model/highlightChart';
import { sourceFacts, type Highlights, type HighlightChoice, type HighlightDetail, type SlidePreviewData } from '../model/highlights';

/** The classic home's made-up curation, without reading any site's resources. */
export const HIGHLIGHTS: Highlights = {
  label: 'Highlights', enabled: true, peek: false, arrows: true, pager: 'dots',
  display: 'fill', background: false, rounded: true, shadow: false,
  items: [
    { id: 'pond-page', type: 'article', article: 'a-walk-round-the-pond', text: 'A small pond taught a team about pace.' },
    { id: 'pond-album', type: 'album', album: 'by-the-pond' },
    { id: 'pond-picture', type: 'image', media: 'samples/pond' },
  ],
};

/** Public sources to pick, including GitHub without a saved snapshot and three that aren't slides yet. */
export const HIGHLIGHT_CHOICES: HighlightChoice[] = [
  { key: 'custom:github', title: 'Chart: A year on GitHub', name: 'A year on GitHub', reason: 'Add a public GitHub snapshot first.', item: { id: 'choice-github', type: 'custom', custom: 'github' } },
  { key: 'article:a-walk-round-the-pond', title: 'Page: A walk round the pond', name: 'A walk round the pond', media: 'samples/pond', item: HIGHLIGHTS.items[0] },
  { key: 'article:the-workshop-diary', title: 'Page: The workshop diary', name: 'The workshop diary', media: 'samples/workshop', item: { id: 'choice-workshop', type: 'article', article: 'the-workshop-diary' } },
  { key: 'article:notes-on-pace', title: 'Page: Notes on pace', name: 'Notes on pace', reason: 'Publish it to show it.', item: { id: 'choice-pace', type: 'article', article: 'notes-on-pace' } },
  { key: 'album:by-the-pond', title: 'Album: By the pond', name: 'By the pond', reason: 'Publish it to show it.', media: 'samples/bridge', item: HIGHLIGHTS.items[1] },
  { key: 'image:samples/pond', title: 'Picture: The pond', name: 'The pond', media: 'samples/pond', item: HIGHLIGHTS.items[2] },
  { key: 'image:samples/plaza', title: 'Picture: The plaza', name: 'The plaza', media: 'samples/plaza', item: { id: 'choice-plaza', type: 'image', media: 'samples/plaza' } },
];

/** One waiting slide beside two ready sources. */
export const HIGHLIGHT_DETAILS: Record<string, HighlightDetail> = {
  'pond-page': { title: 'Page: A walk round the pond', name: 'A walk round the pond' },
  'pond-album': { title: 'Album: By the pond', name: 'By the pond', reason: 'Publish it to show it.' },
  'pond-picture': { title: 'Picture: The pond', name: 'The pond' },
};

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

/** The site's topics a page can be given, by name. */
export const TOPIC_OPTIONS = [
  { value: 'craft', label: 'Craft' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'storytelling', label: 'Storytelling' },
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
  { id: 'the-bridge', title: 'The bridge', kind: 'note', status: 'published', published: true, updatedAt: '2026-09-30', section: { id: 'work', title: 'Work' }, path: '/work/the-bridge/', access: 'open' },
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
  { resource: 'article:a-walk-round-the-pond', kind: 'Article', name: 'A walk round the pond', status: 'changed' as const, keys: ['/content/articles/a-walk-round-the-pond.json'], href: 'articles/a-walk-round-the-pond/', summary: 'Title changed, a paragraph added' },
  { resource: '/private/articles/letters-home', kind: 'Private page', name: 'Letters home', status: 'changed' as const, keys: ['/private/articles/letters-home.json'], href: 'articles/letters-home/', summary: 'Published', private: true },
  { resource: 'media:samples/pond', kind: 'Media', name: 'pond', status: 'added' as const, keys: ['/content/media/samples/pond.json'], summary: 'New picture with a dark version' },
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

/** A picture kept large (gallery spec §4): its master is over 2560 px, and Make it standard is offered. */
export const LARGE_PICTURE = {
  ...PICTURE,
  id: 'samples/bridge',
  src: bridge.src,
  srcset: bridge.srcset,
  width: 3840,
  height: 2560,
  sidecar: { kind: 'image' as const, file: 'bridge.webp', alt: bridge.alt, visibility: 'public' as const, large: true as const, taken: '2026-04-12' },
  key: '/content/media/samples/bridge.json',
};

/** A drawing (gallery spec §4.1): an SVG kept as a vector, shown whole, never cropped. */
export const DRAWING = {
  ...PICTURE,
  id: 'samples/planet',
  src: withBase('/favicon.svg'),
  srcset: '',
  width: 64,
  height: 64,
  sidecar: { kind: 'image' as const, file: 'planet.svg', alt: 'A small green planet with a red roof on it.', visibility: 'public' as const },
  key: '/content/media/samples/planet.json',
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

/** A section's proposal as the Review tab draws it: a paragraph changed, one removed, one added, a picture's caption changed, and a paragraph you've changed since (made up). */
const REVIEW_BASE = [
  { key: 'h1', type: 'heading', level: 2, text: 'Starting small' },
  { key: 'p1', type: 'text', markdown: 'The ducks keep their nest on the far bank, where the reeds are tallest.' },
  { key: 'p2', type: 'text', markdown: 'Every morning, once round the pond before a word was written.' },
  { key: 'p3', type: 'text', markdown: 'It rained most of that week.' },
  { key: 'f1', type: 'figure', media: 'samples/bridge', caption: 'The bridge.', width: 'content' },
  { key: 'p4', type: 'text', markdown: 'Small pieces, each finished before the next.' },
] as unknown as Block[];
const REVIEW_PROPOSED = [
  REVIEW_BASE[0],
  { ...REVIEW_BASE[1], markdown: 'The ducks nest on the far bank, in the tallest reeds.' },
  REVIEW_BASE[2],
  { ...REVIEW_BASE[4], caption: 'The bridge between the workshop and the town hall.' },
  { ...REVIEW_BASE[5], markdown: 'Small pieces, each one finished before the next began.' },
  { key: 'n1', type: 'text', markdown: 'By spring, the habit had stuck.' },
] as unknown as Block[];
const REVIEW_NOW = REVIEW_BASE.map((b) => (b.key === 'p4' ? ({ ...b, markdown: 'Small pieces, each finished before starting the next.' } as Block) : b));
export const AI_REVIEW = reviewView({ by: 'Ollama', summary: 'Tightened the section and added a closing line.', base: REVIEW_BASE, proposed: REVIEW_PROPOSED, decisions: { p1: 'accept', p3: 'reject' } }, REVIEW_NOW);
/** The same proposal once the removed paragraph is gone from the article too. */
export const AI_REVIEW_REMOVED = reviewView({ by: 'Ollama', summary: 'Tightened the section and added a closing line.', base: REVIEW_BASE, proposed: REVIEW_PROPOSED, decisions: {} }, REVIEW_NOW.filter((b) => b.key !== 'p1'));

/** The album block's chooser on a published page (made up): one album to pick, a draft, a private one and the page's own, disabled with their reasons. */
export const ALBUM_CHOICES = [
  { id: 'harbour-walks', title: 'Harbour walks', detail: '24 items, published', disabled: false },
  { id: 'kitchen-garden', title: 'Kitchen garden', detail: 'A draft, and this page is published: publish the album first', disabled: true },
  { id: 'family-trip', title: 'Our trip north', detail: 'Private: its band would show its words outside its seal', disabled: true },
  { id: 'the-bridge-album', title: 'The bridge, in pictures', detail: 'This page: its album is already on it', disabled: true },
];

// ---------- the Albums screen and the album editor (gallery spec §9) ----------
const albumCover = (s: ReturnType<typeof sample>) => ({ thumb: s.thumb, alt: s.alt, width: s.width, height: s.height });

/** The Albums screen's cards: a draft, a published one, a private one and an empty one. */
export const ALBUM_CARDS: AlbumCardView[] = [
  { id: 'kitchen-garden', title: 'Kitchen garden', href: '#kitchen-garden', path: null, cover: albumCover(workshop), count: '8 pictures', dates: '3 to 9 May 2026', draft: true, private: false, section: { id: 'gallery', title: 'Gallery' }, elsewhere: false },
  { id: 'harbour-walks', title: 'Harbour walks', href: '#harbour-walks', path: '/gallery/harbour-walks/', cover: albumCover(pond), count: '22 pictures, 2 videos', dates: 'Spring 2026', draft: false, private: false, section: { id: 'gallery', title: 'Gallery' }, elsewhere: false },
  { id: 'family-trip', title: 'Our trip north', href: '#family-trip', path: null, cover: albumCover(bridge), count: '40 pictures', dates: 'August 2025', draft: false, private: true, section: { id: 'work', title: 'Work' }, elsewhere: true },
  { id: 'untitled-album', title: 'Untitled album', href: '#untitled-album', path: null, cover: null, count: '', draft: true, private: false, section: null, elsewhere: false },
];

/** Album sections, for the Albums screen's filter and an album's settings. */
export const ALBUM_SECTIONS = [
  { value: 'gallery', label: 'Gallery', description: 'Shows albums' },
  { value: 'work', label: 'Work', description: 'A section of pages' },
];

/** The albums list's rows: the gallery's albums in its order, then one elsewhere. */
export const ALBUM_ROWS: AlbumRow[] = ALBUM_CARDS.map((c) => ({ id: c.id, title: c.title, href: c.href, cover: c.cover && { thumb: c.cover.thumb, width: c.cover.width, height: c.cover.height }, line: rowLine(c) }));

/** A gallery, as its setup and the albums list's first entry show it. */
export const GALLERY: Gallery = { id: 'gallery', title: 'Gallery', summary: 'Places, people and the odd project, a year at a time.', path: '/gallery/', order: 'custom', rounded: true };

const cell = (id: string, s: ReturnType<typeof sample>, more: Partial<PhotoCell> = {}): PhotoCell => ({ id, kind: 'picture', media: `samples/${s.slug}`, thumb: s.thumb, alt: s.alt, width: s.width, height: s.height, ...more });

/** The album editor's cells: every kind, a picture without alt text, the cover's lead and two days taken. */
export const PHOTO_CELLS: PhotoCell[] = [
  cell('i1', pond, { taken: '2026-05-03', cover: true }),
  cell('i2', bridge, { taken: '2026-05-03', needsAlt: true, alt: '' }),
  { id: 'i3', kind: 'text', text: 'The second day: rain all morning, then the light came back.' },
  cell('i4', workshop, { taken: '2026-05-04', kind: 'drawing' }),
  cell('i5', plaza, { taken: '2026-05-04', kind: 'animated' }),
  cell('i6', pond, { taken: '2026-05-04', kind: 'video' }),
  cell('i7', bridge, { taken: '2026-05-04', kind: 'embed' }),
  { id: 'i8', kind: 'missing', media: 'samples/gone' },
];

/** The library's timeline (gallery spec §9.9): months taken, newest first, then an undated item, with where each is used. */
export const LIBRARY_CELLS: (PhotoCell & { albums: string[]; articles: string[] })[] = [
  { ...cell('samples/pond', pond, { taken: '2026-05-03', group: 'May 2026' }), albums: ['Kitchen garden', 'Harbour walks'], articles: [] },
  { ...cell('samples/bridge', bridge, { taken: '2026-05-02', group: 'May 2026', needsAlt: true, alt: '' }), albums: [], articles: [] },
  { ...cell('samples/workshop', workshop, { taken: '2026-04-11', group: 'April 2026', kind: 'drawing' }), albums: [], articles: ['Field notes'] },
  { ...cell('samples/plaza', plaza, { taken: '2026-04-02', group: 'April 2026', private: true }), albums: ['Our trip north'], articles: [] },
  { ...cell('samples/clip', pond, { group: 'Date not set, added June 2026', kind: 'embed' }), albums: [], articles: [] },
];

/** A sample painting as a tile of the gallery's band, at its places on the wide and the phone grid. */
const bandTile = (id: string, s: ReturnType<typeof sample>, place: BandTile['place'], phone: BandTile['phone']): BandTile => ({
  id,
  kind: 'picture',
  name: s.alt,
  href: `#item-${id}`,
  place,
  phone,
  still: { src: s.src, srcset: s.srcset, width: s.width, height: s.height },
});

/** An album's band as the gallery draws it: a lead picture and three beside it (12 columns; made-up words). */
export const COVER_BAND: Band = {
  id: 'our-trip-north',
  title: 'Our trip north',
  href: '#',
  site: '#',
  counts: '7 pictures, 1 video',
  dates: 'May 2026',
  summary: 'A week of ponds, bridges and a workshop by the sea.',
  tiles: [
    bandTile('i1', pond, { x: 0, y: 0, w: 6, h: 4 }, { x: 0, y: 0, w: 6, h: 4 }),
    bandTile('i2', bridge, { x: 6, y: 0, w: 3, h: 2 }, { x: 0, y: 4, w: 3, h: 2 }),
    { ...bandTile('i4', workshop, { x: 9, y: 0, w: 3, h: 2 }, { x: 3, y: 4, w: 3, h: 2 }), kind: 'video', length: '0:40' },
    bandTile('i5', plaza, { x: 6, y: 2, w: 6, h: 2 }, { x: 0, y: 6, w: 6, h: 2 }),
  ],
  total: 8,
};

/** The album's pictures as Edit cover draws them (made-up names and sizes). */
export const COVER_ITEMS: CoverItem[] = [
  { id: 'i1', label: 'The pond at dawn', kind: 'picture', thumb: pond.thumb, width: pond.width, height: pond.height, aspect: pond.width / pond.height, bytes: 420000 },
  { id: 'i2', label: 'The old bridge', kind: 'picture', thumb: bridge.thumb, width: bridge.width, height: bridge.height, aspect: bridge.width / bridge.height, bytes: 380000 },
  { id: 'i4', label: 'The workshop', kind: 'picture', thumb: workshop.thumb, width: workshop.width, height: workshop.height, aspect: workshop.width / workshop.height, bytes: 350000 },
  { id: 'i5', label: 'The plaza', kind: 'picture', thumb: plaza.thumb, width: plaza.width, height: plaza.height, aspect: plaza.width / plaza.height, bytes: 510000 },
];

/** A sample painting as the viewer draws it. */
const pictureOf = (s: ReturnType<typeof sample>, more: Partial<Picture> = {}): Picture => ({ src: s.src, srcset: s.srcset, alt: s.alt, width: s.width, height: s.height, full: s.full, thumb: s.thumb, bg: 'transparent', ...more });

const VIEWER_BASE = { albumDownload: true, needsAlt: false, large: false, uses: [] as ViewerItem['uses'] };

/** The viewer at a picture with its dark mode version, used on a page and in another album (made-up names). */
export const VIEWER_PICTURE: ViewerItem = {
  ...VIEWER_BASE,
  id: 'i1',
  kind: 'picture',
  step: { at: 1, of: 8, prev: null, next: 'i2' },
  picture: pictureOf(pond, { dark: { src: plaza.src, srcset: plaza.srcset, width: plaza.width, height: plaza.height, full: plaza.full, thumb: plaza.thumb, bg: 'transparent' } }),
  media: { id: 'samples/pond', key: '/content/media/samples/pond.json', version: 'sample', sidecar: { kind: 'image', file: 'pond.webp', alt: pond.alt, caption: pond.caption, place: 'The lily pond', taken: '2026-05-03', visibility: 'public' } },
  uses: [
    { title: 'Walks on the planet', href: '/_edit/albums/walks/', kind: 'album', draft: false },
    { title: 'Ponds I have known', href: '/_edit/article/ponds/', kind: 'page', draft: true },
  ],
  facts: ['Picture', '1600 × 1067', '420 KB', 'pond.webp'],
};

/** The viewer at a video: its own downloads and play settings in this album. */
export const VIEWER_VIDEO: ViewerItem = {
  ...VIEWER_BASE,
  id: 'i6',
  kind: 'video',
  step: { at: 6, of: 8, prev: 'i5', next: 'i7' },
  video: { src: SAMPLE_VIDEO.src, type: 'video/mp4', width: SAMPLE_VIDEO.width, height: SAMPLE_VIDEO.height, title: 'A drift over the planet', duration: 10, poster: { src: SAMPLE_VIDEO.poster, srcset: '', width: SAMPLE_VIDEO.width, height: SAMPLE_VIDEO.height, thumb: SAMPLE_VIDEO.poster } },
  media: { id: 'samples/tour', key: '/content/media/samples/tour.json', version: 'sample', sidecar: { kind: 'video', file: 'tour.mp4', title: 'A drift over the planet', width: 960, height: 640, duration: 10, visibility: 'public' } },
  download: false,
  autoplay: true,
  loop: true,
  facts: ['Video', '960 × 640', '0:10', '2.1 MB'],
};

/** The viewer at a linked video: its poster and its provider. */
export const VIEWER_EMBED: ViewerItem = {
  ...VIEWER_BASE,
  id: 'i7',
  kind: 'embed',
  step: { at: 7, of: 8, prev: 'i6', next: 'i8' },
  embed: { poster: pictureOf(bridge), provider: 'YouTube', title: 'Building the bridge', duration: 184, shape: '16:9' },
  media: { id: 'samples/bridge-film', key: '/content/media/samples/bridge-film.json', version: 'sample', sidecar: { kind: 'embed', provider: 'youtube', id: 'dQw4w9WgXcQ', title: 'Building the bridge', duration: 184, poster: { file: 'bridge-film.poster.webp' }, visibility: 'public' } },
  facts: ['Linked video', 'YouTube', '3:04'],
};

/** The viewer at a text card. */
export const VIEWER_TEXT: ViewerItem = { ...VIEWER_BASE, id: 'i3', kind: 'text', step: { at: 3, of: 8, prev: 'i2', next: 'i4' }, text: 'The second day: rain all morning, then the light came back.', facts: [] };

/** The viewer at an item whose library item is gone. */
export const VIEWER_MISSING: ViewerItem = { ...VIEWER_BASE, id: 'i8', kind: 'missing', step: { at: 8, of: 8, prev: 'i7', next: null }, facts: [] };

/** A review of alt text: a picture without it, among the two that still need it. */
export const VIEWER_REVIEW: ViewerItem = {
  ...VIEWER_BASE,
  id: 'i2',
  kind: 'picture',
  step: { at: 1, of: 2, prev: null, next: 'i4' },
  picture: pictureOf(bridge, { alt: '' }),
  media: { id: 'samples/bridge', key: '/content/media/samples/bridge.json', version: 'sample', sidecar: { kind: 'image', file: 'bridge.webp', visibility: 'public' } },
  needsAlt: true,
  large: true,
  facts: ['Picture', '3840 × 2560', '1.4 MB', 'bridge.webp'],
  strip: [
    { id: 'i2', media: 'samples/bridge', thumb: bridge.thumb, alt: '', width: bridge.width, height: bridge.height, current: true },
    { id: 'i4', media: 'samples/workshop', thumb: workshop.thumb, alt: '', width: workshop.width, height: workshop.height, current: false },
  ],
};

/** Other albums an item can be added to. */
export const OTHER_ALBUMS = [
  { id: 'walks', title: 'Walks on the planet' },
  { id: 'night', title: 'The plaza at night' },
];
/** Add slide's tile pictures, by source key (the page draws them on demand); the pond's has a dark mode version. */
export const SOURCE_THUMBS: Record<string, { thumb: string; width: number; height: number; dark?: { src: string; width: number; height: number } }> = Object.fromEntries(
  HIGHLIGHT_CHOICES.filter((c) => c.media).map((c) => {
    const s = sample(c.media!.replace('samples/', ''));
    const dark = c.media === 'samples/pond' ? { src: plaza.thumb, width: plaza.width, height: plaza.height } : undefined;
    return [c.key, { thumb: s.thumb, width: s.width, height: s.height, ...(dark ? { dark } : {}) }];
  }),
);

/** A page previewed in Add slide: its slide as the home would draw it. */
export const SLIDE_PREVIEW_PAGE: SlidePreviewData = {
  source: HIGHLIGHT_CHOICES[2],
  facts: sourceFacts(HIGHLIGHT_CHOICES[2].item, { text: 'A year of small builds.', href: '/notes/the-workshop-diary/', media: 'samples/workshop' }, 4),
  words: { title: 'The workshop diary', text: 'A year of small builds on a long bench, and what each one taught.', href: '#workshop' },
  picture: pictureOf(workshop),
  back: '?slide=new',
};

/** A waiting page previewed in Add slide: no picture yet, why it waits and where to put that right. */
export const SLIDE_PREVIEW_WAITING: SlidePreviewData = {
  source: HIGHLIGHT_CHOICES[3],
  facts: sourceFacts(HIGHLIGHT_CHOICES[3].item, {}, 4),
  words: { title: 'Notes on pace' },
  fix: { href: '#notes-on-pace', label: 'Edit page' },
  back: '?slide=new&kind=page',
};

/** The GitHub chart previewed in Add slide, with made-up activity. */
export const SLIDE_PREVIEW_CHART: SlidePreviewData = {
  source: { ...HIGHLIGHT_CHOICES[0], reason: undefined },
  facts: sourceFacts(HIGHLIGHT_CHOICES[0].item, {}, 4),
  words: { title: 'A year on GitHub' },
  chart: chartData(CONTRIBUTION_SAMPLE),
  back: '?slide=new&kind=chart',
};

/** The GitHub chart before a snapshot is saved: why it waits, with nowhere in edit mode to put it right. */
export const SLIDE_PREVIEW_CHART_WAITING: SlidePreviewData = {
  source: HIGHLIGHT_CHOICES[0],
  facts: sourceFacts(HIGHLIGHT_CHOICES[0].item, {}, 4),
  words: { title: 'A year on GitHub' },
  back: '?slide=new&kind=chart',
};

/** A draft album previewed in Add slide: its cover drawn, and where to publish it. */
export const SLIDE_PREVIEW_ALBUM: SlidePreviewData = {
  source: HIGHLIGHT_CHOICES[4],
  facts: sourceFacts({ id: 'choice-by-the-pond', type: 'album', album: 'by-the-pond' }, { text: 'Stones, water and a bridge.', media: 'samples/bridge' }, 4),
  words: { title: 'By the pond', text: 'Stones, water and a bridge.' },
  picture: pictureOf(bridge),
  fix: { href: '#by-the-pond', label: 'Edit album' },
  back: '?slide=new&kind=album',
};

/** An album previewed in Add slide by its arranged cover (highlights spec §2.3): the album's own tiles, not one picture. */
export const SLIDE_PREVIEW_COVER: SlidePreviewData = {
  source: { ...HIGHLIGHT_CHOICES[4], item: { ...HIGHLIGHT_CHOICES[4].item, show: 'cover' } as HighlightChoice['item'], reason: undefined },
  facts: sourceFacts({ id: 'choice-by-the-pond', type: 'album', album: 'by-the-pond', show: 'cover' }, { text: 'Stones, water and a bridge.', href: '/gallery/by-the-pond/', media: 'samples/bridge' }, 4),
  words: { title: 'By the pond', text: 'Stones, water and a bridge.', href: '#by-the-pond' },
  cover: { tiles: COVER_BAND.tiles },
  back: '?slide=new&kind=album',
};

/** A picture previewed in Add slide: shown whole, with its caption. */
export const SLIDE_PREVIEW_PICTURE: SlidePreviewData = {
  source: HIGHLIGHT_CHOICES[6],
  facts: sourceFacts(HIGHLIGHT_CHOICES[6].item, { caption: plaza.caption }, 4),
  words: { title: 'The plaza', text: plaza.caption },
  picture: pictureOf(plaza),
  back: '?slide=new&kind=picture',
};

/** A failed drawing in Add slide: the picture exists, but couldn't be drawn here. */
export const SLIDE_PREVIEW_FAILED: SlidePreviewData = { ...SLIDE_PREVIEW_PICTURE, picture: undefined, pictureFailed: true };

/** The album inspector's Selection tab: one picture (its thumbnail), several sharing a date, and several that differ. */
export const SELECTION_ONE: SelectionView = { state: 'one', item: VIEWER_PICTURE, thumb: thumbOf(pond) };
export const SELECTION_MANY: SelectionView = {
  state: 'many',
  summary: { count: 3, words: '3 pictures', media: ['samples/pond', 'samples/bridge', 'samples/workshop'], download: 'follow' },
  thumbs: [thumbOf(pond), thumbOf(bridge), thumbOf(workshop)],
  caption: { state: 'mixed' },
  description: { state: 'none' },
  alt: { state: 'mixed' },
  taken: { state: 'same', value: '2026-05-03' },
  place: { state: 'none' },
  albumDownload: true,
};
export const SELECTION_MIXED: SelectionView = {
  state: 'many',
  summary: { count: 12, words: '10 pictures, 1 video, 1 text card', media: ['samples/pond', 'samples/bridge', 'samples/workshop', 'samples/plaza', 'samples/tour'], download: 'mixed' },
  thumbs: [thumbOf(pond), thumbOf(bridge), thumbOf(workshop), thumbOf(plaza), thumbOf(pond), thumbOf(bridge), thumbOf(workshop), thumbOf(plaza)],
  caption: { state: 'same', value: 'A morning on the planet.' },
  description: { state: 'mixed' },
  alt: { state: 'none' },
  taken: { state: 'mixed' },
  place: { state: 'same', value: 'The lily pond' },
  albumDownload: false,
};

/** Several pictures' words (kit/SharedWords): one they share, ones that differ, ones none has. */
export const SHARED_WORDS_MIXED: SharedWordsView = {
  caption: { state: 'mixed' },
  description: { state: 'none' },
  alt: { state: 'mixed' },
  taken: { state: 'same', value: '2026-05-03' },
  place: { state: 'same', value: 'The lily pond' },
};
/** The same, when none of them has any words yet. */
export const SHARED_WORDS_NONE: SharedWordsView = { caption: { state: 'none' }, description: { state: 'none' }, alt: { state: 'none' }, taken: { state: 'none' }, place: { state: 'none' } };

/** Several picked on the Media screen (MediaSelection). */
export const LIBRARY_SELECTION: LibrarySelection = {
  count: 3,
  words: '3 pictures',
  media: ['samples/pond', 'samples/bridge', 'samples/workshop'],
  thumbs: [thumbOf(pond), thumbOf(bridge), thumbOf(workshop)],
  shared: SHARED_WORDS_MIXED,
};
/** More picked than are shown as thumbnails, a video among them. */
export const LIBRARY_SELECTION_MANY: LibrarySelection = {
  count: 11,
  words: '10 pictures, 1 video',
  media: ['samples/pond', 'samples/bridge', 'samples/workshop', 'samples/plaza', 'samples/tour'],
  thumbs: [thumbOf(pond), thumbOf(bridge), thumbOf(workshop), thumbOf(plaza), thumbOf(pond), thumbOf(bridge), thumbOf(workshop), thumbOf(plaza)],
  shared: SHARED_WORDS_NONE,
};