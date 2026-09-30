// Bundle budget check (spec §7; tiered by progressive-loading.md §5.6): landing ships no 3D JS; the
// game's critical JS (what the gate loads to go live) ≤ 450 KB gzipped; each chunk it fetches later
// (the summoned groups' and the on-demand screens') ≤ 150 KB gzipped; and everything downloaded before
// the planet is live (the critical JS, the chunks it waits for, the first tier of textures and the
// player's character) ≤ 1.6 MB. The chunks' sum used to share one rising waiver (40 → 122 KB, the
// history below); the tiers replace it: what's summoned is bounded by frame rate and memory, not bytes.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const ASSETS = join(DIST, '_astro');
const GAME_BUDGET_KB = 450;
// on demand: 70 → 80 KB for the blade grass (vegetation proposal D3; ≈ 7 KB gz, loaded with the wildlife)
// 80 → 85 KB for watering the garden (the targets it and the crafting chunk now own, and the lazy landmark dialog)
// 85 → 87 KB for the activation cues (the glowing ring and sparkles on what E uses, in the wildlife chunk)
// 87 → 89 KB for the crafting screen (the recipe grid, the material slots and the landing, with the backpack in it) and the menu's View group
// 89 → 95 KB for the swing (the old oak, the jute row, the swing and its site, in the crafting chunk) and the ducks (their new models, moved out of the initial bundle into the wildlife chunk, the nest and the night)
// 95 → 96 KB for riding the swing (the visitor's seat and pump, and the family's swing activities, in the crafting and home chunks)
// 96 → 103 KB for the viewing deck (its three builds' models and plan, the bench, the iron ore on the boulders, in the crafting chunk; the family's visits, in the home chunk)
// 103 → 106 KB for the deck's planting and the old pine on its cliff (viewing-deck.md §4.6, in the crafting chunk);
// 106 → 107 KB for the panels' help popover and the crafting screen's fixed layout (crafting-screen.md §4.3);
// 107 → 108 KB for the click-to-walk marker and the walk cursor's ground test (design system §6.5, in the wildlife chunk);
// 108 → 113 KB for the furnace (its site, model, fire and smelting screen, the clay beds, in the crafting chunk: furnace.md);
// 113 → 115 KB for the rabbits' coats, kits and mothers (the models and the kits' following, in the wildlife chunk);
// 115 → 119 KB for resting anywhere, the lantern and shooting stars, and the action poses moved out of the initial bundle (rest.md);
// 119 → 120 KB for the procedural jump, the furnace's fire glow and lamp, and Chopper's face; 
// 120 → 122 KB for the old pine's cliff-following roots and creepers (viewing-deck.md §4.6);
// retired for the tiers (progressive-loading.md §5.6): each later chunk ≤ 150 KB, ≤ 1.6 MB before live (the
// spec's 1.5 MB assumed ≈ 780 KB of first-tier textures; the shared kit material needs every surface mask
// at once, 871 KB; the home and crafting chunks, still waited for since they level the ground, are the
// way back under 1.5 MB: progressive-loading.md §9, pending the owner's OK)
const CHUNK_BUDGET_KB = 150;
const BEFORE_LIVE_BUDGET_KB = 1600;
/** The chunks the planet waits for before it's live (game-mount.tsx: they level the ground or attach targets). */
const PRE_LIVE = /^(Chopper|home|craft)\./;
const GATE_BUDGET_KB = 8;

if (!existsSync(ASSETS)) {
  console.error('dist/_astro not found — run `npm run build` first.');
  process.exit(1);
}

const gz = (file) => gzipSync(readFileSync(join(ASSETS, file))).length / 1024;
const js = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
const sizes = Object.fromEntries(js.map((f) => [f, gz(f)]));

/** Scripts a page loads eagerly (module scripts + their static imports). */
function eagerScripts(htmlFile) {
  const html = readFileSync(join(DIST, htmlFile), 'utf8');
  const entry = [...html.matchAll(/<script[^>]+src="[^"]*?\/_astro\/([^"]+\.js)"/g)].map((m) => m[1]);
  return staticClosure(entry);
}

/** `entry` plus everything it imports statically (not the dynamic `import()`s). */
function staticClosure(entry) {
  const seen = new Set();
  const visit = (f) => {
    if (seen.has(f) || !sizes[f]) return;
    seen.add(f);
    const src = readFileSync(join(ASSETS, f), 'utf8');
    for (const m of src.matchAll(/(?:^|[;\s}])import\s*(?:[\w*{}\s,$]+from\s*)?["']\.\/([^"']+\.js)["']/g)) visit(m[1]);
  };
  entry.forEach(visit);
  return [...seen];
}

