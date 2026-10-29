/**
 * A page's opening, as its kind reads (documentation/sections/spec.md §3.3): an article carries its
 * topic (its section, or the building it's read in on the planet), its byline, its date and its reading
 * time; a page opens with its words only; an album (its own resource: documentation/gallery/spec.md §7) counts
 * its items and gives the span of their dates. The site's Page and the planet's frame both open a page with it,
 * so a page reads the same in both (§6.1).
 */
import { albumLookup, canonicalPath, captionHrefs, getAlbum, getPerson, getSite, tagsOf } from './repository';
import { embedPoster, mediaLinkTargets, picture, video } from './pictures';
import { mediaLinkIds, refResolver } from './mediaLinks';
import { coverPicture } from './album';
import { albumCells, albumDateWords, albumMeasure, itemFragment } from './albumPage';
import { renderMarkdown } from './markdown';
import { withBase } from '../design/meta';
import type { AlbumEntry } from '../scripts/albumGrid';
import { pageMeasure } from './reading';
import { rankRelated } from '../scripts/related';
import type { Album, Article, PictureDisplay } from './schema';
import type { PictureSource } from '../design/pictures';
import { thumbnailFor } from '../design/pictures';

/** A page's measure (reading.ts). */
export const measureOf = (a: Article): string | undefined => pageMeasure(a);

/** An album's measure on its cards and in its opening: its counts in words ("18 pictures, 2 videos"; gallery spec §7). */
export const albumMeasureOf = (album: Album): string | undefined => albumMeasure(album, albumLookup()) || undefined;

/** A picture's dark mode version, as the components take it. */
const darkOf = (p: { dark?: { src: string; srcset: string; width: number; height: number; thumb: string; bg: string } }) => (p.dark ? { src: p.dark.src, srcset: p.dark.srcset, width: p.dark.width, height: p.dark.height, bg: p.dark.bg } : undefined);

/** A page's picture on cards: its thumbnail, or else its lead picture, shown as the page asks (whole by default; documentation/content/media.md §9), with its own square for a list's rows when it has one (§9.4). */
export async function cardPicture(a: Article) {
  const id = thumbnailFor(a, 'thumbnail');
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
  /** What it's about: its topic tags (topics.ts), linked to their pages on the site. */
  topics?: { label: string; href?: string }[];
  /** An album's span of dates in words, in place of the date (gallery spec §7). */
  dates?: string;
  picture?: { src: string; srcset?: string; alt: string; width: number; height: number; caption?: string; credit?: string; display?: PictureDisplay; bg?: string; background?: boolean; rounded?: boolean; shadow?: boolean; dark?: PictureSource };
  /** The person the page is about, whole, beside the title. */
  portrait?: { src: string; srcset?: string; alt: string; width: number; height: number; focus?: string; dark?: PictureSource };
}

/** A story (an article, a talk) opens with a byline; a page with its words only. (A drop cap is a paragraph's own choice.) */
export const storyKind = (a: Pick<Article, 'kind'>) => a.kind === 'note' || a.kind === 'talk';

/**
 * The related stories to suggest at the end of a page (documentation/sections/spec.md §3.7): the other
 * stories in `pool` (on the site, every published one; on the planet, the building's), ranked (related.ts)
 * and made into cards, best first. The reader's browser picks the ones it hasn't read yet.
 */
export async function relatedOf(article: Article, section: string | undefined, pool: { article: Article; href: string; section?: string }[], linked = true) {
  const ranked = rankRelated(
    { id: article.id, kind: article.kind, topics: article.topics, section, publishedAt: article.publishedAt, related: article.related?.map((r) => r.id) },
    pool.map((p) => ({ id: p.article.id, kind: p.article.kind, topics: p.article.topics, section: p.section, publishedAt: p.article.publishedAt })),
  );
  const stories = await Promise.all(
    ranked.map(async (id) => {
      const p = pool.find((x) => x.article.id === id)!;
      const picture = await cardPicture(p.article);
      const topics = tagsOf(p.article, undefined, linked);
      return { id, href: p.href, title: p.article.title, dek: p.article.summary, meta: measureOf(p.article), ...(topics.length ? { topics } : {}), ...(picture ? { picture } : {}) };
    }),
  );
  return { current: article.id, stories };
}

/**
 * @param topic where the page sits: its section on the site, or its building on the planet
 * @param linked whether its topic tags link to their pages (not on the planet, where a page stays in its building)
 */
