// @ts-check
/**
 * The engine an installed app carries as one archive (documentation/desktop/plan.md, stage 9P): `engine.tar` and
 * its manifest `engine.json` in the app's resources. An installer writes one large file in seconds, where tens of
 * thousands of small ones took more than ten minutes; the app unpacks it on its first start, with the system's
 * tar (Windows 10 and later, macOS), into a folder of its own data named after the release, which is writable
 * (Astro writes its .astro/ folder there). An older release's folder is removed once the new one is unpacked.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The archive and its manifest in a packaged app's resources, if it carries them.
 * @param {string | undefined} resources
 * @returns {{ tar: string, manifest: string, version: string, sha256: string } | null}
 */
export function engineArchive(resources) {
  if (!resources) return null;
  const tar = join(resources, 'engine.tar');
  const manifest = join(resources, 'engine.json');
  if (!existsSync(tar) || !existsSync(manifest)) return null;
  const m = JSON.parse(readFileSync(manifest, 'utf8'));
  if (typeof m.version !== 'string' || typeof m.sha256 !== 'string' || !/^[0-9a-f]{12,}$/.test(m.sha256)) return null;
  return { tar, manifest, version: m.version, sha256: m.sha256 };
}

/** Where a release is unpacked: one folder per release. @param {string} userData @param {{ version: string, sha256: string }} a */
export const engineFolder = (userData, a) => join(userData, 'engine', `${a.version.replace(/[^0-9A-Za-z.-]/g, '')}-${a.sha256.slice(0, 12)}`);

/**
 * Unpacks the archive into its folder, once: into a scratch folder first, renamed when whole, so a start that
 * stops halfway never leaves half an engine. Then removes other releases' folders.
 * @param {{ tar: string }} archive @param {string} dir
 * @param {{ tarCommand?: string }} [o]
 * @returns {Promise<string>} the folder
 */
export async function unpackEngine(archive, dir, o = {}) {
  if (existsSync(join(dir, 'engine.json'))) return dir;
  const scratch = `${dir}.unpacking`;
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  await new Promise((resolve, reject) => {
    const p = spawn(o.tarCommand ?? 'tar', ['-xf', archive.tar, '-C', scratch], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`The site's engine couldn't be unpacked (${code}): ${err.trim().slice(0, 300)}`))));
  });
  if (!existsSync(join(scratch, 'engine.json'))) throw new Error("The site's engine archive has no engine.json.");
  rmSync(dir, { recursive: true, force: true });
  renameSync(scratch, dir);
  // older releases go once this one is whole
  const parent = join(dir, '..');
  for (const e of readdirSync(parent, { withFileTypes: true })) {
    const p = join(parent, e.name);
    if (e.isDirectory() && p !== dir && !e.name.endsWith('.unpacking')) rmSync(p, { recursive: true, force: true, maxRetries: 3 });
  }
  return dir;
}
