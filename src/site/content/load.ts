/**
 * Validates the mock API's files and indexes them (the files adapter's second half: the first reads
 * the files, source.ts). Every problem is collected and named by file and field, so one build run lists
 * them all. Pure: the files and the list of media masters come in as arguments, so tests can feed it.
 */
import type { z } from 'astro/zod';
import { PLACE_IDS, accessFile, accessMessage, article, documentMedia, imageMedia, overlay as overlaySchema, person, planetStructure, redirects as redirectList, siteSettings, siteStructure, videoMedia, type AccessMessage, type Article, type DocumentMedia, type GrantRecord, type ImageMedia, type Overlay, type Person, type PlanetStructure, type Redirect, type SiteNode, type SiteSettings, type SiteStructure, type VideoMedia } from './schema';
import { buildRoutes, canonicalPaths, withOverlay, type Access, type Route } from './routes';
import { checkGrant, covers, isValid } from '../access/grants.ts';

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
  origin: Origin;
}

export interface ContentIndex {
  site: SiteSettings;
  /** The public site structure, as written (the editor's and the navigation's). */
  structure: SiteStructure;
  articles: Map<string, Article>;
  /** Where each article comes from. */
  origins: Map<string, Origin>;
  /** Each placed article's access (open or private); an unplaced one isn't in it. */
  access: Map<string, Access>;
  people: Map<string, Person>;
  media: Map<string, MediaRecord>;
  /** Files to download (PDFs), by media ID: linked with `ref:media/<id>`. */
  documents: Map<string, DocumentRecord>;
  /** Video files, by media ID: shown by a video block's `media`. */
  videos: Map<string, VideoRecord>;
  /** Every node's route, drafts included (their `published` is false); only published ones are built. Private pages included. */
  routes: Route[];
  /** Canonical paths of published items, keyed `type/id`. */
  canonical: Map<string, string>;
  /** Old addresses sent on to new ones (V19): built as redirect pages. */
  redirects: Redirect[];
  /** The planet's buildings and what each holds (documentation/sections/spec.md §5), if the file is there. */
  planet: PlanetStructure | null;
  /** The private overlay: private pages in their sections (null without private-pages/). */
  overlay: Overlay | null;
  /** The grants (private-pages/access.json), empty without private-pages/. */
  grants: GrantRecord[];
  /** The message offered with a new grant. */
  accessMessage: AccessMessage | null;
  /** Reported, not failed: a published item the site doesn't place (it has no page). */
  warnings: string[];
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

/** Every picture's media ID a document uses, and every gallery's and carousel's item (a picture or a video file); a video block's file isn't here: see videosUsed. */
export function mediaUsed(a: Article): string[] {
  const ids = a.hero ? [a.hero.media] : [];
  if (a.thumbnail) ids.push(a.thumbnail);
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
 */
export function loadContent(docs: Record<string, unknown>, masters: Set<string>, readErrors: string[] = []): ContentIndex {
  const issues: Issue[] = readErrors.map((e) => {
    const at = e.indexOf(': ');
    return { file: e.slice(0, at), message: e.slice(at + 2) };
  });
  const add = (file: string, message: string, path?: string) => issues.push({ file: file.replace(/^\//, ''), message, ...(path ? { path } : {}) });
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
  const articles = new Map<string, Article>();
  const origins = new Map<string, Origin>();
  const people = new Map<string, Person>();
  const media = new Map<string, MediaRecord>();
  const documents = new Map<string, DocumentRecord>();
  const videos = new Map<string, VideoRecord>();
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
    if (file === '/content/site.json') site = parse(siteSettings, file, data);
    else if (file === '/content/structures/site.json') structure = parse(siteStructure, file, data);
    else if (file === '/content/redirects.json') redirects = parse(redirectList, file, data) ?? [];
    else if (file === '/content/structures/planet.json') planet = parse(planetStructure, file, data) ?? null;
    else if (file === '/private/structures/overlay.json') overlay = parse(overlaySchema, file, data) ?? null;
    else if (file === '/private/access.json') grants = parse(accessFile, file, data)?.grants ?? [];
    else if (file === '/private/access-message.json') message = parse(accessMessage, file, data) ?? null;
    else if ((m = /^\/(content|private)\/articles\/[^/]+\.json$/.exec(file))) {
      const a = parse(article, file, data);
      if (a && a.id !== name) add(file, `id "${a.id}" must match the file name`, 'id');
      else if (a && articles.has(a.id)) add(file, `article "${a.id}" is in both content/ and private-pages/: an ID is unique across both (V24)`, 'id');
      else if (a) {
        articles.set(a.id, a);
        origins.set(a.id, m[1] === 'private' ? 'private' : 'public');
      }
    } else if (/^\/content\/people\/[^/]+\.json$/.test(file)) {
      const p = parse(person, file, data);
      if (p && p.id !== name) add(file, `id "${p.id}" must match the file name`, 'id');
      else if (p) people.set(p.id, p);
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
        else if (claimMedia(file, mediaKey)) videos.set(mediaKey, { ...v, id: mediaKey, master, ...(posterMaster ? { posterMaster } : {}), origin });
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
      else if (claimMedia(file, mediaKey))
        media.set(mediaKey, {
          ...s,
          id: mediaKey,
          master,
          ...(darkMaster ? { darkMaster } : {}),
          ...(posterMaster ? { posterMaster } : {}),
          ...(darkPosterMaster ? { darkPosterMaster } : {}),
          origin,
        });
    } else add(file, 'not a resource the content model knows');
  }
  for (const master of masters) {
    const darkPoster = /\.dark\.poster\.\w+$/.test(master);
    const dark = !darkPoster && /\.dark\.\w+$/.test(master);
    const poster = !darkPoster && /\.poster\.\w+$/.test(master);
    const sidecar = master.replace(darkPoster ? /\.dark\.poster\.\w+$/ : dark ? /\.dark\.\w+$/ : poster ? /\.poster\.\w+$/ : /\.\w+$/, '.json');
    const doc = docs[sidecar] as { kind?: string; poster?: { file?: string }; animation?: { poster?: string }; dark?: { file?: string; animation?: { poster?: string } } } | null;
    if (!(sidecar in docs)) add(master, `a master without its sidecar (${sidecar.split('/').pop()})`);
    else if (darkPoster && doc?.dark?.animation?.poster !== master.split('/').pop()) add(master, `a dark animation poster its picture doesn't name (add it as "dark.animation" in ${sidecar.split('/').pop()}, or delete it)`);
    else if (dark && doc?.dark?.file !== master.split('/').pop()) add(master, `a dark version its picture doesn't name (add it as "dark" in ${sidecar.split('/').pop()}, or delete it)`);
    else if (poster && (doc?.kind === 'video' ? doc.poster?.file : doc?.animation?.poster) !== master.split('/').pop())
      add(master, `a poster its ${doc?.kind === 'video' ? 'video' : 'picture'} doesn't name (add it to ${sidecar.split('/').pop()}, or delete it)`);
  }
  if (!site) add('content/site.json', 'missing');
  if (!structure) add('content/structures/site.json', 'missing');

  // references (V3, V5): media, people; a public page never points at anything private (V25), and a
  // protected page's own `related` names open pages only (V32)
  const needMedia = (from: string, id: string, origin: Origin = 'public', orVideo = false) => {
    const rec = media.get(id) ?? (orVideo ? videos.get(id) : undefined);
    if (!rec) add(from, orVideo ? `media "${id}" doesn't exist (a picture or a video file)` : `media "${id}" doesn't exist`);
    else if (!PUBLIC.has(rec.visibility)) add(from, `media "${id}" isn't public`);
    else if (rec.origin === 'private' && origin === 'public') add(from, `media "${id}" is private (in private-pages/): an open page can't show it (V25)`);
  };
  for (const a of articles.values()) {
    const origin = origins.get(a.id)!;
    const file = `${origin === 'private' ? 'private' : 'content'}/articles/${a.id}.json`;
    // a gallery's or a carousel's item can be a video file too; every other use is a picture
    const either = new Set(a.body.flatMap((b) => (b.type === 'gallery' || b.type === 'carousel' ? b.items.map((it) => it.media) : [])));
    for (const id of mediaUsed(a)) needMedia(file, id, origin, either.has(id));
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
  }
  for (const p of people.values()) if (p.avatar) needMedia(`content/people/${p.id}.json`, p.avatar);
  if (site?.socialImage) needMedia('content/site.json', site.socialImage);
  if (site && !people.has(site.owner)) add('content/site.json', `owner "${site.owner}" isn't in content/people/`, 'owner');

  let routes: Route[] = [];
  const access = new Map<string, Access>();
  const warnings: string[] = [];
  const OVERLAY = 'private/structures/overlay.json';
  if (structure) {
    const lookup = (type: string, id: string) => {
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
      if (!articles.has(id)) return;
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
    for (const e of built.errors) add([...merged.private].some((id) => e.startsWith(`node ${id}:`)) ? OVERLAY : 'content/structures/site.json', e);
    routes = built.routes;
    for (const r of routes) if (r.node.kind === 'item') access.set(r.node.item.id, r.access);
    const placed = canonicalPaths(routes);
    for (const a of articles.values()) if (isPublished(a) && !placed.has(`article/${a.id}`)) warnings.push(`article "${a.id}" is published but the site structure doesn't place it, so it has no page (V12)`);

    // the navigation (V17): every entry points at a node of the tree, or at a real address; never a protected page (V25)
    const STRUCTURE_FILE = 'content/structures/site.json';
    for (const field of ['contactPage', 'privacyPage'] as const) {
      const node = site?.[field];
      if (!node) continue;
      const r = routes.find((x) => x.node.id === node);
      if (!r) add('content/site.json', `${field} "${node}" isn't a node of the site's tree`, field);
      else if (r.access !== 'open') add('content/site.json', `${field} "${node}" is a private page (V25)`, field);
    }
    (structure.menus?.primary ?? []).forEach((e, i) => {
      const at = `menus.primary.${i}`;
      if ('node' in e) {
        const r = routes.find((x) => x.node.id === e.node);
        if (!r) add(STRUCTURE_FILE, `node "${e.node}" isn't in the site's tree`, at);
        else if (r.access !== 'open') add(STRUCTURE_FILE, `node "${e.node}" is a private page: the navigation names open ones only (V25)`, at);
      } else if (e.href.startsWith('/') && !isSitePath(e.href, routes.filter((x) => x.access === 'open'))) add(STRUCTURE_FILE, `${e.href} isn't a page of this site`, at);
    });
    // the planet (V14 to V16): each building once, each showing a section of the site, and a section shown by one
    // building at most. What a building holds follows its section, so it's on the site by construction (V13, V15)
    if (planet) {
      const PLANET = 'content/structures/planet.json';
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
        if (!page) add(ACCESS, `"${pid}" isn't a private page (V26)`, `${at}.scope.pages.${j}`);
      });
      if (!covers(g, protectedPages).length && isValid(g, now)) warnings.push(`grant ${g.id} opens no page`);
    });
  }

  if (issues.length) throw new ContentError(issues);
  return { site: site!, structure: structure!, articles, origins, access, people, media, documents, videos, routes, canonical: canonicalPaths(routes), redirects, planet, overlay, grants, accessMessage: message, warnings };
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
