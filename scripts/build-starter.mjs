#!/usr/bin/env node
/**
 * Builds the starter content as a person's new site and checks the result (documentation/desktop/plan.md,
 * stage 4). A build always reads content/ (CONTENT_ROOT is refused in a build), so this moves the owner's
 * content/ and private-pages/ aside, writes the starter in their place, builds, checks, and puts them back,
 * whatever happens.
 *
 *   node scripts/build-starter.mjs --site-only   just the site: no planet anywhere in dist/
 *   node scripts/build-starter.mjs --planet-off  a planet structure, with the little planet turned off (plan 8A)
 *   node scripts/build-starter.mjs               the site and the planet
 *
 * It prints each check and exits 1 if any fails. dist/ is left for `npx astro preview`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeStarter } from '../apps/desktop/src/core/setup/starter.mjs';
import { atiyaJson } from '../apps/desktop/src/core/setup/files.mjs';
import { PLANET_ASSETS } from '../integrations/site-only.mjs';
import { writeFileSync } from 'node:fs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siteOnly = process.argv.includes('--site-only');
// the planet's structure kept, the little planet turned off in the ways file (plan stage 8A)
const planetOff = !siteOnly && process.argv.includes('--planet-off');
const noPlanet = siteOnly || planetOff;
const NAME = 'Ada Lovelace';
const aside = [
  ['content', '.content-owner-aside'],
  ['private-pages', '.private-pages-owner-aside'],
].map(([from, to]) => [join(ROOT, from), join(ROOT, to)]);

for (const [, to] of aside)
  if (existsSync(to)) {
    console.error(`${relative(ROOT, to)} exists: a run was interrupted. Put it back first (rename it to ${relative(ROOT, to).replace(/^\.(.*)-owner-aside$/, '$1')}), then run this again.`);
    process.exit(1);
  }

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok     ' : 'FAILED '} ${what}`);
  if (!ok) failed++;
};

try {
  for (const [from, to] of aside) if (existsSync(from)) renameSync(from, to);
  mkdirSync(join(ROOT, 'private-pages'), { recursive: true });
  writeStarter(ROOT, { name: NAME, planet: !siteOnly, samples: true, today: new Date().toISOString().slice(0, 10) });
  if (planetOff) writeFileSync(join(ROOT, 'content', 'structures', 'ways.json'), JSON.stringify({ modes: [{ id: 'little-planet', on: false, mount: 'play' }], primary: 'site' }, null, 2) + '\n');
  // a managed site's build has its atiya.json at the root (the site-build workflow puts it there, stage 6)
  writeFileSync(join(ROOT, 'atiya.json'), atiyaJson({ login: 'ada', id: 1, name: NAME, repo: 'ada.github.io', url: 'https://ada.github.io/', explore: siteOnly ? 'site' : 'little-planet', engine: { version: '0.0.0', commit: null, sha256: null } }));
  console.log(`building the starter as ${siteOnly ? 'just the site' : planetOff ? 'the site, with the little planet turned off' : 'the site and the planet'}…`);
  const env = { ...process.env };
  for (const k of ['CONTENT_ROOT', 'PRIVATE_ROOT', 'SITE_URL', 'BASE_PATH', 'PUBLIC_POSTHOG_KEY']) delete env[k];
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });

  const dist = join(ROOT, 'dist');
  const html = walk(dist).filter((f) => f.endsWith('.html'));
  const read = (f) => readFileSync(f, 'utf8');
  const home = read(join(dist, 'index.html'));
  check(home.includes(`>${NAME}</a>`), `the header names the site "${NAME}"`);
  check(/<title>[^<]*Ada Lovelace/.test(home), 'the home page\'s title is the site\'s');
  // the access agreement's words name the owner until O14 is decided (desktop spec §14), and the planet's
  // host is the owner (Prabin's welcome, his family) until stage 8 makes Little planet for anyone (O5)
  const hostedByOwner = (f) => !noPlanet && relative(dist, f).replace(/\\/g, '/') === 'play/index.html';
  const named = html.filter((f) => !hostedByOwner(f) && read(f).replace(/and Prabin is told\./g, '').match(/Prabin|Pebam/));
  check(named.length === 0, `no page names the engine's owner${named.length ? `: ${named.map((f) => relative(dist, f)).join(', ')}` : ''}${noPlanet ? '' : ' (but the planet, whose host is his until stage 8)'}`);
  check(!existsSync(join(dist, 'design')) && !existsSync(join(dist, 'docs')), 'no design library or documentation (the owner\'s, off for a managed site)');
  const extras = html.filter((f) => /href="[^"]*\/(design|docs)\/"/.test(read(f)));
  check(extras.length === 0, `no page links to them${extras.length ? `: ${extras.slice(0, 5).map((f) => relative(dist, f)).join(', ')}` : ''}`);
  if (noPlanet) {
    check(!home.includes('Explore the planet') && !home.includes('Explore in 3D'), 'the home page has no way into the planet');
    check(!home.includes('/poster/'), 'the home page has no painting of the planet');
    const linking = html.filter((f) => !relative(dist, f).startsWith('play') && /href="[^"]*\/play\//.test(read(f)));
    check(linking.length === 0, `no page links to /play/${linking.length ? `: ${linking.slice(0, 5).map((f) => relative(dist, f)).join(', ')}` : ''}`);
    const play = join(dist, 'play', 'index.html');
    if (siteOnly) check(existsSync(play) && /http-equiv="refresh"/i.test(read(play)), '/play/ sends the reader home');
    else {
      const page = existsSync(play) ? read(play) : '';
      check(/isn(?:'|&#39;|’)t offered/.test(page) && /name="robots" content="noindex/.test(page) && !/http-equiv="refresh"/i.test(page) && /href="\/"/.test(page), '/play/ is the "not offered" page: noindex, a link home, no redirect');
      check(!/game-[^"]*\.js/.test(page), 'the "not offered" page loads no game code');
    }
    check(!existsSync(join(dist, 'play', 'workshop')), 'no building\'s pages are built');
    const chunks = existsSync(join(dist, '_astro')) ? readdirSync(join(dist, '_astro')).filter((f) => f.startsWith('game-')) : [];
    check(chunks.length === 0, `no game chunks${chunks.length ? `: ${chunks.length} left` : ''}`);
    const assets = PLANET_ASSETS.filter((f) => existsSync(join(dist, f)));
    check(assets.length === 0, `no planet assets${assets.length ? `: ${assets.join(', ')}` : ''}`);
  } else {
    check(home.includes('Explore the planet'), 'the home page offers the planet');
    check(existsSync(join(dist, 'play', 'workshop', 'index.html')), 'the buildings\' pages are built');
    check(readdirSync(join(dist, '_astro')).some((f) => f.startsWith('game-')), 'the game\'s chunks are there');
  }
} catch (e) {
  console.error(String(e?.message ?? e));
  failed++;
} finally {
  rmSync(join(ROOT, 'content'), { recursive: true, force: true });
  rmSync(join(ROOT, 'private-pages'), { recursive: true, force: true });
  rmSync(join(ROOT, 'atiya.json'), { force: true });
  for (const [from, to] of aside) if (existsSync(to)) renameSync(to, from);
  if (!existsSync(join(ROOT, 'private-pages'))) mkdirSync(join(ROOT, 'private-pages'));
}
console.log(failed ? `${failed} check(s) failed` : 'every check passed');
process.exit(failed ? 1 : 0);
