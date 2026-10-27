/**
 * Validates the mock API's files and indexes them (the files adapter's second half: the first reads
 * the files, source.ts). Every problem is collected and named by file and field, so one build run lists
 * them all. Pure: the files and the list of media masters come in as arguments, so tests can feed it.
 */
import type { z } from 'astro/zod';
import { PLACE_IDS, accessFile, accessMessage, album as albumSchema, article, documentMedia, embedMedia, fontFile, imageMedia, overlay as overlaySchema, person, planetStructure, recommendationsFile, redirects as redirectList, siteSettings, siteStructure, themeFile, videoMedia, type AccessMessage, type Album, type Article, type DocumentMedia, type EmbedMedia, type FontFileDoc, type GrantRecord, type HubNode, type ImageMedia, type Overlay, type Person, type PlanetStructure, type Redirect, type SiteNode, type SiteSettings, type SiteStructure, type ThemeFile, type VideoMedia } from './schema';
import type { Recommendation } from './recommendations';
import { CUSTOM_FONT, FONT_ROLES, isPreset } from '../theme/model';
import { buildRoutes, canonicalPaths, withOverlay, type Access, type Route } from './routes';
import { checkGrant, covers, isValid } from '../access/grants.ts';
import { LEGACY_PLANET_FILE, PLANET_FILE, WAYS_FILE, waysFile, type Ways } from '../modes/contract';
import { checkModes } from '../modes/rules';
import { BUILTIN_MODES } from '../modes/builtin';
import { effectiveWays } from '../modes/ways';
import { SHOWCASE_FILE, TOPICS_FILE, showcaseFile, topicsFile, type Showcase, type TopicsFile } from '../home/schema';
import { GitHubDataError, validateGitHubSnapshot, type GitHubSnapshot } from './github';
import { checkHome } from '../home/check';
import { HIGHLIGHTS_FILE, checkHighlights, highlightsFile, type Highlights } from './highlights';
import { albumProblems, albumWarnings, fingerprintClashes, isMediaItem, type MediaLookup } from './album';
import { DRAWING_MAX_BYTES, PRIVATE_VIDEO_MAX_BYTES, isDrawingFile } from './schema';

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;

/** Where a resource comes from: the public content folder, or private-pages/ (documentation/access/spec.md §3). */
export type Origin = 'public' | 'private';

export interface MediaRecord extends ImageMedia {
  /** The media ID: its path under its media folder without the extension. */
  id: string;
  /** The master's key (/content/media/… or /private/media/…). */
  master: string;
  /** Its dark mode version's master (….dark.webp), if it has one. */
  darkMaster?: string;
  /** Its still first frame, when its master is animated. */
  posterMaster?: string;
  /** Its dark mode version's still first frame, when that master is animated. */
  darkPosterMaster?: string;
  /** Its master's size in bytes, when the source gave it (loadContent's `sizes`). */
  bytes?: number;
  origin: Origin;
}

/** A file to download (a PDF), with its ID and its master's path. */
export interface DocumentRecord extends DocumentMedia {
  id: string;
  master: string;
  origin: Origin;
}

/** A video file, with its ID, its master's path and its poster's. */
export interface VideoRecord extends VideoMedia {
  id: string;
  master: string;
  posterMaster?: string;
  /** Its master's size in bytes, when the source gave it (loadContent's `sizes`). */
  bytes?: number;
  origin: Origin;
}

/**
 * A linked video (a YouTube or Vimeo video kept in the library: gallery spec §4.2), with its media ID, its poster's
 * master and its origin. The sidecar's own `id` (the provider's ID for the video) is `video` here, as `id` is the
 * media ID, as every other record's.
 */
export interface EmbedRecord extends Omit<EmbedMedia, 'id'> {
  /** The media ID: its path under its media folder without the extension. */
  id: string;
  /** The provider's ID for the video (the sidecar's `id`). */
  video: string;
  /** Its poster's master (`<name>.poster.webp`, beside the sidecar). */
  posterMaster: string;
  origin: Origin;
}

export interface ContentIndex {
  site: SiteSettings;
  /** The public site structure, as written (the editor's and the navigation's). */
  structure: SiteStructure;
  articles: Map<string, Article>;
  /** The albums (content/albums/ and private-pages/albums/: documentation/gallery/spec.md §3), by ID. */
  albums: Map<string, Album>;
  /** Where each article and album comes from (an ID is unique among both, V43). */
  origins: Map<string, Origin>;
  /** Each placed article's and album's access (open or private); an unplaced one isn't in it. */
  access: Map<string, Access>;
  people: Map<string, Person>;
  media: Map<string, MediaRecord>;
  /** Files to download (PDFs), by media ID: linked with `ref:media/<id>`. */
  documents: Map<string, DocumentRecord>;
  /** Video files, by media ID: shown by a video block's `media`. */
  videos: Map<string, VideoRecord>;
  /** Linked videos (YouTube, Vimeo), by media ID: an album's items (gallery spec §4.2). */
  embeds: Map<string, EmbedRecord>;
  /** Every node's route, drafts included (their `published` is false); only published ones are built. Private pages included. */
  routes: Route[];
  /** Canonical paths of published items, keyed `type/id`. */
  canonical: Map<string, string>;
  /** Old addresses sent on to new ones (V19): built as redirect pages. */
  redirects: Redirect[];
  /** The planet's buildings and what each holds (documentation/sections/spec.md §5), if the file is there. */
  planet: PlanetStructure | null;
  /** The site's ways in as written (content/structures/ways.json; plan stage 8A), null without the file: see effectiveWays. */
  ways: Ways | null;
  /** The private overlay: private pages in their sections (null without private-pages/). */
  overlay: Overlay | null;
  /** The grants (private-pages/access.json), empty without private-pages/. */
  grants: GrantRecord[];
  /** The message offered with a new grant. */
  accessMessage: AccessMessage | null;
  /** The person's own themes (content/themes/), by ID (documentation/site-ui/theming.md §3). */
  themes: Map<string, ThemeFile>;
  /** The site's recommendations, in order (content/recommendations.json), hidden ones included. */
  recommendations: Recommendation[];
  /** The fonts imported into the site (content/fonts/), by ID. */
  fonts: Map<string, FontFileDoc>;
  /** The home page's spine (content/showcase.json: documentation/home-views/foundation.md §2), null without it. */
  showcase: Showcase | null;
  /** Optional activity visible on the person's public GitHub profile, refreshed outside the build. */
  github?: GitHubSnapshot;
  /** The classic home's ordered highlights and carousel presentation; absent keeps the legacy opening. */
  highlights?: Highlights;
  /** The topic vocabulary (content/topics.json: home-views/curation.md §4.1), null without it. */
  topics: TopicsFile | null;
  /** Reported, not failed: a published item the site doesn't place (it has no page). */
  warnings: string[];
  /**
   * Files left out because they don't pass the check (dev only: loadContentLeavingOut), with why. Empty from a
   * build, which fails instead: nothing broken is ever published.
   */
  problems: Issue[];
}

