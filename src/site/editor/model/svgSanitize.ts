/**
 * A drawing's cleaning (gallery spec §4.1): an SVG the owner keeps as a vector is cleaned before it's saved,
 * and refused when it can't be. Pure and conservative: a small XML reader and an allow-list of the SVG
 * elements a drawing is made of. It removes scripts, event-handler attributes, `foreignObject`, comments,
 * metadata, editors' own data and anything it doesn't know; it refuses a reference to anything outside the
 * file (an `href` that isn't a `#` fragment, a `url()` that isn't one, a style `@import`), a `javascript:`
 * address, embedded raster pictures over 200 KB in total and a drawing over 200 KB; and it needs a
 * `viewBox`, or a `width` and a `height` to make one from. It says what it removed, so the owner knows.
 *
 * A drawing is drawn with `<img>`, which never runs a script anyway: the cleaning guards the file itself
 * (opened on its own, or downloaded).
 */

/** The largest drawing: past this, it's a picture to rasterize ("Turn it into a picture"). */
export const SVG_MAX_BYTES = 200 * 1024;
/** The most its embedded raster pictures (`data:` addresses) may weigh together, decoded. */
export const SVG_MAX_EMBEDDED_BYTES = 200 * 1024;

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const FILTERS = ['feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite', 'feconvolvematrix', 'fediffuselighting', 'fedisplacementmap', 'fedistantlight', 'fedropshadow', 'feflood', 'fefunca', 'fefuncb', 'fefuncg', 'fefuncr', 'fegaussianblur', 'feimage', 'femerge', 'femergenode', 'femorphology', 'feoffset', 'fepointlight', 'fespecularlighting', 'fespotlight', 'fetile', 'feturbulence'];
/** The elements a drawing is made of (lower case: SVG's own case is kept in what's written). */
const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'switch', 'view',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textpath',
  'lineargradient', 'radialgradient', 'stop', 'pattern', 'clippath', 'mask', 'marker', 'filter', ...FILTERS,
  'image', 'style',
  'animate', 'animatetransform', 'animatemotion', 'mpath', 'set',
]);
/** Elements whose own tag goes but whose drawing stays: a link does nothing in a picture. */
const UNWRAPPED = new Set(['a']);
/** Elements that may point at an embedded raster picture. */
const PICTURE_HOLDERS = new Set(['image', 'feimage']);
/** Elements that animate an attribute: never a link or a handler. */
const ANIMATIONS = new Set(['animate', 'animatetransform', 'animatemotion', 'set']);
/** Elements whose content is read raw, to their closing tag. */
const RAW = new Set(['script', 'style']);

/** The prefixed attributes a drawing keeps; every other prefix is an editor's own data. */
const PREFIXED = new Set(['xlink:href', 'xml:space', 'xml:lang', 'xmlns:xlink']);

