/**
 * The lightbox's DOM wiring (tier 0; docs: documentation/gallery/spec.md §8, design-system.md §2):
 * opening from any `a[data-lightbox]` link, the stage, the counter, the caption, the filmstrip (one Tab
 * stop, a roving tab index), keys and swipes, warming the full sizes ahead, following the theme, and
 * history (Back closes it). Lightbox.astro's script runs it on the page's dialog through `each`; the
 * rules it applies are pure in `lightboxRules.ts`, `zoomRules.ts` and `media.ts`, and unit-tested.
 */
import { swipe, wrap } from './media';
import { pageIsDark } from './theme';
import {
  counterText,
  entryState,
  fullOf,
  groupFrom,
  historyMode,
  idFromHash,
  isEntry,
  itemFrom,
  itemHash,
  thumbName,
  thumbOf,
  viewerName,
  ALBUM_GROUP,
  WARM_WHOLE,
  warmOrder,
  warmable,
  type HistoryMode,
  type LightboxItem,
} from './lightboxRules';
import { keyAction, swipeAllowed, FIT } from './zoomRules';

const LINKS = 'a[data-lightbox]';

/** What the rules need of a link, read from the DOM. */
function factsOf(link: HTMLAnchorElement) {
  const img = link.querySelector<HTMLImageElement>('img');
  const cell = link.id.startsWith('item-') ? link : link.closest<HTMLElement>('[id^="item-"]');
  return { href: link.href, data: { ...link.dataset }, img: img ? { src: img.currentSrc || img.src, alt: img.alt } : undefined, cellId: cell?.id };
}

// a full-size picture fetched ahead, once per page (a sealed one can't be: it's decrypted when its link is used)
const warmed = new Map<string, Promise<void>>();
function warm(item: LightboxItem): Promise<void> {
  const url = fullOf(item, pageIsDark());
  if (!warmable(item, url)) return Promise.resolve();
  let p = warmed.get(url);
  if (!p) {
    p = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = url;
    });
    warmed.set(url, p);
  }
  return p;
}

