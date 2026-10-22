/**
 * The album block in edit mode (documentation/gallery/spec.md §7.2, V51): which albums a page can show, said
 * with the reason when one can't be chosen, and which pages show an album, so a change that would leave one of
 * them showing an album it can't (made private, back to draft, deleted) is refused with their names. Pure.
 */
import type { Block } from '../../content/schema';
import { WIDTHS, type Choice } from './inspectorFields';

/** The widths an album block can take (its band never sits in the column): wide, or edge to edge. */
export const ALBUM_WIDTHS: Choice[] = WIDTHS.filter((w) => w.value === 'wide' || w.value === 'full');

/** An album page, as the chooser needs it. */
export interface AlbumFacts {
  id: string;
  title: string;
  /** Published and public (the content's isPublished). */
  published: boolean;
  /** In private-pages/. */
  private: boolean;
  /** How many items its album holds. */
  items: number;
}

/** The page the block goes on. */
export interface PageFacts {
  id: string;
  published: boolean;
}

/** One album in the chooser: disabled with the reason, or with what it holds. */
export interface AlbumChoice {
  id: string;
  title: string;
  /** Its second line: why it can't be chosen, or what it holds and whether it's published. */
  detail: string;
  disabled: boolean;
}

const items = (n: number) => (n === 0 ? 'Empty: nothing shows until it has pictures' : `${n} ${n === 1 ? 'item' : 'items'}`);

/** Why `page` can't show `album`, or undefined when it can (V51's three cases). */
export function albumUnavailable(album: AlbumFacts, page: PageFacts): string | undefined {
  if (album.id === page.id) return 'This page: its album is already on it';
  if (album.private) return 'Private: its band would show its words outside its seal';
  if (page.published && !album.published) return 'A draft, and this page is published: publish the album first';
  return undefined;
}

/** The site's albums a page can choose from, by title, each enabled or disabled with its reason. */
export function albumChoices(albums: readonly AlbumFacts[], page: PageFacts): AlbumChoice[] {
  return [...albums]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((a) => {
      const why = albumUnavailable(a, page);
      return { id: a.id, title: a.title, detail: why ?? `${items(a.items)}, ${a.published ? 'published' : 'a draft'}`, disabled: !!why };
    });
}

/** A page that may show albums. */
export interface ShowingPage {
  id: string;
  title: string;
  published: boolean;
  body: readonly Block[];
}

/** The pages (other than the album's own) whose body shows the album `albumId`. */
export function showingPages<P extends ShowingPage>(pages: Iterable<P>, albumId: string): P[] {
  return [...pages].filter((p) => p.id !== albumId && p.body.some((b) => b.type === 'album' && b.album === albumId));
}

/** Titles in words: "A", "A and B", "A, B and C". */
export function titles(pages: readonly { title: string }[]): string {
  const t = pages.map((p) => `"${p.title}"`);
  return t.length < 2 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
}

/** A change to an album page that could leave a page showing it wrongly. */
export type AlbumChange = 'draft' | 'private' | 'delete';

/**
 * Why `change` to the album is refused, naming the pages that show it, or undefined when nothing stops it:
 * back to draft while a published page shows it; private or deleted while any page does.
 */
export function albumLifecycleRefusal(change: AlbumChange, showing: readonly ShowingPage[]): string | undefined {
  const by = change === 'draft' ? showing.filter((p) => p.published) : showing;
  if (by.length === 0) return undefined;
  const them = by.length === 1 ? 'it' : 'them';
  const verb = by.length === 1 ? 'shows' : 'show';
  const what = change === 'draft' ? `can't go back to a draft: ${titles(by)} ${by.length === 1 ? 'is' : 'are'} published and ${verb} it` : change === 'private' ? `can't be made private: ${titles(by)} ${verb} it, and a private album's band can't be shown outside its seal` : `can't be deleted: ${titles(by)} ${verb} it`;
  return `${what}. Take its album block out of ${them} first`;
}
