// @ts-check
/**
 * The engine run from a read-only folder (desktop plan 9S): the Microsoft Store installs the app's files where
 * nothing may be written, and the Store's signature covers only what's in the package, so the engine stays there
 * rather than being unpacked into the app's data (where its native modules would be unsigned code outside it).
 * `astro dev` still writes a `.astro/` folder in its project's root, so the root it's given is a writable folder
 * of links: a junction for each of the engine's folders, a copy of each small file, and a real `.astro/`.
 * Junctions need no administrator. Vite serves the linked files by their real path, which
 * integrations/dev-isolation.mjs allows (`linkedFolders`).
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Makes (or brings up to date) the writable root for an engine in a read-only folder. Idempotent: links already
 * pointing at the right place stay; anything stale is replaced; `.astro/` is kept.
 * @param {string} engineDir the engine, read-only
 * @param {string} shellDir the writable root, in the app's data
 * @returns {string} shellDir
 */
export function makeEngineShell(engineDir, shellDir) {
  const from = resolve(engineDir);
  mkdirSync(shellDir, { recursive: true });
  const wanted = new Set(readdirSync(from));
  for (const name of readdirSync(shellDir)) {
    if (name === '.astro' || wanted.has(name)) continue;
    remove(join(shellDir, name));
  }
  for (const name of wanted) {
    if (name === '.astro') continue;
    const src = join(from, name);
    const dst = join(shellDir, name);
    if (lstatSync(src).isDirectory()) {
      if (existsSync(dst) && isLinkTo(dst, src)) continue;
      remove(dst);
      symlinkSync(src, dst, 'junction');
    } else {
      remove(dst);
      copyFileSync(src, dst);
    }
  }
  mkdirSync(join(shellDir, '.astro'), { recursive: true });
  return shellDir;
}

/** @param {string} p @param {string} target */
function isLinkTo(p, target) {
  try {
    return lstatSync(p).isSymbolicLink() && resolve(readlinkSync(p)).toLowerCase() === resolve(target).toLowerCase();
  } catch {
    return false;
  }
}

/** Removes a file, or a link without touching what it points to, or a folder. @param {string} p */
function remove(p) {
  let st;
  try {
    st = lstatSync(p);
  } catch {
    return;
  }
  if (st.isSymbolicLink()) {
    // a junction is a directory link: rmdir it, never recurse into the engine
    try {
      rmSync(p);
    } catch {
      unlinkSync(p);
    }
  } else rmSync(p, { recursive: true, force: true });
}
