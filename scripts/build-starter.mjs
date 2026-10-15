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
 *   node scripts/build-starter.mjs --services    the site and the planet, with Email me, GoatCounter and Clarity, built for
 *                                                its own address (plan stage 11), then every bundle budget
 *
 * It prints each check and exits 1 if any fails. dist/ is left for `npx astro preview`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeStarter } from '../apps/desktop/src/core/setup/starter.mjs';
import { atiyaJson } from '../apps/desktop/src/core/setup/files.mjs';
import { PLANET_ASSETS, RESIDENT_ASSETS } from '../integrations/site-only.mjs';
import { writeFileSync } from 'node:fs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siteOnly = process.argv.includes('--site-only');
// the planet's structure kept, the little planet turned off in the ways file (plan stage 8A)
const planetOff = !siteOnly && process.argv.includes('--planet-off');
const noPlanet = siteOnly || planetOff;
// contact and visitor counts of the person's own (plan stage 11), in a build for the site's own address
const services = !noPlanet && process.argv.includes('--services');
const ADDRESS = 'https://ada.github.io/';
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
  writeStarter(ROOT, { name: NAME, planet: !siteOnly, samples: true, today: new Date().toISOString().slice(0, 10), email: services ? 'ada@example.com' : null });
  if (services) {
    const file = join(ROOT, 'content', 'site.json');
    const site = JSON.parse(readFileSync(file, 'utf8'));
    site.services = { ...site.services, counts: { kind: 'goatcounter', code: 'ada', site: ADDRESS }, clarity: { id: 'abc123def4' } };
    writeFileSync(file, JSON.stringify(site, null, 2) + '\n');
  }
  if (planetOff) writeFileSync(join(ROOT, 'content', 'structures', 'ways.json'), JSON.stringify({ modes: [{ id: 'little-planet', on: false, mount: 'play' }], primary: 'site' }, null, 2) + '\n');
  // a managed site's build has its atiya.json at the root (the site-build workflow puts it there, stage 6)
  writeFileSync(join(ROOT, 'atiya.json'), atiyaJson({ login: 'ada', id: 1, name: NAME, repo: 'ada.github.io', url: 'https://ada.github.io/', explore: siteOnly ? 'site' : 'little-planet', engine: { version: '0.0.0', commit: null, sha256: null } }));
  console.log(`building the starter as ${siteOnly ? 'just the site' : planetOff ? 'the site, with the little planet turned off' : services ? 'the site and the planet, with contact and visitor counts' : 'the site and the planet'}…`);
  const env = { ...process.env };
  for (const k of ['CONTENT_ROOT', 'PRIVATE_ROOT', 'SITE_URL', 'BASE_PATH', 'PUBLIC_POSTHOG_KEY', 'PUBLIC_COUNTS']) delete env[k];
  if (services) env.SITE_URL = ADDRESS.replace(/\/$/, '');
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });

  const dist = join(ROOT, 'dist');
  const html = walk(dist).filter((f) => f.endsWith('.html'));
  const read = (f) => readFileSync(f, 'utf8');
  const home = read(join(dist, 'index.html'));
  check(home.includes(`>${NAME}</a>`), `the header names the site "${NAME}"`);
  check(/<title>[^<]*Ada Lovelace/.test(home), 'the home page\'s title is the site\'s');
  // the access agreement's words name the owner until O14 is decided (desktop spec §14); the planet's welcome is
  // the site's own person's since M3a (O5)
  const named = html.filter((f) => read(f).replace(/and Prabin is told\./g, '').match(/Prabin|Pebam/));
  check(named.length === 0, `no page names the engine's owner${named.length ? `: ${named.map((f) => relative(dist, f)).join(', ')}` : ''}`);
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
    if (services) {
      const contact = read(join(dist, 'contact', 'index.html'));
      check(contact.includes('href="mailto:ada@example.com"') && !contact.includes('data-contact-form'), 'the Contact page offers Email me, and no form')
      const assets = readdirSync(join(dist, '_astro'));
      check(assets.some((f) => /^countsClient\./.test(f)), 'the counting tools are their own chunk');
      check(home.includes('data-consent') && home.includes('Microsoft Clarity'), 'pages carry the cookie notice, naming Clarity');
      check(!html.some((f) => /gc\.zgo\.at|clarity\.ms/.test(read(f))), 'no page loads a counting script by itself (the loader does, on idle)');
      let budgets = true;
      try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'size-report.mjs'), '--prod'], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
      } catch {
        budgets = false;
      }
      check(budgets, 'every bundle budget holds, the telemetry shim and the counting tools included');
    }
    check(home.includes('Explore the planet'), 'the home page offers the planet');
    // Little planet for anyone (plan M3a): none of the owner's residents or music, and the site's own person says hello
    const residentChunks = readdirSync(join(dist, '_astro')).filter((f) => /^(Chopper|ChopperCard|home)\./.test(f));
    check(residentChunks.length === 0, `no chunk of the owner's residents (Chopper, his card, the home and family)${residentChunks.length ? `: ${residentChunks.join(', ')}` : ''}`);
    const residentFiles = RESIDENT_ASSETS.filter((f) => existsSync(join(dist, f)));
    check(residentFiles.length === 0, `none of their files or the owner's music${residentFiles.length ? `: ${residentFiles.join(', ')}` : ''}`);
    const play = read(join(dist, 'play', 'index.html'));
    check(play.includes(`aria-label="Talking with ${NAME}"`) && play.includes(`>${NAME}</p>`) && play.includes('Hi, I’m Ada Lovelace') && play.includes('class="talk-initials"'), `the welcome is the site's person's: ${NAME}, by name and initials`);
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
