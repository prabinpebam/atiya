/**
 * Design tokens → CSS (docs: documentation/game-ui/design-system.md §3).
 *
 * src/design/tokens.json (W3C DTCG format) is the source of truth. This writes:
 *   - src/styles/tokens.css: every token as a CSS custom property, aliases kept as var() references,
 *     and the surfaces: fixed paper for key caps, and light paper / dark wood for the game;
 *   - documentation/game-ui/tokens.md: the token reference for the docs site (a `$deprecated` token marked);
 *   - src/design/token-history.json and documentation/game-ui/token-changelog.md: the changelog, from the
 *     last built token set (scripts/lib/token-changelog.mjs).
 * Never hand-edit any of them. `node scripts/build-tokens.mjs --check` fails if they're out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { snapshotOf, update, parseHistory, historyJson, renderChangelog, today, codeNames } from './lib/token-changelog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = join(ROOT, 'src/design/tokens.json');
export const CSS_OUT = join(ROOT, 'src/styles/tokens.css');
export const DOC_OUT = join(ROOT, 'documentation/game-ui/tokens.md');
/** The changelog's memory: the last built token set and the entries (generated; committed). */
export const HISTORY_OUT = join(ROOT, 'src/design/token-history.json');
export const CHANGELOG_OUT = join(ROOT, 'documentation/game-ui/token-changelog.md');

/** The surfaces: each maps --surface-<role> to its --color-<surface>-<role>. */
export const SURFACES = ['paper', 'wood'];

/**
 * @typedef {{ path: string[]; name: string; type: string; value: unknown; description: string; extensions: Record<string, any>; deprecated?: boolean | string }} Token
 */

/** A node's DTCG 2025.10 `$deprecated`: `true`/`false`, or a string saying what to use instead. */
const deprecatedOf = (node) => (typeof node.$deprecated === 'boolean' || typeof node.$deprecated === 'string' ? node.$deprecated : undefined);

/** Flatten the tree into tokens (inheriting $type and $deprecated from groups). @returns {Token[]} */
export function flatten(tree, path = [], type = '', deprecatedGroup = undefined) {
  /** @type {Token[]} */
  const out = [];
  const t = typeof tree.$type === 'string' ? tree.$type : type;
  const groupDeprecated = deprecatedOf(tree) ?? deprecatedGroup;
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith('$') || typeof node !== 'object' || node === null) continue;
    const p = [...path, key];
    if ('$value' in node) {
      out.push({ path: p, name: cssName(p), type: typeof node.$type === 'string' ? node.$type : t, value: node.$value, description: node.$description ?? '', extensions: node.$extensions ?? {} });
      const d = deprecatedOf(node) ?? groupDeprecated;
      if (d !== undefined && d !== false) out[out.length - 1].deprecated = d;
    } else out.push(...flatten(node, p, t, groupDeprecated));
  }
  return out;
}

/** `p.color.ink.900` → `--p-color-ink-900`; `color.paper.bg` → `--color-paper-bg`. */
export function cssName(path) {
  return `--${path.join('-')}`;
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A 2025.10 colour object as CSS: its hex when opaque, rgb() with its alpha otherwise. */
export function colourCss(c) {
  if (c.alpha === undefined || c.alpha === 1) return c.hex;
  const [r, g, b] = c.components.map((x) => Math.round(x * 255));
  return `rgb(${r} ${g} ${b} / ${c.alpha})`;
}

/** A 2025.10 dimension or duration ({ value, unit }) as CSS; a zero length is written bare. */
export const lengthCss = (d) => (d.value === 0 && d.unit !== 'ms' && d.unit !== 's' ? '0' : `${d.value}${d.unit}`);

/** One 2025.10 shadow object as CSS: [inset] x y blur [spread] colour. */
function shadowCss(s) {
  const lens = [s.offsetX, s.offsetY, s.blur, ...(s.spread && s.spread.value !== 0 ? [s.spread] : [])].map(lengthCss);
  return `${s.inset ? 'inset ' : ''}${lens.join(' ')} ${colourCss(s.color)}`;
}

/** A token's literal (non-alias) value as CSS, from its 2025.10 form and its `game.*` extensions. */
function literalCss(token) {
  const v = token.value;
  const ext = token.extensions ?? {};
  if (token.type === 'cubicBezier' && Array.isArray(v)) return `cubic-bezier(${v.join(', ')})`;
  if (token.type === 'color' && isObj(v)) return colourCss(v);
  if ((token.type === 'dimension' || token.type === 'duration') && isObj(v)) {
    const fluid = ext['game.fluid'];
    const viewport = ext['game.viewport'];
    if (viewport) return `min(${viewport.vmin}vmin, ${lengthCss(v)})`;
    return fluid ? `clamp(${lengthCss(fluid.min)}, ${fluid.vw}vw, ${lengthCss(v)})` : lengthCss(v);
  }
  if (token.type === 'shadow' && (isObj(v) || Array.isArray(v))) {
    const list = (Array.isArray(v) ? v : [v]).map(shadowCss).join(', ');
    return ext['game.filter'] ? `${ext['game.filter']}(${list})` : list;
  }
  if (typeof v === 'number') return `${v}${ext['game.unit'] ?? ''}`;
  return String(v);
}

/** A token's CSS value: aliases become var() references. */
export function cssValue(token, byPath) {
  const v = token.value;
  if (typeof v === 'string') {
    return v.replace(/\{([^}]+)\}/g, (_, ref) => {
      const target = byPath.get(ref);
      if (!target) throw new Error(`${token.path.join('.')}: unknown alias {${ref}}`);
      return `var(${target.name})`;
    });
  }
  return literalCss(token);
}

