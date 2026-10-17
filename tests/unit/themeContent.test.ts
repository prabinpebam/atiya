/**
 * Themes and fonts as content (documentation/site-ui/theming.md §3): the loader checks a person's themes, the fonts
 * they name, the fonts' files and the site's active theme.
 */
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent } from '../../src/site/content/load';

const base = {
  '/content/site.json': { name: 'N', description: 'D', owner: 'p', locale: 'en' },
  '/content/people/p.json': { id: 'p', name: 'P' },
  '/content/structures/site.json': { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: [] }] } },
};
const theme = {
  id: 'night',
  name: 'Night',
  basedOn: 'garden',
  spacing: 'loose',
  corners: 'rounded',
  fonts: { display: 'font:lora', text: 'newsreader', ui: 'figtree' },
  type: { size: 1, largest: 0, smallest: 0, contrast: 1 },
  colors: { seed: { accent: '#2F6B4A', neutral: 'warm' }, light: { mark: '#F6E7B8' } },
};
const font = { id: 'lora', family: 'Lora', category: 'serif', source: 'https://fonts.googleapis.com/css2?family=Lora', faces: [{ style: 'normal', weight: '400 700', file: 'lora-normal.woff2' }] };
const fontFiles = new Set(['/content/fonts/lora-normal.woff2']);

const problems = (docs: Record<string, unknown>, m: Set<string> = fontFiles) => {
  try {
    loadContent(docs, m);
    return [];
  } catch (e) {
    return (e as ContentError).problems;
  }
};

describe('themes and fonts as content', () => {
  it('a theme, its font and the site using it load', () => {
    const c = loadContent({ ...base, '/content/site.json': { ...base['/content/site.json'], theme: 'night' }, '/content/themes/night.json': theme, '/content/fonts/lora.json': font }, fontFiles);
    expect(c.themes.get('night')?.name).toBe('Night');
    expect(c.fonts.get('lora')?.family).toBe('Lora');
    expect(c.site.theme).toBe('night');
  });

  it('a preset can be the site’s theme without a file', () => {
    expect(problems({ ...base, '/content/site.json': { ...base['/content/site.json'], theme: 'studio' } }, new Set())).toEqual([]);
  });

  it('refuses a theme that takes a preset’s ID, names a font not imported, or a site theme that doesn’t exist', () => {
    expect(problems({ ...base, '/content/themes/studio.json': { ...theme, id: 'studio', fonts: { display: 'figtree', text: 'figtree', ui: 'figtree' } } }, new Set())).toEqual([expect.stringMatching(/preset's ID/)]);
    expect(problems({ ...base, '/content/themes/night.json': theme }, new Set())).toEqual([expect.stringMatching(/the font "lora" isn't imported/)]);
    expect(problems({ ...base, '/content/site.json': { ...base['/content/site.json'], theme: 'gone' } }, new Set())).toEqual([expect.stringMatching(/the theme "gone" is neither a preset nor in content\/themes/)]);
  });

  it('refuses controls out of range, a colour that isn’t #RRGGBB and an unknown role', () => {
    const bad = { ...theme, fonts: { display: 'figtree', text: 'figtree', ui: 'figtree' }, type: { ...theme.type, size: 9 }, colors: { light: { accent: 'red', ink: '#000000' } } };
    const p = problems({ ...base, '/content/themes/night.json': bad }, new Set());
    expect(p.some((x) => /type\.size/.test(x))).toBe(true);
    expect(p.some((x) => /colors\.light\.accent/.test(x))).toBe(true);
    expect(p.some((x) => /colors\.light/.test(x) && /ink|key/i.test(x))).toBe(true);
  });

  it('a font needs its files, and a file needs its font', () => {
    expect(problems({ ...base, '/content/fonts/lora.json': font }, new Set())).toEqual([expect.stringMatching(/content\/fonts\/lora-normal\.woff2 is missing/)]);
    expect(problems(base, new Set(['/content/fonts/stray.woff2']))).toEqual([expect.stringMatching(/a font file no font names/)]);
  });
});
