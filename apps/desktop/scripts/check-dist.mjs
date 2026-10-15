#!/usr/bin/env node
/**
 * Checks Atiya Studio's preview installer (documentation/desktop/plan.md, stage 9P).
 *   --before: the engine is bundled (engine/engine.json) and git is there (dugite's), so the build can start.
 *   after: the installer is under 250 MB (spec §11); the unpacked app carries the engine and git where the app
 *   looks for them; the app's archive holds its code and none of its tests or scripts; nothing of the owner's
 *   (his content, private pages, an .env, a token) is anywhere in it.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (/** @type {string} */ m) => {
  console.error(`✗ ${m}`);
  process.exitCode = 1;
};
const ok = (/** @type {string} */ m) => console.log(`✓ ${m}`);

if (process.argv.includes('--before')) {
  if (!existsSync(join(APP, 'engine', 'engine.json'))) fail('no engine in apps/desktop/engine: run node scripts/bundle-engine.mjs --engine <engine-x.y.z.tgz> first');
  else ok('the engine is bundled');
  if (!existsSync(join(APP, 'node_modules', 'dugite', 'git', 'cmd', 'git.exe')) && process.platform === 'win32') fail("no git in node_modules/dugite: run npm install in apps/desktop");
  else ok('git is there');
  if (!existsSync(join(APP, 'vendor', 'gh', 'bin', process.platform === 'win32' ? 'gh.exe' : 'gh'))) fail('no GitHub CLI in vendor/gh: run node scripts/fetch-gh.mjs');
  else ok('the GitHub CLI is there');
} else {
  const dist = join(APP, 'dist');
  const installer = existsSync(dist) ? readdirSync(dist).find((f) => /^Atiya-Studio-Setup-.*\.exe$/.test(f)) : undefined;
  if (!installer) fail('no installer in dist/');
  else {
    const mb = statSync(join(dist, installer)).size / 1024 / 1024;
    if (mb > 250) fail(`the installer is ${mb.toFixed(0)} MB (budget 250 MB)`);
    else ok(`${installer}: ${mb.toFixed(0)} MB (budget 250 MB)`);
  }
  const res = join(dist, 'win-unpacked', 'resources');
  for (const [what, file] of [
    ['the engine, as one archive', join(res, 'engine.tar')],
    ["the engine's manifest", join(res, 'engine.json')],
    ['git', join(res, 'git', 'cmd', 'git.exe')],
    ['the GitHub CLI, for device login', join(res, 'gh', 'bin', 'gh.exe')],
    ["the app's archive", join(res, 'app.asar')],
  ])
    if (existsSync(file)) ok(`${what} is in the app`);
    else fail(`${what} is missing from the app (${relative(APP, file)})`);

  // the app's archive: its code, never its tests, scripts or the packaging tool
  if (existsSync(join(res, 'app.asar'))) {
    const require = createRequire(join(APP, 'package.json'));
    const asar = require('@electron/asar');
    const files = /** @type {string[]} */ (asar.listPackage(join(res, 'app.asar'), {})).map((f) => f.replace(/\\/g, '/'));
    const bad = files.filter((f) => /^\/(e2e|test|scripts|engine|dist)\//.test(f) || /\/node_modules\/(electron|electron-builder|dugite|@playwright)\//.test(f));
    if (bad.length) fail(`the app's archive holds what it shouldn't: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` and ${bad.length - 5} more` : ''}`);
    else ok(`the app's archive holds its code only (${files.length} entries)`);
    if (!files.includes('/src/main/main.mjs') || !files.includes('/src/ui/site/tokens.css')) fail("the app's archive is missing its main process or the site's tokens");
  }

  // the engine's archive: whole (its manifest, its packages, its starter), and only what runs
  if (existsSync(join(res, 'engine.tar'))) {
    const entries = execFileSync('tar', ['-tf', join(res, 'engine.tar')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean);
    const has = (/** @type {string} */ e) => entries.includes(e);
    if (!has('./engine.json') || !has('./node_modules/astro/package.json') || !has('./node_modules/astro/templates/content/types.d.ts') || !entries.some((e) => e.startsWith('./starter/content/'))) fail("the engine's archive is missing its manifest, its packages or its starter");
    else ok(`the engine's archive is whole (${entries.length} entries)`);
    const extra = entries.filter((e) => /\.map$/.test(e));
    if (extra.length) fail(`the engine's archive holds what never runs: ${extra.slice(0, 3).join(', ')}`);
    const owners = entries.filter((e) => /^\.\/(content|private-pages)\//.test(e) || /(^|\/)\.env(\.|$)/.test(e));
    if (owners.length) fail(`the engine's archive holds what's the owner's: ${owners.slice(0, 3).join(', ')}`);
  }

  // nothing of the owner's: his content, private pages, an .env or a token, anywhere in the unpacked app
  const owner = [];
  const walk = (/** @type {string} */ dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = relative(res, p).replace(/\\/g, '/');
      if (e.isDirectory()) {
        if (rel === 'engine/node_modules' || rel === 'git') continue;
        if (/(^|\/)private-pages$/.test(rel) || rel === 'engine/content' || /^engine\/content\/articles$/.test(rel)) owner.push(rel);
        walk(p);
      } else if (/^\.env(\.|$)/.test(e.name) || /github-token/.test(e.name)) owner.push(rel);
    }
  };
  if (existsSync(res)) walk(res);
  if (owner.length) fail(`the app holds what's the owner's: ${owner.slice(0, 5).join(', ')}`);
  else ok("nothing of the owner's in the app");
}