/** Resolve a token to its final literal value (aliases followed). */
export function resolve(token, byPath, seen = new Set()) {
  const v = token.value;
  if (typeof v !== 'string') return cssValue(token, byPath);
  const m = /^\{([^}]+)\}$/.exec(v);
  if (!m) return v;
  if (seen.has(m[1])) throw new Error(`alias cycle at ${m[1]}`);
  seen.add(m[1]);
  return resolve(byPath.get(m[1]), byPath, seen);
}

export function load(json = JSON.parse(readFileSync(SOURCE, 'utf8'))) {
  const tokens = flatten(json);
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  return { json, tokens, byPath };
}

const HEADER = `/* GENERATED by scripts/build-tokens.mjs from src/design/tokens.json. Do not edit.
 * Tiers: --p-* primitives (private: tokens only) → semantic (--color-*, --space-*, --text-*, --layer-*, …)
 * → component (--c-*). Components use --surface-* roles, set by .surface-paper (the default) and
 * .surface-wood. Docs: documentation/game-ui/design-system.md. */
`;

export function buildCss({ tokens, byPath } = load()) {
  const lines = [HEADER, ':root {'];
  for (const t of tokens) lines.push(`  ${t.name}: ${cssValue(t, byPath)};`);
  lines.push('}', '');
  for (const s of SURFACES) {
    const roles = tokens.filter((t) => t.path[0] === 'color' && t.path[1] === s);
    const sel = s === 'paper' ? ':root,\n.surface-paper' : `.surface-${s}`;
    lines.push(`${sel} {`);
    for (const r of roles) {
      const role = r.path.slice(2).join('-');
      const value = s === 'wood' ? `light-dark(var(--color-paper-${role}), var(${r.name}))` : `var(${r.name})`;
      lines.push(`  --surface-${role}: ${value};`);
    }
    lines.push('}', '');
  }
  return lines.join('\n');
}

const TIER = (t) => (t.path[0] === 'p' ? 'Primitive (private)' : t.path[0] === 'c' ? 'Component' : 'Semantic');

/** A token's "Use" cell: a deprecated one says so first, and what to use instead. */
export function useOf(t) {
  if (t.deprecated === undefined) return t.description;
  const why = typeof t.deprecated === 'string' && t.deprecated ? `: ${codeNames(t.deprecated)}` : '';
  return `**Deprecated**${why}.${t.description ? ` ${t.description}` : ''}`;
}

