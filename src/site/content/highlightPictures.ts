/** A highlight slide's picture, the same for the home carousel and edit mode's preview of a source (highlights spec §2.1). */
import type { ContentIndex } from './load';
import { embedPoster, picture, video, type Picture } from './pictures';

/** A video shows its poster, a linked video its poster, anything else the picture itself, all at the wide shape. */
export async function slidePicture(index: Pick<ContentIndex, 'videos' | 'embeds'>, media: string): Promise<Picture | undefined> {
  if (index.videos.has(media)) {
    const v = await video(media, 'wide');
    return v.poster ? { ...v.poster, alt: v.title, full: v.poster.src, caption: v.caption, bg: '' } : undefined;
  }
  if (index.embeds.has(media)) return embedPoster(media, 'wide');
  return picture(media, 'wide');
}
