#!/usr/bin/env node
/**
 * Builds the documentation's diagrams (the pages in DIAGRAMS below) from their readable sources in
 * assets-src/docs-diagrams/, into Slate's inline figure profile (slate-viewport-motion): presentation
 * attributes with the host's semantic colour roles (so they follow the docs' light and dark themes),
 * explicit polygon arrowheads, fit targets on every label, and a motion step per subject.
 *
 *   node scripts/build-doc-diagrams.mjs          write each diagram into its page's figure
 *   node scripts/build-doc-diagrams.mjs --check  fail if a page's figure is stale
 *
 * A source uses a small class vocabulary: groups (<g id>) of rects (box, src, later, derived, chip,
 * gate, docs, out) and texts (name, chip-name, note, code, line, out-name, out-note), loose label texts,
 * and arrows (<path class="arrow|dashed"> with M, H and V commands). The page names the figure with
 * <figure class="slate-figure" data-diagram="<name>">; its figcaption is kept.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DIAGRAMS = [
  { name: 'architecture', page: 'documentation/content/spec.md', prefix: 'cp-arch' },
  { name: 'model', page: 'documentation/content/model.md', prefix: 'cp-model' },
  { name: 'structures', page: 'documentation/content/ia.md', prefix: 'cp-structures' },
  { name: 'media', page: 'documentation/content/media.md', prefix: 'cp-media' },
  { name: 'separation', page: 'documentation/engineering/app-separation.md', prefix: 'eng-sep' },
];

const V = (n) => `var(--color-${n})`;
const SHAPES = {
  box: { fill: V('neutral-bg-2'), stroke: V('neutral-stroke-2'), 'stroke-width': '1.5' },
  src: { fill: V('neutral-bg-1'), stroke: V('neutral-stroke-1'), 'stroke-width': '1.5' },
  later: { fill: V('neutral-bg-1'), stroke: V('neutral-stroke-1'), 'stroke-width': '1.5', 'stroke-dasharray': '6 5' },
  derived: { fill: V('neutral-bg-1'), stroke: V('neutral-stroke-1'), 'stroke-width': '1.5', 'stroke-dasharray': '6 5' },
  chip: { fill: V('neutral-bg-1'), stroke: V('neutral-stroke-2'), 'stroke-width': '1.5' },
  gate: { fill: V('status-warning-bg'), stroke: V('status-warning-stroke'), 'stroke-width': '1.5' },
  docs: { fill: V('status-warning-bg'), stroke: V('status-warning-stroke'), 'stroke-width': '1.5' },
  out: { fill: V('brand-bg') },
};
const FONT = 'Segoe UI, system-ui, -apple-system, sans-serif';
const MONO = 'ui-monospace, Cascadia Code, Consolas, monospace';
const TEXTS = {
  name: { fill: V('neutral-fg-1'), 'font-size': '17', 'font-weight': '600' },
  'chip-name': { fill: V('neutral-fg-1'), 'font-size': '15', 'font-weight': '600' },
  note: { fill: V('neutral-fg-2'), 'font-size': '13' },
  line: { fill: V('neutral-fg-1'), 'font-size': '14' },
  code: { fill: V('neutral-fg-2'), 'font-size': '13', 'font-family': MONO },
  'out-name': { fill: V('on-brand'), 'font-size': '17', 'font-weight': '600' },
  'out-note': { fill: V('on-brand'), 'font-size': '13' },
  label: { fill: V('neutral-fg-2'), 'font-size': '12' },
};
// text on a highlighted (warning) surface takes that surface's own foreground
const ON_WARNING = V('status-warning-fg');
const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');

function convert(source, prefix) {
  const viewBox = /viewBox="([^"]+)"/.exec(source)[1];
  const title = /<title[^>]*>([^<]*)<\/title>/.exec(source)[1];
  const desc = /<desc[^>]*>([^<]*)<\/desc>/.exec(source)[1];
  const body = source.slice(source.indexOf('</desc>') + 7, source.lastIndexOf('</svg>'));
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('<!--'));
  const rects = [];
  const out = [];
  const arrows = [];
  let step = 0;
  let n = 0;
  for (const l of lines) {
    let m;
    if ((m = /^<g id="([\w-]+)">$/.exec(l))) {
      out.push(`<g id="${prefix}__${m[1]}" data-slate-svg-step="${++step}" data-slate-svg-effect="fade-rise">`);
    } else if (l === '</g>') {
      out.push('</g>');
    } else if ((m = /^<rect class="([\w-]+)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)" \/>$/.exec(l))) {
      const id = `${prefix}__body-${++n}`;
      rects.push({ id, cls: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5] });
      out.push(`<rect id="${id}" x="${m[2]}" y="${m[3]}" width="${m[4]}" height="${m[5]}" rx="${m[6]}" ${attrs(SHAPES[m[1]])} />`);
    } else if ((m = /^<text class="([\w-]+)" x="([\d.]+)" y="([\d.]+)">(.*)<\/text>$/.exec(l))) {
      out.push({ cls: m[1], x: +m[2], y: +m[3], text: m[4] });
    } else if ((m = /^<path class="(arrow|dashed)" d="([^"]+)" \/>$/.exec(l))) {
      arrows.push({ dashed: m[1] === 'dashed', d: m[2] });
    } else {
      throw new Error(`unhandled source line: ${l}`);
    }
  }
  // each label sits in the smallest box that holds it; that's its fit target and its surface
  const texts = out.map((o) => {
    if (typeof o === 'string') return o;
    const host = rects.filter((r) => o.x >= r.x && o.x <= r.x + r.w && o.y - 12 >= r.y && o.y <= r.y + r.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const style = { 'font-family': FONT, ...TEXTS[o.cls] };
    if (host && ['gate', 'docs'].includes(host.cls) && style.fill === V('neutral-fg-2')) style.fill = ON_WARNING;
    const fit = host ? ` data-slate-fit-target="${host.id}" data-slate-fit-padding="16"` : '';
    return `<text x="${o.x}" y="${o.y}" text-anchor="start" ${attrs(style)}${fit}>${o.text}</text>`;
  });
  // arrows: the line stops short of an explicit polygon head
  arrows.forEach(({ dashed, d }, i) => {
    const pts = [];
    let x = 0;
    let y = 0;
    for (const [, c, v] of d.matchAll(/([MHV])\s*([\d.]+(?:\s+[\d.]+)?)/g)) {
      const nums = v.split(/\s+/).map(Number);
      if (c === 'M') [x, y] = nums;
      else if (c === 'H') x = nums[0];
      else y = nums[0];
      pts.push([x, y]);
    }
    const [px, py] = pts[pts.length - 2];
    const [tx, ty] = pts[pts.length - 1];
    const dx = Math.sign(tx - px);
    const dy = Math.sign(ty - py);
    const tip = [tx + dx * 2, ty + dy * 2];
    const base = [tip[0] - dx * 9, tip[1] - dy * 9];
    const path = pts.slice(0, -1).concat([base]).map(([lx, ly], k) => `${k ? 'L' : 'M'}${lx} ${ly}`).join(' ');
    const wing = (s) => [base[0] + (dy ? s * 5 : 0), base[1] + (dx ? s * 5 : 0)];
    const head = [tip, wing(1), wing(-1)].map((p) => p.join(',')).join(' ');
    texts.push(`<g id="${prefix}__flow-${i + 1}" data-slate-svg-step="${++step}" data-slate-svg-effect="draw">`);
    texts.push(`<path d="${path}" fill="none" stroke="${V('neutral-fg-2')}" stroke-width="2"${dashed ? ' stroke-dasharray="6 5"' : ''} />`);
    texts.push(`<polygon points="${head}" fill="${V('neutral-fg-2')}" />`);
    texts.push('</g>');
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="${prefix}__title ${prefix}__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">`,
    `<title id="${prefix}__title">${title}</title>`,
    `<desc id="${prefix}__desc">${desc}</desc>`,
    ...texts,
    '</svg>',
  ].join('\n');
}

const check = process.argv.includes('--check');
let stale = 0;
for (const { name, page, prefix } of DIAGRAMS) {
  const svg = convert(readFileSync(`assets-src/docs-diagrams/${name}.svg`, 'utf8'), prefix);
  const raw = readFileSync(page, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const md = raw.replace(/\r\n/g, '\n');
  const re = new RegExp(`<figure class="slate-figure" data-diagram="${name}">\\n(?:<svg[\\s\\S]*?</svg>\\n)?(<figcaption>[\\s\\S]*?</figcaption>)\\n</figure>`);
  const m = re.exec(md);
  if (!m) throw new Error(`${page}: no figure for ${name}`);
  const next = md.replace(m[0], `<figure class="slate-figure" data-diagram="${name}">\n${svg}\n${m[1]}\n</figure>`);
  if (next === md) continue;
  if (check) {
    console.error(`${page}: the ${name} diagram is stale (run node scripts/build-doc-diagrams.mjs)`);
    stale++;
  } else {
    writeFileSync(page, next.replace(/\n/g, eol));
    console.log(`wrote ${name} into ${page}`);
  }
}
if (stale) process.exit(1);
