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

/**
 * The picture a paste holds, or null. Text wins when there's any: an office app copies a picture of what
 * was selected along with its text, and that text is what's meant.
 */
export function pictureOfPaste<F extends { type: string; name: string }>(files: readonly F[], text: string): F | null {
  if (text.trim()) return null;
  return files.find((f) => typeOf(f).startsWith('image/')) ?? null;
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
