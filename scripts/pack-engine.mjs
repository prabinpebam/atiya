#!/usr/bin/env node
/**
 * Packs an engine release (documentation/desktop/spec.md §10.1, plan stage 6): the site's code at one
 * commit, without anyone's content, as `engine-<version>.tgz`, with a manifest beside it (its version,
 * commit, sha256 and every file). It's `git archive` of the commit, so it holds exactly what's committed.
 *
 *   node scripts/pack-engine.mjs [--out <folder>] [--ref <commit>] [--list]
 *
 * --list prints the files it would pack and packs nothing.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What an engine is: everything a site's build needs, and nothing of anyone's. */
export const INCLUDE = ['package.json', 'package-lock.json', '.npmrc', 'astro.config.mjs', 'tsconfig.json', '.gitattributes', 'src/', 'public/', 'integrations/', 'packages/', 'starter/', 'scripts/build-site.mjs', 'scripts/lib/siteWeight.mjs', 'scripts/verify-sealed.mjs', 'scripts/size-report.mjs', 'contact-api/src/rules.mjs'];
/**
 * Never in an engine, even inside an included folder (the owner's content, his own mode, his secrets'
 * addresses). The contact form's rules are the one file of contact-api/ the site imports (they're pure).
 */
export const EXCLUDE = ['content/', 'private-pages/', 'modes/cozy-life/', 'assets-src/', 'documentation/', 'tests/', '.env', 'apps/', 'slate/', 'perf/', '.github/', 'contact-api/local.settings.json'];

/**
 * The files an engine release holds, from the repository's tracked files. Pure.
 * @param {string[]} tracked paths with / separators, as `git ls-files` gives them
 */
export function engineFiles(tracked) {
  const inside = (/** @type {string} */ f, /** @type {string} */ p) => (p.endsWith('/') ? f.startsWith(p) : f === p);
  return tracked.filter((f) => INCLUDE.some((p) => inside(f, p)) && !EXCLUDE.some((p) => inside(f, p))).sort();
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const git = (/** @type {string[]} */ args, /** @type {any} */ o = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, windowsHide: true, ...o });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (/** @type {string} */ k) => {
    const i = process.argv.indexOf(`--${k}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const ref = arg('ref') ?? 'HEAD';
  const commit = String(git(['rev-parse', ref], { encoding: 'utf8' })).trim();
  const tracked = String(git(['ls-tree', '-r', '--name-only', commit], { encoding: 'utf8' })).split('\n').filter(Boolean);
  const files = engineFiles(tracked);
  if (process.argv.includes('--list')) {
    for (const f of files) console.log(f);
    process.exit(0);
  }
  const version = JSON.parse(String(git(['show', `${commit}:package.json`], { encoding: 'utf8' }))).version;
  const out = resolve(arg('out') ?? join(ROOT, 'release'));
  mkdirSync(out, { recursive: true });
  const archive = join(out, `engine-${version}.tgz`);
  const list = join(out, `engine-${version}.files`);
  writeFileSync(list, files.join('\n') + '\n');
  // the allow-list's own entries, with the exclusions as pathspec magic (a list of every file would be too long for Windows)
  const specs = [...INCLUDE.map((p) => p.replace(/\/$/, '')), ...EXCLUDE.map((p) => `:(exclude)${p.replace(/\/$/, '')}`)];
  git(['archive', '--format=tar.gz', '--prefix=engine/', '-o', archive, commit, '--', ...specs]);
  // what's in it is exactly the listing (a tar that can list it: Windows and every runner ship one)
  const packed = String(execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
    .split(/\r?\n/)
    .filter((l) => l && !l.endsWith('/'))
    .map((l) => l.replace(/^engine\//, ''))
    .sort();
  if (packed.join('\n') !== files.join('\n')) throw new Error(`the archive's files differ from the engine's listing (${packed.length} packed, ${files.length} listed)`);
  const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
  const manifest = { version, commit, sha256, archive: `engine-${version}.tgz`, files: files.length };
  writeFileSync(join(out, `engine-${version}.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`packed ${files.length} files at ${commit.slice(0, 12)} into ${archive}\nsha256 ${sha256}`);
}
