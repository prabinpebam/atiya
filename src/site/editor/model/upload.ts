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
  if (text.trim()) return null;
  return files.find((f) => typeOf(f).startsWith('image/') || isVideoFile(f)) ?? null;
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

/** The preview's line: "1200 × 800 px, PNG, transparent", and the crop when there is one. */
export function describePicture(p: { width: number; height: number; type: string; alpha: boolean; crop?: { width: number; height: number } | null; converted?: boolean }): string {
  const parts = [`${p.width} × ${p.height} px`, formatLabel(p.type)];
  if (p.alpha) parts.push('transparent');
  let s = parts.join(', ');
  if (p.crop) s += `. Cropped to ${p.crop.width} × ${p.crop.height} px`;
  if (p.converted) s += '. Uploads as a PNG';
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

/** Why a video can't be uploaded because of its size, or null when it can. */
export function videoSizeIssue(bytes: number): string | null {
  if (bytes < MAX_VIDEO_BYTES) return null;
  return `It's ${megabytes(bytes)}: a video must be under 100 MB, GitHub's limit for a file. Make it shorter or smaller (HandBrake's "Fast 1080p30" preset usually does it), then choose it again.`;
}

/** "34.2 MB". */
export const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;

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
