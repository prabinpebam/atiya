/**
 * The evidence index (documentation/home-views/curation.md §3): one row per open page the home page may use as
 * proof, with the signals the rules read (its section, topics, words, kind of proof, date, depth, picture, links in).
 * Built from the content index alone, never by drawing pages. Pure.
 */
import type { ContentIndex } from '../content/load';
import { plainText } from '../content/markdown';
import type { Recommendation } from '../content/recommendations';
import type { Article, Contribution, PageKind } from '../content/schema';
import { toRef } from './schema';
import { thumbnailFor, type ThumbnailShape } from '../design/pictures';

/** One page that may prove a strength. */
export interface Evidence {
  ref: string;
  id: string;
  title: string;
  summary: string;
  /** The section it's in (a hub under the home), if it's in one. */
  section?: string;
  topics: string[];
  /** Its kind of proof: the person's part, else what its kind of page implies; none for a plain page. */
  kind?: Contribution;
  /** When the work was published (else last updated), as ms since 1970, and its year. */
  time: number;
  year: number;
  words: number;
  figures: number;
  /** Numbers in its words (a "3,530 people" is a result), years left out. */
  numbers: number;
  /** 0 to 1: about 1,500 words, or 6 figures and numbers, is 1. */
  depth: number;
  /** Its wide card picture (a media ID; media.md §9.4): its own, else its lead picture, else its thumbnail. */
  picture?: string;
  /** Its card picture in each shape (media IDs; media.md §9.4), for a view that frames it otherwise (Bento's tiles). */
  pictures?: Partial<Record<ThumbnailShape, string>>;
  /** How many other open pages point at it. */
  linksIn: number;
  stale: boolean;
  /** Its words, normalised (normalise), for matching. */
  text: { title: string; summary: string; headings: string[]; body: string };
}

export interface EvidenceIndex {
  pages: Evidence[];
  byId: Map<string, Evidence>;
  /** Every open page's ID, the ones that aren't proof (the résumé, contact and privacy pages) too. */
  open: Set<string>;
  /** Each section's title, by its hub's ID. */
  sections: Map<string, string>;
  /** The topics open pages use. */
  topicsInUse: Set<string>;
  /** The recommendations the site shows. */
  recommendations: Recommendation[];
  /** The résumé page's ID and its words, normalised, when the site names an open one. */
  resume?: { id: string; text: string };
  /** The newest date in the content: "now" for recency, so the same content scores the same on any day. */
  now: number;
}

const KIND_OF_PAGE: Partial<Record<PageKind, Contribution>> = { note: 'wrote', talk: 'spoke' };

/** A page's kind of proof (curation §2): the person's part, else its kind's (a note wrote, a talk spoke). */
export const kindOf = (a: Pick<Article, 'contribution' | 'kind'>): Contribution | undefined => a.contribution ?? KIND_OF_PAGE[a.kind];

/** Words as matched and checked: lower case, curly quotes made straight, white space collapsed. */
export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** A page's headings and the rest of its words, as plain text (the same words its reading time counts). */
export function pageTexts(a: Article): { headings: string[]; body: string[] } {
  const headings: string[] = [];
  const body: string[] = [];
  for (const b of a.body) {
    if (b.type === 'text') body.push(plainText(b.markdown));
    else if (b.type === 'heading' || b.type === 'subheading') headings.push(b.text);
    else if (b.type === 'quote') body.push(b.text);
    else if (b.type === 'collection') body.push(...b.items.map((i) => [i.when, i.heading, i.subtext, i.text && plainText(i.text)].filter(Boolean).join(' ')));
    else if (b.type === 'table') body.push(b.caption ?? '', ...b.columns.map((c) => plainText(c)), ...b.rows.flat().map((c) => plainText(c)));
  }
  return { headings, body };
}

/** All of a page's words, normalised: what a résumé line, a quote or a fact is found in. */
export function fullText(a: Article): string {
  const { headings, body } = pageTexts(a);
  return normalise([a.title, a.summary, ...headings, ...body].join(' '));
}

const YEAR = /^(19|20)\d\d$/;
const countNumbers = (s: string) => (s.match(/\d[\d,.]*\d|\d/g) ?? []).filter((n) => !YEAR.test(n)).length;
const countWords = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const PAGE_LINK = /ref:article\/([a-z0-9]+(?:-[a-z0-9]+)*)/g;