export async function openingOf(article: Article, topic?: { label: string; href: string }, linked = true): Promise<Opening> {
  const owner = getPerson(getSite().owner)!;
  const hero = article.hero && (await picture(article.hero.media, 'wide'));
  const avatar = owner.avatar ? await picture(owner.avatar, 'card') : undefined;
  const portrait = article.portrait ? await picture(article.portrait, 'card') : undefined;
  const lead = hero && (article.hero?.showCaption === false ? { ...hero, caption: undefined, credit: undefined } : { ...hero, caption: article.hero?.caption ?? hero.caption, credit: article.hero?.credit ?? hero.credit });
  const story = storyKind(article);
  return {
    title: article.title,
    standfirst: article.summary,
    // an article carries its topic, byline and date; a page opens with its words only
    topic: story ? topic : undefined,
    author: story ? { name: owner.name, avatar: avatar?.thumb, ...(avatar?.dark ? { avatarDark: avatar.dark.thumb } : {}) } : undefined,
    date: story ? article.publishedAt : undefined,
    readingTime: measureOf(article),
    topics: story ? tagsOf(article, topic?.label, linked) : undefined,
    picture: lead ? { ...lead, display: article.hero?.display ?? 'fill', background: !!article.hero?.background, rounded: article.hero?.rounded !== false, shadow: !!article.hero?.shadow, dark: darkOf(lead) } : undefined,
    ...(portrait ? { portrait: { src: portrait.src, srcset: portrait.srcset, alt: portrait.alt, width: portrait.width, height: portrait.height, focus: portrait.focus, dark: darkOf(portrait) } } : {}),
  };
}


/**
 * An album's picture on cards (gallery spec §3.6): its cover picture (a video's or a linked video's poster),
 * shown whole. Undefined for an album with nothing to show.
 */
export async function albumCardOf(album: Album) {
  const cover = coverPicture(album, albumLookup());
  if (!cover) return undefined;
  if (cover.kind === 'video') {
    const v = await video(cover.media, 'card');
    const p = v.poster;
    return p ? { src: p.src, srcset: p.srcset, alt: '', width: p.width, height: p.height, display: 'fit' as const, background: false, rounded: true, shadow: false } : undefined;
  }
  const p = cover.kind === 'embed' ? await embedPoster(cover.media, 'card') : await picture(cover.media, 'card');
  const dark = darkOf(p);
  return { src: p.src, srcset: p.srcset, alt: cover.kind === 'embed' ? '' : p.alt, width: p.width, height: p.height, bg: p.bg, display: 'fit' as const, background: false, rounded: true, shadow: false, ...(dark ? { dark } : {}) };
}

/**
 * An album's social picture (gallery spec §14): its cover picture, never a drawing, at the wide width; undefined
 * for an album with nothing to show.
 */
export async function albumSocialOf(album: Album): Promise<{ src: string; alt: string } | undefined> {
  const cover = coverPicture(album, albumLookup(), { social: true });
  if (!cover) return undefined;
  if (cover.kind === 'video') {
    const v = await video(cover.media, 'wide');
    return v.poster ? { src: v.poster.src, alt: v.title } : undefined;
  }
  if (cover.kind === 'embed') {
    const p = await embedPoster(cover.media, 'wide');
    return { src: p.src, alt: p.alt };
  }
  const p = await picture(cover.media, 'wide');
  // an animated picture's still frame, so the card shows a picture
  return { src: p.poster ?? p.src, alt: p.alt };
}

/** An album's opening (gallery spec §7): its title, its summary as the standfirst, its counts and the span of its dates; no byline. */
export function albumOpening(album: Album, topic?: { label: string; href: string }): Opening {
  const lookup = albumLookup();
  const dates = albumDateWords(album, lookup, album.publishedAt ?? album.createdAt);
  return {
    title: album.title,
    ...(album.summary ? { standfirst: album.summary } : {}),
    ...(topic ? { topic } : {}),
    readingTime: albumMeasure(album, lookup) || undefined,
    ...(dates ? { dates } : {}),
  };
}

/** An album, as AlbumLayout draws it (gallery spec §7): its introduction and every item as a cell, its text cards between them. */
export interface AlbumView {
  id: string;
  title: string;
  /** The album's introduction, as HTML. */
  introduction?: string;
  layout: 'grid' | 'story';
  captions: boolean;
  items: AlbumEntry[];
}

/** A `ref:` link in an album's words, as the body's blocks resolve it (Blocks.astro): a library item from `links`, else a page. */
const resolverOf = (links: Awaited<ReturnType<typeof mediaLinkTargets>>) =>
  refResolver(links, (type, id) => {
    const path = canonicalPath(type, id);
    return path && withBase(path);
  });

/** An album, ready for its page (undefined for no such album). A Story's pictures are drawn at the wide width, a Grid's at the gallery's. */
export async function albumOf(albumId: string): Promise<AlbumView | undefined> {
  const resolved = getAlbum(albumId);
  if (!resolved) return undefined;
  const { album, items } = resolved;
  const layout = album.layout ?? 'grid';
  const slot = layout === 'story' ? 'wide' : 'gallery';
  // its words and its items' (on their sidecars) can link to the library
  const resolveRef = resolverOf(await mediaLinkTargets(mediaLinkIds(JSON.stringify([album, items]))));
  return {
    id: album.id,
    title: album.title,
    ...(album.description ? { introduction: renderMarkdown(album.description, { resolveRef, fragment: itemFragment(album) }) } : {}),
    layout,
    captions: album.captions === true,
    items: await albumCells(album, items, { pictureOf: (id) => picture(id, slot), videoOf: (id) => video(id, slot), posterOf: (id) => embedPoster(id, slot), resolveRef, tracksOf: captionHrefs }),
  };
}
