/**
 * The upload form (documentation/editor/spec.md §6), in the picker and the media library: a picture
 * chosen, dropped or pasted shows at once (on a checkerboard, so transparency shows), with its size and
 * format; it can be cropped before it's uploaded (the crop dialog's local mode: the server cuts it from the
 * file, at full quality); a format the server can't read is turned into a PNG here first (transparency
 * kept). A picture can also be handed to it (the canvas's paste) with a `media:file` event on the grid.
 */
import { announce, api, describeIssue, saveStatus } from './client';
import { canCrop, openCrop } from './crop';
import { describePicture, describeVideo, formatLabel, isVideoFile, keptAsIs, mayHaveAlpha, needsConversion, pastedName, pictureOfPaste, pictureSizeIssue, pngName, posterTime, typeOf, videoSizeIssue, videoTypeOf } from '../model/upload';
import type { Rect } from '../model/crop';

/** A video chosen: its file and what this browser read of it (media.md §12). */
interface ChosenVideo {
  file: File;
  url: string;
  type: string;
  width: number;
  height: number;
  duration: number;
  /** A frame from it, as its poster. */
  poster: Blob | null;
}

/** Waits for a media element's event, or gives up after `ms` (a file this browser can't play never fires it). */
const once = (el: HTMLMediaElement, event: string, ms = 20_000) =>
  new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      el.removeEventListener(event, yes);
      el.removeEventListener('error', no);
      clearTimeout(timer);
      resolve(ok);
    };
    const yes = () => done(true);
    const no = () => done(false);
    const timer = window.setTimeout(no, ms);
    el.addEventListener(event, yes);
    el.addEventListener('error', no);
  });

