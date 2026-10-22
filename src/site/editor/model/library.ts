/**
 * The library (documentation/gallery/spec.md §9.9), pure: the timeline's months (newest first, "No date" by the
 * month added), its filters, and what deleting from the library says first (the albums it leaves) or why it's
 * refused (the pages that use it). The Media screen (pages/media.astro) and its script read these.
 */

/** What a library item is, as the grid badges it. */
export type LibraryKind = 'picture' | 'drawing' | 'animated' | 'video' | 'embed';

/** One library item, as the timeline needs it. */
export interface LibraryEntry {
  /** Its media ID. */
  id: string;
  kind: LibraryKind;
  /** The day it was taken (YYYY-MM-DD), if known. */
  taken?: string;
  /** The day it was added to the library (YYYY-MM-DD): the file's date, for those without a day taken. */
  added: string;
  /** The albums that hold it, by title. */
  albums: string[];
  /** The articles (pages) that use it, by title. */
  articles: string[];
  /** A picture without alt text (and not decorative). */
  needsAlt: boolean;
  /** It's in private-pages/. */
  private: boolean;
}

/** The timeline's filters, beside the list view's own (the owner folders). */
export const LIBRARY_FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'not-in-album', label: 'Not in any album' },
  { value: 'in-albums', label: 'In albums' },
  { value: 'needs-alt', label: 'Needs alt text' },
  { value: 'pictures', label: 'Pictures' },
  { value: 'drawings', label: 'Drawings' },
  { value: 'animated', label: 'Animations' },
  { value: 'videos', label: 'Video files' },
  { value: 'linked', label: 'Linked videos' },
  { value: 'private', label: 'Private' },
] as const;

export type LibraryFilter = (typeof LIBRARY_FILTERS)[number]['value'];

/** A filter from an address's `show`, or Everything. */
export function libraryFilter(v: string | null | undefined): LibraryFilter {
  return LIBRARY_FILTERS.some((f) => f.value === v) ? (v as LibraryFilter) : 'all';
}

const KIND_OF: Partial<Record<LibraryFilter, LibraryKind>> = { pictures: 'picture', drawings: 'drawing', animated: 'animated', videos: 'video', linked: 'embed' };

/** Whether an item is shown under a filter. */
export function matchesFilter(e: LibraryEntry, f: LibraryFilter): boolean {
  if (f === 'all') return true;
  if (f === 'not-in-album') return e.albums.length === 0;
  if (f === 'in-albums') return e.albums.length > 0;
  if (f === 'needs-alt') return e.needsAlt;
  if (f === 'private') return e.private;
  return e.kind === KIND_OF[f];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthWords = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1] ?? ''} ${day.slice(0, 4)}`.trim();

/** An item's month on the timeline: "March 2026" taken, or "No date, added May 2026". */
export function monthGroup(e: Pick<LibraryEntry, 'taken' | 'added'>): string {
  return e.taken ? monthWords(e.taken) : `No date, added ${monthWords(e.added)}`;
}

/** The timeline: the items a filter shows, newest taken first, then those without a date, newest added first; each with its month. */
export function timeline<T extends LibraryEntry>(entries: T[], f: LibraryFilter = 'all'): (T & { group: string })[] {
  const by = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const shown = entries.filter((e) => matchesFilter(e, f));
  const dated = shown.filter((e) => e.taken).sort((a, b) => by(a.taken!, b.taken!) || a.id.localeCompare(b.id));
  const undated = shown.filter((e) => !e.taken).sort((a, b) => by(a.added, b.added) || a.id.localeCompare(b.id));
  return [...dated, ...undated].map((e) => ({ ...e, group: monthGroup(e) }));
}

/** Deleting from the library: refused while a page uses any of them (naming the pages), else what it asks first. */
export type DeleteVerdict = { ok: false; why: string } | { ok: true; title: string; words: string; albums: string[] };

const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const quoted = (names: string[]) => list(names.map((n) => `\u201c${n}\u201d`));

/** What deleting these items asks first (spec §9.9): the albums they leave, or why they can't go. */
export function deleteVerdict(items: Pick<LibraryEntry, 'albums' | 'articles'>[]): DeleteVerdict {
  const one = items.length === 1;
  const pages = [...new Set(items.flatMap((i) => i.articles))];
  if (pages.length) {
    const them = one ? 'It' : 'Some of them';
    return { ok: false, why: `${them} can't be deleted while ${pages.length === 1 ? 'a page uses' : 'pages use'} ${one ? 'it' : 'them'}: ${quoted(pages)}. Take ${one ? 'it' : 'them'} out of ${pages.length === 1 ? 'that page' : 'those pages'} first.` };
  }
  const albums = [...new Set(items.flatMap((i) => i.albums))];
  const title = one ? 'Delete this from your library?' : `Delete ${items.length} items from your library?`;
  const where = albums.length === 0 ? '' : albums.length === 1 ? `the album \u201c${albums[0]}\u201d` : albums.length === 2 ? 'both albums' : `all ${albums.length} albums`;
  const words =
    albums.length === 0
      ? `${one ? "It isn't" : "They aren't"} in any album. ${one ? 'It' : 'They'} and ${one ? 'its' : 'their'} details will be deleted from your library.`
      : `${one ? "It's" : "They're"} in ${albums.length === 1 ? `\u201c${albums[0]}\u201d` : `${albums.length} albums (${quoted(albums)})`}. Delete ${one ? 'it' : 'them'} from your library and ${where}?`;
  return { ok: true, title, words, albums };
}
