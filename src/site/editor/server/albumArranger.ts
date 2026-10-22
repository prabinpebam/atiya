/**
 * What an album's Up front view draws (documentation/gallery/spec.md §9.3): the arranger's view of the band shown,
 * built from the Items view's cards (thumbnails for the album's own media only) and each item's file size. Dev
 * only: the article editor's page calls it.
 */
import type { ContentIndex } from '../../content/load';
import type { Album } from '../../content/schema';
import { arrangerView, type ArrangerView, type Show } from '../model/arranger';
import { albumItemsView } from './albumItems';

/** The arranger's view of an album, for the wide band or the phone's. */
export async function albumArrangerView(index: ContentIndex, owner: string, album: Album, show: Show, chosenId?: string | null): Promise<ArrangerView> {
  const { cards } = await albumItemsView(index, owner, album, false);
  const media = new Map(album.items.map((i) => [i.id, i.media]));
  const bytesOf = (item: string) => {
    const m = media.get(item);
    return m ? (index.media.get(m) ?? index.videos.get(m))?.bytes : undefined;
  };
  return arrangerView(album, cards, bytesOf, show, chosenId);
}