/** A frame of the video where it stands, as a WebP (a PNG where the browser can't make one), at most 2560 px. */
async function frameOf(video: HTMLVideoElement): Promise<Blob | null> {
  const k = Math.min(1, 2560 / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(video.videoWidth * k));
  c.height = Math.max(1, Math.round(video.videoHeight * k));
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(video, 0, 0, c.width, c.height);
  const webp = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.9));
  return webp?.type === 'image/webp' ? webp : new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
}

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
  const clipEl = preview.querySelector<HTMLVideoElement>('[data-upload-video]');
  let chosen: Chosen | null = null;
  let clip: ChosenVideo | null = null;
  let loading = 0;

  const say = (text: string) => {
    issue.textContent = text;
    issue.hidden = !text;
  };
  const drop = () => {
    if (chosen) URL.revokeObjectURL(chosen.url);
    if (clip) URL.revokeObjectURL(clip.url);
    chosen = null;
    clip = null;
    if (clipEl) {
      clipEl.removeAttribute('src');
      clipEl.load();
    }
  };
  signal.addEventListener('abort', drop);
  /** The fields for what's chosen: a picture's alt text, or a video's title. */
  const fieldsFor = (kind: 'image' | 'video') => form.querySelectorAll<HTMLElement>('[data-upload-for]').forEach((f) => (f.hidden = f.dataset.uploadFor !== kind));

  const render = () => {
    preview.hidden = !chosen && !clip;
    if (clipEl) clipEl.hidden = !clip;
    fieldsFor(clip ? 'video' : 'image');
    if (clip) {
      stage.hidden = true;
      cropWrap.hidden = uncropWrap.hidden = true;
      facts.textContent = describeVideo({ width: clip.width, height: clip.height, type: clip.type, duration: clip.duration, bytes: clip.file.size });
      return;
    }
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
      ? describePicture({ width: c.width, height: c.height, type: c.type, alpha: c.alpha, crop: c.rect, converted: c.converted, bytes: c.file.size })
      : `${formatLabel(c.type)}. This browser can't show it, but it uploads as it is.`;
    // a GIF is kept exactly as it is: cutting it would re-encode it
    cropWrap.hidden = !c.shown || !canCrop() || keptAsIs(c.type);
    uncropWrap.hidden = !c.rect;
  };

  /** A video chosen: under 100 MB, of a kind the site takes, and playable here (or a reader couldn't play it either). */
  const loadVideo = async (file: File, mine: number) => {
    const type = videoTypeOf(file);
    if (!type) {
      render();
      return say(`${file.name} is a video the site can't show. Save it as an MP4 (H.264) or a WebM, then choose it again.`);
    }
    const big = videoSizeIssue(file.size);
    if (big) {
      render();
      return say(big);
    }
    if (!clipEl) return;
    const url = URL.createObjectURL(file);
    clipEl.src = url;
    const ok = (await once(clipEl, 'loadedmetadata')) && clipEl.videoWidth > 0 && clipEl.videoHeight > 0;
    if (mine !== loading) return URL.revokeObjectURL(url);
    if (!ok) {
      URL.revokeObjectURL(url);
      clipEl.removeAttribute('src');
      render();
      return say(`This browser can't play ${file.name}, so readers' browsers may not either. Save it as an MP4 (H.264) or a WebM, then choose it again.`);
    }
    const duration = Number.isFinite(clipEl.duration) ? clipEl.duration : 0;
    // the poster: a frame a second in (a tenth of a short one), where the first is often black
    clipEl.currentTime = posterTime(duration);
    await once(clipEl, 'seeked', 10_000);
    const poster = await frameOf(clipEl).catch(() => null);
    if (mine !== loading) return URL.revokeObjectURL(url);
    clip = { file, url, type, width: clipEl.videoWidth, height: clipEl.videoHeight, duration, poster };
    render();
  };

  const load = async (file: File | undefined) => {
    const mine = ++loading;
    say('');
    drop();
    if (!file) return render();
    if (isVideoFile(file)) return loadVideo(file, mine);
    const type = typeOf(file);
    if (!type.startsWith('image/')) {
      render();
      return say(`${file.name} isn't a picture or a video. Choose a JPEG, PNG, WebP, AVIF, GIF, SVG or another picture, or an MP4, WebM or MOV video.`);
    }
    const big = pictureSizeIssue(type, file.size);
    if (big) {
      render();
      return say(big);
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

  /** Puts a picture (or a video) in the form, as if chosen: from a paste here or on the canvas. */
  const take = (file: File) => {
    const video = isVideoFile(file);
    const named = video ? file : new File([file], pastedName(file.name, typeOf(file), new Date()), { type: typeOf(file) || file.type });
    const list = new DataTransfer();
    list.items.add(named);
    input.files = list.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (details) details.open = true;
    form.querySelector<HTMLElement>(video ? 'input[name="title"]' : 'textarea[name="alt"]')?.focus();
    announce(video ? `Pasted ${named.name}. Give it a title, then upload it.` : `Pasted ${named.name}. Add its alt text, then upload it.`);
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

  /** A video: its file, its poster frame, its size and length, its title and caption. */
  const uploadVideo = async (c: ChosenVideo) => {
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (!title) return say('Give the video a title: what it is, in a few words.');
    const data = new FormData();
    data.set('file', c.file, c.file.name);
    if (c.poster) data.set('poster', c.poster, c.poster.type === 'image/webp' ? 'poster.webp' : 'poster.png');
    data.set('title', title);
    data.set('caption', String(new FormData(form).get('caption') ?? ''));
    data.set('width', String(c.width));
    data.set('height', String(c.height));
    data.set('duration', String(c.duration));
    data.set('owner', root.dataset.owner ?? 'shared');
    say('');
    if (submit) submit.disabled = true;
    saveStatus.saving();
    const r = await api<{ id: string }>('POST', 'media', data);
    if (submit) submit.disabled = false;
    if (!r.ok) {
      const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "Couldn't upload it.";
      saveStatus.failed(`Not uploaded: ${why}`);
      return say(why);
    }
    delete form.dataset.unsaved;
    saveStatus.saved(`Uploaded ${c.file.name}`);
    root.dispatchEvent(new CustomEvent('media:uploaded', { bubbles: true, detail: { id: r.data.id } }));
  };

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      if (clip) return uploadVideo(clip);
      if (!chosen) return say('Choose a picture or a video to upload.');
      const data = new FormData(form);
      if (!data.get('decorative') && !String(data.get('alt') ?? '').trim()) return say('Say what the picture shows (its alt text), or mark it decorative.');
      data.set('file', chosen.file, chosen.file.name);
      data.set('owner', root.dataset.owner ?? 'shared');
      if (chosen.rect) data.set('crop', JSON.stringify({ ...chosen.rect, of: { width: chosen.width, height: chosen.height } }));
      say('');
      if (submit) submit.disabled = true;
      saveStatus.saving();
      const r = await api<{ id: string }>('POST', 'media', data);
      if (submit) submit.disabled = false;
      if (!r.ok) {
        const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "Couldn't upload it.";
        saveStatus.failed(`Not uploaded: ${why}`);
        return say(why);
      }
      delete form.dataset.unsaved;
      saveStatus.saved(`Uploaded ${chosen.file.name}`);
      root.dispatchEvent(new CustomEvent('media:uploaded', { bubbles: true, detail: { id: r.data.id } }));
    },
    { signal },
  );
}