const NAME = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;
const FRAGMENT = /^#[A-Za-z_][\w.:-]*$/;
const RASTER_DATA = /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,([A-Za-z0-9+/=\s]*)$/i;
const ENTITY = /&(?:(amp|lt|gt|quot|apos)|#(\d{1,7})|#x([0-9a-fA-F]{1,6}));/g;

export interface SvgSanitized {
  ok: true;
  /** The cleaned drawing, as UTF-8 text. */
  svg: string;
  /** Its size from its viewBox (the width and height it's written with). */
  width: number;
  height: number;
  /** What the cleaning took out, in words ("2 scripts", "event handlers"): empty when nothing. */
  removed: string[];
}
export interface SvgRefused {
  ok: false;
  /** Why it can't be kept as a drawing, and what to do. */
  error: string;
}
export type SvgResult = SvgSanitized | SvgRefused;

class Refusal extends Error {}
const refuse = (why: string): never => {
  throw new Refusal(why);
};

/** Text with its five XML names and numbered characters read; any other named entity is refused (a document type would have to define it). */
function decode(text: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/.test(text)) refuse('It uses a named character (an entity) it doesn\'t define. Save it again from your drawing app, or turn it into a picture.');
  return text.replace(ENTITY, (_, named: string | undefined, dec: string | undefined, hex: string | undefined) => {
    if (named) return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named as 'amp']!;
    const code = dec ? Number(dec) : parseInt(hex!, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');

/** A value with what browsers ignore in an address taken out (white space, control characters), lower case. */
const squashed = (v: string) => v.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
const isScriptAddress = (v: string) => /(?:java|vb)script:|livescript:|data:text\/html|data:application\//.test(squashed(v));

/** A collection of what was removed, counted. */
class Removed {
  private counts = new Map<string, number>();
  add(what: string) {
    this.counts.set(what, (this.counts.get(what) ?? 0) + 1);
  }
  words(): string[] {
    return [...this.counts].map(([what, n]) => (n > 1 ? `${what} (${n})` : what));
  }
}

/** Why an element is taken out, in words. */
function removedName(name: string): string {
  const n = name.toLowerCase();
  if (n === 'script') return 'scripts';
  if (n === 'foreignobject') return 'foreignObject (outside markup)';
  if (n === 'metadata') return 'metadata';
  if (n.includes(':')) return `editor data (<${name}>)`;
  return `<${name}> (not part of a drawing)`;
}

interface Budget {
  embedded: number;
}

/** Checks one address (an `href`, or a `url()`'s): a fragment, or an embedded raster where one's allowed. */
function checkAddress(raw: string, where: string, rasterAllowed: boolean, budget: Budget) {
  const v = raw.trim();
  if (isScriptAddress(v)) refuse(`It has a javascript: address (${where}). Remove it, or turn it into a picture.`);
  if (FRAGMENT.test(v)) return;
  const m = RASTER_DATA.exec(v);
  if (m && rasterAllowed) {
    const b64 = m[2].replace(/\s+/g, '');
    budget.embedded += Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
    if (budget.embedded > SVG_MAX_EMBEDDED_BYTES) refuse('Its embedded pictures weigh over 200 KB together. Turn it into a picture instead.');
    return;
  }
  if (/^data:image\/svg/i.test(v)) refuse(`It has a drawing inside it (${where}). Put it in the one file, or turn it into a picture.`);
  const shown = v.length > 60 ? `${v.slice(0, 57)}…` : v;
  refuse(`It uses something outside its own file (${where}: ${shown}). Put everything in the one file, or turn it into a picture.`);
}

/** Every `url(…)` in a value checked; returns the value. */
function checkUrls(value: string, where: string, budget: Budget) {
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
  for (const m of value.matchAll(re)) checkAddress(m[1] ?? m[2] ?? m[3] ?? '', where, true, budget);
  // an url( that the pattern couldn't read (unclosed, nested) is refused rather than guessed
  const opened = (value.match(/url\(/gi) ?? []).length;
  const read = [...value.matchAll(re)].length;
  if (opened !== read) refuse(`It has an address it can't read (${where}). Turn it into a picture.`);
}

/** A style sheet or a style attribute checked, comments out. */
function cleanCss(css: string, where: string, budget: Budget): string {
  let s = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (s.includes('/*')) refuse(`A comment in its style never ends (${where}). Save it again, or turn it into a picture.`);
  s = s.replace(/<!--|-->/g, '');
  if (s.includes('\\')) refuse(`Its style uses escaped characters (${where}), which could hide an outside address. Save it again without them, or turn it into a picture.`);
  if (/@import/i.test(s)) refuse(`Its style imports another style sheet (${where}). Put the styles in the file, or turn it into a picture.`);
  if (isScriptAddress(s)) refuse(`Its style has a javascript: address (${where}). Remove it, or turn it into a picture.`);
  if (/expression\s*\(|-moz-binding|\bbehavior\s*:/i.test(s)) refuse(`Its style runs code (${where}). Remove it, or turn it into a picture.`);
  if (/(?:^|[^\w-])(?:-webkit-)?(?:image-set|image|src|cross-fade)\s*\(/i.test(s)) refuse(`Its style names a picture without url() (${where}), which could be outside the file. Put the picture in the file, or turn it into a picture.`);
  if (/<\//.test(s) || s.includes(']]>')) refuse(`Its style holds markup (${where}). Save it again, or turn it into a picture.`);
  checkUrls(s, where, budget);
  return s;
}

interface Attr {
  name: string;
  value: string;
}

/** A start tag's attributes, read from its source; `null` when they aren't well formed. */
function readAttributes(source: string): Attr[] | null {
  const out: Attr[] = [];
  const re = /\s*([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
  let at = 0;
  while (at < source.length) {
    if (!source.slice(at).trim()) break;
    re.lastIndex = at;
    const m = re.exec(source);
    if (!m || re.lastIndex === at) return null;
    out.push({ name: m[1], value: decode(m[2] ?? m[3] ?? m[4] ?? '') });
    at = re.lastIndex;
  }
  return out;
}

/** A length in CSS pixels ("120", "120px", "3cm"); null for a percentage or nonsense. */
function pixels(v: string | undefined): number | null {
  if (v == null) return null;
  const m = /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'px').toLowerCase();
  const per: Record<string, number> = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
  const px = n * per[unit];
  return Number.isFinite(px) && px > 0 ? px : null;
}

const trimNumber = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Cleans an SVG to keep as a drawing. Refuses one over 200 KB (as uploaded), one that isn't well-formed
 * XML with a single `<svg>` at its root, and one it can't make safe; otherwise returns the cleaned
 * drawing, its size and what was removed.
 */
export function sanitizeSvg(input: string | Uint8Array): SvgResult {
  try {
    return clean(input);
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, error: e.message };
    throw e;
  }
}

function clean(input: string | Uint8Array): SvgSanitized {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input).length : input.length;
  let text: string;
  if (typeof input === 'string') text = input;
  else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return refuse('It isn\'t saved as UTF-8 text. Save it again from your drawing app, or turn it into a picture.');
    }
  }
  text = text.replace(/^\uFEFF/, '');
  // embedded pictures first: their own message says more than the size's
  const budget: Budget = { embedded: 0 };
  for (const m of text.matchAll(/data:image\/(?:png|jpeg|jpg|gif|webp|avif);base64,([A-Za-z0-9+/=\s]*)/gi)) {
    budget.embedded += Math.floor((m[1].replace(/\s+/g, '').length * 3) / 4);
  }
  if (budget.embedded > SVG_MAX_EMBEDDED_BYTES) refuse('Its embedded pictures weigh over 200 KB together. Turn it into a picture instead.');
  budget.embedded = 0;
  if (bytes > SVG_MAX_BYTES) refuse(`It's ${Math.round(bytes / 1024)} KB: a drawing can be up to 200 KB. Turn it into a picture instead.`);

  const removed = new Removed();
  const out: string[] = [];
  /** The open elements: their name, and whether they're kept (false: being skipped, with everything inside). */
  const open: { name: string; kept: boolean; written: boolean }[] = [];
  const skipping = () => open.some((e) => !e.kept);
  let roots = 0;
  let root: { name: string; attrs: Attr[]; at: number; selfClosing: boolean } | null = null;
  let usesXlink = false;
  let at = 0;

  while (at < text.length) {
    const lt = text.indexOf('<', at);
    const chunk = lt < 0 ? text.slice(at) : text.slice(at, lt);
    if (chunk) {
      if (!open.length) {
        if (chunk.trim()) refuse('It has words outside its <svg> element. Save it again from your drawing app, or turn it into a picture.');
      } else if (!skipping()) out.push(escapeText(decode(chunk)));
      else decode(chunk);
    }
    if (lt < 0) break;
    at = lt;

    if (text.startsWith('<!--', at)) {
      const end = text.indexOf('-->', at + 4);
      if (end < 0) refuse('A comment never ends. Save it again from your drawing app, or turn it into a picture.');
      removed.add('comments');
      at = end + 3;
      continue;
    }
    if (text.startsWith('<?', at)) {
      const end = text.indexOf('?>', at + 2);
      if (end < 0) refuse('A processing instruction never ends. Save it again, or turn it into a picture.');
      if (!/^<\?xml[\s?]/i.test(text.slice(at, at + 6))) removed.add('processing instructions');
      at = end + 2;
      continue;
    }
    if (text.startsWith('<![CDATA[', at)) {
      const end = text.indexOf(']]>', at + 9);
      if (end < 0) refuse('A CDATA section never ends. Save it again, or turn it into a picture.');
      if (open.length && !skipping()) out.push(escapeText(text.slice(at + 9, end)));
      at = end + 3;
      continue;
    }
    if (/^<!doctype/i.test(text.slice(at, at + 9))) {
      const end = text.indexOf('>', at);
      if (end < 0) refuse('Its document type never ends. Save it again, or turn it into a picture.');
      if (text.slice(at, end).includes('[')) refuse('It declares its own entities, which can hide outside files. Save it again from your drawing app, or turn it into a picture.');
      removed.add('the document type');
      at = end + 1;
      continue;
    }
    if (text.startsWith('<!', at)) refuse('It has a declaration a drawing doesn\'t need. Save it again, or turn it into a picture.');

    const close = /^<\/([^\s>]+)\s*>/.exec(text.slice(at, at + 256));
    if (close) {
      const top = open.pop();
      if (!top || top.name !== close[1]) refuse(`It isn't well formed: </${close[1]}> closes a tag that isn't open. Save it again, or turn it into a picture.`);
      if (top!.written) out.push(`</${top!.name}>`);
      at += close[0].length;
      continue;
    }

    // a start tag: find its end outside quotes
    let end = at + 1;
    let quote = '';
    for (; end < text.length; end += 1) {
      const c = text[end];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      else if (c === '<') refuse('It isn\'t well formed: a tag never ends. Save it again, or turn it into a picture.');
    }
    if (end >= text.length) refuse('It isn\'t well formed: a tag never ends. Save it again, or turn it into a picture.');
    const tag = /^<([^\s/>]+)([\s\S]*?)(\/?)$/.exec(text.slice(at, end));
    if (!tag || !NAME.test(tag[1])) refuse('It isn\'t well formed near a tag. Save it again, or turn it into a picture.');
    const name = tag![1];
    const lower = name.toLowerCase();
    const selfClosing = tag![3] === '/';
    const attrs = readAttributes(tag![2]);
    if (!attrs) refuse(`It isn't well formed: <${name}>'s attributes can't be read. Save it again, or turn it into a picture.`);
    at = end + 1;

    // script and style content is read raw, to its closing tag
    let rawText: string | null = null;
    if (RAW.has(lower) && !selfClosing) {
      const closeAt = text.toLowerCase().indexOf(`</${lower}`, at);
      if (closeAt < 0) refuse(`<${name}> is never closed. Save it again, or turn it into a picture.`);
      const closeEnd = text.indexOf('>', closeAt);
      if (closeEnd < 0) refuse(`<${name}> is never closed. Save it again, or turn it into a picture.`);
      rawText = text.slice(at, closeAt);
      at = closeEnd + 1;
    }

    if (!open.length) {
      roots += 1;
      if (roots > 1) refuse('It has more than one drawing at its root. Save it again, or turn it into a picture.');
      if (lower !== 'svg') refuse('It isn\'t an SVG drawing: its first element isn\'t <svg>.');
    }

    const parentSkipped = skipping();
    let kept = !parentSkipped && ELEMENTS.has(lower);
    let written = kept;
    if (!parentSkipped && UNWRAPPED.has(lower)) {
      kept = true;
      written = false;
      removed.add('links');
    }
    // an animation that would change a link or a handler goes, with everything inside
    if (kept && ANIMATIONS.has(lower)) {
      const target = attrs!.find((a) => a.name === 'attributeName')?.value ?? '';
      if (/href|^on|^style$/i.test(target.trim())) {
        kept = false;
        written = false;
        removed.add('animations that change links or handlers');
      }
    }
    if (!parentSkipped && !ELEMENTS.has(lower) && !UNWRAPPED.has(lower)) removed.add(removedName(name));

    if (written) {
      const where = `<${name}>`;
      const keptAttrs: Attr[] = [];
      for (const a of attrs!) {
        const n = a.name;
        const ln = n.toLowerCase();
        if (!NAME.test(n)) {
          removed.add('attributes it can\'t read');
          continue;
        }
        if (/^on/i.test(n)) {
          if (isScriptAddress(a.value)) refuse(`It has a javascript: address (${n} on ${where}). Remove it, or turn it into a picture.`);
          removed.add('event handlers');
          continue;
        }
        if (n.includes(':') && !PREFIXED.has(ln)) {
          if (ln.startsWith('xmlns:')) continue;
          removed.add('editor data (attributes)');
          continue;
        }
        if (ln === 'xmlns:xlink') continue; // written again below when it's needed
        if (ln === 'xmlns') {
          continue; // the root gets the SVG namespace below; no element names another
        }
        if (ln === 'href' || ln === 'xlink:href') {
          checkAddress(a.value, `${n} on ${where}`, PICTURE_HOLDERS.has(lower), budget);
          if (ln === 'xlink:href') usesXlink = true;
          keptAttrs.push(a);
          continue;
        }
        if (isScriptAddress(a.value)) refuse(`It has a javascript: address (${n} on ${where}). Remove it, or turn it into a picture.`);
        if (ln === 'style') {
          const css = cleanCss(a.value, `the style on ${where}`, budget);
          if (css.trim()) keptAttrs.push({ name: n, value: css });
          continue;
        }
        if (/^(src|action|formaction|xml:base)$/i.test(n)) {
          checkAddress(a.value, `${n} on ${where}`, false, budget);
          continue;
        }
        if (/url\(/i.test(a.value)) checkUrls(a.value, `${n} on ${where}`, budget);
        keptAttrs.push(a);
      }
      if (!open.length) root = { name, attrs: keptAttrs, at: out.length, selfClosing };
      out.push(`<${name}${keptAttrs.map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join('')}${selfClosing ? '/>' : '>'}`);
      if (rawText != null) {
        // only <style> is kept raw: a script never is
        const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(rawText);
        const css = cleanCss(cdata ? cdata[1] : rawText, 'its style sheet', budget);
        out.push(cdata || css.includes('<') ? `<![CDATA[${css}]]>` : css);
        if (!selfClosing) out.push(`</${name}>`);
      }
    }
    if (!selfClosing && rawText == null) open.push({ name, kept, written });
  }

  if (open.length) refuse(`It isn't well formed: <${open[open.length - 1].name}> is never closed. Save it again, or turn it into a picture.`);
  if (!root) refuse('It isn\'t an SVG drawing: there\'s no <svg> element.');

  // its size: the viewBox, else a width and a height to make one from
  const r = root!;
  const attr = (n: string) => r.attrs.find((a) => a.name.toLowerCase() === n.toLowerCase());
  const box = attr('viewBox')?.value.trim().split(/[\s,]+/).map(Number);
  const ownW = pixels(attr('width')?.value);
  const ownH = pixels(attr('height')?.value);
  const rootAttrs = r.attrs.filter((a) => !/^(viewbox|width|height)$/i.test(a.name));
  let boxW: number;
  let boxH: number;
  if (box && box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
    [boxW, boxH] = [box[2], box[3]];
    rootAttrs.unshift({ name: 'viewBox', value: box.map(trimNumber).join(' ') });
  } else {
    if (!ownW || !ownH) refuse('It has no viewBox, and no width and height to make one from. Give it a viewBox (“0 0 800 600”) in your drawing app, or turn it into a picture.');
    [boxW, boxH] = [ownW!, ownH!];
    rootAttrs.unshift({ name: 'viewBox', value: `0 0 ${trimNumber(boxW)} ${trimNumber(boxH)}` });
  }
  // its own size in pixels, so an <img> has one: the viewBox's when it gave none, or a percentage
  const [width, height] = ownW && ownH ? [ownW, ownH] : [boxW, boxH];
  rootAttrs.unshift({ name: 'height', value: trimNumber(height) });
  rootAttrs.unshift({ name: 'width', value: trimNumber(width) });
  if (usesXlink) rootAttrs.unshift({ name: 'xmlns:xlink', value: XLINK_NS });
  rootAttrs.unshift({ name: 'xmlns', value: SVG_NS });
  out[r.at] = `<${r.name}${rootAttrs.map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join('')}${r.selfClosing ? '/>' : '>'}`;

  const svg = out.join('').trim();
  return { ok: true, svg: `${svg}\n`, width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), removed: removed.words() };
}
