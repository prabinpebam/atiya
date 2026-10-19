/**
 * The design system's rules, enforced (docs: documentation/game-ui/design-system.md §3, §7, §9):
 * tokens are generated and resolve; component CSS uses tokens only (colour, z-index, type, radius,
 * motion, spacing) and never a primitive; every text/background role pair has enough contrast; both
 * surfaces define every role; and the UI copy keeps to the word rules.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { load, resolve } from '../../scripts/build-tokens.mjs';
import { GALLERY_ROUTE, galleryWanted } from '../../integrations/game-gallery-rules.mjs';

const ROOT = join(__dirname, '../..');
/** Every file under `dir` whose name matches `re`. */
const filesUnder = (dir: string, re: RegExp): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p, re) : re.test(f) ? [p] : [];
  });
/**
 * Every game stylesheet, found by glob so a new one can't escape the rules: base.css, and each component's own beside
 * the others in src/game/ (src/game/ui/styles/, the gallery's). The generated tokens.css and cursors.css have their own
 * tests, and global.css only orders the layers and imports (the "layers" tests below).
 */
const STYLES = [join(ROOT, 'src/styles/base.css'), ...filesUnder(join(ROOT, 'src/game'), /\.css$/)];
const STYLE_DIR = join(ROOT, 'src/game/ui/styles');
const TOKENS_CSS = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
const TOKENS_JSON = JSON.parse(readFileSync(join(ROOT, 'src/design/tokens.json'), 'utf8'));

/** Declarations of a stylesheet: selector, property, value (comments stripped). */
function declarations(css: string): { sel: string; prop: string; value: string }[] {
  const out: { sel: string; prop: string; value: string }[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of src.matchAll(block)) {
    const sel = m[1].trim();
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      out.push({ sel, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() });
    }
  }
  return out;
}

const all = STYLES.flatMap((f) => declarations(readFileSync(f, 'utf8')).map((d) => ({ ...d, file: f.split(/[\\/]/).pop()! })));
const where = (d: { file: string; sel: string; prop: string; value: string }) => `${d.file} ${d.sel} { ${d.prop}: ${d.value} }`;

/** The stylesheets parsed, for the rules that depend on where a declaration sits. */
const SHEETS = STYLES.map((f) => ({ file: f.split(/[\\/]/).pop()!, root: postcss.parse(readFileSync(f, 'utf8')) }));
const HOVER = /\(hover:\s*hover\)/;
const FORCED = /\(forced-colors:\s*active\)/;
const MORE = /\(prefers-contrast:\s*more\)/;
/** Whether a node sits inside an `@media` whose query matches. */
function inMedia(n: postcss.Node, query: RegExp): boolean {
  for (let p = n.parent; p; p = p.parent) if (p.type === 'atrule' && (p as postcss.AtRule).name === 'media' && query.test((p as postcss.AtRule).params)) return true;
  return false;
}

