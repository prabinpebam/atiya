#!/usr/bin/env node
/**
 * The parity check (documentation/desktop/spec.md §6.4, plan stage 10): builds one site twice from one commit,
 * from source as deploy.yml does, and through that commit's engine pack as a managed site's site-build.yml
 * does, then compares the two (scripts/lib/parity.mjs). It proves the owner's site, built from source, is
 * what an engine release would make of the same content.
 *
 *   node scripts/build-parity.mjs                      the owner's site: content/ and private-pages/
 *   node scripts/build-parity.mjs --starter [--site-only]  the starter, as a person's new site
 *
 *   --install      install the engine's packages with npm ci, as site-build.yml does (CI); without it the
 *                  engine build borrows this checkout's node_modules (the same lockfile), which is faster
 *   --allow-dirty  build although the engine's files have changes that aren't committed (they'd differ)
 *   --keep         keep both builds in the scratch folder, and say where
 *
 * Both builds use scripts/build-site.mjs (the build, the seal, the leak check, the budgets), for the
 * owner's address (or ada.github.io for the starter). It prints counts and public paths only: never a sealed
 * file, a private page's path or a line of the build's log. Exits 1 if the builds differ.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareBuilds, describe } from './lib/parity.mjs';
import { INCLUDE } from './pack-engine.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const has = (/** @type {string} */ f) => process.argv.includes(`--${f}`);
const starter = has('starter');
const siteOnly = starter && has('site-only');
const ci = !!process.env.GITHUB_ACTIONS;
const step = (/** @type {string} */ s) => console.log(`\n== ${s}`);
const fail = (/** @type {string} */ why) => {
  console.log(`${ci ? '::error::' : 'FAILED: '}${why}`);
  process.exitCode = 1;
  throw new Error('stop');
};
const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });

// the engine pack is the commit; the source build is the working tree: they must be the same code
const dirty = git(['status', '--porcelain', '--', ...INCLUDE.map((p) => p.replace(/\/$/, ''))]).split('\n').filter(Boolean);
if (dirty.length && !has('allow-dirty')) {
  console.log(`The engine's files have changes that aren't committed, so the two builds would differ:\n${dirty.slice(0, 10).join('\n')}\nCommit them (or pass --allow-dirty), then run this again.`);
  process.exit(1);
}

const env = { ...process.env, SITE_URL: starter ? 'https://ada.github.io' : 'https://prabinpebam.github.io', BASE_PATH: starter ? '/' : '/atiya' };
for (const k of ['CONTENT_ROOT', 'PRIVATE_ROOT', 'PUBLIC_CONTACT_ENDPOINT', 'PUBLIC_POSTHOG_KEY', 'PUBLIC_POSTHOG_HOST']) delete env[k];
const buildSite = (/** @type {string} */ cwd, /** @type {string} */ log) => spawnSync(process.execPath, ['scripts/build-site.mjs', '--log', log], { cwd, env, stdio: 'inherit' }).status === 0;

// the real path: Windows may give the temporary folder's short name (PRABIN~2), and Vite resolves real paths,
// so a build under a short name hashes its components differently (Astro's scoped CSS IDs)
const work = realpathSync.native(mkdtempSync(join(tmpdir(), 'build-parity-')));
const site = join(work, 'site');
const engine = join(work, 'engine');
const aside = [
  ['content', '.content-owner-aside'],
  ['private-pages', '.private-pages-owner-aside'],
].map(([from, to]) => [join(ROOT, from), join(ROOT, to)]);
let swapped = false;

/** Every file under a build, with / separators, read only when compared. @param {string} dist */
const filesOf = (dist) => {
  /** @type {{ path: string, bytes: () => Uint8Array }[]} */
  const out = [];
  const walk = (/** @type {string} */ dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push({ path: relative(dist, p).replace(/\\/g, '/'), bytes: () => readFileSync(p) });
    }
  };
  walk(dist);
  return out;
};

