/**
 * The repository: the only way pages and layouts read content (documentation/content/spec.md §5). It
 * reads and validates the content folder, and reads it again whenever the content generation moves (a
 * save in the editor, or a file changed by hand, in dev); a build reads it once. After an editor save it
 * takes the store's snapshot as written instead of reading the folders again.
 */
import { currentSnapshot, generation } from './source';
import { isAlbumPublished, loadContent, loadContentLeavingOut, type ContentIndex, type EmbedRecord, type MediaRecord, type VideoRecord } from './load';
import { withBase } from '../design/meta';
import { placeRoutes } from './navigation';
import { timed } from './timing';
import { albumsOrder, resolveAlbum, type MediaLookup, type ResolvedItem } from './album';
import { BUILTIN_MODES } from '../modes/builtin';
import type { ModeData } from '../modes/contract';
import { buildModeData } from '../modes/data';
import { effectiveWays, isOn, LITTLE_PLANET } from '../modes/ways';
import type { Route } from './routes';
import type { Album, Article, PlaceId } from './schema';
import { buildEvidence, type EvidenceIndex } from '../home/evidence';
import { curate, type HomePicks } from '../home/curate';
import { countsOf, effectiveViews, health, type HealthItem } from '../home/health';
import { viewSettings } from '../home/catalogue';
import type { ViewId } from '../home/ids';

let cached: { generation: number; index: ContentIndex } | undefined;

/**
 * Everything in the content folder, validated (the ways in too: V33 to V37). A build throws a ContentError that
 * lists every problem, so nothing broken is published. Dev leaves out an article or a piece of media that doesn't
 * pass, so one broken file never stops every page; what was left out, and why, is `problems` (edit mode shows it).
 */
export function content(): ContentIndex {
  const now = generation();
  if (!cached || cached.generation !== now) {
    // the store's snapshot after its write, when nothing else changed since; else read again (only the
    // documents that changed are parsed again: source.ts)
    const snap = timed('content.read', () => currentSnapshot());
    const sizes = snap.sizes ?? new Map<string, number>();
    const index = timed('content.validate', () => (import.meta.env.DEV ? loadContentLeavingOut(snap.docs, snap.masters, snap.errors, sizes) : loadContent(snap.docs, snap.masters, snap.errors, new Set(), sizes)));
    for (const w of index.warnings) console.warn(`[content] ${w}`);
    for (const p of index.problems) console.warn(`[content] left out until fixed: ${p.file}${p.path ? `: ${p.path}` : ''}: ${p.message}`);
    cached = { generation: now, index };
  }
  return cached.index;
}

export const getSite = () => content().site;
/** The site structure: the tree of sections and pages, and the navigation. */
export const getStructure = () => content().structure;
/** Old addresses and where they now lead. */
export const getRedirects = () => content().redirects;
/** The site's ways in: its ways file, or what a site without one has (plan stage 8A). */
export const getWays = () => effectiveWays({ ways: content().ways, hasPlanet: !!content().planet });
/**
 * The planet's buildings, while the little planet is on: their words and the section each shows. Null when
 * it's off (its structure is kept: V37) or there's no planet structure, so every page leaves the planet out.
 */
export const getPlanet = () => (isOn(getWays(), LITTLE_PLANET) ? content().planet : null);

/** The home page as its views draw it (documentation/home-views/): which views, their settings, the picks and the health report. */
export interface Home {
  default: ViewId;
  offered: ViewId[];
  /** Each offered view's settings, defaults filled in. */
  settings: Partial<Record<ViewId, Record<string, unknown>>>;
  picks: HomePicks;
  health: HealthItem[];
  lenses: { id: string; label: string }[];
}

let homeCache: { generation: number; evidence: EvidenceIndex; byLens: Map<string, Home> } | undefined;

/**
 * The home page's picks, for a lens when one is asked for (curation.md): null while the site has no spine
 * (content/showcase.json) or no home key in its ways file, so its home page is the Classic hub. Read once per
 * content generation and lens.
 */