describe('tokens: one source of truth', () => {
  it('tokens.css and the docs reference are generated from tokens.json and up to date', () => {
    expect(() => execFileSync(process.execPath, [join(ROOT, 'scripts/build-tokens.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  type T = { path: string[]; name: string; type: string; value: unknown; extensions: Record<string, unknown> };
  const tokens = (load(TOKENS_JSON) as { tokens: T[] }).tokens;
  const isAlias = (v: unknown) => typeof v === 'string' && /^\{[\w.-]+\}$/.test(v);

  it('colours use the 2025.10 colour object (colorSpace, components, hex; alpha when translucent)', () => {
    const colours = tokens.filter((t) => t.type === 'color' && !isAlias(t.value));
    expect(colours.length).toBeGreaterThan(50);
    for (const t of colours) {
      const v = t.value as { colorSpace: string; components: number[]; hex: string; alpha?: number };
      expect(v.colorSpace, t.name).toBe('srgb');
      expect(v.components, t.name).toHaveLength(3);
      for (const c of v.components) expect(c, t.name).toBeGreaterThanOrEqual(0);
      expect(v.hex, t.name).toMatch(/^#[0-9a-f]{6}$/);
      if (v.alpha !== undefined) expect(v.alpha, t.name).toBeLessThan(1);
    }
  });

  it('dimensions and durations use the 2025.10 {value, unit} object (px or rem; ms or s), and no colour, dimension, duration or shadow is a string', () => {
    for (const t of tokens.filter((x) => ['dimension', 'duration'].includes(x.type) && !isAlias(x.value))) {
      const v = t.value as { value: number; unit: string };
      expect(typeof v.value, t.name).toBe('number');
      expect(t.type === 'duration' ? ['ms', 's'] : ['px', 'rem'], t.name).toContain(v.unit);
    }
    const strings = tokens.filter((t) => ['color', 'dimension', 'duration', 'shadow'].includes(t.type) && typeof t.value === 'string' && !isAlias(t.value));
    expect(strings.map((t) => t.name)).toEqual([]);
    // a unit DTCG has no dimension for (a percentage, an em) is a number with its unit named
    for (const t of tokens.filter((x) => x.extensions['game.unit'])) expect(['%', 'em', 'deg'], t.name).toContain(t.extensions['game.unit']);
  });

  it('sizes are in rem, so "Larger text" scales them: px only for lines and outlines, the pill shape, blurs and the scrollbar', () => {
    const PX = /^(border\.[\w-]+|radius\.pill|blur\.[\w-]+|c\.scrollbar)$/;
    const px = tokens.filter((t) => t.type === 'dimension' && (t.value as { unit?: string })?.unit === 'px').map((t) => t.path.join('.'));
    expect(px.filter((p) => !PX.test(p))).toEqual([]);
  });

  it('every semantic and component token is read: by a stylesheet, the game’s code, or another token', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(css|tsx?|astro)$/.test(f) && f !== 'tokens.css') files.push(p);
      }
    };
    for (const d of ['src/styles', 'src/game', 'src/pages', 'src/layouts']) walk(join(ROOT, d));
    const sources = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    const aliased = TOKENS_CSS.replace(/^\s*--[\w-]+:/gm, '');
    // a breakpoint is read by the @media queries that write its value
    const queries = [...sources.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]).join('\n');
    const atBreakpoint = (t: T) => t.path[0] === 'breakpoint' && queries.includes(`: ${(t.value as { value: number }).value}rem)`);
    // a deprecated alias is kept for one release with no reader (tokenChangelog.test.ts holds that)
    const unread = tokens.filter((t) => t.path[0] !== 'p' && !('deprecated' in t) && !atBreakpoint(t) && !sources.includes(t.name) && !aliased.includes(`var(${t.name})`)).map((t) => t.name);
    expect(unread).toEqual([]);
    // and every primitive is read by a token
    expect(tokens.filter((t) => t.path[0] === 'p' && !aliased.includes(`var(${t.name})`)).map((t) => t.name)).toEqual([]);
  });

  it('every var() the stylesheets use is defined (a token, a surface role, or a layout variable)', () => {
    const defined = new Set([...TOKENS_CSS.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    for (const d of all) if (d.prop.startsWith('--')) defined.add(d.prop);
    // set per element from content data (a landmark's accent), a component's timing, where a crafted item flies to, or the load bar's progress
    for (const x of ['--accent', '--craft-s', '--dx', '--dy', '--load']) defined.add(x);
    const missing = new Set<string>();
    for (const d of all) for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} in ${where(d)}`);
    expect([...missing]).toEqual([]);
  });
});

describe('component CSS uses tokens, never raw values', () => {
  const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\(|\b(?:white|black|red|green|blue|yellow|gray|grey|orange|purple|pink|gold|silver)\b/i;

  it('no colour literals: colours come from --color-* or the --surface-* roles', () => {
    const bad = all.filter((d) => !d.prop.startsWith('--') && COLOUR.test(d.value)).map(where);
    expect(bad).toEqual([]);
  });

  it('never a primitive (--p-*): only tokens may use them', () => {
    expect(all.filter((d) => /var\(--p-/.test(d.value)).map(where)).toEqual([]);
  });

  it('z-index only from the layer scale', () => {
    expect(all.filter((d) => d.prop === 'z-index' && !/^var\(--layer-[\w-]+\)$/.test(d.value)).map(where)).toEqual([]);
  });

  it('font sizes only from the type scale or a component token (1em: the parent’s own size)', () => {
    expect(all.filter((d) => d.prop === 'font-size' && !/^(var\(--(text|c)-[\w-]+\)|1em|112\.5%)$/.test(d.value)).map(where)).toEqual([]);
    // no font shorthand: it hides sizes and weights
    expect(all.filter((d) => d.prop === 'font').map(where)).toEqual([]);
  });

  it('font weights and line heights from their scales', () => {
    expect(all.filter((d) => d.prop === 'font-weight' && !/^var\(--weight-[\w-]+\)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'line-height' && !/^(var\(--leading-[\w-]+\)|0)$/.test(d.value)).map(where)).toEqual([]);
  });

  it('radii from the radius scale', () => {
    expect(all.filter((d) => d.prop === 'border-radius' && !/^(var\(--radius-[\w-]+\)|0)$/.test(d.value)).map(where)).toEqual([]);
  });

  it('motion from the duration and easing tokens (the reduced-motion reset excepted)', () => {
    const motion = all.filter((d) => /^(transition|animation)(-duration|-timing-function)?$/.test(d.prop));
    const bare = (v: string) => v.replace(/var\([^)]*\)/g, '');
    const bad = motion.filter((d) => !d.value.includes('!important') && (/(^|[\s,(])[\d.]+m?s\b/.test(bare(d.value)) || /cubic-bezier\(/.test(d.value) || /\b(ease|ease-in|ease-out|ease-in-out)\b/.test(bare(d.value))));
    expect(bad.map(where)).toEqual([]);
  });

  it('spacing (padding, margin, gap) from the space scale: no px or rem literals', () => {
    const SPACING = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;
    const bad = all.filter((d) => SPACING.test(d.prop) && d.sel !== '.sr-only' && /(^|[\s(,])-?[\d.]+(px|rem)\b/.test(d.value.replace(/var\([^)]*\)/g, '')));
    expect(bad.map(where)).toEqual([]);
  });

  it('only the layout variables are defined outside the tokens (and the strong roles, re-pointed for more contrast)', () => {
    const custom: string[] = [];
    const more: Record<string, string> = {};
    for (const f of STYLES)
      postcss.parse(readFileSync(f, 'utf8')).walkDecls((d) => {
        if (!d.prop.startsWith('--')) return;
        if (inMedia(d, MORE)) more[d.prop] = d.value;
        else custom.push(d.prop);
      });
    expect([...new Set(custom)].sort()).toEqual(['--hotbar-h', '--lane-bottom', '--safe-bottom', '--safe-left', '--safe-right', '--safe-top', '--slot']);
    // inside @media (prefers-contrast: more), a surface role may only take its own strong role
    for (const [prop, value] of Object.entries(more)) expect(value, prop).toBe(`var(${prop}-strong)`);
  });

  it('the game viewport is full-bleed while edge UI follows the OS safe area', () => {
    const layout = readFileSync(join(ROOT, 'src/layouts/BaseLayout.astro'), 'utf8');
    expect(layout).toContain('width=device-width, initial-scale=1, viewport-fit=cover');

    const safe = Object.fromEntries(all.filter((d) => d.prop.startsWith('--safe-')).map((d) => [d.prop, d.value]));
    expect(safe).toEqual({
      '--safe-top': 'env(safe-area-inset-top, 0px)',
      '--safe-right': 'env(safe-area-inset-right, 0px)',
      '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      '--safe-left': 'env(safe-area-inset-left, 0px)',
    });

    const css = Object.fromEntries(STYLES.map((f) => [f.split(/[\\/]/).pop()!, readFileSync(f, 'utf8')]));
    for (const edge of ['top', 'right', 'bottom', 'left']) expect(Object.values(css).join('\n')).toContain(`var(--safe-${edge})`);
    expect(css['play-page.css']).toMatch(/\.game-container\s*\{[^}]*inset:\s*0;/s);
    expect(css['play-header.css']).toMatch(/\.play-header\s*\{[^}]*var\(--safe-top\)[^}]*var\(--safe-right\)[^}]*var\(--safe-left\)/s);
    expect(css['hotbar.css']).toMatch(/\.hotbar-wrap\s*\{[^}]*var\(--safe-bottom\)/s);
    expect(css['dialog.css']).toMatch(/\.dialog\s*\{[^}]*inset:\s*var\(--safe-top\) var\(--safe-right\) var\(--safe-bottom\) var\(--safe-left\)/s);
  });

  it('every value is a token: a parser finds no raw size, offset, blur, turn or time outside the allow-list (P5)', () => {
    // structural values a token would only rename, each with its reason ("<selector> <property>")
    const ALLOW: Record<string, string> = {
      '.sr-only width': 'the visually hidden pattern: one pixel',
      '.sr-only height': 'the visually hidden pattern: one pixel',
      '.sr-only margin': 'the visually hidden pattern: one pixel back',
      '.skip-link inset-block-start': 'off the top of the page until it has the focus',
    };
    const UNIT = /(?<![\w.#-])(-?\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|dvh|dvw|svh|svw|lvh|ch|ex|deg|turn|ms|s)\b/g;
    const ok = (n: number, unit: string) =>
      n === 0 || (n === 1 && unit === 'em') || (n === 100 && /^(vw|vh|dvh|dvw|svh|svw|lvh)$/.test(unit)) || (unit === 'deg' && n % 90 === 0) || (unit === 'turn' && Number.isInteger(n));
    const bps = new Set((load(TOKENS_JSON) as { tokens: { path: string[]; value: unknown }[] }).tokens.filter((t) => t.path[0] === 'breakpoint').map((t) => `${(t.value as { value: number }).value}${(t.value as { unit: string }).unit}`));
    const bad: string[] = [];
    let seen = 0;
    for (const f of STYLES) {
      const file = f.split(/[\\/]/).pop();
      const root = postcss.parse(readFileSync(f, 'utf8'));
      root.walkDecls((d) => {
        seen++;
        if (d.important) return; // the reduced-motion reset
        const parent = d.parent as postcss.Rule | postcss.AtRule;
        const sel = parent.type === 'rule' ? (parent as postcss.Rule).selector : `@${(parent as postcss.AtRule).name} ${(parent as postcss.AtRule).params}`;
        if (ALLOW[`${sel} ${d.prop}`]) return;
        const v = d.value.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '');
        for (const m of v.matchAll(UNIT)) if (!ok(Number(m[1]), m[2])) bad.push(`${file} ${sel} { ${d.prop}: ${d.value} }`);
        // a scale factor is a feel, so a token (0 and 1 are structural)
        if (/(?<![a-z])scale\(/.test(v) && [...v.slice(v.search(/(?<![a-z])scale\(/)).matchAll(/(?<![\w.-])-?\d*\.?\d+(?![\w.%])/g)].some((m) => !/^-?[01]$/.test(m[0]))) bad.push(`${file} ${sel} { ${d.prop}: ${d.value} }`);
      });
      // a width or height query only at a breakpoint token (CSS can't read a variable there)
      root.walkAtRules('media', (a) => {
        for (const m of a.params.matchAll(/\((?:min|max)-(?:width|height):\s*([\d.]+\w+)\)/g)) if (!bps.has(m[1])) bad.push(`${file} @media ${a.params}`);
      });
    }
    expect(seen).toBeGreaterThan(600);
    expect([...new Set(bad)]).toEqual([]);
  });

  it('inline styles in components carry data only (a custom property, a position, a paint colour from its table)', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx|astro)$/.test(f)) files.push(p);
      }
    };
    walk(join(ROOT, 'src'));
    const bad: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/style=\{\{([^}]*)\}\}/g)) if (COLOUR.test(m[1])) bad.push(`${f}: ${m[1].trim()}`);
    }
    expect(bad).toEqual([]);
  });
});

// ---------- contrast (WCAG 2.2 1.4.3 / 1.4.11; XAG 102) ----------
type RGBA = [number, number, number, number];
const MODEL = load(TOKENS_JSON);
function colour(path: string): RGBA {
  const v = resolve(MODEL.byPath.get(path), MODEL.byPath) as string;
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16), 1];
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(v);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] ? +rgb[4] : 1];
  throw new Error(`can't read ${path} = ${v}`);
}
const over = (top: RGBA, under: RGBA): RGBA => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1) as RGBA;
const lum = ([r, g, b]: RGBA) => {
  const c = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a: RGBA, b: RGBA) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('contrast: every text and background role pair is readable', () => {
  const WHITE: RGBA = [255, 255, 255, 1];
  const BLACK: RGBA = [0, 0, 0, 1];
  // what's behind a translucent surface: the planet's sky, at its darkest and lightest
  const skies = [colour('p.color.sky.400'), colour('p.color.sky.200'), WHITE];
  const text: Array<[string, string, string[]]> = [
    ['paper', 'bg', ['text', 'text-muted', 'positive', 'negative', 'link']],
    ['paper', 'bg-glass', ['text', 'text-muted']],
    ['paper', 'bg-warm', ['text', 'text-muted']],
    ['paper', 'bg-soft', ['text', 'text-muted']],
    ['paper', 'bg-sunk', ['text', 'text-muted']],
    ['wood', 'bg', ['text', 'text-muted', 'positive', 'negative', 'highlight', 'link']],
    ['wood', 'bg-warm', ['text']],
    ['wood', 'bg-soft', ['text']],
    ['wood', 'bg-sunk', ['text', 'text-muted']],
  ];
  it.each(text)('%s %s: text roles at 4.5:1 or more', (surface, bg, roles) => {
    const backs = surface === 'wood' ? [WHITE, BLACK] : skies;
    for (const under of backs) {
      // a wood panel sits on the scrim, over the world; its sunk list over the panel
      const base = surface === 'wood' && bg !== 'bg' ? over(colour('color.wood.bg'), under) : under;
      const b = over(colour(`color.${surface}.${bg}`), base);
      for (const r of roles) expect(ratio(over(colour(`color.${surface}.${r}`), b), b), `${surface}.${r} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the toast and the talk plate at 4.5:1', () => {
    expect(ratio(colour('color.toast-text'), colour('color.toast-bg'))).toBeGreaterThanOrEqual(4.5);
    // the primary action and the speaker's name plate use the surface's accent
    for (const s of ['paper', 'wood']) {
      expect(ratio(colour(`color.${s}.on-accent`), colour(`color.${s}.accent`)), `${s} accent`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(colour(`color.${s}.on-accent`), colour(`color.${s}.accent-hover`)), `${s} accent hover`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('focus rings and outlines at 3:1 against their surface (non-text contrast)', () => {
    expect(ratio(colour('color.paper.focus'), colour('color.paper.bg'))).toBeGreaterThanOrEqual(3);
    for (const sky of skies) expect(ratio(colour('color.focus'), sky)).toBeGreaterThanOrEqual(3);
    expect(ratio(colour('color.wood.focus'), over(colour('color.wood.bg'), WHITE))).toBeGreaterThanOrEqual(3);
    expect(ratio(colour('color.paper.border'), colour('color.paper.bg'))).toBeGreaterThanOrEqual(3);
  });

  it('the strong roles (prefers-contrast: more) are stronger: muted text at 7:1, outlines and rules at 3:1, each at least its plain role', () => {
    for (const s of ['paper', 'wood']) {
      const backs = s === 'wood' ? [WHITE, BLACK].map((u) => over(colour('color.wood.bg'), u)) : [colour('color.paper.bg')];
      for (const b of backs) {
        const on = (role: string) => ratio(over(colour(`color.${s}.${role}`), b), b);
        expect(on('text-muted-strong'), `${s} text-muted-strong`).toBeGreaterThanOrEqual(7);
        for (const r of ['text-muted', 'border', 'line']) {
          expect(on(`${r}-strong`), `${s} ${r}-strong`).toBeGreaterThanOrEqual(Math.max(r === 'text-muted' ? 7 : 3, on(r)));
        }
      }
    }
  });
});

describe('surfaces: both define every role', () => {
  it('every game surface role pairs light paper with dark wood, including nested panels', () => {
    const css = postcss.parse(TOKENS_CSS);
    const wood = css.nodes.find((n): n is postcss.Rule => n.type === 'rule' && n.selector === '.surface-wood')!;
    const paper = Object.keys(TOKENS_JSON.color.paper).filter((k) => !k.startsWith('$'));
    for (const role of paper) {
      const value = wood.nodes.find((n): n is postcss.Declaration => n.type === 'decl' && n.prop === `--surface-${role}`)?.value;
      expect(value, role).toBe(`light-dark(var(--color-paper-${role}), var(--color-wood-${role}))`);
    }
  });

  it('wood defines every paper role (a missing one would silently show paper colours inside a panel)', () => {
    const paper = Object.keys(TOKENS_JSON.color.paper).filter((k) => !k.startsWith('$'));
    const wood = new Set(Object.keys(TOKENS_JSON.color.wood));
    expect(paper.filter((r) => !wood.has(r))).toEqual([]);
  });
});

// ---------- copy (design-system.md §7) ----------
describe('copy: the word rules', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx|astro)$/.test(f) || /(controller|index)\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  const text = files.map((f) => [f, readFileSync(f, 'utf8')] as const);

  it('no emoji or text symbols as icons (Font Awesome through ui/Icon.tsx)', () => {
    const bad = text.filter(([, s]) => /[\p{Extended_Pictographic}\u2600-\u27BF]/u.test(s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''))).map(([f]) => f);
    expect(bad).toEqual([]);
  });

  it('no vague or banned labels: "click here", "OK", "Submit", and the retired "Open full page"', () => {
    const banned = [/click here/i, />\s*(OK|Okay|Submit)\s*</, /Open full page/, /\bthe Plaza\b/];
    const bad = text.flatMap(([f, s]) => banned.filter((b) => b.test(s)).map((b) => `${f}: ${b}`));
    expect(bad).toEqual([]);
  });
});

// ---------- primitives (design-system.md §4.1; audit DS-14) ----------
describe('controls: the game writes them through its primitives', () => {
  const PRIMITIVES = join(ROOT, 'src/game/ui/primitives.tsx');
  const OVERLAYS = join(ROOT, 'src/game/ui/overlays.tsx');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.tsx')) files.push(p);
    }
  };
  walk(join(ROOT, 'src/game'));
  const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const imports = (f: string) => [...readFileSync(f, 'utf8').matchAll(/^import\s+(type\s+)?[^'"]*from\s+'([^']+)'/gm)].filter((m) => !m[1]).map((m) => m[2]).sort();

  it('no <button> or <kbd> is written outside ui/primitives.tsx (Button, IconButton, KeyCap), and no <dialog> outside ui/overlays.tsx (Dialog)', () => {
    expect(files).toEqual(expect.arrayContaining([PRIMITIVES, OVERLAYS]));
    const bad = files.flatMap((f) =>
      [...code(f).matchAll(/<(button|dialog|kbd)\b/g)]
        .filter((m) => (m[1] === 'dialog' ? f !== OVERLAYS : f !== PRIMITIVES))
        .map((m) => `${f.slice(ROOT.length + 1)}: <${m[1]}>`),
    );
    expect(bad).toEqual([]);
  });

  it('the controls import only Icon (they sit in the initial bundle); the containers stay out of it', () => {
    expect(imports(PRIMITIVES)).toEqual(['./Icon']);
    expect(imports(OVERLAYS)).toEqual(['../input/keyboard', 'react']);
    // nothing the initial bundle loads may import the containers (the on-demand screens do)
    const initial = ['src/game/ui/Hud.tsx', 'src/game/ui/Inventory.tsx', 'src/game/ui/ViewControls.tsx', 'src/game/ui/primitives.tsx'];
    expect(initial.filter((f) => imports(join(ROOT, f)).includes('./overlays'))).toEqual([]);
  });

  it('IconButton requires a label, which becomes its aria-label (an icon names nothing)', () => {
    const src = readFileSync(PRIMITIVES, 'utf8');
    const props = /export type IconButtonProps = Omit<ButtonProps, ([^>]*)> & \{([\s\S]*?)\r?\n\};/.exec(src);
    expect(props, 'IconButtonProps').not.toBeNull();
    expect(props![1]).toContain("'aria-label'");
    expect(props![2]).toMatch(/^\s*label: string;/m);
    expect(src).toMatch(/aria-label=\{label\}/);
  });
});

// ---------- the website's rules, carried through (design-system.md §3, §8, §9, §10; review DS2-06, DS2-15, DS2-16, DS2-17) ----------
const GAME_FILES: string[] = [];
(function walkGame(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walkGame(p);
    else if (/\.tsx?$/.test(f)) GAME_FILES.push(p);
  }
})(join(ROOT, 'src/game'));
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
/** The classes a selector names (or, with none, its element names): `.slot.selected img` → slot, selected. */
function selectorNames(sel: string): string[] {
  const classes = [...sel.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
  if (classes.length) return classes;
  return [...sel.replace(/\[[^\]]*\]|\([^)]*\)|::?[\w-]+/g, ' ').matchAll(/(?:^|[\s>+~,])([a-z][\w-]*)/g)].map((m) => m[1]);
}
/** A rule's selector; a keyframe step (`45%`) stands for its animation's name, the class that plays it. */
const ruleSelector = (r: postcss.Rule) => (r.parent?.type === 'atrule' && (r.parent as postcss.AtRule).name.endsWith('keyframes') ? `.${(r.parent as postcss.AtRule).params}` : r.selector);

describe('hover only where it can hover (DS2-15)', () => {
  const hovers = SHEETS.flatMap(({ file, root }) => {
    const out: { file: string; rule: postcss.Rule }[] = [];
    root.walkRules((rule) => {
      if (/:hover/.test(rule.selector)) out.push({ file, rule });
    });
    return out;
  });

  it('every :hover rule is inside @media (hover: hover), so a tap never leaves a touch screen stuck in hover', () => {
    expect(hovers.length).toBeGreaterThanOrEqual(8);
    expect(hovers.filter(({ rule }) => !inMedia(rule, HOVER)).map(({ file, rule }) => `${file} ${rule.selector}`)).toEqual([]);
  });

  it('and each has an :active twin outside it, the same change while a finger presses', () => {
    const outside = new Set<string>();
    for (const { root } of SHEETS) root.walkRules((rule) => void (!inMedia(rule, HOVER) && rule.selectors.forEach((s) => outside.add(s))));
    const missing = hovers.flatMap(({ file, rule }) => rule.selectors.filter((s) => s.includes(':hover') && !outside.has(s.replace(/:hover/g, ':active'))).map((s) => `${file} ${s}`));
    expect(missing).toEqual([]);
  });
});

describe('logical properties (DS2-06)', () => {
  it('no physical side or offset: margin, padding, border and position use their logical names (inset-*, *-block-*, *-inline-*)', () => {
    const PHYSICAL = /^(margin|padding|border)-(top|right|bottom|left)(-|$)|^(top|right|bottom|left)$/;
    const bad: string[] = [];
    for (const { file, root } of SHEETS) root.walkDecls((d) => void (PHYSICAL.test(d.prop) && bad.push(`${file} ${(d.parent as postcss.Rule).selector ?? ''} { ${d.prop} }`)));
    expect(bad).toEqual([]);
  });

  it('text aligns to start or end, never left or right', () => {
    expect(all.filter((d) => d.prop === 'text-align' && /\b(left|right)\b/.test(d.value)).map(where)).toEqual([]);
  });
});

describe('high contrast: forced colours and more contrast (DS2-06)', () => {
  // focusable controls that style no hover, press or focus state of their own (they're .btn, or slots)
  const STATELESS = ['icon-btn', 'seat-prompt', 'time-badge', 'chopper-thumb', 'craft-cell'];
  /** Every control family: the class that carries a :hover, :active or :focus state in the stylesheets. */
  const families = new Set(STATELESS);
  for (const { root } of SHEETS)
    root.walkRules((rule) => {
      if (inMedia(rule, FORCED)) return;
      for (const s of rule.selectors) for (const m of s.matchAll(/\.([\w-]+)[^\s>+~]*:(?:hover|active|focus)/g)) families.add(m[1]);
    });
  const SYSTEM = ['ButtonText', 'ButtonFace', 'ButtonBorder', 'Canvas', 'CanvasText', 'Highlight', 'HighlightText', 'GrayText', 'LinkText'];
  const ANY_SYSTEM = /\b(AccentColor|AccentColorText|ActiveText|ButtonBorder|ButtonFace|ButtonText|Canvas|CanvasText|Field|FieldText|GrayText|Highlight|HighlightText|LinkText|Mark|MarkText|SelectedItem|SelectedItemText|VisitedText)\b/g;

  it('forced colours: every focusable control family has a rule inside @media (forced-colors: active)', () => {
    expect([...families]).toEqual(expect.arrayContaining(['btn', 'slot', 'travel-tile', 'avatar-btn', 'backpack-btn', 'whistle-btn', 'paint-swatch', 'compass', 'craft-grid']));
    const covered = new Set<string>();
    for (const { root } of SHEETS) root.walkRules((rule) => void (inMedia(rule, FORCED) && selectorNames(rule.selector).forEach((n) => covered.add(n))));
    expect([...families].filter((f) => !covered.has(f))).toEqual([]);
  });

  it('forced colours: system colours only inside @media (forced-colors: active), and only the allowed ones', () => {
    const bad: string[] = [];
    for (const { file, root } of SHEETS)
      root.walkDecls((d) => {
        for (const m of d.value.matchAll(ANY_SYSTEM)) if (!inMedia(d, FORCED) || !SYSTEM.includes(m[1])) bad.push(`${file} ${(d.parent as postcss.Rule).selector} { ${d.prop}: ${d.value} }`);
      });
    expect(bad).toEqual([]);
  });

  it('more contrast: @media (prefers-contrast: more) re-points muted text, outlines and rules to their strong roles on paper and wood', () => {
    const blocks = SHEETS.flatMap(({ root }) => {
      const out: postcss.Rule[] = [];
      root.walkRules((rule) => void (inMedia(rule, MORE) && out.push(rule)));
      return out;
    });
    const roles = blocks.filter((r) => [':root', '.surface-wood'].every((s) => r.selectors.includes(s)));
    const set = Object.fromEntries(roles.flatMap((r) => r.nodes.filter((n): n is postcss.Declaration => n.type === 'decl').map((d) => [d.prop, d.value])));
    expect(set).toMatchObject({
      '--surface-text-muted': 'var(--surface-text-muted-strong)',
      '--surface-border': 'var(--surface-border-strong)',
      '--surface-line': 'var(--surface-line-strong)',
    });
  });
});

describe('component tokens have owners (DS2-16)', () => {
  type Group = { $extensions?: Record<string, unknown> };
  const groups = Object.entries(TOKENS_JSON.c as Record<string, Group>).filter(([k]) => !k.startsWith('$'));
  const ownerOf = (g: string) => groups.find(([k]) => k === g)?.[1].$extensions?.['game.owner'] as string | undefined;
  const fileCache = new Map<string, string | undefined>();
  let tsxSources: (readonly [string, string])[] | undefined;
  /** A component owner's file: the game's module that defines it (a function, else an exported constant; not a lazy import of it). */
  const fileOf = (name: string) => {
    if (fileCache.has(name)) return fileCache.get(name);
    tsxSources ??= GAME_FILES.filter((f) => f.endsWith('.tsx')).map((f) => [f, stripComments(readFileSync(f, 'utf8'))] as const);
    const tsx = tsxSources;
    const found = (tsx.find(([, s]) => new RegExp(`\\bfunction\\s+${name}\\b`).test(s)) ?? tsx.find(([, s]) => new RegExp(`^export\\s+const\\s+${name}\\b`, 'm').test(s)))?.[0];
    fileCache.set(name, found);
    return found;
  };
  /** The words in a file's strings: the class names it writes. */
  const written = (f: string) => new Set([...readFileSync(f, 'utf8').matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].flatMap((m) => (m[1] ?? m[2] ?? m[3]).split(/[^\w-]+/)).filter(Boolean));
  /** Whether a selector's names belong to the owner: a class its component writes, or one of its class family. */
  const owns = (owner: string, names: string[]) => {
    if (owner === 'shared') return true;
    if (owner.startsWith('.')) {
      const fam = owner.slice(1);
      return names.some((n) => (fam.endsWith('-*') ? n.startsWith(fam.slice(0, -1)) : n === fam || n.startsWith(`${fam}-`)));
    }
    const f = fileOf(owner);
    if (!f) return false;
    const w = written(f);
    return names.some((n) => w.has(n));
  };
  const groupOf = (name: string) => groups.map(([g]) => g).sort((a, b) => b.length - a.length).find((g) => name === `--c-${g}` || name.startsWith(`--c-${g}-`));

  it('every c.* group names its owner in $extensions["game.owner"]: a component, a class family (.name or .name-*), or "shared"', () => {
    expect(groups.length).toBeGreaterThan(20);
    for (const [g] of groups) {
      const o = ownerOf(g);
      expect(o, g).toMatch(/^(shared|[A-Z]\w*|\.[a-z][\w-]*?(-\*)?)$/);
      if (/^[A-Z]/.test(o!)) expect(fileOf(o!), `${g}: ${o} is defined in src/game`).toBeDefined();
    }
  });

  it('a group is read only by its owner: the stylesheet rule names a class its component writes (or its class family); code reading it is the owner’s file', () => {
    const bad: string[] = [];
    for (const { file, root } of SHEETS)
      root.walkDecls((d) => {
        for (const m of d.value.matchAll(/--c-[\w-]+/g)) {
          const g = groupOf(m[0]);
          if (!g) continue;
          const sel = ruleSelector(d.parent as postcss.Rule);
          if (!owns(ownerOf(g)!, selectorNames(sel))) bad.push(`${file} ${sel} reads ${m[0]} (owner: ${ownerOf(g)})`);
        }
      });
    for (const f of GAME_FILES)
      for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/--c-[\w-]+/g)) {
        const g = groupOf(m[0]);
        const o = g && ownerOf(g);
        if (o && o !== 'shared' && fileOf(o) !== f) bad.push(`${f.slice(ROOT.length + 1)} reads ${m[0]} (owner: ${o})`);
      }
    expect(bad).toEqual([]);
  });
});

describe('the game’s components document themselves (DS2-17)', () => {
  const UI = [...GAME_FILES.filter((f) => /[\\/]game[\\/]ui[\\/].+\.tsx$/.test(f)), join(ROOT, 'src/game/world/craft/ui.tsx'), join(ROOT, 'src/game/world/home/TalkBox.tsx')];

  it('every exported component and constant in the UI files has a doc comment (/** … */) right before it', () => {
    let seen = 0;
    const bad: string[] = [];
    for (const f of UI) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/^export\s+(?:default\s+)?(?:function|const)\s+(\w+)/gm)) {
        seen++;
        const before = src.slice(0, m.index).trimEnd();
        if (!before.endsWith('*/') || !before.slice(before.lastIndexOf('/*')).startsWith('/**')) bad.push(`${f.slice(ROOT.length + 1)}: ${m[1]}`);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(22);
    expect(bad).toEqual([]);
  });

  it('every prop of the primitives and containers (primitives.tsx, overlays.tsx) has a doc comment', () => {
    const bad: string[] = [];
    let props = 0;
    for (const f of ['primitives', 'overlays'].map((n) => join(ROOT, 'src/game/ui', `${n}.tsx`))) {
      const src = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
      for (const t of src.matchAll(/^export type (\w+Props) = [^{;]*\{\n([\s\S]*?)\n\};/gm)) {
        const lines = t[2].split('\n');
        lines.forEach((line, i) => {
          const p = /^ {2}(?:readonly\s+)?'?([\w-]+)'?\??:/.exec(line);
          if (!p) return;
          props++;
          if (!lines[i - 1]?.trim().endsWith('*/')) bad.push(`${t[1]}.${p[1]}`);
        });
      }
    }
    expect(props).toBeGreaterThanOrEqual(10);
    expect(bad).toEqual([]);
  });
});

// ---------- styles beside their components, in layers (design-system.md §4, §9; review DS2-04) ----------
describe('styles beside their components, in layers (DS2-04)', () => {
  const LAYERS = ['tokens', 'base', 'primitives', 'components', 'cursors'];
  /** The primitives' and the shared parts' own looks: the layer under the components, which lay them out and adjust them. */
  const PRIMITIVE_SHEETS = ['button', 'key-cap', 'icon', 'dialog', 'panel', 'scroll-area', 'slot', 'card', 'lane'];
  /** What base.css may name besides elements and attributes: the surfaces, the utilities, the larger-text switch and the game's page. */
  const GLOBAL_CLASSES = ['surface-paper', 'surface-wood', 'sr-only', 'muted', 'kicker', 'text-lg', 'play'];
  const BASE = join(ROOT, 'src/styles/base.css');
  const SHEETS_HERE = filesUnder(STYLE_DIR, /\.css$/);
  /** Modules that can own a stylesheet: the game's code and the /play page (the gallery shows them, it owns nothing). */
  const OWNERS = [...GAME_FILES.filter((f) => !/[\\/]gallery[\\/]/.test(f)), join(ROOT, 'src/pages/play.astro')];
  const source = new Map(OWNERS.map((f) => [f, readFileSync(f, 'utf8')] as const));
  /** The stylesheets a module imports (`import './styles/x.css';`), as paths. */
  const sheetsOf = (f: string) => [...source.get(f)!.matchAll(/^import\s+'([^']+\.css)';/gm)].map((m) => join(f, '..', m[1]));
  /** What a module writes: the words in its strings (its class names), `${kind}-panel` made from them, and the data attributes it sets (`dataset.gateHidden`). */
  const writes = (f: string) => {
    const s = source.get(f)!;
    const words = new Set([...s.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].flatMap((m) => (m[1] ?? m[2] ?? m[3]).split(/[^\w-]+/)).filter(Boolean));
    for (const m of s.matchAll(/\$\{[^}]+\}(-[\w-]+)/g)) for (const w of [...words]) words.add(`${w}${m[1]}`);
    for (const m of s.matchAll(/dataset\.(\w+)/g)) words.add(`data-${m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
    return words;
  };
  /** What a selector names: its classes; with none, its attributes and elements. */
  const names = (sel: string) => {
    const classes = [...sel.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
    if (classes.length) return classes;
    const attrs = [...sel.matchAll(/\[([\w-]+)/g)].map((m) => m[1]);
    const elements = [...sel.replace(/\[[^\]]*\]|\([^)]*\)|::?[\w-]+/g, ' ').matchAll(/(?:^|[\s>+~,])([a-z][\w-]*)/g)].map((m) => m[1]);
    return [...attrs, ...elements];
  };
  /** The rules a stylesheet's layer holds (keyframe steps aside), with the media they sit in. */
  const rulesOf = (root: postcss.Root) => {
    const out: postcss.Rule[] = [];
    root.walkRules((r) => void (!(r.parent?.type === 'atrule' && /keyframes$/.test((r.parent as postcss.AtRule).name)) && out.push(r)));
    return out;
  };
  const layerOf = (n: postcss.Node) => {
    for (let p = n.parent; p; p = p.parent) if (p.type === 'atrule' && (p as postcss.AtRule).name === 'layer') return (p as postcss.AtRule).params;
    return null;
  };

  it('the shared stylesheets are only the entry, base.css and the two generated ones; every other game stylesheet sits in src/game/', () => {
    expect(readdirSync(join(ROOT, 'src/styles')).sort()).toEqual(['base.css', 'cursors.css', 'global.css', 'tokens.css']);
    expect(SHEETS_HERE.length).toBeGreaterThanOrEqual(30);
  });

  it('the entry (global.css) declares the layer order, then imports the generated tokens and cursors into their layers and base.css; nothing else', () => {
    const root = postcss.parse(readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8'));
    const nodes = root.nodes.filter((n) => n.type !== 'comment').map((n) => (n.type === 'atrule' ? `@${n.name} ${n.params}` : n.toString()));
    expect(nodes).toEqual([`@layer ${LAYERS.join(', ')}`, "@import './tokens.css' layer(tokens)", "@import './base.css'", "@import './cursors.css' layer(cursors)"]);
    // the generated files don't layer themselves: the entry does
    for (const f of ['tokens', 'cursors']) expect(readFileSync(join(ROOT, `src/styles/${f}.css`), 'utf8')).not.toMatch(/@layer\b/);
    expect(readFileSync(join(ROOT, 'src/layouts/BaseLayout.astro'), 'utf8')).toMatch(/import '\.\.\/styles\/global\.css';/);
  });

  it('every game style sits in a cascade layer: each stylesheet opens with the order, then holds only its own layer (base, primitives or components)', () => {
    const bad: string[] = [];
    for (const f of STYLES) {
      const file = f.slice(ROOT.length + 1);
      const name = f.split(/[\\/]/).pop()!.replace('.css', '');
      const want = f === BASE ? 'base' : PRIMITIVE_SHEETS.includes(name) && f.startsWith(STYLE_DIR) ? 'primitives' : 'components';
      const root = postcss.parse(readFileSync(f, 'utf8'));
      const top = root.nodes.filter((n) => n.type !== 'comment');
      // the order first, in every file, so it never depends on which stylesheet the browser meets first
      if (!(top[0]?.type === 'atrule' && top[0].name === 'layer' && top[0].params === LAYERS.join(', ') && !top[0].nodes)) bad.push(`${file}: doesn't open with @layer ${LAYERS.join(', ')};`);
      for (const n of top.slice(1)) if (!(n.type === 'atrule' && n.name === 'layer' && n.params === want && n.nodes)) bad.push(`${file}: ${n.type === 'atrule' ? `@${n.name} ${n.params}` : (n as postcss.Rule).selector} outside @layer ${want}`);
      root.walk((n) => {
        if ((n.type === 'rule' || n.type === 'decl') && layerOf(n) === null) bad.push(`${file}: ${n.type === 'rule' ? (n as postcss.Rule).selector : (n as postcss.Declaration).prop} in no layer`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('base.css holds only element and global rules: no component’s class', () => {
    const bad = rulesOf(postcss.parse(readFileSync(BASE, 'utf8'))).flatMap((r) => r.selectors.filter((s) => [...s.matchAll(/\.([a-z][\w-]*)/g)].some((m) => !GLOBAL_CLASSES.includes(m[1]))));
    expect(bad).toEqual([]);
  });

  it('every component stylesheet is imported by the modules that write its classes, and every rule in it names a class (or attribute) one of them writes', () => {
    expect(OWNERS.filter((f) => sheetsOf(f).length).length).toBeGreaterThanOrEqual(15);
    const bad: string[] = [];
    for (const sheet of SHEETS_HERE) {
      const file = sheet.slice(ROOT.length + 1);
      const by = OWNERS.filter((f) => sheetsOf(f).includes(sheet));
      if (!by.length) {
        bad.push(`${file}: imported by no component`);
        continue;
      }
      const written = new Set(by.flatMap((f) => [...writes(f)]));
      for (const r of rulesOf(postcss.parse(readFileSync(sheet, 'utf8'))))
        for (const s of r.selectors) if (!names(s).some((n) => written.has(n))) bad.push(`${file}: ${s} (no class its importers ${by.map((f) => f.slice(ROOT.length + 1)).join(', ')} write)`);
    }
    // and every stylesheet a module imports is there
    for (const f of OWNERS) for (const s of sheetsOf(f)) if (!statSync(s, { throwIfNoEntry: false })) bad.push(`${f.slice(ROOT.length + 1)} imports a missing ${s}`);
    expect(bad).toEqual([]);
  });

  it('the first paint’s own markup (the top bar, the loading scene, the welcome) has its stylesheets from the page itself, before any game script', () => {
    const page = sheetsOf(join(ROOT, 'src/pages/play.astro')).map((s) => s.split(/[\\/]/).pop());
    expect(page).toEqual(expect.arrayContaining(['button.css', 'key-cap.css', 'icon.css', 'card.css', 'lane.css', 'play-page.css', 'play-header.css', 'load-scene.css', 'talk-box.css']));
  });
});

// ---------- the gallery (design-system.md §9.1; review DS2-05) ----------
describe('the gallery (DS2-05)', () => {
  const GALLERY_FILES = filesUnder(join(ROOT, 'src/game/gallery'), /\.(tsx?|astro)$/);
  const gallery = GALLERY_FILES.map((f) => readFileSync(f, 'utf8')).join('\n');
  const UI = [...GAME_FILES.filter((f) => /[\\/]game[\\/]ui[\\/].+\.tsx$/.test(f)), join(ROOT, 'src/game/world/craft/ui.tsx'), join(ROOT, 'src/game/world/home/TalkBox.tsx')];
  /** Every exported component of the game's UI files (a function or constant named like a component). */
  const exported = UI.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/^export\s+(?:default\s+)?(?:function|const)\s+([A-Z][a-z]\w*)/gm)].map((m) => m[1]));

  it('every primitive and every exported game UI component has an entry: the gallery draws it from sample data', () => {
    expect(exported).toEqual(expect.arrayContaining(['Button', 'IconButton', 'KeyCap', 'Dialog', 'Panel', 'ScrollArea']));
    expect(exported.length).toBeGreaterThanOrEqual(21);
    expect(exported.filter((n) => !new RegExp(`<${n}\\b`).test(gallery))).toEqual([]);
    // and every view the screenshot test visits is drawn
    const views = readFileSync(join(ROOT, 'src/game/gallery/Gallery.tsx'), 'utf8');
    const ids = [...readFileSync(join(ROOT, 'src/game/gallery/views.ts'), 'utf8').matchAll(/\{ id: '([\w-]+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(19);
    expect(ids.filter((id) => !new RegExp(`^\\s+'?${id}'?: \\{`, 'm').test(views))).toEqual([]);
  });

  it('exists only in development and test builds, like the test hook', () => {
    expect(GALLERY_ROUTE).toBe('/play/gallery');
    expect(galleryWanted('dev', [])).toBe(true);
    expect(galleryWanted('build', ['--mode', 'test'])).toBe(true);
    expect(galleryWanted('build', ['--mode=test'])).toBe(true);
    expect(galleryWanted('build', [])).toBe(false);
    expect(galleryWanted('build', ['--mode', 'production'])).toBe(false);
    expect(galleryWanted('dev', ['--mode', 'production'])).toBe(false);
    expect(galleryWanted('preview', [])).toBe(false);
    expect(readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8')).toMatch(/gameGallery\(\)/);
    // and the production check fails if it reaches dist/
    expect(readFileSync(join(ROOT, 'scripts/size-report.mjs'), 'utf8')).toMatch(/no game gallery in the production build/);
  });

  it('never imports the website, and nothing in the game imports it', () => {
    expect(GALLERY_FILES.filter((f) => /from '[^']*\/site\//.test(readFileSync(f, 'utf8')))).toEqual([]);
    const outside = GAME_FILES.filter((f) => !/[\\/]gallery[\\/]/.test(f) && /from '[^']*\/gallery\//.test(readFileSync(f, 'utf8')));
    expect(outside).toEqual([]);
  });
});
