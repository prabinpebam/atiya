#!/usr/bin/env node
// @ts-check
/**
 * The leak check (documentation/access/spec.md §6.3): after the sealer, nothing readable from a private page
 * may be left anywhere in the build. Three layers:
 *
 *   1. provenance: every file made from a private master is gone, every protected page is sealed;
 *   2. structure: no seal marker left, every sealed shell neutral and kept out of search, no open page
 *      linking to a protected page, every sealed file from this build;
 *   3. words and bytes: every file, decoded and folded, holds no protected words or IDs, and no file is a
 *      private master or a file the sealer removed. Words the public repository's own sources already hold
 *      (content/, documentation/, src/) aren't counted: the open site says them anyway. Tokens and grant
 *      IDs always are.
 *
 * A finding names its category, the file and a count, never the protected words or bytes (a build's log is
 * public).
 *
 *   node scripts/verify-sealed.mjs [dist]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUMMARY = join(process.cwd(), 'node_modules', '.cache', 'site-protected', 'sealed.json');
const PROVENANCE = join(process.cwd(), 'node_modules', '.cache', 'site-protected', 'provenance.jsonl');
const TEXT = /\.(html?|js|mjs|css|json|xml|txt|md|svg|map|webmanifest)$/i;
/** The public repository's own sources the build's open text comes from: content, the docs, the site's code. */
const PUBLIC_SOURCES = ['content', 'documentation', 'src'];
const SOURCE = /\.(json|md|html?|astro|ts|tsx|mjs|js|css|txt)$/i;
/** Random secrets: never public by chance, so never let off because a public file happens to hold one. */
const SECRET = new Set(['a token', "a grant's ID"]);
const MIN_RUN = 12;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}
const sha256 = (/** @type {Buffer} */ b) => createHash('sha256').update(b).digest('hex');

