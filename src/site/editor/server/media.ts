/**
 * Media, as edit mode changes it (documentation/editor/spec.md §6): uploads (any format sharp reads: JPEG,
 * PNG, WebP, AVIF, GIF, TIFF, SVG; the browser turns others into PNG first) become WebP masters within
 * the budgets (at most 2560 px on the long side and 1.5 MB, metadata stripped, transparency kept), each
 * with its JSON sidecar, in one store transaction, cut first to a crop chosen before the upload, if any;
 * a GIF is the exception: it's kept exactly as it is (`<name>.gif`, under GitHub's 100 MB, never re-encoded
 * or cropped), with a still WebP poster of its first frame when it's animated (media.md §4);
 * a sidecar's details save to the picture; a picture can have a dark mode version (a second master,
 * `<name>.dark.webp` or `.dark.gif`, named in its sidecar), which its crops, its deletion and its replacement carry along;
 * a picture is cropped into a
 * copy, never in place (§6.1); a picture is deleted only when nothing refers to it (the content check
 * refuses a deletion that would leave a reference). A private page's media live in private-pages/ with it
 * (documentation/access/spec.md §8.2): an upload to its folder goes there, and every other change is made
 * where the picture or video already is. Every master a change saves has its size and background measured
 * into its sidecar (`facts`, media.md §9.3), so no page decodes it to show it.
 * Gallery (gallery spec §4): an SVG can be kept as a drawing (cleaned by `sanitizeSvg`, `<name>.svg`, its
 * dark version `<name>.dark.svg`); JPEG XL, camera RAW and PSD are refused with what to do; an upload's
 * date taken (EXIF) and focus point (the attention measure) go into its sidecar; a picture can be kept
 * large (up to 3840 px, `large`), and made standard again. Every upload's fingerprint (the SHA-256 of the file
 * as uploaded, V55) goes into its sidecar, and a file already in the library isn't saved again: the upload
 * answers the item there (`existing`). A video file's date comes from its own header (`creation_time`).
 * Uploads can go to an album's folder (`albums/<id>`) or the library's (`library`), where alt text may wait.
 */
import { imageMedia, isDrawingFile, isRealDate, videoMedia, type EmbedMedia, type ImageMedia, type VideoMedia } from '../../content/schema';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Change, type Result } from './store';
import { fileOf, readSnapshot } from '../../content/source';
import { measureFacts, type SidecarFacts } from '../../content/pictureFacts';
import { existsSync } from 'node:fs';
import { slugify, unique } from '../model/ids';
import { ratioLabel, type Rect } from '../model/crop';
import { MAX_LARGE_SIDE, MAX_PICTURE_BYTES, focusPercent, joinFocus, pictureSizeIssue, refusedFormat, videoSizeIssue } from '../model/upload';
import { locationOf, takenOf } from '../model/exif';
import { forgetPictureMeta, keepPictureMeta } from './pictureMeta';
import { sanitizeSvg } from '../model/svgSanitize';
import { videoTakenOf } from '../model/videoDate';
import { findByFingerprint, fingerprintOf, type LibraryMatch } from './libraryIndex';
import { batchProblem, withBatch, type WordsChange } from '../model/albumViewer';

export const MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_SIDE = 2560;
/**
 * A picture kept large (gallery spec §4) is at most 3840 px, so its budget grows with its area: 2.25 times
 * the pixels of 2560 px, about 3.5 MB.
 */
export const MAX_LARGE_BYTES = 3.5 * 1024 * 1024;
export const MAX_UPLOAD = MAX_PICTURE_BYTES;
const OWNER = /^(shared|site|library|(?:articles|albums|people)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const OWNERS_WORDS = 'shared, site, library, articles/<id>, albums/<id> or people/<id>';
const MEDIA_ID = /^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/;
/** Folders whose uploads may wait for their alt text (gallery spec §9.4: words come after, in the viewer). */
const WORDS_LATER = /^(library|albums\/.+)$/;

/** Where a picture's or video's files are: private-pages/ for a private page's media, else content/. */
const baseOf = (id: string) => (existsSync(fileOf(`/private/media/${id}.json`)) ? '/private/media/' : '/content/media/');
/** A library item's sidecar as it is on disk, with its key and version (the info panel saves against them), or null. */
export function sidecarOf(id: string): { key: string; version: string; sidecar: ImageMedia | VideoMedia | EmbedMedia } | null {
  if (!MEDIA_ID.test(id)) return null;
  const key = `${baseOf(id)}${id}.json`;
  const doc = readDoc<ImageMedia | VideoMedia | EmbedMedia>(key);
  return doc ? { key, version: doc.version, sidecar: doc.value } : null;
}
/** The folder an upload goes to: a private page's or a private album's own folder is in private-pages/. */
export function folderOf(owner: string): string {
  const page = /^(articles|albums)\/(.+)$/.exec(owner);
  return `${page && existsSync(fileOf(`/private/${page[1]}/${page[2]}.json`)) ? '/private/media/' : '/content/media/'}${owner}/`;
}

/**
 * The library item made from the same file (gallery spec §9.4, V55): the fingerprint is the SHA-256 of the file
 * as it was uploaded, before it's converted, so dropping it again finds the item instead of making a copy.
 */
function sameFile(bytes: Buffer): { fingerprint: string; existing: LibraryMatch | null } {
  const fingerprint = fingerprintOf(bytes);
  return { fingerprint, existing: findByFingerprint(fingerprint) };
}

/** What an upload of a file already in the library answers: the item there, and nothing written. */
const alreadyThere = (m: LibraryMatch) => ({ ok: true as const, versions: {}, id: m.id, existing: true as const, origin: m.origin, kind: m.kind });

const refuse = (file: string, message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file, message, ...(path ? { path } : {}) }] });

