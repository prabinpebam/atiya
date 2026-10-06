/**
 * How the site's pictures load (tier 0; documentation/site-ui/design-system.md §9): each one shows a
 * shimmer while it loads and fades in once it has, a failed load is tried again before it gives up, and
 * once the page has loaded every picture still waiting is fetched, the nearest to what's in view first,
 * a few at a time, so a picture is there before it's scrolled or swiped to (a carousel's slides, a long
 * article's last figures). Pictures stay `loading="lazy"` in the HTML: the browser fetches what's in view
 * at once, and this fetches the rest in the order a reader will need them.
 *
 * Without JavaScript none of this runs, and every picture shows as it loads.
 */

/** A box on the page, as getBoundingClientRect gives it. */
export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** How far a box is from the view (0 when any of it is in view), in px. */
export function distanceFromView(b: Box, view: { width: number; height: number }): number {
  const dy = b.bottom < 0 ? -b.bottom : b.top > view.height ? b.top - view.height : 0;
  const dx = b.right < 0 ? -b.right : b.left > view.width ? b.left - view.width : 0;
  return Math.hypot(dx, dy);
}

/** Items in the order to fetch them: nearest the view first, ties in page order. */
export function nearestFirst<T>(items: T[], boxOf: (t: T) => Box, view: { width: number; height: number }): T[] {
  return items
    .map((t, i) => ({ t, i, d: distanceFromView(boxOf(t), view) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.t);
}

/** The retries a failed picture gets, and the wait before each. */
export const RETRY_MS = [800, 2400];

const watched = new WeakSet<Element>();

/**
 * Follows one picture (`[data-picture]`, the Image fundamental's root): `data-state` is `loading` (the
 * shimmer; the picture hidden) until it has loaded (`loaded`: it fades in), or `failed` after its retries.
 * A picture with no source yet (a private page's, until it's decrypted) waits, shimmering.
 */
export function watchPicture(root: HTMLElement, signal?: AbortSignal): void {
  const img = root.querySelector('img');
  if (!img || watched.has(root)) return;
  watched.add(root);
  const hasSource = () => !!(img.getAttribute('src') || img.getAttribute('srcset'));
  const done = () => img.complete && img.naturalWidth > 0;
  let tries = 0;
  const fail = () => {
    if (!hasSource()) return;
    if (tries >= RETRY_MS.length) {
      root.dataset.state = 'failed';
      return;
    }
    const wait = RETRY_MS[tries++];
    setTimeout(() => {
      // set the same sources again: the browser asks for the file once more
      const src = img.getAttribute('src');
      const srcset = img.getAttribute('srcset');
      img.removeAttribute('srcset');
      img.removeAttribute('src');
      if (srcset) img.setAttribute('srcset', srcset);
      if (src) img.setAttribute('src', src);
    }, wait);
  };
  img.addEventListener(
    'load',
    () => {
      if (img.naturalWidth > 0) root.dataset.state = 'loaded';
    },
    { signal },
  );
  img.addEventListener('error', fail, { signal });
  if (done()) root.dataset.state = 'loaded';
  else {
    root.dataset.state = 'loading';
    // it failed before this saw it
    if (img.complete && hasSource() && img.currentSrc) fail();
  }
}

/** Every picture under `root` not followed yet (a private page's, inserted once it's decrypted). */
export const watchPicturesIn = (root: ParentNode): void => root.querySelectorAll<HTMLElement>('[data-picture]').forEach((el) => watchPicture(el));

// ---------- fetching the rest, nearest first ----------

const AT_ONCE = 4;
const GIVE_UP_MS = 15_000;

/** The scroller a picture sits in sideways (a carousel, a filmstrip, a row gallery), if any. */
function sidewaysScroller(img: HTMLElement): HTMLElement | null {
  for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
    const o = getComputedStyle(el).overflowX;
    if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth) return el;
  }
  return null;
}

/** Fetches it now (if it isn't already) and settles when it has loaded, failed or taken too long. */
function fetchNow(img: HTMLImageElement): Promise<void> {
  if (img.complete || !(img.getAttribute('src') || img.getAttribute('srcset'))) return Promise.resolve();
  return new Promise((resolve) => {
    const end = () => {
      clearTimeout(timer);
      img.removeEventListener('load', end);
      img.removeEventListener('error', end);
      resolve();
    };
    const timer = setTimeout(end, GIVE_UP_MS);
    img.addEventListener('load', end);
    img.addEventListener('error', end);
    img.loading = 'eager';
  });
}

let pass = 0;
function prefetch() {
  const run = ++pass;
  const view = { width: innerWidth, height: innerHeight };
  // the pictures still waiting that can be seen (one held back unseen, display none, waits for its turn)
  const waiting = [...document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')].filter((img) => !img.complete && img.checkVisibility?.() !== false);
  const scrollerOf = new Map(waiting.map((img) => [img, sidewaysScroller(img)]));
  // a picture in a sideways scroller counts as near as its scroller: a carousel near the view brings its slides
  const queue = nearestFirst(waiting, (img) => (scrollerOf.get(img) ?? img).getBoundingClientRect(), view);
  // and a scroller coming into view fetches its pictures at once, whatever the queue is doing
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        near.unobserve(e.target);
        for (const [img, s] of scrollerOf) if (s === e.target) void fetchNow(img);
      }
    },
    { rootMargin: '50% 0px' },
  );
  for (const s of new Set(scrollerOf.values())) if (s) near.observe(s);
  let next = 0;
  const worker = async () => {
    while (run === pass && next < queue.length) await fetchNow(queue[next++]);
  };
  for (let k = 0; k < AT_ONCE; k++) void worker();
}

/** Starts fetching the rest once the page has loaded (and again after a page swap in the design library). */
export function prefetchPictures(): void {
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(() => prefetch(), { timeout: 1500 }) : setTimeout(prefetch, 300));
  if (document.readyState === 'complete') later();
  else addEventListener('load', later, { once: true });
  document.addEventListener('astro:page-load', later);
}
