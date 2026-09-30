/**
 * Validates the mock API's files and indexes them (the files adapter's second half: the first reads
 * the files, source.ts). Every problem is collected and named by file and field, so one build run lists
 * them all. Pure: the files and the list of media masters come in as arguments, so tests can feed it.
 */
import type { z } from 'astro/zod';
import { article, imageMedia, person, redirects as redirectList, siteSettings, siteStructure, type Article, type ImageMedia, type Person, type Redirect, type SiteSettings, type SiteStructure } from './schema';
import { buildRoutes, canonicalPaths, type Route } from './routes';

export interface MediaRecord extends ImageMedia {
  /** The media ID: its path under content/media/ without the extension. */
  id: string;
  /** The master's path from the project root (/content/media/…). */
  master: string;
}

export interface ContentIndex {
  site: SiteSettings;
  structure: SiteStructure;
  articles: Map<string, Article>;
  people: Map<string, Person>;
  media: Map<string, MediaRecord>;
  /** Every node's route, drafts included (their `published` is false); only published ones are built. */
  routes: Route[];
  /** Canonical paths of published items, keyed `type/id`. */
  canonical: Map<string, string>;
  /** Old addresses sent on to new ones (V19): built as redirect pages. */
  redirects: Redirect[];
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

/** Every media ID a document uses. */
export function mediaUsed(a: Article): string[] {
  const ids = a.hero ? [a.hero.media] : [];
  for (const b of a.body) {
    if (b.type === 'figure') ids.push(b.media);
    else if (b.type === 'gallery' || b.type === 'carousel') ids.push(...b.items.map((i) => i.media));
    else if (b.type === 'video') ids.push(b.poster);
  }
  if (a.seo?.image) ids.push(a.seo.image);
  return ids;
}

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
  const articles = new Map<string, Article>();
  const people = new Map<string, Person>();
  const media = new Map<string, MediaRecord>();

  for (const [file, data] of Object.entries(docs).sort(([a], [b]) => a.localeCompare(b))) {
    const name = file.split('/').pop()!.replace(/\.json$/, '');
    let m: RegExpExecArray | null;
    if (file === '/content/site.json') site = parse(siteSettings, file, data);
    else if (file === '/content/structures/site.json') structure = parse(siteStructure, file, data);
    else if (file === '/content/redirects.json') redirects = parse(redirectList, file, data) ?? [];
    else if (/^\/content\/articles\/[^/]+\.json$/.test(file)) {
      const a = parse(article, file, data);
      if (a && a.id !== name) add(file, `id "${a.id}" must match the file name`, 'id');
      else if (a) articles.set(a.id, a);
    } else if (/^\/content\/people\/[^/]+\.json$/.test(file)) {
      const p = parse(person, file, data);
      if (p && p.id !== name) add(file, `id "${p.id}" must match the file name`, 'id');
      else if (p) people.set(p.id, p);
    } else if ((m = /^\/content\/media\/(.+)\.json$/.exec(file))) {
      const s = parse(imageMedia, file, data);
      if (!s) continue;
      const dir = file.slice(0, file.lastIndexOf('/') + 1);
      const master = dir + s.file;
      if (s.file.replace(/\.\w+$/, '') !== name) add(file, `the master "${s.file}" must share the sidecar's name`, 'file');
      else if (!masters.has(master)) add(file, `its master ${master.slice(1)} is missing`);
      else media.set(m[1], { ...s, id: m[1], master });
    } else add(file, 'not a resource the content model knows');
  }
  for (const master of masters) {
    const sidecar = master.replace(/\.\w+$/, '.json');
    if (!(sidecar in docs)) add(master, `a master without its sidecar (${sidecar.split('/').pop()})`);
  }
  if (!site) add('content/site.json', 'missing');
  if (!structure) add('content/structures/site.json', 'missing');

  // references (V3, V5): media, people
  const needMedia = (from: string, id: string) => {
    const rec = media.get(id);
    if (!rec) add(from, `media "${id}" doesn't exist`);
    else if (!PUBLIC.has(rec.visibility)) add(from, `media "${id}" isn't public`);
  };
  for (const a of articles.values()) {
    for (const id of mediaUsed(a)) needMedia(`content/articles/${a.id}.json`, id);
    const ids = new Set<string>();
    for (const b of a.body) if (b.type === 'heading') {
      const hid = b.id ?? headingId(b.text);
      if (ids.has(hid)) add(`content/articles/${a.id}.json`, `two headings share the anchor "${hid}"; give one an id`);
      ids.add(hid);
    }
  }
  for (const p of people.values()) if (p.avatar) needMedia(`content/people/${p.id}.json`, p.avatar);
  if (site?.socialImage) needMedia('content/site.json', site.socialImage);
  if (site && !people.has(site.owner)) add('content/site.json', `owner "${site.owner}" isn't in content/people/`, 'owner');

  let routes: Route[] = [];
  const warnings: string[] = [];
  if (structure) {
    const built = buildRoutes(structure, (type, id) => {
      const a = type === 'article' ? articles.get(id) : undefined;
      return a && { slug: a.slug, title: a.title, navLabel: a.navLabel, published: isPublished(a) };
    });
    routes = built.routes;
    for (const e of built.errors) add('content/structures/site.json', e);
    const placed = canonicalPaths(routes);
    for (const a of articles.values()) if (isPublished(a) && !placed.has(`article/${a.id}`)) warnings.push(`article "${a.id}" is published but the site structure doesn't place it, so it has no page (V12)`);

    // the navigation (V17): every entry points at a node of the tree, or at a real address
    const STRUCTURE_FILE = 'content/structures/site.json';
    (structure.menus?.primary ?? []).forEach((e, i) => {
      const at = `menus.primary.${i}`;
      if ('node' in e) {
        if (!routes.some((r) => r.node.id === e.node)) add(STRUCTURE_FILE, `node "${e.node}" isn't in the site's tree`, at);
      } else if (e.href.startsWith('/') && !isSitePath(e.href, routes)) add(STRUCTURE_FILE, `${e.href} isn't a page of this site`, at);
    });
    // redirects (V19): from an address nothing else has, to a page that's built
    const taken = new Set(routes.map((r) => r.path));
    const published = new Set(routes.filter((r) => r.published).map((r) => r.path));
    const froms = new Set<string>();
    redirects.forEach((r, i) => {
      if (taken.has(r.from)) add('content/redirects.json', `${r.from} is a page of the site; only an address that's gone can redirect`, `${i}.from`);
      if (froms.has(r.from)) add('content/redirects.json', `${r.from} redirects twice`, `${i}.from`);
      froms.add(r.from);
      if (!published.has(r.to.split('#')[0])) add('content/redirects.json', `${r.to} isn't a published page`, `${i}.to`);
    });
  }

  if (issues.length) throw new ContentError(issues);
  return { site: site!, structure: structure!, articles, people, media, routes, canonical: canonicalPaths(routes), redirects, warnings };
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