/**
 * A new master's facts for its sidecar (its size and background: documentation/content/media.md §9.3), so
 * no page decodes it to show it. Left out if they can't be measured: then they're measured when it's shown.
 */
async function factsOf(bytes: Buffer): Promise<{ facts?: SidecarFacts }> {
  try {
    return { facts: await measureFacts(bytes) };
  } catch {
    return {};
  }
}

/** What sharp reads a picture with: an SVG is drawn at the size a master can be, not at its nominal 72 dpi. */
async function readOptions(input: Buffer, maxSide = MAX_SIDE): Promise<{ failOn: 'error'; density?: number; animated: boolean }> {
  const { default: sharp } = await import('sharp');
  const meta = await sharp(input, { failOn: 'error' }).metadata();
  const animated = (meta.pages ?? 1) > 1;
  if (meta.format !== 'svg' || !meta.width || !meta.height) return { failOn: 'error', animated };
  return { failOn: 'error', animated: false, density: Math.min(100000, Math.max(72, Math.round((72 * maxSide) / Math.max(meta.width, meta.height)))) };
}

/** How big a master may be: 2560 px and 1.5 MB, or 3840 px and 3.5 MB kept large (gallery spec §4). */
export interface MasterLimits {
  large?: boolean;
}
const limitsOf = (o: MasterLimits = {}) => (o.large ? { side: MAX_LARGE_SIDE, bytes: MAX_LARGE_BYTES, words: '3.5 MB' } : { side: MAX_SIDE, bytes: MAX_BYTES, words: '1.5 MB' });

/** A master in WebP within the budgets: lossless when the source has transparency (if it fits), stripped of metadata. */
export async function toMaster(input: Buffer, limits: MasterLimits = {}): Promise<{ bytes: Buffer; width: number; height: number; poster?: Buffer }> {
  const { default: sharp } = await import('sharp');
  const max = limitsOf(limits);
  const options = await readOptions(input, max.side);
  const source = await sharp(input, { failOn: 'error' }).metadata();
  const animated = options.animated;
  const base = sharp(input, options).rotate().resize({ width: max.side, height: max.side, fit: 'inside', withoutEnlargement: true });
  const meta = await base.clone().metadata();
  const alpha = !!meta.hasAlpha;
  const animation = animated ? { loop: source.loop ?? 0, ...(source.delay?.length ? { delay: source.delay } : {}) } : {};
  let bytes = !animated && alpha ? await base.clone().webp({ lossless: true }).toBuffer() : Buffer.alloc(0);
  for (let q = 88; !bytes.length || bytes.length > max.bytes; q -= 6) {
    if (q < 60) throw new Error(`can't be made small enough (${max.words}) without losing too much: use a smaller picture`);
    bytes = await base.clone().webp({ quality: q, alphaQuality: 100, ...animation }).toBuffer();
  }
  const out = await sharp(bytes, { animated }).metadata();
  if (animated && out.pages !== source.pages) throw new Error(`couldn't preserve all ${source.pages} animation frames`);
  const poster = animated ? await stillOf(input) : undefined;
  return { bytes, width: out.width ?? 0, height: out.pageHeight ?? out.height ?? 0, ...(poster ? { poster } : {}) };
}

/** An animation's still first frame, as a WebP within the budgets: its poster for reduced motion and thumbnails. */
async function stillOf(input: Buffer, failOn: 'error' | 'none' = 'error'): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  const posterBase = sharp(input, { failOn, page: 0, pages: 1 }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  let poster: Buffer | undefined;
  for (let q = 82; !poster || poster.length > MAX_BYTES; q -= 6) {
    if (q < 60) throw new Error("its still poster can't be made small enough (1.5 MB) without losing too much: use a smaller picture");
    poster = await posterBase.clone().webp({ quality: q, alphaQuality: 100 }).toBuffer();
  }
  return poster;
}

/** Whether the bytes are a GIF (by its signature, whatever the file is called). */
export const isGif = (bytes: Buffer) => bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('latin1'));

/**
 * A GIF as its own master, byte for byte (media.md §4): never re-encoded, resized or stripped, since a GIF's
 * look rarely survives a conversion. Its limits are checked, never met by changing it: under GitHub's 100 MB
 * for a file, and at most 2560 px on its long side. An animated one gets a still WebP poster of its first frame.
 */
async function gifMaster(input: Buffer): Promise<{ bytes: Buffer; width: number; height: number; poster?: Buffer }> {
  const tooBig = pictureSizeIssue('image/gif', input.length);
  if (tooBig) throw new Error(tooBig);
  const { default: sharp } = await import('sharp');
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const width = meta.width ?? 0;
  const height = meta.pageHeight ?? meta.height ?? 0;
  if (!width || !height) throw new Error("its size couldn't be read");
  if (Math.max(width, height) > MAX_SIDE) throw new Error(`it's ${width} × ${height} px: a GIF is kept as it is, so it must be at most ${MAX_SIDE} px on its long side. Save a smaller one, then choose it again`);
  const poster = (meta.pages ?? 1) > 1 ? await stillOf(input, 'none') : undefined;
  return { bytes: input, width, height, ...(poster ? { poster } : {}) };
}

