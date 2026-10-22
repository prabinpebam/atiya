/**
 * What an album's Items view draws (documentation/gallery/spec.md §9.2), read from the content index: each item's
 * card (its thumbnail, kind and words), the album's counts and weight, and whether Sort by date taken would change
 * the order. Dev only: the article editor's page calls it.
 */
import type { ContentIndex } from '../../content/load';
import type { Album } from '../../content/schema';
import { ALBUM_MAX_ITEMS } from '../../content/schema';
import { mediaKind } from '../../content/album';
import { albumCards, albumCounts, albumWeight, sortChanges, weightWords, type AlbumCard, type ItemFacts } from '../model/album';
import { mediaCards } from './screens';

export interface AlbumItemsView {
  cards: AlbumCard[];
  /** The chosen card (the one asked for, else the first). */
  chosen?: AlbumCard;
  counts: string;
  weight: string;
  sortable: boolean;
  full: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The Items view of an album, its cards' thumbnails drawn for its own media and posters only. */
export async function albumItemsView(index: ContentIndex, owner: string, album: Album, isPrivate: boolean, chosenId?: string | null): Promise<AlbumItemsView> {
  const used = new Set(album.items.flatMap((i) => [i.media, i.poster].filter((m): m is string => !!m)));
  const thumbs = new Map((await mediaCards(index, owner, { only: used })).map((c) => [c.id, c]));
  const lookup = (id: string) => index.media.get(id) ?? index.videos.get(id);
  const factsOf = (id: string): ItemFacts | undefined => {
    const card = thumbs.get(id);
    const pic = index.media.get(id);
    const video = index.videos.get(id);
    const kind = mediaKind(lookup(id));
    if (!card || !kind) return undefined;
    return {
      kind,
      thumb: card.thumb,
      width: card.width,
      height: card.height,
      ...(pic ? { alt: pic.decorative ? '' : pic.alt, caption: pic.caption, taken: pic.taken, ...(pic.large ? { large: true } : {}), ...(pic.focus ? { focus: pic.focus } : {}) } : {}),
      ...(video ? { alt: video.title, caption: video.caption } : {}),
    };
  };
  const cards = albumCards(album, factsOf);
  const c = albumCounts(album.items, lookup);
  const counts = [c.pictures && plural(c.pictures, 'picture', 'pictures'), c.videos && plural(c.videos, 'video', 'videos'), c.drawings && plural(c.drawings, 'drawing', 'drawings')].filter(Boolean).join(', ') || 'Empty';
  const weight = weightWords(
    albumWeight(album.items, (m) => lookup(m)?.bytes),
    isPrivate,
  );
  const takenOf = (i: { media?: string }) => (i.media ? index.media.get(i.media)?.taken : undefined);
  return {
    cards,
    chosen: cards.find((x) => x.id === chosenId) ?? cards[0],
    counts,
    weight,
    sortable: sortChanges(album, takenOf),
    full: album.items.length >= ALBUM_MAX_ITEMS,
  };
}
