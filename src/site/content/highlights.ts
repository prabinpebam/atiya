/**
 * The classic home's owner-picked slides (home-views/highlights.md). Pure, shared by the loader, repository
 * and editor. A saved public pick may wait for publication, but a private or missing source is an error.
 */
import { z } from 'astro/zod';
import { carouselPresentation, mediaId, PICTURE_DISPLAYS } from './schema';
import { thumbnailFor } from '../design/pictures';
import type { ContentIndex, Issue } from './load';
import { coverPicture } from './album';
import { fullText, normalise } from '../home/evidence';

export const HIGHLIGHTS_FILE = 'highlights.json';
export const HIGHLIGHT_MAX = 12;
const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase kebab-case');
/** A slide's picture can also be stretched to its frame, out of its own shape (highlights spec §2.2). */
export const SLIDE_DISPLAYS = [...PICTURE_DISPLAYS, 'stretch'] as const;
export type SlideDisplay = (typeof SLIDE_DISPLAYS)[number];
/** A slide's own picture look: true puts the picture's edge colour behind it, a #RRGGBB colour that colour. */
export const slidePictureStyle = z.strictObject({
  display: z.enum(SLIDE_DISPLAYS).optional(),
  background: z.union([z.boolean(), z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'a colour as #RRGGBB')]).optional(),
  rounded: z.boolean().optional(),
  shadow: z.boolean().optional(),
});
export type SlidePictureStyle = z.infer<typeof slidePictureStyle>;
const highlightItem = z.discriminatedUnion('type', [
  z.strictObject({ id, type: z.literal('custom'), custom: z.literal('github') }),
  z.strictObject({ id, type: z.literal('article'), article: id, text: z.string().trim().min(1).max(280).optional(), picture: mediaId.optional(), pictureStyle: slidePictureStyle.optional() }),
  z.strictObject({ id, type: z.literal('album'), album: id, show: z.literal('cover').optional(), picture: mediaId.optional(), pictureStyle: slidePictureStyle.optional() }),
  z.strictObject({ id, type: z.literal('image'), media: mediaId, pictureStyle: slidePictureStyle.optional() }),
]);

export const highlightsFile = z.strictObject({
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  ...carouselPresentation,
  items: z.array(highlightItem).max(HIGHLIGHT_MAX),
}).superRefine((value, context) => {
  const ids = new Set<string>(), sources = new Set<string>();
  value.items.forEach((item, n) => {
    if (ids.has(item.id)) context.addIssue({ code: 'custom', path: ['items', n, 'id'], message: 'Each highlight needs a unique ID.' });
    const source = highlightSource(item);
    if (sources.has(source)) context.addIssue({ code: 'custom', path: ['items', n], message: 'This source is already highlighted. Choose it once.' });
    ids.add(item.id); sources.add(source);
    if (item.type === 'album' && item.show === 'cover' && (item.picture || item.pictureStyle)) {
      context.addIssue({ code: 'custom', path: ['items', n, 'show'], message: "A slide that shows the album's cover has no picture or look of its own. Remove them, or show one picture." });
    }
  });
});
export type Highlights = z.infer<typeof highlightsFile>;
export type HighlightItem = z.infer<typeof highlightItem>;
type Index = Pick<ContentIndex, 'articles' | 'albums' | 'media' | 'videos' | 'embeds' | 'origins' | 'routes' | 'github' | 'highlights'>;
export interface HighlightState {
  title: string;
  reason?: string;
  media?: string;
  href?: string;
  text?: string;
}
export interface HighlightCandidate {
  type: 'article' | 'album' | 'image';
  ref: string;
  title: string;
}

/** The custom slides a site can show: each one's title, and the label its pager thumbnail shows instead of a picture. */
export const CUSTOM_SLIDES = { github: { title: 'A year on GitHub', label: 'GitHub' } } as const;

/** A typed identity, separate from a slide's stable ID. */
export const highlightSource = (item: HighlightItem): string =>
  item.type === 'custom' ? `custom:${item.custom}` : item.type === 'article' ? `article:${item.article}` : item.type === 'album' ? `album:${item.album}` : `image:${item.media}`;