const landing = eagerScripts('index.html');
const gate = eagerScripts(join('play', 'index.html'));
// the site's other pages (sections, pages, the design library, and the pages the planet frames over the
// game: documentation/sections/spec.md §6.7) load their own scripts: the site's, not the game's, unless the
// game reaches them too
const pages = (dir) => readdirSync(join(DIST, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pages(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []));
const reached = staticClosure(js.filter((f) => /^game-mount\./.test(f)));
const siteOnly = [...new Set(pages('').filter((p) => p !== 'index.html' && p !== join('play', 'index.html')).flatMap(eagerScripts))].filter((f) => !reached.includes(f) && !gate.includes(f) && !landing.includes(f));
const game = js.filter((f) => !gate.includes(f) && !landing.includes(f) && !siteOnly.includes(f));
// the game the gate loads to become playable, and what it fetches later on demand
const initial = staticClosure(game.filter((f) => /^game-mount\./.test(f))).filter((f) => game.includes(f));
const deferred = game.filter((f) => !initial.includes(f));
const sum = (list) => list.reduce((a, f) => a + sizes[f], 0);

// before the planet is live: the chunks it waits for (and what they import), the first tier of textures, the character
const preLive = staticClosure(deferred.filter((f) => PRE_LIVE.test(f))).filter((f) => deferred.includes(f));
const manifest = readFileSync('src/game/world/textureManifest.ts', 'utf8');
const tier1KB = [...manifest.matchAll(/"bytes": (\d+),\s*"tier": (\d)/g)].filter((m) => m[2] === '1').reduce((a, m) => a + Number(m[1]), 0) / 1024;
const characterKB = statSync(join(DIST, 'models', 'character.glb')).size / 1024;

const rows = js.map((f) => ({ file: f, gzKB: sizes[f].toFixed(1), landing: landing.includes(f), gate: gate.includes(f), preLive: preLive.includes(f) }));
console.table(rows);

const gameKB = sum(initial);
const deferredKB = sum(deferred);
const gateKB = sum(gate);
const landingGameJs = landing.filter((f) => /game|three|fiber|drei/i.test(f) || sizes[f] > 20);
console.log(`landing eager JS: ${sum(landing).toFixed(1)} KB gz (${landing.length} files)`);
console.log(`site pages' JS:   ${sum(siteOnly).toFixed(1)} KB gz (${siteOnly.length} files; the site's own, and the planet's framed pages', not the game's)`);
console.log(`/play gate JS:    ${gateKB.toFixed(1)} KB gz (budget ${GATE_BUDGET_KB} KB)`);
console.log(`game JS (lazy):   ${gameKB.toFixed(1)} KB gz (budget ${GAME_BUDGET_KB} KB)`);
console.log(`  later chunks:   ${deferredKB.toFixed(1)} KB gz in all; the largest ${Math.max(...deferred.map((f) => sizes[f])).toFixed(1)} KB (budget ${CHUNK_BUDGET_KB} KB each)`);
const beforeLiveKB = gateKB + gameKB + sum(preLive) + tier1KB + characterKB;
console.log(
  `before live:      ${beforeLiveKB.toFixed(0)} KB (budget ${BEFORE_LIVE_BUDGET_KB} KB): gate ${gateKB.toFixed(0)} + critical JS ${gameKB.toFixed(0)} + chunks waited for ${sum(preLive).toFixed(0)} + tier-1 textures ${tier1KB.toFixed(0)} + character ${characterKB.toFixed(0)}`,
);

let failed = false;
if (process.argv.includes('--prod')) {
  const leaked = js.filter((f) => readFileSync(join(ASSETS, f), 'utf8').includes('__game'));
  if (leaked.length) {
    console.error(`✗ test hook (window.__game) found in production build: ${leaked.join(', ')}`);
    failed = true;
  } else {
    console.log('✓ no test hook in production build');
  }
  // edit mode is dev only (documentation/editor/spec.md §8.1): no route, script, style, token or marker of
  // it may reach a build. The published docs (dist/docs/) describe it, so they're the one place it's named.
  const SENTINELS = ['/_edit', 'editor-block', '--c-editor', 'data-editor'];
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  const built = walk(DIST).filter((p) => !p.startsWith(join(DIST, 'docs') + sep) && /\.(html|js|mjs|css|json|xml|txt|webmanifest)$/.test(p));
  const editorLeaks = built.flatMap((p) => {
    const text = readFileSync(p, 'utf8');
    return SENTINELS.filter((t) => text.includes(t)).map((t) => `${relative(DIST, p)} (${t})`);
  });
  if (editorLeaks.length) {
    console.error(`✗ edit mode found in the production build: ${editorLeaks.slice(0, 20).join(', ')}`);
    failed = true;
  } else {
    console.log(`✓ no edit mode in the production build (${built.length} files searched)`);
  }
}
if (landingGameJs.length) {
  console.error(`✗ landing page loads 3D JS: ${landingGameJs.join(', ')}`);
  failed = true;
}
if (gateKB > GATE_BUDGET_KB) {
  console.error(`✗ gate JS over budget`);
  failed = true;
}
if (gameKB > GAME_BUDGET_KB) {
  console.error(`✗ game JS over budget`);
  failed = true;
}
if (!initial.length) {
  console.error('✗ no game-mount chunk found');
  failed = true;
}
for (const f of deferred.filter((f) => sizes[f] > CHUNK_BUDGET_KB)) {
  console.error(`✗ ${f} over the per-chunk budget`);
  failed = true;
}
if (beforeLiveKB > BEFORE_LIVE_BUDGET_KB) {
  console.error(`✗ over the budget for what's downloaded before the planet is live`);
  failed = true;
}
if (failed) process.exit(1);
console.log('✓ bundle budgets met');
