/**
 * The lightbox's DOM wiring (tier 0; docs: documentation/gallery/spec.md §8, design-system.md §2): the
 * group a link opens (its page's links, or a band's whole album, fetched from the album page), the stage,
 * the counter, the caption, the filmstrip (one Tab stop, a roving tab index), keys, warming the full sizes
 * ahead, following the theme, and history (Back closes it). The info panel, the stage's kinds and zoom are
 * `lightboxInfo.ts`, `lightboxStage.ts` and `lightboxZoom.ts`. Lightbox.astro's script loads it when a link
 * is first pointed at, focused or pressed, and hands it the link; the rules are pure in `lightboxRules.ts`,
 * `zoomRules.ts` and `media.ts`, and unit-tested.
 */
import { wrap } from './media';
import { pageIsDark } from './theme';
import {
  ALBUM_GROUP,
  BAND_GROUP,
  WARM_WHOLE,
  albumUrlOf,
  bandFallback,
  bandGroup,
  counterText,
  entryState,
  groupFrom,
  historyMode,
  idFromHash,
  isEntry,
  itemHash,
  seeAllWords,
  stageKind,
  stageOf,
  thumbName,
  thumbOf,
  viewerName,
  warmOrder,
  warmable,
  type HistoryMode,
  type LightboxItem,
} from './lightboxRules';
import { keyAction } from './zoomRules';
import { fetchAlbum, itemOf } from './lightboxAlbum';
import { createStage } from './lightboxStage';
import { setupZoom } from './lightboxZoom';
import { setupInfo, type InfoContext } from './lightboxInfo';

const LINKS = 'a[data-lightbox]';

