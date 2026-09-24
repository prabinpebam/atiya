// Bundle budget check (spec §7): landing ships no 3D JS; game JS ≤ 450 KB gzipped.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const ASSETS = join(DIST, '_astro');
const GAME_BUDGET_KB = 450;
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
const sum = (list) => list.reduce((a, f) => a + sizes[f], 0);

const rows = js.map((f) => ({ file: f, gzKB: sizes[f].toFixed(1), landing: landing.includes(f), gate: gate.includes(f) }));
console.table(rows);

const gameKB = sum(game);
const gateKB = sum(gate);
const landingGameJs = landing.filter((f) => /game|three|fiber|drei/i.test(f) || sizes[f] > 20);
console.log(`landing eager JS: ${sum(landing).toFixed(1)} KB gz (${landing.length} files)`);
console.log(`/play gate JS:    ${gateKB.toFixed(1)} KB gz (budget ${GATE_BUDGET_KB} KB)`);
console.log(`game JS (lazy):   ${gameKB.toFixed(1)} KB gz (budget ${GAME_BUDGET_KB} KB)`);

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
if (failed) process.exit(1);
console.log('✓ bundle budgets met');