/** Is a page open: published, public, placed on the site with open access, from the public folder. */
export function isOpenPage(index: Pick<ContentIndex, 'articles' | 'origins' | 'routes'>, id: string): boolean {
  const a = index.articles.get(id);
  if (!a || index.origins.get(id) !== 'public' || a.visibility !== 'public') return false;
  return index.routes.some((r) => r.node.kind === 'item' && r.node.item.id === id && r.published && r.access === 'open');
}

/** The page a node of the site names, when it's a page (the résumé, contact and privacy settings name nodes). */
export const pageOfNode = (index: Pick<ContentIndex, 'routes'>, node?: string) => {
  const r = node ? index.routes.find((x) => x.node.id === node) : undefined;
  return r?.node.kind === 'item' ? r.node.item.id : undefined;
};

export function buildEvidence(index: Pick<ContentIndex, 'articles' | 'origins' | 'routes' | 'site' | 'recommendations'>): EvidenceIndex {
  const root = index.routes.find((r) => r.path === '/')?.node.id;
  const sections = new Map<string, string>();
  for (const r of index.routes) if (r.node.kind === 'hub' && r.path !== '/') sections.set(r.node.id, r.title);

  const open = new Set<string>();
  const placed = new Map<string, string | undefined>();
  for (const r of index.routes) {
    if (r.node.kind !== 'item' || !r.published || r.access !== 'open') continue;
    const id = r.node.item.id;
    const a = index.articles.get(id);
    if (!a || index.origins.get(id) !== 'public' || a.visibility !== 'public') continue;
    open.add(id);
    placed.set(id, r.parent && r.parent.id !== root ? r.parent.id : undefined);
  }

  const resumeId = pageOfNode(index, index.site.resumePage);
  const notProof = new Set([resumeId, pageOfNode(index, index.site.contactPage), pageOfNode(index, index.site.privacyPage)].filter(Boolean));

  // links in: other open pages whose related list or words point at a page, each counted once
  const linkedBy = new Map<string, Set<string>>();
  for (const id of open) {
    const a = index.articles.get(id)!;
    const targets = new Set((a.related ?? []).filter((r) => r.type === 'article').map((r) => r.id));
    for (const m of JSON.stringify(a.body).matchAll(PAGE_LINK)) targets.add(m[1]);
    for (const t of targets) if (t !== id) (linkedBy.get(t) ?? linkedBy.set(t, new Set()).get(t)!).add(id);
  }

  const pages: Evidence[] = [];
  const topicsInUse = new Set<string>();
  let now = 0;
  for (const id of [...open].sort()) {
    const a = index.articles.get(id)!;
    for (const t of a.topics ?? []) topicsInUse.add(t);
    if (notProof.has(id)) continue;
    const { headings, body } = pageTexts(a);
    const words = countWords([a.title, a.summary, ...headings, ...body].join(' '));
    const figures = new Set(a.body.flatMap((b) => (b.type === 'figure' ? [b.media] : b.type === 'gallery' || b.type === 'carousel' ? b.items.map((i) => i.media) : []))).size;
    const numbers = countNumbers([a.title, a.summary, ...body].join(' '));
    const time = Date.parse(a.publishedAt ?? a.updatedAt);
    now = Math.max(now, time, Date.parse(a.updatedAt));
    pages.push({
      ref: toRef(id),
      id,
      title: a.title,
      summary: a.summary,
      section: placed.get(id),
      topics: a.topics ?? [],
      kind: kindOf(a),
      time,
      year: new Date(time).getUTCFullYear(),
      words,
      figures,
      numbers,
      depth: Math.min(1, Math.max(words / 1500, (figures + numbers) / 6)),
      picture: thumbnailFor(a, 'wide'),
      ...(thumbnailFor(a, 'wide') ? { pictures: { wide: thumbnailFor(a, 'wide'), thumbnail: thumbnailFor(a, 'thumbnail'), square: thumbnailFor(a, 'square') } } : {}),
      linksIn: linkedBy.get(id)?.size ?? 0,
      stale: a.status === 'stale',
      text: { title: normalise(a.title), summary: normalise(a.summary), headings: headings.map(normalise), body: normalise(body.join(' ')) },
    });
  }
  const resumeArticle = resumeId && open.has(resumeId) ? index.articles.get(resumeId) : undefined;
  return {
    pages,
    byId: new Map(pages.map((p) => [p.id, p])),
    open,
    sections,
    topicsInUse,
    recommendations: index.recommendations.filter((r) => !r.hidden),
    resume: resumeArticle ? { id: resumeArticle.id, text: fullText(resumeArticle) } : undefined,
    now,
  };
}
