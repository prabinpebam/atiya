/**
 * A page's opening, as its kind reads (documentation/sections/spec.md §3.3): an article carries its
 * topic (its section, or the building it's read in on the planet), its byline, its date and its reading
 * time; a page opens with its words only; a gallery counts its pictures. The site's Page and the planet's
 * frame both open a page with it, so a page reads the same in both (§6.1).
 */
import { canonicalPath, content, documentHref, getAlbum, getPerson, getSite } from './repository';
import { picture, video } from './pictures';
import { cardPicture as albumCardPicture, type MediaLookup } from './album';
import { albumCells, albumDateWords, albumMeasure } from './albumPage';
import { renderMarkdown } from './markdown';
import { withBase } from '../design/meta';
import type { AlbumCell } from '../scripts/albumGrid';
import { pageMeasure } from './reading';
import { rankRelated } from '../scripts/related';
import type { Article, PictureDisplay } from './schema';
import type { PictureSource } from '../design/pictures';
import { thumbnailFor } from '../design/pictures';

/** Any piece of media by its ID: a picture or a video file (an album's items are either). */
const mediaLookup: MediaLookup = (id) => content().media.get(id) ?? content().videos.get(id);

/** A page's measure (reading.ts), and an album's counts in words ("18 pictures, 2 videos") for a page that holds one (gallery spec §7). */
export const measureOf = (a: Article): string | undefined => (a.album ? albumMeasure(a.album, mediaLookup) || undefined : pageMeasure(a));

/** A picture's dark mode version, as the components take it. */
const darkOf = (p: { dark?: { src: string; srcset: string; width: number; height: number; thumb: string; bg: string } }) => (p.dark ? { src: p.dark.src, srcset: p.dark.srcset, width: p.dark.width, height: p.dark.height, bg: p.dark.bg } : undefined);

/** A page's picture on cards: its thumbnail, or else its lead picture (an album's: its first raster item; gallery spec §5), shown as the page asks (whole by default; documentation/content/media.md §9), with its own square for a list's rows when it has one (§9.4). */
export async function cardPicture(a: Article) {
  const id = thumbnailFor(a, 'thumbnail') ?? (a.album ? albumCardPicture(a, mediaLookup) : undefined);
  if (!id) return undefined;
  const p = await picture(id, 'card');
  const dark = darkOf(p);
  const s = a.thumbnailStyle ?? {};
  const squareId = a.thumbnails?.square;
  const sq = squareId ? await picture(squareId, 'card') : undefined;
  const sqDark = sq && darkOf(sq);
  const square = sq && { src: sq.src, srcset: sq.srcset, alt: sq.alt, width: sq.width, height: sq.height, bg: sq.bg, ...(sqDark ? { dark: sqDark } : {}) };
  return { src: p.src, srcset: p.srcset, alt: p.alt, width: p.width, height: p.height, bg: p.bg, display: s.display ?? 'fit', background: !!s.background, rounded: s.rounded !== false, shadow: !!s.shadow, ...(dark ? { dark } : {}), ...(square ? { square } : {}) };
}

export interface Opening {
  title: string;
  standfirst?: string;
  topic?: { label: string; href?: string };
  author?: { name: string; avatar?: string; avatarDark?: string };
  date?: string;
  readingTime?: string;
  /** An album's span of dates in words, in place of the date (gallery spec §7). */
  dates?: string;
  picture?: { src: string; srcset?: string; alt: string; width: number; height: number; caption?: string; credit?: string; display?: PictureDisplay; bg?: string; background?: boolean; rounded?: boolean; shadow?: boolean; dark?: PictureSource };
  /** The person the page is about, whole, beside the title. */
  portrait?: { src: string; srcset?: string; alt: string; width: number; height: number; focus?: string; dark?: PictureSource };
}

/** A story (an article, a talk) opens with a byline; a page and a gallery with their words only. (A drop cap is a paragraph's own choice.) */
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
      return { id, href: p.href, title: p.article.title, dek: p.article.summary, meta: measureOf(p.article), ...(picture ? { picture } : {}) };
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
    readingTime: measureOf(article),
    ...(article.album ? { dates: albumDateWords(article.album, mediaLookup, article.publishedAt) } : {}),
    picture: lead ? { ...lead, display: article.hero?.display ?? 'fill', background: !!article.hero?.background, rounded: article.hero?.rounded !== false, shadow: !!article.hero?.shadow, dark: darkOf(lead) } : undefined,
    ...(portrait ? { portrait: { src: portrait.src, srcset: portrait.srcset, alt: portrait.alt, width: portrait.width, height: portrait.height, focus: portrait.focus, dark: darkOf(portrait) } } : {}),
  };
}


/** An album page's album, as ArticleLayout draws it (gallery spec §7): its introduction and every item as a cell. */
export interface AlbumView {
  title: string;
  /** The album's introduction, as HTML. */
  introduction?: string;
  layout: 'grid' | 'story';
  captions: boolean;
  items: AlbumCell[];
}

/** A `ref:` link in an album's words, as the body's blocks resolve it (Blocks.astro). */
const resolveRef = (ref: string) => {
  if (ref.startsWith('media/')) return documentHref(ref.slice('media/'.length));
  const [type, id] = ref.split('/');
  const path = canonicalPath(type, id);
  return path && withBase(path);
};

/** The album a page holds, ready for its page (undefined for a page without one). A Story's pictures are drawn at the wide width, a Grid's at the gallery's. */
export async function albumOf(article: Article): Promise<AlbumView | undefined> {
  const resolved = getAlbum(article.id);
  if (!resolved) return undefined;
  const { album, items } = resolved;
  const layout = album.layout ?? 'grid';
  const slot = layout === 'story' ? 'wide' : 'gallery';
  return {
    title: article.title,
    ...(album.description ? { introduction: renderMarkdown(album.description, { resolveRef }) } : {}),
    layout,
    captions: album.captions === true,
    items: await albumCells(album, items, { pictureOf: (id) => picture(id, slot), videoOf: (id) => video(id, slot), resolveRef }),
  };
}