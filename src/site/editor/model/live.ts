/**
 * Targeted live updates (documentation/engineering/performance-report.md R10): a change made elsewhere
 * (another tab, a file changed by hand) is drawn again only where it shows. Pure: scripts/live.ts asks it
 * which regions of the open screen to swap, and the site's pages in dev whether to reload.
 */

export { articleOf, pageShows } from '../../scripts/liveContent';

const isMedia = (k: string) => /^\/(content|private)\/media\//.test(k);
const isArticle = (k: string) => /^\/(content|private)\/articles\//.test(k);
const isAlbum = (k: string) => /^\/(content|private)\/albums\//.test(k);
const isStructure = (k: string) => /^\/(content|private)\/structures\//.test(k);
const isAccess = (k: string) => /^\/private\/access(-message)?\.json$/.test(k);
const isPeople = (k: string) => /^\/content\/people\//.test(k);
const isSettings = (k: string) => k === '/content/site.json' || isPeople(k);

/** Which files each screen shows something of: a change to any other file leaves it as it is. */
const SHOWS: Record<string, (key: string) => boolean> = {
  dashboard: () => true,
  publish: () => true,
  tests: () => false,
  // the list's titles, sections, states and thumbnails
  articles: (k) => isArticle(k) || isStructure(k) || isMedia(k),
  sections: (k) => isArticle(k) || isStructure(k) || isMedia(k),
  navigation: (k) => isArticle(k) || isStructure(k),
  planet: (k) => isArticle(k) || isStructure(k) || isMedia(k),
  // the ways file, and the structures a way keeps
  ways: (k) => isStructure(k),
  // every picture, and what uses each
  media: (k) => isMedia(k) || isArticle(k) || isSettings(k),
  settings: (k) => isSettings(k) || isMedia(k) || isArticle(k) || isStructure(k),
  access: (k) => isAccess(k) || isArticle(k) || isStructure(k),
  // the albums' cards: their files, the sections they're in and their cover pictures
  albums: (k) => isAlbum(k) || isStructure(k) || isMedia(k),
  // the album: its file, its pictures (their words and dates) and its section
  album: (k) => isAlbum(k) || isStructure(k) || isMedia(k),
};

/** Whether a screen shows anything of the changed files (an unknown screen always does). */
export const screenShows = (screen: string, files: string[]): boolean => {
  const shows = SHOWS[screen];
  return !shows || !files.length || files.some(shows);
};

/** A picture's id from its sidecar's or master's key (`/content/media/articles/a/b.json` → `articles/a/b`), or null. */
export function mediaIdOf(key: string): string | null {
  const m = /^\/(?:content|private)\/media\/(.+?)(?:\.dark|\.poster)?\.[a-z0-9]+$/.exec(key);
  return m ? m[1] : null;
}

/**
 * The regions of a screen to draw again for a change: none when it shows nothing of it; on Media, a change
 * to pictures alone redraws the grid, and the details only when they show one of them; else the screen.
 */
export function liveRegions(screen: string, files: string[], shownMedia: string | null = null): string[] {
  if (!screenShows(screen, files)) return [];
  if (screen === 'media' && files.length && files.every(isMedia)) {
    const ids = new Set(files.map(mediaIdOf));
    return shownMedia && ids.has(shownMedia) ? ['media-grid', 'media-details'] : ['media-grid'];
  }
  return ['screen'];
}
