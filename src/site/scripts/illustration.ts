/**
 * An illustration: an SVG written for the site and drawn inline, so it takes the page's colours in light and
 * dark (tier 0; docs: documentation/content/model.md §6.1, documentation/site-ui/design-system.md §3). It
 * never holds a colour: its shapes name a colour role (`data-ink` fills, `data-line` strokes, `data-stop`
 * a gradient's stops), which the Illustration fundamental maps to the site's semantic colours; a part may
 * also say how it arrives (`data-motion`, `data-step` for its turn). Only the elements and attributes below
 * are allowed: no script, style, event handler, link, outside resource, image or foreign markup. Pure:
 * the content contract checks with it, and Illustration draws with it.
 */

/** The longest illustration, in characters: past this, it's a picture to export, not a drawing to write. */
export const ILLUSTRATION_MAX = 24_000;

/** The colour roles a shape can name, each a semantic colour of the site (shown in Illustration). */
export const ILLUSTRATION_INKS = ['text', 'muted', 'accent', 'accent-soft', 'on-accent', 'highlight', 'positive', 'positive-soft', 'negative', 'negative-soft', 'rule', 'rule-strong', 'page', 'raised', 'sunk'] as const;
export type IllustrationInk = (typeof ILLUSTRATION_INKS)[number];

/**
 * How a part arrives when the illustration comes into view (never under reduced motion): a line drawn
 * along its length (it needs `pathLength="1"`), a bar grown from its foot or its start, a part risen into
 * place, popped from nothing, or faded in.
 */
export const ILLUSTRATION_MOTIONS = ['draw', 'grow', 'grow-x', 'rise', 'pop', 'fade'] as const;
export type IllustrationMotion = (typeof ILLUSTRATION_MOTIONS)[number];

/** The most turns a part can wait (`data-step`, 0 to this): each a short beat after the one before. */
export const ILLUSTRATION_STEPS = 8;

const ELEMENTS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask']);
/** Where words may be written: everywhere else holds only elements and white space. */
const WORDED = new Set(['text', 'tspan', 'title', 'desc']);

