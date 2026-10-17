/**
 * Importing a font for a theme (documentation/site-ui/theming.md §5.2): the dev server fetches a stylesheet or a
 * WOFF2 file from an HTTPS address, keeps one Latin file per style, checks each is a WOFF2 font of a sane size, and
 * writes the font and its files into content/fonts/ through the store, so the site serves them itself.
 */
import type { FontFileDoc } from '../../content/schema';
import { FONT_CATEGORIES, type FontCategory } from '../../theme/fonts';
import { MAX_FONT_BYTES, cleanFamily, familyFromFile, fontIdFor, importable, isGoogleFonts, isWoff2, parseFontCss, pickFaces, type FaceRule } from '../../theme/fontImport';
import { commit, jsonBytes, readDoc, readFile, versionOf, type Result } from './store';

/** Google Fonts sends WOFF2 only to a browser that says it reads it. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const refuse = (message: string): Result & { message: string } => ({ ok: false, status: 422, issues: [{ file: 'content/fonts', message }], message });

async function fetchWithin(url: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { 'user-agent': UA, accept: 'text/css,font/woff2,*/*;q=0.5' }, redirect: 'follow', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function bytesOf(url: string): Promise<Uint8Array> {
  if (!importable(url)) throw new Error(`a font file has to come from an HTTPS address (${url})`);
  const res = await fetchWithin(url);
  if (!res.ok) throw new Error(`the font file answered ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_FONT_BYTES) throw new Error('a font file is over 1.5 MB: choose fewer styles or a subset');
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.length > MAX_FONT_BYTES) throw new Error('a font file is over 1.5 MB: choose fewer styles or a subset');
  if (!isWoff2(b)) throw new Error("the file isn't a WOFF2 font: use a stylesheet that offers WOFF2, or a .woff2 file");
  return b;
}

/** Imports the font at `raw` (a stylesheet or a .woff2 file); the result names the font's ID. */
export async function importFont(raw: string, category?: string): Promise<Result & { font?: FontFileDoc; message?: string }> {
  const url = importable(raw ?? '');
  if (!url) return refuse('Paste an HTTPS address: a Google Fonts link, a stylesheet with @font-face rules, or a .woff2 file.');
  let rules: FaceRule[];
  try {
    if (/\.woff2$/i.test(url.pathname)) rules = [{ family: familyFromFile(url.href), style: 'normal', weight: '400', url: url.href }];
    else {
      const res = await fetchWithin(url.href);
      if (!res.ok) return refuse(`The address answered ${res.status}: check it opens in a browser.`);
      const text = await res.text();
      rules = pickFaces(parseFontCss(text, res.url || url.href));
      if (!rules.length) return refuse('No WOFF2 font was found at that address. Paste a Google Fonts link or a stylesheet with @font-face rules.');
    }
  } catch (e) {
    return refuse(`The font couldn't be fetched (${e instanceof Error ? e.message : String(e)}). Check the address and your connection.`);
  }
  const family = cleanFamily(rules[0].family);
  if (!family) return refuse("The font's family name can't be used: it needs letters or digits.");
  const id = fontIdFor(family);
  const files: { key: string; bytes: Buffer }[] = [];
  const faces: FontFileDoc['faces'] = [];
  try {
    for (const r of rules) {
      const file = `${id}-${r.style}.woff2`;
      files.push({ key: `/content/fonts/${file}`, bytes: Buffer.from(await bytesOf(r.url)) });
      faces.push({ style: r.style, weight: r.weight, file });
    }
  } catch (e) {
    return refuse(`${e instanceof Error ? e.message : String(e)}.`);
  }
  const font: FontFileDoc = {
    id,
    family,
    category: (FONT_CATEGORIES as readonly string[]).includes(category ?? '') ? (category as FontCategory) : 'sans-serif',
    source: url.href,
    ...(isGoogleFonts(url) ? { licence: 'SIL Open Font License (Google Fonts)' } : {}),
    faces,
  };
  const key = `/content/fonts/${id}.json`;
  const old = readDoc<FontFileDoc>(key);
  // importing it again replaces it: its old files that this import doesn't write go
  const gone = (old?.value.faces ?? []).map((f) => `/content/fonts/${f.file}`).filter((k) => !files.some((f) => f.key === k));
  const r = await commit({
    changes: [...files, ...gone.map((k) => ({ key: k, bytes: null })), { key, bytes: jsonBytes(font) }],
    // every file at the version it has now (a new one: none)
    ifMatch: { ...Object.fromEntries([...files.map((f) => f.key), ...gone].map((k) => [k, versionOf(readFile(k))])), [key]: old?.version ?? null },
  });
  return r.ok ? { ...r, font } : r;
}
