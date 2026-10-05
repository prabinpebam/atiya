/**
 * Media, as edit mode changes it (documentation/editor/spec.md §6): uploads (any format sharp reads: JPEG,
 * PNG, WebP, AVIF, GIF, TIFF, SVG; the browser turns others into PNG first) become WebP masters within
 * the budgets (at most 2560 px on the long side and 1.5 MB, metadata stripped, transparency kept), each
 * with its JSON sidecar, in one store transaction, cut first to a crop chosen before the upload, if any;
 * a sidecar's details save to the picture; a picture can have a dark mode version (a second master,
 * `<name>.dark.webp`, named in its sidecar), which its crops, its deletion and its replacement carry along;
 * a picture is cropped into a
 * copy, never in place (§6.1); a picture is deleted only when nothing refers to it (the content check
 * refuses a deletion that would leave a reference). A private page's media live in private-pages/ with it
 * (documentation/access/spec.md §8.2): an upload to its folder goes there, and every other change is made
 * where the picture or video already is.
 */
import { imageMedia, videoMedia, type ImageMedia, type VideoMedia } from '../../content/schema';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Change, type Result } from './store';
import { fileOf, readSnapshot } from '../../content/source';
import { existsSync } from 'node:fs';
import { slugify, unique } from '../model/ids';
import { ratioLabel, type Rect } from '../model/crop';
import { videoSizeIssue } from '../model/upload';

export const MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_SIDE = 2560;
export const MAX_UPLOAD = 20 * 1024 * 1024;
const OWNER = /^(shared|site|articles\/[a-z0-9]+(?:-[a-z0-9]+)*|people\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const MEDIA_ID = /^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/;

/** Where a picture's or video's files are: private-pages/ for a private page's media, else content/. */
const baseOf = (id: string) => (existsSync(fileOf(`/private/media/${id}.json`)) ? '/private/media/' : '/content/media/');
/** The folder an upload goes to: a private page's own folder is in private-pages/. */
function folderOf(owner: string): string {
  const page = /^articles\/(.+)$/.exec(owner)?.[1];
  return `${page && existsSync(fileOf(`/private/articles/${page}.json`)) ? '/private/media/' : '/content/media/'}${owner}/`;
}

const refuse = (file: string, message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file, message, ...(path ? { path } : {}) }] });

/** What sharp reads a picture with: an SVG is drawn at the size a master can be, not at its nominal 72 dpi. */
async function readOptions(input: Buffer): Promise<{ failOn: 'error'; density?: number; animated: false }> {
  const { default: sharp } = await import('sharp');
  const meta = await sharp(input, { failOn: 'error' }).metadata();
  if (meta.format !== 'svg' || !meta.width || !meta.height) return { failOn: 'error', animated: false };
  return { failOn: 'error', animated: false, density: Math.min(100000, Math.max(72, Math.round((72 * MAX_SIDE) / Math.max(meta.width, meta.height)))) };
}

/** A master in WebP within the budgets: lossless when the source has transparency (if it fits), stripped of metadata. */
export async function toMaster(input: Buffer): Promise<{ bytes: Buffer; width: number; height: number }> {
  const { default: sharp } = await import('sharp');
  const base = sharp(input, await readOptions(input)).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  const meta = await base.clone().metadata();
  const alpha = !!meta.hasAlpha;
  let bytes = alpha ? await base.clone().webp({ lossless: true }).toBuffer() : Buffer.alloc(0);
  for (let q = 88; !bytes.length || bytes.length > MAX_BYTES; q -= 6) {
    if (q < 60) throw new Error("can't be made small enough (1.5 MB) without losing too much: use a smaller picture");
    bytes = await base.clone().webp({ quality: q, alphaQuality: 100 }).toBuffer();
  }
  const out = await sharp(bytes).metadata();
  return { bytes, width: out.width ?? 0, height: out.height ?? 0 };
}

export interface Upload {
  file: { name: string; bytes: Buffer };
  owner: string;
  alt?: string;
  decorative?: boolean;
  caption?: string;
  /** A crop chosen before the upload, in the pixels of the picture as the browser showed it (`of`), upright. */
  crop?: Rect & { of: { width: number; height: number } };
}

