/**
 * What edit mode's screens read (documentation/editor/spec.md §2): the content, validated, or its issues
 * when a file was broken by hand (the screens show them rather than fail), and the summaries they list.
 */
import { content } from '../../content/repository';
import { ContentError, isPublished, type ContentIndex, type Issue } from '../../content/load';
import { picture, video } from '../../content/pictures';
import type { Article } from '../../content/schema';
import { hubs } from '../model/structure';
import { ownerLabel, ownerOf, references } from '../model/references';
import { withBase } from '../../design/meta';

export { references, type Reference } from '../model/references';

export type Loaded = { ok: true; index: ContentIndex } | { ok: false; issues: Issue[] };

export function load(): Loaded {
  try {
    return { ok: true, index: content() };
  } catch (e) {
    if (e instanceof ContentError) return { ok: false, issues: e.issues };
    throw e;
  }
}

/** How a section, or a building, lists its pages (documentation/sections/spec.md §3.4). */
export const VIEW_OPTIONS = [
  { value: 'list', label: 'List', description: 'Rows of titles, words first' },
  { value: 'tiles', label: 'Tiles', description: 'An even grid of cards' },
  { value: 'bento', label: 'Bento', description: 'A lead, then halves and thirds' },
  { value: 'features', label: 'Features', description: 'Every page a lead: picture beside its words' },
];

const KIND_LABEL: Record<Article['kind'], string> = { note: 'Article', page: 'Page', gallery: 'Gallery', talk: 'Talk' };

/** A page as the Sections and Planet screens list it. */
export interface ListedPage {
  id: string;
  title: string;
  /** Article, Page, Gallery or Talk. */
  kind: string;
  /** Its status, as the Pages screen names it, and the tag's tone. */
  status: string;
  tone: 'positive' | 'neutral' | 'highlight';
  published: boolean;
  /** Its editor. */
  href: string;
}

export function listedPage(index: ContentIndex, id: string): ListedPage {
  const a = index.articles.get(id);
  const published = !!a && isPublished(a);
  const status = a?.status ?? 'draft';
  return {
    id,
    title: a?.title ?? id,
    kind: KIND_LABEL[a?.kind ?? 'note'],
    status: published ? STATUS_LABEL.published : STATUS_LABEL[status],
    tone: published ? 'positive' : status === 'draft' ? 'neutral' : 'highlight',
    published,
    href: withBase(`/_edit/articles/${id}/`),
  };
}

export interface ArticleRow {
  id: string;
  title: string;
  kind: Article['kind'];
  status: Article['status'];
  published: boolean;
  updatedAt: string;
  /** The hub that places it, or null. */
  section: { id: string; title: string } | null;
  /** Its path on the site (published), or null. */
  path: string | null;
}

export function articleRows(index: ContentIndex): ArticleRow[] {
  return [...index.articles.values()]
    .map((a) => {
      const route = index.routes.find((r) => r.node.kind === 'item' && r.node.item.type === 'article' && r.node.item.id === a.id);
      return {
        id: a.id,
        title: a.title,
        kind: a.kind,
        status: a.status,
        published: isPublished(a),
        updatedAt: a.updatedAt,
        section: route?.parent ? { id: route.parent.id, title: route.parent.title } : null,
        path: route?.published ? route.path : null,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
}

/** The sections a page can go in, for a select: every section (a page never sits directly under the home page: V22). */
export function sectionOptions(index: ContentIndex) {
  return hubs(index.structure)
    .filter((h) => h.depth === 1)
    .map((h) => ({ value: h.id, label: h.title, description: h.path }));
}

export interface LibraryPicture {
  id: string;
  /** A picture, or a video file (media.md §12). */
  kind: 'image' | 'video';
  owner: string;
  ownerLabel: string;
  /** Its thumbnail (a video's poster frame); empty for a video without one. */
  thumb: string;
  src: string;
  /** A picture's alt text; a video's title. */
  alt: string;
  decorative: boolean;
  width: number;
  height: number;
  /** Something refers to it (an article in any state, a person, the site settings). */
  used: boolean;
  /** It has a dark mode version. */
  dark?: boolean;
  /** A video's length (s). */
  duration?: number;
}

/** Every picture and video, for the library and the picker: grouped by folder (the article being edited first, when there is one). */
export async function mediaCards(index: ContentIndex, first?: string): Promise<LibraryPicture[]> {
  const refs = references(index);
  const pictures = await Promise.all(
    [...index.media.values()].map(async (m): Promise<LibraryPicture> => {
      const p = await picture(m.id, 'card');
      const owner = ownerOf(m.id);
      return { id: m.id, kind: 'image', owner, ownerLabel: ownerLabel(index, owner), thumb: p.thumb, src: p.src, alt: m.alt ?? '', decorative: !!m.decorative, width: p.width, height: p.height, used: refs.has(m.id), ...(m.darkMaster ? { dark: true } : {}) };
    }),
  );
  const videos = await Promise.all(
    [...index.videos.values()].map(async (v): Promise<LibraryPicture> => {
      const f = await video(v.id, 'card');
      const owner = ownerOf(v.id);
      return { id: v.id, kind: 'video', owner, ownerLabel: ownerLabel(index, owner), thumb: f.poster?.thumb ?? '', src: f.src, alt: v.title, decorative: false, width: v.width, height: v.height, used: refs.has(v.id), ...(v.duration ? { duration: v.duration } : {}) };
    }),
  );
  const cards = [...pictures, ...videos];
  const rank = (c: LibraryPicture) => (c.owner === first ? 0 : 1);
  return cards.sort((a, b) => rank(a) - rank(b) || a.ownerLabel.localeCompare(b.ownerLabel) || a.id.localeCompare(b.id));
}

export const STATUS_LABEL: Record<Article['status'], string> = {
  draft: 'Draft',
  factReview: 'Fact review',
  editorialReview: 'Editorial review',
  approved: 'Approved',
  published: 'Published',
  stale: 'Due for review',
  archived: 'Archived',
};
