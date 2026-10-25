/**
 * Topics (documentation/sections/spec.md §3.8): what a page is about, from the site's topic vocabulary
 * (content/topics.json), shown as tags on its card and its opening, and browsed at `/topics/` and
 * `/topics/<id>/`. Pure: the repository hands in the vocabulary and the pages a visitor can open.
 */
import type { TopicsFile } from '../home/schema';

/** How many topic tags a card or an opening shows: the page's first ones, in its own order. */
export const TOPIC_TAGS_SHOWN = 3;

/** The topics index's path (without the base), reserved in routes.ts. */
export const TOPICS_PATH = '/topics/';

/** A topic's page (without the base). */
export const topicPath = (id: string) => `${TOPICS_PATH}${id}/`;

/** A topic with a page: the open, published pages about it, newest first. */
export interface TopicPage {
  id: string;
  label: string;
  path: string;
  /** Its pages' IDs, newest first. */
  pages: string[];
}

/** A tag on a card or an opening: a link when its topic has a page. */
export interface TopicTag {
  id: string;
  label: string;
  href?: string;
}

/** A page as topics see it: its ID, its topics and when it was published. */
export interface TaggedPage {
  id: string;
  topics?: string[];
  publishedAt?: string;
}

type Vocabulary = Pick<TopicsFile, 'topics'> | null;

/** A topic's label: the vocabulary's, else its ID in words ("team-culture": "Team culture"). */
export function topicLabel(id: string, vocab: Vocabulary): string {
  const known = vocab?.topics.find((t) => t.id === id)?.label;
  if (known) return known;
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Every topic at least one of `pages` is about, each with its pages newest first (then by ID), the topics
 * with the most pages first, then by label. Pass only pages a visitor can open: open and published.
 */
export function topicPages(vocab: Vocabulary, pages: TaggedPage[]): TopicPage[] {
  const byTopic = new Map<string, TaggedPage[]>();
  for (const p of pages) for (const t of new Set(p.topics ?? [])) byTopic.set(t, [...(byTopic.get(t) ?? []), p]);
  const newest = (a: TaggedPage, b: TaggedPage) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.id.localeCompare(b.id);
  return [...byTopic.entries()]
    .map(([id, ps]) => ({ id, label: topicLabel(id, vocab), path: topicPath(id), pages: [...ps].sort(newest).map((p) => p.id) }))
    .sort((a, b) => b.pages.length - a.pages.length || a.label.localeCompare(b.label));
}

/** Words compared loosely: case, spaces and punctuation, and a plural's s ("Side projects" is "side project"). */
const same = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').replace(/s$/, '');

/**
 * A page's topic tags: its first `max` topics, in its own order, leaving out any that only repeats where the
 * page already sits (`omit`: its section's name, said once already, by the section's own tag or page). A tag
 * links to its topic's page when `href` is given and the topic has one; on the planet, where a page can't
 * leave its building, pass no `href`.
 */
export function topicTags(
  topics: string[] | undefined,
  vocab: Vocabulary,
  pages: readonly TopicPage[],
  options: { omit?: string[]; max?: number; href?: (path: string) => string } = {},
): TopicTag[] {
  const { omit = [], max = TOPIC_TAGS_SHOWN, href } = options;
  const left = new Set(omit.map(same));
  const withPage = new Map(pages.map((p) => [p.id, p]));
  const synonyms = (id: string) => vocab?.topics.find((t) => t.id === id)?.synonyms ?? [];
  return [...new Set(topics ?? [])]
    .map((id) => ({ id, label: topicLabel(id, vocab) }))
    .filter((t) => ![t.id, t.label, ...synonyms(t.id)].some((w) => left.has(same(w))))
    .slice(0, max)
    .map((t) => {
      const page = withPage.get(t.id);
      return page && href ? { ...t, href: href(page.path) } : t;
    });
}
