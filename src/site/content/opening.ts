/**
 * A page's opening, as its kind reads (documentation/sections/spec.md §3.3): an article carries its
 * topic (its section, or the building it's read in on the planet), its byline, its date and its reading
 * time; a page opens with its words only; a gallery counts its pictures. The site's Page and the planet's
 * frame both open a page with it, so a page reads the same in both (§6.1).
 */
import { getPerson, getSite } from './repository';
import { picture } from './pictures';
import { pageMeasure } from './reading';
import { rankRelated } from '../scripts/related';
import type { Article } from './schema';

/** A picture's dark mode version, as the components take it. */
const darkOf = (p: { dark?: { src: string; srcset: string; width: number; height: number; thumb: string } }) => (p.dark ? { src: p.dark.src, srcset: p.dark.srcset, width: p.dark.width, height: p.dark.height } : undefined);

/** A page's picture on cards: its thumbnail, or else its lead picture. Cards show it whole (documentation/content/media.md §9). */
export async function cardPicture(a: Article) {
  const id = a.thumbnail ?? a.hero?.media;
  if (!id) return undefined;
  const p = await picture(id, 'card');
  const dark = darkOf(p);
  return { src: p.src, srcset: p.srcset, alt: p.alt, width: p.width, height: p.height, ...(dark ? { dark } : {}) };
}

export interface Opening {
  title: string;
  standfirst?: string;
  topic?: { label: string; href?: string };
  author?: { name: string; avatar?: string; avatarDark?: string };
  date?: string;
  readingTime?: string;
  picture?: { src: string; srcset?: string; alt: string; width: number; height: number; caption?: string; credit?: string; dark?: { src: string; srcset?: string; width: number; height: number } };
  /** The person the page is about, whole, beside the title. */
  portrait?: { src: string; srcset?: string; alt: string; width: number; height: number; focus?: string; dark?: { src: string; srcset?: string; width: number; height: number } };
}

/** A story (an article, a talk) opens with a byline and a drop cap; a page and a gallery with their words only. */
export const storyKind = (a: Pick<Article, 'kind'>) => a.kind === 'note' || a.kind === 'talk';

/**
 * The related stories to suggest at the end of a page (documentation/sections/spec.md §3.7): the other
 * stories in `pool` (on the site, every published one; on the planet, the building's), ranked (related.ts)
 * and made into cards, best first. The reader's browser picks the ones it hasn't read yet.
 */
export async function relatedOf(article: Article, section: string | undefined, pool: { article: Article; href: string; section?: string }[]) {
  const ranked = rankRelated(
    { id: article.id, kind: article.kind, topics: article.topics, section, publishedAt: article.publishedAt, related: article.related?.map((r) => r.id) },
    pool.map((p) => ({ id: p.article.id, kind: p.article.kind, topics: p.article.topics, section: p.section, publishedAt: p.article.publishedAt })),
  );
  const stories = await Promise.all(
    ranked.map(async (id) => {
      const p = pool.find((x) => x.article.id === id)!;
      const picture = await cardPicture(p.article);
      return { id, href: p.href, title: p.article.title, dek: p.article.summary, meta: pageMeasure(p.article), ...(picture ? { picture } : {}) };
    }),
  );
  return { current: article.id, stories };
}

/** @param topic where the page sits: its section on the site, or its building on the planet */
export async function openingOf(article: Article, topic?: { label: string; href: string }): Promise<Opening> {
  const owner = getPerson(getSite().owner)!;
  const hero = article.hero && (await picture(article.hero.media, 'wide'));
  const avatar = owner.avatar ? await picture(owner.avatar, 'card') : undefined;
  const portrait = article.portrait ? await picture(article.portrait, 'card') : undefined;
  const lead = hero && (article.hero?.showCaption === false ? { ...hero, caption: undefined, credit: undefined } : { ...hero, caption: article.hero?.caption ?? hero.caption, credit: article.hero?.credit ?? hero.credit });
  const story = storyKind(article);
  return {
    title: article.title,
    standfirst: article.summary,
    // an article carries its topic, byline and date; a page and a gallery open with their words only
    topic: story ? topic : undefined,
    author: story ? { name: owner.name, avatar: avatar?.thumb, ...(avatar?.dark ? { avatarDark: avatar.dark.thumb } : {}) } : undefined,
    date: story ? article.publishedAt : undefined,
    readingTime: pageMeasure(article),
    picture: lead ? { ...lead, dark: darkOf(lead) } : undefined,
    ...(portrait ? { portrait: { src: portrait.src, srcset: portrait.srcset, alt: portrait.alt, width: portrait.width, height: portrait.height, focus: portrait.focus, dark: darkOf(portrait) } } : {}),
  };
}