const GEOMETRY = ['viewbox', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'dx', 'dy', 'width', 'height', 'd', 'points', 'pathlength', 'offset', 'preserveaspectratio'];
const SHAPING = ['transform', 'gradienttransform', 'gradientunits', 'spreadmethod', 'clippathunits', 'maskunits', 'maskcontentunits'];
const PRESENTATION = ['fill-rule', 'clip-rule', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'text-anchor', 'dominant-baseline', 'font-size', 'font-weight', 'letter-spacing', 'vector-effect', 'paint-order'];
const PLAIN = new Set([...GEOMETRY, ...PRESENTATION, 'gradientunits', 'spreadmethod', 'clippathunits', 'maskunits', 'maskcontentunits']);
/** Attributes whose values may hold brackets: a transform's functions, or a reference to a part (`url(#id)`). */
const BRACKETED = new Set(['transform', 'gradienttransform', 'fill', 'stroke', 'clip-path', 'mask']);
const REFERENCE = /^url\(#[A-Za-z][\w-]*\)$/;
const PAINT = /^(none|currentColor)$/;
const ID = /^[A-Za-z][\w-]*$/;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d{1,6}|#x[0-9a-fA-F]{1,6});)/;

const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
const ATTRIBUTE = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

interface Tag {
  close: boolean;
  name: string;
  attributes: [string, string][];
  selfClosing: boolean;
}

/** The SVG without its comments (a comment that never ends is left, and fails the check). */
const withoutComments = (svg: string) => svg.replace(/<!--[\s\S]*?-->/g, '');

/** Each attribute's name and value, in order. */
function attributesOf(source: string): [string, string][] {
  return [...source.matchAll(ATTRIBUTE)].map((m) => [m[1], m[2] ?? m[3] ?? '']);
}

/** Walks the SVG's tags and the words between them; stops at the first thing that isn't a tag it can read. */
function walk(svg: string, onTag: (t: Tag) => void, onText: (text: string) => void): string | undefined {
  let at = 0;
  while (at < svg.length) {
    const next = svg.indexOf('<', at);
    if (next < 0) {
      onText(svg.slice(at));
      return undefined;
    }
    if (next > at) onText(svg.slice(at, next));
    TAG.lastIndex = next;
    const m = TAG.exec(svg);
    if (!m) return svg.startsWith('<!', next) || svg.startsWith('<?', next) ? 'no declarations, CDATA or processing instructions: just the drawing' : `a tag isn't well formed near “${svg.slice(next, next + 24)}”: quote every attribute's value`;
    onTag({ close: m[1] === '/', name: m[2], attributes: attributesOf(m[3]), selfClosing: m[4] === '/' });
    at = TAG.lastIndex;
  }
  return undefined;
}

/** What's wrong with one attribute, if anything. */
function attributeProblem(element: string, name: string, value: string): string | undefined {
  const n = name.toLowerCase();
  if (/[<>`]/.test(value) || ENTITY.test(value) || /&/.test(value)) return `${name} on <${element}>: no <, >, \` or & in a value`;
  if (/javascript|expression|@import/i.test(value)) return `${name} on <${element}>: not a value an illustration takes`;
  if (value.includes('(') && !BRACKETED.has(n)) return `${name} on <${element}>: brackets only in a transform or a url(#part)`;
  if (n === 'id') return ID.test(value) ? undefined : `id “${value}”: a letter, then letters, digits, - or _`;
  if (n === 'xmlns') return value === SVG_NS ? undefined : `xmlns: only ${SVG_NS}`;
  if (n === 'fill' || n === 'stroke') return PAINT.test(value) || REFERENCE.test(value) ? undefined : `${name}="${value}" on <${element}>: name a colour role instead (data-${n === 'fill' ? 'ink' : 'line'}), or use none, currentColor or url(#part)`;
  if (n === 'clip-path' || n === 'mask') return REFERENCE.test(value) ? undefined : `${name} on <${element}>: url(#part) only`;
  if (n === 'data-ink' || n === 'data-line' || n === 'data-stop') return (ILLUSTRATION_INKS as readonly string[]).includes(value) ? undefined : `${name}="${value}": one of ${ILLUSTRATION_INKS.join(', ')}`;
  if (n === 'data-motion') return (ILLUSTRATION_MOTIONS as readonly string[]).includes(value) ? undefined : `data-motion="${value}": one of ${ILLUSTRATION_MOTIONS.join(', ')}`;
  if (n === 'data-step') return /^\d+$/.test(value) && Number(value) <= ILLUSTRATION_STEPS ? undefined : `data-step="${value}": a whole number from 0 to ${ILLUSTRATION_STEPS}`;
  if (n === 'transform' || n === 'gradienttransform') return /^[\s\w.,()-]*$/.test(value) ? undefined : `${name} on <${element}>: functions of numbers only`;
  if (PLAIN.has(n) || SHAPING.includes(n)) return undefined;
  if (/^on/i.test(n)) return `${name} on <${element}>: no event handlers`;
  if (/href$/i.test(n)) return `${name} on <${element}>: no links or outside resources`;
  return `${name} on <${element}>: not an attribute an illustration takes (colours are roles: data-ink, data-line, data-stop)`;
}

/**
 * What's wrong with an illustration, in words the person writing it can act on: empty when it's fine. One
 * `<svg>` with a `viewBox`, made only of the allowed elements and attributes, every tag closed, colours as
 * roles, and a drawn line measured as one (`pathLength="1"`).
 */
export function illustrationProblems(svg: string): string[] {
  const problems = new Set<string>();
  if (svg.length > ILLUSTRATION_MAX) problems.add(`at most ${ILLUSTRATION_MAX.toLocaleString('en-GB')} characters: simplify the drawing`);
  const source = withoutComments(svg).trim();
  if (source.includes('<!--')) problems.add('a comment never ends');
  const open: string[] = [];
  let roots = 0;
  let root: Tag | undefined;
  const stopped = walk(
    source,
    (t) => {
      const name = t.name.toLowerCase();
      if (!ELEMENTS.has(name)) {
        problems.add(`<${t.name}>: not an element an illustration takes (shapes, text, groups, gradients, clips and masks)`);
        return;
      }
      if (t.close) {
        if (open.pop() !== name) problems.add(`</${t.name}> closes a tag that isn't open`);
        return;
      }
      if (!open.length) {
        roots += 1;
        if (name === 'svg') root ??= t;
      }
      if (open.length && name === 'svg') problems.add('one <svg>, not one inside another');
      for (const [a, v] of t.attributes) {
        const p = attributeProblem(t.name, a, v);
        if (p) problems.add(p);
      }
      const motion = t.attributes.find(([a]) => a.toLowerCase() === 'data-motion')?.[1];
      if (motion === 'draw' && !t.attributes.some(([a, v]) => a.toLowerCase() === 'pathlength' && v === '1')) problems.add(`<${t.name} data-motion="draw">: give it pathLength="1", so it draws to its end`);
      if (motion && motion !== 'draw' && motion !== 'fade' && t.attributes.some(([a]) => a.toLowerCase() === 'transform')) problems.add(`<${t.name} data-motion="${motion}">: its motion replaces its own transform, so put the transform on a <g> around it`);
      if (!t.selfClosing) open.push(name);
    },
    (text) => {
      if (!text.trim()) return;
      if (!open.length || !WORDED.has(open[open.length - 1])) problems.add(`words outside <text>: “${text.trim().slice(0, 24)}”`);
      if (ENTITY.test(text)) problems.add('an & starts an entity (&amp;, &lt;, &gt;, &quot;, &apos; or a number)');
    },
  );
  if (stopped) problems.add(stopped);
  if (!root || roots !== 1 || !/^<svg[\s>]/i.test(source) || !/<\/svg>$/i.test(source)) problems.add('one <svg> element and nothing around it');
  if (open.length && !stopped) problems.add(`<${open[open.length - 1]}> is never closed`);
  const box = root?.attributes.find(([a]) => a.toLowerCase() === 'viewbox')?.[1];
  const sizes = box?.trim().split(/[\s,]+/).map(Number);
  if (root && (!sizes || sizes.length !== 4 || sizes.some((n) => !Number.isFinite(n)) || sizes[2] <= 0 || sizes[3] <= 0)) problems.add('the <svg> needs a viewBox (“0 0 240 120”): its shape, so it scales to its place');
  return [...problems];
}

/** An entity's character (the five XML names and numbers). */
const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, e: string) =>
    e === 'amp' ? '&' : e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'" : String.fromCodePoint(e.startsWith('#x') ? parseInt(e.slice(2), 16) : Number(e.slice(1))),
  );

export interface PreparedIllustration {
  /** The SVG to draw inline: its IDs made the page's own, its words for assistive tech taken out, and hidden from it. */
  markup: string;
  /** Its name for assistive tech, from its `<title>`: none, and it's decoration. */
  label?: string;
  /** Its shape (the viewBox's width over its height). */
  ratio: number;
  /** Some part of it arrives when it comes into view. */
  moves: boolean;
}

/**
 * An illustration ready to draw inline (call it only on one `illustrationProblems` passes): its IDs and
 * references prefixed with `prefix`, so two on a page never share one; its own size taken off, so it fills
 * its place; its `<title>` its name (the drawing itself hidden from assistive tech, which reads the name)
 * and its `<desc>` dropped.
 */
export function prepareIllustration(svg: string, prefix: string): PreparedIllustration {
  const source = withoutComments(svg).trim();
  const title = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(source)?.[1];
  const label = title ? decode(title).replace(/\s+/g, ' ').trim() || undefined : undefined;
  let markup = source
    .replace(/<(title|desc)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(title|desc)(?:\s[^>]*)?\/>/gi, '')
    .replace(/(\sid\s*=\s*)(["'])([A-Za-z][\w-]*)\2/g, (_, a: string, q: string, id: string) => `${a}${q}${prefix}-${id}${q}`)
    .replace(/url\(#([A-Za-z][\w-]*)\)/g, (_, id: string) => `url(#${prefix}-${id})`);
  markup = markup.replace(/^<svg\b([^>]*)>/i, (_, attrs: string) => `<svg${attrs.replace(/\s(width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')} aria-hidden="true" focusable="false">`);
  const box = /\sviewBox\s*=\s*["']([^"']+)["']/i.exec(source)?.[1].trim().split(/[\s,]+/).map(Number) ?? [0, 0, 1, 1];
  return { markup, ...(label ? { label } : {}), ratio: box[2] / box[3], moves: /\sdata-motion\s*=/.test(markup) };
}