/** Legacy sites are unchanged; an explicit empty/disabled configuration never restores legacy content. */
export function defaultHighlights(index: Pick<Index, 'github' | 'highlights'>): Highlights {
  return index.highlights ?? {
    label: 'Highlights', enabled: true, peek: false, arrows: true, pager: 'dots',
    display: 'fill', background: false, rounded: true, shadow: false,
    items: index.github ? [{ id: 'github', type: 'custom', custom: 'github' }] : [],
  };
}

const publicImage = (index: Index, media: string) => {
  const image = index.media.get(media);
  return image && image.origin === 'public' && ['public', 'publicRedacted', 'summaryOnly'].includes(image.visibility);
};

/** Public image choices are also the automatic candidates; private metadata never reaches the picker. */
export function highlightImages(index: Pick<Index, 'media'>): Set<string> {
  return new Set([...index.media.values()].filter((m) =>
    m.origin === 'public' && ['public', 'publicRedacted', 'summaryOnly'].includes(m.visibility) && (!!m.alt || !!m.decorative),
  ).map((m) => m.id));
}

/** One picture resolution for the home, previews, validation and media usage. */
export function highlightPicture(index: Index, item: HighlightItem): string | undefined {
  if (item.type === 'custom') return undefined;
  if (item.type === 'image') return item.media;
  if (item.picture) return item.picture;
  if (item.type === 'album') return albumCover(index, item.album);
  const a = index.articles.get(item.article);
  if (!a) return undefined;
  const body = a.body.flatMap((b): string[] => {
    if (b.type === 'figure') return [b.media];
    if (b.type === 'gallery' || b.type === 'carousel') return b.items.map((i) => i.media);
    if (b.type === 'collection') return b.items.flatMap((i) => i.media ? [i.media] : []);
    if (b.type === 'video') return [...(b.poster ? [b.poster] : []), ...(b.media ? [b.media] : [])];
    return [];
  });
  const candidates = [thumbnailFor(a, 'wide'), a.hero?.media, a.thumbnail, ...body];
  return candidates.find((id): id is string => {
    const m = id && index.media.get(id);
    return !!id && ((!!m && !!publicImage(index, m.id) && (!!m.alt || !!m.decorative)) || publicPoster(index, id));
  });
}

/** An album slide that shows its arranged cover rather than one picture (highlights spec §2.3). */
export const showsCover = (item: HighlightItem): item is Extract<HighlightItem, { type: 'album' }> =>
  item.type === 'album' && item.show === 'cover';

/** Explicit false values stay explicit; absent slide values inherit the carousel. */
export function highlightPresentation(settings: Pick<Highlights, 'display' | 'background' | 'rounded' | 'shadow'>, item: HighlightItem): SlidePictureStyle {
  return { display: settings.display, background: settings.background, rounded: settings.rounded, shadow: settings.shadow, ...(item.type === 'custom' ? {} : item.pictureStyle) };
}

/** The album's existing cover rule, never a second guess at its first picture. */
function albumCover(index: Index, album: string): string | undefined {
  const source = index.albums.get(album);
  return source && coverPicture(source, (id) => index.media.get(id) ?? index.videos.get(id) ?? index.embeds.get(id))?.media;
}

/** A slide's current source words, image and address, or a precise reason it waits. No file/URL resolution. */
export function highlightState(index: Index, item: HighlightItem): HighlightState {
  if (item.type === 'custom') return { title: CUSTOM_SLIDES[item.custom].title, ...(!index.github ? { reason: 'Add a public GitHub snapshot first.' } : {}) };
  if (item.type === 'image') {
    const image = index.media.get(item.media);
    return { title: image?.caption || image?.alt || item.media, media: item.media, ...(!publicImage(index, item.media) ? { reason: 'Choose an existing public picture.' } : {}) };
  }
  const ref = item.type === 'article' ? item.article : item.album;
  const source = item.type === 'article' ? index.articles.get(ref) : index.albums.get(ref);
  if (!source || index.origins.get(ref) !== 'public' || ('visibility' in source && source.visibility !== 'public')) {
    return { title: 'Unavailable source', reason: 'Choose an existing public page or album.' };
  }
  const media = highlightPicture(index, item);
  const route = index.routes.find((r) => r.node.kind === 'item' && r.node.item.type === item.type && r.node.item.id === ref);
  const text = item.type === 'article' ? item.text ?? source.summary : source.summary;
  let reason: string | undefined;
  if (!route) reason = 'Place it in a section to show it.';
  else if (!route.published || route.access !== 'open') reason = 'Publish it to show it.';
  else if (!media) reason = item.type === 'article' ? 'Choose a slide picture or add a picture to the page.' : showsCover(item) ? 'Add a picture to the album to show its cover.' : 'Choose a slide picture or add a cover picture.';
  else if (!publicImage(index, media) && !publicPoster(index, media)) reason = 'Choose a public cover picture to show it.';
  return { title: source.title, text, media, href: route?.path, ...(reason ? { reason } : {}) };
}

