/**
 * Links to the library (documentation/content/media.md §11.1): a text link written `ref:media/<id>` goes to
 * any item of it. A file to download goes to its file; a picture, a video file and a linked video open in
 * the page's lightbox (the link carries what the lightbox needs, as a figure's does), and without it the
 * link still goes to the picture at its full size, the video's file or the video's own page. Pure: the
 * pictures' addresses are worked out before the words are rendered (`mediaLinkTargets` in pictures.ts),
 * since rendering is synchronous.
 */
import type { LinkTarget } from './markdown';

/** A link to a library item in Markdown (or in a document's JSON, where Markdown is kept as it's written). */
export const MEDIA_LINK = /\]\(ref:media\/([a-z0-9/-]+)\)/g;

/** The library items a text links to, each once, in the order they're first linked. */
export const mediaLinkIds = (text: string): string[] => [...new Set([...text.matchAll(MEDIA_LINK)].map((m) => m[1]))];

/** The lightbox group of a link to `id`: its own, so a picture linked from the words opens alone. */
export const linkGroup = (id: string) => `link:${id}`;

/** What a picture's link needs: its address at its full size (its largest when it's kept large), and its lightbox data. */
export function pictureLink(
  id: string,
  p: { full?: string; src: string; thumb?: string; alt: string; caption?: string; largest?: { src: string }; dark?: { full?: string; src: string; thumb?: string } },
): LinkTarget {
  return {
    href: p.largest?.src ?? p.full ?? p.src,
    data: {
      lightbox: linkGroup(id),
      thumb: p.thumb ?? p.src,
      alt: p.alt,
      caption: p.caption,
      fullDark: p.dark ? (p.dark.full ?? p.dark.src) : undefined,
      thumbDark: p.dark ? (p.dark.thumb ?? p.dark.src) : undefined,
    },
  };
}

/** What a video file's link needs: its file, and its poster and type for the lightbox's player. */
export function videoLink(id: string, v: { src: string; type: string; title: string; duration?: number; poster?: { src: string; thumb: string } }): LinkTarget {
  return {
    href: v.src,
    data: {
      lightbox: linkGroup(id),
      kind: 'video',
      alt: v.title,
      videoType: v.type,
      poster: v.poster?.src,
      thumb: v.poster?.thumb,
      duration: v.duration ? String(v.duration) : undefined,
    },
  };
}

/** What a linked video's link needs: its page on YouTube or Vimeo, and the player the lightbox plays it in. */
export function embedLink(id: string, e: { page: string; player: string; title: string; poster: { full?: string; src: string; thumb?: string } }): LinkTarget {
  return {
    href: e.page,
    data: { lightbox: linkGroup(id), kind: 'embed', alt: e.title, embedSrc: e.player, poster: e.poster.full ?? e.poster.src, thumb: e.poster.thumb ?? e.poster.src },
  };
}

/**
 * A ref: link's target: a library item from `links` (made by `mediaLinkTargets`), else a page or an album
 * by its canonical address (`pathOf`, with the base). Undefined for anything unknown (an error when rendered).
 */
export function refResolver(links: ReadonlyMap<string, LinkTarget>, pathOf: (type: string, id: string) => string | undefined): (ref: string) => LinkTarget | string | undefined {
  return (ref) => {
    if (ref.startsWith('media/')) return links.get(ref.slice('media/'.length));
    const [type, id] = ref.split('/');
    return pathOf(type, id);
  };
}