try {
  step(starter ? `The starter, as ${siteOnly ? 'just the site' : 'the site and the planet'}` : "The owner's site: content/ and private-pages/");
  mkdirSync(join(site, 'private-pages'), { recursive: true });
  if (starter) {
    const { writeStarter } = await import('../apps/desktop/src/core/setup/starter.mjs');
    const { atiyaJson } = await import('../apps/desktop/src/core/setup/files.mjs');
    writeStarter(site, { name: 'Ada Lovelace', planet: !siteOnly, samples: true, today: '2026-01-01' });
    writeFileSync(join(site, 'atiya.json'), atiyaJson({ login: 'ada', id: 1, name: 'Ada Lovelace', repo: 'ada.github.io', url: 'https://ada.github.io/', explore: siteOnly ? 'site' : 'little-planet', engine: { version: '0.0.0', commit: null, sha256: null } }));
  } else {
    cpSync(join(ROOT, 'content'), join(site, 'content'), { recursive: true });
    if (existsSync(join(ROOT, 'private-pages', 'access.json'))) cpSync(join(ROOT, 'private-pages'), join(site, 'private-pages'), { recursive: true, filter: (f) => !/[\\/]\.git$/.test(f) });
  }

  step('From source, as deploy.yml builds');
  if (starter) {
    for (const [, to] of aside) if (existsSync(to)) fail(`${relative(ROOT, to)} exists: a run was interrupted. Put it back first (rename it to ${relative(ROOT, to).replace(/^\.(.*)-owner-aside$/, '$1')}).`);
    for (const [from, to] of aside) if (existsSync(from)) renameSync(from, to);
    swapped = true;
    cpSync(join(site, 'content'), join(ROOT, 'content'), { recursive: true });
    mkdirSync(join(ROOT, 'private-pages'), { recursive: true });
    cpSync(join(site, 'atiya.json'), join(ROOT, 'atiya.json'));
  }
  if (!buildSite(ROOT, join(work, 'source.log'))) fail('the source build failed (above)');
  cpSync(join(ROOT, 'dist'), join(work, 'source-dist'), { recursive: true });

  step("Through this commit's engine pack, as site-build.yml builds");
  execFileSync(process.execPath, ['scripts/pack-engine.mjs', '--out', join(work, 'release')], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const manifest = JSON.parse(readFileSync(join(work, 'release', readdirSync(join(work, 'release')).find((f) => f.endsWith('.json')) ?? ''), 'utf8'));
  execFileSync('tar', ['-xzf', join(work, 'release', manifest.archive), '-C', work]);
  rmSync(join(engine, 'content'), { recursive: true, force: true });
  cpSync(join(site, 'content'), join(engine, 'content'), { recursive: true });
  cpSync(join(site, 'private-pages'), join(engine, 'private-pages'), { recursive: true });
  // a managed site's settings: the starter's own; the owner's, as his site would have them (the design
  // library and the documentation on: no release has the documentation, the one difference allowed)
  if (starter) cpSync(join(site, 'atiya.json'), join(engine, 'atiya.json'));
  else writeFileSync(join(engine, 'atiya.json'), JSON.stringify({ schema: 1, engine: { version: manifest.version, sha256: manifest.sha256, commit: manifest.commit }, contract: 1, features: { designLibrary: true, docs: true }, owner: { login: 'prabinpebam', id: 0 } }, null, 2) + '\n');
  console.log(`engine ${manifest.version} at ${manifest.commit.slice(0, 12)}: ${manifest.files} files`);
  if (has('install')) {
    // on GitHub's runners, as site-build.yml does: the lockfile names the package-feed mirror it was written through
    if (ci) {
      const lock = join(engine, 'package-lock.json');
      writeFileSync(lock, readFileSync(lock, 'utf8').replace(/https:\/\/[^"]+\/npm\/registry\//g, 'https://registry.npmjs.org/'));
    }
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: engine, stdio: 'inherit', shell: process.platform === 'win32' });
  } else symlinkSync(join(ROOT, 'node_modules'), join(engine, 'node_modules'), 'junction');
  if (!buildSite(engine, join(work, 'engine.log'))) fail('the engine build failed (above)');

  step('Compare');
  const report = compareBuilds(filesOf(join(work, 'source-dist')), filesOf(join(engine, 'dist')));
  console.log(describe(report));
  if (!report.ok) fail('the two builds differ: the engine release would not make the same site');
} catch (e) {
  if (!(e instanceof Error && e.message === 'stop')) {
    console.log(`${ci ? '::error::' : 'FAILED: '}${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
} finally {
  if (swapped) {
    rmSync(join(ROOT, 'content'), { recursive: true, force: true });
    rmSync(join(ROOT, 'private-pages'), { recursive: true, force: true });
    rmSync(join(ROOT, 'atiya.json'), { force: true });
    for (const [from, to] of aside) if (existsSync(to)) renameSync(to, from);
    if (!existsSync(join(ROOT, 'private-pages'))) mkdirSync(join(ROOT, 'private-pages'));
  }
  // the borrowed node_modules is a link: remove the link, never what it points at
  const link = join(engine, 'node_modules');
  if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link);
  if (has('keep')) console.log(`\nkept: ${work}`);
  else if (!existsSync(link) || !lstatSync(link).isSymbolicLink()) rmSync(work, { recursive: true, force: true });
}