/** The picture upright, cut to a crop given in another size of it (the browser's), as a lossless PNG. */
export async function cutUpload(input: Buffer, crop: NonNullable<Upload['crop']>): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  const upright = await sharp(input, await readOptions(input)).rotate().png().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const kx = width / crop.of.width;
  const ky = height / crop.of.height;
  if (![kx, ky, crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || kx <= 0 || ky <= 0) throw new Error('the crop is not a rectangle in the picture');
  const left = Math.min(width - 1, Math.max(0, Math.round(crop.x * kx)));
  const top = Math.min(height - 1, Math.max(0, Math.round(crop.y * ky)));
  const w = Math.min(width - left, Math.max(1, Math.round(crop.width * kx)));
  const h = Math.min(height - top, Math.max(1, Math.round(crop.height * ky)));
  return sharp(upright.data).extract({ left, top, width: w, height: h }).png().toBuffer();
}

/** The upload form's crop field (JSON), or null when it's empty or not a crop. */
export function parseUploadCrop(v: unknown): Upload['crop'] | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const c = JSON.parse(v) as Upload['crop'];
    const nums = c && [c.x, c.y, c.width, c.height, c.of?.width, c.of?.height];
    if (!nums || !nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0) || !c!.width || !c!.height || !c!.of.width || !c!.of.height) return null;
    return { x: c!.x, y: c!.y, width: c!.width, height: c!.height, of: { width: c!.of.width, height: c!.of.height } };
  } catch {
    return null;
  }
}

export async function upload(u: Upload): Promise<Result & { id?: string }> {
  if (!OWNER.test(u.owner)) return refuse('content/media', `"${u.owner}" isn't a media folder (shared, site, articles/<id> or people/<id>)`, 'owner');
  if (u.file.bytes.length > MAX_UPLOAD) return refuse('content/media', 'is larger than 20 MB', 'file');
  const snap = readSnapshot();
  const folder = folderOf(u.owner);
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/(?:\.dark)?\.\w+$/, '')));
  const name = unique(slugify(u.file.name.replace(/\.[^.]+$/, '')) || 'picture', taken);
  let master: Awaited<ReturnType<typeof toMaster>>;
  try {
    master = await toMaster(u.crop ? await cutUpload(u.file.bytes, u.crop) : u.file.bytes);
  } catch (e) {
    return refuse('content/media', `couldn't be read as a picture: ${(e as Error).message}`, 'file');
  }
  const sidecar: ImageMedia = {
    kind: 'image',
    file: `${name}.webp`,
    ...(u.decorative ? { decorative: true } : { alt: (u.alt ?? '').trim() }),
    ...(u.caption?.trim() ? { caption: u.caption.trim() } : {}),
    visibility: 'public',
  };
  const parsed = imageMedia.safeParse(sidecar);
  if (!parsed.success) return { ok: false, status: 422, issues: parsed.error.issues.map((i) => ({ file: `content/media/${u.owner}/${name}.json`, path: i.path.join('.'), message: i.message })) };
  const masterKey = `${folder}${name}.webp`;
  const sidecarKey = `${folder}${name}.json`;
  const r = await commit({ changes: [{ key: masterKey, bytes: master.bytes }, { key: sidecarKey, bytes: jsonBytes(sidecar) }], ifMatch: { [masterKey]: null, [sidecarKey]: null } });
  return r.ok ? { ...r, id: `${u.owner}/${name}` } : r;
}

export async function saveSidecar(id: string, sidecar: ImageMedia | VideoMedia, ifMatch: Record<string, string | null>): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `${baseOf(id)}${id}.json`;
  const current = readDoc<ImageMedia | VideoMedia>(key);
  if (!current) return refuse(key.slice(1), "doesn't exist");
  if (current.value.kind === 'video') {
    // a video's file, size, length and poster are its upload's: the details form changes only its words
    const v = current.value;
    const s = sidecar as Partial<VideoMedia>;
    const next: VideoMedia = {
      kind: 'video',
      file: v.file,
      title: (s.title ?? v.title).trim(),
      width: v.width,
      height: v.height,
      ...(v.duration ? { duration: v.duration } : {}),
      ...(v.poster ? { poster: v.poster } : {}),
      ...(s.caption?.trim() ? { caption: s.caption.trim() } : {}),
      ...(s.credit?.trim() ? { credit: s.credit.trim() } : {}),
      ...(s.licence?.name ? { licence: s.licence } : {}),
      ...(s.source ? { source: s.source } : {}),
      visibility: s.visibility ?? v.visibility,
    };
    return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: ifMatch[key] ?? null } });
  }
  const image = current.value as ImageMedia;
  // the master's file name is fixed (replacing a picture keeps its id and file), and its dark version is
  // set only by setDark and removeDark: the details form never changes either
  const { dark: _ignored, ...rest } = sidecar as ImageMedia;
  const next: ImageMedia = { ...rest, kind: 'image', file: image.file, ...(image.dark ? { dark: image.dark } : {}) };
  return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: ifMatch[key] ?? null } });
}

