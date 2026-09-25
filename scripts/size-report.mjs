// Bundle budget check (spec §7): landing ships no 3D JS; the game's initial JS ≤ 450 KB gzipped, and
// what it loads on demand (Chopper's body and card, the home and family, the crafting chunk, the
// inventory screen) ≤ 60 KB (raised from 40 KB: waiver in plan §6).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const ASSETS = join(DIST, '_astro');
const GAME_BUDGET_KB = 450;
const DEFERRED_BUDGET_KB = 60;
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
  const entry = [...html.matchAll(/<script[^>]+src="\/_astro\/([^"]+\.js)"/g)].map((m) => m[1]);
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
