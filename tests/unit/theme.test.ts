/**
 * The theming system's pure model (documentation/site-ui/theming.md): colour maths, generated palettes held to
 * WCAG 2.2 AA, the type ramp's controls, spacing and corners, fonts with fallbacks, colours from a picture, and
 * the CSS a theme writes (nothing for the site's own).
 */
import { describe, expect, it } from 'vitest';
import { siteTokens } from '../../src/site/design/tokens';
import { themeBase } from '../../src/site/theme/base';
import { contrastOf, hexToLch, lchToHex, lchToRgb } from '../../src/site/theme/color';
import { resolveTheme, themeCss, themeProperties } from '../../src/site/theme/css';
import { extractColors, seedFromSwatches } from '../../src/site/theme/extract';
import { fontStack, type FontFile } from '../../src/site/theme/fonts';
import { COLOR_ROLES, PALETTES, PRESETS, TYPE_RANGE, TYPE_SCALES, copyTheme, isPreset, presetById, themeIdFor, type Theme, type TypeSettings } from '../../src/site/theme/model';
import { RULES, contrastIssues, fixContrast, themePalette } from '../../src/site/theme/palette';
import { MAX_GROWTH, radiusScale, spaceScale, typeRamp, typeWarnings } from '../../src/site/theme/ramp';

const base = themeBase(siteTokens());
const atiya = presetById('atiya')!;

