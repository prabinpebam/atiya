/**
 * Home highlights' editor rules: trusted source choices, stable slide IDs and immutable list operations.
 * The content contract owns eligibility and validation; the editor never copies source titles or pictures.
 */
import { defaultHighlights, highlightCandidates, highlightSource, highlightState, HIGHLIGHT_MAX, slidePictureStyle, type Highlights, type HighlightItem, type SlidePictureStyle } from '../../content/highlights';
import { mediaId } from '../../content/schema';
import type { ContentIndex } from '../../content/load';
import type { Picture } from '../../content/pictures';
import type { ContributionData } from '../../scripts/contributionRules';
import { DISPLAYS, type Choice } from './inspectorFields';

export { HIGHLIGHT_MAX };
export type { Highlights, HighlightItem, SlidePictureStyle };
export { highlightPresentation } from '../../content/highlights';

/** Both the layout's whole-screen live update and this form's own region must render its content. */
export const HIGHLIGHT_REGIONS = ['screen', 'highlights'] as const;
/** The slide picture's own preview, drawn again as its look changes. */
export const SLIDE_PICTURE_REGION = 'slide-picture';

/** How a slide's picture can sit in its frame: the usual displays, and stretch. */
export const SLIDE_DISPLAYS: Choice[] = [...DISPLAYS, { value: 'stretch', label: 'Stretch', description: 'Fills the frame exactly, out of its own shape' }];

/** What's behind a slide's picture: nothing, its own edge colour, or a colour chosen for it. */
export type BackgroundKind = 'none' | 'auto' | 'colour';
export const BACKGROUNDS: Choice[] = [
  { value: 'none', label: 'None', description: 'Nothing behind the picture' },
  { value: 'auto', label: 'Automatic', description: 'The colour at the picture’s edges' },
  { value: 'colour', label: 'Colour', description: 'A colour you choose' },
];
export const backgroundKind = (background: SlidePictureStyle['background']): BackgroundKind =>
  typeof background === 'string' ? 'colour' : background ? 'auto' : 'none';
/** The stored background for a kind: false, true or the colour. */
export const slideBackground = (kind: string, colour: string): SlidePictureStyle['background'] =>
  kind === 'colour' && /^#[0-9A-Fa-f]{6}$/.test(colour) ? colour.toLowerCase() : kind === 'auto';
/** The colour the picker starts on: the chosen one, else the picture's edge colour (`rgb(r g b)`), else white. */
export function backgroundColour(background: SlidePictureStyle['background'], edge?: string): string {
  if (typeof background === 'string') return background.toLowerCase();
  const rgb = edge?.match(/^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)\)$/);
  return rgb ? `#${rgb.slice(1).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}` : '#ffffff';
}

/** A public resource Add slide offers (§2.1), drawn without its picture. */
export interface HighlightChoice {
  /** The source's unique key, not its slide ID. */
  key: string;
  /** The source's current title, with its kind. */
  title: string;
  /** The source's current title alone. */
  name: string;
  /** The library item its slide shows (a page's lead picture, an album's cover, the picture), if it has one. */
  media?: string;
  /** Why the saved pick would wait rather than render. */
  reason?: string;
  /** The typed reference, before the editor assigns its stable slide ID. */
  item: HighlightItem;
}

/** One saved pick's current title and eligibility, as the list shows it. */
export interface HighlightDetail {
  /** Its current source title, after its kind ("Page: A walk"). */
  title: string;
  /** Its current source title alone, as the list row names it. */
  name: string;
  /** Why it waits, if it cannot render now. */
  reason?: string;
}

/** The same source can appear only once, independently of its slide ID (the content's rule). */
export { highlightSource };

/** Adds a trusted picker choice without changing any existing slide IDs or mutating the list. */
export function addHighlight(items: HighlightItem[], choice: HighlightItem, id: string): HighlightItem[] {
  if (items.length >= HIGHLIGHT_MAX || items.some((i) => i.id === id || highlightSource(i) === highlightSource(choice))) return items;
  return [...items, { ...choice, id }];
}