// ---------- videos (documentation/content/media.md §12) ----------

export interface VideoUpload {
  file: { name: string; bytes: Buffer };
  owner: string;
  title: string;
  caption?: string;
  /** What the browser read of it: its size (px) and length (s). */
  width: number;
  height: number;
  duration?: number;
  /** A frame from it, taken by the browser. */
  poster?: Buffer;
}

/** ffmpeg on the PATH (the owner's machine has it), or null: it's only needed for a MOV, and to make an MP4 start sooner. */
async function ffmpeg(): Promise<string | null> {
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    return null;
  }
}

/**
 * An MP4 or MOV rewritten as an MP4 with its index at the front (`+faststart`), so it plays before it's all
 * downloaded: the streams copied as they are (no re-encoding, no loss, the same size), or null when ffmpeg
 * isn't there or can't.
 */
async function remux(bytes: Buffer, ext: string): Promise<Buffer | null> {
  const bin = await ffmpeg();
  if (!bin) return null;
  const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFile } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'video-'));
  try {
    const src = join(dir, `in.${ext}`);
    const out = join(dir, 'out.mp4');
    writeFileSync(src, bytes);
    await new Promise<void>((resolve, reject) => execFile(bin, ['-y', '-v', 'error', '-i', src, '-map', '0', '-c', 'copy', '-movflags', '+faststart', out], { timeout: 120_000 }, (e) => (e ? reject(e) : resolve())));
    return readFileSync(out);
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function uploadVideo(u: VideoUpload): Promise<Result & { id?: string }> {
  if (!OWNER.test(u.owner)) return refuse('content/media', `"${u.owner}" isn't a media folder (shared, site, articles/<id> or people/<id>)`, 'owner');
  const tooBig = videoSizeIssue(u.file.bytes.length);
  if (tooBig) return refuse('content/media', tooBig, 'file');
  const ext = /\.([a-z0-9]+)$/i.exec(u.file.name)?.[1]?.toLowerCase() ?? '';
  if (!['mp4', 'm4v', 'webm', 'mov'].includes(ext)) return refuse('content/media', `${u.file.name} is a video the site can't show: save it as an MP4 (H.264) or a WebM`, 'file');
  if (!(u.width >= 1 && u.height >= 1)) return refuse('content/media', "its size wasn't read: choose it again", 'file');
  let bytes = u.file.bytes;
  let out: 'mp4' | 'webm' = ext === 'webm' ? 'webm' : 'mp4';
  if (ext !== 'webm') {
    const fast = await remux(bytes, ext);
    // a MOV can only be shown as an MP4; an MP4 that can't be rewritten is kept as it is
    if (fast) bytes = fast;
    else if (ext === 'mov') return refuse('content/media', "a MOV is saved as an MP4, which needs ffmpeg: install it, or save the video as an MP4 (H.264), then choose it again", 'file');
    out = 'mp4';
  }
  const again = videoSizeIssue(bytes.length);
  if (again) return refuse('content/media', again, 'file');
  const snap = readSnapshot();
  const folder = folderOf(u.owner);
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/(?:\.dark|\.poster)?\.\w+$/, '')));
  const name = unique(slugify(u.file.name.replace(/\.[^.]+$/, '')) || 'video', taken);
  let poster: Awaited<ReturnType<typeof toMaster>> | null = null;
  if (u.poster?.length) {
    try {
      poster = await toMaster(u.poster);
    } catch {
      poster = null;
    }
  }
  const sidecar: VideoMedia = {
    kind: 'video',
    file: `${name}.${out}`,
    title: u.title.trim(),
    width: Math.round(u.width),
    height: Math.round(u.height),
    ...(u.duration && u.duration > 0 ? { duration: Math.round(u.duration * 100) / 100 } : {}),
    ...(poster ? { poster: { file: `${name}.poster.webp` } } : {}),
    ...(u.caption?.trim() ? { caption: u.caption.trim() } : {}),
    visibility: 'public',
  };
  const parsed = videoMedia.safeParse(sidecar);
  if (!parsed.success) return { ok: false, status: 422, issues: parsed.error.issues.map((i) => ({ file: `content/media/${u.owner}/${name}.json`, path: i.path.join('.'), message: i.message })) };
  const videoKey = `${folder}${sidecar.file}`;
  const sidecarKey = `${folder}${name}.json`;
  const changes: Change[] = [{ key: videoKey, bytes }, { key: sidecarKey, bytes: jsonBytes(sidecar) }];
  const ifMatch: Record<string, string | null> = { [videoKey]: null, [sidecarKey]: null };
  if (poster) {
    const posterKey = `${folder}${name}.poster.webp`;
    changes.push({ key: posterKey, bytes: poster.bytes });
    ifMatch[posterKey] = null;
  }
  const r = await commit({ changes, ifMatch });
  return r.ok ? { ...r, id: `${u.owner}/${name}` } : r;
}