export function getHome(lens?: string): Home | null {
  const index = content();
  const ways = index.ways?.home;
  if (!index.showcase || !ways) return null;
  const now = generation();
  if (!homeCache || homeCache.generation !== now) homeCache = { generation: now, evidence: timed('home.evidence', () => buildEvidence(index)), byLens: new Map() };
  const key = lens ?? '';
  const hit = homeCache.byLens.get(key);
  if (hit) return hit;
  const showcase = index.showcase;
  const evidence = homeCache.evidence;
  const picks = timed('home.curate', () => curate({ showcase, evidence, topics: index.topics?.topics, lens }));
  const views = effectiveViews(ways, countsOf(picks, showcase));
  const home: Home = {
    ...views,
    settings: Object.fromEntries(views.offered.map((v) => [v, viewSettings(v, ways.settings?.[v])])),
    picks,
    health: health(picks, showcase, evidence, ways),
    lenses: (showcase.lenses ?? []).map((l) => ({ id: l.id, label: l.label })),
  };
  homeCache.byLens.set(key, home);
  return home;
}

/** The evidence index the home page's picks were made from (Keywords matches words against it); null with no home. */
export function getHomeEvidence(): EvidenceIndex | null {
  return getHome() ? homeCache!.evidence : null;
}

/**
 * What a built-in mode is given (documentation/desktop/modes.md §5.2): its slots and the site's published
 * open pages, nothing private or draft. Null when the mode is off or has no structure.
 */
export function getModeData(id: string): ModeData | null {
  const mode = BUILTIN_MODES.get(id);
  // Little planet's structure is still the planet structure (until M1 moves it to structures/modes/)
  const raw = id === LITTLE_PLANET ? getPlanet() : null;
  if (!mode || !raw) return null;
  return buildModeData(content(), { id, mount: mode.manifest.mount, structure: mode.readStructure(raw), base: import.meta.env.BASE_URL ?? '/' });
}

/** The section of the site a building shows (documentation/sections/spec.md §5.2). */
export const placeSection = (placeId: string): Route | undefined => {
  const site = getPlanet()?.places.find((p) => p.id === placeId)?.site;
  return site ? getRoutes().find((r) => r.node.kind === 'hub' && r.node.id === site) : undefined;
};

/** The building a page is in on the planet: the one showing its section, if it's an open published page there. */
export const placeOf = (pageId: string): PlaceId | undefined => {
  const route = getRoutes().find((r) => r.node.kind === 'item' && r.node.item.id === pageId);
  if (!route || route.access !== 'open' || !route.parent) return undefined;
  return getPlanet()?.places.find((p) => p.site === route.parent!.id)?.id;
};

/**
 * A building's pages: its section's published open pages, in the section's order, each with its page on
 * the site. A private page is never on the planet (V28): it has no way to sign in there.
 */
export function placePages(placeId: string): { article: Article; route: Route }[] {
  const site = getPlanet()?.places.find((p) => p.id === placeId)?.site;
  return (site ? placeRoutes(getRoutes(), site) : []).flatMap((route) => {
    const article = route.node.kind === 'item' ? getArticle(route.node.item.id) : undefined;
    return article ? [{ article, route }] : [];
  });
}
/**
 * A building's albums (documentation/gallery/spec.md §13): its section's published open albums, in the section's
 * `albumOrder`. A private album is never on the planet (V28).
 */
export function placeAlbums(placeId: string): { album: Album; route: Route }[] {
  const site = getPlanet()?.places.find((p) => p.id === placeId)?.site;
  return site ? sectionAlbums(site).filter((a) => a.route.access === 'open') : [];
}
export const getArticle = (id: string) => content().articles.get(id);
/** The site's recommendations, in their order (hidden ones too: `recommendationBand` leaves them out). */
export const getRecommendations = () => content().recommendations;
export const getPerson = (id: string) => content().people.get(id);
/** The routes the site builds: hubs and published items, private ones included (they're built sealed). */
export const getRoutes = (): Route[] => content().routes.filter((r) => r.published);
/** The routes anyone may be shown a link to: everything built but private pages (V25, V32). */
export const getOpenRoutes = (): Route[] => getRoutes().filter((r) => r.access === 'open');
/** A page's access: open or private (documentation/access/spec.md §2). */
export const getAccess = (articleId: string) => content().access.get(articleId) ?? 'open';
/** The grants (private-pages/access.json), the overlay and the message offered with a new grant. */
export const getGrants = () => content().grants;
export const getOverlay = () => content().overlay;
export const getAccessMessage = () => content().accessMessage;
export const getRoute = (path: string): Route | undefined => getRoutes().find((r) => r.path === path);
/** Where an item is placed, published or not (the editor's canvas previews a draft in its section). */
export const getPlacement = (type: string, id: string): Route | undefined =>
  content().routes.find((r) => r.node.kind === 'item' && r.node.item.type === type && r.node.item.id === id);

