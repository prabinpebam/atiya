/**
 * Tiles that play in an album's band (tier 0; documentation/gallery/spec.md §4.3). A tile set to play fetches
 * its file only once it comes near the screen (its poster shows until then), plays muted and looping while at
 * least half of it is in view, and stops when it leaves. The band's Pause button stops every tile in it, kept
 * for the visit. Under reduced motion or Save-Data nothing is fetched or played, and Pause stays hidden.
 * Without JavaScript the posters show. The rules are pure in albumBandRules.ts.
 */
import { NEAR, PAUSED_KEY, PLAY_SHARE, mayMove, pausedBands, shouldLoad, shouldPlay, viewShare, withPaused, type Reader } from './albumBandRules';

const REDUCED = '(prefers-reduced-motion: reduce)';

const saveData = (): boolean => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

function stored(): string | null {
  try {
    return sessionStorage.getItem(PAUSED_KEY);
  } catch {
    return null;
  }
}

function store(value: string): void {
  try {
    sessionStorage.setItem(PAUSED_KEY, value);
  } catch {
    // private browsing without storage: Pause still holds on this page
  }
}

/** Fills a tile's motion with its sources (once). */
function load(tile: HTMLElement): void {
  const m = tile.querySelector<HTMLElement>('[data-band-motion]');
  if (!m || m.dataset.loaded !== undefined) return;
  m.dataset.loaded = '';
  if (m instanceof HTMLVideoElement) {
    if (m.dataset.src) m.src = m.dataset.src;
    return;
  }
  m.querySelectorAll<HTMLSourceElement>('source[data-srcset]').forEach((s) => (s.srcset = s.dataset.srcset ?? ''));
  const img = m.querySelector<HTMLImageElement>('img[data-src]');
  if (img) {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.src = img.dataset.src ?? '';
  }
}

/** Starts or stops one tile: a video plays or pauses; an animated picture shows over its still, or not. */
function set(tile: HTMLElement, on: boolean): void {
  const m = tile.querySelector<HTMLElement>('[data-band-motion]');
  if (!m || m.dataset.loaded === undefined) return;
  if (m instanceof HTMLVideoElement) {
    if (on) {
      m.play()
        .then(() => tile.setAttribute('data-playing', ''))
        .catch(() => tile.removeAttribute('data-playing'));
    } else {
      m.pause();
      tile.removeAttribute('data-playing');
    }
    return;
  }
  tile.toggleAttribute('data-playing', on);
}

/** Sets up one band that has tiles to play (`[data-album-band][data-plays]`); `signal` ends it when the band leaves the page. */
export function setUpBand(band: HTMLElement, signal: AbortSignal): void {
  const id = band.dataset.albumId ?? '';
  const tiles = [...band.querySelectorAll<HTMLElement>('[data-tile][data-play]')];
  const pause = band.querySelector<HTMLButtonElement>('[data-band-pause]');
  const slot = band.querySelector<HTMLElement>('[data-band-pause-slot]');
  const reduced = matchMedia(REDUCED);
  const share = new Map<HTMLElement, number>();
  const near = new Set<HTMLElement>();
  let paused = pausedBands(stored()).has(id);
  const reader = (): Reader => ({ reducedMotion: reduced.matches, saveData: saveData() });

  const apply = () => {
    const r = reader();
    if (slot) slot.hidden = !mayMove(r);
    pause?.setAttribute('aria-pressed', String(paused));
    band.toggleAttribute('data-paused', paused);
    tiles.forEach((t) => {
      if (shouldLoad({ reader: r, near: near.has(t) })) load(t);
      set(t, shouldPlay({ reader: r, paused, share: share.get(t) ?? 0 }));
    });
  };

  const nearing = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => e.isIntersecting && near.add(e.target as HTMLElement));
      apply();
    },
    { rootMargin: NEAR },
  );
  const seen = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => share.set(e.target as HTMLElement, viewShare(e.intersectionRatio, e.intersectionRect.height, e.rootBounds?.height)));
      apply();
    },
    { threshold: [0, 0.25, PLAY_SHARE, 0.75, 1] },
  );
  tiles.forEach((t) => {
    nearing.observe(t);
    seen.observe(t);
  });
  signal.addEventListener('abort', () => {
    nearing.disconnect();
    seen.disconnect();
  });

  reduced.addEventListener('change', apply, { signal });
  pause?.addEventListener(
    'click',
    () => {
      paused = !paused;
      store(withPaused(stored(), id, paused));
      apply();
    },
    { signal },
  );
  apply();
}