/** Replaces a picture's master, keeping its id and its sidecar (its dark version stays as it is). */
export async function replaceMaster(id: string, bytes: Buffer): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `${baseOf(id)}${id}.json`;
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const masterKey = key.replace(/[^/]+\.json$/, sc.value.file);
  if (!sc.value.file.endsWith('.webp')) return refuse(key.slice(1), 'only a WebP master can be replaced here');
  const master = await toMaster(bytes);
  return commit({ changes: [{ key: masterKey, bytes: master.bytes }], ifMatch: { [masterKey]: versionOf(readFile(masterKey)) } });
}

const sidecarKey = (id: string) => `${baseOf(id)}${id}.json`;
const masterKeyOf = (id: string, sc: ImageMedia) => `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${sc.file}`;
const darkKeyOf = (id: string, sc: ImageMedia) => (sc.dark ? `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${sc.dark.file}` : null);
/** Where a picture's dark version goes: beside its master, `<name>.dark.webp`. */
const darkFileOf = (id: string) => `${id.slice(id.lastIndexOf('/') + 1)}.dark.webp`;

/**
 * Adds a picture's dark mode version, or replaces it (documentation/editor/spec.md §6.2): a master like
 * every other (WebP, within the budgets, transparency kept), beside the picture as `<name>.dark.webp`,
 * named in its sidecar, in one transaction. Answers both sizes, so the editor can say when the two
 * shapes differ (a page shifts when the theme changes).
 */
export async function setDark(id: string, bytes: Buffer, crop?: Upload['crop']): Promise<Result & { width?: number; height?: number; lightWidth?: number; lightHeight?: number }> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = sidecarKey(id);
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  let master: Awaited<ReturnType<typeof toMaster>>;
  try {
    master = await toMaster(crop ? await cutUpload(bytes, crop) : bytes);
  } catch (e) {
    return refuse(key.slice(1), `couldn't be read as a picture: ${(e as Error).message}`, 'file');
  }
  const darkKey = `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${darkFileOf(id)}`;
  const oldKey = darkKeyOf(id, sc.value);
  const changes: Change[] = [
    { key: darkKey, bytes: master.bytes },
    { key, bytes: jsonBytes({ ...sc.value, dark: { file: darkFileOf(id) } }) },
  ];
  const ifMatch: Record<string, string | null> = { [darkKey]: versionOf(readFile(darkKey)), [key]: sc.version };
  // a dark version kept in another format before: this one replaces it
  if (oldKey && oldKey !== darkKey) {
    changes.push({ key: oldKey, bytes: null });
    ifMatch[oldKey] = versionOf(readFile(oldKey));
  }
  const res = await commit({ changes, ifMatch });
  if (!res.ok) return res;
  const { default: sharp } = await import('sharp');
  const light = await sharp(readFile(masterKeyOf(id, sc.value))!).metadata();
  return { ...res, width: master.width, height: master.height, lightWidth: light.width, lightHeight: light.height };
}

