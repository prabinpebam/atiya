/**
 * The upload form (documentation/editor/spec.md §6), in the picker and the media library: a picture
 * chosen, dropped or pasted shows at once (on a checkerboard, so transparency shows), with its size and
 * format; it can be cropped before it's uploaded (the crop dialog's local mode: the server cuts it from the
 * file, at full quality); a format the server can't read is turned into a PNG here first (transparency
 * kept). A picture can also be handed to it (the canvas's paste) with a `media:file` event on the grid.
 */
import { announce, api, describeIssue } from './client';
import { canCrop, openCrop } from './crop';
import { describePicture, formatLabel, mayHaveAlpha, needsConversion, pastedName, pictureOfPaste, pngName, typeOf } from '../model/upload';
import type { Rect } from '../model/crop';

interface Chosen {
  file: File;
  url: string;
  type: string;
  width: number;
  height: number;
  alpha: boolean;
  converted: boolean;
  /** The browser can show it (it can't show a TIFF, which still uploads). */
  shown: boolean;
  rect: Rect | null;
}

/** The picture's size as this browser shows it, or null if it can't. */
const measure = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });

/** Whether any pixel is see-through, from a small copy. */
function seeThrough(img: HTMLImageElement): boolean {
  try {
    const k = Math.min(1, 128 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return false;
    g.drawImage(img, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 255) return true;
  } catch {
    // a picture the canvas won't read back: say nothing about it
  }
  return false;
}

/** A picture the server can't read, drawn into a PNG (its transparency kept). */
async function toPng(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('not drawn');
  return new File([blob], pngName(file.name), { type: 'image/png' });
}

export function initUpload(root: HTMLElement, signal: AbortSignal) {
  const form = root.querySelector<HTMLFormElement>('[data-editor-upload]');
  const input = form?.querySelector<HTMLInputElement>('input[type="file"]');
  const preview = form?.querySelector<HTMLElement>('[data-upload-preview]');
  if (!form || !input || !preview) return;
  const details = form.closest('details');
  const stage = preview.querySelector<HTMLElement>('[data-upload-stage]')!;
  const view = preview.querySelector<HTMLElement>('[data-upload-view]')!;
  const img = preview.querySelector<HTMLImageElement>('[data-upload-img]')!;
  const facts = preview.querySelector<HTMLElement>('[data-upload-facts]')!;
  const cropWrap = preview.querySelector<HTMLElement>('[data-upload-crop-wrap]')!;
  const uncropWrap = preview.querySelector<HTMLElement>('[data-upload-uncrop-wrap]')!;
  const issue = form.querySelector<HTMLElement>('[data-editor-form-issue]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  let chosen: Chosen | null = null;
  let loading = 0;

  const say = (text: string) => {
    issue.textContent = text;
    issue.hidden = !text;
  };
  const drop = () => {
    if (chosen) URL.revokeObjectURL(chosen.url);
    chosen = null;
  };
  signal.addEventListener('abort', drop);

  const render = () => {
    preview.hidden = !chosen;
    if (!chosen) return;
    const c = chosen;
    stage.hidden = !c.shown;
    if (c.shown) {
      const r = c.rect ?? { x: 0, y: 0, width: c.width, height: c.height };
      if (img.getAttribute('src') !== c.url) img.src = c.url;
      // the crop shown by framing the whole picture: its size and place in percentages of the crop
      view.style.setProperty('--ratio', String(r.width / r.height));
      view.style.setProperty('--iw', `${(c.width / r.width) * 100}%`);
      view.style.setProperty('--il', `${(-r.x / r.width) * 100}%`);
      view.style.setProperty('--it', `${(-r.y / r.height) * 100}%`);
    }
    facts.textContent = c.shown
      ? describePicture({ width: c.width, height: c.height, type: c.type, alpha: c.alpha, crop: c.rect, converted: c.converted })
      : `${formatLabel(c.type)}. This browser can't show it, but it uploads as it is.`;
    cropWrap.hidden = !c.shown || !canCrop();
    uncropWrap.hidden = !c.rect;
  };

  const load = async (file: File | undefined) => {
    const mine = ++loading;
    say('');
    drop();
    if (!file) return render();
    const type = typeOf(file);
    if (!type.startsWith('image/')) {
      render();
      return say(`${file.name} isn't a picture. Choose a JPEG, PNG, WebP, AVIF, GIF, SVG or another picture.`);
    }
    let up = file;
    let converted = false;
    if (needsConversion(type)) {
      try {
        up = await toPng(file);
        converted = true;
      } catch {
        render();
        return say(`This browser can't read ${formatLabel(type)} pictures. Save it as a JPEG or PNG and choose it again.`);
      }
    }
    const url = URL.createObjectURL(up);
    const shown = await measure(url);
    if (mine !== loading) return URL.revokeObjectURL(url);
    chosen = {
      file: up,
      url,
      type,
      width: shown?.naturalWidth ?? 0,
      height: shown?.naturalHeight ?? 0,
      alpha: !!shown && mayHaveAlpha(type) && seeThrough(shown),
      converted,
      shown: !!shown,
      rect: null,
    };
    render();
  };

  /** Puts a picture in the form, as if chosen: from a paste here or on the canvas. */
  const take = (file: File) => {
    const named = new File([file], pastedName(file.name, typeOf(file), new Date()), { type: typeOf(file) || file.type });
    const list = new DataTransfer();
    list.items.add(named);
    input.files = list.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (details) details.open = true;
    form.querySelector<HTMLTextAreaElement>('textarea[name="alt"]')?.focus();
    announce(`Pasted ${named.name}. Add its alt text, then upload it.`);
  };

  input.addEventListener('change', () => void load(input.files?.[0]), { signal });
  root.addEventListener('media:file', (e) => take((e as CustomEvent<{ file: File }>).detail.file), { signal });

  // a picture pasted while the form can be seen (the picker open, or the library)
  document.addEventListener(
    'paste',
    (e) => {
      const dialog = root.closest('dialog');
      if ((dialog && !dialog.open) || document.querySelector('dialog#crop[open]')) return;
      const data = e.clipboardData;
      const pic = data ? pictureOfPaste([...data.files], data.getData('text/plain')) : null;
      if (!pic) return;
      e.preventDefault();
      take(pic);
    },
    { signal },
  );

  preview.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      if (!chosen) return;
      if (t.closest('[data-upload-uncrop]')) {
        chosen.rect = null;
        render();
        return announce('The whole picture uploads');
      }
      if (!t.closest('[data-upload-crop]')) return;
      const c = chosen;
      openCrop({
        local: { src: c.url, width: c.width, height: c.height },
        rect: c.rect,
        onCrop: (r) => {
          if (chosen !== c) return;
          c.rect = r.x === 0 && r.y === 0 && r.width === c.width && r.height === c.height ? null : r;
          render();
        },
      });
    },
    { signal },
  );

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      if (!chosen) return say('Choose a picture to upload.');
      const data = new FormData(form);
      if (!data.get('decorative') && !String(data.get('alt') ?? '').trim()) return say('Say what the picture shows (its alt text), or mark it decorative.');
      data.set('file', chosen.file, chosen.file.name);
      data.set('owner', root.dataset.owner ?? 'shared');
      if (chosen.rect) data.set('crop', JSON.stringify({ ...chosen.rect, of: { width: chosen.width, height: chosen.height } }));
      say('');
      if (submit) submit.disabled = true;
      announce('Uploading\u2026');
      const r = await api<{ id: string }>('POST', 'media', data);
      if (submit) submit.disabled = false;
      if (!r.ok) return say((r.data.issues ?? []).map(describeIssue).join(' ') || "Couldn't upload it.");
      root.dispatchEvent(new CustomEvent('media:uploaded', { bubbles: true, detail: { id: r.data.id } }));
    },
    { signal },
  );
}
