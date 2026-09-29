/**
 * Validates the mock API's files and indexes them (the files adapter's second half: the first reads
 * the files, source.ts). Every problem is collected and named by file and field, so one build run lists
 * them all. Pure: the files and the list of media masters come in as arguments, so tests can feed it.
 */
import type { z } from 'astro/zod';
import { article, imageMedia, person, siteSettings, siteStructure, type Article, type ImageMedia, type Person, type SiteSettings, type SiteStructure } from './schema';
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
  routes: Route[];
  /** Canonical paths, keyed `type/id`. */
  canonical: Map<string, string>;
  /** Reported, not failed: a published item the site doesn't place (it has no page). */
  warnings: string[];
}

export class ContentError extends Error {
  constructor(readonly problems: string[]) {
    super(`The content in content/ has ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
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
 */
export function loadContent(docs: Record<string, unknown>, masters: Set<string>): ContentIndex {
  const problems: string[] = [];
  const parse = <T>(schema: z.ZodType<T>, file: string, data: unknown): T | undefined => {
    const r = schema.safeParse(data);
    if (r.success) return r.data;
    for (const issue of r.error.issues) problems.push(`${file.slice(1)}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return undefined;
  };

  let site: SiteSettings | undefined;
  let structure: SiteStructure | undefined;
  const articles = new Map<string, Article>();
  const people = new Map<string, Person>();
  const media = new Map<string, MediaRecord>();

  for (const [file, data] of Object.entries(docs).sort(([a], [b]) => a.localeCompare(b))) {
    const name = file.split('/').pop()!.replace(/\.json$/, '');
    let m: RegExpExecArray | null;
    if (file === '/content/site.json') site = parse(siteSettings, file, data);
    else if (file === '/content/structures/site.json') structure = parse(siteStructure, file, data);
    else if (/^\/content\/articles\/[^/]+\.json$/.test(file)) {
      const a = parse(article, file, data);
      if (a && a.id !== name) problems.push(`${file.slice(1)}: id "${a.id}" must match the file name`);
      else if (a) articles.set(a.id, a);
    } else if (/^\/content\/people\/[^/]+\.json$/.test(file)) {
      const p = parse(person, file, data);
      if (p && p.id !== name) problems.push(`${file.slice(1)}: id "${p.id}" must match the file name`);
      else if (p) people.set(p.id, p);
    } else if ((m = /^\/content\/media\/(.+)\.json$/.exec(file))) {
      const s = parse(imageMedia, file, data);
      if (!s) continue;
      const dir = file.slice(0, file.lastIndexOf('/') + 1);
      const master = dir + s.file;
      if (s.file.replace(/\.\w+$/, '') !== name) problems.push(`${file.slice(1)}: the master "${s.file}" must share the sidecar's name`);
      else if (!masters.has(master)) problems.push(`${file.slice(1)}: its master ${master.slice(1)} is missing`);
      else media.set(m[1], { ...s, id: m[1], master });
    } else problems.push(`${file.slice(1)}: not a resource the content model knows`);
  }
  for (const master of masters) {
    const sidecar = master.replace(/\.\w+$/, '.json');
    if (!(sidecar in docs)) problems.push(`${master.slice(1)}: a master without its sidecar (${sidecar.split('/').pop()})`);
  }
  if (!site) problems.push('content/site.json: missing');
  if (!structure) problems.push('content/structures/site.json: missing');

  // references (V3, V5): media, people
  const needMedia = (from: string, id: string) => {
    const rec = media.get(id);
    if (!rec) problems.push(`${from}: media "${id}" doesn't exist`);
    else if (!PUBLIC.has(rec.visibility)) problems.push(`${from}: media "${id}" isn't public`);
  };
  for (const a of articles.values()) {
    for (const id of mediaUsed(a)) needMedia(`content/articles/${a.id}.json`, id);
    const ids = new Set<string>();
    for (const b of a.body) if (b.type === 'heading') {
      const hid = b.id ?? headingId(b.text);
      if (ids.has(hid)) problems.push(`content/articles/${a.id}.json: two headings share the anchor "${hid}"; give one an id`);
      ids.add(hid);
    }
  }
  for (const p of people.values()) if (p.avatar) needMedia(`content/people/${p.id}.json`, p.avatar);
  if (site && !people.has(site.owner)) problems.push(`content/site.json: owner "${site.owner}" isn't in content/people/`);

  let routes: Route[] = [];
  const warnings: string[] = [];
  if (structure) {
    const built = buildRoutes(structure, (type, id) => {
      const a = type === 'article' ? articles.get(id) : undefined;
      return a && isPublished(a) ? { slug: a.slug, title: a.title, navLabel: a.navLabel } : undefined;
    });
    routes = built.routes;
    problems.push(...built.errors.map((e) => `content/structures/site.json: ${e}`));
    const placed = canonicalPaths(routes);
    for (const a of articles.values()) if (isPublished(a) && !placed.has(`article/${a.id}`)) warnings.push(`article "${a.id}" is published but the site structure doesn't place it, so it has no page (V12)`);
  }

  if (problems.length) throw new ContentError(problems);
  return { site: site!, structure: structure!, articles, people, media, routes, canonical: canonicalPaths(routes), warnings };
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