/** Moves one pick by one place; an end or unknown ID leaves the list unchanged. */
export function moveHighlight(items: HighlightItem[], id: string, direction: -1 | 1): HighlightItem[] {
  const at = items.findIndex((i) => i.id === id);
  const to = at + direction;
  if (at < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** Removes a pick, never its source resource. */
export const removeHighlight = (items: HighlightItem[], id: string): HighlightItem[] => items.filter((i) => i.id !== id);

/** A page's optional excerpt stays verbatim, including its whitespace. Empty means use the summary. */
export function excerptHighlight(items: HighlightItem[], id: string, text: string): HighlightItem[] {
  return items.map((i) => {
    if (i.id !== id || i.type !== 'article') return i;
    const { text: _, ...source } = i;
    return text ? { ...source, text } : source;
  });
}

/** The slide's picture choices, not edits to its source or the shared image sidecar. */
export function pictureHighlight(item: HighlightItem, media: string, style?: SlidePictureStyle): HighlightItem {
  if (item.type === 'custom') return item;
  const { pictureStyle: _, ...rest } = item;
  if (rest.type === 'image') return { ...rest, media, ...(style ? { pictureStyle: style } : {}) };
  const { picture: previous, ...source } = rest;
  return { ...source, ...(media ? { picture: media } : {}), ...(style ? { pictureStyle: style } : {}) };
}

/** A pending picture preview is checked before it is rendered, just as a saved slide is. */
export function previewPicture(item: HighlightItem, params: URLSearchParams): { item: HighlightItem; issue?: string } {
  if (item.type === 'custom' || !params.has('draftPicture')) return { item };
  const media = params.get('draftPicture') ?? '';
  if ((media && !mediaId.safeParse(media).success) || (!media && item.type === 'image')) {
    return { item, issue: 'Choose a library picture to preview this slide.' };
  }
  if (params.get('draftInherit') === 'true') return { item: pictureHighlight(item, media) };
  const boolean = (name: string) => {
    const value = params.get(name);
    return value === 'true' ? true : value === 'false' ? false : value;
  };
  const style = slidePictureStyle.safeParse({
    display: params.get('draftDisplay'), background: boolean('draftBackground'),
    rounded: boolean('draftRounded'), shadow: boolean('draftShadow'),
  });
  return style.success
    ? { item: pictureHighlight(item, media, style.data) }
    : { item, issue: 'The picture settings could not be previewed. Choose the display and try again.' };
}

/** Public choices only; no pictures are decoded or fetched to draw this screen. */
export function highlightsView(index: ContentIndex): { highlights: Highlights; choices: HighlightChoice[]; details: Record<string, HighlightDetail> } {
  const effective = defaultHighlights(index);
  const highlights: Highlights = {
    ...effective, peek: effective.peek ?? false, arrows: effective.arrows ?? true, pager: effective.pager ?? 'dots',
    display: effective.display ?? 'fill', background: effective.background ?? false, rounded: effective.rounded ?? true, shadow: effective.shadow ?? false,
  };
  const items: HighlightItem[] = [{ id: 'choice-github', type: 'custom', custom: 'github' }];
  for (const c of highlightCandidates(index)) {
    const id = `choice-${items.length}`;
    items.push(c.type === 'article' ? { id, type: 'article', article: c.ref } : c.type === 'album' ? { id, type: 'album', album: c.ref } : { id, type: 'image', media: c.ref });
  }
  const choices = items.map((item) => {
    const state = highlightState(index, item);
    return { key: highlightSource(item), title: `${SLIDE_KIND[item.type].label}: ${state.title}`, name: state.title, ...(state.media ? { media: state.media } : {}), reason: state.reason, item };
  });
  const details = Object.fromEntries(highlights.items.map((item) => {
    const state = highlightState(index, item);
    return [item.id, { title: `${SLIDE_KIND[item.type].label}: ${state.title}`, name: state.title, reason: state.reason }];
  }));
  return { highlights, choices, details };
}

/** What the details column shows (documentation/editor/list-and-details.md): a slide, `new` or the carousel's `settings`. */
export type SlideChoice = string;

/** The asked slide if it's saved, else `new` or `settings` as asked, else the first slide, else Add slide. */
export function chosenSlide(items: readonly { id: string }[], asked: string | null): SlideChoice {
  if (asked === 'new' || asked === 'settings') return asked;
  return items.find((i) => i.id === asked)?.id ?? items[0]?.id ?? 'new';
}

/** The kinds of source, in the order Add slide offers them (§2.1). */
export type SourceKind = 'chart' | 'page' | 'album' | 'picture';
export const SOURCE_KINDS: readonly SourceKind[] = ['chart', 'page', 'album', 'picture'];

/**
 * Each kind's word, list mark and filter, for the list, the details and Add slide alike (custom slides are charts:
 * GitHub's is the one so far), with what a slide of that kind shows and where it leads.
 */
export const SLIDE_KIND: Record<HighlightItem['type'], { label: string; plural: string; kind: SourceKind; icon: 'code' | 'article' | 'gallery' | 'image'; what: string }> = {
  custom: { label: 'Chart', plural: 'Charts', kind: 'chart', icon: 'code', what: 'A live chart drawn from your public data, with its own controls.' },
  article: { label: 'Page', plural: 'Pages', kind: 'page', icon: 'article', what: "A page's picture and title, with its summary or a line you choose. Opens the page." },
  album: { label: 'Album', plural: 'Albums', kind: 'album', icon: 'gallery', what: "An album's cover, title and summary. Opens the album." },
  image: { label: 'Picture', plural: 'Pictures', kind: 'picture', icon: 'image', what: 'One library picture with its caption. Opens it full size.' },
};

const TYPE_OF: Record<SourceKind, HighlightItem['type']> = { chart: 'custom', page: 'article', album: 'album', picture: 'image' };

/** What the filter's All says. */
export const ALL_SOURCES = 'Everything public you can show: charts, pages, albums and pictures.';

/** A slide's list mark: GitHub's own for its chart. */
export const slideIcon = (item: HighlightItem): 'github' | (typeof SLIDE_KIND)[HighlightItem['type']]['icon'] =>
  item.type === 'custom' && item.custom === 'github' ? 'github' : SLIDE_KIND[item.type].icon;

/** A slide's line under its name: its kind, and whether it shows or why it waits. */
export const slideLine = (item: HighlightItem, detail?: { reason?: string }): string =>
  `${SLIDE_KIND[item.type].label} · ${detail?.reason ? `Waiting: ${detail.reason}` : 'Ready to show'}`;

const PAGER: Record<NonNullable<Highlights['pager']>, string> = { dots: 'dots', filmstrip: 'filmstrip', 'filmstrip-wrap': 'wrapping filmstrip' };

/** The carousel settings row's line: shown or hidden, its slide count and its pager. */
export function settingsLine(h: Highlights): string {
  const n = h.items.length;
  return `${h.enabled ? 'Shown' : 'Hidden'} · ${n} ${n === 1 ? 'slide' : 'slides'} · ${PAGER[h.pager ?? 'dots']}`;
}

/** The sources Add slide still offers: one place per source. */
export const freeChoices = (choices: readonly HighlightChoice[], items: readonly HighlightItem[]): HighlightChoice[] =>
  choices.filter((c) => !items.some((i) => highlightSource(i) === c.key));

// ---------- Add slide: choosing by seeing (§2.1) ----------

/** A source as Add slide's sources step shows it. */
export interface SourceTile {
  /** The source's key (`article:<id>`). */
  key: string;
  /** Its current title. */
  name: string;
  /** Its kind, for the filter. */
  kind: SourceKind;
  /** Its kind's icon, shown when it has no picture. */
  icon: ReturnType<typeof slideIcon>;
  /** The library item its tile shows, if it has one. */
  media?: string;
  /** Ready to show, waiting (with why), or already a slide. */
  status: 'ready' | 'waiting' | 'added';
  /** Why it waits. */
  reason?: string;
  /** The slide it already is: its ID and its place (from 1). */
  slide?: { id: string; place: number };
  /** Its line under its name: its kind, then its status. */
  line: string;
}

const STATUS_ORDER = { ready: 0, waiting: 1, added: 2 } as const;

/** Every source, ready first, then waiting, then those already slides; in each, by kind, then by name. */
export function sourceTiles(choices: readonly HighlightChoice[], items: readonly HighlightItem[]): SourceTile[] {
  return choices
    .map((c): SourceTile => {
      const at = items.findIndex((i) => highlightSource(i) === c.key);
      const kind = SLIDE_KIND[c.item.type];
      const status = at >= 0 ? 'added' : c.reason ? 'waiting' : 'ready';
      return {
        key: c.key,
        name: c.name,
        kind: kind.kind,
        icon: slideIcon(c.item),
        ...(c.media ? { media: c.media } : {}),
        status,
        ...(c.reason ? { reason: c.reason } : {}),
        ...(at >= 0 ? { slide: { id: items[at].id, place: at + 1 } } : {}),
        line: `${kind.label} · ${at >= 0 ? 'Already a slide' : c.reason ? `Waiting: ${c.reason}` : 'Ready to show'}`,
      };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || SOURCE_KINDS.indexOf(a.kind) - SOURCE_KINDS.indexOf(b.kind) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/** How many sources there are of each kind, and in all. */
export function sourceCounts(tiles: readonly Pick<SourceTile, 'kind'>[]): Record<'all' | SourceKind, number> {
  const counts = { all: tiles.length, chart: 0, page: 0, album: 0, picture: 0 };
  for (const t of tiles) counts[t.kind]++;
  return counts;
}

/** The kind asked for in the address, else all. */
export const chosenKind = (asked: string | null): 'all' | SourceKind => (SOURCE_KINDS as readonly string[]).includes(asked ?? '') ? (asked as SourceKind) : 'all';

/** What a kind's choice in the filter says it shows (All: everything). */
export const kindLine = (kind: 'all' | SourceKind): string => (kind === 'all' ? ALL_SOURCES : SLIDE_KIND[TYPE_OF[kind]].what);

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Whether a name has every word of the search, in any order, ignoring case and accents. An empty search matches all. */
export function matchesSource(name: string, query: string): boolean {
  const n = fold(name);
  return fold(query).split(/\s+/).filter(Boolean).every((w) => n.includes(w));
}

/** The tiles shown for a kind and a search, in their order. */
export const shownSources = <T extends Pick<SourceTile, 'kind' | 'name'>>(tiles: readonly T[], kind: 'all' | SourceKind, query: string): T[] =>
  tiles.filter((t) => (kind === 'all' || t.kind === kind) && matchesSource(t.name, query));

/** The count line under the search: how many are shown, of which kind, and for which search. */
export function sourcesLine(shown: number, kind: 'all' | SourceKind, query: string): string {
  const what = kind === 'all' ? (shown === 1 ? 'source' : 'sources') : (shown === 1 ? SLIDE_KIND[TYPE_OF[kind]].label : SLIDE_KIND[TYPE_OF[kind]].plural).toLowerCase();
  const q = query.trim();
  if (!shown) return q ? `No ${kind === 'all' ? 'source' : SLIDE_KIND[TYPE_OF[kind]].label.toLowerCase()} matches “${q}”. Try another name${kind === 'all' ? '' : ', or All'}.` : `No ${what} to show yet.`;
  return q ? `${shown} ${what} match “${q}”.` : `${shown} ${what}.`;
}

/** The source the preview step shows: one offered and not already a slide, else none (the sources step). */
export const chosenSource = (choices: readonly HighlightChoice[], items: readonly HighlightItem[], asked: string | null): HighlightChoice | null =>
  (asked && freeChoices(choices, items).find((c) => c.key === asked)) || null;

/** Where a waiting source is put right: its page, its album or its picture (an edit mode address under /_edit/); a chart has none. */
export function fixPlace(item: HighlightItem): { path: string; label: string } | null {
  if (item.type === 'article') return { path: `articles/${item.article}/`, label: 'Edit page' };
  if (item.type === 'album') return { path: `albums/${item.album}/`, label: 'Edit album' };
  if (item.type === 'image') return { path: `media/?id=${encodeURIComponent(item.media)}`, label: 'Edit picture' };
  return null;
}

/** What a source's slide would use, as the preview step's details list it (§2.1): its kind, where it leads, its words, its picture and its place. */
export function sourceFacts(item: HighlightItem, state: { text?: string; href?: string; media?: string; caption?: string }, place: number): { term: string; detail: string }[] {
  const at = place === 1 ? 'Slide 1' : `Slide ${place}, at the end`;
  const facts = (opens: string, words: string, picture: string) => [
    { term: 'Kind', detail: SLIDE_KIND[item.type].label },
    { term: 'Opens', detail: opens },
    { term: 'Words', detail: words },
    { term: 'Picture', detail: picture },
    { term: 'Place', detail: at },
  ];
  const address = (what: string) => (state.href ? `${what} at ${state.href}` : `${what}, once it's placed in a section`);
  if (item.type === 'custom') return facts('Nothing: its controls work in place', 'Your public contributions and their totals', 'None: the chart draws itself');
  if (item.type === 'image') return facts('The picture full size', state.caption ? `Its caption: ${state.caption}` : 'None: it has no caption', 'This picture');
  if (item.type === 'album') return facts(address('The album'), state.text ? 'Its title and summary' : 'Its title (it has no summary)', item.picture ? 'A picture chosen for this slide' : state.media ? 'Its cover' : 'None yet: choose a cover');
  return facts(address('The page'), state.text ? 'Its title, and its summary or the excerpt below' : 'Its title, and the excerpt below', item.picture ? 'A picture chosen for this slide' : state.media ? 'Its automatic page picture' : 'None yet: choose a slide picture');
}

/** One source previewed in Add slide (§2.1): what the page draws and lists for it. */
export interface SlidePreviewData {
  /** The source chosen. */
  source: HighlightChoice;
  /** What its slide would use, in order (`sourceFacts`). */
  facts: { term: string; detail: string }[];
  /** Its words as the slide shows them: the title and, for a page or album, its summary, and where it leads. */
  words: { title: string; text?: string; href?: string };
  /** Its picture at the slide's shape, if it has one that can be drawn. */
  picture?: Picture;
  /** It has a picture, but drawing it here failed. */
  pictureFailed?: boolean;
  /** The GitHub snapshot with its totals, for the chart. */
  chart?: ContributionData;
  /** Where a waiting source is put right, as an edit mode address. */
  fix?: { href: string; label: string };
  /** The sources step's address, with its kind and search. */
  back: string;
}