// a full-size picture fetched ahead, once per page (a sealed one can't be: it's decrypted when its link is used)
const warmed = new Map<string, Promise<void>>();
function warm(item: LightboxItem): Promise<void> {
  const url = stageOf(item, pageIsDark());
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

/** What the page's loader hands links to. */
export interface LightboxApi {
  /** Opens at a link; `pressed`: the reader pressed it (a video plays); `loaded`: the page was opened at its address. */
  open(link: HTMLAnchorElement, pressed?: boolean, loaded?: boolean): void;
  /** Starts its full size (and, for a band's tile, its album page). */
  warm(link: HTMLAnchorElement): void;
}

const apis = new WeakMap<HTMLDialogElement, LightboxApi>();
const num = (v: string | undefined) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

export function setupLightbox(dialog: HTMLDialogElement, signal: AbortSignal): LightboxApi | undefined {
  const known = apis.get(dialog);
  if (known) return known;
  const q = <T extends HTMLElement>(s: string) => dialog.querySelector<T>(s) ?? undefined;
  const image = q<HTMLImageElement>('[data-lightbox-image]');
  const stage = q('[data-lightbox-stage]');
  const count = q('[data-lightbox-counter]');
  const title = q('[data-lightbox-title]');
  const caption = q('[data-lightbox-caption]');
  const captionWrap = q('[data-lightbox-caption-wrap]');
  const more = q('[data-lightbox-more-wrap]');
  const strip = q('[data-lightbox-strip]');
  const badges = q<HTMLTemplateElement>('[data-lightbox-badges]');
  const close = q<HTMLButtonElement>('[data-lightbox-close]');
  const prev = q<HTMLButtonElement>('[data-lightbox-prev]');
  const next = q<HTMLButtonElement>('[data-lightbox-next]');
  const status = q('[data-lightbox-status]');
  const player = q('[data-lightbox-player]');
  const facade = q('[data-lightbox-facade]');
  const facadePlay = q<HTMLButtonElement>('[data-lightbox-play-embed]');
  const motion = q('[data-lightbox-motion]');
  const pause = q<HTMLButtonElement>('[data-lightbox-pause]');
  const play = q<HTMLButtonElement>('[data-lightbox-resume]');
  const zoomGroup = q('[data-lightbox-zoom]');
  const zoomIn = q<HTMLButtonElement>('[data-lightbox-zoom-in]');
  const zoomOut = q<HTMLButtonElement>('[data-lightbox-zoom-out]');
  if (!image || !stage || !count || !title || !caption || !captionWrap || !strip || !close || !prev || !next || !status) return undefined;
  if (!player || !facade || !facadePlay || !motion || !pause || !play || !zoomGroup || !zoomIn || !zoomOut) return undefined;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let items: LightboxItem[] = [];
  let index = 0;
  let group = '';
  let ctx: InfoContext = { albumUrl: '', siteUrl: '', albumTitle: '', onAlbumPage: false };
  let opener: HTMLElement | null = null;
  let pressed = false;
  let opening = 0;
  let seeAll = 0;
  // history: how this opening uses it, whether its entry is still there, and a Back of our own on its way
  let mode: HistoryMode = 'none';
  let pushed = false;
  let unwinding = false;
  let loadedAt = false;
  // an Escape that went back to the whole item: its own close request is refused (every key press starts afresh)
  let fitByEscape = false;
  const thumbs = () => [...strip.querySelectorAll<HTMLButtonElement>('[data-lightbox-thumb]')];
  const album = () => group === ALBUM_GROUP || group === BAND_GROUP;

  const view = createStage({ stage, image, player, facade, facadePlay, motion, pause, play }, reduce);
  const zoom = setupZoom({ stage, image, group: zoomGroup, zoomIn, zoomOut, status }, (dir) => render(index + dir));
  // the caption gives way to the info panel, which has it too; More opens the panel at a description
  const layoutWords = () => {
    const item = items[index];
    const open = !!info?.isOpen();
    captionWrap.hidden = !item?.caption || open;
    if (more) more.hidden = !item?.words?.description || open || !album();
  };
  const info = setupInfo(dialog, layoutWords);

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
      button.setAttribute('aria-label', thumbName(i, item, album()));
      const src = thumbOf(item, dark);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        button.append(img);
      }
      const badge = item.pending ? null : badges?.content.querySelector(`[data-badge="${item.kind === 'embed' ? 'video' : item.kind}"]`);
      if (badge) button.append(badge.cloneNode(true));
      button.addEventListener('click', () => render(i));
      strip.append(button);
    });
    if (seeAll && ctx.albumUrl) {
      const a = document.createElement('a');
      a.href = ctx.albumUrl;
      a.dataset.lightboxSeeAll = '';
      a.textContent = seeAllWords(seeAll);
      strip.append(a);
    }
  };

  // the current thumbnail is marked and is the strip's one Tab stop; the focus follows it if it's in the strip
  const markStrip = () => {
    const had = strip.contains(document.activeElement);
    const all = thumbs();
    all.forEach((b, i) => {
      b.tabIndex = i === index ? 0 : -1;
      if (i === index) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    all[index]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (had) all[index]?.focus({ preventScroll: true });
  };

  const words = () => {
    const item = items[index];
    count.textContent = counterText(index, items.length);
    caption.textContent = item.caption;
    info?.fill(item, ctx);
    info?.offer(album());
    layoutWords();
  };

  const render = (nextIndex: number, instant = false) => {
    if (!items.length) return;
    const to = wrap(nextIndex, items.length);
    const moved = to !== index;
    index = to;
    const item = items[index];
    if (mode === 'hash' && (pushed || loadedAt) && item.id) history.replaceState(history.state, '', itemHash(item.id));
    markStrip();
    if (moved && items.length > WARM_WHOLE) warmSet();
    const press = pressed;
    pressed = false;
    const apply = () => {
      const dark = pageIsDark();
      view.show(item, dark, press);
      stage.toggleAttribute('data-shadow', item.shadow);
      zoom.prepare(item, dark);
      words();
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

  const pageGroup = (link: HTMLAnchorElement) => {
    const all = [...document.querySelectorAll<HTMLAnchorElement>(LINKS)].map((a) => ({ a, group: a.dataset.lightbox || '' }));
    const { members, index: at } = groupFrom(all, all.find((l) => l.a === link) ?? { a: link, group: link.dataset.lightbox || '' });
    return { items: members.map((m) => itemOf(m.a)), index: at };
  };

  const canonical = () => document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? location.origin + location.pathname;

  // a band's tile: the album's places at once (its tiles at theirs), then the album page's items when they arrive
  const bandOpen = (link: HTMLAnchorElement) => {
    const band = link.closest('[data-album-band]') ?? document;
    const links = [...band.querySelectorAll<HTMLAnchorElement>(`a[data-lightbox="${BAND_GROUP}"]`)];
    const at = Math.max(0, links.indexOf(link));
    const members = links.map((a) => ({ item: itemOf(a), index: num(a.dataset.index) }));
    const run = opening;
    void fetchAlbum(link.href).then((list) => {
      if (run !== opening || !dialog.open || !items.length) return;
      const old = items[index];
      if (list?.length) {
        const found = old.id ? list.findIndex((it) => it.id === old.id) : -1;
        items = list;
        index = found >= 0 ? found : Math.min(index, list.length - 1);
      } else {
        // the album page can't be had: the band's own tiles, and See all to the album
        const fallback = bandFallback(members, at);
        items = fallback.items;
        index = Math.max(0, old.id ? items.findIndex((it) => it.id === old.id) : fallback.index);
        seeAll = num(link.dataset.count) ?? items.length;
      }
      paintStrip();
      const fresh = items[index];
      // the item on the stage stays when it's the same; a placeholder or a poster gives way
      if (old.pending || stageKind(old) !== stageKind(fresh) || stageOf(old, false) !== stageOf(fresh, false)) render(index, true);
      else {
        markStrip();
        words();
      }
      warmSet();
    });
    return bandGroup(members, at, num(link.dataset.count));
  };

  const open = (link: HTMLAnchorElement, press = false, loaded = false) => {
    if (typeof dialog.showModal !== 'function') return;
    opening++;
    group = link.dataset.lightbox || '';
    seeAll = 0;
    const onAlbumPage = group === ALBUM_GROUP;
    const albumUrl = group === BAND_GROUP ? albumUrlOf(link.href) : onAlbumPage ? canonical() : '';
    // the band's album on the site, never a building's address on the planet (Copy link gives it)
    const site = group === BAND_GROUP ? link.closest<HTMLElement>('[data-album-band]')?.dataset.albumSite : undefined;
    const siteUrl = site ? new URL(site, location.href).href : albumUrl;
    const g = group === BAND_GROUP ? bandOpen(link) : pageGroup(link);
    if (!g.items.length) return;
    items = g.items;
    index = g.index;
    ctx = { albumUrl, siteUrl, albumTitle: album() ? (items[index]?.albumTitle ?? '') : '', onAlbumPage };
    opener = link;
    pressed = press;
    title.textContent = ctx.albumTitle;
    title.hidden = !ctx.albumTitle;
    dialog.setAttribute('aria-label', viewerName(items[index]?.albumTitle));
    mode = historyMode({ inFrame: document.documentElement.dataset.frame === 'planet', group, id: items[index]?.id });
    loadedAt = loaded && mode === 'hash';
    if (!dialog.open) {
      dialog.showModal();
      // telemetry's hook (spec §14): where it opened and what, never a title or an address
      const place = group === BAND_GROUP ? 'band' : onAlbumPage ? 'album' : 'page';
      document.dispatchEvent(new CustomEvent('site:lightbox', { detail: { place, kind: items[index]?.kind ?? 'picture' } }));
      if (mode !== 'none' && !loadedAt && !pushed) {
        history.pushState(entryState(history.state), '', mode === 'hash' ? itemHash(items[index].id!) : undefined);
        pushed = true;
      }
    }
    paintStrip();
    render(index, true);
    // the dialog's own first focus may be any tool: Close it is, unless an embed's Play took it
    if (document.activeElement !== facadePlay) close.focus();
    warmSet();
  };

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
  // the theme changing while it's open (the switch, another tab, the system): the item follows, a player keeps playing
  const retheme = () => {
    if (!dialog.open || !items.length) return;
    paintStrip();
    markStrip();
    view.retheme(items[index], pageIsDark());
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme, { signal });
  const themeWatch = new MutationObserver(retheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // a drawing is sized to the stage, and zoom measured again, when the stage changes size
  const resize = new ResizeObserver(() => dialog.open && view.fit());
  resize.observe(stage);
  signal.addEventListener('abort', () => {
    themeWatch.disconnect();
    resize.disconnect();
  });
  prev.addEventListener('click', () => render(index - 1));
  next.addEventListener('click', () => render(index + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) return dialog.close();
    // a description's link to another item of the album (#item-<id>) moves there
    const a = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('[data-lightbox-panel] a[href*="#item-"]') : null;
    const id = a ? idFromHash(new URL(a.href).hash) : null;
    const to = id ? items.findIndex((it) => it.id === id) : -1;
    if (to >= 0) {
      event.preventDefault();
      render(to);
    }
  });
  dialog.addEventListener('cancel', (event) => {
    // Escape goes back to the whole item first; a second Escape closes
    if (zoom.zoomed() || fitByEscape) {
      fitByEscape = false;
      event.preventDefault();
      if (zoom.zoomed()) zoom.fit();
    }
  });
  dialog.addEventListener('close', () => {
    warming++;
    opening++;
    view.clear();
    zoom.prepare(null, false);
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
    fitByEscape = false;
    const t = event.target instanceof Element ? event.target : null;
    const action = keyAction(event.key, {
      zoomed: zoom.zoomed(),
      zoomable: zoom.offered(),
      inPlayer: !!t?.closest('video, audio, iframe'),
      inField: !!t?.closest('input, textarea, select, [contenteditable]'),
      modified: event.ctrlKey || event.metaKey || event.altKey,
    });
    if (!action || action.type === 'close') return; // Escape closes natively
    if (action.type === 'info' && (!album() || !info)) return;
    if (action.type === 'move') render(index + action.by);
    else if (action.type === 'first') render(0);
    else if (action.type === 'last') render(items.length - 1);
    else if (action.type === 'pan') zoom.pan(action.x, action.y);
    else if (action.type === 'zoom') zoom.step(action.by);
    else if (action.type === 'info') info?.toggle();
    else if (action.type === 'fit') {
      if (event.key === 'Escape') {
        fitByEscape = true;
      }
      zoom.fit();
    }
    event.preventDefault();
  });

  const api: LightboxApi = {
    open,
    warm(link) {
      if (link.dataset.lightbox === BAND_GROUP) void fetchAlbum(link.href);
      void warm(itemOf(link));
    },
  };
  apis.set(dialog, api);

  // the album page opened at an item's address (`#item-<id>`) opens the lightbox there
  const id = idFromHash(location.hash);
  if (id && !dialog.open) {
    const link = [...document.querySelectorAll<HTMLAnchorElement>(`${LINKS}[data-lightbox="${ALBUM_GROUP}"]`)].find((a) => itemOf(a).id === id);
    if (link) open(link, false, true);
  }
  return api;
}
