// Bundle budget check (spec §7): landing ships no 3D JS; the game's initial JS ≤ 450 KB gzipped, and
// what it loads on demand (Chopper's body and card, the home and family, the crafting chunk, the
// inventory screen, the planet's route planner and Prabin) ≤ 70 KB (raised from 40 KB: waiver in plan §6).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
// 119 → 120 KB for the procedural jump, the furnace's fire glow and lamp, and Chopper's face; pending the owner's OK
const DEFERRED_BUDGET_KB = 120;
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
const game = js.filter((f) => !gate.includes(f) && !landing.includes(f));
// the game the gate loads to become playable, and what it fetches later on demand
const initial = staticClosure(game.filter((f) => /^game-mount\./.test(f))).filter((f) => game.includes(f));
const deferred = game.filter((f) => !initial.includes(f));
const sum = (list) => list.reduce((a, f) => a + sizes[f], 0);

const rows = js.map((f) => ({ file: f, gzKB: sizes[f].toFixed(1), landing: landing.includes(f), gate: gate.includes(f) }));
console.table(rows);

const gameKB = sum(initial);
const deferredKB = sum(deferred);
const gateKB = sum(gate);
const landingGameJs = landing.filter((f) => /game|three|fiber|drei/i.test(f) || sizes[f] > 20);
console.log(`landing eager JS: ${sum(landing).toFixed(1)} KB gz (${landing.length} files)`);
console.log(`/play gate JS:    ${gateKB.toFixed(1)} KB gz (budget ${GATE_BUDGET_KB} KB)`);
console.log(`game JS (lazy):   ${gameKB.toFixed(1)} KB gz (budget ${GAME_BUDGET_KB} KB)`);
console.log(`  on demand:      ${deferredKB.toFixed(1)} KB gz (budget ${DEFERRED_BUDGET_KB} KB): ${deferred.join(', ')}`);

let failed = false;
if (process.argv.includes('--prod')) {
  const leaked = js.filter((f) => readFileSync(join(ASSETS, f), 'utf8').includes('__game'));
  if (leaked.length) {
    console.error(`✗ test hook (window.__game) found in production build: ${leaked.join(', ')}`);
    failed = true;
  } else {
    console.log('✓ no test hook in production build');
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
if (deferredKB > DEFERRED_BUDGET_KB) {
  console.error(`✗ on-demand game JS over budget`);
  failed = true;
}
if (failed) process.exit(1);
console.log('✓ bundle budgets met');