/** The slides the home page shows now: none while turned off, and never one that waits (it has a reason). */
export function visibleHighlights(index: Index): { item: HighlightItem; state: HighlightState }[] {
  const settings = defaultHighlights(index);
  if (!settings.enabled) return [];
  return settings.items.map((item) => ({ item, state: highlightState(index, item) })).filter(({ state }) => !state.reason);
}

/** A video's/linked video's poster can stand for an album, never private or unpublishable media. */
function publicPoster(index: Index, id: string): boolean {
  const m = index.videos.get(id) ?? index.embeds.get(id);
  return !!m && m.origin === 'public' && ['public', 'publicRedacted', 'summaryOnly'].includes(m.visibility) && !!m.posterMaster;
}

/** Text-only choices: never private sources and never pictures generated on a screen's critical path. */
export function highlightCandidates(index: Index): HighlightCandidate[] {
  return [
    ...[...index.articles.values()].filter((a) => index.origins.get(a.id) === 'public' && a.visibility === 'public').map((a): HighlightCandidate => ({ type: 'article', ref: a.id, title: a.title })),
    ...[...index.albums.values()].filter((a) => index.origins.get(a.id) === 'public').map((a): HighlightCandidate => ({ type: 'album', ref: a.id, title: a.title })),
    ...[...index.media.values()].filter((m) => publicImage(index, m.id)).map((m): HighlightCandidate => ({ type: 'image', ref: m.id, title: m.caption || m.alt || m.id })),
  ].sort((a, b) => a.title.localeCompare(b.title) || a.ref.localeCompare(b.ref));
}

/** Validation is independent of enabled/publication state: references can never dangle or become private. */
export function checkHighlights(index: Index, skip: ReadonlySet<string> = new Set()): Issue[] {
  const issues: Issue[] = [];
  const add = (n: number, message: string) => issues.push({ file: `content/${HIGHLIGHTS_FILE}`, path: `items.${n}`, message });
  const alt = (n: number, id: string) => {
    const image = index.media.get(id);
    if (image?.kind === 'image' && !image.alt && !image.decorative) add(n, 'This highlighted picture needs alt text. Add it in Media, or mark a purely decorative picture decorative.');
  };
  index.highlights?.items.forEach((item, n) => {
    if (item.type === 'custom') return;
    if (item.type !== 'image' && item.picture) {
      if (!publicImage(index, item.picture)) add(n, 'This slide picture is missing or private. Choose a public picture or use automatic selection before deleting it or changing its access.');
      else alt(n, item.picture);
    }
    if (item.type === 'image') {
      if (!publicImage(index, item.media)) add(n, 'This highlighted picture is missing or private. Remove its highlight before deleting it or changing its access.');
      else alt(n, item.media);
      return;
    }
    const ref = item.type === 'article' ? item.article : item.album;
    if (skip.has(ref)) return;
    const source = item.type === 'article' ? index.articles.get(ref) : index.albums.get(ref);
    if (!source || index.origins.get(ref) !== 'public' || ('visibility' in source && source.visibility !== 'public')) {
      add(n, 'This highlighted source is missing or private. Remove its highlight before deleting it or changing its access.');
      return;
    }
    if (item.type === 'article' && item.text && !fullText(index.articles.get(ref)!).includes(normalise(item.text))) {
      add(n, 'The highlight text must come from the page word for word. Copy a short excerpt from it, or leave it empty to use its summary.');
    }
    const media = highlightPicture(index, item);
    if (media && !publicImage(index, media) && !publicPoster(index, media)) add(n, 'The highlighted lead or cover must be public. Choose a public picture or remove the highlight.');
    else if (media) alt(n, media);
  });
  return issues;
}

/** Direct/derived media usage, for the library's delete guards and usage reports. */
export function highlightMedia(index: Index): string[] {
  return [...new Set(index.highlights?.items.flatMap((item) => {
    return highlightPicture(index, item) ?? [];
  }) ?? [])];
}
