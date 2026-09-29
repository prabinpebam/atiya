/**
 * The site's token model (docs: documentation/site-ui/design-system.md §2). Pure: it resolves the
 * W3C DTCG 2025.10 documents (site.resolver.json: the base set, then the theme modifier's light and
 * dark contexts) and says what each token is in CSS. Used by scripts/build-site-tokens.mjs (which
 * writes tokens.css and the reference page), the design library's token pages and the unit tests.
 * Plain, erasable TypeScript only: Node runs it without a build step.
 */

export type Mode = 'light' | 'dark';
type Json = Record<string, unknown>;

export interface Token {
  path: string[];
  /** The CSS custom property: `color.bg` → `--color-bg`. */
  name: string;
  type: string;
  /** The value in the light (default) context. */
  value: unknown;
  description: string;
  /** The value in the dark context, when it differs. */
  dark?: unknown;
  /** A fluid size's value at the small end, from `$extensions["site.fluid"].min`. */
  fluidMin?: unknown;
  /** A number's CSS unit, from `$extensions["site.unit"]` (tracking in em). */
  unit?: string;
}

export interface Model {
  /** The light context's merged tree (for group descriptions). */
  json: Json;
  tokens: Token[];
  byPath: Map<string, Token>;
}

/** The viewport range fluid sizes grow across (px). */
export const FLUID_FROM = 360;
export const FLUID_TO = 1280;

// ---------- the resolver (https://www.designtokens.org/tr/2025.10/resolver/) ----------

export interface Resolver {
  version: string;
  sets?: Record<string, { sources: Json[] }>;
  modifiers?: Record<string, { contexts: Record<string, Json[]>; default?: string }>;
  resolutionOrder: Json[];
}

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Merge token trees: groups merge, a token declared again replaces the earlier one. */
export function merge(a: Json, b: Json): Json {
  const out: Json = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isObj(v) && !('$value' in v) && isObj(out[k]) && !('$value' in (out[k] as Json))) out[k] = merge(out[k] as Json, v);
    else out[k] = v;
  }
  return out;
}

/** One permutation's tokens: walk resolutionOrder, merging each set and the chosen context. */
export function resolveDocument(r: Resolver, read: (ref: string) => Json, inputs: Record<string, string> = {}): Json {
  if (r.version !== '2025.10') throw new Error(`resolver version ${r.version}: expected 2025.10`);
  const sources = (list: Json[]) => list.reduce<Json>((acc, s) => merge(acc, typeof s.$ref === 'string' ? read(s.$ref) : s), {});
  let tree: Json = {};
  for (const item of r.resolutionOrder) {
    const ref = typeof item.$ref === 'string' ? item.$ref : null;
    const set = ref?.startsWith('#/sets/') ? r.sets?.[ref.slice(7)] : !ref && item.type === 'set' ? (item as unknown as { sources: Json[] }) : null;
    const mod = ref?.startsWith('#/modifiers/') ? { name: ref.slice(12), m: r.modifiers?.[ref.slice(12)] } : !ref && item.type === 'modifier' ? { name: String(item.name), m: item as unknown as { contexts: Record<string, Json[]>; default?: string } } : null;
    if (set) tree = merge(tree, sources(set.sources));
    else if (mod?.m) {
      const ctx = inputs[mod.name] ?? mod.m.default;
      if (!ctx || !mod.m.contexts[ctx]) throw new Error(`modifier ${mod.name}: no context ${ctx}`);
      tree = merge(tree, sources(mod.m.contexts[ctx]));
    } else throw new Error(`can't resolve ${JSON.stringify(item)}`);
  }
  return tree;
}

// ---------- tokens ----------

export function flatten(tree: Json, path: string[] = [], type = ''): Token[] {
  const out: Token[] = [];
  const t = typeof tree.$type === 'string' ? tree.$type : type;
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith('$') || !isObj(node)) continue;
    const p = [...path, key];
    if ('$value' in node) {
      const ext = (node.$extensions ?? {}) as Record<string, Json | string | undefined>;
      out.push({
        path: p,
        name: cssName(p),
        type: typeof node.$type === 'string' ? node.$type : t,
        value: node.$value,
        description: typeof node.$description === 'string' ? node.$description : '',
        fluidMin: isObj(ext['site.fluid']) ? (ext['site.fluid'] as Json).min : undefined,
        unit: typeof ext['site.unit'] === 'string' ? (ext['site.unit'] as string) : undefined,
      });
    } else out.push(...flatten(node, p, t));
  }
  return out;
}

export function cssName(path: string[]): string {
  return `--${path.join('-')}`;
}

function index(json: Json): Model {
  const tokens = flatten(json);
  return { json, tokens, byPath: new Map(tokens.map((t) => [t.path.join('.'), t])) };
}

/** The site's tokens: the light context, with each token's dark value where it differs. */
export function loadSite(resolver: Resolver, read: (ref: string) => Json): Model {
  // the theme contexts' colour roles merge in last: list them after the primitives, as the tiers read
  const ordered = (j: Json): Json => {
    const { $description, p, color, ...rest } = j;
    return { $description, p, color, ...rest };
  };
  const light = index(ordered(resolveDocument(resolver, read, { theme: 'light' })));
  const dark = index(ordered(resolveDocument(resolver, read, { theme: 'dark' })));
  for (const t of light.tokens) {
    const d = dark.byPath.get(t.path.join('.'));
    if (d && JSON.stringify(d.value) !== JSON.stringify(t.value)) t.dark = d.value;
  }
  return light;
}