/** The master an upload becomes, and its extension: a GIF kept as it is, anything else a WebP within the budgets (kept large when asked and it's bigger than 2560 px). */
export async function asMaster(input: Buffer, limits: MasterLimits = {}): Promise<{ bytes: Buffer; width: number; height: number; poster?: Buffer; ext: 'gif' | 'webp'; large?: true }> {
  if (isGif(input)) return { ...(await gifMaster(input)), ext: 'gif' };
  let large = !!limits.large;
  if (large) {
    // only a still raster picture is kept large: an animation or a drawing turned into a picture never is
    const { default: sharp } = await import('sharp');
    const m = await sharp(input, { failOn: 'none' }).metadata();
    large = (m.pages ?? 1) <= 1 && m.format !== 'svg';
  }
  const master = await toMaster(input, { large });
  // kept large only when it is: a picture of 2560 px or less is a standard one, whatever was asked (V50)
  return { ...master, ext: 'webp', ...(large && Math.max(master.width, master.height) > MAX_SIDE ? { large: true as const } : {}) };
}

// ---------- drawings: SVG kept as a vector (gallery spec §4.1) ----------

/** Whether the bytes are an SVG (by its name, or by an `<svg` near its start when it isn't a raster's signature). */
export function isSvg(bytes: Buffer, name = ''): boolean {
  if (/\.svgz?$/i.test(name)) return true;
  const head = bytes.subarray(0, 4096).toString('utf8');
  return /^\uFEFF?\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(head);
}

/** A drawing's master: the SVG cleaned, or why it can't be one. `removed` says what the cleaning took out. */
export function drawingMaster(input: Buffer): { ok: true; bytes: Buffer; width: number; height: number; ext: 'svg'; removed: string[] } | { ok: false; error: string } {
  const r = sanitizeSvg(new Uint8Array(input.buffer, input.byteOffset, input.length));
  if (!r.ok) return r;
  return { ok: true, bytes: Buffer.from(r.svg, 'utf8'), width: r.width, height: r.height, ext: 'svg', removed: r.removed };
}

/** Whether a sidecar's master is a drawing. */
export const isDrawing = (sc: { file: string }) => isDrawingFile(sc.file);

/** Why a file the site can't keep is refused (JPEG XL, camera RAW, PSD), by its name or its own signature. */
function refusedPicture(name: string, bytes: Buffer): string | null {
  const byName = refusedFormat({ type: '', name });
  if (byName) return byName;
  const jxl = (bytes[0] === 0xff && bytes[1] === 0x0a) || bytes.subarray(0, 12).equals(Buffer.from([0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]));
  if (jxl) return refusedFormat({ type: 'image/jxl', name: '' });
  if (bytes.subarray(0, 4).toString('latin1') === '8BPS') return refusedFormat({ type: 'image/vnd.adobe.photoshop', name: '' });
  return null;
}

/** Today, as YYYY-MM-DD (here: a date taken can't be later than the day it's saved, V50). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The day a picture was taken: its own EXIF date, else the one the browser read (a HEIC it converted), when it's a real day not after today. */
export function takenFor(bytes: Buffer, sent?: string): string | undefined {
  const own = takenOf(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length));
  const day = own ?? (sent?.trim() || undefined);
  return day && isRealDate(day) && day <= today() ? day : undefined;
}

/** Where a picture was taken, from its own EXIF (kept only on this computer: pictureMeta.ts). */
const locationFor = (bytes: Buffer) => locationOf(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length)) ?? undefined;

/**
 * Where a picture's interest is (gallery spec §4, D-G16): sharp's attention measure (the region with the
 * most detail, saturated colour and skin tones), once across and once down, on a small copy of it. The
 * point is the sidecar's `focus` ("x% y%"); null when it can't be measured (a tiny picture).
 */
