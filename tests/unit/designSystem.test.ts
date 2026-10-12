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

const ROOT = join(__dirname, '../..');
const STYLES = ['base', 'components', 'hud', 'panels'].map((f) => join(ROOT, 'src/styles', `${f}.css`));
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
    const unread = tokens.filter((t) => t.path[0] !== 'p' && !atBreakpoint(t) && !sources.includes(t.name) && !aliased.includes(`var(${t.name})`)).map((t) => t.name);
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

  it('only the layout variables are defined outside the tokens', () => {
    const custom = all.filter((d) => d.prop.startsWith('--')).map((d) => d.prop);
    expect([...new Set(custom)].sort()).toEqual(['--hotbar-h', '--lane-bottom', '--safe-bottom', '--safe-left', '--safe-right', '--safe-top', '--slot']);
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
    expect(css['hud.css']).toMatch(/\.game-container\s*\{[^}]*inset:\s*0;/s);
    expect(css['hud.css']).toMatch(/\.play-header\s*\{[^}]*var\(--safe-top\)[^}]*var\(--safe-right\)[^}]*var\(--safe-left\)/s);
    expect(css['panels.css']).toMatch(/\.hotbar-wrap\s*\{[^}]*var\(--safe-bottom\)/s);
    expect(css['components.css']).toMatch(/\.dialog\s*\{[^}]*inset:\s*var\(--safe-top\) var\(--safe-right\) var\(--safe-bottom\) var\(--safe-left\)/s);
  });

  it('every value is a token: a parser finds no raw size, offset, blur, turn or time outside the allow-list (P5)', () => {
    // structural values a token would only rename, each with its reason ("<selector> <property>")
    const ALLOW: Record<string, string> = {
      '.sr-only width': 'the visually hidden pattern: one pixel',
      '.sr-only height': 'the visually hidden pattern: one pixel',
      '.sr-only margin': 'the visually hidden pattern: one pixel back',
      '.skip-link top': 'off the top of the page until it has the focus',
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
});

describe('surfaces: both define every role', () => {
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
