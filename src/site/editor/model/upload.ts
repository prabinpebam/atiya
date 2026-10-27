/**
 * The upload form's rules (documentation/editor/spec.md §6), pure so they're unit-tested: which formats
 * the server reads as they are (the rest the browser turns into a PNG first, keeping transparency), what a
 * paste holds that's a picture, the name a pasted picture gets, and how the preview describes it.
 */

/** What sharp reads on the server, as they are. */
export const SERVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/tiff', 'image/svg+xml']);

const EXT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  apng: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** A file's type: its own, or from its extension when the system gives none. */
export function typeOf(file: { type: string; name: string }): string {
  if (file.type) return file.type.toLowerCase();
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  return EXT_TYPE[ext] ?? '';
}

/** Whether the browser must turn it into a PNG before the server can read it. */
export const needsConversion = (type: string) => !SERVER_TYPES.has(type);

/** Formats that can carry transparency, worth checking for it. */
export const mayHaveAlpha = (type: string) => !['image/jpeg'].includes(type);

const LABEL: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/tiff': 'TIFF',
  'image/svg+xml': 'SVG',
  'image/bmp': 'BMP',
  'image/x-icon': 'ICO',
  'image/vnd.microsoft.icon': 'ICO',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF',
};

/** A format in words ("PNG"). */
export function formatLabel(type: string): string {
  return LABEL[type] ?? (type.startsWith('image/') ? type.slice(6).toUpperCase() : 'Unknown format');
}

/** The picture a paste holds, or null. Text wins when there's any: an office app copies a picture of what
 * was selected along with its text, and that text is what's meant. A copied video file counts too.
 */
export function pictureOfPaste<F extends { type: string; name: string }>(files: readonly F[], text: string): F | null {
  return picturesOfPaste(files, text)[0] ?? null;
}

/** Every picture (and video file) a paste holds, in order, by pictureOfPaste's rule: none when there's text. */
export function picturesOfPaste<F extends { type: string; name: string }>(files: readonly F[], text: string): F[] {
  if (text.trim()) return [];
  return files.filter((f) => typeOf(f).startsWith('image/') || isVideoFile(f));
}

/** The name a pasted picture gets (a screenshot is often just "image.png"): pasted-picture-<date>.<ext>. */
export function pastedName(name: string, type: string, now: Date): string {
  const ext = Object.entries(EXT_TYPE).find(([, t]) => t === type)?.[0] ?? 'png';
  const own = name.replace(/\.[^.]+$/, '').trim().toLowerCase();
  if (own && own !== 'image' && own !== 'blob' && own !== 'untitled') return name;
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `pasted-picture-${d}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

/** The name a converted picture uploads as: the same, as a PNG. */
export const pngName = (name: string) => `${name.replace(/\.[^.]+$/, '') || 'picture'}.png`;

/** The preview's line: "1200 × 800 px, PNG, transparent", and the crop when there is one; a GIF says it's kept as it is, and its size. */
export function describePicture(p: { width: number; height: number; type: string; alpha: boolean; crop?: { width: number; height: number } | null; converted?: boolean; bytes?: number }): string {
  const parts = [`${p.width} × ${p.height} px`, formatLabel(p.type)];
  if (keptAsIs(p.type) && p.bytes) parts.push(megabytes(p.bytes));
  if (p.alpha) parts.push('transparent');
  let s = parts.join(', ');
  if (p.crop) s += `. Cropped to ${p.crop.width} × ${p.crop.height} px`;
  if (p.converted) s += '. Uploads as a PNG';
  if (keptAsIs(p.type)) s += '. Kept exactly as it is';
  if (keptAsIs(p.type) && (p.bytes ?? 0) > LARGE_VIDEO_BYTES) s += '. Over 50 MB: GitHub takes it, but warns about files this big';
  return `${s}.`;
}

// ---------- videos (documentation/content/media.md §12) ----------

/**
 * GitHub refuses a file of 100 MiB or more in a push, and the content is published by pushing it, so a
 * video stays under 100 MB (a little under GitHub's 104,857,600 bytes).
 */
export const MAX_VIDEO_BYTES = 100_000_000;
/** GitHub warns about a file over 50 MiB (it still takes it). */
export const LARGE_VIDEO_BYTES = 50 * 1024 * 1024;

const VIDEO_EXT: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
const VIDEO_LABEL: Record<string, string> = { 'video/mp4': 'MP4', 'video/webm': 'WebM', 'video/quicktime': 'MOV', 'video/x-m4v': 'MP4' };

/** A video's type, from the file's own or its extension; '' when it isn't a video the site takes. */
export function videoTypeOf(file: { type: string; name: string }): string {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  const t = (file.type || VIDEO_EXT[ext] || '').toLowerCase();
  return t === 'video/x-m4v' ? 'video/mp4' : Object.values(VIDEO_EXT).includes(t) ? t : '';
}

/** Whether a file is a video at all (one the site takes or not), by its type or extension. */
export const isVideoFile = (file: { type: string; name: string }) => file.type.startsWith('video/') || /\.(mp4|m4v|webm|mov|mkv|avi|wmv|3gp)$/i.test(file.name);

/** A picture uploads at up to 20 MB: it's saved smaller (a WebP master within the budgets). */
export const MAX_PICTURE_BYTES = 20 * 1024 * 1024;
/**
 * A GIF is kept exactly as it is, never re-encoded (media.md §4): its look rarely survives a conversion. So
 * its only limit is the one a video has, GitHub's for a file.
 */
export const MAX_GIF_BYTES = MAX_VIDEO_BYTES;

/** Whether a picture of this type is kept as it is rather than saved as a WebP master. */
export const keptAsIs = (type: string) => type === 'image/gif';

/** Why a picture can't be uploaded because of its size, or null when it can. */
export function pictureSizeIssue(type: string, bytes: number): string | null {
  if (keptAsIs(type)) {
    if (bytes < MAX_GIF_BYTES) return null;
    return `It's ${megabytes(bytes)}: a GIF is kept as it is, so it must be under 100 MB, GitHub's limit for a file. Make it shorter or smaller, or save it as a video, then choose it again.`;
  }
  if (bytes <= MAX_PICTURE_BYTES) return null;
  return `It's ${megabytes(bytes)}: a picture can be up to 20 MB (it's saved smaller). Save a smaller copy, then choose it again.`;
}

/** Why a video can't be uploaded because of its size, or null when it can. */
export function videoSizeIssue(bytes: number): string | null {
  if (bytes < MAX_VIDEO_BYTES) return null;
  return `It's ${megabytes(bytes)}: a video must be under 100 MB, GitHub's limit for a file. Make it shorter or smaller (HandBrake's "Fast 1080p30" preset usually does it), then choose it again.`;
}