/** One thing wrong: the file (under the content folder), the field when there is one, and what's wrong. */
export interface Issue {
  file: string;
  path?: string;
  message: string;
}

export const describe = (i: Issue) => `${i.file}: ${i.path ? `${i.path}: ` : ''}${i.message}`;

export class ContentError extends Error {
  readonly problems: string[];
  constructor(readonly issues: Issue[]) {
    const problems = issues.map(describe);
    super(`The content in content/ has ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
    this.problems = problems;
  }
}

const PUBLISHED = new Set(['published', 'stale']);
const PUBLIC = new Set(['public', 'publicRedacted', 'summaryOnly']);
export const isPublished = (a: { status: string; visibility: string }) => PUBLISHED.has(a.status) && PUBLIC.has(a.visibility);
/** Whether an album is published (an album has no visibility: a private one is in private-pages/). */
export const isAlbumPublished = (a: Pick<Album, 'status'>) => a.status === 'published';
/** An album's file, from its origin. */
export const albumFile = (id: string, origin: Origin) => `${origin === 'private' ? 'private' : 'content'}/albums/${id}.json`;

/** Every picture's media ID a document uses, and every gallery's and carousel's item (a picture or a video file); a video block's file isn't here: see videosUsed. */
export function mediaUsed(a: Article): string[] {
  const ids = a.hero ? [a.hero.media] : [];
  if (a.thumbnail) ids.push(a.thumbnail);
  if (a.thumbnails?.wide) ids.push(a.thumbnails.wide);
  if (a.thumbnails?.square) ids.push(a.thumbnails.square);
  if (a.portrait) ids.push(a.portrait);
  for (const b of a.body) {
    if (b.type === 'figure') ids.push(b.media);
    else if (b.type === 'gallery' || b.type === 'carousel') ids.push(...b.items.map((i) => i.media));
    else if (b.type === 'collection') ids.push(...b.items.flatMap((i) => (i.media ? [i.media] : [])));
    else if (b.type === 'video' && b.poster) ids.push(b.poster);
  }
  if (a.seo?.image) ids.push(a.seo.image);
  return ids;
}

/** Every video file's media ID a document uses. */
export const videosUsed = (a: Article): string[] => a.body.flatMap((b) => (b.type === 'video' && b.media ? [b.media] : []));

/**
 * @param docs the JSON files under content/, keyed by their path from the project root (/content/…)
 * @param masters the media masters under content/media/, as paths from the project root
 * @param readErrors files the source couldn't read (not valid JSON, not a content file)
 * @param leftOut files to treat as absent (an article or an album as one that doesn't pass its check): loadContentLeavingOut's
 * @param sizes the masters' sizes in bytes, when the source knows them (a drawing's limit, V42; a playing tile's
 *   and a private album's video's, V40, V44, V48); without one, a picture's measured `facts.bytes` stand in, and a
 *   size not known at all isn't checked
 */
export function loadContent(docs: Record<string, unknown>, masters: Set<string>, readErrors: string[] = [], leftOut: ReadonlySet<string> = new Set(), sizes: ReadonlyMap<string, number> = new Map()): ContentIndex {
  const issues: Issue[] = readErrors.map((e) => {
    const at = e.indexOf(': ');
    return { file: e.slice(0, at), message: e.slice(at + 2) };
  });
  const add = (file: string, message: string, path?: string) => issues.push({ file: file.replace(/^\//, ''), message, ...(path ? { path } : {}) });
  // the latest day it is anywhere: a picture taken "today" where its owner is is never in the future (V50)
  const today = new Date(Date.now() + 14 * 3600e3).toISOString().slice(0, 10);
  const parse = <T>(schema: z.ZodType<T>, file: string, data: unknown): T | undefined => {
    const r = schema.safeParse(data);
    if (r.success) return r.data;
    for (const issue of r.error.issues) add(file, issue.message, issue.path.join('.') || '(root)');
    return undefined;
  };

  let site: SiteSettings | undefined;
  let structure: SiteStructure | undefined;
  let redirects: Redirect[] = [];
  let planet: PlanetStructure | null = null;
  let overlay: Overlay | null = null;
  let grants: GrantRecord[] = [];
  let message: AccessMessage | null = null;
  let ways: Ways | null = null;
  let showcase: Showcase | null = null;
  let github: GitHubSnapshot | undefined;
  let highlights: Highlights | undefined;
  let topics: TopicsFile | null = null;
  // Little planet's structure: where it was read from (the new place, or the old one during the move: M1.1)
  let planetFile = '';
  const planetFiles: string[] = [];
  const articles = new Map<string, Article>();
  // articles whose file is there but doesn't pass its own check: its issues say why, so a node placing one isn't "missing"
  const invalidArticles = new Set<string>();
  const albums = new Map<string, Album>();
  // the same for albums
  const invalidAlbums = new Set<string>();
  const origins = new Map<string, Origin>();
  const people = new Map<string, Person>();
  const media = new Map<string, MediaRecord>();
  const documents = new Map<string, DocumentRecord>();
  const videos = new Map<string, VideoRecord>();
  const embeds = new Map<string, EmbedRecord>();
  const themes = new Map<string, ThemeFile>();
  let recommendations: Recommendation[] = [];
  const fonts = new Map<string, FontFileDoc>();
  // a media ID is unique across both folders (V24)
  const mediaTaken = new Map<string, string>();
  const claimMedia = (file: string, id: string) => {
    const other = mediaTaken.get(id);
    if (other) add(file, `media "${id}" is also ${other.slice(1)}: a media ID is unique across content/ and private-pages/ (V24)`);
    else mediaTaken.set(id, file);
    return !other;
  };

  for (const [file, data] of Object.entries(docs).sort(([a], [b]) => a.localeCompare(b))) {
    const name = file.split('/').pop()!.replace(/\.json$/, '');
    let m: RegExpExecArray | null;
    // a file left out (dev, loadContentLeavingOut): absent, but an article's place in the structure isn't "missing"
    if (leftOut.has(file)) {
      if (ARTICLE_FILE.test(file)) invalidArticles.add(name);
      else if (ALBUM_FILE.test(file)) invalidAlbums.add(name);
      continue;
    }
    if (file === '/content/site.json') site = parse(siteSettings, file, data);
    else if (file === '/content/structures/site.json') structure = parse(siteStructure, file, data);
    else if (file === '/content/redirects.json') redirects = parse(redirectList, file, data) ?? [];
    else if (file === `/content/${PLANET_FILE}` || file === `/content/${LEGACY_PLANET_FILE}`) {
      // both places at once is refused below; the new one wins meanwhile
      const p = parse(planetStructure, file, data) ?? null;
      if (!planetFile || file === `/content/${PLANET_FILE}`) {
        planet = p;
        planetFile = file;
      }
      planetFiles.push(file);
    } else if (file === `/content/${WAYS_FILE}`) ways = parse(waysFile, file, data) ?? null;
    else if (file === `/content/${SHOWCASE_FILE}`) showcase = parse(showcaseFile, file, data) ?? null;
    else if (file === `/content/${TOPICS_FILE}`) topics = parse(topicsFile, file, data) ?? null;
    else if (file === `/content/${HIGHLIGHTS_FILE}`) highlights = parse(highlightsFile, file, data);
    else if (file === '/content/github.json') {
      try {
        github = validateGitHubSnapshot(data);
      } catch (error) {
        if (!(error instanceof GitHubDataError)) throw error;
        add(file, error.message);
      }
    }
    else if (file === '/content/recommendations.json') {
      recommendations = parse(recommendationsFile, file, data)?.items ?? [];
      const seen = new Set<string>();
      recommendations.forEach((r, i) => {
        if (seen.has(r.id)) add(file, `"${r.id}" is listed twice: a recommendation's ID is unique`, `items.${i}.id`);
        seen.add(r.id);
      });
    }
    else if (file === '/private/structures/overlay.json') overlay = parse(overlaySchema, file, data) ?? null;
    else if (file === '/private/access.json') grants = parse(accessFile, file, data)?.grants ?? [];
    else if (file === '/private/access-message.json') message = parse(accessMessage, file, data) ?? null;
    else if ((m = /^\/(content|private)\/articles\/[^/]+\.json$/.exec(file))) {
      // the first build's albums (V43): said plainly, beside the schema's own refusal
      const old = data as { kind?: unknown; album?: unknown } | null;
      if (old && (old.kind === 'gallery' || old.album !== undefined)) add(file, 'an article never has an album or the kind gallery: an album is its own file, albums/<id>.json (V43)', old.album !== undefined ? 'album' : 'kind');
      const a = parse(article, file, data);
      if (!a) invalidArticles.add(name);
      if (a && a.id !== name) add(file, `id "${a.id}" must match the file name`, 'id');
      else if (a && articles.has(a.id)) add(file, `article "${a.id}" is in both content/ and private-pages/: an ID is unique across both (V24)`, 'id');
      else if (a && albums.has(a.id)) add(file, `"${a.id}" is also an album's ID: an ID is unique among albums and articles (V43)`, 'id');
      else if (a) {
        articles.set(a.id, a);
        origins.set(a.id, m[1] === 'private' ? 'private' : 'public');
      }
    } else if ((m = /^\/(content|private)\/albums\/[^/]+\.json$/.exec(file))) {
      const al = parse(albumSchema, file, data);
      if (!al) invalidAlbums.add(name);
      if (al && al.id !== name) add(file, `id "${al.id}" must match the file name`, 'id');
      else if (al && albums.has(al.id)) add(file, `album "${al.id}" is in both content/ and private-pages/: an ID is unique across both (V24)`, 'id');
      else if (al && articles.has(al.id)) add(file, `"${al.id}" is also an article's ID: an ID is unique among albums and articles (V43)`, 'id');
      else if (al) {
        albums.set(al.id, al);
        origins.set(al.id, m[1] === 'private' ? 'private' : 'public');
      }
    } else if (/^\/content\/people\/[^/]+\.json$/.test(file)) {
      const p = parse(person, file, data);
      if (p && p.id !== name) add(file, `id "${p.id}" must match the file name`, 'id');
      else if (p) people.set(p.id, p);
    } else if (/^\/content\/themes\/[^/]+\.json$/.test(file)) {
      const t = parse(themeFile, file, data);
      if (t && t.id !== name) add(file, `id "${t.id}" must match the file name`, 'id');
      else if (t && isPreset(t.id)) add(file, `"${t.id}" is a preset's ID: a theme of your own needs another`, 'id');
      else if (t) themes.set(t.id, t);
    } else if (/^\/content\/fonts\/[^/]+\.json$/.test(file)) {
      const f = parse(fontFile, file, data);
      if (f && f.id !== name) add(file, `id "${f.id}" must match the file name`, 'id');
      else if (f) {
        const missing = f.faces.filter((face) => !masters.has(`/content/fonts/${face.file}`));
        if (missing.length) add(file, `its file ${missing.map((m) => `content/fonts/${m.file}`).join(', ')} is missing`, 'faces');
        else fonts.set(f.id, f);
      }
    } else if ((m = /^\/(content|private)\/media\/(.+)\.json$/.exec(file))) {
      const origin: Origin = m[1] === 'private' ? 'private' : 'public';
      const mediaKey = m[2];
      // a file to download (a PDF), or a picture
      if ((data as { kind?: unknown } | null)?.kind === 'document') {
        const d = parse(documentMedia, file, data);
        if (!d) continue;
        const master = file.slice(0, file.lastIndexOf('/') + 1) + d.file;
        if (origin === 'private') add(file, "a file to download can't be private yet: keep it in content/media/ or leave it out");
        else if (d.file.replace(/\.pdf$/, '') !== name) add(file, `the file "${d.file}" must share the sidecar's name`, 'file');
        else if (!masters.has(master)) add(file, `its file ${master.slice(1)} is missing`);
        else if (claimMedia(file, mediaKey)) documents.set(mediaKey, { ...d, id: mediaKey, master, origin });
        continue;
      }
      // a linked video (gallery spec §4.2, V45), with its poster beside it
      if ((data as { kind?: unknown } | null)?.kind === 'embed') {
        const e = parse(embedMedia, file, data);
        if (!e) continue;
        const posterMaster = file.slice(0, file.lastIndexOf('/') + 1) + e.poster.file;
        if (e.poster.file.replace(/\.poster\.webp$/, '') !== name) add(file, `the poster "${e.poster.file}" must share the sidecar's name (${name}.poster.webp)`, 'poster.file');
        else if (!masters.has(posterMaster)) add(file, `its poster ${posterMaster.slice(1)} is missing`, 'poster.file');
        else if (e.taken && e.taken > today) add(file, `taken on ${e.taken}, a day that hasn't come yet: a date is no later than the day it was saved (V50)`, 'taken');
        else if (claimMedia(file, mediaKey)) {
          const { id: video, ...rest } = e;
          embeds.set(mediaKey, { ...rest, id: mediaKey, video, posterMaster, origin });
        }
        continue;
      }
      // a video file (media.md §12), with its poster beside it
      if ((data as { kind?: unknown } | null)?.kind === 'video') {
        const v = parse(videoMedia, file, data);
        if (!v) continue;
        const dir = file.slice(0, file.lastIndexOf('/') + 1);
        const master = dir + v.file;
        const posterMaster = v.poster ? dir + v.poster.file : undefined;
        if (v.file.replace(/\.\w+$/, '') !== name) add(file, `the video "${v.file}" must share the sidecar's name`, 'file');
        else if (!masters.has(master)) add(file, `its video ${master.slice(1)} is missing`);
        else if (v.poster && v.poster.file.replace(/\.poster\.\w+$/, '') !== name) add(file, `the poster "${v.poster.file}" must share the sidecar's name (${name}.poster.webp)`, 'poster.file');
        else if (posterMaster && !masters.has(posterMaster)) add(file, `its poster ${posterMaster.slice(1)} is missing`, 'poster.file');
        else if (v.captions?.some((c) => !c.file.startsWith(`${name}.`))) add(file, `a caption track must share the sidecar's name (${name}.<language>.vtt)`, 'captions');
        else if (v.captions?.some((c) => !masters.has(dir + c.file))) add(file, `its caption track ${(dir + v.captions.find((c) => !masters.has(dir + c.file))!.file).slice(1)} is missing`, 'captions');
        else if (v.taken && v.taken > today) add(file, `taken on ${v.taken}, a day that hasn't come yet: a date is no later than the day it was saved (V50)`, 'taken');
        else if (claimMedia(file, mediaKey)) videos.set(mediaKey, { ...v, id: mediaKey, master, ...(posterMaster ? { posterMaster } : {}), ...(sizes.has(master) ? { bytes: sizes.get(master) } : {}), origin });
        continue;
      }
      const s = parse(imageMedia, file, data);
      if (!s) continue;
      const dir = file.slice(0, file.lastIndexOf('/') + 1);
      const master = dir + s.file;
      const darkMaster = s.dark ? dir + s.dark.file : undefined;
      const posterMaster = s.animation ? dir + s.animation.poster : undefined;
      const darkPosterMaster = s.dark?.animation ? dir + s.dark.animation.poster : undefined;
      if (s.file.replace(/\.\w+$/, '') !== name) add(file, `the master "${s.file}" must share the sidecar's name`, 'file');
      else if (!masters.has(master)) add(file, `its master ${master.slice(1)} is missing`);
      else if (s.animation && s.animation.poster.replace(/\.poster\.webp$/, '') !== name) add(file, `the animation poster "${s.animation.poster}" must share the sidecar's name (${name}.poster.webp)`, 'animation.poster');
      else if (posterMaster && !masters.has(posterMaster)) add(file, `its animation poster ${posterMaster.slice(1)} is missing`, 'animation.poster');
      else if (s.dark && s.dark.file.replace(/\.dark\.\w+$/, '') !== name) add(file, `the dark version "${s.dark.file}" must share the sidecar's name (${name}.dark.webp)`, 'dark.file');
      else if (darkMaster && !masters.has(darkMaster)) add(file, `its dark version ${darkMaster.slice(1)} is missing`, 'dark.file');
      else if (s.dark?.animation && s.dark.animation.poster.replace(/\.dark\.poster\.webp$/, '') !== name) add(file, `the dark animation poster "${s.dark.animation.poster}" must share the sidecar's name (${name}.dark.poster.webp)`, 'dark.animation.poster');
      else if (darkPosterMaster && !masters.has(darkPosterMaster)) add(file, `its dark animation poster ${darkPosterMaster.slice(1)} is missing`, 'dark.animation.poster');
      else if (isDrawingFile(s.file) && (sizes.get(master) ?? s.facts?.bytes ?? 0) > DRAWING_MAX_BYTES) add(file, `the drawing is ${kb(sizes.get(master) ?? s.facts!.bytes)}: a drawing is at most ${kb(DRAWING_MAX_BYTES)} (V42)`, 'file');
      else if (darkMaster && isDrawingFile(darkMaster) && (sizes.get(darkMaster) ?? s.dark?.facts?.bytes ?? 0) > DRAWING_MAX_BYTES) add(file, `its dark version is more than ${kb(DRAWING_MAX_BYTES)}: a drawing is at most that (V42)`, 'dark.file');
      else if (s.taken && s.taken > today) add(file, `taken on ${s.taken}, a day that hasn't come yet: a picture's date is no later than the day it was saved (V50)`, 'taken');
      else if (claimMedia(file, mediaKey))
        media.set(mediaKey, {
          ...s,
          id: mediaKey,
          master,
          ...(darkMaster ? { darkMaster } : {}),
          ...(posterMaster ? { posterMaster } : {}),
          ...(darkPosterMaster ? { darkPosterMaster } : {}),
          ...(sizes.has(master) ? { bytes: sizes.get(master) } : {}),
          origin,
        });
    } else add(file, 'not a resource the content model knows');
  }
  // a left-out article that couldn't even be read (not valid JSON) is in no doc: still not "missing"
  for (const f of leftOut) {
    if (ARTICLE_FILE.test(f)) invalidArticles.add(f.split('/').pop()!.replace(/\.json$/, ''));
    else if (ALBUM_FILE.test(f)) invalidAlbums.add(f.split('/').pop()!.replace(/\.json$/, ''));
  }

  for (const master of masters) {
    // a font's files are named by its own sidecar (content/fonts/<id>.json), checked below
    if (master.startsWith('/content/fonts/')) {
      if (!/^\/content\/fonts\/[^/]+\.woff2$/.test(master)) add(master, 'only .woff2 files belong in content/fonts/');
      else if (![...Object.entries(docs)].some(([k, d]) => k.startsWith('/content/fonts/') && (d as { faces?: { file?: string }[] } | null)?.faces?.some((f) => `/content/fonts/${f.file}` === master)))
        add(master, 'a font file no font names (import the font again, or delete it)');
      continue;
    }
    const darkPoster = /\.dark\.poster\.\w+$/.test(master);
    const dark = !darkPoster && /\.dark\.\w+$/.test(master);
    const poster = !darkPoster && /\.poster\.\w+$/.test(master);
    // a video's caption track (<name>.<language>.vtt), named by its video's sidecar
    if (/\.vtt$/.test(master)) {
      const vttSidecar = master.replace(/\.[a-z]{2,3}(-[a-z0-9]+)*\.vtt$/, '.json');
      const named = (docs[vttSidecar] as { captions?: { file?: string }[] } | null)?.captions?.some((c) => c.file === master.split('/').pop());
      if (vttSidecar === master || !named) add(master, `a caption track no video names (add it to its video's "captions", or delete it)`);
      continue;
    }
    const sidecar = master.replace(darkPoster ? /\.dark\.poster\.\w+$/ : dark ? /\.dark\.\w+$/ : poster ? /\.poster\.\w+$/ : /\.\w+$/, '.json');
    const doc = docs[sidecar] as { kind?: string; poster?: { file?: string }; animation?: { poster?: string }; dark?: { file?: string; animation?: { poster?: string } } } | null;
    if (!(sidecar in docs)) add(master, `a master without its sidecar (${sidecar.split('/').pop()})`);
    else if (darkPoster && doc?.dark?.animation?.poster !== master.split('/').pop()) add(master, `a dark animation poster its picture doesn't name (add it as "dark.animation" in ${sidecar.split('/').pop()}, or delete it)`);
    else if (dark && doc?.dark?.file !== master.split('/').pop()) add(master, `a dark version its picture doesn't name (add it as "dark" in ${sidecar.split('/').pop()}, or delete it)`);
    else if (poster && (doc?.kind === 'video' || doc?.kind === 'embed' ? doc.poster?.file : doc?.animation?.poster) !== master.split('/').pop())
      add(master, `a poster its ${doc?.kind === 'video' || doc?.kind === 'embed' ? 'video' : 'picture'} doesn't name (add it to ${sidecar.split('/').pop()}, or delete it)`);
  }
  if (!site) add('content/site.json', 'missing');
  if (!structure) add('content/structures/site.json', 'missing');

  // themes (documentation/site-ui/theming.md §3): the fonts a theme names are imported, and the site's theme exists
  for (const t of themes.values())
    for (const role of FONT_ROLES) {
      const fid = CUSTOM_FONT.exec(t.fonts[role])?.[1];
      if (fid && !fonts.has(fid)) add(`content/themes/${t.id}.json`, `the font "${fid}" isn't imported (content/fonts/${fid}.json)`, `fonts.${role}`);
    }
  if (site?.theme && !isPreset(site.theme) && !themes.has(site.theme)) add('content/site.json', `the theme "${site.theme}" is neither a preset nor in content/themes/`, 'theme');
  // a section's recommendations that follow a page: one of its own (documentation/sections/recommendations.md §2.2)
  const hubs = (n: SiteNode): HubNode[] => (n.kind === 'hub' ? [n, ...(n.children ?? []).flatMap(hubs)] : []);
  for (const h of structure ? hubs(structure.home) : []) {
    const r = h.recommendations;
    if (!r || r.at !== 'after') continue;
    if (!r.after) add('content/structures/site.json', `the section "${h.id}" shows its recommendations after a page, but doesn't say which`, `${h.id}.recommendations.after`);
    else if (!(h.children ?? []).some((c) => c.kind === 'item' && c.id === r.after))
      add('content/structures/site.json', `the section "${h.id}" shows its recommendations after "${r.after}", which isn't one of its pages`, `${h.id}.recommendations.after`);
  }

  // references (V3, V5): media, people; a public page never points at anything private (V25), and a
  // protected page's own `related` names open pages only (V32)
  const checkNotes: string[] = [];
  const needMedia = (from: string, id: string, origin: Origin = 'public', orVideo = false, published = true) => {
    const rec = media.get(id) ?? (orVideo ? videos.get(id) : undefined);
    if (!rec) add(from, orVideo ? `media "${id}" doesn't exist (a picture or a video file)` : `media "${id}" doesn't exist`);
    else if (!PUBLIC.has(rec.visibility)) add(from, `media "${id}" isn't public`);
    else if (rec.origin === 'private' && origin === 'public') add(from, `media "${id}" is private (in private-pages/): an open page can't show it (V25)`);
    // alt text may wait anywhere: anything published that shows a picture without it is warned of, never refused (V54)
    else if (published && rec.kind === 'image' && !rec.alt && !rec.decorative)
      checkNotes.push(origin === 'private' || rec.origin === 'private' ? 'a private page shows a picture with no alt text (V54)' : `${from}: the picture "${id}" has no alt text: readers who can't see it are told nothing about it (or, in an article, mark it decorative) (V54)`);
  };
  // albums (documentation/gallery/spec.md §16): V38 to V55 for each album; V51 for the blocks that show one, below
  const lookupMedia: MediaLookup = (id) => media.get(id) ?? videos.get(id) ?? embeds.get(id);
  for (const al of albums.values()) {
    const origin = origins.get(al.id)!;
    const file = albumFile(al.id, origin);
    const published = isAlbumPublished(al);
    for (const i of albumProblems(al, lookupMedia, { published })) add(file, i.message, i.path);
    al.items.forEach((item, i) => {
      if (!isMediaItem(item)) return;
      const at = `items.${i}.media`;
      const rec = media.get(item.media) ?? videos.get(item.media) ?? embeds.get(item.media);
      if (!rec) add(file, `"${item.media}" isn't in the library: an album's item is a picture, a drawing, a video file or a linked video (V38)`, at);
      else if (!PUBLIC.has(rec.visibility)) add(file, `"${item.media}" isn't public`, at);
      else if (rec.origin === 'private' && origin === 'public') add(file, `"${item.media}" is private (in private-pages/): an open album never uses a private library item (V52)`, at);
      else if (origin === 'private' && rec.kind === 'video' && rec.bytes && rec.bytes > PRIVATE_VIDEO_MAX_BYTES)
        add(file, `the video "${item.media}" is ${mb(rec.bytes)}: a private album's video file is at most ${mb(PRIVATE_VIDEO_MAX_BYTES)}, as it's sealed and fetched whole (V44)`, at);
    });
    for (const w of albumWarnings(al, lookupMedia, { published })) checkNotes.push(origin === 'private' ? `a private album: ${w.replace(/"[^"]*"/g, 'an item')}` : `${file}: ${w}`);
  }
  // a file is in the library once (V55): the same fingerprint twice is refused on the later one
  const sidecarOf = (id: string, origin: Origin) => `${origin === 'private' ? 'private' : 'content'}/media/${id}.json`;
  const library = [...media.values(), ...videos.values(), ...embeds.values()];
  for (const { ids } of fingerprintClashes(library)) {
    const [first, ...rest] = ids;
    for (const id of rest) {
      const rec = library.find((r) => r.id === id)!;
      add(sidecarOf(id, rec.origin), `the same file as "${first}" (their fingerprints match): a file is in the library once, so use that one (V55)`, 'fingerprint');
    }
  }
  for (const a of articles.values()) {
    const origin = origins.get(a.id)!;
    const file = `${origin === 'private' ? 'private' : 'content'}/articles/${a.id}.json`;
    // a gallery's or a carousel's item can be a video file too; every other use is a picture
    const either = new Set(a.body.flatMap((b) => (b.type === 'gallery' || b.type === 'carousel' ? b.items.map((it) => it.media) : [])));
    for (const id of mediaUsed(a)) needMedia(file, id, origin, either.has(id), isPublished(a));
    if (a.seo?.image && isDrawingFile(media.get(a.seo.image)?.file ?? '')) add(file, "a social image is a picture: a drawing isn't shown where the page is shared (V46)", 'seo.image');
    a.body.forEach((b, i) => {
      if (b.type !== 'gallery' && b.type !== 'carousel') return;
      b.items.forEach((it, n) => {
        if ((it.autoplay !== undefined || it.loop !== undefined) && !videos.has(it.media)) add(file, 'autoplay and loop are for a video file, not a picture', `body.${i}.items.${n}`);
      });
    });
    // a video block: a video file, or an embed with its title and poster (media.md §12)
    a.body.forEach((b, i) => {
      if (b.type !== 'video') return;
      const at = `body.${i}`;
      if (!!b.media === !!b.embed) return add(file, 'a video is a video file (media) or an embed, one of the two', at);
      if (b.embed && !b.title) add(file, 'an embedded video needs its title', `${at}.title`);
      if (b.embed && !b.poster) add(file, 'an embedded video needs a poster picture', `${at}.poster`);
      if (b.embed && (b.autoplay !== undefined || b.loop !== undefined)) add(file, 'autoplay and loop are for a video file: a YouTube or Vimeo video starts when the reader presses play', at);
      if (b.embed && b.width === 'actual') add(file, 'actual size is for a video file: choose a width for an embedded video', `${at}.width`);
      if (b.media) {
        const v = videos.get(b.media);
        if (!v) add(file, `the video "${b.media}" doesn't exist`, `${at}.media`);
        else if (!PUBLIC.has(v.visibility)) add(file, `the video "${b.media}" isn't public`, `${at}.media`);
        else if (v.origin === 'private' && origin === 'public') add(file, `the video "${b.media}" is private (in private-pages/): an open page can't show it (V25)`, `${at}.media`);
      }
    });
    // a link to a file to download (ref:media/<id>) needs the file, public
    for (const [, id] of JSON.stringify(a.body).matchAll(/\]\(ref:media\/([a-z0-9/-]+)\)/g)) {
      const doc = documents.get(id);
      if (!doc) add(file, `the file to download "media/${id}" doesn't exist`);
      else if (!PUBLIC.has(doc.visibility)) add(file, `the file to download "media/${id}" isn't public`);
    }
    // a link to another page (ref:article/<id>) from an open page never names a private one (V25)
    if (origin === 'public') {
      for (const [, id] of JSON.stringify(a.body).matchAll(/\]\(ref:article\/([a-z0-9-]+)\)/g)) {
        if (origins.get(id) === 'private') add(file, `links to "${id}", a private page: an open page can't name one (V25)`);
      }
    }
    (a.related ?? []).forEach((r, i) => {
      if (r.type === 'article' && origins.get(r.id) === 'private') add(file, origin === 'public' ? `related names "${r.id}", a private page: an open page can't name one (V25)` : `related names "${r.id}", another private page: a private page lists open pages only (V32)`, `related.${i}`);
    });
    // anchors made from words are made unique (headingIds); two set by hand can't be
    const ids = new Set<string>();
    a.body.forEach((b, i) => {
      if (b.type !== 'heading' || !b.id) return;
      if (ids.has(b.id)) add(file, `two headings have the anchor "${b.id}"; change one of them`, `body.${i}.id`);
      ids.add(b.id);
    });
    // a block's key names one block (edit mode repairs a copy's on save)
    const keys = new Set<string>();
    a.body.forEach((b, i) => {
      if (!b.key) return;
      if (keys.has(b.key)) add(file, `two blocks have the key "${b.key}"; change one of them`, `body.${i}.key`);
      keys.add(b.key);
    });
  }
  for (const p of people.values()) if (p.avatar) needMedia(`content/people/${p.id}.json`, p.avatar);
  for (const r of recommendations) if (r.photo) needMedia('content/recommendations.json', r.photo);
  if (site?.socialImage) needMedia('content/site.json', site.socialImage);
  if (site?.socialImage && isDrawingFile(media.get(site.socialImage)?.file ?? '')) add('content/site.json', "a social image is a picture: a drawing isn't shown where the site is shared (V46)", 'socialImage');
  // an album block (V51): an album, open, and published wherever the page showing it is
  for (const a of articles.values()) {
    const file = `${origins.get(a.id) === 'private' ? 'private' : 'content'}/articles/${a.id}.json`;
    a.body.forEach((b, i) => {
      if (b.type !== 'album') return;
      const at = `body.${i}.album`;
      const target = albums.get(b.album);
      if (!target) {
        if (!invalidAlbums.has(b.album)) add(file, articles.has(b.album) ? `"${b.album}" is an article, not an album: an album block names an album (V51)` : `the album "${b.album}" doesn't exist (V51)`, at);
      } else if (origins.get(b.album) === 'private') add(file, `"${b.album}" is a private album: its band would carry its words outside its seal (V51)`, at);
      else if (isPublished(a) && !isAlbumPublished(target)) add(file, `the album "${b.album}" isn't published, and this page is: publish the album first, or take the block out (V51)`, at);
    });
  }
  if (site && !people.has(site.owner)) add('content/site.json', `owner "${site.owner}" isn't in content/people/`, 'owner');

  let routes: Route[] = [];
  const access = new Map<string, Access>();
  const warnings: string[] = [...checkNotes];
  const OVERLAY = 'private/structures/overlay.json';
  if (structure) {
    const lookup = (type: string, id: string) => {
      if (type === 'album') {
        const al = albums.get(id);
        return al && { slug: al.slug, title: al.title, published: isAlbumPublished(al) };
      }
      const a = type === 'article' ? articles.get(id) : undefined;
      return a && { slug: a.slug, title: a.title, navLabel: a.navLabel, published: isPublished(a) };
    };
    // the public structure places public pages only; the overlay, private ones only (V23)
    const visitPublic = (n: SiteNode): void => {
      if (n.kind === 'item') {
        if (origins.get(n.item.id) === 'private') add('content/structures/site.json', `node ${n.id} places "${n.item.id}", which is in private-pages/: a private page is placed by the overlay, never the public structure (V23)`);
      } else for (const c of n.children ?? []) visitPublic(c);
    };
    visitPublic(structure.home);
    const tokens = new Map<string, string>();
    const claimToken = (token: string, nodeId: string, at: string) => {
      if (tokens.has(token)) add(OVERLAY, `token "${token}" is also ${tokens.get(token)}'s: a token is unique (V24)`, at);
      tokens.set(token, nodeId);
    };
    const needPrivate = (id: string, at: string) => {
      if (!articles.has(id) && !albums.has(id)) return;
      if (origins.get(id) !== 'private') add(OVERLAY, `"${id}" is in content/: a private page lives in private-pages/ (V23)`, at);
    };
    overlay?.sections.forEach((s, i) =>
      s.pages.forEach((p, j) => {
        claimToken(p.token, p.id, `sections.${i}.pages.${j}.token`);
        needPrivate(p.item.id, `sections.${i}.pages.${j}.item`);
      }),
    );
    const merged = withOverlay(structure, overlay);
    for (const e of merged.errors) add(OVERLAY, e);
    warnings.push(...merged.warnings);
    const built = buildRoutes(merged.structure, lookup, merged.private);
    const missingOnlyAsInvalid = (e: string) => {
      const m = /places (article|album) "([^"]+)", which doesn't exist$/.exec(e);
      return !!m && (m[1] === 'album' ? invalidAlbums : invalidArticles).has(m[2]);
    };
    for (const e of built.errors) if (!missingOnlyAsInvalid(e)) add([...merged.private].some((id) => e.startsWith(`node ${id}:`)) ? OVERLAY : 'content/structures/site.json', e);
    routes = built.routes;
    for (const r of routes) if (r.node.kind === 'item') access.set(r.node.item.id, r.access);
    const placed = canonicalPaths(routes);
    for (const a of articles.values()) if (isPublished(a) && !placed.has(`article/${a.id}`)) warnings.push(`article "${a.id}" is published but the site structure doesn't place it, so it has no page (V12)`);
    for (const al of albums.values()) if (isAlbumPublished(al) && !placed.has(`album/${al.id}`)) warnings.push(`album "${al.id}" is published but the site structure doesn't place it, so it has no page (V43)`);

    // the navigation (V17): every entry points at a node of the tree, or at a real address; never a protected page (V25)
    const STRUCTURE_FILE = 'content/structures/site.json';
    for (const field of ['contactPage', 'privacyPage', 'resumePage'] as const) {
      const node = site?.[field];
      if (!node) continue;
      const r = routes.find((x) => x.node.id === node);
      if (!r) add('content/site.json', `${field} "${node}" isn't a node of the site's tree`, field);
      else if (r.access !== 'open') add('content/site.json', `${field} "${node}" is a private page (V25)`, field);
      else if (field === 'resumePage' && r.node.kind !== 'item') add('content/site.json', `resumePage "${node}" is a section: it names the résumé's page`, field);
    }
    (structure.menus?.primary ?? []).forEach((e, i) => {
      const at = `menus.primary.${i}`;
      if ('node' in e) {
        const r = routes.find((x) => x.node.id === e.node);
        if (!r) add(STRUCTURE_FILE, `node "${e.node}" isn't in the site's tree`, at);
        else if (r.access !== 'open') add(STRUCTURE_FILE, `node "${e.node}" is a private page: the navigation names open ones only (V25)`, at);
      } else if (e.href.startsWith('/') && !isSitePath(e.href, routes.filter((x) => x.access === 'open'))) add(STRUCTURE_FILE, `${e.href} isn't a page of this site`, at);
    });
    // Little planet's structure moved to the modes' folder (M1.1): the old place is still read, but not both
    if (planetFiles.length > 1) add(`content/${LEGACY_PLANET_FILE}`, `Little planet's structure is in both ${PLANET_FILE} and ${LEGACY_PLANET_FILE}: keep the first and delete the second`);
    else if (planetFile === `/content/${LEGACY_PLANET_FILE}`) warnings.push(`Little planet's structure is still at content/${LEGACY_PLANET_FILE}: move it to content/${PLANET_FILE} (node scripts/migrate-planet-structure.mjs)`);
    // the planet (V14 to V16): each building once, each showing a section of the site, and a section shown by one
    // building at most. What a building holds follows its section, so it's on the site by construction (V13, V15)
    if (planet) {
      const PLANET = planetFile.slice(1);
      for (const pid of PLACE_IDS) {
        const n = planet.places.filter((p) => p.id === pid).length;
        if (n !== 1) add(PLANET, n ? `the ${pid} is listed ${n} times; each building is listed once (V14)` : `the ${pid} is missing; every building is listed once (V14)`, 'places');
      }
      const shownBy = new Map<string, string>();
      planet.places.forEach((p, i) => {
        if (!routes.some((r) => r.node.id === p.site && r.node.kind === 'hub' && r.path !== '/')) add(PLANET, `"${p.site}" isn't a section of the site (V16)`, `places.${i}.site`);
        else if (shownBy.has(p.site)) add(PLANET, `the ${shownBy.get(p.site)} and the ${p.id} both show "${p.site}"; a section is shown by one building at most (V15)`, `places.${i}.site`);
        shownBy.set(p.site, p.id);
      });
    }
    // redirects (V19): only ones from an address nothing else has, to a page that's built, are kept. The
    // site keeps no promise about old addresses (a page that moves simply leaves its old one), so one that
    // no longer fits is skipped with a warning and never blocks a change (documentation/sections/spec.md §7.2).
    // A redirect never leads to a protected page (V25)
    const taken = new Set(routes.map((r) => r.path));
    const published = new Set(routes.filter((r) => r.published).map((r) => r.path));
    const sealed = new Set(routes.filter((r) => r.access !== 'open').map((r) => r.path));
    const froms = new Set<string>();
    redirects = redirects.filter((r) => {
      const to = r.to.split('#')[0];
      const why = taken.has(r.from) ? 'its address is a page of the site' : froms.has(r.from) ? 'another redirect has its address' : !published.has(to) ? `${r.to} isn't a published page` : sealed.has(to) ? `${r.to} is a private page (V25)` : null;
      froms.add(r.from);
      if (why) warnings.push(`redirect ${r.from} → ${r.to} is skipped: ${why}`);
      return !why;
    });

    // the grants (V26, V29, V30): each well formed; its scope names what exists
    const ACCESS = 'private/access.json';
    const sectionIds = new Set(routes.filter((r) => r.node.kind === 'hub' && r.path !== '/').map((r) => r.node.id));
    const protectedPages = routes.flatMap((r) => (r.node.kind === 'item' && r.access !== 'open' ? [{ id: r.node.item.id, section: r.parent?.id, access: 'private' as const }] : []));
    const now = new Date();
    const grantIds = new Set<string>();
    const names = new Map<string, string>();
    grants.forEach((g, i) => {
      const at = `grants.${i}`;
      for (const problem of checkGrant(g)) add(ACCESS, problem, at);
      if (grantIds.has(g.id)) add(ACCESS, `grant ${g.id} is listed twice: a grant's ID is never reused (V29)`, `${at}.id`);
      grantIds.add(g.id);
      if (g.kind === 'code' && g.name && isValid(g, now)) {
        if (names.has(g.name)) add(ACCESS, `the code name "${g.name}" is also ${names.get(g.name)}'s: a code's name is unique among codes that work (V29)`, `${at}.name`);
        names.set(g.name, g.id);
      }
      (g.scope.sections ?? []).forEach((s, j) => {
        if (!sectionIds.has(s)) add(ACCESS, `"${s}" isn't a section of the site (V26)`, `${at}.scope.sections.${j}`);
      });
      (g.scope.pages ?? []).forEach((pid, j) => {
        const page = protectedPages.find((p) => p.id === pid);
        // a page left out because it doesn't pass its own check is reported there, not here
        if (!page && !invalidArticles.has(pid) && !invalidAlbums.has(pid)) add(ACCESS, `"${pid}" isn't a private page (V26)`, `${at}.scope.pages.${j}`);
      });
      if (!covers(g, protectedPages).length && isValid(g, now)) warnings.push(`grant ${g.id} opens no page`);
    });
  }

  const index: ContentIndex = { site: site!, structure: structure!, articles, albums, origins, access, people, media, documents, videos, embeds, routes, canonical: canonicalPaths(routes), redirects, planet, ways, overlay, grants, accessMessage: message, themes, fonts, recommendations, showcase, github, highlights, topics, warnings, problems: [] };
  for (const i of checkHighlights(index, new Set([...invalidArticles, ...invalidAlbums]))) add(i.file, i.message, i.path);
  // the home page (documentation/home-views/foundation.md §2): what the spine names is open and found word for word;
  // a page already failing its own check isn't reported again through it
  if (site && structure) for (const i of checkHome(index, ways, invalidArticles)) add(i.file, i.message, i.path);
  // the ways in (V33 to V37, documentation/desktop/modes.md §6), once the rest holds: a mode's structure that
  // already fails its own check (the planet's V14 to V16) isn't reported twice
  if (!issues.length && site && structure) {
    const structures: Record<string, unknown> = {};
    for (const [id, mode] of BUILTIN_MODES) {
      const at = [mode.structureFile, mode.legacyStructureFile].find((f) => f && docs[`/content/${f}`] !== undefined);
      if (at) structures[id] = docs[`/content/${at}`];
    }
    for (const i of checkModes({ modes: effectiveWays({ ways, hasPlanet: !!planet }), index, structures }).issues) add(i.file, `${i.message} (${i.rule})`);
  }
  if (issues.length) throw new ContentError(issues);
  return index;
}

