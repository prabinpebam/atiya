/**
 * Importing a font (documentation/site-ui/theming.md §5.2), the pure half: what a stylesheet's @font-face rules say,
 * which file to keep for each style (the Latin subset, as the site's own faces), and whether bytes are a WOFF2 font.
 * The dev server's half (server/fonts.ts) fetches and writes.
 */

export interface FaceRule {
  family: string;
  style: 'normal' | 'italic';
  /** `400`, or a variable font's range `100 900`. */
  weight: string;
  /** The WOFF2 file's address, absolute. */
  url: string;
  unicodeRange?: string;
}

/** At most this many bytes a file. */
export const MAX_FONT_BYTES = 1.5 * 1024 * 1024;

/** Is this address something we can import from (HTTPS, not this computer)? */
export function importable(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

/** A WOFF2 file starts with its signature, `wOF2`. */
export const isWoff2 = (b: Uint8Array): boolean => b.length > 48 && b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x32;

const unquote = (s: string) => s.trim().replace(/^['"]|['"]$/g, '').trim();

/** The @font-face rules of a stylesheet that have a WOFF2 source, their addresses made absolute. */
export function parseFontCss(css: string, from: string): FaceRule[] {
  const out: FaceRule[] = [];
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = block[1];
    const prop = (name: string) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(body)?.[1]?.trim();
    const family = unquote(prop('font-family') ?? '');
    const src = prop('src') ?? '';
    // the WOFF2 source: one marked format('woff2'), or a .woff2 address
    const sources = [...src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)\s*(?:format\(\s*['"]?([\w-]+)['"]?\s*\))?/g)];
    const woff2 = sources.find((s) => s[3] === 'woff2' || /\.woff2(\?|$)/i.test(s[2]));
    if (!family || !woff2) continue;
    let url: string;
    try {
      url = new URL(woff2[2], from).href;
    } catch {
      continue;
    }
    const style = /italic|oblique/i.test(prop('font-style') ?? '') ? 'italic' : 'normal';
    const weight = (prop('font-weight') ?? '400').replace(/\s+/g, ' ').replace(/^normal$/, '400').replace(/^bold$/, '700');
    out.push({ family, style, weight: /^\d{3}( \d{3})?$/.test(weight) ? weight : '400', url, ...(prop('unicode-range') ? { unicodeRange: prop('unicode-range') } : {}) });
  }
  return out;
}

/** Does a unicode-range cover basic Latin (A to Z)? No range covers everything. */
export function coversLatin(range?: string): boolean {
  if (!range) return true;
  return range.split(',').some((part) => {
    const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(part.trim());
    if (!m) return false;
    const lo = parseInt(m[1].replace(/\?/g, '0'), 16);
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'F'), 16);
    return lo <= 0x41 && hi >= 0x5a;
  });
}

/**
 * The faces to keep: one family (the first named), one file per style (its Latin subset, else its first), at most
 * normal and italic.
 */
export function pickFaces(rules: FaceRule[]): FaceRule[] {
  const family = rules[0]?.family;
  const out: FaceRule[] = [];
  for (const style of ['normal', 'italic'] as const) {
    const mine = rules.filter((r) => r.family === family && r.style === style);
    const pick = mine.find((r) => coversLatin(r.unicodeRange) && r.unicodeRange) ?? mine.find((r) => coversLatin(r.unicodeRange)) ?? mine[0];
    if (pick) out.push(pick);
  }
  return out;
}

/** A family's name from a font file's address (`Inter-Variable.woff2` → `Inter Variable`). */
export function familyFromFile(url: string): string {
  const name = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '').replace(/\.woff2$/i, '');
  return (
    name
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'Imported font'
  );
}

/** A font's ID from its family (`Playfair Display` → `playfair-display`). */
export const fontIdFor = (family: string): string =>
  family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '') || 'font';

/** A family's name kept to what a CSS family and the content contract take. */
export const cleanFamily = (f: string): string =>
  f
    .replace(/[^A-Za-z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

/** Google Fonts' own address: the licence is the SIL Open Font License for every family it serves. */
export const isGoogleFonts = (u: URL): boolean => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