export function buildDoc({ json, tokens, byPath } = load()) {
  const groups = new Map();
  for (const t of tokens) {
    const g = t.path[0] === 'p' || t.path[0] === 'c' ? `${t.path[0]}.${t.path[1]}` : t.path[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  const out = [
    '# Design tokens (reference)',
    '',
    '> Generated by `scripts/build-tokens.mjs` from `src/design/tokens.json`. Do not edit this page: change the JSON and run `node scripts/build-tokens.mjs`.',
    '',
    `The rules for using them are in [the design system](design-system.md) §3. ${tokens.length} tokens in three tiers: primitives (\`--p-*\`, only tokens may use them), semantic roles and scales, and component tokens (\`--c-*\`). Components read colour through the \`--surface-*\` roles, which \`.surface-paper\` (the default) and \`.surface-wood\` set.`,
    '',
  ];
  for (const [g, list] of groups) {
    const head = byPath.get(list[0].path.slice(0, g.split('.').length).join('.'));
    const desc = (g.includes('.') ? json[g.split('.')[0]]?.[g.split('.')[1]]?.$description : json[g]?.$description) ?? head?.description ?? '';
    out.push(`## \`${g}\` · ${TIER(list[0])}`, '');
    if (desc) out.push(desc, '');
    out.push('| Token | Value | Resolves to | Use |', '|---|---|---|---|');
    for (const t of list) {
      const v = cssValue(t, byPath);
      const r = resolve(t, byPath);
      out.push(`| \`${t.name}\` | \`${esc(v)}\` | ${v === r ? '' : `\`${esc(r)}\``} | ${esc(useOf(t))} |`);
    }
    out.push('');
  }
  out.push('## Surfaces', '', 'The game (`.surface-wood`) resolves each role as `light-dark(paper, wood)`, following the root colour scheme. `.surface-paper` stays light for key caps. The columns below show the light and dark values.', '', '| Role | `.surface-paper` / light game | Dark game |', '|---|---|---|');
  const roles = tokens.filter((t) => t.path[0] === 'color' && t.path[1] === 'paper').map((t) => t.path.slice(2).join('-'));
  for (const r of roles) {
    const p = byPath.get(`color.paper.${r}`);
    const w = byPath.get(`color.wood.${r}`);
    out.push(`| \`--surface-${r}\` | \`${esc(resolve(p, byPath))}\` | ${w ? `\`${esc(resolve(w, byPath))}\`` : '—'} |`);
  }
  out.push('');
  return out.join('\n');
}

/** A path's custom property: `c.chopper.thumb-width` → `--c-chopper-thumb-width`. */
const nameOfPath = (path) => cssName(path.split('.'));

/**
 * The changelog: the tokens as built now, against the last built set in token-history.json. Returns the
 * history file's and the page's text; the entry is dated `date` (today) only if something changed.
 */
export function buildChangelog({ tokens, byPath } = load(), date = today(), previous = readOr(HISTORY_OUT)) {
  const snapshot = snapshotOf(tokens.map((t) => ({ path: t.path, value: cssValue(t, byPath), deprecated: t.deprecated })));
  const history = update(parseHistory(previous), snapshot, date);
  const page = renderChangelog({
    title: 'Game UI token changelog',
    tldr: `Every change to the game UI's design tokens, newest first: what was added, removed, renamed, changed in value or deprecated, by date. ${tokens.length} tokens today, ${tokens.filter((t) => t.deprecated !== undefined).length} of them deprecated. Generated by \`scripts/build-tokens.mjs\`; its \`--check\` fails when the tokens changed without a build.`,
    about: [
      '> Generated by `scripts/build-tokens.mjs` from `src/design/tokens.json`. Do not edit this page: change the JSON and run `node scripts/build-tokens.mjs`.',
      "The build compares the tokens with the last set it built (kept in `src/design/token-history.json`, generated and committed with them) and records what changed under that day's date. A removed and an added token with the same value in the same group are listed as renamed; a token that now aliases a new one holding its old value, and is newly deprecated, is a rename that keeps the old name for one release ([the design system](design-system.md) §3, the deprecation rule). Owners and other `$extensions` aren't values and aren't recorded. The tokens themselves are in [tokens.md](tokens.md).",
    ],
    history,
    name: nameOfPath,
  });
  return { history: historyJson(history), page };
}

function readOr(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const model = load();
  const css = buildCss(model);
  const doc = buildDoc(model);
  const changelog = buildChangelog(model);
  if (process.argv.includes('--check')) {
    const stale = [
      [CSS_OUT, css],
      [DOC_OUT, doc],
      [HISTORY_OUT, changelog.history],
      [CHANGELOG_OUT, changelog.page],
    ].filter(([f, want]) => {
      try {
        return readFileSync(f, 'utf8').replace(/\r\n/g, '\n') !== want;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(`Out of date: ${stale.map(([f]) => f).join(', ')}. Run node scripts/build-tokens.mjs`);
      process.exit(1);
    }
    console.log('tokens up to date');
  } else {
    writeFileSync(CSS_OUT, css);
    writeFileSync(DOC_OUT, doc);
    writeFileSync(HISTORY_OUT, changelog.history);
    writeFileSync(CHANGELOG_OUT, changelog.page);
    console.log(`wrote ${model.tokens.length} tokens`);
  }
}
