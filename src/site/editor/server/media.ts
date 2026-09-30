/**
 * Media, as edit mode changes it (documentation/editor/spec.md §6): uploads become WebP masters within
 * the budgets (at most 2560 px on the long side and 1.5 MB, metadata stripped), each with its JSON
 * sidecar, in one store transaction; a sidecar's details save to the picture; a picture is cropped into a
 * copy, never in place (§6.1); a picture is deleted only when nothing refers to it (the content check
 * refuses a deletion that would leave a reference).
 */
import { imageMedia, type ImageMedia } from '../../content/schema';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Result } from './store';
import { readSnapshot } from '../../content/source';
import { slugify, unique } from '../model/ids';
import { ratioLabel, type Rect } from '../model/crop';

export const MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_SIDE = 2560;
export const MAX_UPLOAD = 20 * 1024 * 1024;
const OWNER = /^(shared|site|articles\/[a-z0-9]+(?:-[a-z0-9]+)*|people\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const MEDIA_ID = /^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/;

const refuse = (file: string, message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file, message, ...(path ? { path } : {}) }] });

/** A master in WebP within the budgets: lossless when the source has transparency (if it fits), stripped of metadata. */
export async function toMaster(input: Buffer): Promise<{ bytes: Buffer; width: number; height: number }> {
  const { default: sharp } = await import('sharp');
  const base = sharp(input, { failOn: 'error' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
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
}

export async function upload(u: Upload): Promise<Result & { id?: string }> {
  if (!OWNER.test(u.owner)) return refuse('content/media', `"${u.owner}" isn't a media folder (shared, site, articles/<id> or people/<id>)`, 'owner');
  if (u.file.bytes.length > MAX_UPLOAD) return refuse('content/media', 'is larger than 20 MB', 'file');
  const snap = readSnapshot();
  const folder = `/content/media/${u.owner}/`;
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/\.\w+$/, '')));
  const name = unique(slugify(u.file.name.replace(/\.[^.]+$/, '')), taken);
  let master: Awaited<ReturnType<typeof toMaster>>;
  try {
    master = await toMaster(u.file.bytes);
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

export async function saveSidecar(id: string, sidecar: ImageMedia, ifMatch: Record<string, string | null>): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `/content/media/${id}.json`;
  const current = readDoc<ImageMedia>(key);
  if (!current) return refuse(key.slice(1), "doesn't exist");
  // the master's file name is fixed: replacing a picture keeps its id and file
  const next = { ...sidecar, kind: 'image' as const, file: current.value.file };
  return commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: ifMatch[key] ?? null } });
}

/** Replaces a picture's master, keeping its id and its sidecar. */
export async function replaceMaster(id: string, bytes: Buffer): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `/content/media/${id}.json`;
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const masterKey = key.replace(/[^/]+\.json$/, sc.value.file);
  if (!sc.value.file.endsWith('.webp')) return refuse(key.slice(1), 'only a WebP master can be replaced here');
  const master = await toMaster(bytes);
  return commit({ changes: [{ key: masterKey, bytes: master.bytes }], ifMatch: { [masterKey]: versionOf(readFile(masterKey)) } });
}

const sidecarKey = (id: string) => `/content/media/${id}.json`;
const masterKeyOf = (id: string, sc: ImageMedia) => `/content/media/${id.slice(0, id.lastIndexOf('/'))}/${sc.file}`;

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
  const current = readDoc<ImageMedia>(sidecarKey(id))!;
  if (current.value.crop && !opts.copy) {
    // a copy, cut again: its master and its record change; its name and details stay
    const { focus: _f, ...rest } = current.value;
    const masterKey = masterKeyOf(id, current.value);
    const res = await commit({
      changes: [
        { key: masterKey, bytes: master.bytes },
        { key: sidecarKey(id), bytes: jsonBytes({ ...rest, crop }) },
      ],
      ifMatch: { [masterKey]: versionOf(readFile(masterKey)), [sidecarKey(id)]: current.version },
    });
    return res.ok ? { ...res, id, width: master.width, height: master.height } : res;
  }
  // a new copy, beside its original, named after its shape
  const owner = src.id.slice(0, src.id.lastIndexOf('/'));
  const folder = `/content/media/${owner}/`;
  const snap = readSnapshot();
  const taken = new Set([...snap.masters, ...Object.keys(snap.docs)].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length).replace(/\.\w+$/, '')));
  const shape = ratioLabel(r.width, r.height);
  const name = unique(`${src.id.slice(owner.length + 1)}-${/^\d+:\d+$/.test(shape) ? shape.replace(':', 'x') : 'crop'}`, taken);
  const { file: _file, focus: _focus, crop: _crop, ...details } = src.sidecar;
  const sidecar: ImageMedia = { ...details, kind: 'image', file: `${name}.webp`, crop };
  const newId = `${owner}/${name}`;
  const res = await commit({
    changes: [
      { key: `${folder}${name}.webp`, bytes: master.bytes },
      { key: sidecarKey(newId), bytes: jsonBytes(sidecar) },
    ],
    ifMatch: { [`${folder}${name}.webp`]: null, [sidecarKey(newId)]: null },
  });
  return res.ok ? { ...res, id: newId, width: master.width, height: master.height } : res;
}

/** Deletes a picture: its sidecar and its master. The content check refuses it while anything refers to it. */
export async function deleteMedia(id: string): Promise<Result> {
  if (!MEDIA_ID.test(id)) return refuse('content/media', 'not a media id');
  const key = `/content/media/${id}.json`;
  const sc = readDoc<ImageMedia>(key);
  if (!sc) return refuse(key.slice(1), "doesn't exist");
  const masterKey = key.replace(/[^/]+\.json$/, sc.value.file);
  return commit({ changes: [{ key, bytes: null }, { key: masterKey, bytes: null }], ifMatch: { [key]: sc.version, [masterKey]: versionOf(readFile(masterKey)) } });
}
