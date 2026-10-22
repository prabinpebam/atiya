/**
 * Writes the fingerprint of every library item made before fingerprints were (documentation/gallery/plan.md A1
 * item 5, spec §3.8, V55): each picture's or video file's sidecar under <root>/media/ that has a master and no
 * `fingerprint` gets the SHA-256 of its master. One-off; run again, it finds nothing left to do.
 *
 * The file as it was uploaded is gone (a picture's master is the WebP it became), so these fingerprints are
 * the masters' own: they match only a re-upload of the same master, never of the original photo. An upload
 * from now on is fingerprinted as uploaded (src/site/editor/server/media.ts).
 *
 * Two items with the same fingerprint would break V55: those aren't written, and their media IDs are listed
 * (an ID only, never a title or words). Linked videos (no file of their own) and documents are left as they are.
 *
 *   node scripts/fingerprint-library.mjs [root]          # root: a content folder (default content/)
 *   node scripts/fingerprint-library.mjs [root] --dry    # count only, write nothing
 *
 * Writes JSON as the editor's store does (2-space indent, a trailing newline) and prints counts only.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const root = resolve(args.find((a) => !a.startsWith('--')) ?? 'content');
const mediaRoot = join(root, 'media');
if (!existsSync(mediaRoot)) {
  console.error(`No media folder in ${root}`);
  process.exit(1);
}

const sidecars = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) walk(abs);
    else if (e.name.endsWith('.json')) sidecars.push(abs);
  }
};
walk(mediaRoot);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
/** The same object with `fingerprint` before `visibility`, where an upload writes it. */
const withFingerprint = (doc, fingerprint) => {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === 'visibility') out.fingerprint = fingerprint;
    out[k] = v;
  }
  if (!('fingerprint' in out)) out.fingerprint = fingerprint;
  return out;
};

const counts = { sidecars: sidecars.length, had: 0, skipped: 0, missing: 0, written: 0, clashing: 0 };
/** Every item's fingerprint, the ones it already had and the ones to write: fingerprint → media IDs. */
const owners = new Map();
const pending = [];
for (const abs of sidecars) {
  const id = relative(mediaRoot, abs).split(sep).join('/').replace(/\.json$/, '');
  let doc;
  try {
    doc = JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    counts.skipped++;
    continue;
  }
  if (!doc || (doc.kind !== 'image' && doc.kind !== 'video') || typeof doc.file !== 'string') {
    counts.skipped++;
    continue;
  }
  let fingerprint = doc.fingerprint;
  if (typeof fingerprint === 'string') counts.had++;
  else {
    const master = join(abs, '..', doc.file);
    if (!existsSync(master)) {
      counts.missing++;
      continue;
    }
    fingerprint = hash(readFileSync(master));
    pending.push({ abs, id, doc, fingerprint });
  }
  owners.set(fingerprint, [...(owners.get(fingerprint) ?? []), id]);
}

const clashes = [...owners.values()].filter((ids) => ids.length > 1);
const clashing = new Set(clashes.flat());
for (const p of pending) {
  if (clashing.has(p.id)) {
    counts.clashing++;
    continue;
  }
  if (!DRY) writeFileSync(p.abs, `${JSON.stringify(withFingerprint(p.doc, p.fingerprint), null, 2)}\n`, 'utf8');
  counts.written++;
}

console.log(`${counts.sidecars} sidecars: ${counts.had} already had a fingerprint, ${counts.written} ${DRY ? 'to write' : 'written'}, ${counts.skipped} not a picture or video file, ${counts.missing} without their master.`);
if (clashes.length) {
  console.log(`${clashes.length} fingerprint${clashes.length === 1 ? '' : 's'} shared by more than one item (V55): ${counts.clashing} left without one. Their media IDs:`);
  for (const ids of clashes) console.log(`- ${ids.join(', ')}`);
}