/** Removes a picture's dark mode version: the same picture shows in both modes again. */
export async function removeDark(id: string): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = sidecarKey(id);
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const darkKey = darkKeyOf(id, sc.value);
  if (!darkKey) return refuse(key.slice(1), 'has no dark version', 'dark');
  const { dark: _d, ...rest } = sc.value;
  return commit({
    changes: [
      { key, bytes: jsonBytes(rest) },
      { key: darkKey, bytes: null },
    ],
    ifMatch: { [key]: sc.version, [darkKey]: versionOf(readFile(darkKey)) },
  });
}

/**
 * Where a picture is cropped from: a cropped copy's original while it's still there (so a copy can grow
 * back), else the picture itself. With the source's master, its size, and the copy's rectangle, if any.
 */
export async function cropSource(id: string): Promise<{ id: string; sidecar: ImageMedia; bytes: Buffer; width: number; height: number; rect: Rect | null; isCopy: boolean } | null> {
  if (!MEDIA_ID.test(id)) return null;
  const sc = readDoc<ImageMedia>(sidecarKey(id));
  if (!sc) return null;
  const from = sc.value.crop?.from;
  const original = from ? readDoc<ImageMedia>(sidecarKey(from)) : null;
  const src = original && from ? { id: from, sidecar: original.value } : { id, sidecar: sc.value };
  const bytes = readFile(masterKeyOf(src.id, src.sidecar));
  if (!bytes) return null;
  const { default: sharp } = await import('sharp');
  const m = await sharp(bytes).metadata();
  const width = m.width ?? 0;
  const height = m.height ?? 0;
  const c = sc.value.crop;
  // a copy whose original has gone is cropped from itself, whole
  const rect = c && original && c.x + c.width <= width && c.y + c.height <= height ? { x: c.x, y: c.y, width: c.width, height: c.height } : null;
  return { ...src, bytes, width, height, rect, isCopy: !!c };
}

/**
 * Crops a picture (documentation/editor/spec.md §6.1), never an original: cropping an original makes a
 * cropped copy beside it (its details copied, its focus left out, and where it came from in `crop`), and
 * cropping a copy cuts again from its original and updates the copy. `copy` asks for another copy even
 * of a copy (another use, another shape). The rectangle is in the source's pixels.
 */
