#!/usr/bin/env node
/**
 * Bundles an engine release into the app (documentation/desktop/spec.md §10.2, plan stage 7): unpacks the
 * archive into apps/desktop/engine/, installs its production packages, and puts its manifest beside it as
 * engine.json (so a new site pins this release). The app then runs managed sites with this engine, under
 * Electron's own Node, and needs no checkout and no Node.js on the computer.
 *
 *   node scripts/bundle-engine.mjs --engine <engine-x.y.z.tgz>
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--engine');
const archive = i > 0 ? resolve(process.argv[i + 1]) : '';
if (!archive || !existsSync(archive)) {
  console.error('Give the engine release: --engine <engine-x.y.z.tgz> (node scripts/pack-engine.mjs makes one).');
  process.exit(1);
}
const manifest = archive.replace(/\.tgz$/, '.json');
if (!existsSync(manifest)) {
  console.error(`The release's manifest isn't beside it (${manifest}).`);
  process.exit(1);
}
const target = join(APP, 'engine');
const scratch = join(APP, '.engine-unpacking');
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
execFileSync('tar', ['-xzf', archive, '-C', scratch]);
const engine = join(scratch, 'engine');
// on GitHub's runners (--public-registry): the lockfile was written through a package-feed mirror of the public
// registry; the same tarballs and integrity hashes are fetched from the public registry, as the site's workflows do
if (process.argv.includes('--public-registry')) {
  const lock = join(engine, 'package-lock.json');
  writeFileSync(lock, readFileSync(lock, 'utf8').replace(/https:\/\/[^"]+\/npm\/registry\//g, 'https://registry.npmjs.org/'));
}
console.log('installing the engine\'s production packages…');
execFileSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: engine, stdio: 'inherit', shell: process.platform === 'win32' });
copyFileSync(manifest, join(engine, 'engine.json'));
rmSync(target, { recursive: true, force: true });
renameSync(engine, target);
rmSync(scratch, { recursive: true, force: true });
console.log(`bundled the engine in ${target}`);