export async function measureFocus(bytes: Buffer): Promise<string | null> {
  const { default: sharp } = await import('sharp');
  try {
    const small = await sharp(bytes, { failOn: 'none', page: 0, pages: 1 }).rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const { width, height } = small.info;
    if (width < 4 || height < 4) return null;
    // a picture of one flat colour has nothing to look at: no point rather than a corner
    const { channels } = await sharp(small.data).stats();
    if (channels.slice(0, Math.min(3, channels.length)).every((c) => c.stdev < 2)) return null;
    const cut = async (w: number, h: number) => {
      const r = await sharp(small.data).resize(w, h, { fit: 'cover', position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
      return { left: r.info.cropOffsetLeft ?? 0, top: r.info.cropOffsetTop ?? 0, width: w, height: h };
    };
    const picture = { width, height };
    const across = focusPercent(picture, await cut(Math.max(1, Math.round(width / 2)), height));
    const down = focusPercent(picture, await cut(width, Math.max(1, Math.round(height / 2))));
    return joinFocus(across, down);
  } catch {
    return null;
  }
}

/** Why a crop can't be made of these bytes before upload: a GIF is never cut (it would be re-encoded). */
const GIF_UNCROPPED = "a GIF is kept exactly as it is, so it can't be cropped: upload it whole, then set its focus point";

export interface Upload {
  file: { name: string; bytes: Buffer };
  owner: string;
  alt?: string;
  decorative?: boolean;
  caption?: string;
  /** A crop chosen before the upload, in the pixels of the picture as the browser showed it (`of`), upright. */
  crop?: Rect & { of: { width: number; height: number } };
  /** An SVG: kept as a drawing (cleaned, gallery spec §4.1) or turned into a picture (the default, as before). */
  svgAs?: 'drawing' | 'picture';
  /** Keep it large: a raster picture bigger than 2560 px is kept at up to 3840 px (gallery spec §4). */
  large?: boolean;
  /** The day it was taken, as the browser read it before turning a HEIC into a PNG: used only when the file has no date of its own. */
  taken?: string;
}

/** The picture upright, cut to a crop given in another size of it (the browser's), as a lossless PNG. */
export async function cutUpload(input: Buffer, crop: NonNullable<Upload['crop']>): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  const options = await readOptions(input);
  if (options.animated) throw new Error("an animated picture can't be cropped without stopping it; upload it whole, then set its focus point");
  const upright = await sharp(input, options).rotate().png().toBuffer({ resolveWithObject: true });
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

/** Why a drawing can't be cropped: it would stop being a vector. */
const DRAWING_UNCROPPED = "a drawing is kept as a vector, so it can't be cropped: upload it whole, then set its focus point (or turn it into a picture)";

/**
 * Uploads a picture: a WebP master (or a GIF kept as it is, or a drawing kept as an SVG), its sidecar with
 * its facts, the day it was taken (its EXIF date) and, for a raster picture, its focus point (the attention
 * measure). Answers its id and, for a drawing, what the cleaning removed.
 */
export async function upload(u: Upload): Promise<Result & { id?: string; removed?: string[]; existing?: true; origin?: LibraryMatch['origin']; kind?: LibraryMatch['kind'] }> {
  if (!OWNER.test(u.owner)) return refuse('content/media', `"${u.owner}" isn't a media folder (${OWNERS_WORDS})`, 'owner');
  const refused = refusedPicture(u.file.name, u.file.bytes);
  if (refused) return refuse('content/media', refused, 'file');
  const drawing = u.svgAs === 'drawing' && isSvg(u.file.bytes, u.file.name);
  if (u.svgAs === 'drawing' && !drawing) return refuse('content/media', "only an SVG can be kept as a drawing", 'file');
  const gif = isGif(u.file.bytes);
  const tooBig = pictureSizeIssue(gif ? 'image/gif' : '', u.file.bytes.length);
  if (tooBig) return refuse('content/media', tooBig, 'file');
  if (gif && u.crop) return refuse('content/media', GIF_UNCROPPED, 'crop');
  if (drawing && u.crop) return refuse('content/media', DRAWING_UNCROPPED, 'crop');
  // the same file uploaded again is the item already in the library (a crop chosen before the upload is another picture)
  const same = sameFile(u.file.bytes);
  if (same.existing && !u.crop) return alreadyThere(same.existing);
  const snap = readSnapshot();
  const folder = folderOf(u.owner);
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/(?:\.dark(?:\.poster)?|\.poster)?\.\w+$/, '')));
  const name = unique(slugify(u.file.name.replace(/\.[^.]+$/, '')) || (drawing ? 'drawing' : 'picture'), taken);
  let master: { bytes: Buffer; width: number; height: number; poster?: Buffer; ext: 'gif' | 'webp' | 'svg'; large?: true; removed?: string[] };
  if (drawing) {
    const d = drawingMaster(u.file.bytes);
    if (!d.ok) return refuse('content/media', d.error, 'file');
    master = d;
  } else {
    try {
      master = await asMaster(u.crop ? await cutUpload(u.file.bytes, u.crop) : u.file.bytes, { large: u.large });
    } catch (e) {
      return refuse('content/media', `couldn't be read as a picture: ${(e as Error).message}`, 'file');
    }
  }
  // read before the master is written without its metadata (every master is); a drawing has no camera date
  const day = drawing ? undefined : takenFor(u.file.bytes, u.taken);
  const focus = drawing ? null : await measureFocus(master.poster ?? master.bytes);
  const sidecar: ImageMedia = {
    kind: 'image',
    file: `${name}.${master.ext}`,
    ...(master.poster ? { animation: { poster: `${name}.poster.webp` } } : {}),
    ...(u.decorative ? { decorative: true } : (u.alt ?? '').trim() || !WORDS_LATER.test(u.owner) ? { alt: (u.alt ?? '').trim() } : {}),
    ...(u.caption?.trim() ? { caption: u.caption.trim() } : {}),
    ...(focus ? { focus } : {}),
    ...(await factsOf(master.bytes)),
    ...(day ? { taken: day } : {}),
    ...(master.large ? { large: true as const } : {}),
    ...(u.crop ? {} : { fingerprint: same.fingerprint }),
    visibility: 'public',
  };
  const parsed = imageMedia.safeParse(sidecar);
  if (!parsed.success) return { ok: false, status: 422, issues: parsed.error.issues.map((i) => ({ file: `content/media/${u.owner}/${name}.json`, path: i.path.join('.'), message: i.message })) };
  const masterKey = `${folder}${sidecar.file}`;
  const sidecarKey = `${folder}${name}.json`;
  const posterKey = master.poster ? `${folder}${name}.poster.webp` : null;
  const changes: Change[] = [
    { key: masterKey, bytes: master.bytes },
    ...(posterKey && master.poster ? [{ key: posterKey, bytes: master.poster }] : []),
    { key: sidecarKey, bytes: jsonBytes(sidecar) },
  ];
  const r = await commit({ changes, ifMatch: { [masterKey]: null, ...(posterKey ? { [posterKey]: null } : {}), [sidecarKey]: null } });
  if (r.ok && !drawing) keepPictureMeta(`${u.owner}/${name}`, { taken: day, location: locationFor(u.file.bytes) });
  return r.ok ? { ...r, id: `${u.owner}/${name}`, ...(master.removed?.length ? { removed: master.removed } : {}) } : r;
}

