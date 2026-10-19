#!/usr/bin/env node
/**
 * The design systems' measures (documentation/site-ui/design-system-review.md §7), taken from the source.
 * `node scripts/design-system-audit.mjs` prints them with their targets; `--json` prints the raw values;
 * `--check` exits 1 if any measure misses its target. Every count here is the review's definition: change a
 * definition here and in the review together.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import postcss from 'postcss';
import { copiedBlocks as copiedIn, sharedClassNames as sharedIn } from './lib/cssCopies.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const at = (...p) => join(ROOT, ...p);
const read = (f) => readFileSync(f, 'utf8');
const walk = (d, re) =>
  existsSync(d) ? readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p, re) : re.test(f) ? [p] : []; }) : [];
const lines = (f) => read(f).split('\n').length;
const styles = (s) => (s.match(/<style[\s\S]*?<\/style>/g) ?? []).join('\n');
// a self-closing data script first (<script … />), so it never swallows the markup after it
const markup = (s) => s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script\b[^>]*\/>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const cssOf = (f) => (f.endsWith('.css') ? read(f) : styles(read(f)).replace(/<\/?style[^>]*>/g, ''));
const parse = (css) => { try { return postcss.parse(css); } catch { return postcss.parse(''); } };

const FUNDAMENTALS = at('src/site/components/fundamentals');
const COMPOUNDS = at('src/site/components/compounds');
const EDITOR_PARTS = [...walk(at('src/site/editor/components'), /\.astro$/), ...walk(at('src/site/editor/kit'), /\.astro$/)];
// every game stylesheet: base.css and each component's own in src/game/ (DS2-04); the generated tokens.css and
// cursors.css and the entry (global.css, the layer order and imports) aside
const GAME_STYLES = [...walk(at('src/styles'), /\.css$/).filter((f) => !/[\\/](tokens|cursors|global)\.css$/.test(f)), ...walk(at('src/game'), /\.css$/)];
const GAME_UI = [...walk(at('src/game/ui'), /\.tsx$/), at('src/game/world/craft/ui.tsx'), at('src/game/world/home/TalkBox.tsx')].filter(existsSync);

const sources = (files) => files.map((f) => ({ name: basename(f), src: read(f) }));
/** Identical declaration blocks (60 or more characters) found in 2 or more files (scripts/lib/cssCopies.mjs). */
const copiedBlocks = (files) => copiedIn(sources(files)).length;
/** Class names defined in the styles of 3 or more files. */
const sharedClassNames = (files) => sharedIn(sources(files)).map((c) => `${c.name} (${c.files.length})`);

const RAW_CONTROL = /<(button|input|select|textarea|dialog)\b/g;
const PHYSICAL = /^(margin|padding|border)-(top|right|bottom|left)(-|$)|^(top|right|bottom|left)$/;
const LOGICAL = /^(margin|padding|border)-(inline|block)|^inset/;

const measures = [];
const add = (name, value, target, ok, item) => measures.push({ name, value, target, ok: Boolean(ok), item });

// ---- screenshots (WS1)
const visualSpecs = walk(at('tests/e2e'), /visual.*\.spec\.ts$/);
const baselines = walk(at('tests/e2e'), /\.png$/).filter((f) => /visual/.test(f));
const stories = walk(at('src/site/stories'), /\.stories\.astro$/);
add('Screenshot specs / baseline images', `${visualSpecs.length} / ${baselines.length}`, 'a visual project with baselines for every story', visualSpecs.length > 0 && baselines.length >= stories.length, 'DS2-01');

// ---- game styles (WS2)
// a rule outside a cascade layer (at any depth), in any game stylesheet; and the stylesheets shared by no one
// component (src/styles/ beyond the entry, base and the generated two)
let outsideLayer = 0;
for (const f of GAME_STYLES)
  parse(read(f)).walkRules((r) => {
    let p = r.parent;
    while (p && !(p.type === 'atrule' && p.name === 'layer')) p = p.parent;
    if (!p) outsideLayer++;
  });
