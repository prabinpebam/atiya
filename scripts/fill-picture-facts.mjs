// @ts-check
/**
 * Fills in each picture's `facts` (its master's size, background and file size: documentation/content/media.md
 * §9.3) in sidecars that don't have them yet, or whose master has changed size since. Edit mode writes them
 * for every master it saves; this is for the pictures saved before it did, run once.
 *
 *   node scripts/fill-picture-facts.mjs [folder…] [--write]
 *
 * The folders default to content/ (and private-pages/ when it's set up). Without --write it only says how
 * many sidecars it would fill. It writes each sidecar through a temporary file beside it, formatted as the
 * editor writes JSON, and changes nothing else in it. It prints counts and folders only, never a file's
 * name (a private page's media are named after it: documentation/access/spec.md).
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** The same as src/site/content/edgeColour.ts `edgeAverage` (a unit test holds them equal). */
export function edgeAverage(/** @type {ArrayLike<number>} */ rgba, /** @type {number} */ size) {
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x !== 0 && y !== 0 && x !== size - 1 && y !== size - 1) continue;
      const i = (y * size + x) * 4;
      const a = rgba[i + 3] / 255;
      r += rgba[i] * a;
      g += rgba[i + 1] * a;
      b += rgba[i + 2] * a;
      w += a;
    }
  }
  if (w < 4) return null;
  return `rgb(${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)})`;
}

/** A master's facts from its bytes, as src/site/content/pictureFacts.ts `measureFacts` measures them. */
export async function measure(/** @type {Buffer} */ bytes) {
  const m = await sharp(bytes).metadata();
  const N = 24;
  const { data } = await sharp(bytes, { failOn: 'none' }).resize(N, N, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bg = edgeAverage(data, N);
  if (!bg) {
    const { dominant } = await sharp(bytes, { failOn: 'none' }).stats();
    bg = `rgb(${dominant.r} ${dominant.g} ${dominant.b})`;
  }
  return { width: /** @type {number} */ (m.width), height: /** @type {number} */ (m.pageHeight ?? m.height), bg, bytes: bytes.length };
}

/** @param {string} dir @returns {string[]} */
const sidecars = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name.startsWith('.') ? [] : e.isDirectory() ? sidecars(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []))
    : [];

/** The sidecar with its facts in place (before `visibility`, where the editor puts them), every other field as it was. */
function withFacts(/** @type {Record<string, unknown>} */ doc, /** @type {string} */ field, /** @type {unknown} */ facts) {
  const out = /** @type {Record<string, unknown>} */ ({});
  let placed = false;
  for (const [k, v] of Object.entries(doc)) {
    if (k === field) continue;
    if (k === 'visibility' && !placed) {
      out[field] = facts;
      placed = true;
    }
    out[k] = v;
  }
  if (!placed) out[field] = facts;
  return out;
}

/** Facts still right for a master of this size. */
const current = (/** @type {any} */ facts, /** @type {number} */ size) => !!facts && facts.bytes === size;

/**
 * Fills the sidecars under a media folder.
 * @param {string} mediaDir
 * @param {{ write?: boolean }} opts
 */
export async function fillFolder(mediaDir, { write = false } = {}) {
  let pictures = 0;
  let filled = 0;
  let failed = 0;
  for (const file of sidecars(mediaDir)) {
    /** @type {any} */
    let doc;
    try {
      doc = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (doc?.kind !== 'image' || typeof doc.file !== 'string') continue;
    pictures++;
    let next = doc;
    try {
      const master = join(dirname(file), doc.file);
      if (existsSync(master) && !current(doc.facts, statSync(master).size)) next = withFacts(next, 'facts', await measure(readFileSync(master)));
      if (typeof doc.dark?.file === 'string') {
        const dark = join(dirname(file), doc.dark.file);
        if (existsSync(dark) && !current(doc.dark.facts, statSync(dark).size)) next = { ...next, dark: { ...doc.dark, facts: await measure(readFileSync(dark)) } };
      }
    } catch {
      failed++;
      continue;
    }
    if (next === doc) continue;
    filled++;
    if (!write) continue;
    const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`);
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(tmp, file);
  }
  return { pictures, filled, failed };
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const roots = args.filter((a) => !a.startsWith('--'));
  const folders = roots.length ? roots : ['content', ...(existsSync(join('private-pages', 'access.json')) ? ['private-pages'] : [])];
  for (const root of folders) {
    const r = await fillFolder(join(root, 'media'), { write });
    console.log(`${root}: ${r.pictures} pictures, ${r.filled} ${write ? 'filled' : 'to fill'}${r.failed ? `, ${r.failed} couldn't be read` : ''}`);
  }
  if (!write) console.log('Nothing written: run again with --write to fill them.');
}