export async function saveSidecar(id: string, sidecar: ImageMedia | VideoMedia | EmbedMedia, ifMatch: Record<string, string | null>): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `${baseOf(id)}${id}.json`;
  const current = readDoc<ImageMedia | VideoMedia | EmbedMedia>(key);
  if (!current) return refuse(key.slice(1), "doesn't exist");
  if (current.value.kind === 'embed') {
    // a linked video's provider, ID, shape, length, poster and fingerprint are its link's: only its words change here
    const v = current.value;
    const s = sidecar as Partial<EmbedMedia>;
    const word = (k: 'alt' | 'caption' | 'description' | 'place' | 'taken' | 'credit') => (s[k]?.trim() ? { [k]: s[k]!.trim() } : {});
    const next: EmbedMedia = {
      kind: 'embed',
      provider: v.provider,
      id: v.id,
      title: (s.title ?? v.title).trim(),
      ...(v.shape ? { shape: v.shape } : {}),
      ...(v.duration ? { duration: v.duration } : {}),
      poster: v.poster,
      ...word('alt'),
      ...word('caption'),
      ...word('description'),
      ...word('place'),
      ...word('taken'),
      ...word('credit'),
      ...(s.licence?.name ? { licence: s.licence } : {}),
      ...(s.source ? { source: s.source } : {}),
      ...(v.fingerprint ? { fingerprint: v.fingerprint } : {}),
      visibility: s.visibility ?? v.visibility,
    };
    return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: ifMatch[key] ?? null } });
  }
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
      // its words in the library (gallery spec §3.4): kept when the form doesn't send them
      ...(('description' in s ? s.description : v.description)?.trim() ? { description: ('description' in s ? s.description : v.description)!.trim() } : {}),
      ...(('place' in s ? s.place : v.place)?.trim() ? { place: ('place' in s ? s.place : v.place)!.trim() } : {}),
      ...(('taken' in s ? s.taken : v.taken) ? { taken: ('taken' in s ? s.taken : v.taken)! } : {}),
      ...(s.credit?.trim() ? { credit: s.credit.trim() } : {}),
      ...(s.licence?.name ? { licence: s.licence } : {}),
      ...(s.source ? { source: s.source } : {}),
      // the file's fingerprint is its upload's (V55)
      ...(v.fingerprint ? { fingerprint: v.fingerprint } : {}),
      visibility: s.visibility ?? v.visibility,
    };
    return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: ifMatch[key] ?? null } });
  }
  const image = current.value as ImageMedia;
  // the master's file name is fixed (replacing a picture keeps its id and file), and its dark version, its
  // facts, whether it's kept large and its fingerprint are set only with the masters (upload, Replace, setDark, Make it
  // standard): the details form never changes them
  const { dark: _ignoredDark, animation: _ignoredAnimation, facts: _ignoredFacts, large: _ignoredLarge, fingerprint: _ignoredFingerprint, ...rest } = sidecar as ImageMedia;
  const next: ImageMedia = { ...rest, kind: 'image', file: image.file, ...(image.animation ? { animation: image.animation } : {}), ...(image.dark ? { dark: image.dark } : {}), ...(image.facts ? { facts: image.facts } : {}), ...(image.large ? { large: true as const } : {}), ...(image.fingerprint ? { fingerprint: image.fingerprint } : {}) };
  return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: ifMatch[key] ?? null } });
}

// ---------- videos (documentation/content/media.md §12) ----------

/**
 * Several library items' words at once (gallery spec §9.3 Set the date, Set the place; §9.5 Accept all): each
 * sidecar read where it lives, changed, and all saved in one transaction (one check, all or nothing).
 */
export async function saveWordsMany(changes: readonly WordsChange[]): Promise<Result> {
  const problem = batchProblem(changes);
  if (problem) return refuse('content/media', problem);
  const out: Change[] = [];
  const ifMatch: Record<string, string | null> = {};
  for (const c of changes) {
    if (!MEDIA_ID.test(c.id)) return refuse('content/media', 'not a media id');
    const key = `${baseOf(c.id)}${c.id}.json`;
    const doc = readDoc<Record<string, unknown>>(key);
    if (!doc) return refuse(key.slice(1), "doesn't exist");
    out.push({ key, bytes: jsonBytes(withBatch(doc.value, c.words)) });
    ifMatch[key] = doc.version;
  }
  return commit({ changes: out, ifMatch });
}

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