const shared = walk(at('src/styles'), /\.css$/).filter((f) => !/[\\/](tokens|cursors|global|base)\.css$/.test(f)).length;
add('Game rules outside a cascade layer / shared stylesheets beyond base.css', `${outsideLayer} / ${shared}`, '0 / 0', outsideLayer === 0 && shared === 0, 'DS2-04');
const gallery = walk(at('src/game/gallery'), /\.(tsx|astro)$/);
const galleryText = gallery.map(read).join('\n');
const primitives = ['Button', 'IconButton', 'KeyCap', 'Dialog', 'Panel', 'ScrollArea'];
const shown = primitives.filter((p) => new RegExp(`<${p}\\b`).test(galleryText));
add('Game primitives in the gallery', `${shown.length} of ${primitives.length}`, 'all', shown.length === primitives.length, 'DS2-05');
let forced = 0, contrast = 0, physical = 0, logical = 0, hoverOutside = 0;
for (const f of GAME_STYLES) {
  const root = parse(read(f));
  root.walkAtRules('media', (a) => { if (/forced-colors/.test(a.params)) forced++; if (/prefers-contrast/.test(a.params)) contrast++; });
  root.walkDecls((d) => { if (PHYSICAL.test(d.prop)) physical++; if (LOGICAL.test(d.prop)) logical++; });
  root.walkRules((r) => {
    if (!/:hover/.test(r.selector)) return;
    let p = r.parent, ok = false;
    while (p) { if (p.type === 'atrule' && p.name === 'media' && /hover:\s*hover/.test(p.params)) ok = true; p = p.parent; }
    if (!ok) hoverOutside++;
  });
}
add('Game forced-colors / prefers-contrast queries', `${forced} / ${contrast}`, 'at least 1 each, covering the HUD and panels', forced > 0 && contrast > 0, 'DS2-06');
add('Game physical / logical properties', `${physical} / ${logical}`, '0 physical', physical === 0, 'DS2-06');

// ---- size (WS3)
const over = EDITOR_PARTS.filter((f) => lines(f) > 650 || lines(f) - styles(read(f)).split('\n').length > 350).map((f) => `${basename(f)} ${lines(f)}`);
add('Edit mode parts over the size limit (650 lines, or 350 without styles)', over.length ? over.join(', ') : 0, 0, over.length === 0, 'DS2-07');
const bigCompounds = ['Collection', 'SiteHeader'].map((n) => lines(join(COMPOUNDS, `${n}.astro`)));
add('Collection.astro and SiteHeader.astro lines', bigCompounds.join(' and '), '500 or fewer each', bigCompounds.every((n) => n <= 500), 'DS2-08');
const cq = walk(at('src/site/components'), /\.astro$/).filter((f) => /@container/.test(read(f))).map((f) => basename(f, '.astro'));
add('Website components using container queries', cq.length ? cq.join(', ') : 0, 'every compound placed in a column (Collection, StoryCard, Carousel)', ['Collection', 'StoryCard', 'Carousel'].every((n) => cq.includes(n)), 'DS2-08');

// ---- change history (WS4)
const changelogs = ['documentation/site-ui/token-changelog.md', 'documentation/game-ui/token-changelog.md'].filter((p) => existsSync(at(p)));
add('Token changelogs', `${changelogs.length} of 2`, 'both systems', changelogs.length === 2, 'DS2-09');

