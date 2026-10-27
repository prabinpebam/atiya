/**
 * What the album editor's viewer draws (documentation/gallery/spec.md §9.5): the item open, large, with its place
 * among the items shown (all of them, or in a review of alt text only the pictures that need it), its words as
 * they are on its sidecar (with the version the info panel saves against), this album's settings for it, where
 * else it's used, and its file's facts. Drawn only when the viewer's region is asked for, with `?item=`.
 */
import { statSync } from 'node:fs';
import type { Album } from '../../content/schema';
import type { ContentIndex } from '../../content/load';
import { albumOrder, isTextItem, itemKind, type ItemKind } from '../../content/album';
import { embedPoster, picture, video } from '../../content/pictures';
import { PROVIDERS } from '../../content/providers';
import { fileOf } from '../../content/source';
import { withBase } from '../../design/meta';
import { settingsOf } from '../model/album';
import { reviewIds, sizeWords, viewerStep, type ViewerItem, type ViewerUse } from '../model/albumViewer';
import { lookupOf } from './albums';
import { thumbOf } from './albumScreens';
import { usesOf } from './libraryIndex';
import { sidecarOf } from './media';

const KIND_WORDS: Record<ItemKind, string> = { picture: 'Picture', animated: 'Animated picture', drawing: 'Drawing', video: 'Video file', embed: 'Linked video', text: 'Text card' };
const lengthWords = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function bytesOf(master: string | undefined, known?: number): number | undefined {
  if (known) return known;
  if (!master) return undefined;
  try {
    return statSync(fileOf(master)).size;
  } catch {
    return undefined;
  }
}

/** The item `itemId` of the album as the viewer shows it (in a review, none: the first that needs alt text), or null when there's none. */
export async function viewerItem(index: ContentIndex, album: Album, asked: string, review: boolean): Promise<ViewerItem | null> {
  const lookup = lookupOf(index);
  const ordered = albumOrder(album, lookup);
  const needs = (i: (typeof ordered)[number]) => {
    if (isTextItem(i)) return false;
    const m = lookup(i.media);
    return m?.kind === 'image' && !m.alt && !m.decorative;
  };
  const cells = ordered.map((i) => ({ id: i.id, needsAlt: needs(i) }));
  const itemId = asked || (review ? (cells.find((c) => c.needsAlt)?.id ?? '') : '');
  const item = ordered.find((i) => i.id === itemId);
  if (!item) return null;
  const ids = review ? reviewIds(cells, itemId) : cells.map((c) => c.id);
  const step = viewerStep(ids, itemId)!;
  const base = { id: item.id, step, albumDownload: settingsOf(album).download === true, uses: [] as ViewerUse[], facts: [] as string[], needsAlt: needs(item), large: false };
  if (isTextItem(item)) return { ...base, kind: 'text', text: item.text, facts: [KIND_WORDS.text] };
  const kind: ViewerItem['kind'] = itemKind(item, lookup) ?? 'missing';
  const own = { ...(item.download !== undefined ? { download: item.download } : {}), ...(item.autoplay ? { autoplay: true } : {}), ...(item.loop ? { loop: true } : {}) };
  const doc = sidecarOf(item.media);
  const used = usesOf(index, item.media);
  const uses: ViewerUse[] = [
    ...used.albums.filter((a) => a.id !== album.id).map((a) => ({ title: a.title, href: withBase(`/_edit/albums/${a.id}/`), kind: 'album' as const, draft: a.status !== 'published' })),
    ...used.articles.map((a) => ({ title: a.title, href: withBase(`/_edit/articles/${a.id}/`), kind: 'page' as const, draft: a.status !== 'published' })),
  ];
  const strip = review
    ? await Promise.all(
        cells
          .filter((c) => c.needsAlt || c.id === itemId)
          .map(async (c) => {
            const i = ordered.find((o) => o.id === c.id)!;
            const t = isTextItem(i) ? { thumb: '', alt: '', width: 1, height: 1 } : await thumbOf(index, i.media);
            return { id: c.id, media: isTextItem(i) ? '' : i.media, thumb: t.thumb, alt: t.alt, width: t.width, height: t.height, current: c.id === itemId };
          }),
      )
    : undefined;
  const common = { ...base, ...own, kind, uses, ...(doc ? { media: { id: item.media, ...doc } } : {}), ...(strip ? { strip } : {}) };
  const facts: string[] = kind === 'missing' ? ['Missing from the library'] : [KIND_WORDS[kind]];
  try {
    const img = index.media.get(item.media);
    if (img) {
      const p = await picture(item.media, 'popout');
      const w = img.facts?.width ?? p.width;
      const h = img.facts?.height ?? p.height;
      const bytes = bytesOf(img.master, img.bytes);
      facts.push(`${w} × ${h} px`, ...(bytes ? [sizeWords(bytes)] : []), img.file, ...(img.dark ? ['Has a dark mode version'] : []), ...(img.large ? ['Kept large'] : []));
      return { ...common, picture: p, facts, large: !!img.large };
    }
    const vid = index.videos.get(item.media);
    if (vid) {
      const v = await video(item.media, 'popout');
      const bytes = bytesOf(vid.master, vid.bytes);
      facts.push(`${vid.width} × ${vid.height} px`, ...(vid.duration ? [lengthWords(vid.duration)] : []), ...(bytes ? [sizeWords(bytes)] : []), vid.file);
      return { ...common, video: v, facts };
    }
    const emb = index.embeds.get(item.media);
    if (emb) {
      const poster = await embedPoster(item.media, 'popout');
      const shape = emb.shape ? `${emb.shape.width}:${emb.shape.height}` : '16:9';
      facts.push(PROVIDERS[emb.provider].name, `Shape ${shape}`, ...(emb.duration ? [lengthWords(emb.duration)] : []));
      return { ...common, embed: { poster, provider: PROVIDERS[emb.provider].name, title: emb.title, ...(emb.duration ? { duration: emb.duration } : {}), shape }, facts };
    }
  } catch {
    // a broken master shows the item without its stage, never stops the editor
  }
  return { ...common, facts };
}
