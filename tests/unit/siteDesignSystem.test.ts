/**
 * The site's design system, enforced (docs: documentation/site-ui/design-system.md). Separate from the
 * game's (designSystem.test.ts). Tokens are DTCG 2025.10, resolved, generated and up to date; every
 * component, layout and page style reads tokens only (never a primitive, never a raw value); the tiers
 * import only from the tiers below them; fundamentals are sealed; every component documents itself and
 * has a story; colour roles pass WCAG contrast in both modes; the copy keeps to the rules.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { siteTokens, SOURCES } from '../../src/site/design/tokens';
import { contrast, over, parseColour, resolve, resolveMore, fluid, type Mode, type RGBA } from '../../src/site/design/tokenModel';
import { docComment, frontmatter, importsOf, propsOf, scriptImports, styles } from '../../src/site/library/registry';
import resolver from '../../src/site/design/site.resolver.json';

const ROOT = join(__dirname, '../..');
const rel = (f: string) => relative(ROOT, f).split(sep).join('/');
const read = (f: string) => readFileSync(f, 'utf8');
const walk = (dir: string, re: RegExp): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p, re) : re.test(f) ? [p] : [];
      })
    : [];

const TIER_DIRS = {
  fundamental: join(ROOT, 'src/site/components/fundamentals'),
  compound: join(ROOT, 'src/site/components/compounds'),
  layout: join(ROOT, 'src/site/layouts'),
} as const;
type Tier = keyof typeof TIER_DIRS;
const tierFiles = (Object.keys(TIER_DIRS) as Tier[]).flatMap((tier) => walk(TIER_DIRS[tier], /\.astro$/).map((file) => ({ tier, file, name: file.split(sep).pop()!.replace(/\.astro$/, ''), src: read(file) })));
const siteAstro = [
  ...walk(join(ROOT, 'src/site'), /\.astro$/),
  join(ROOT, 'src/pages/index.astro'),
  ...walk(join(ROOT, 'src/pages/classic'), /\.astro$/),
  ...walk(join(ROOT, 'src/pages/design'), /\.astro$/),
];
const TOKENS_CSS = read(join(ROOT, 'src/site/styles/tokens.css'));
// edit mode's own tokens: written apart, imported only by the editor (documentation/editor/spec.md §10)
const EDITOR_TOKENS_CSS = read(join(ROOT, 'src/site/styles/editor-tokens.css'));
const BASE_CSS = read(join(ROOT, 'src/site/styles/base.css'));
const model = siteTokens();

describe('thumbnail corners belong to the image', () => {
  it('layout wrappers never own the picture radius, and every image branch carries the choice', () => {
    const image = read(join(TIER_DIRS.fundamental, 'Image.astro'));
    for (const tag of image.matchAll(/<img\b[\s\S]*?\/>/g)) expect(tag[0]).toContain('data-radius={radius}');
    const wrappers = all.filter((d) => ['Image.astro', 'StoryCard.astro', 'RelatedStories.astro'].includes(d.file) && d.prop === 'border-radius' && /\.(shell|frame|picture)(?:\b|\[)/.test(d.sel));
    expect(wrappers.map(where)).toEqual([]);
  });
});

// ---------- tokens ----------
describe('tokens: DTCG 2025.10, one source of truth', () => {
  it('tokens.css and the reference page are generated from the resolver and up to date', () => {
    expect(() => execFileSync(process.execPath, [join(ROOT, 'scripts/build-site-tokens.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('the resolver is a 2025.10 document with a light and a dark theme context, and a normal and a more contrast context', () => {
    expect(resolver.version).toBe('2025.10');
    expect(Object.keys(resolver.modifiers.theme.contexts).sort()).toEqual(['dark', 'light']);
    expect(resolver.modifiers.theme.default).toBe('light');
    expect(Object.keys(resolver.modifiers.contrast.contexts).sort()).toEqual(['more', 'normal']);
    expect(resolver.modifiers.contrast.default).toBe('normal');
  });

  it('every token resolves in both modes (no dangling alias, no cycle)', () => {
    for (const mode of ['light', 'dark'] as Mode[]) for (const t of model.tokens) expect(() => resolve(t, model.byPath, mode), t.path.join('.')).not.toThrow();
  });

  it('primitive colours use the 2025.10 colour object (colorSpace, components, hex)', () => {
    const prim = model.tokens.filter((t) => t.path[0] === 'p' && t.type === 'color');
    expect(prim.length).toBeGreaterThan(40);
    for (const t of prim) {
      const v = t.value as { colorSpace: string; components: number[]; hex: string };
      expect(v.colorSpace, t.name).toBe('srgb');
      expect(v.components).toHaveLength(3);
      expect(v.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('dimensions and durations use the 2025.10 {value, unit} object, in rem or px (ms for time)', () => {
    for (const t of model.tokens.filter((x) => ['dimension', 'duration'].includes(x.type) && typeof x.value !== 'string')) {
      const v = t.value as { value: number; unit: string };
      expect(typeof v.value, t.name).toBe('number');
      expect(t.type === 'duration' ? ['ms', 's'] : ['px', 'rem'], t.name).toContain(v.unit);
    }
  });

  it('both theme contexts define the same colour roles, and every role is an alias of a primitive', () => {
    const light = SOURCES['tokens.light.json'].color as Record<string, { $value?: unknown }>;
    const dark = SOURCES['tokens.dark.json'].color as Record<string, { $value?: unknown }>;
    const roles = (o: Record<string, unknown>) => Object.keys(o).filter((k) => !k.startsWith('$')).sort();
    expect(roles(dark)).toEqual(roles(light));
    for (const ctx of [light, dark]) for (const r of roles(ctx)) expect(String(ctx[r].$value), r).toMatch(/^\{p\.color\.[\w.-]+\}$/);
  });

  it('component colour tokens alias semantic roles, never primitives', () => {
    const bad = model.tokens.filter((t) => t.path[0] === 'c' && typeof t.value === 'string' && /\{p\./.test(t.value)).map((t) => t.name);
    expect(bad).toEqual([]);
  });

  it('fluid sizes grow at most 2.5x, so 200% zoom still enlarges text (WCAG 1.4.4)', () => {
    const fluidTokens = model.tokens.filter((t) => t.fluidMin !== undefined);
    expect(fluidTokens.length).toBeGreaterThan(8);
    for (const t of fluidTokens) {
      const min = (t.fluidMin as { value: number }).value;
      const max = (t.value as { value: number }).value;
      expect(max / min, t.name).toBeLessThanOrEqual(2.5);
      expect(max, t.name).toBeGreaterThan(min);
    }
    expect(fluid('1rem', '2rem')).toBe('clamp(1rem, 0.6087rem + 1.7391vw, 2rem)');
  });
});

// ---------- contrast ----------
const role = (name: string, mode: Mode): RGBA => parseColour(resolve(model.byPath.get(`color.${name}`)!, model.byPath, mode));
const on = (fg: string, bg: string, mode: Mode) => {
  const b = role(bg, mode);
  return contrast(over(role(fg, mode), b), b);
};

describe('contrast: both modes pass WCAG 2.2 AA', () => {
  const modes: Mode[] = ['light', 'dark'];
  it.each(modes)('%s: text roles at 4.5:1 on every surface', (mode) => {
    for (const bg of ['bg', 'bg-raised', 'bg-sunk', 'bg-hover'])
      for (const fg of ['text', 'text-muted', 'accent', 'accent-hover', 'positive', 'negative', 'highlight-ink']) expect(on(fg, bg, mode), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(modes)('%s: text on the filled roles at 4.5:1', (mode) => {
    const pairs: [string, string][] = [
      ['on-accent', 'accent'],
      ['on-accent', 'accent-hover'],
      ['on-accent-soft', 'accent-soft'],
      ['on-highlight', 'highlight'],
      ['text', 'mark'],
      ['text', 'positive-soft'],
      ['text', 'negative-soft'],
      ['text', 'accent-soft'],
    ];
    for (const [fg, bg] of pairs) expect(on(fg, bg, mode), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(modes)('%s: outlines and the focus ring at 3:1 (non-text contrast)', (mode) => {
    for (const bg of ['bg', 'bg-raised']) {
      expect(on('border', bg, mode), `border on ${bg}`).toBeGreaterThanOrEqual(3);
      expect(on('focus', bg, mode), `focus on ${bg}`).toBeGreaterThanOrEqual(3);
      expect(on('accent', bg, mode), `checked fill on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('text on a picture: white over the image shade, even on the whitest pixel', () => {
    const white: RGBA = [255, 255, 255, 1];
    const shaded = over(role('image-shade', 'light'), white);
    expect(contrast(role('on-image', 'light'), shaded)).toBeGreaterThanOrEqual(4.5);
  });

  it('the lightbox: its text on the smoke (paper-white on light, black on dark), whatever the page behind it', () => {
    const page = (p: string) => parseColour(resolve(model.byPath.get(p)!, model.byPath));
    for (const mode of ['light', 'dark'] as Mode[]) {
      for (const behind of ['p.color.stock.0', 'p.color.stock.950', 'p.color.indigo.700']) {
        const smoke = over(role('scrim', mode), page(behind));
        expect(contrast(role('text', mode), smoke), `text on ${mode} smoke over ${behind}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(role('text-muted', mode), smoke), `muted on ${mode} smoke over ${behind}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // the smoke is the theme's own: light on light, dark on dark
    expect(role('scrim', 'light')[0]).toBeGreaterThan(240);
    expect(role('scrim', 'dark')[0]).toBeLessThan(30);
  });

  it('the second layer of a duotone icon reads on the page in both modes (3:1), and stays apart from the ink over it', () => {
    for (const mode of ['light', 'dark'] as Mode[]) {
      expect(on('icon-secondary', 'bg', mode), `on the page, ${mode}`).toBeGreaterThanOrEqual(3);
      expect(on('icon-secondary', 'bg-raised', mode), `on a card, ${mode}`).toBeGreaterThanOrEqual(3);
      // the layers never merge; hue does the rest (cream over lavender on dark), and neither outweighs the other
      expect(contrast(role('icon-secondary', mode), role('text', mode)), `against the ink, ${mode}`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('marigold is a highlighter, never text on paper: it fails 3:1 on the light page, so no text role uses it there', () => {
    expect(on('highlight', 'bg', 'light')).toBeLessThan(3);
    for (const r of ['text', 'text-muted', 'accent', 'focus', 'border']) expect(resolve(model.byPath.get(`color.${r}`)!, model.byPath, 'light')).not.toBe(resolve(model.byPath.get('color.highlight')!, model.byPath, 'light'));
  });

  it.each(modes)('%s, more contrast (prefers-contrast: more): muted text at 7:1 (AAA), outlines at 4.5:1, rules at 3:1', (mode) => {
    const more = (name: string) => parseColour(resolveMore(model.byPath.get(`color.${name}`)!, model.byPath, mode));
    const bg = role('bg', mode);
    expect(contrast(more('text-muted'), bg), 'muted').toBeGreaterThanOrEqual(7);
    expect(contrast(more('border'), bg), 'border').toBeGreaterThanOrEqual(4.5);
    expect(contrast(more('rule'), bg), 'rule').toBeGreaterThanOrEqual(3);
    // and the build writes them inside the media query
    expect(TOKENS_CSS).toMatch(/@media \(prefers-contrast: more\) \{\s*:root \{[^}]*--color-text-muted: var\(--color-muted-strong\)/);
  });
});

// ---------- CSS: tokens only ----------
interface Decl {
  file: string;
  sel: string;
  prop: string;
  value: string;
}
function declarations(css: string, file: string): Decl[] {
  const out: Decl[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      out.push({ file, sel, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() });
    }
  }
  return out;
}
const cssOf = siteAstro.map((f) => ({ file: rel(f), css: styles(read(f)) })).concat({ file: 'src/site/styles/base.css', css: BASE_CSS });
const all = cssOf.flatMap((c) => declarations(c.css, c.file));
const where = (d: Decl) => `${d.file} ${d.sel} { ${d.prop}: ${d.value} }`;
/** The component that owns a component token's group (its `site.owner`). */
const ownerOfToken = (t: { path: string[] }) => ((SOURCES['tokens.json'].c as Record<string, { $extensions?: Record<string, unknown> }>)[t.path[1]]?.$extensions?.['site.owner'] as string | undefined) ?? '';
/** The container query sizes a component owns (component tokens marked site.container), as CSS. */
const containerSizesOf = (component: string) => model.tokens.filter((t) => t.extensions?.['site.container'] && ownerOfToken(t) === component).map((t) => resolve(t, model.byPath));
const bare = (v: string) => v.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '');

