/**
 * Articles, as edit mode changes them (documentation/editor/spec.md §3.5, §4, §9). The server owns what
 * must stay true: new IDs and slugs, the dates, and the section and building a page is placed in. A page's
 * address can change at any time (another section, another slug): the old one simply goes, with no redirect
 * (documentation/sections/spec.md §7.2). Every change is one store transaction.
 */
import { PLACE_IDS, article as articleSchema, type Article, type PlaceId, type PlanetStructure, type SiteStructure } from '../../content/schema';
import { placeOfPage, putIn, takeOff } from '../model/planet';
import { isPublished } from '../../content/load';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Change, type Result } from './store';
import { slugify, today, unique } from '../model/ids';
import { childSlugs, nodeIds, place, sectionOf, unplace } from '../model/structure';
import { isMeaningful } from '../model/ops';
import { readSnapshot } from '../../content/source';

export const STRUCTURE = '/content/structures/site.json';
export const PLANET = '/content/structures/planet.json';
export const articleKey = (id: string) => `/content/articles/${id}.json`;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const refuse = (file: string, message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file: file.replace(/^\//, ''), message, ...(path ? { path } : {}) }] });

function articles(): Map<string, Article> {
  const snap = readSnapshot();
  const out = new Map<string, Article>();
  for (const [key, value] of Object.entries(snap.docs)) {
    const m = /^\/content\/articles\/([^/]+)\.json$/.exec(key);
    if (m) out.set(m[1], value as Article);
  }
  return out;
}

export interface SaveArticle {
  id: string;
  article: Article;
  /** The section (hub id) to place it in, null to take it off the site; left out, it stays where it is. */
  section?: string | null;
  /** The building to put it in on the planet, null to take it off the planet; left out, it stays where it is. */
  place?: string | null;
  ifMatch: Record<string, string | null>;
}

export async function saveArticle(req: SaveArticle): Promise<Result & { article?: Article }> {
  const key = articleKey(req.id);
  const current = readDoc<Article>(key);
  if (!current) return refuse(key, "doesn't exist");
  let next: Article = { ...req.article, id: req.id };
  const was = current.value;

  if (next.kind === 'talk' && was.kind !== 'talk') return refuse(key, "can't become a talk until the content model holds a talk's event, date and recording", 'kind');

  // the dates the server keeps true (a date set by hand in the same change wins)
  if (isMeaningful(was, next) && next.updatedAt === was.updatedAt) next = { ...next, updatedAt: today() };
  if (isPublished(next) && !next.publishedAt) next = { ...next, publishedAt: today() };

  const changes: Change[] = [{ key, bytes: jsonBytes(next) }];
  const ifMatch: Record<string, string | null> = { [key]: req.ifMatch[key] ?? null };
  if (req.section !== undefined) {
    const s = readDoc<SiteStructure>(STRUCTURE);
    if (!s) return refuse(STRUCTURE, 'missing');
    const ref = { type: 'article', id: req.id };
    const now = sectionOf(s.value, ref);
    if (now !== req.section) {
      const moved = req.section === null ? unplace(s.value, ref) : place(s.value, req.section, ref, unique(req.id, nodeIds(unplace(s.value, ref))));
      changes.push({ key: STRUCTURE, bytes: jsonBytes(moved) });
      ifMatch[STRUCTURE] = req.ifMatch[STRUCTURE] ?? s.version;
    }
  }
  // on the planet: one transaction with the article and its section, so V13 (a page on the planet is on the
  // site) is checked on the result (documentation/sections/spec.md §7.6)
  if (req.place !== undefined) {
    const planet = readDoc<PlanetStructure>(PLANET);
    if (!planet) return refuse(PLANET, 'missing');
    if ((placeOfPage(planet.value, req.id) ?? null) !== req.place) {
      if (req.place !== null && !(PLACE_IDS as readonly string[]).includes(req.place)) return refuse(PLANET, `"${req.place}" isn't a building`, 'place');
      const moved = req.place === null ? takeOff(planet.value, req.id) : putIn(planet.value, req.place as PlaceId, req.id);
      changes.push({ key: PLANET, bytes: jsonBytes(moved) });
      ifMatch[PLANET] = req.ifMatch[PLANET] ?? planet.version;
    }
  }
  const r = await commit({ changes, ifMatch });
  return r.ok ? { ...r, article: next } : r;
}

export interface CreateArticle {
  title: string;
  summary: string;
  kind: 'page' | 'note' | 'gallery';
  section: string | null;
}

export async function createArticle(req: CreateArticle): Promise<Result & { id?: string }> {
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!s) return refuse(STRUCTURE, 'missing');
  const all = articles();
  const title = req.title.trim();
  if (!title) return refuse(articleKey('new'), 'needs a title', 'title');
  const base = slugify(title);
  const siblings = req.section ? childSlugs(s.value, req.section, (i) => all.get(i.id)?.slug) : new Set<string>();
  const id = unique(base, new Set([...all.keys(), ...siblings]));
  const doc: Article = {
    id,
    type: 'article',
    kind: req.kind,
    slug: id,
    title,
    summary: req.summary.trim(),
    status: 'draft',
    visibility: 'public',
    updatedAt: today(),
    locale: 'en',
    body: [],
  };
  const parsed = articleSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, status: 422, issues: parsed.error.issues.map((i) => ({ file: 'content/articles/new.json', path: i.path.join('.'), message: i.message })) };
  const changes: Change[] = [{ key: articleKey(id), bytes: jsonBytes(doc) }];
  const ifMatch: Record<string, string | null> = { [articleKey(id)]: null };
  if (req.section) {
    changes.push({ key: STRUCTURE, bytes: jsonBytes(place(s.value, req.section, { type: 'article', id }, unique(id, nodeIds(s.value)))) });
    ifMatch[STRUCTURE] = s.version;
  }
  const r = await commit({ changes, ifMatch });
  return r.ok ? { ...r, id } : r;
}