export function setupLightbox(dialog: HTMLDialogElement, signal: AbortSignal): void {
  if (dialog.dataset.ready !== undefined) return;
  dialog.dataset.ready = '';

  const image = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]');
  const stage = dialog.querySelector<HTMLElement>('[data-lightbox-stage]');
  const count = dialog.querySelector<HTMLElement>('[data-lightbox-counter]');
  const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]');
  const captionWrap = dialog.querySelector<HTMLElement>('[data-lightbox-caption-wrap]');
  const strip = dialog.querySelector<HTMLElement>('[data-lightbox-strip]');
  const close = dialog.querySelector<HTMLButtonElement>('[data-lightbox-close]');
  const prev = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
  const next = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]');
  if (!image || !stage || !count || !caption || !captionWrap || !strip || !close || !prev || !next) return;

  let items: LightboxItem[] = [];
  let index = 0;
  let album = false;
  let opener: HTMLElement | null = null;
  let down: { x: number; y: number; id: number } | null = null;
  // history: how this opening uses it, whether its entry is still there, and a Back of our own on its way
  let mode: HistoryMode = 'none';
  let pushed = false;
  let unwinding = false;
  let loadedAt = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const thumbs = () => [...strip.querySelectorAll<HTMLButtonElement>('[data-lightbox-thumb]')];

  // nearest the item shown first, two at a time, so stepping through never waits: the whole group when
  // it opens (24 items or fewer), else a window round the item shown, again after every move
  let warming = 0;
  const warmSet = () => {
    const run = ++warming;
    const order = warmOrder(index, items.length);
    let k = 0;
    const worker = async () => {
      while (run === warming && k < order.length) await warm(items[order[k++]]);
    };
    void worker();
    void worker();
  };

  const paintStrip = () => {
    strip.textContent = '';
    const dark = pageIsDark();
    items.forEach((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.lightboxThumb = '';
      button.setAttribute('aria-label', thumbName(i, item, album));
      const img = document.createElement('img');
      img.src = thumbOf(item, dark);
      img.alt = '';
      button.append(img);
      button.addEventListener('click', () => render(i));
      strip.append(button);
    });
  };

  // the current thumbnail is marked and is the strip's one Tab stop; the focus follows it if it's in the strip
  const markStrip = () => {
    const had = strip.contains(document.activeElement);
    thumbs().forEach((b, i) => {
      b.tabIndex = i === index ? 0 : -1;
      if (i === index) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    const current = thumbs()[index];
    current?.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (had) current?.focus({ preventScroll: true });
  };

  const render = (nextIndex: number, instant = false) => {
    if (!items.length) return;
    const moved = wrap(nextIndex, items.length) !== index;
    index = wrap(nextIndex, items.length);
    const item = items[index];
    if (mode === 'hash' && (pushed || loadedAt) && item.id) history.replaceState(history.state, '', itemHash(item.id));
    markStrip();
    if (moved && items.length > WARM_WHOLE) warmSet();
    const apply = () => {
      image.src = fullOf(item, pageIsDark());
      image.alt = item.alt;
      stage.toggleAttribute('data-shadow', item.shadow);
      count.textContent = counterText(index, items.length);
      caption.textContent = item.caption;
      captionWrap.hidden = item.caption.length === 0;
    };
    if (instant || reduce) {
      apply();
      stage.removeAttribute('data-fading');
      return;
    }
    stage.setAttribute('data-fading', '');
    window.setTimeout(() => {
      apply();
      requestAnimationFrame(() => stage.removeAttribute('data-fading'));
    }, 90);
  };

  const groupLinks = (link: HTMLAnchorElement) => {
    const all = [...document.querySelectorAll<HTMLAnchorElement>(LINKS)].map((a) => ({ a, group: a.dataset.lightbox || '' }));
    const { members, index: at } = groupFrom(all, all.find((l) => l.a === link) ?? { a: link, group: link.dataset.lightbox || '' });
    return { links: members.map((m) => m.a), at };
  };

  /** Opens at a link; `loaded`: the page was opened at its address (`#item-<id>`), so there's no entry to add. */
  const open = (link: HTMLAnchorElement, loaded = false) => {
    const { links, at } = groupLinks(link);
    const group = link.dataset.lightbox || '';
    items = links.map((a) => itemFrom(factsOf(a)));
    index = at;
    album = group === ALBUM_GROUP;
    opener = link;
    dialog.setAttribute('aria-label', viewerName(items[index]?.albumTitle));
    mode = historyMode({ inFrame: document.documentElement.dataset.frame === 'planet', group, id: items[index]?.id });
    loadedAt = loaded && mode === 'hash';
    if (!dialog.open) {
      dialog.showModal();
      if (mode !== 'none' && !loadedAt && !pushed) {
        history.pushState(entryState(history.state), '', mode === 'hash' ? itemHash(items[index].id!) : undefined);
        pushed = true;
      }
    }
    paintStrip();
    render(index, true);
    close.focus();
    warmSet();
  };

  // pointing at a picture, or tabbing to it, starts its full size: it's there when it opens
  const warmLink = (event: Event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(LINKS) : null;
    if (link) void warm(itemFrom(factsOf(link)));
  };
  document.addEventListener('pointerover', warmLink, { signal, passive: true });
  document.addEventListener('focusin', warmLink, { signal });

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>(LINKS) : null;
      if (!link || !document.contains(link) || dialog.contains(link)) return;
      if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
      if (typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      open(link);
    },
    { signal },
  );

  // Back closes it: the entry it added goes, and the page's router (the library's) never hears that Back
  window.addEventListener(
    'popstate',
    (event) => {
      if (unwinding) {
        unwinding = false;
        event.stopImmediatePropagation();
        return;
      }
      if (dialog.open && pushed) {
        pushed = false;
        event.stopImmediatePropagation();
        dialog.close();
      } else if (isEntry(event.state)) {
        // Forward onto an entry of a lightbox now closed: nothing to show, and nothing for the router to do
        event.stopImmediatePropagation();
      }
    },
    { signal, capture: true },
  );

  close.addEventListener('click', () => dialog.close());
  // the theme changing while it's open (the switch, another tab, the system): the picture follows
  const retheme = () => {
    if (!dialog.open || !items.length) return;
    paintStrip();
    render(index, true);
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme, { signal });
  const themeWatch = new MutationObserver(retheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  signal.addEventListener('abort', () => themeWatch.disconnect());
  prev.addEventListener('click', () => render(index - 1));
  next.addEventListener('click', () => render(index + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    warming++;
    if (pushed) {
      // closed by Close, Escape or the smoke: its entry goes too, so Back then leaves the page as before
      pushed = false;
      unwinding = true;
      history.back();
    } else if (loadedAt) {
      // opened at the address it was loaded with: the reader stays at its cell, without the address
      history.replaceState(history.state, '', location.pathname + location.search);
    }
    loadedAt = false;
    opener?.focus();
    opener = null;
  });
  dialog.addEventListener('keydown', (event) => {
    if (!dialog.open) return;
    const t = event.target instanceof Element ? event.target : null;
    const action = keyAction(event.key, {
      zoomed: false,
      zoomable: false,
      inPlayer: !!t?.closest('video, audio, iframe'),
      inField: !!t?.closest('input, textarea, select, [contenteditable]'),
      modified: event.ctrlKey || event.metaKey || event.altKey,
    });
    if (!action) return;
    if (action.type === 'move') render(index + action.by);
    else if (action.type === 'first') render(0);
    else if (action.type === 'last') render(items.length - 1);
    else return; // Escape closes natively; zoom and the info panel come with their parts
    event.preventDefault();
  });
  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointerup', (event) => {
    if (!down || down.id !== event.pointerId) return;
    const dir = swipe(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (dir !== 0 && swipeAllowed(FIT)) render(index + dir);
  });

  // the album page opened at an item's address (`#item-<id>`) opens the lightbox there
  const id = idFromHash(location.hash);
  if (id && typeof dialog.showModal === 'function') {
    const link = [...document.querySelectorAll<HTMLAnchorElement>(`${LINKS}[data-lightbox="${ALBUM_GROUP}"]`)].find((a) => itemFrom(factsOf(a)).id === id);
    if (link) open(link, true);
  }
}
