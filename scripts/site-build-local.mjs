#!/usr/bin/env node
/**
 * Rehearses .github/workflows/site-build.yml on this computer (documentation/desktop/plan.md, stage 6):
 * the same checks and steps, from an engine archive and a site's workspace, so the build path can be
 * proved without GitHub. It never touches the site's workspace; everything happens in a scratch folder.
 *
 *   node scripts/site-build-local.mjs --engine <engine-x.y.z.tgz> --site <workspace> [--keep]
 *
 * Exits 1 at the first step that fails, saying which, as the workflow would.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const archive = resolve(arg('engine') ?? '');
const site = resolve(arg('site') ?? '');
const step = (name) => console.log(`\n== ${name}`);
const fail = (why) => {
  console.error(`FAILED: ${why}`);
  process.exit(1);
};
if (!existsSync(archive) || !existsSync(join(site, 'atiya.json'))) fail('give --engine <archive> and --site <a workspace with atiya.json>');

const work = mkdtempSync(join(tmpdir(), 'site-build-'));
try {
  step('Read the engine it pins');
  const pin = JSON.parse(readFileSync(join(site, 'atiya.json'), 'utf8')).engine ?? {};
  if (!pin.version || !pin.sha256 || !pin.commit) fail('atiya.json names no engine release (version, sha256 and commit)');
  console.log(`engine ${pin.version} at ${pin.commit.slice(0, 12)}`);

  step('Check the engine release');
  const sha = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (sha !== pin.sha256) fail(`the archive's checksum ${sha} isn't atiya.json's ${pin.sha256}`);
  const manifest = archive.replace(/\.tgz$/, '.json');
  if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).commit !== pin.commit) fail("the release's commit isn't the one atiya.json pins (the workflow's own commit)");
  execFileSync('tar', ['-xzf', archive, '-C', work]);
  console.log('checksum and commit match; extracted');

  step("Put the site's content where the engine reads it");
  const engine = join(work, 'engine');
  rmSync(join(engine, 'content'), { recursive: true, force: true });
  cpSync(join(site, 'content'), join(engine, 'content'), { recursive: true });
  if (existsSync(join(site, 'private-pages', 'access.json'))) cpSync(join(site, 'private-pages'), join(engine, 'private-pages'), { recursive: true });
  else mkdirSync(join(engine, 'private-pages'), { recursive: true });
  cpSync(join(site, 'atiya.json'), join(engine, 'atiya.json'));

  step("Install the engine's packages");
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: engine, stdio: 'inherit', shell: process.platform === 'win32' });

  step('Build');
  const env = { ...process.env, SITE_URL: 'https://ada.github.io', BASE_PATH: '/' };
  for (const k of ['CONTENT_ROOT', 'PRIVATE_ROOT', 'PUBLIC_POSTHOG_KEY']) delete env[k];
  const log = execFileSync(process.execPath, [join(engine, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], { cwd: engine, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const sealLine = /\[site-seal\].*/.exec(log)?.[0];
  if (!sealLine) fail("the sealer didn't run: the build is not sealed");
  console.log(sealLine);

  step('Check for leaks');
  execFileSync(process.execPath, ['scripts/verify-sealed.mjs'], { cwd: engine, stdio: 'inherit' });

  step('Check the bundle budgets');
  if (['modes/little-planet.json', 'planet.json'].some((f) => existsSync(join(engine, 'content', 'structures', ...f.split('/'))))) execFileSync(process.execPath, ['scripts/size-report.mjs', '--prod'], { cwd: engine, stdio: 'inherit' });
  else console.log('Just the site: no planet budgets to check.');

  step('The site');
  const home = readFileSync(join(engine, 'dist', 'index.html'), 'utf8');
  const name = JSON.parse(readFileSync(join(engine, 'content', 'site.json'), 'utf8')).name;
  if (!home.includes(name)) fail(`the home page doesn't name the site (${name})`);
  console.log(`dist/ is ${name}'s site: ready to upload`);
  if (process.argv.includes('--keep')) {
    const keep = join(site, '..', `${site.split(/[\\/]/).pop()}-dist`);
    rmSync(keep, { recursive: true, force: true });
    renameSync(join(engine, 'dist'), keep);
    console.log(`kept the built site in ${keep}`);
  }
  console.log('\nevery step passed');
} finally {
  rmSync(work, { recursive: true, force: true });
}