/** Text as a reader (or a script) would see it: entities and JSON escapes decoded, whitespace collapsed, case folded. */
export function fold(/** @type {string} */ text) {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' })[/** @type {'amp'} */ (n)])
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Markdown as plain words: link targets, marks and code ticks dropped. */
const plain = (/** @type {string} */ md) => md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~#>]/g, '').replace(/\\(.)/g, '$1');

/**
 * Every protected word worth looking for: titles, summaries, headings, captions, alt texts, quotes, the
 * items of collections, link texts and every sentence-like run of 12 characters or more; IDs, slugs, tokens; grants' IDs,
 * recipients and purposes. Each term is folded.
 * @param {string} privateRoot
 */
export function protectedTerms(privateRoot) {
  /** @type {Map<string, string>} */
  const terms = new Map();
  const add = (/** @type {string} */ category, /** @type {unknown} */ value, min = 1) => {
    if (typeof value !== 'string') return;
    const f = fold(value).trim();
    if (f.length >= min) terms.set(f, category);
  };
  const runs = (/** @type {string} */ category, /** @type {string} */ text) => {
    add(category, text, MIN_RUN);
    for (const part of plain(text).split(/[.!?;:\n()"“”]+/)) add(category, part.trim(), MIN_RUN);
  };
  const json = (/** @type {string} */ f) => JSON.parse(readFileSync(f, 'utf8'));
  for (const f of walk(join(privateRoot, 'articles')).filter((p) => p.endsWith('.json'))) {
    const a = json(f);
    add('an ID or slug', a.id, 4);
    add('an ID or slug', a.slug, 4);
    for (const k of ['title', 'summary', 'navLabel']) add('a title or summary', a[k], 3);
    add('a title or summary', a.seo?.title, 3);
    add('a title or summary', a.seo?.description, 3);
    for (const b of a.body ?? []) {
      if (b.type === 'text') {
        runs('a sentence', b.markdown);
        for (const m of String(b.markdown).matchAll(/\[([^\]]+)\]\(/g)) add('a link text', m[1], 6);
      }
      if (b.type === 'heading') add('a heading', b.text, 3);
      if (b.type === 'quote') runs('a quote', b.text), add('a quote', b.cite, 6);
      if (b.type === 'collection') for (const i of b.items) add('an item', i.when, 6), add('an item', i.heading, 6), add('an item', i.subtext, 6), i.text && runs('an item', i.text);
      if (b.type === 'table') {
        for (const c of b.columns ?? []) add('a table cell', c, 6);
        for (const c of (b.rows ?? []).flat()) runs('a table cell', c), add('a table cell', plain(c).trim(), 6);
      }
      for (const k of ['caption', 'credit', 'title']) add('a caption', b[k], 6);
      for (const i of b.items ?? []) for (const k of ['caption', 'alt']) add('a caption', i[k], 6);
    }
  }
  for (const f of walk(join(privateRoot, 'media')).filter((p) => p.endsWith('.json'))) {
    const m = json(f);
    for (const k of ['alt', 'caption', 'credit', 'title']) add('an alt text or caption', m[k], 6);
  }
  const overlayFile = join(privateRoot, 'structures', 'overlay.json');
  if (existsSync(overlayFile)) {
    const o = json(overlayFile);
    for (const p of [...(o.sections ?? []).flatMap((/** @type {any} */ s) => s.pages)]) add('a token', p.token), add('an ID or slug', p.id, 4);
  }
  const accessFile = join(privateRoot, 'access.json');
  if (existsSync(accessFile)) {
    for (const g of json(accessFile).grants ?? []) {
      add("a grant's ID", g.id);
      add('a recipient', g.recipient?.name, 4);
      add('a recipient', g.recipient?.organisation, 4);
      add('a recipient', g.recipient?.email, 4);
      add("a grant's purpose", g.purpose, 6);
      add("a grant's notes", g.notes, 6);
    }
  }
  return terms;
}

/**
 * The public repository's own words, folded: every text file of its sources (content/, documentation/,
 * src/; never private-pages/). Words already there are public whatever a private page says, so the build
 * repeating them leaks nothing: a private article about a product the open résumé names, or a heading
 * another open page also uses.
 */
export function publicCorpus(root = process.cwd()) {
  const parts = [];
  for (const dir of PUBLIC_SOURCES) for (const f of walk(join(root, dir))) if (SOURCE.test(f) && statSync(f).size <= 5 * 1024 * 1024) parts.push(fold(readFileSync(f, 'utf8')));
  return parts.join('\u0001');
}

/**
 * The protected words worth looking for in a build: all but those the public sources already hold (random
 * secrets, a page's token and a grant's ID, always stay). The ones let off are returned too, so the check can
 * say how many, by category.
 * @param {Map<string, string>} terms
 * @param {string} publicText
 */
export function wordsToCheck(terms, publicText) {
  /** @type {Map<string, string>} */
  const kept = new Map();
  /** @type {Map<string, number>} */
  const public_ = new Map();
  for (const [term, category] of terms) {
    if (!SECRET.has(category) && publicText.includes(term)) public_.set(category, (public_.get(category) ?? 0) + 1);
    else kept.set(term, category);
  }
  return { kept, public: public_ };
}

/**
 * @param {{ dist: string; summary?: any; provenance?: any[]; publicText?: string }} o
 * @returns {{ category: string; file: string; count: number }[]}
 */
export function verifySealed({ dist, summary = readJson(SUMMARY), provenance = readLines(PROVENANCE), publicText = publicCorpus() }) {
  /** @type {Map<string, { category: string; file: string; count: number }>} */
  const found = new Map();
  /** @type {string[]} */
  const tokens = [];
  // a path never shows a protected page's token, and a private-origin file shows only its folder (its name is its master's)
  const label = (/** @type {string} */ file) => tokens.reduce((s, t) => s.split(t).join('…'), file);
  const folderOf = (/** @type {string} */ file) => file.replace(/\/[^/]*$/, '/…');
  const report = (/** @type {string} */ category, /** @type {string} */ file, count = 1) => {
    const key = `${category}\0${label(file)}`;
    const f = found.get(key);
    if (f) f.count += count;
    else found.set(key, { category, file: label(file), count });
  };
  if (!summary) {
    report('the sealer left no summary: the build was not sealed', 'dist');
    return [...found.values()];
  }
  const rel = (/** @type {string} */ f) => relative(dist, f).split(sep).join('/');
  const base = summary.base ?? '';
  const files = walk(dist);
  const html = files.filter((f) => f.endsWith('.html'));
  const pageRoutes = new Set((summary.pages ?? []).map((/** @type {any} */ p) => p.route));
  const privateRoot = summary.privateRoot;
  const overlayFile = privateRoot && join(privateRoot, 'structures', 'overlay.json');
  if (overlayFile && existsSync(overlayFile)) {
    const o = JSON.parse(readFileSync(overlayFile, 'utf8'));
    for (const p of [...(o.sections ?? []).flatMap((/** @type {any} */ s) => s.pages)]) tokens.push(p.token);
  }

  // 1. provenance
  for (const e of provenance) {
    if (e.kind === 'asset' && existsSync(join(dist, ...String(e.url).slice(base.length).split('/').filter(Boolean)))) report('a file made from a private master is still readable', folderOf(e.url.slice(base.length)));
    if (e.kind === 'page') {
      const file = join(dist, ...String(e.route).split('/').filter(Boolean), 'index.html');
      if (!existsSync(file)) report('a protected page is missing from the build', 'a protected page');
      else if (!readFileSync(file, 'utf8').includes('<template data-sealed="main"')) report('a protected page is not sealed', rel(file));
    }
  }

  // 2. structure
  for (const f of html) {
    const text = readFileSync(f, 'utf8');
    const route = '/' + rel(f).replace(/index\.html$/, '');
    if (text.includes('<!--sealed:') || text.includes('<!--/sealed:')) report('a seal marker was left', rel(f));
    if (text.includes('data-page-title')) report("a protected page's title holder is readable", rel(f));
    const build = /<meta name="site-build" content="([^"]+)">/.exec(text)?.[1];
    // every full page (the docs' fragments have no head of their own)
    if (/<\/head>/i.test(text) && build !== summary.build) report("a page doesn't carry this build's ID", rel(f));
    if (pageRoutes.has(route)) {
      const title = /<title>([^<]*)<\/title>/.exec(text)?.[1];
      if (title !== 'Private page') report('a sealed page has a real title', rel(f));
      if (!/<meta name="robots" content="noindex, nofollow">/.test(text)) report('a sealed page is not kept out of search', rel(f));
      if (/<meta name="description"/.test(text) || /property="og:/.test(text)) report('a sealed page has a description or social card', rel(f));
    } else {
      for (const t of tokens) if (text.includes(`/${t}/`)) report('an open page links to a protected page', rel(f));
    }
  }
  for (const top of ['_access', '_sealed']) {
    const dir = join(dist, top);
    if (existsSync(dir)) for (const d of readdirSync(dir)) if (d !== summary.build) report(`a ${top} folder from another build`, `${top}/…`);
  }

  // 3. words and bytes (words the public sources already hold aren't a private page's to leak)
  const terms = privateRoot ? wordsToCheck(protectedTerms(privateRoot), publicText).kept : new Map();
  const masters = new Set();
  if (privateRoot) for (const f of walk(join(privateRoot, 'media'))) if (!f.endsWith('.json')) masters.add(sha256(readFileSync(f)));
  for (const f of files) {
    const r = rel(f);
    if (r.startsWith('_sealed/') || r.startsWith('_access/')) continue;
    const bytes = readFileSync(f);
    if (masters.has(sha256(bytes))) report('a private master is readable', r);
    if (!TEXT.test(f) || statSync(f).size > 20 * 1024 * 1024) continue;
    const text = fold(bytes.toString('utf8'));
    for (const [term, category] of terms) if (text.includes(term)) report(`protected words: ${category}`, r);
  }
  for (const url of summary.removed ?? []) if (existsSync(join(dist, ...String(url).slice(base.length).split('/').filter(Boolean)))) report('a file the sealer removed is back', folderOf(String(url).slice(base.length)));
  return [...found.values()];
}

function readJson(/** @type {string} */ f) {
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}
function readLines(/** @type {string} */ f) {
  return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dist = join(process.cwd(), process.argv[2] ?? 'dist');
  const publicText = publicCorpus();
  const findings = verifySealed({ dist, publicText });
  // how many protected words the public sources already hold, by category (never the words)
  const privateRoot = readJson(SUMMARY)?.privateRoot;
  if (privateRoot) {
    const let_off = wordsToCheck(protectedTerms(privateRoot), publicText).public;
    if (let_off.size) console.log(`Not counted as leaks, as the public sources already hold them: ${[...let_off].map(([c, n]) => `${n} ${c}`).join(', ')}.`);
  }
  if (findings.length) {
    console.error(`The leak check found ${findings.length} problem${findings.length === 1 ? '' : 's'} (categories and files only; the words stay out of the log):`);
    for (const f of findings) console.error(`- ${f.category}: ${f.file}${f.count > 1 ? ` (${f.count})` : ''}`);
    process.exit(1);
  }
  console.log('The leak check passed: nothing readable from a private page is in the build.');
}