/** An article's file, in either folder (its key as the source gives it). */
const ARTICLE_FILE = /^\/(content|private)\/articles\/[^/]+\.json$/;
/** An album's file, in either folder. */
const ALBUM_FILE = /^\/(content|private)\/albums\/[^/]+\.json$/;
/** What can be left out on its own: an article, an album, a piece of media (its sidecar or a file beside it), or the home page's spine or vocabulary (the home is then the Classic hub). */
const LEAVABLE = /^\/(content|private)\/(articles|albums|media)\/|^\/content\/(showcase|topics|highlights)\.json$/;

/**
 * The content as dev reads it (documentation/content/spec.md §5.4): a file that doesn't pass the check is left out
 * rather than failing every page, as long as it's one the rest can do without (an article, an album, a piece of media).
 * What only it causes goes with it, so it's read again until the rest holds; a problem in the site itself (its
 * settings, structure, people, the private overlay or grants) still fails, as it would every page. The issues of
 * what was left out come back as `problems`. A build never calls this: it uses loadContent, and stops.
 */
export function loadContentLeavingOut(docs: Record<string, unknown>, masters: Set<string>, readErrors: string[] = [], sizes: ReadonlyMap<string, number> = new Map()): ContentIndex {
  const leftOut = new Set<string>();
  const problems: Issue[] = [];
  const key = (file: string) => `/${file.replace(/^\//, '')}`;
  for (let round = 0; ; round++) {
    try {
      const keptMasters = new Set([...masters].filter((m) => !leftOut.has(m)));
      const keptErrors = readErrors.filter((e) => !leftOut.has(key(e.slice(0, e.indexOf(': ')))));
      const index = loadContent(docs, keptMasters, keptErrors, leftOut, sizes);
      return { ...index, problems };
    } catch (e) {
      if (!(e instanceof ContentError)) throw e;
      const leavable = e.issues.filter((i) => LEAVABLE.test(key(i.file)) && !leftOut.has(key(i.file)));
      // nothing more to leave out (or no end in sight): what's left is the site's own problem
      if (!leavable.length || round >= 8) throw problems.length ? new ContentError([...problems, ...e.issues]) : e;
      for (const i of leavable) leftOut.add(key(i.file));
      problems.push(...leavable);
    }
  }
}

/** A path on this site a link may go to: a page of the tree, or one of the code's own (the planet, the docs, the design library). */
export function isSitePath(href: string, routes: Route[]): boolean {
  const path = href.split('#')[0].split('?')[0];
  return routes.some((r) => r.path === path) || /^\/(play|docs|design)\//.test(path);
}

/** A heading's anchor from its words: lowercase, letters and digits, hyphens between words. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

/**
 * Every heading's anchor in a body, by its block's place (undefined for a block that isn't a heading). One
 * set by hand (`id`) is kept as it is; one made from its words takes -2, -3… when it's taken already, in the
 * page's order, so headings with the same words ("What shipped" in each chapter) each have their own, and the
 * first keeps the plain one.
 */
export function headingIds(body: readonly { type: string; text?: string; id?: string }[]): (string | undefined)[] {
  const taken = new Set(body.flatMap((b) => (b.type === 'heading' && b.id ? [b.id] : [])));
  return body.map((b) => {
    if (b.type !== 'heading') return undefined;
    if (b.id) return b.id;
    const base = headingId(b.text ?? '') || 'section';
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return id;
  });
}