/** "34.2 MB". */
export const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;

// ---------- formats the site can't keep (gallery spec §4, D-G8) ----------

const RAW_EXT = ['cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'dng', 'orf', 'rw2', 'raf', 'srw', 'pef', 'x3f', 'erf', 'kdc', 'mrw', 'mos', '3fr', 'iiq', 'rwl', 'raw'];

/**
 * Why a file the site can't keep is refused, with what to do, or null when it's fine (the table in gallery
 * spec §4): JPEG XL, camera RAW and PSD are exported as JPEG or PNG first; MKV, AVI, WMV and 3GP saved as
 * MP4. A HEIC the browser can't open says so where it's opened (`HEIC_REFUSED`).
 */
export function refusedFormat(file: { type: string; name: string }): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  const type = file.type.toLowerCase();
  if (ext === 'jxl' || type === 'image/jxl') return 'This is a JPEG XL picture, which the site can\'t keep. Export it as JPEG or PNG, then add it.';
  if (RAW_EXT.includes(ext) || /^image\/x-(canon|nikon|sony|adobe-dng|olympus|panasonic|fuji|samsung|pentax|dcraw)/.test(type) || type === 'image/x-dcraw') return 'This is a camera RAW file, which the site can\'t keep. Export it as JPEG or PNG from your photo app, then add it.';
  if (ext === 'psd' || ext === 'psb' || type === 'image/vnd.adobe.photoshop' || type === 'image/x-photoshop' || type === 'application/x-photoshop') return 'This is a Photoshop file, which the site can\'t keep. Export it as PNG or JPEG, then add it.';
  if (['mkv', 'avi', 'wmv', '3gp', '3g2'].includes(ext) || /^video\/(x-matroska|x-msvideo|avi|x-ms-wmv|3gpp2?)$/.test(type)) return `This ${ext ? `${ext.toUpperCase()} ` : ''}video is in a format the site can't keep. Save it as MP4 (HandBrake does it), then add it.`;
  return null;
}

/** A HEIC or HEIF this browser can't open (it's turned into a PNG in the browser first). */
export const HEIC_REFUSED = "This browser can't open HEIC. Export it as JPEG, then add it.";

/** What the upload form says before saving an animated PNG (gallery spec §4): sharp reads its first frame only. */
export const APNG_NOTE = 'This animated PNG will be kept as a still picture. To keep it moving, save it as a GIF or an animated WebP.';