export async function duplicateArticle(id: string): Promise<Result & { id?: string }> {
  const src = readDoc<Article>(articleKey(id));
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!src || !s) return refuse(articleKey(id), "doesn't exist");
  const all = articles();
  const section = sectionOf(s.value, { type: 'article', id });
  const siblings = section ? childSlugs(s.value, section, (i) => all.get(i.id)?.slug) : new Set<string>();
  const copyId = unique(`${id}-copy`, new Set([...all.keys(), ...siblings]));
  const { publishedAt: _p, reviewedAt: _r, ...rest } = src.value;
  const doc: Article = { ...rest, id: copyId, slug: copyId, title: `${src.value.title} (copy)`, status: 'draft', updatedAt: today() };
  const changes: Change[] = [{ key: articleKey(copyId), bytes: jsonBytes(doc) }];
  const ifMatch: Record<string, string | null> = { [articleKey(copyId)]: null };
  if (section) {
    changes.push({ key: STRUCTURE, bytes: jsonBytes(place(s.value, section, { type: 'article', id: copyId }, unique(copyId, nodeIds(s.value)))) });
    ifMatch[STRUCTURE] = s.version;
  }
  const r = await commit({ changes, ifMatch });
  return r.ok ? { ...r, id: copyId } : r;
}

/** Deletes a draft (and its node); with `withMedia`, also the pictures in its own folder that nothing else uses. */
export async function deleteArticle(id: string, withMedia: boolean, ifMatch: Record<string, string | null>): Promise<Result> {
  if (!ID.test(id)) return refuse(articleKey(id), 'not an article id');
  const key = articleKey(id);
  const cur = readDoc<Article>(key);
  const s = readDoc<SiteStructure>(STRUCTURE);
  if (!cur || !s) return refuse(key, "doesn't exist");
  if (isPublished(cur.value)) return refuse(key, 'is published: unpublish it (set its status back to Draft) before deleting it', 'status');
  const changes: Change[] = [{ key, bytes: null }];
  const match: Record<string, string | null> = { [key]: ifMatch[key] ?? cur.version };
  if (sectionOf(s.value, { type: 'article', id })) {
    changes.push({ key: STRUCTURE, bytes: jsonBytes(unplace(s.value, { type: 'article', id })) });
    match[STRUCTURE] = ifMatch[STRUCTURE] ?? s.version;
  }
  // off the planet too, in the same transaction (a page on the planet needs its page on the site: V13)
  const planet = readDoc<PlanetStructure>(PLANET);
  if (planet && placeOfPage(planet.value, id)) {
    changes.push({ key: PLANET, bytes: jsonBytes(takeOff(planet.value, id)) });
    match[PLANET] = ifMatch[PLANET] ?? planet.version;
  }
  if (withMedia) {
    const snap = readSnapshot();
    const others = JSON.stringify(Object.entries(snap.docs).filter(([k]) => k !== key));
    const folder = `/content/media/articles/${id}/`;
    const seen = new Set<string>();
    for (const master of snap.masters) {
      if (!master.startsWith(folder)) continue;
      // a picture's master and its dark version are one picture: deleted together, with their sidecar
      const mediaId = master.slice('/content/media/'.length).replace(/(?:\.dark)?\.\w+$/, '');
      if (others.includes(`"${mediaId}"`)) continue;
      const sidecar = `/content/media/${mediaId}.json`;
      if (!seen.has(sidecar)) {
        seen.add(sidecar);
        changes.push({ key: sidecar, bytes: null });
        match[sidecar] = readDoc(sidecar)?.version ?? null;
      }
      changes.push({ key: master, bytes: null });
      match[master] = versionOf(readFile(master));
    }
  }
  return commit({ changes, ifMatch: match });
}