export function getMedia(id: string): MediaRecord {
  const m = content().media.get(id);
  if (!m) throw new Error(`unknown media "${id}"`);
  return m;
}

/** An item's canonical path (without the base), for `ref:` links and cards: published items only. */
export function canonicalPath(type: string, id: string): string | undefined {
  return content().canonical.get(`${type}/${id}`);
}

/**
 * Where a file to download is published (with the base): `<base>/media/<id>.pdf`, which the content-files
 * integration serves in dev and copies there at build. Public files only.
 */
export function documentHref(id: string): string | undefined {
  const d = content().documents.get(id);
  if (!d || !['public', 'publicRedacted', 'summaryOnly'].includes(d.visibility)) return undefined;
  return withBase(`/media/${id}.pdf`);
}

export function getVideo(id: string): VideoRecord {
  const v = content().videos.get(id);
  if (!v) throw new Error(`unknown video "${id}"`);
  return v;
}

/** Whether a media ID is a video file's (a gallery's or a carousel's item can be either). */
export const isVideoMedia = (id: string): boolean => content().videos.has(id);

/**
 * Where a video file is published (with the base): `<base>/media/<id>.<mp4|webm>`, which the content-files
 * integration serves in dev (with ranges, so it seeks) and copies there at build.
 */
export function videoHref(id: string): string {
  const v = getVideo(id);
  return withBase(`/media/${id}.${v.file.split('.').pop()}`);
}

/**
 * Where a video's caption tracks are published (with the base), beside it: `<base>/media/<owner>/<name>.<language>.vtt`
 * for each of its sidecar's `captions` (gallery spec §4.3), served in dev and copied at build by the content-files integration.
 */
export function captionHrefs(id: string): { src: string; srclang: string; label: string; default?: boolean }[] {
  const v = getVideo(id);
  const dir = id.slice(0, id.lastIndexOf('/') + 1);
  return (v.captions ?? []).map((c) => ({ src: withBase(`/media/${dir}${c.file}`), srclang: c.srclang, label: c.label, ...(c.default ? { default: true } : {}) }));
}

/** A linked video (YouTube, Vimeo) in the library (gallery spec §4.2). */
export function getEmbed(id: string): EmbedRecord {
  const e = content().embeds.get(id);
  if (!e) throw new Error(`unknown linked video "${id}"`);
  return e;
}

/** Finds a library item (a picture, a video file or a linked video) by its media ID, for the album rules (album.ts). */
export const albumLookup = (): MediaLookup => {
  const c = content();
  return (id) => c.media.get(id) ?? c.videos.get(id) ?? c.embeds.get(id);
};

/** Every album (gallery spec §3), drafts and private ones included, by ID order. */
export const getAlbums = (): Album[] => [...content().albums.values()];

/** An album with its items in the order shown (`albumOrder`), each with its library item looked up: undefined for no such album. */
export function getAlbum(id: string): { album: Album; items: ResolvedItem<MediaRecord, VideoRecord, EmbedRecord>[] } | undefined {
  const c = content();
  const album = c.albums.get(id);
  return album ? resolveAlbum(album, c.media, c.videos, c.embeds) : undefined;
}

/** An album's page (without the base): its canonical path once it's published and placed. */
export const albumPath = (id: string): string | undefined => canonicalPath('album', id);

/** Whether the gallery an album is placed in (published or not) draws its covers' pictures with square corners (gallery spec §2.2). */
export const albumSquare = (id: string): boolean =>
  content().routes.some((r) => r.node.kind === 'item' && r.node.item.type === 'album' && r.node.item.id === id && r.parent?.albumCorners === 'square');

/**
 * A section's published albums with their routes, in the section's `albumOrder` (gallery spec §5, `albumsOrder`):
 * newest first by default; `custom`, the structure's order. Private ones included (their access is the route's).
 */
export function sectionAlbums(sectionId: string): { album: Album; route: Route }[] {
  const c = content();
  const placed = getRoutes().flatMap((route) => {
    if (route.parent?.id !== sectionId || route.node.kind !== 'item' || route.node.item.type !== 'album') return [];
    const album = c.albums.get(route.node.item.id);
    return album && isAlbumPublished(album) ? [{ album, route, createdAt: album.createdAt, publishedAt: album.publishedAt, items: album.items }] : [];
  });
  const section = c.routes.find((r) => r.node.id === sectionId)?.node;
  const order = section?.kind === 'hub' ? section.albumOrder : undefined;
  return albumsOrder(placed, order, albumLookup()).map(({ album, route }) => ({ album, route }));
}