export async function uploadVideo(u: VideoUpload): Promise<Result & { id?: string; existing?: true; origin?: LibraryMatch['origin']; kind?: LibraryMatch['kind'] }> {
  if (!OWNER.test(u.owner)) return refuse('content/media', `"${u.owner}" isn't a media folder (${OWNERS_WORDS})`, 'owner');
  const tooBig = videoSizeIssue(u.file.bytes.length);
  if (tooBig) return refuse('content/media', tooBig, 'file');
  const ext = /\.([a-z0-9]+)$/i.exec(u.file.name)?.[1]?.toLowerCase() ?? '';
  if (!['mp4', 'm4v', 'webm', 'mov'].includes(ext)) return refuse('content/media', `${u.file.name} is a video the site can't show: save it as an MP4 (H.264) or a WebM`, 'file');
  if (!(u.width >= 1 && u.height >= 1)) return refuse('content/media', "its size wasn't read: choose it again", 'file');
  // the file as it was uploaded, before it's rewritten: its fingerprint and the day it was made
  const same = sameFile(u.file.bytes);
  if (same.existing) return alreadyThere(same.existing);
  const made = videoTakenOf(new Uint8Array(u.file.bytes.buffer, u.file.bytes.byteOffset, u.file.bytes.length));
  const day = made && isRealDate(made) && made <= today() ? made : undefined;
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
    ...(day ? { taken: day } : {}),
    fingerprint: same.fingerprint,
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

/**
 * Replaces a picture's master, keeping its id and its sidecar (its dark version stays as it is). The new
 * master can be of another format (a GIF kept as it is, a WebP, or a drawing when an SVG comes with
 * `svgAs: 'drawing'`): the old file goes, and the sidecar names the new one. `large` keeps it large (Replace
 * with the original is how a picture saved smaller becomes a large one: gallery spec §4); without it, it's
 * a standard one. A date taken in the new file fills the sidecar's when it has none.
 */
export async function replaceMaster(id: string, bytes: Buffer, opts: { name?: string; svgAs?: 'drawing' | 'picture'; large?: boolean } = {}): Promise<Result & { removed?: string[] }> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `${baseOf(id)}${id}.json`;
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const oldMasterKey = key.replace(/[^/]+\.json$/, sc.value.file);
  if (!/\.(webp|gif|svg)$/.test(sc.value.file)) return refuse(key.slice(1), 'only a WebP, GIF or SVG master can be replaced here');
  const refused = refusedPicture(opts.name ?? '', bytes);
  if (refused) return refuse(key.slice(1), refused, 'file');
  const drawing = opts.svgAs === 'drawing' && isSvg(bytes, opts.name);
  if (sc.value.dark && drawing !== sc.value.dark.file.endsWith('.svg')) {
    return refuse(key.slice(1), drawing ? 'its dark version is a picture: remove it first, then add a drawing as its dark version' : 'its dark version is a drawing: remove it first, or keep this SVG as a drawing', 'file');
  }
  let master: { bytes: Buffer; width: number; height: number; poster?: Buffer; ext: 'gif' | 'webp' | 'svg'; large?: true; removed?: string[] };
  if (drawing) {
    const d = drawingMaster(bytes);
    if (!d.ok) return refuse(key.slice(1), d.error, 'file');
    master = d;
  } else {
    try {
      master = await asMaster(bytes, { large: opts.large });
    } catch (e) {
      return refuse(key.slice(1), `couldn't be read as a picture: ${(e as Error).message}`, 'file');
    }
  }
  const file = `${id.slice(id.lastIndexOf('/') + 1)}.${master.ext}`;
  const masterKey = key.replace(/[^/]+\.json$/, file);
  const posterKey = `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${posterFileOf(id)}`;
  const oldPosterKey = posterKeyOf(id, sc.value);
  const { animation: _animation, facts: _facts, large: _large, fingerprint: _fingerprint, ...rest } = sc.value;
  const day = drawing || rest.taken ? undefined : takenFor(bytes);
  // its new file's fingerprint, unless another library item already holds it (that one answers for the file, V55)
  const same = sameFile(bytes);
  const fingerprint = !same.existing || same.existing.id === id ? same.fingerprint : undefined;
  const next: ImageMedia = { ...rest, file, ...(master.poster ? { animation: { poster: posterFileOf(id) } } : {}), ...(await factsOf(master.bytes)), ...(day ? { taken: day } : {}), ...(master.large ? { large: true as const } : {}), ...(fingerprint ? { fingerprint } : {}) };
  const changes: Change[] = [
    { key: masterKey, bytes: master.bytes },
    { key, bytes: jsonBytes(next) },
    ...(master.poster ? [{ key: posterKey, bytes: master.poster }] : []),
  ];
  const ifMatch: Record<string, string | null> = { [masterKey]: versionOf(readFile(masterKey)), [key]: sc.version, ...(master.poster ? { [posterKey]: versionOf(readFile(posterKey)) } : {}) };
  if (oldMasterKey !== masterKey) {
    changes.push({ key: oldMasterKey, bytes: null });
    ifMatch[oldMasterKey] = versionOf(readFile(oldMasterKey));
  }
  if (oldPosterKey && !master.poster) {
    changes.push({ key: oldPosterKey, bytes: null });
    ifMatch[oldPosterKey] = versionOf(readFile(oldPosterKey));
  }
  const res = await commit({ changes, ifMatch });
  if (res.ok) keepPictureMeta(id, drawing ? {} : { taken: takenFor(bytes), location: locationFor(bytes) });
  return res.ok && master.removed?.length ? { ...res, removed: master.removed } : res;
}

/**
 * Finds a picture's focus point (gallery spec §4, "Find the focus"): the same attention measure an upload
 * runs, on asking. Answers the point ("x% y%") without saving it: saving is the details form's (saveSidecar).
 */
export async function findFocus(id: string): Promise<Result & { focus?: string | null }> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = sidecarKey(id);
  const sc = readDoc<ImageMedia>(key);
  if (!sc || sc.value.kind !== 'image') return refuse(key.slice(1), "doesn't exist");
  if (isDrawing(sc.value)) return refuse(key.slice(1), "a drawing's focus is set by hand", 'focus');
  const bytes = readFile(posterKeyOf(id, sc.value) ?? masterKeyOf(id, sc.value));
  if (!bytes) return refuse(key.slice(1), 'its picture is missing', 'file');
  // nothing is written: no versions change
  return { ok: true, versions: {}, focus: await measureFocus(bytes) };
}