// ---------- values → CSS ----------

const ALIAS = /\{([^}]+)\}/g;
const round = (x: number, d = 4) => Number(x.toFixed(d));

function colour(v: Json): string {
  const [r, g, b] = (v.components as number[]).map((c) => Math.round(c * 255));
  const a = typeof v.alpha === 'number' ? v.alpha : 1;
  if (a === 1 && typeof v.hex === 'string') return v.hex.toUpperCase();
  return a === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`;
}

/** A value as CSS; `ref` turns an alias into CSS (a var() reference, or its resolved value). */
export function toCss(v: unknown, type: string, ref: (path: string) => string, unit?: string): string {
  if (typeof v === 'string') return v.replace(ALIAS, (_, p: string) => ref(p));
  if (typeof v === 'number') return unit ? `${v}${unit}` : String(v);
  if (Array.isArray(v)) {
    if (type === 'cubicBezier') return `cubic-bezier(${v.join(', ')})`;
    if (type === 'fontFamily') return v.map((f) => (/\s/.test(String(f)) ? `'${f}'` : String(f))).join(', ');
    return v.map((x) => toCss(x, type, ref)).join(', ');
  }
  if (isObj(v)) {
    if (type === 'color' || 'colorSpace' in v) return colour(v);
    if ('unit' in v && 'value' in v) return `${v.value}${v.unit}`;
    if (type === 'shadow') {
      const d = (x: unknown) => toCss(x, 'dimension', ref);
      return `${v.inset ? 'inset ' : ''}${d(v.offsetX)} ${d(v.offsetY)} ${d(v.blur)} ${d(v.spread)} ${toCss(v.color, 'color', ref)}`;
    }
  }
  throw new Error(`can't write ${JSON.stringify(v)} (${type}) as CSS`);
}

const rem = (css: string): number => {
  const m = /^(-?[\d.]+)rem$/.exec(css.trim());
  if (!m) throw new Error(`fluid sizes are in rem: ${css}`);
  return parseFloat(m[1]);
};

/** A size that grows from `min` at 360 px to `max` at 1280 px: clamp(min, a + b·vw, max). */
export function fluid(min: string, max: string, from = FLUID_FROM, to = FLUID_TO): string {
  const a = rem(min) * 16;
  const b = rem(max) * 16;
  const slope = (b - a) / (to - from);
  const intercept = a - slope * from;
  return `clamp(${min}, ${round(intercept / 16)}rem + ${round(slope * 100)}vw, ${max})`;
}

function aliasRef(byPath: Map<string, Token>, where: string) {
  return (p: string) => {
    const target = byPath.get(p);
    if (!target) throw new Error(`${where}: unknown alias {${p}}`);
    return `var(${target.name})`;
  };
}

/** The token's CSS value: aliases as var(), light-dark() when the dark context differs, clamp() for a fluid size. */
export function cssValue(t: Token, byPath: Map<string, Token>): string {
  const ref = aliasRef(byPath, t.path.join('.'));
  const v = toCss(t.value, t.type, ref, t.unit);
  if (t.dark !== undefined) return `light-dark(${v}, ${toCss(t.dark, t.type, ref, t.unit)})`;
  if (t.fluidMin !== undefined) return fluid(toCss(t.fluidMin, t.type, ref), v);
  return v;
}

/** The literal a token resolves to in a mode (aliases followed all the way). */
export function resolve(t: Token, byPath: Map<string, Token>, mode: Mode = 'light', seen = new Set<string>()): string {
  const key = t.path.join('.');
  if (seen.has(key)) throw new Error(`alias cycle at ${key}`);
  const v = mode === 'dark' && t.dark !== undefined ? t.dark : t.value;
  return toCss(
    v,
    t.type,
    (p) => {
      const target = byPath.get(p);
      if (!target) throw new Error(`${key}: unknown alias {${p}}`);
      return resolve(target, byPath, mode, new Set([...seen, key]));
    },
    t.unit,
  );
}

/** The token a whole-alias points at (one step), or null. */
export function aliasOf(t: Token, mode: Mode = 'light'): string | null {
  const v = mode === 'dark' && t.dark !== undefined ? t.dark : t.value;
  const m = typeof v === 'string' ? /^\{([^}]+)\}$/.exec(v) : null;
  return m ? m[1] : null;
}

export const tier = (t: Token): 'primitive' | 'semantic' | 'component' => (t.path[0] === 'p' ? 'primitive' : t.path[0] === 'c' ? 'component' : 'semantic');

/** A group's key for the reference: `p.color`, `color`, `c.button`. */
export const groupOf = (t: Token): string => (t.path[0] === 'p' || t.path[0] === 'c' ? `${t.path[0]}.${t.path[1]}` : t.path[0]);

// ---------- contrast (WCAG 2.2) ----------
export type RGBA = [number, number, number, number];

export function parseColour(v: string): RGBA {
  const hex = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as RGBA;
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(v.trim());
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] ? +rgb[4] : 1];
  throw new Error(`can't read colour ${v}`);
}

export const over = (top: RGBA, under: RGBA): RGBA => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1) as RGBA;

export function luminance([r, g, b]: RGBA): number {
  const c = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

export function contrast(a: RGBA, b: RGBA): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
