#!/usr/bin/env node
/**
 * Imports the website's icons (docs: documentation/site-ui/design-system.md §2).
 *
 * The site draws Font Awesome Pro *Duotone* icons (licensed to the site's owner) from a local copy of
 * the library, never a CDN or a package. Only the icons the site asks for are copied, as path data:
 * `src/site/design/icon-set.json` lists them (the name components use → the Font Awesome name, with
 * an optional `style/` prefix for an icon Duotone lacks), and this script writes the generated
 * `src/site/design/iconData.ts`. Never hand-edit that file.
 *
 *   node scripts/import-site-icons.mjs                     re-import every icon in the set
 *   node scripts/import-site-icons.mjs share=share-nodes   add (or change) icons, then re-import
 *   node scripts/import-site-icons.mjs --check             fail if iconData.ts is stale
 *
 * The library is found at --library <dir>, $FA_LIBRARY or E:\Projects\Work\fontawesome. Its SVGs
 * are in font coordinates (y up, flipped by a `translate(0,448) scale(1,-1)` group); the flip is
 * baked into the paths here, so they draw in an ordinary `0 0 w 512` viewBox. A duotone icon's first
 * path is its secondary layer and its second the primary; an icon with one layer (a check, a chevron)
 * is all primary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SET = join(ROOT, 'src/site/design/icon-set.json');
const OUT = join(ROOT, 'src/site/design/iconData.ts');
const STYLES = { duotone: 'fad', 'classic-solid': 'fas' };
const BASELINE = 448;

const args = process.argv.slice(2);
const check = args.includes('--check');
const libArg = args.indexOf('--library');
const library = libArg >= 0 ? args[libArg + 1] : process.env.FA_LIBRARY || 'E:\\Projects\\Work\\fontawesome';
const additions = args.filter((a, i) => a.includes('=') && args[i - 1] !== '--library');

const set = JSON.parse(readFileSync(SET, 'utf8'));
for (const a of additions) {
  const [name, fa] = a.split('=');
  if (!/^[a-z][a-z0-9-]*$/.test(name) || !fa) throw new Error(`"${a}": use <name>=<font-awesome-name>`);
  set.icons[name] = fa;
}
set.icons = Object.fromEntries(Object.entries(set.icons).sort(([a], [b]) => a.localeCompare(b)));

/** Flip a path from font coordinates (y up from the baseline) to SVG ones (y down from the top). */
function flipPath(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const num = (n) => String(Math.round(n * 1000) / 1000);
  const out = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error(`path starts with a number: ${d.slice(0, 40)}`);
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    const n = ARITY[lower];
    if (n === undefined) throw new Error(`unknown path command ${cmd}`);
    if (n === 0) {
      out.push(cmd);
      continue;
    }
    const v = tokens.slice(i, i + n).map(Number);
    if (v.length < n || v.some((x) => Number.isNaN(x))) throw new Error(`short ${cmd} in ${d.slice(0, 40)}`);
    i += n;
    const y = (k) => (rel ? -v[k] : BASELINE - v[k]);
    let p;
    if (lower === 'h') p = [v[0]];
    else if (lower === 'v') p = [y(0)];
    else if (lower === 'a') {
      if (![0, 1].includes(v[3]) || ![0, 1].includes(v[4])) throw new Error('arc flags must be 0 or 1');
      p = [v[0], v[1], -v[2], v[3], 1 - v[4], v[5], y(6)];
    } else p = v.map((x, k) => (k % 2 ? y(k) : x));
    out.push(cmd + p.map(num).join(' '));
    // after a moveto, further pairs are linetos
    if (lower === 'm') cmd = rel ? 'l' : 'L';
  }
  return out.join('').replace(/ -/g, '-');
}

function load(spec) {
  const [style, name] = spec.includes('/') ? spec.split('/') : ['duotone', spec];
  const prefix = STYLES[style];
  if (!prefix) throw new Error(`${spec}: style must be one of ${Object.keys(STYLES).join(', ')}`);
  const file = join(library, 'icons', style, `${prefix}-${name}.svg`);
  if (!existsSync(file)) throw new Error(`${spec}: not in the library (${file})`);
  const svg = readFileSync(file, 'utf8');
  const box = /viewBox="0 0 (\d+) 512"/.exec(svg);
  if (!box) throw new Error(`${spec}: expected a 0 0 w 512 viewBox`);
  const groups = [...svg.matchAll(/<g transform="translate\(0, 448\) scale\(1, -1\)">\s*<path d="([^"]+)"[^>]*\/>\s*<\/g>/g)].map((m) => m[1]);
  const paths = [...svg.matchAll(/<path [^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  if (groups.length === 0 && paths.length === 1) {
    // a plain y-down icon (the classic styles): one layer, already in SVG coordinates
    return { fa: `${style}/${name}`, width: Number(box[1]), primary: paths[0], secondary: '' };
  }
  if (groups.length !== paths.length || paths.length < 1 || paths.length > 2) throw new Error(`${spec}: unexpected SVG structure`);
  const [secondary, primary] = paths.length === 2 ? groups : ['', groups[0]];
  return { fa: `${style === 'duotone' ? '' : `${style}/`}${name}`, width: Number(box[1]), primary: flipPath(primary), secondary: secondary ? flipPath(secondary) : '' };
}

function render() {
  const entries = Object.entries(set.icons).map(([name, spec]) => {
    const i = load(spec);
    return `  '${name}': { fa: '${i.fa}', width: ${i.width}, primary: '${i.primary}', secondary: '${i.secondary}' },`;
  });
  return `/**
 * Generated by scripts/import-site-icons.mjs from src/site/design/icon-set.json: Font Awesome Pro
 * Duotone (solid) icons, licensed to the site's owner, as path data in a 0 0 width 512 box. The
 * secondary layer is empty for an icon with one layer. Never hand-edit; to add an icon, run
 * node scripts/import-site-icons.mjs <name>=<font-awesome-name>.
 */
export interface IconPaths {
  fa: string;
  width: number;
  primary: string;
  secondary: string;
}

export const ICON_DATA = {
${entries.join('\n')}
} as const satisfies Record<string, IconPaths>;
`;
}

if (!existsSync(join(library, 'icons', 'duotone'))) {
  // without the library (CI), --check can only confirm the generated file covers the set
  if (!check) throw new Error(`Font Awesome library not found at ${library} (use --library or FA_LIBRARY)`);
  const data = readFileSync(OUT, 'utf8');
  const names = [...data.matchAll(/^ {2}'([\w-]+)': \{ fa: '([^']+)'/gm)].map((m) => `${m[1]}=${m[2]}`);
  const want = Object.entries(set.icons).map(([n, s]) => `${n}=${s}`);
  if (names.join() !== want.join()) {
    console.error('iconData.ts does not match icon-set.json: run node scripts/import-site-icons.mjs');
    process.exit(1);
  }
  console.log(`icons: ${names.length}, match the set (library not present: paths not re-checked)`);
} else {
  const text = render();
  if (check) {
    if (readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') !== text) {
      console.error('iconData.ts is stale: run node scripts/import-site-icons.mjs');
      process.exit(1);
    }
    console.log(`icons: ${Object.keys(set.icons).length}, up to date`);
  } else {
    writeFileSync(SET, `${JSON.stringify(set, null, 2)}\n`);
    writeFileSync(OUT, text);
    console.log(`wrote ${Object.keys(set.icons).length} icons to src/site/design/iconData.ts`);
  }
}