/**
 * Make it standard (gallery spec §4): a picture kept large is saved again at 2560 px, as every other master,
 * and is no longer `large`. Its id, details and dark version stay.
 */
export async function makeStandard(id: string): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = sidecarKey(id);
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  if (!sc.value.large) return refuse(key.slice(1), 'is already a standard picture', 'large');
  const masterKey = masterKeyOf(id, sc.value);
  const bytes = readFile(masterKey);
  if (!bytes) return refuse(key.slice(1), 'its picture is missing', 'file');
  let master: Awaited<ReturnType<typeof toMaster>>;
  try {
    master = await toMaster(bytes);
  } catch (e) {
    return refuse(key.slice(1), (e as Error).message, 'file');
  }
  const { large: _large, facts: _facts, ...rest } = sc.value;
  const next: ImageMedia = { ...rest, ...(await factsOf(master.bytes)) };
  return commit({
    changes: [
      { key: masterKey, bytes: master.bytes },
      { key, bytes: jsonBytes(next) },
    ],
    ifMatch: { [masterKey]: versionOf(bytes), [key]: sc.version },
  });
}

const sidecarKey = (id: string) => `${baseOf(id)}${id}.json`;
const masterKeyOf = (id: string, sc: ImageMedia) => `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${sc.file}`;
const darkKeyOf = (id: string, sc: ImageMedia) => (sc.dark ? `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${sc.dark.file}` : null);
const posterFileOf = (id: string, dark = false) => `${id.slice(id.lastIndexOf('/') + 1)}${dark ? '.dark' : ''}.poster.webp`;
const posterKeyOf = (id: string, sc: ImageMedia) => (sc.animation ? `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${sc.animation.poster}` : null);
const darkPosterKeyOf = (id: string, sc: ImageMedia) => (sc.dark?.animation ? `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${sc.dark.animation.poster}` : null);
/** Where a picture's dark version goes: beside its master, `<name>.dark.webp` (or `.dark.gif`, a GIF kept as it is, or `.dark.svg`, a drawing's). */
const darkFileOf = (id: string, ext: 'gif' | 'webp' | 'svg' = 'webp') => `${id.slice(id.lastIndexOf('/') + 1)}.dark.${ext}`;

/**
 * Adds a picture's dark mode version, or replaces it (documentation/editor/spec.md §6.2): a master like
 * every other (WebP, within the budgets, transparency kept; a GIF kept as it is), beside the picture as
 * `<name>.dark.webp` (or `.dark.gif`), named in its sidecar, in one transaction. A drawing's dark version
 * is a drawing too (an SVG, cleaned the same way: gallery spec §4.1), `<name>.dark.svg`. Answers both
 * sizes, so the editor can say when the two shapes differ (a page shifts when the theme changes).
 */
export async function setDark(id: string, bytes: Buffer, crop?: Upload['crop']): Promise<Result & { width?: number; height?: number; lightWidth?: number; lightHeight?: number; removed?: string[] }> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = sidecarKey(id);
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  if (crop && isGif(bytes)) return refuse(key.slice(1), GIF_UNCROPPED, 'crop');
  const refused = refusedPicture('', bytes);
  if (refused) return refuse(key.slice(1), refused, 'file');
  let master: { bytes: Buffer; width: number; height: number; poster?: Buffer; ext: 'gif' | 'webp' | 'svg'; removed?: string[] };
  if (isDrawing(sc.value)) {
    if (!isSvg(bytes)) return refuse(key.slice(1), "a drawing's dark version is a drawing too: upload an SVG", 'file');
    if (crop) return refuse(key.slice(1), DRAWING_UNCROPPED, 'crop');
    const d = drawingMaster(bytes);
    if (!d.ok) return refuse(key.slice(1), d.error, 'file');
    master = d;
  } else {
    try {
      master = await asMaster(crop ? await cutUpload(bytes, crop) : bytes);
    } catch (e) {
      return refuse(key.slice(1), `couldn't be read as a picture: ${(e as Error).message}`, 'file');
    }
  }
  const darkFile = darkFileOf(id, master.ext);
  const darkKey = `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${darkFile}`;
  const darkPosterKey = `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${posterFileOf(id, true)}`;
  const oldKey = darkKeyOf(id, sc.value);
  const oldPosterKey = darkPosterKeyOf(id, sc.value);
  const changes: Change[] = [
    { key: darkKey, bytes: master.bytes },
    ...(master.poster ? [{ key: darkPosterKey, bytes: master.poster }] : []),
    { key, bytes: jsonBytes({ ...sc.value, dark: { file: darkFile, ...(master.poster ? { animation: { poster: posterFileOf(id, true) } } : {}), ...(await factsOf(master.bytes)) } }) },
  ];
  const ifMatch: Record<string, string | null> = { [darkKey]: versionOf(readFile(darkKey)), [key]: sc.version, ...(master.poster ? { [darkPosterKey]: versionOf(readFile(darkPosterKey)) } : {}) };
  // a dark version kept in another format before: this one replaces it
  if (oldKey && oldKey !== darkKey) {
    changes.push({ key: oldKey, bytes: null });
    ifMatch[oldKey] = versionOf(readFile(oldKey));
  }
  if (oldPosterKey && !master.poster) {
    changes.push({ key: oldPosterKey, bytes: null });
    ifMatch[oldPosterKey] = versionOf(readFile(oldPosterKey));
  }
  const res = await commit({ changes, ifMatch });
  if (!res.ok) return res;
  const { default: sharp } = await import('sharp');
  const light = await sharp(readFile(masterKeyOf(id, sc.value))!).metadata();
  return { ...res, width: master.width, height: master.height, lightWidth: light.width, lightHeight: light.pageHeight ?? light.height, ...(master.removed?.length ? { removed: master.removed } : {}) };
}

