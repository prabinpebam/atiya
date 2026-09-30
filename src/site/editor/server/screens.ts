/**
 * What edit mode's screens read (documentation/editor/spec.md §2): the content, validated, or its issues
 * when a file was broken by hand (the screens show them rather than fail), and the summaries they list.
 */
import { content } from '../../content/repository';
import { ContentError, isPublished, type ContentIndex, type Issue } from '../../content/load';
import type { Article } from '../../content/schema';
import { hubs } from '../model/structure';

export type Loaded = { ok: true; index: ContentIndex } | { ok: false; issues: Issue[] };

export function load(): Loaded {
  try {
    return { ok: true, index: content() };
  } catch (e) {
    if (e instanceof ContentError) return { ok: false, issues: e.issues };
    throw e;
  }
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

/** The sections an article can go in, for a select: every hub, indented by depth. */
export function sectionOptions(index: ContentIndex) {
  return hubs(index.structure).map((h) => ({ value: h.id, label: `${'\u2003'.repeat(h.depth)}${h.title}`, description: h.path }));
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
