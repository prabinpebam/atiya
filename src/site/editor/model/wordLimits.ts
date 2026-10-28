/**
 * The longest each of a picture's words may be (documentation/gallery/spec.md §9.8.2), for a form that edits several
 * at once (kit/SharedWords). Its own module, so a client script that reads the selection's rules never pulls in
 * the content schema.
 */
import { CAPTION_MAX, ITEM_DESCRIPTION_MAX, PLACE_MAX } from '../../content/schema';
import { ALT_MAX } from './altText';

/** Each word's longest, in characters. */
export const WORD_MAX = { caption: CAPTION_MAX, description: ITEM_DESCRIPTION_MAX, alt: ALT_MAX, place: PLACE_MAX } as const;
