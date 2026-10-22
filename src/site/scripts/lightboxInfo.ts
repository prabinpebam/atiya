/**
 * The lightbox's info panel and Copy link (tier 0; docs: documentation/gallery/spec.md §8.3, §8.6): the
 * caption, the description, the date taken and the place, the credit, a video's length, an embed's link
 * to its provider, Download where it's allowed, the album and its link, and Copy a link to the item's
 * canonical address. Info and the I key open and close it; the choice is kept for the visit. The words are
 * pure in `lightboxRules.ts`.
 */
import {
  INFO_KEY,
  downloadLabel,
  downloadName,
  downloadable,
  fromAlbum,
  infoKept,
  itemAddress,
  lengthWords,
  fileSlug,
  takenLine,
  watchOn,
  type LightboxItem,
} from './lightboxRules';

/** Where the open item belongs: its album's address here and on the site, its title, and whether this is the album's own page. */
export interface InfoContext {
  albumUrl: string;
  /** The album page's address on the site (in the planet's frame, not the building's): Copy link's. */
  siteUrl: string;
  albumTitle: string;
  onAlbumPage: boolean;
}

export interface Info {
  /** Whether the group is an album's (the panel, Info and Copy link are offered). */
  offer(on: boolean): void;
  fill(item: LightboxItem, ctx: InfoContext): void;
  toggle(open?: boolean): void;
  isOpen(): boolean;
}

const stored = (): string | null => {
  try {
    return sessionStorage.getItem(INFO_KEY);
  } catch {
    return null;
  }
};
const keep = (open: boolean) => {
  try {
    sessionStorage.setItem(INFO_KEY, open ? 'open' : 'closed');
  } catch {
    // private browsing: the choice lasts while the page does
  }
};

export function setupInfo(dialog: HTMLDialogElement, onChange: () => void): Info | undefined {
  const q = <T extends HTMLElement>(s: string) => dialog.querySelector<T>(s);
  const shell = q('[data-lightbox-shell]');
  const panel = q('[data-lightbox-panel]');
  const tools = q('[data-lightbox-album-tools]');
  const button = q<HTMLButtonElement>('[data-lightbox-info]');
  const status = q('[data-lightbox-status]');
  const download = q<HTMLAnchorElement>('[data-lightbox-download]');
  const openAlbum = q<HTMLAnchorElement>('[data-lightbox-open-album]');
  const fieldWrap = q('[data-lightbox-copy-field]');
  if (!shell || !panel || !tools || !button || !status || !download || !openAlbum || !fieldWrap) return undefined;
  const part = (name: string) => panel.querySelector<HTMLElement>(`[data-info="${name}"]`)!;
  const label = (el: HTMLElement) => el.querySelector<HTMLElement>('.label') ?? el;

  let offered = false;
  let open = infoKept(stored());
  let address = '';

  const show = () => {
    const on = offered && open;
    panel.hidden = !on;
    shell.toggleAttribute('data-info-open', on);
    button.setAttribute('aria-pressed', String(on));
    onChange();
  };

  const set = (name: string, text: string) => {
    const el = part(name);
    el.textContent = text;
    el.hidden = !text;
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(address);
      fieldWrap.hidden = true;
      status.textContent = '';
      requestAnimationFrame(() => (status.textContent = 'Link copied'));
    } catch {
      // where the clipboard can't be written: the address, selected, to copy by hand
      const input = fieldWrap.querySelector<HTMLInputElement>('input')!;
      input.readOnly = true;
      input.value = address;
      if (!open) {
        open = true;
        show();
      }
      fieldWrap.hidden = false;
      input.focus();
      input.select();
    }
  };
  dialog.querySelectorAll<HTMLButtonElement>('[data-lightbox-copy]').forEach((b) => b.addEventListener('click', () => void copy()));
  button.addEventListener('click', () => api.toggle());
  q('[data-lightbox-more]')?.addEventListener('click', () => api.toggle(true));

  const api: Info = {
    offer(on) {
      offered = on;
      tools.hidden = !on;
      show();
    },
    fill(item, ctx) {
      const w = item.words ?? {};
      set('caption', item.caption);
      const description = part('description');
      description.innerHTML = w.description ?? '';
      description.closest<HTMLElement>('[data-info-description]')!.hidden = !w.description;
      set('taken', takenLine(w.taken, w.place));
      set('credit', w.credit ?? '');
      set('length', item.kind === 'video' || item.kind === 'embed' ? lengthWords(item.duration) : '');
      const watch = part('watch') as HTMLAnchorElement;
      const watching = item.kind === 'embed' && !!item.href;
      watch.parentElement!.hidden = !watching;
      if (watching) {
        watch.href = item.href;
        watch.textContent = watchOn(item.href);
      }
      const can = !!item.download && downloadable(item.kind, undefined, true);
      download.parentElement!.hidden = !can;
      if (can) {
        download.href = item.download!;
        download.download = downloadName(fileSlug(ctx.albumTitle), item.id ?? 'item', item.download!);
        label(download).textContent = downloadLabel(item.kind);
      }
      set('album', ctx.albumTitle ? fromAlbum(ctx.albumTitle) : '');
      openAlbum.parentElement!.hidden = ctx.onAlbumPage || !ctx.albumUrl;
      openAlbum.href = ctx.albumUrl;
      address = item.id ? itemAddress(ctx.siteUrl, item.id) : ctx.siteUrl;
      fieldWrap.hidden = true;
    },
    toggle(next = !open) {
      if (!offered) return;
      open = next;
      keep(open);
      show();
    },
    isOpen: () => offered && open,
  };
  return api;
}