/** Removes a picture's dark mode version: the same picture shows in both modes again. */
export async function removeDark(id: string): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = sidecarKey(id);
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const darkKey = darkKeyOf(id, sc.value);
  if (!darkKey) return refuse(key.slice(1), 'has no dark version', 'dark');
  const darkPosterKey = darkPosterKeyOf(id, sc.value);
  const { dark: _d, ...rest } = sc.value;
  return commit({
    changes: [
      { key, bytes: jsonBytes(rest) },
      { key: darkKey, bytes: null },
      ...(darkPosterKey ? [{ key: darkPosterKey, bytes: null }] : []),
    ],
    ifMatch: { [key]: sc.version, [darkKey]: versionOf(readFile(darkKey)), ...(darkPosterKey ? { [darkPosterKey]: versionOf(readFile(darkPosterKey)) } : {}) },
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
  const height = m.pageHeight ?? m.height ?? 0;
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
  if (src.sidecar.animation || src.sidecar.dark?.animation) return refuse(`content/media/${id}.json`, "an animated picture can't be cropped without stopping it; set its focus point to control the visible area", 'crop');
  if ([src.sidecar.file, src.sidecar.dark?.file].some((f) => f?.endsWith('.gif'))) return refuse(`content/media/${id}.json`, "a GIF is kept exactly as it is, so it can't be cropped; set its focus point to control the visible area", 'crop');
  if (isDrawing(src.sidecar)) return refuse(`content/media/${id}.json`, "a drawing is kept as a vector, so it can't be cropped; set its focus point to control the visible area", 'crop');
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
    const { focus: _f, dark: _d, facts: _facts, large: _large, ...rest } = current.value;
    const masterKey = masterKeyOf(id, current.value);
    const darkKey = `${baseOf(id)}${id.slice(0, id.lastIndexOf('/'))}/${darkFileOf(id)}`;
    const oldDark = darkKeyOf(id, current.value);
    const changes: Change[] = [
      { key: masterKey, bytes: master.bytes },
      { key: sidecarKey(id), bytes: jsonBytes({ ...rest, crop, ...(await factsOf(master.bytes)), ...(darkMaster ? { dark: { file: darkFileOf(id), ...(await factsOf(darkMaster.bytes)) } } : {}) }) },
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
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/(?:\.dark(?:\.poster)?|\.poster)?\.\w+$/, '')));
  const shape = ratioLabel(r.width, r.height);
  const name = unique(`${src.id.slice(owner.length + 1)}-${/^\d+:\d+$/.test(shape) ? shape.replace(':', 'x') : 'crop'}`, taken);
  // a cropped copy is a standard picture (cut to at most 2560 px), even of a large one, and isn't its original's file (no fingerprint)
  const { file: _file, focus: _focus, crop: _crop, dark: _dark, facts: _facts, large: _large, fingerprint: _fingerprint, ...details } = src.sidecar;
  const newId = `${owner}/${name}`;
  const sidecar: ImageMedia = { ...details, kind: 'image', file: `${name}.webp`, crop, ...(await factsOf(master.bytes)), ...(darkMaster ? { dark: { file: darkFileOf(newId), ...(await factsOf(darkMaster.bytes)) } } : {}) };
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

/** What deleting a library item writes: its sidecar and every file beside it (master, dark version, posters), each against its version; or why it can't. */
export function deletionOf(id: string): { ok: true; changes: Change[]; ifMatch: Record<string, string | null> } | Result {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `${baseOf(id)}${id}.json`;
  const sc = readDoc<ImageMedia | VideoMedia | EmbedMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  if (sc.value.kind === 'embed') {
    const posterKey = key.replace(/[^/]+\.json$/, sc.value.poster.file);
    return { ok: true, changes: [{ key, bytes: null }, { key: posterKey, bytes: null }], ifMatch: { [key]: sc.version, [posterKey]: versionOf(readFile(posterKey)) } };
  }
  const masterKey = key.replace(/[^/]+\.json$/, sc.value.file);
  const extraKeys =
    sc.value.kind === 'video'
      ? [sc.value.poster ? key.replace(/[^/]+\.json$/, sc.value.poster.file) : null]
      : [darkKeyOf(id, sc.value), posterKeyOf(id, sc.value), darkPosterKeyOf(id, sc.value)];
  const presentExtras = extraKeys.filter((extraKey): extraKey is string => !!extraKey);
  const changes: Change[] = [
    { key, bytes: null },
    { key: masterKey, bytes: null },
    ...presentExtras.map((extraKey) => ({ key: extraKey, bytes: null })),
  ];
  const ifMatch: Record<string, string | null> = { [key]: sc.version, [masterKey]: versionOf(readFile(masterKey)) };
  for (const extraKey of presentExtras) ifMatch[extraKey] = versionOf(readFile(extraKey));
  return { ok: true, changes, ifMatch };
}

/** Deletes a picture (its sidecar, master and dark version), a video (its sidecar, file and poster) or a linked video (its sidecar and poster). The content check refuses it while anything refers to it. */
export async function deleteMedia(id: string): Promise<Result> {
  const d = deletionOf(id);
  if (!('changes' in d)) return d;
  const r = await commit({ changes: d.changes, ifMatch: d.ifMatch });
  if (r.ok) forgetPictureMeta(id);
  return r;
}