describe('CSS reads tokens, never raw values', () => {
  const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color-mix)\(|\b(?:white|black|red|green|blue|yellow|gray|grey|orange|purple|pink|gold|silver)\b/i;

  it('found the site styles', () => {
    expect(all.length).toBeGreaterThan(800);
  });

  it('no colour literals', () => {
    expect(all.filter((d) => !d.prop.startsWith('--') && COLOUR.test(d.value)).map(where)).toEqual([]);
  });

  it('never a primitive (--p-*) in a stylesheet', () => {
    expect(all.filter((d) => /var\(--p-/.test(d.value)).map(where)).toEqual([]);
  });

  it('never a primitive in a component, layout or page (only the library shows them)', () => {
    const bad = siteAstro.filter((f) => !rel(f).startsWith('src/site/library/') && /--p-[\w-]+/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, ''))).map(rel);
    expect(bad).toEqual([]);
  });

  it('never a game token: the two systems are separate', () => {
    expect(all.filter((d) => /var\(--(surface|c-(hud|panel|slot|wood))/.test(d.value)).map(where)).toEqual([]);
  });

  it('z-index from the layer scale', () => {
    expect(all.filter((d) => d.prop === 'z-index' && !/^var\(--layer-[\w-]+\)$/.test(d.value)).map(where)).toEqual([]);
  });

  it('type from its scales: sizes, weights, line heights, families (or a whole type style: font, from a typography token)', () => {
    expect(all.filter((d) => d.prop === 'font-size' && !/^(var\(--(text|c)-[\w-]+\)|1em|100%|inherit)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'font' && !/^var\(--type-[\w-]+\)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'font-weight' && !/^(var\(--weight-[\w-]+\)|inherit)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'line-height' && !/^(var\(--leading-[\w-]+\)|0|inherit)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'font-family' && !/^(var\(--font-[\w-]+\)|inherit)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'letter-spacing' && !/^(var\(--tracking-[\w-]+\)|inherit|0)$/.test(d.value)).map(where)).toEqual([]);
  });

  it('radii, borders and shadows from their scales', () => {
    expect(all.filter((d) => /radius$/.test(d.prop) && !/^(var\(--(radius|c)-[\w-]+\)|0|inherit)$/.test(d.value)).map(where)).toEqual([]);
    expect(all.filter((d) => /^(border|outline)(-(top|right|bottom|left|block|inline|width)(-(start|end|width))?)?$/.test(d.prop) && /(^|\s)[\d.]+(px|rem)\b/.test(bare(d.value))).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'box-shadow' && /(^|\s)-?[\d.]*[1-9][\d.]*(px|rem)\b/.test(bare(d.value))).map(where)).toEqual([]);
    expect(all.filter((d) => d.prop === 'box-shadow' && !/var\(--/.test(d.value) && d.value !== 'none').map(where)).toEqual([]);
  });

  it('motion from the duration and easing tokens (the reduced-motion reset excepted)', () => {
    const motion = all.filter((d) => /^(transition|animation)(-duration|-timing-function|-delay)?$/.test(d.prop) && !d.value.includes('!important'));
    const raw = (v: string) => bare(v).replace(/\b0m?s\b/g, '');
    const bad = motion.filter((d) => /(^|[\s,(])[\d.]+m?s\b/.test(raw(d.value)) || /cubic-bezier\(|steps\(/.test(d.value) || /\b(ease|ease-in|ease-out|ease-in-out)\b/.test(bare(d.value)));
    expect(bad.map(where)).toEqual([]);
  });

  it('spacing (padding, margin, gap, inset) from the space scale: no px or rem literals', () => {
    const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;
    const bad = all.filter((d) => SPACING.test(d.prop) && d.sel !== '.sr-only' && /(^|[\s(,*-])[\d.]*[1-9][\d.]*(px|rem)\b/.test(bare(d.value)));
    expect(bad.map(where)).toEqual([]);
  });

  it('transforms from the scale and shift tokens: only tokens, percentages, 0, identity scales and quarter turns are written', () => {
    const TRANSFORM = /^(transform|translate|scale|rotate)$/;
    const raw = (d: Decl) => {
      const v = bare(d.value);
      if (/(^|[\s(,*-])[\d.]*[1-9][\d.]*(px|r?em)\b/.test(v)) return true;
      // a scale factor other than nothing (0) or none (1): a feel, which the scale tokens hold (a calc() of tokens may use 0 and 1)
      if (/scale[XYZ3d]*\(/.test(v) && [...v.slice(v.search(/scale[XYZ3d]*\(/)).matchAll(/(?<![\w.-])-?[\d.]+(?![\w.%])/g)].some((m) => !/^-?[01]$/.test(m[0]))) return true;
      if (d.prop === 'scale' && v.split(/\s+/).some((n) => n && !/^-?[01]$|^none$/.test(n))) return true;
      // a turn is geometry (a spinner's turn, a chevron flipped), not a feel
      return [...v.matchAll(/(-?[\d.]+)deg\b/g)].some((m) => Number(m[1]) % 90 !== 0);
    };
    expect(all.filter((d) => TRANSFORM.test(d.prop) && !d.value.includes('!important') && raw(d)).map(where)).toEqual([]);
  });

  it('em only from tokens: a written em is 1em, named here with its reason', () => {
    // where 1em is the point: the thing is exactly as big as the text it sits in
    const ONE_EM: Record<string, string> = {
      'Icon.astro': 'an icon in a line is as tall as the text',
      'Prose.astro': 'with initial-letter, the drop cap keeps the paragraph’s size (initial-letter sets its height)',
    };
    const bad = all.filter((d) => !d.prop.startsWith('--') && /(^|[\s(,*-])[\d.]+em\b/.test(bare(d.value)) && !(ONE_EM[d.file.split('/').pop()!] && /^(?:[^\d]*\b1em\b[^\d]*)$/.test(bare(d.value))));
    expect(bad.map(where)).toEqual([]);
  });

  it('grid tracks from tokens: no px or rem literal sizes a column or row (the design library’s specimen pages and the stories’ sample grids excepted)', () => {
    // their columns are sized to the samples they lay out, not a decision of the site's
    const SPECIMENS = /^src\/(site\/(library\/tokens|stories)|pages\/design)\//;
    const GRID = /^grid(-template(-columns|-rows)?|-auto-(columns|rows))?$/;
    const bad = all.filter((d) => GRID.test(d.prop) && !SPECIMENS.test(d.file) && /(^|[\s(,*-])[\d.]*[1-9][\d.]*(px|r?em)\b/.test(bare(d.value)));
    expect(bad.map(where)).toEqual([]);
  });

  it('width and height queries only at the breakpoint tokens, in CSS (media and container queries, either syntax) and in scripts; a container query may also use a size token its component owns (site.container)', () => {
    const bps = new Set(model.tokens.filter((t) => t.path[0] === 'breakpoint').map((t) => resolve(t, model.byPath)));
    const bad: string[] = [];
    // (max-width: 40rem), and the range syntax a container query reads best in: (width < 40rem), (40rem <= inline-size)
    const sizes = (q: string) => [
      ...[...q.matchAll(/\((?:min|max)-(?:width|height|inline-size|block-size):\s*([\d.]+\w+)\)/g)].map((m) => m[1]),
      ...[...q.matchAll(/\(\s*(?:width|height|inline-size|block-size)\s*[<>]=?\s*([\d.]+\w+)\s*\)/g)].map((m) => m[1]),
      ...[...q.matchAll(/\(\s*([\d.]+\w+)\s*[<>]=?\s*(?:width|height|inline-size|block-size)\s*\)/g)].map((m) => m[1]),
    ];
    expect(sizes('(width < 40rem) and (30rem <= inline-size) and (max-width: 56rem)')).toEqual(['56rem', '40rem', '30rem']);
    for (const c of cssOf) {
      const own = new Set(containerSizesOf(c.file.split('/').pop()!.replace(/\.astro$/, '')));
      for (const m of c.css.matchAll(/@(media|container)([^{]*)\{/g)) for (const v of sizes(m[2])) if (!bps.has(v) && !(m[1] === 'container' && own.has(v))) bad.push(`${c.file}: ${m[0]}`);
    }
    for (const f of siteAstro) for (const m of read(f).matchAll(/matchMedia\('([^']*)'\)/g)) for (const v of sizes(m[1])) if (!bps.has(v)) bad.push(`${rel(f)}: ${m[0]}`);
    expect(bad).toEqual([]);
  });

  it("scripts and props take breakpoints and widths from the generated responsive.ts: no rem literal in a matchMedia query or a picture's sizes", () => {
    const bad: string[] = [];
    const files = walk(join(ROOT, 'src/site'), /\.(astro|ts)$/).filter((f) => !f.endsWith(`${sep}responsive.ts`));
    for (const f of files) {
      const src = read(f).replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of src.matchAll(/['"`][^'"`\n]*\((?:min|max)-(?:width|height):\s*[\d.]+r?em\)[^'"`\n]*['"`]/g)) bad.push(`${rel(f)}: ${m[0]}`);
      for (const m of src.matchAll(/\bsizes=(["'])[^"']*?[\d.]+r?em[^"']*\1/g)) bad.push(`${rel(f)}: ${m[0]}`);
      for (const m of src.matchAll(/\bsizes=\{\s*['"`][^'"`]*?[\d.]+r?em[^'"`]*['"`]\s*\}/g)) bad.push(`${rel(f)}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });

  it('every semantic and component token is read: by a style or script, by another token, or (a breakpoint) by a query', () => {
    const generated = (TOKENS_CSS + EDITOR_TOKENS_CSS).replace(/^\s*--[\w-]+:/gm, '');
    const sources = [...walk(join(ROOT, 'src/site'), /\.(astro|ts|css)$/), ...walk(join(ROOT, 'src/pages'), /\.astro$/)]
      .filter((f) => !/[\\/](tokens|editor-tokens)\.css$|[\\/]responsive\.ts$/.test(f))
      .map(read)
      .join('\n');
    const queries = cssOf.map((c) => [...c.css.matchAll(/@(?:media|container)([^{]*)\{/g)].map((m) => m[1]).join('\n')).join('\n');
    const unread = model.tokens
      // a deprecated alias is kept for one release with no reader (tokenChangelog.test.ts holds that)
      .filter((t) => t.path[0] !== 'p' && t.deprecated === undefined)
      .filter((t) => {
        if (t.path[0] === 'breakpoint') return !queries.includes(resolve(t, model.byPath)) && !sources.includes(`media('${t.path[1]}'`);
        // a container query's size: read by its owner's @container query (CSS can't read a variable there), or by name from a script
        if (t.extensions?.['site.container']) {
          const owner = cssOf.find((c) => c.file.endsWith(`/${ownerOfToken(t)}.astro`));
          return !(owner && [...owner.css.matchAll(/@container([^{]*)\{/g)].some((m) => m[1].includes(resolve(t, model.byPath)))) && !sources.includes(t.name);
        }
        if (t.extensions?.['site.sizes']) return !new RegExp(`'${t.name.replace(/^--c-/, '')}'`).test(sources) && !sources.includes(`var(${t.name})`);
        return !sources.includes(t.name) && !generated.includes(`var(${t.name})`);
      })
      .map((t) => t.name);
    expect(unread).toEqual([]);
  });

  it('hover is an enhancement: every :hover rule sits inside @media (hover: hover), so a tap never leaves a phone stuck in a hover state', () => {
    const bad: string[] = [];
    for (const c of cssOf) {
      const src = c.css.replace(/\/\*[\s\S]*?\*\//g, '');
      const stack: string[] = [];
      let start = 0;
      for (let i = 0; i < src.length; i++) {
        if (src[i] === '{') {
          const prelude = src.slice(start, i).trim();
          if (/:hover/.test(prelude) && !prelude.startsWith('@') && !stack.some((p) => /\(hover:\s*hover\)/.test(p))) bad.push(`${c.file}: ${prelude}`);
          stack.push(prelude);
          start = i + 1;
        } else if (src[i] === '}') {
          stack.pop();
          start = i + 1;
        } else if (src[i] === ';') start = i + 1;
      }
    }
    expect(bad).toEqual([]);
  });

  it('every var() the site uses is defined: a token, a local custom property, or data set inline', () => {
    const defined = new Set([...(TOKENS_CSS + EDITOR_TOKENS_CSS).matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    for (const d of all) if (d.prop.startsWith('--')) defined.add(d.prop);
    // data custom properties set from the template (style attributes) or a script (a component's or tier 0's)
    for (const f of [...siteAstro, ...walk(join(ROOT, 'src/site/scripts'), /\.ts$/), ...walk(join(ROOT, 'src/site/editor/scripts'), /\.ts$/)]) {
      const outside = read(f).replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
      for (const m of outside.matchAll(/(--[\w-]+)\s*:\s*[$`'"\w]/g)) defined.add(m[1]);
      for (const m of outside.matchAll(/setProperty\(\s*'(--[\w-]+)'/g)) defined.add(m[1]);
    }
    const missing = new Set<string>();
    for (const d of all) for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} in ${where(d)}`);
    expect([...missing]).toEqual([]);
  });

  it('no global styles, except where a component styles what it did not write (and says why)', () => {
    const ALLOWED: Record<string, string> = {
      'Prose.astro': 'rich text from Markdown',
      'Lightbox.astro': 'the filmstrip its script builds',
      'VideoEmbed.astro': 'the iframe its script swaps in',
      'CanvasChrome.astro': "edit mode's canvas: the page's own editable text and the paragraph its script adds",
      'CollectionFields.astro': "edit mode's rich fields (a collection item's words): the paragraphs and lists the browser writes as they're edited",
      'InsertForms.astro': "edit mode's rich fields (a new collection's words): the paragraphs and lists the browser writes as they're edited",
    };
    const bad = siteAstro.filter((f) => !ALLOWED[f.split(sep).pop()!] && (/:global\(/.test(styles(read(f))) || /<style[^>]*is:global/.test(read(f)))).map(rel);
    expect(bad).toEqual([]);
  });

  it('no native scrollbar styling: every scroller hides the native bar and gets the overlay handle (data-scrollbar)', () => {
    const css = walk(join(ROOT, 'src/site'), /\.(astro|css)$/).filter((f) => !f.endsWith('tokens.css'));
    const bad = css.filter((f) => /scrollbar-color|scrollbar-width:\s*(thin|auto)|::-webkit-scrollbar-(thumb|track|button|corner)/.test(styles(read(f)) || read(f))).map(rel);
    expect(bad).toEqual([]);
    // what scrolls in a component opts in; two hide their bar by design: the carousel's slide track (its buttons and dots move it)
    // and the article minimap's strip (a slim column that scrolls without a scrollbar)
    const opted = walk(join(ROOT, 'src/site'), /\.astro$/).filter((f) => /overflow(-[xy])?:\s*(auto|scroll)/.test(styles(read(f))));
    const missing = opted.filter((f) => !/data-scrollbar|scrollbars'/.test(read(f)) && !/[\\/](Carousel|ArticleMinimap)\.astro$/.test(f)).map(rel);
    expect(missing).toEqual([]);
  });

  it('pages carry no styles of their own: layouts and components do (stories and the library excepted)', () => {
    const pages = [join(ROOT, 'src/pages/index.astro'), ...walk(join(ROOT, 'src/pages/classic'), /\.astro$/)];
    expect(pages.filter((f) => /<style/.test(read(f))).map(rel)).toEqual([]);
  });

  it('client scripts set up every page through scripts/page.ts (the library swaps pages in without a reload)', () => {
    const scripts = walk(join(ROOT, 'src/site'), /\.astro$/)
      .map((f) => [f, [...read(f).matchAll(/<script(?![^>]*is:inline)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')] as const)
      .filter(([, s]) => s.trim().length > 0);
    expect(scripts.length).toBeGreaterThanOrEqual(12);
    const bad = scripts
      .filter(([, s]) => !/from '(\.\.\/)+scripts\/page'/.test(s) || /^\s{0,2}document\.querySelectorAll/m.test(s))
      .map(([f]) => rel(f));
    expect(bad).toEqual([]);
  });

  it('a listener on window, document or a media query passes signal, or says why it lives once per document', () => {
    const named: string[] = [];
    const bad: string[] = [];
    const files = [...tierFiles.map((f) => f.file), ...walk(join(ROOT, 'src/site/editor/components'), /\.astro$/), join(ROOT, 'src/site/editor/EditorLayout.astro')].filter(existsSync);
    for (const f of files) {
      const script = [...read(f).matchAll(/<script(?![^>]*is:inline)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
      const mqls = [...script.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:window\.)?matchMedia\(/g)].map((m) => m[1]);
      const receiver = new RegExp(`(?:\\b(?:window|document|${['matchMedia\\([^)]*\\)', ...mqls].join('|')}))\\s*\\.addEventListener\\(`, 'g');
      for (const m of script.matchAll(receiver)) {
        // the call's arguments, to its closing parenthesis
        let depth = 1;
        let i = m.index! + m[0].length;
        for (; i < script.length && depth > 0; i++) depth += script[i] === '(' ? 1 : script[i] === ')' ? -1 : 0;
        if (/\bsignal\b/.test(script.slice(m.index!, i))) continue;
        const before = script.slice(0, m.index!).trimEnd().split('\n').pop() ?? '';
        const where = `${rel(f)}: ${m[0]}`;
        if (/\/\/\s*once per document:\s*\S/.test(before)) named.push(where);
        else bad.push(where);
      }
    }
    expect(bad).toEqual([]);
    // the side nav, kept across the library's page swaps, is the one component that listens for the whole document
    expect(named.every((n) => n.startsWith('src/site/components/compounds/SideNav.astro'))).toBe(true);
    expect(named).toHaveLength(3);
  });
});

// ---------- tiers ----------
const TIER_OF_DIR: Record<string, Tier> = { fundamentals: 'fundamental', compounds: 'compound', layouts: 'layout' };
const RANK: Record<Tier, number> = { fundamental: 1, compound: 2, layout: 3 };
const FOUNDATION = /^(\.\.\/)+(design|scripts|styles|assets)\/[\w./-]+(\?url)?$|^@fontsource-variable\/|^astro(:|\/)/;

describe('tiers: tokens → fundamentals → compounds → layouts, each made only from the tiers before it', () => {
  it('found every tier', () => {
    const count = (t: Tier) => tierFiles.filter((f) => f.tier === t).length;
    expect(count('fundamental')).toBeGreaterThanOrEqual(20);
    expect(count('compound')).toBeGreaterThanOrEqual(12);
    expect(count('layout')).toBeGreaterThanOrEqual(4);
  });

  it.each(tierFiles.map((f) => [`${f.tier} ${f.name}`, f] as const))('%s imports only from lower tiers and tier 0', (_, f) => {
    const bad: string[] = [];
    for (const i of [...importsOf(frontmatter(f.src)).map((x) => x.spec), ...scriptImports(f.src)]) {
      if (i.endsWith('.astro')) {
        const dir = /(fundamentals|compounds|layouts)\/[A-Z]\w*\.astro$/.exec(i)?.[1];
        const target = dir ? TIER_OF_DIR[dir] : null;
        if (!target || RANK[target] >= RANK[f.tier]) bad.push(i);
      } else if (!FOUNDATION.test(i)) bad.push(i);
    }
    expect(bad).toEqual([]);
  });

  it('the game and the site never import each other (only the base-path helper is shared)', () => {
    const siteSrc = walk(join(ROOT, 'src/site'), /\.(astro|ts)$/);
    const toGame = siteSrc.filter((f) => /from ['"][^'"]*\/game\//.test(read(f)) && !f.endsWith(`${sep}meta.ts`)).map(rel);
    expect(toGame).toEqual([]);
    const gameSrc = walk(join(ROOT, 'src/game'), /\.(tsx?|astro)$/);
    expect(gameSrc.filter((f) => /from ['"][^'"]*\/site\//.test(read(f))).map(rel)).toEqual([]);
  });

  it('fundamentals are sealed: no class or style props (a compound lays them out, never restyles them)', () => {
    for (const f of tierFiles.filter((x) => x.tier === 'fundamental')) {
      const names = propsOf(frontmatter(f.src)).props.map((p) => p.name);
      expect(names, f.name).not.toContain('class');
      expect(names, f.name).not.toContain('style');
      expect(f.src, f.name).not.toMatch(/Astro\.props\.(class|style)\b/);
    }
  });
});

// ---------- documentation ----------
describe('component tokens: each group is owned by one component or shared by all (design system §2.4)', () => {
  type Group = { $extensions?: Record<string, unknown> } & Record<string, unknown>;
  const C = SOURCES['tokens.json'].c as Record<string, Group>;
  const groups = Object.keys(C).filter((k) => !k.startsWith('$'));
  const ownerOf = (g: string) => C[g].$extensions?.['site.owner'] as string | undefined;
  // the longest group a --c-* name starts with (list and listbox, image and its kin)
  const groupOfName = (name: string) => groups.filter((g) => name === g || name.startsWith(`${g}-`)).sort((a, b) => b.length - a.length)[0];
  const readers = [...walk(join(ROOT, 'src/site'), /\.(astro|ts|css)$/), ...walk(join(ROOT, 'src/pages'), /\.astro$/)].filter(
    (f) => !/[\\/](tokens|editor-tokens)\.css$|[\\/]iconData\.ts$/.test(f) && !rel(f).startsWith('src/site/library/') && !rel(f).startsWith('src/pages/design/'),
  );

  it('every group names its owner (a component) or says it is shared', () => {
    // edit mode's parts and layout own their c.editor-* groups (documentation/editor/spec.md §10; held in editorDesignSystem.test.ts)
    const editorParts = [...walk(join(ROOT, 'src/site/editor/components'), /\.astro$/), join(ROOT, 'src/site/editor/EditorLayout.astro')].map((f) => f.split(sep).pop()!.replace(/\.astro$/, ''));
    const names = new Set([...tierFiles.map((f) => f.name), ...editorParts]);
    const bad = groups.filter((g) => {
      const o = ownerOf(g);
      return !o || (o !== 'shared' && !names.has(o));
    });
    expect(bad).toEqual([]);
  });

  it('a component reads only shared groups and the group it owns', () => {
    const bad: string[] = [];
    expect(readers.length).toBeGreaterThan(60);
    for (const f of readers) {
      const name = f.split(sep).pop()!.replace(/\.(astro|ts|css)$/, '');
      for (const m of read(f).matchAll(/--c-([\w-]+)/g)) {
        const g = groupOfName(m[1]);
        if (!g) continue;
        const o = ownerOf(g);
        if (o !== 'shared' && o !== name) bad.push(`${rel(f)} reads --c-${m[1]} (${g} is ${o}'s)`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe('every component documents itself and has a story', () => {
  it.each(tierFiles.map((f) => [`${f.tier} ${f.name}`, f] as const))('%s', (_, f) => {
    const fm = frontmatter(f.src);
    const doc = docComment(fm);
    expect(doc.summary.length, 'a summary').toBeGreaterThan(40);
    expect(doc.tier, '@tier').toBe(f.tier);
    expect(doc.a11y.length, '@a11y notes').toBeGreaterThan(0);
    const { props } = propsOf(fm);
    expect(props.filter((p) => p.name !== 'data-*' && !p.description).map((p) => p.name), 'every prop has a JSDoc comment').toEqual([]);
    const story = join(ROOT, 'src/site/stories', `${f.name}.stories.astro`);
    expect(existsSync(story), 'a story').toBe(true);
    if (f.tier !== 'layout') expect(read(story), 'the story has examples').toMatch(/<Example\b[^>]*title="/);
    // a component that takes keys says which
    if (/addEventListener\(\s*'keydown'/.test(f.src)) expect(doc.keys.length, '@key lines').toBeGreaterThan(0);
  });

  it('no story without a component', () => {
    const names = new Set(tierFiles.map((f) => f.name));
    const orphans = walk(join(ROOT, 'src/site/stories'), /\.stories\.astro$/).map((f) => f.split(sep).pop()!.replace('.stories.astro', '')).filter((n) => !names.has(n));
    expect(orphans).toEqual([]);
  });

  it('a component stays short enough to change safely: markup and script at most 350 lines (logic beyond wiring lives in tier 0), the whole file at most 500 (DS2-08: room under the old 650)', () => {
    const lines = (s: string) => s.split('\n').length;
    const long = tierFiles
      .map((f) => ({ name: f.name, total: lines(f.src), rest: lines(f.src) - [...f.src.matchAll(/<style[\s\S]*?<\/style>/g)].reduce((n, m) => n + lines(m[0]), 0) }))
      .filter((f) => f.rest > 350 || f.total > 500)
      .map((f) => `${f.name}: ${f.total} lines, ${f.rest} without its styles`);
    expect(long).toEqual([]);
  });

  it('every story shows each choice a prop offers: every value of a union prop (or the prop says which story shows it, and that one does)', () => {
    const storyOf = (name: string) => {
      const p = join(ROOT, 'src/site/stories', `${name}.stories.astro`);
      return existsSync(p) ? read(p) : '';
    };
    const shows = (s: string, v: string) => s.includes(`'${v}'`) || s.includes(`"${v}"`);
    // HTML semantics, not a look: the element (as), a button's or field's type, and ARIA states scripts set
    const SEMANTIC = /^(as|type|aria-[\w-]+)$/;
    const missing: string[] = [];
    // a whole page (a layout, PageShell) is its story's one page, so it can't show its choices side by side
    const WHOLE_PAGE = (f: (typeof tierFiles)[number]) => f.tier === 'layout' || f.name === 'PageShell';
    for (const f of tierFiles) {
      const own = storyOf(f.name);
      if (!own || WHOLE_PAGE(f)) continue;
      for (const p of propsOf(frontmatter(f.src)).props) {
        const type = p.type.replace(/\s+/g, ' ').trim();
        if (SEMANTIC.test(p.name) || !/^('[^']*' \| )+'[^']*'$/.test(type)) continue;
        const def = p.default?.replace(/^['"]|['"]$/g, '');
        // a prop passed on to another component may say where its choices are shown ("shown in Image")
        const elsewhere = /\bshown in ([A-Z]\w+)/.exec(p.description ?? '')?.[1];
        const s = elsewhere ? storyOf(elsewhere) : own;
        for (const v of [...type.matchAll(/'([^']*)'/g)].map((m) => m[1])) if (v !== def && !shows(s, v)) missing.push(`${f.name}: ${p.name}="${v}"${elsewhere ? ` (said to be shown in ${elsewhere})` : ''}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// ---------- recipes written once (DS2-18), and compounds that size by their column (DS2-08) ----------
describe('recipes written once: a shared decision is a token, a base.css recipe or a tier 0 type, never a copied block', () => {
  const COMPONENTS = tierFiles.filter((f) => f.tier !== 'layout');

  /** Identical declaration blocks (60 characters or more, a `prop: value` body) in 2 or more files: the measure scripts/design-system-audit.mjs takes. */
  const copied = (files: { name: string; src: string }[]) => {
    const seen = new Map<string, Set<string>>();
    for (const f of files)
      for (const m of f.src.matchAll(/\{([^{}]{60,})\}/g)) {
        const b = m[1].replace(/\s+/g, ' ').trim();
        if (!/:\s/.test(b) || /^\s*\w+\??:\s*(string|number|boolean)/.test(b)) continue;
        if (!seen.has(b)) seen.set(b, new Set());
        seen.get(b)!.add(f.name);
      }
    return [...seen.entries()].filter(([, s]) => s.size >= 2).map(([b, s]) => `${[...s].join(', ')}: ${b.slice(0, 100)}`);
  };

  it('fewer than 25 identical declaration blocks are copied across the fundamentals and compounds', () => {
    const block = '{\n    color: var(--color-text-muted);\n    font: var(--type-hint);\n  }';
    expect(copied([{ name: 'A', src: `.a ${block}` }, { name: 'B', src: `.b ${block}` }, { name: 'C', src: '.c { color: red }' }])).toHaveLength(1);
    const blocks = copied(COMPONENTS);
    expect(blocks.length, blocks.join('\n')).toBeLessThan(25);
  });

  it("the recipes base.css holds are written nowhere else: a control's disabled state (data-press), the focus ring (data-focus-ring), a card that's one link (data-card)", () => {
    const own = (re: RegExp) => COMPONENTS.filter((f) => re.test(styles(f.src).replace(/\s+/g, ' '))).map((f) => f.name);
    expect(own(/opacity: var\(--opacity-disabled\); cursor: not-allowed/)).toEqual([]);
    expect(own(/outline: var\(--border-focus\) solid var\(--color-focus\); outline-offset: var\(--border-focus-offset\)/)).toEqual([]);
    expect(own(/\{ content: ''; position: absolute; inset: 0; \}/)).toEqual([]);
    // and each is there, keyed by its attribute
    for (const key of ['[data-press]', "[data-focus-ring='inside']", '[data-card]', "[data-field-part='hint']", "[data-check-part='root']", '[data-suggestions]', '[data-chevron]']) expect(BASE_CSS, key).toContain(key);
  });

  it("the picture's drop shadow and the room it takes are c.image tokens, and the field label's type is a typography token", () => {
    const own = (re: RegExp) => COMPONENTS.filter((f) => re.test(styles(f.src))).map((f) => f.name);
    expect(own(/drop-shadow\(|calc\(var\(--c-image-shadow-y\)/)).toEqual([]);
    expect(TOKENS_CSS).toMatch(/--c-image-shadow-filter: drop-shadow\(/);
    expect(TOKENS_CSS).toMatch(/--type-label: var\(--weight-semibold\) var\(--text-sm\)\/var\(--leading-ui\) var\(--font-ui\);/);
    // a field label's three longhands (size, weight, line height) are the token's to set
    const triple = /font-size: var\(--text-sm\);\s*font-weight: var\(--weight-semibold\);\s*line-height: var\(--leading-ui\)/;
    expect(COMPONENTS.filter((f) => ['FileField', 'Progress', 'Slider', 'TextField', 'ChoiceGroup'].includes(f.name) && triple.test(styles(f.src))).map((f) => f.name)).toEqual([]);
  });

  it("a picture's file is one type (PictureSource in design/pictures.ts), never declared inline in a component", () => {
    const inline = /\{\s*src: string; srcset\?: string; width: number; height: number/;
    const files = [...tierFiles.map((f) => ({ name: f.name, src: f.src })), ...walk(join(ROOT, 'src/site/scripts'), /\.ts$/).map((f) => ({ name: rel(f), src: read(f) }))];
    expect(files.filter((f) => inline.test(frontmatter(f.src) || f.src)).map((f) => f.name)).toEqual([]);
    expect(read(join(ROOT, 'src/site/design/pictures.ts'))).toMatch(/export interface PictureSource \{/);
  });
});

describe('compounds placed in a column size their insides by the column (a container query), not the screen (DS2-08)', () => {
  // where a column's width, not the window's, decides their layout: a collection, a story card, a carousel
  const IN_COLUMNS = ['Collection', 'StoryCard', 'Carousel'];
  const SCRIPTS: Record<string, string> = { Collection: 'collectionStrip.ts', Carousel: 'carousel.ts' };

  it.each(IN_COLUMNS)('%s is a container, and no width query of the screen lays it out (its script asks its own width too)', (name) => {
    const f = tierFiles.find((x) => x.name === name)!;
    const css = styles(f.src);
    expect(css, 'a container').toMatch(/container-type:\s*inline-size/);
    expect(css, 'container queries').toMatch(/@container\s*\(/);
    const screen = [...css.matchAll(/@media([^{]*)\{/g)].map((m) => m[1].trim()).filter((q) => /width|height/.test(q));
    expect(screen).toEqual([]);
    if (SCRIPTS[name]) expect(read(join(ROOT, 'src/site/scripts', SCRIPTS[name]))).not.toMatch(/matchMedia\(\s*media\(/);
  });
});

// ---------- copy and paths ----------
describe('icons: Font Awesome Duotone, imported one by one (scripts/import-site-icons.mjs)', () => {
  const set = JSON.parse(read(join(ROOT, 'src/site/design/icon-set.json'))).icons as Record<string, string>;

  it('the generated data is the set: the same names, the same Font Awesome icons, well-formed paths', async () => {
    const { ICON_DATA } = await import('../../src/site/design/iconData');
    expect(Object.keys(ICON_DATA).sort()).toEqual(Object.keys(set).sort());
    for (const [name, i] of Object.entries(ICON_DATA)) {
      expect(i.fa, name).toBe(set[name]);
      expect(i.width, name).toBeGreaterThanOrEqual(256);
      expect(i.width, name).toBeLessThanOrEqual(640);
      expect(i.primary, name).toMatch(/^M[\d\s.MLHVCSQTAZmlhvcsqtaz-]+$/);
      expect(i.secondary, name).toMatch(/^(M[\d\s.MLHVCSQTAZmlhvcsqtaz-]+)?$/);
    }
  });

  it('iconData.ts is up to date (re-imported from the library when it is on this machine)', () => {
    expect(() => execFileSync(process.execPath, [join(ROOT, 'scripts/import-site-icons.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('the site never imports Font Awesome from a package: only its own imported data', () => {
    const src = walk(join(ROOT, 'src/site'), /\.(astro|ts)$/).filter((f) => /@fortawesome/.test(read(f)));
    expect(src.map(rel)).toEqual([]);
  });

  it('components draw an icon with both layers (svgOf body), never a single path of their own', () => {
    const bad = walk(join(ROOT, 'src/site/components'), /\.astro$/).filter((f) => /<path[^>]*d=\{\w+\.d\}/.test(read(f)));
    expect(bad.map(rel)).toEqual([]);
  });
});

describe('copy and paths', () => {
  const text = siteAstro.map((f) => [rel(f), read(f)] as const);

  it('no emoji or text symbols as icons (Font Awesome through src/site/design/icons.ts)', () => {
    const bad = text.filter(([, s]) => /[\p{Extended_Pictographic}\u2600-\u27BF\u2190-\u21FF]/u.test(s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''))).map(([f]) => f);
    expect(bad).toEqual([]);
  });

  it('no vague labels or filler: "click here", "OK", "Submit", "read more", lorem ipsum', () => {
    const banned = [/click here/i, />\s*(OK|Okay|Submit)\s*</, />\s*read more\s*</i, /lorem ipsum/i];
    expect(text.flatMap(([f, s]) => banned.filter((b) => b.test(s)).map((b) => `${f}: ${b}`))).toEqual([]);
  });

  it('no hard-coded root-relative URL: every one goes through withBase (the site lives under /atiya/)', () => {
    const bad = text.flatMap(([f, s]) => [...s.matchAll(/\b(?:href|src|srcset|poster)="\/(?!\/)[^"]*"/g)].map((m) => `${f}: ${m[0]}`));
    expect(bad).toEqual([]);
  });

  it('no font or icon from a CDN: the fonts are self-hosted, the icons are data', () => {
    const bad = text.filter(([, s]) => /fonts\.googleapis|fonts\.gstatic|use\.fontawesome|kit\.fontawesome|cdnjs|unpkg|jsdelivr/.test(s)).map(([f]) => f);
    expect(bad).toEqual([]);
  });
});

// ---------- fonts (mobile-audit.md §3.1) ----------
describe('fonts: the site serves its own cut, light enough for a phone', () => {
  const FONTS = join(ROOT, 'src/site/assets/fonts');
  const css = read(join(ROOT, 'src/site/styles/fonts.css'));

  it('fonts.css is generated and names every file, each under 80 KB (Fraunces with SOFT and WONK pinned, Newsreader cut to its weights)', () => {
    const files = [...css.matchAll(/url\('\.\.\/assets\/fonts\/([\w-]+\.woff2)'\)/g)].map((m) => m[1]);
    expect(files.sort()).toEqual(['figtree-roman.woff2', 'fraunces-italic.woff2', 'fraunces-roman.woff2', 'newsreader-italic.woff2', 'newsreader-roman.woff2']);
    for (const f of files) expect(statSync(join(FONTS, f)).size, f).toBeLessThan(80 * 1024);
    // the faces a page loads in all: well under half of the Fontsource files they're cut from
    const total = files.reduce((n, f) => n + statSync(join(FONTS, f)).size, 0);
    expect(total).toBeLessThan(250 * 1024);
    expect(css).toMatch(/GENERATED by scripts\/build-site-fonts\.py/);
  });

  it('the site loads its own cut; only the library\u2019s type playground loads the full variable Fraunces', () => {
    const loaders = siteAstro.filter((f) => /@fontsource-variable\//.test(read(f))).map(rel);
    expect(loaders).toEqual(['src/site/library/tokens/TypeTokens.astro']);
    expect(read(join(ROOT, 'src/site/components/compounds/PageShell.astro'))).toMatch(/import '\.\.\/\.\.\/styles\/fonts\.css'/);
  });

  it('the tokens name the cut\u2019s families', () => {
    for (const [token, family] of [['p.font.fraunces', "'Fraunces'"], ['p.font.newsreader', "'Newsreader'"], ['p.font.figtree', "'Figtree'"]]) expect(String(model.byPath.get(token)!.value).startsWith(family), token).toBe(true);
  });
});

// ---------- edit mode: the editor tier (documentation/editor/spec.md §10) ----------
describe('edit mode: parts made only from the design system, pages that compose them, nothing reaching the site', () => {
  const EDITOR = join(ROOT, 'src/site/editor');
  const parts = walk(join(EDITOR, 'components'), /\.astro$/).map((file) => ({ file, name: file.split(sep).pop()!, src: read(file) }));
  const specs = (src: string) => [...importsOf(frontmatter(src)).map((x) => x.spec), ...scriptImports(src)];

  it('found the parts', () => expect(parts.length).toBeGreaterThanOrEqual(15));

  it('Media and inspector previews always show whole images with square corners', () => {
    const kitPicture = { name: 'PictureField.astro', src: read(join(EDITOR, 'kit/PictureField.astro')) };
    for (const name of ['MediaGrid.astro', 'MediaDetails.astro', 'SetFields.astro', 'PictureField.astro']) {
      const part = [...parts, kitPicture].find((p) => p.name === name)!;
      const images = [...part.src.matchAll(/<Image\b[\s\S]*?\/>/g)];
      expect(images.length, name).toBeGreaterThan(0);
      for (const [tag] of images) {
        expect(tag, name).toContain('display="fit"');
        expect(tag, name).toContain('rounded={false}');
        expect(tag, name).not.toContain('fit="cover"');
      }
    }
  });

  it.each(parts.map((p) => [p.name, p] as const))('part %s uses fundamentals, compounds, tier 0 and the editor model only (never another part, a layout or a server module that writes)', (_, p) => {
    const ok = (i: string) =>
      /^\.\.\/\.\.\/components\/(fundamentals|compounds)\/[A-Z]\w*\.astro$/.test(i) ||
      /^\.\.\/\.\.\/(design|scripts|styles)\/[\w./-]+$/.test(i) ||
      /^\.\.\/\.\.\/content\/(schema|load)$/.test(i) ||
      /^\.\.\/(model|scripts)\/[\w-]+$/.test(i) ||
      // edit mode's kit: the pieces several parts are made of (src/site/editor/kit)
      /^\.\.\/kit\/[A-Z]\w*\.astro$/.test(i) ||
      // labels and row types only: reading and writing content is the pages' job
      i === '../server/screens';
    expect(specs(p.src).filter((i) => !ok(i))).toEqual([]);
  });

  it.each(parts.map((p) => [p.name, p] as const))('part %s documents itself (a summary, @tier editor, @a11y)', (_, p) => {
    const doc = docComment(p.src);
    expect(doc, p.name).toBeTruthy();
    expect(p.src).toMatch(/@tier editor/);
    expect(p.src).toMatch(/@a11y /);
  });

  it('the pages compose the layout and parts, and carry no styles', () => {
    const pages = walk(join(EDITOR, 'pages'), /\.astro$/);
    expect(pages.length).toBeGreaterThanOrEqual(8);
    expect(pages.filter((f) => /<style/.test(read(f))).map(rel)).toEqual([]);
  });

  it('nothing outside the editor imports it: the site reaches edit mode only through the dev integration', () => {
    const outside = [...walk(join(ROOT, 'src'), /\.(astro|ts|tsx|mjs)$/)].filter((f) => !f.startsWith(EDITOR + sep));
    expect(outside.filter((f) => /from ['"][^'"]*\/editor\/|import ['"][^'"]*\/editor\//.test(read(f))).map(rel)).toEqual([]);
  });

  it("the launcher's shadow styles read tokens only, and its hover has a touch twin", async () => {
    const { LAUNCHER_CSS } = await import('../../src/site/editor/scripts/launcher');
    const values = [...LAUNCHER_CSS.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1].replace(/var\(--[\w-]+\)/g, '').replace(/calc\(|\)/g, ''));
    expect(values.filter((v) => /\d|#/.test(v))).toEqual([]);
    for (const m of LAUNCHER_CSS.matchAll(/var\((--[\w-]+)\)/g)) expect(TOKENS_CSS.includes(`${m[1]}:`), m[1]).toBe(true);
    expect(LAUNCHER_CSS).toMatch(/@media \(hover: hover\)/);
    expect(LAUNCHER_CSS).toMatch(/\.launch:active/);
    // its light-dark() colours follow the page's theme switch, not the system's
    expect(LAUNCHER_CSS).toMatch(/:host \{[^}]*all: initial;[^}]*color-scheme: inherit;/);
  });
});