export async function cropMedia(id: string, rect: Rect, opts: { copy?: boolean } = {}): Promise<Result & { id?: string; width?: number; height?: number }> {
  const src = await cropSource(id);
  if (!src) return refuse(`content/media/${id}.json`, "doesn't exist");
  const r = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  const whole = Object.values(r).every((v) => Number.isInteger(v));
  if (!whole || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x + r.width > src.width || r.y + r.height > src.height) {
    return refuse(`content/media/${id}.json`, `the crop must be whole pixels inside the picture (${src.width} × ${src.height})`, 'crop');
  }
  const { default: sharp } = await import('sharp');
  // cut losslessly, then encode once, within the budgets, as every master is
  const cut = await sharp(src.bytes).extract({ left: r.x, top: r.y, width: r.width, height: r.height }).png().toBuffer();
  let master: Awaited<ReturnType<typeof toMaster>>;
  try {
    master = await toMaster(cut);
  } catch (e) {
    return refuse(`content/media/${id}.json`, (e as Error).message, 'crop');
  }
  const crop = { from: src.id, ...r };
  // its dark version, if the source has one: cut from the same place (in its own pixels, if its size differs)
  let darkMaster: Awaited<ReturnType<typeof toMaster>> | null = null;
  const srcDark = darkKeyOf(src.id, src.sidecar);
  const darkBytes = srcDark ? readFile(srcDark) : null;
  if (darkBytes) {
    const dm = await sharp(darkBytes).metadata();
    const kx = (dm.width ?? src.width) / src.width;
    const ky = (dm.height ?? src.height) / src.height;
    const left = Math.min((dm.width ?? 1) - 1, Math.round(r.x * kx));
    const top = Math.min((dm.height ?? 1) - 1, Math.round(r.y * ky));
    const width = Math.max(1, Math.min((dm.width ?? 1) - left, Math.round(r.width * kx)));
    const height = Math.max(1, Math.min((dm.height ?? 1) - top, Math.round(r.height * ky)));
    try {
      darkMaster = await toMaster(await sharp(darkBytes).extract({ left, top, width, height }).png().toBuffer());
    } catch (e) {
      return refuse(`content/media/${id}.json`, `its dark version: ${(e as Error).message}`, 'crop');
    }
  }
  const current = readDoc<ImageMedia>(sidecarKey(id))!;
  if (current.value.crop && !opts.copy) {
    // a copy, cut again: its master (and its dark version, which follows its original's) and its record change; its name and details stay
    const { focus: _f, dark: _d, ...rest } = current.value;
    const masterKey = masterKeyOf(id, current.value);
    const darkKey = `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${darkFileOf(id)}`;
    const oldDark = darkKeyOf(id, current.value);
    const changes: Change[] = [
      { key: masterKey, bytes: master.bytes },
      { key: sidecarKey(id), bytes: jsonBytes({ ...rest, crop, ...(darkMaster ? { dark: { file: darkFileOf(id) } } : {}) }) },
    ];
    const ifMatch: Record<string, string | null> = { [masterKey]: versionOf(readFile(masterKey)), [sidecarKey(id)]: current.version };
    if (darkMaster) {
      changes.push({ key: darkKey, bytes: darkMaster.bytes });
      ifMatch[darkKey] = versionOf(readFile(darkKey));
    }
    if (oldDark && (!darkMaster || oldDark !== darkKey)) {
      changes.push({ key: oldDark, bytes: null });
      ifMatch[oldDark] = versionOf(readFile(oldDark));
    }
    const res = await commit({ changes, ifMatch });
    return res.ok ? { ...res, id, width: master.width, height: master.height } : res;
  }
  // a new copy, beside its original, named after its shape
  const owner = src.id.slice(0, src.id.lastIndexOf('/'));
  const folder = `${baseOf(src.id)}${owner}/`;
  const snap = readSnapshot();
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/(?:\.dark)?\.\w+$/, '')));
  const shape = ratioLabel(r.width, r.height);
  const name = unique(`${src.id.slice(owner.length + 1)}-${/^\d+:\d+$/.test(shape) ? shape.replace(':', 'x') : 'crop'}`, taken);
  const { file: _file, focus: _focus, crop: _crop, dark: _dark, ...details } = src.sidecar;
  const newId = `${owner}/${name}`;
  const sidecar: ImageMedia = { ...details, kind: 'image', file: `${name}.webp`, crop, ...(darkMaster ? { dark: { file: darkFileOf(newId) } } : {}) };
  const changes: Change[] = [
    { key: `${folder}${name}.webp`, bytes: master.bytes },
    { key: `${folder}${name}.json`, bytes: jsonBytes(sidecar) },
  ];
  const ifMatch: Record<string, string | null> = { [`${folder}${name}.webp`]: null, [`${folder}${name}.json`]: null };
  if (darkMaster) {
    changes.push({ key: `${folder}${darkFileOf(newId)}`, bytes: darkMaster.bytes });
    ifMatch[`${folder}${darkFileOf(newId)}`] = null;
  }
  const res = await commit({ changes, ifMatch });
  return res.ok ? { ...res, id: newId, width: master.width, height: master.height } : res;
}

/** Deletes a picture (its sidecar, master and dark version) or a video (its sidecar, file and poster). The content check refuses it while anything refers to it. */
export async function deleteMedia(id: string): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `${baseOf(id)}${id}.json`;
  const sc = readDoc<ImageMedia | VideoMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const masterKey = key.replace(/[^/]+\.json$/, sc.value.file);
  const extraKey = sc.value.kind === 'video' ? (sc.value.poster ? key.replace(/[^/]+\.json$/, sc.value.poster.file) : null) : darkKeyOf(id, sc.value);
  const changes: Change[] = [
    { key, bytes: null },
    { key: masterKey, bytes: null },
    ...(extraKey ? [{ key: extraKey, bytes: null }] : []),
  ];
  const ifMatch: Record<string, string | null> = { [key]: sc.version, [masterKey]: versionOf(readFile(masterKey)), ...(extraKey ? { [extraKey]: versionOf(readFile(extraKey)) } : {}) };
  return commit({ changes, ifMatch });
}