/** Whether a PNG is animated (an APNG): it has an `acTL` chunk before its first `IDAT`. */
export function isApng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || sig.some((v, i) => bytes[i] !== v)) return false;
  let at = 8;
  while (at + 8 <= bytes.length) {
    const len = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    at += 12 + len;
  }
  return false;
}

// ---------- SVG: a drawing or a picture (gallery spec §4.1) ----------

/** The largest SVG kept as a drawing (the same as the sanitizer's). */
export const SVG_DRAWING_MAX_BYTES = 200 * 1024;

/** How an SVG can be kept: as a drawing (at most 200 KB, the default then) or turned into a picture (always). */
export function svgChoices(bytes: number): { drawing: boolean; default: 'drawing' | 'picture' } {
  const drawing = bytes <= SVG_DRAWING_MAX_BYTES;
  return { drawing, default: drawing ? 'drawing' : 'picture' };
}

// ---------- keep it large (gallery spec §4) ----------

/** A master's longest side: 2560 px, or 3840 px kept large. */
export const MAX_SIDE = 2560;
export const MAX_LARGE_SIDE = 3840;

/** Whether "Keep it large" is offered: a raster still picture bigger than 2560 px (not a GIF or a drawing). */
export const canKeepLarge = (p: { width: number; height: number; type: string; animated?: boolean }) =>
  Math.max(p.width, p.height) > MAX_SIDE && !keptAsIs(p.type) && p.type !== 'image/svg+xml' && !p.animated;

/** What a file chosen offers before it's saved (gallery spec §4, §4.1): an SVG's choice, and Keep it large. */
export interface UploadOptions {
  /** An SVG: whether it can be kept as a drawing, and which choice starts selected; null for anything else. */
  svg: { drawing: boolean; default: 'drawing' | 'picture' } | null;
  /** "Keep it large" is offered. */
  large: boolean;
}

/** The choices an upload (or a Replace) offers for a file of this type, size and shape. */
export function uploadOptions(f: { type: string; bytes: number; width: number; height: number; animated?: boolean }): UploadOptions {
  const svg = f.type === 'image/svg+xml' ? svgChoices(f.bytes) : null;
  return { svg, large: !svg && canKeepLarge(f) };
}

/** "a, b and c". */
const listed = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** What the status line says a drawing's cleaning took out (the server's `removed`), or '' when it took nothing. */
export function removedNote(removed: readonly string[] | undefined): string {
  return removed?.length ? `Cleaned before saving: took out ${listed([...removed])}.` : '';
}

// ---------- the focus point (gallery spec §4, D-G16) ----------

/**
 * The focus point (the sidecar's `focus`, "x% y%") from where an attention crop was cut: a crop of
 * `crop.width` × `crop.height` taken `left`, `top` pixels into a picture of `width` × `height` has its
 * centre there. sharp reports the offsets as negatives (cropOffsetLeft/Top); either sign is read.
 */
export function focusPercent(picture: { width: number; height: number }, crop: { left: number; top: number; width: number; height: number }): string {
  const pct = (offset: number, size: number, whole: number) => {
    if (!(whole > 0)) return 50;
    const centre = Math.abs(offset) + Math.min(size, whole) / 2;
    return Math.max(0, Math.min(100, Math.round((centre / whole) * 100)));
  };
  return `${pct(crop.left, crop.width, picture.width)}% ${pct(crop.top, crop.height, picture.height)}%`;
}

/** Merges two focus measures (one from a crop across, one from a crop down): x from the first, y from the second. */
export function joinFocus(across: string, down: string): string {
  return `${across.split(' ')[0]} ${down.split(' ')[1]}`;
}

/** A length in seconds as "1:23" (or "1:02:03"). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The preview's line for a video: "1920 × 1080 px, MP4, 1:23, 34.2 MB", with GitHub's warning past 50 MB. */
export function describeVideo(v: { width: number; height: number; type: string; duration: number; bytes: number }): string {
  let s = `${v.width} × ${v.height} px, ${VIDEO_LABEL[v.type] ?? 'Video'}, ${clock(v.duration)}, ${megabytes(v.bytes)}.`;
  if (v.type === 'video/quicktime') s += ' Saved as an MP4.';
  if (v.bytes > LARGE_VIDEO_BYTES) s += ' Over 50 MB: GitHub takes it, but warns about files this big.';
  return s;
}

/** Where the poster frame is taken: a second in, or a tenth of a short video (its very first frame is often black). */
export const posterTime = (duration: number) => (Number.isFinite(duration) && duration > 0 ? Math.min(1, duration / 10) : 0);
