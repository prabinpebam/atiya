#!/usr/bin/env node
/**
 * Builds a site and checks it, the one way every published build does (documentation/desktop/spec.md §6.4,
 * plan stage 10): the owner's deploy (.github/workflows/deploy.yml), every managed site's build
 * (site-build.yml) and their rehearsal (site-build-local.mjs) all run this, so they can't drift apart.
 * It's in every engine release.
 *
 *   node scripts/build-site.mjs [--log <file>] [--verbose]
 *
 * 1. builds quietly: the build's log goes to a file, never the console, since it can name private pages and
 *    a workflow's log is public (--verbose prints it, for a build on this computer);
 * 2. checks the sealer ran, and prints its counts (all it prints is counts);
 * 3. checks for leaks (scripts/verify-sealed.mjs);
 * 4. checks the bundle budgets when the site has the planet (scripts/size-report.mjs --prod);
 * 5. weighs the site against GitHub Pages' 1 GB: a warning past 750 MB, a failure past 950 MB.
 *
 * The build's environment (SITE_URL, BASE_PATH) is the caller's. Exits 1 at the first step that fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planetOn } from '../integrations/features.mjs';
import { telemetryNote } from '../integrations/services.mjs';
import { weighDir, weightVerdict } from './lib/siteWeight.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const arg = (/** @type {string} */ k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const verbose = process.argv.includes('--verbose');
const managed = existsSync(join(ROOT, 'atiya.json'));
const ci = !!process.env.GITHUB_ACTIONS;
const fail = (/** @type {string} */ why) => {
  console.log(`${ci ? '::error::' : 'FAILED: '}${why}`);
  process.exit(1);
};
const node = (/** @type {string[]} */ args) => spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' }).status === 0;

const astroPkg = createRequire(import.meta.url).resolve('astro/package.json');
const bin = JSON.parse(readFileSync(astroPkg, 'utf8')).bin;
const astro = join(dirname(astroPkg), typeof bin === 'string' ? bin : bin.astro);

const log = resolve(arg('log') ?? join(process.env.RUNNER_TEMP || mkdtempSync(join(tmpdir(), 'site-build-')), 'build.log'));
console.log('Building the site…');
const built = spawnSync(process.execPath, [astro, 'build'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const out = `${built.stdout ?? ''}${built.stderr ?? ''}`;
writeFileSync(log, out);
if (verbose) process.stdout.write(out);
if (built.status !== 0)
  fail(managed ? "The site didn't build. Its log isn't printed here, since it can name private pages: open the site in Atiya Studio and choose Check my site." : `The build failed. Its log isn't printed here, since it can name protected pages: run npm run build locally to see why${ci ? '' : ` (or read ${log})`}.`);
const sealed = out.match(/\[site-seal\].*/g);
if (!sealed) fail("The sealer didn't run: the build is not sealed.");
for (const line of sealed ?? []) console.log(line);

console.log('Checking for leaks…');
if (!node(['scripts/verify-sealed.mjs'])) fail('The leak check failed: nothing is published.');

if (planetOn(join(ROOT, 'content'))) {
  console.log('Checking the bundle budgets…');
  if (!node(['scripts/size-report.mjs', '--prod'])) fail('A bundle budget was missed: nothing is published.');
} else console.log('Just the site: no planet budgets to check.');

const weight = weightVerdict(weighDir(join(ROOT, 'dist')));
if (weight.level === 'fail') fail(weight.words);
console.log(weight.level === 'warn' ? `${ci ? '::warning::' : 'Note: '}${weight.words}` : weight.words);

// a telemetry key left out because of the address is said, not lost silently (it isn't a reason to stop)
try {
  const note = telemetryNote(JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8')), { siteUrl: process.env.SITE_URL, base: process.env.BASE_PATH });
  if (note) console.log(`${ci ? '::warning::' : 'Note: '}${note}`);
} catch {
  // the content check has already named an unreadable site.json
}
console.log('Built and checked: dist/ is ready to publish.');
