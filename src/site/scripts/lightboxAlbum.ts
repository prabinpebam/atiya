/**
 * The lightbox's reading of the DOM (tier 0; docs: documentation/gallery/spec.md §8.1): what a link says
 * about its item (its data, its cell's size, its words in the cell's template), and a band's album, fetched
 * once per visit from the album page and read from its cells in album order. The rules are pure in
 * `lightboxRules.ts`.
 */
import { ALBUM_GROUP, BAND_GROUP, albumUrlOf, itemFrom, type ItemWords, type LightboxItem, type LinkFacts } from './lightboxRules';

/** A link's words, from the template beside it in its album cell. */
function wordsOf(cell: Element | null): ItemWords | undefined {
  const t = cell?.querySelector<HTMLTemplateElement>('template[data-album-words]');
  if (!t) return undefined;
  const part = (name: string) => t.content.querySelector<HTMLElement>(`[data-words="${name}"]`);
  const taken = part('taken');
  return {
    description: part('description')?.innerHTML || undefined,
    credit: part('credit')?.textContent?.trim() || undefined,
    taken: taken?.textContent?.trim() || undefined,
    takenIso: taken?.getAttribute('datetime') || undefined,
    place: part('place')?.textContent?.trim() || undefined,
  };
}

/** An address on the page, resolved against `base` (a fetched album page's own address). */
const resolve = (url: string | undefined, base: string): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
};

/** What the rules need of a link, read from the DOM; `base` resolves its addresses (a fetched page's). */
export function factsOf(link: HTMLAnchorElement, base = location.href): LinkFacts {
  const img = link.querySelector<HTMLImageElement>('img');
  const cell = link.id.startsWith('item-') ? link : link.closest<HTMLElement>('[id^="item-"]');
  const data: Record<string, string | undefined> = { ...link.dataset };
  for (const k of ['thumb', 'fullDark', 'thumbDark', 'poster', 'posterDark', 'download', 'stage', 'still', 'stillDark', 'full']) data[k] = resolve(data[k], base);
  // a band's tile links to its item on the album page: the lightbox shows the tile's full size, else its still
  const band = link.dataset.lightbox === BAND_GROUP;
  const href = band ? (data.full ?? (img ? img.currentSrc || img.src : '')) : (resolve(link.getAttribute('href') ?? '', base) ?? '');
  return {
    href,
    data,
    img: img ? { src: img.currentSrc || img.src, alt: img.alt } : undefined,
    cellId: cell?.id,
    cellWidth: cell?.dataset.width,
    cellHeight: cell?.dataset.height,
    words: wordsOf(cell),
  };
}

/** A link's item. */
export const itemOf = (link: HTMLAnchorElement, base?: string): LightboxItem => itemFrom(factsOf(link, base));

// each album page fetched once per visit (the reader's next step is usually that page, then from the cache)
const albums = new Map<string, Promise<LightboxItem[] | null>>();

/** A band's album, read from its page's cells in album order; null when it can't be fetched or holds none. */
export function fetchAlbum(href: string): Promise<LightboxItem[] | null> {
  const url = albumUrlOf(new URL(href, location.href).href);
  let p = albums.get(url);
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const links = [...doc.querySelectorAll<HTMLAnchorElement>(`a[data-lightbox="${ALBUM_GROUP}"]`)];
        return links.length ? links.map((a) => itemOf(a, url)) : null;
      })
      .catch(() => null);
    // a failure isn't kept: the next press tries again
    void p.then((items) => items || albums.delete(url));
    albums.set(url, p);
  }
  return p;
}