// ---- edit mode (WS5)
const raw = EDITOR_PARTS.map((f) => [basename(f), (markup(read(f)).match(RAW_CONTROL) ?? []).length]).filter(([, n]) => n > 0);
// a control the test names with its reason is allowed (tests/unit/editorDesignSystem.test.ts ALLOWED)
const allowed = [...read(at('tests/unit/editorDesignSystem.test.ts')).matchAll(/'src\/site\/editor\/[\w/]+\/([\w.]+): (<\w+)[^']*':/g)].map((m) => [m[1], m[2]]);
for (const [file] of allowed) { const r = raw.find(([f]) => f === file); if (r) r[1]--; }
const rawLeft = raw.filter(([, n]) => n > 0);
const rawTotal = rawLeft.reduce((n, [, k]) => n + k, 0);
add('Raw controls in edit mode parts, beyond those named with a reason', rawTotal ? `${rawTotal} in ${rawLeft.length} parts` : `0 (${allowed.length} named)`, '0, or each named with its reason', rawTotal === 0, 'DS2-11');
const editorCopied = copiedBlocks(EDITOR_PARTS);
add('Identical rule bodies copied between edit mode parts', editorCopied, 'fewer than 10', editorCopied < 10, 'DS2-12');
const VOCABULARY = ['issue', 'actions', 'split', 'form', 'row', 'list'];
const editorShared = sharedClassNames(EDITOR_PARTS).filter((c) => VOCABULARY.includes(c.split(' ')[0]));
add('Edit mode pieces rebuilt in 3 or more parts (issue, actions, split, form, row, list)', editorShared.length ? editorShared.join(', ') : 0, 0, editorShared.length === 0, 'DS2-12');
const partNames = EDITOR_PARTS.map((f) => basename(f, '.astro'));
const editorStories = new Set(walk(at('src/site/editor/stories'), /\.stories\.astro$/).map((f) => basename(f).replace('.stories.astro', '')));
const storied = partNames.filter((n) => editorStories.has(n)).length;
add('Edit mode parts and kit pieces with a story', `${storied} of ${partNames.length}`, 'all', storied === partNames.length, 'DS2-13');
const siteTokens = JSON.parse(read(at('src/site/design/tokens.json')));
const editorGroups = Object.entries(siteTokens.c).filter(([k]) => k === 'editor' || k.startsWith('editor-'));
const editorOwned = editorGroups.filter(([, v]) => v.$extensions?.['site.owner'] && v.$extensions['site.owner'] !== 'shared').length;
add('Edit mode token groups owned by a part', `${editorOwned} of ${editorGroups.length}`, 'every group but one shared group', editorOwned >= editorGroups.length - 1 && editorGroups.length > 1, 'DS2-14');

// ---- carried through (WS6)
add('Game :hover rules outside @media (hover: hover)', hoverOutside, 0, hoverOutside === 0, 'DS2-15');
const gameTokens = JSON.parse(read(at('src/design/tokens.json')));
const gameGroups = Object.entries(gameTokens.c ?? {}).filter(([k]) => !k.startsWith('$'));
const gameOwned = gameGroups.filter(([, v]) => v.$extensions?.['game.owner']).length;
add('Game component token groups with an owner', `${gameOwned} of ${gameGroups.length}`, 'all', gameOwned === gameGroups.length, 'DS2-16');
let exported = 0, documented = 0;
for (const f of GAME_UI) {
  const s = read(f);
  exported += (s.match(/^export\s+(default\s+)?(function|const)\s+\w+/gm) ?? []).length;
  documented += (s.match(/\*\/\s*\r?\n\s*export\s+(default\s+)?(function|const)\s+\w+/g) ?? []).length;
}
add('Exported game UI components with a doc comment', `${documented} of ${exported}`, 'all', documented === exported, 'DS2-17');
const siteCopied = copiedBlocks([...walk(FUNDAMENTALS, /\.astro$/), ...walk(COMPOUNDS, /\.astro$/)]);
add("Identical rule bodies copied across the website's components", siteCopied, 'fewer than 25', siteCopied < 25, 'DS2-18');

// ---- report
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(measures, null, 2));
} else {
  const met = measures.filter((m) => m.ok).length;
  for (const m of measures) console.log(`${m.ok ? 'met ' : 'open'}  ${m.item}  ${m.name}: ${m.value}  (target: ${m.target})`);
  console.log(`\n${met} of ${measures.length} measures at their targets.`);
}
if (process.argv.includes('--check') && measures.some((m) => !m.ok)) process.exit(1);