describe('colour maths', () => {
  it('round-trips sRGB through OKLCH and measures WCAG contrast', () => {
    for (const hex of ['#3A3C9E', '#F4B942', '#FBFAF7', '#211E1A', '#2D6E45', '#000000', '#FFFFFF']) expect(lchToHex(hexToLch(hex))).toBe(hex);
    expect(contrastOf('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastOf('#3A3C9E', '#FBFAF7')).toBeGreaterThan(8);
  });

  it('maps a colour outside sRGB back inside by its chroma, keeping its hue and lightness', () => {
    const rgb = lchToRgb({ l: 0.6, c: 0.5, h: 140 });
    for (const v of rgb) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
    const back = hexToLch(lchToHex({ l: 0.6, c: 0.5, h: 140 }));
    expect(back.l).toBeCloseTo(0.6, 2);
    expect(Math.abs(back.h - 140)).toBeLessThan(2);
  });
});

describe('the base: the site’s own tokens', () => {
  it('reads every role a theme can set, in both modes, and the ramp, spaces and radii', () => {
    for (const r of COLOR_ROLES) {
      expect(base.roles.light[r], r).toMatch(/^#|^rgb/);
      expect(base.roles.dark[r], r).toMatch(/^#|^rgb/);
    }
    expect(base.refs.light.accent).toBe('p.color.indigo.700');
    expect(base.text.body.min).toBeLessThan(base.text.body.max);
    expect(base.text.sm).toEqual({ min: 0.875, max: 0.875 });
    expect(base.space.gutter.min).toBeLessThan(base.space.gutter.max);
    expect(base.radius.round).toBeGreaterThan(10);
    expect(base.more).toEqual({ 'text-muted': 'muted-strong', border: 'border-strong', rule: 'rule-strong' });
  });

  it('the site’s own palette passes every rule the themes are held to', () => {
    expect(contrastIssues(themePalette(base, {}))).toEqual([]);
  });
});

describe('the site’s own theme changes nothing', () => {
  it('writes no CSS, and leaves every value as the tokens have it', () => {
    const r = resolveTheme(atiya, base);
    expect(themeProperties(r, base)).toEqual([]);
    expect(themeCss(r, base, (f) => f)).toBe('');
    expect(r.palette.light.bg).toBe(base.roles.light.bg);
  });
});

describe('palettes: generated from one colour, always AA in both modes', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('preset %s has no contrast issue', (_, p) => {
    expect(resolveTheme(p, base).issues).toEqual([]);
  });

  it.each(PALETTES.map((p) => [p.id, p] as const))('palette %s has no contrast issue', (_, p) => {
    expect(contrastIssues(themePalette(base, p.seed ? { seed: p.seed } : {}))).toEqual([]);
  });

  it('any accent at all, light or dark, saturated or grey, gives a palette with no contrast issue', () => {
    const seen: string[] = [];
    for (let h = 0; h < 360; h += 20)
      for (const l of [0.25, 0.5, 0.75, 0.92])
        for (const c of [0, 0.06, 0.18]) {
          const accent = lchToHex({ l, c, h });
          for (const neutral of ['warm', 'neutral', 'cool', 'tinted'] as const) {
            const issues = contrastIssues(themePalette(base, { seed: { accent, neutral } }));
            if (issues.length) seen.push(`${accent} ${neutral}: ${issues.map((i) => `${i.mode} ${i.fg}/${i.on} ${i.ratio}`).join(', ')}`);
          }
        }
    expect(seen).toEqual([]);
  });

  it('keeps the chosen accent as it is when it already reads, and follows its hue', () => {
    const p = themePalette(base, { seed: { accent: '#2F6B4A' } });
    expect(p.light.accent).toBe('#2F6B4A');
    expect(Math.abs(hexToLch(p.dark.accent).h - hexToLch('#2F6B4A').h)).toBeLessThan(12);
    // the frosted handle follows the accent
    expect(p.light.frost).toMatch(/^rgb\(47 107 74 \/ 0\.26\)$/);
  });

  it('a too-light accent is darkened to read on the page, and says so', () => {
    const p = themePalette(base, { seed: { accent: '#9FD3FF' } });
    expect(contrastOf(p.light.accent, p.light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(p.adjusted).toContain('light:accent');
  });

  it('roles set by hand go on top, are checked, and Fix contrast makes them pass', () => {
    const colors = { seed: { accent: '#6E2E6B' }, light: { 'text-muted': '#BBBBBB' } };
    const p = themePalette(base, colors);
    expect(p.light['text-muted']).toBe('#BBBBBB');
    expect(contrastIssues(p).some((i) => i.fg === 'text-muted')).toBe(true);
    const fixed = fixContrast(base, colors);
    expect(contrastIssues(themePalette(base, fixed))).toEqual([]);
    expect(fixed.light?.['text-muted']).not.toBe('#BBBBBB');
  });

  it('the rules are the site’s own (every text role on every surface)', () => {
    const text = RULES.filter((r) => r.min === 4.5 && r.on.includes('bg-hover')).map((r) => r.fg);
    expect(text).toEqual(['text', 'text-muted', 'accent', 'accent-hover', 'positive', 'negative', 'highlight-ink']);
  });
});

describe('the type ramp', () => {
  const order = ['sm', 'md', 'body', 'h4', 'h3', 'h2', 'h1', 'display', 'jumbo'];
  const every = (): TypeSettings[] => {
    const out: TypeSettings[] = [];
    const r = (k: keyof TypeSettings) => Array.from({ length: TYPE_RANGE[k].max - TYPE_RANGE[k].min + 1 }, (_, i) => TYPE_RANGE[k].min + i);
    for (const size of r('size')) for (const largest of r('largest')) for (const smallest of r('smallest')) for (const contrast of r('contrast')) out.push({ size, largest, smallest, contrast });
    return out;
  };

  it('at rest is the site’s own ramp', () => {
    expect(typeRamp(base.text, { size: 0, largest: 0, smallest: 0, contrast: 0 })).toEqual(base.text);
  });

  it('every combination keeps the sizes in order, above the floors, and each fluid size grows at most 2.5×', () => {
    for (const s of every()) {
      const r = typeRamp(base.text, s);
      for (const end of ['min', 'max'] as const) for (let i = 1; i < order.length; i++) expect(r[order[i]][end], `${JSON.stringify(s)} ${order[i]} ${end}`).toBeGreaterThanOrEqual(r[order[i - 1]][end]);
      for (const [k, v] of Object.entries(r)) {
        expect(v.min, k).toBeGreaterThanOrEqual(0.75);
        expect(v.max / v.min, k).toBeLessThanOrEqual(MAX_GROWTH + 1e-9);
      }
      expect(r.body.min).toBeGreaterThanOrEqual(1);
    }
  });

  it('each control does what it says', () => {
    const at = (s: Partial<TypeSettings>) => typeRamp(base.text, s);
    expect(at({ size: 2 }).body.max).toBeCloseTo(base.text.body.max * 1.1, 3);
    expect(at({ largest: 2 }).jumbo.max).toBeCloseTo(base.text.jumbo.max * 1.2, 3);
    expect(at({ largest: 2 }).body).toEqual(base.text.body);
    expect(at({ smallest: 2 }).sm.min).toBeCloseTo(base.text.sm.min * 1.1, 3);
    expect(at({ smallest: 2 }).body).toEqual(base.text.body);
    expect(at({ contrast: 2 }).h1.max).toBeGreaterThan(base.text.h1.max);
    expect(at({ contrast: -2 }).h1.max).toBeLessThan(base.text.h1.max);
    // the step between sizes leaves small text to its own control
    expect(at({ contrast: 2 }).sm).toEqual(base.text.sm);
  });

  it('no preset theme or type scale makes text hard to read', () => {
    for (const p of PRESETS) expect(resolveTheme(p, base).warnings, p.id).toEqual([]);
    for (const s of TYPE_SCALES) expect(typeWarnings(typeRamp(base.text, s.settings)), s.id).toEqual([]);
  });

  it('the type scales are within range and distinct', () => {
    const keys = new Set(TYPE_SCALES.map((s) => JSON.stringify(s.settings)));
    expect(keys.size).toBe(TYPE_SCALES.length);
  });
});

describe('spacing and corners', () => {
  it('balanced is the site’s own; tight and loose move the layout more than the room inside components', () => {
    expect(spaceScale(base.space, 'balanced')).toEqual(base.space);
    const tight = spaceScale(base.space, 'tight');
    const loose = spaceScale(base.space, 'loose');
    expect(tight['4'].max).toBeLessThan(base.space['4'].max);
    expect(loose.section.max / base.space.section.max).toBeGreaterThan(loose['4'].max / base.space['4'].max);
  });

  it('sharp squares everything but circles; rounded rounds more but pills stay pills', () => {
    const sharp = radiusScale(base.radius, 'sharp');
    expect(Object.entries(sharp).filter(([k, v]) => k !== 'round' && v !== 0)).toEqual([]);
    expect(sharp.round).toBe(base.radius.round);
    const rounded = radiusScale(base.radius, 'rounded');
    expect(rounded.md).toBeCloseTo(base.radius.md * 1.5, 4);
    expect(rounded.pill).toBe(base.radius.pill);
    expect(radiusScale(base.radius, 'balanced')).toEqual(base.radius);
  });
});

describe('fonts: always a fallback', () => {
  const mono: FontFile = { id: 'jetbrains', family: 'JetBrains Mono', category: 'monospace', source: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono', faces: [{ style: 'normal', weight: '100 800', file: 'jetbrains-normal.woff2' }] };
  const serif: FontFile = { id: 'lora', family: 'Lora', category: 'serif', source: 'https://fonts.googleapis.com/css2?family=Lora', faces: [{ style: 'normal', weight: '400 700', file: 'lora-normal.woff2' }] };
  const fonts = new Map([
    ['jetbrains', mono],
    ['lora', serif],
  ]);

  it('a preset face is its own stack; an imported font comes first, then a face of its kind, then a generic family', () => {
    expect(fontStack('figtree', 'ui', fonts).stack).toMatch(/^'Figtree'.*sans-serif$/);
    expect(fontStack('font:lora', 'display', fonts).stack).toBe("'Lora', 'Fraunces', 'Iowan Old Style', Georgia, serif");
    expect(fontStack('font:lora', 'ui', fonts).stack).toBe("'Lora', 'Newsreader', Georgia, 'Times New Roman', serif");
    expect(fontStack('font:jetbrains', 'text', fonts).stack).toMatch(/^'JetBrains Mono', ui-monospace.*monospace$/);
  });

  it('a font that is gone leaves the role its own face', () => {
    expect(fontStack('font:missing', 'text', fonts)).toEqual({ stack: "'Newsreader', Georgia, 'Times New Roman', serif" });
  });

  it('a theme with an imported font writes its @font-face, swap and all, and the role’s stack', () => {
    const t: Theme = { ...atiya, id: 'mine', name: 'Mine', fonts: { ...atiya.fonts, display: 'font:lora' } };
    const css = themeCss(resolveTheme(t, base, fonts), base, (f) => `/fonts/${f}`);
    expect(css).toContain("font-family: 'Lora';");
    expect(css).toContain('font-display: swap;');
    expect(css).toContain("src: url('/fonts/lora-normal.woff2') format('woff2');");
    expect(css).toContain("--font-display: 'Lora', 'Fraunces'");
  });
});

describe('a theme’s CSS', () => {
  it('writes only what changed, over the tokens, and keeps the reader’s more-contrast swaps winning', () => {
    const studio = presetById('studio')!;
    const css = themeCss(resolveTheme(studio, base), base, (f) => f);
    expect(css).toMatch(/^:root:root \{/);
    expect(css).toContain('--radius-md: 0rem;');
    expect(css).toContain('--font-display: ');
    expect(css).toMatch(/--color-accent: light-dark\(#[0-9A-F]{6}, #[0-9A-F]{6}\);/);
    expect(css).toMatch(/@media \(prefers-contrast: more\) \{\s*:root:root \{[^}]*--color-text-muted: var\(--color-muted-strong\);/);
    expect(css).not.toMatch(/--radius-round/);
    // a fluid size stays fluid
    expect(css).toMatch(/--space-section: clamp\(/);
  });
});

describe('colours from a picture', () => {
  const picture = (parts: [number, number, number, number][]) => {
    const px: number[] = [];
    for (const [r, g, b, n] of parts) for (let i = 0; i < n; i++) px.push(r + (i % 5), g + (i % 3), b + (i % 4), 255);
    return px;
  };

  it('finds the picture’s colours, the most colourful plentiful one first, and the same every time', () => {
    const px = picture([
      [196, 72, 48, 500],
      [36, 96, 164, 300],
      [240, 236, 228, 1200],
      [30, 28, 26, 400],
    ]);
    const a = extractColors(px);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a[0].neutral).toBe(false);
    expect(hexToLch(a[0].hex).h).toBeLessThan(60);
    expect(extractColors(px)).toEqual(a);
    const seed = seedFromSwatches(a)!;
    expect(seed.accent).toBe(a[0].hex);
    expect(seed.highlight).toBeDefined();
    expect(contrastIssues(themePalette(base, { seed }))).toEqual([]);
  });

  it('a grey picture gives neutral greys, and a transparent one nothing', () => {
    expect(seedFromSwatches(extractColors(picture([[120, 120, 120, 400]])))?.neutral).toBe('neutral');
    expect(extractColors([0, 0, 0, 0, 255, 255, 255, 0])).toEqual([]);
  });
});

describe('themes: presets are read only, a copy is a person’s own', () => {
  it('names a copy, never with a preset’s ID or one taken', () => {
    expect(themeIdFor('Studio', [])).toBe('studio-2');
    expect(themeIdFor('Night Garden!', ['night-garden'])).toBe('night-garden-2');
    expect(themeIdFor('   ', [])).toBe('theme');
    const c = copyTheme(presetById('garden')!, 'My garden', []);
    expect(c).toMatchObject({ id: 'my-garden', name: 'My garden', basedOn: 'garden', corners: 'rounded' });
    expect(isPreset(c.id)).toBe(false);
  });
});
