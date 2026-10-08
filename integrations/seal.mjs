// @ts-check
/**
 * The sealer (documentation/access/spec.md §5, §6.2): the last step of a build. It seals every private
 * page, every private card in a section's list and every file made from a private master, deletes
 * the readable copies, and writes a keyring for each grant that still works, all under one build ID. Its
 * log says only how many it sealed: a build's log is public.
 *
 * The crypto is the browser's own module (src/site/access/), loaded here through Node's type stripping.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateRootFor } from './roots.mjs';
import { readProvenance, resetProvenance } from '../src/site/content/provenance.ts';
import { b64, buildId, deriveCodeKey, deriveLinkKey, newKey, randomBytes, seal, utf8 } from '../src/site/access/crypto.ts';
import { cardAad, mediaAad, pageAad, sealKeyring } from '../src/site/access/keyring.ts';
import { readerOf } from '../src/site/access/agreement.ts';
import { covers, isValid, lookupOf } from '../src/site/access/grants.ts';

/** Where the sealer leaves what the leak check needs (scripts/verify-sealed.mjs). */
export const SEALED_SUMMARY = join(process.cwd(), 'node_modules', '.cache', 'site-protected', 'sealed.json');

const TYPES = /** @type {Record<string, string>} */ ({ webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm' });
const MAIN = /<!--sealed:main:([a-z0-9-]+)-->([\s\S]*?)<!--\/sealed:main-->/g;
const CARD = /<!--sealed:card:([a-z0-9-]+):([a-z0-9-]*)-->([\s\S]*?)<!--\/sealed:card-->/g;

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const sha256 = (/** @type {Buffer | Uint8Array} */ bytes) => createHash('sha256').update(bytes).digest('hex');
const nameOf = () => b64.encode(randomBytes(12));

/** Replaces every match of a global regex with an async function's result, in order. */
async function replaceAsync(/** @type {string} */ text, /** @type {RegExp} */ re, /** @type {(...m: string[]) => Promise<string>} */ fn) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index), await fn(...m));
    last = /** @type {number} */ (m.index) + m[0].length;
  }
  parts.push(text.slice(last));
  return parts.join('');
}

/**
 * Seals a built site in place.
 * @param {{ dist: string; base: string; privateRoot: string; now?: Date; log?: (msg: string) => void; provenance?: import('../src/site/content/provenance.ts').ProvenanceEntry[]; summaryFile?: string }} o
 */
export async function sealSite({ dist, base, privateRoot, now = new Date(), log = () => {}, provenance, summaryFile = SEALED_SUMMARY }) {
  const prov = provenance ?? readProvenance();
  const pages = /** @type {{ kind: 'page'; route: string; access: 'private'; id: string }[]} */ (prov.filter((e) => e.kind === 'page'));
  const assets = new Map(/** @type {{ kind: 'asset'; url: string; master: string }[]} */ (prov.filter((e) => e.kind === 'asset')).map((a) => [a.url, a.master]));
  const build = buildId();
  /** @type {Map<string, { kid: string; key: Uint8Array }>} */
  const keys = new Map();
  const keyOf = (/** @type {string} */ id) => {
    let k = keys.get(id);
    if (!k) keys.set(id, (k = { kid: b64.encode(randomBytes(9)), key: newKey() }));
    return k;
  };
  for (const p of pages) keyOf(p.id);
  /** @type {Map<string, { name: string; key: Uint8Array; type: string }>} */
  const sealedMedia = new Map();
  const removed = new Set();
  const fileOfUrl = (/** @type {string} */ url) => join(dist, ...url.slice(base.length).split('/').filter(Boolean));

  /** Seals one private-origin file (once, whichever page needs it first) and gives its sealed address. */
  const sealMedia = async (/** @type {string} */ url) => {
    let m = sealedMedia.get(url);
    if (m) return m;
    const file = fileOfUrl(url);
    if (!existsSync(file)) throw new Error('a sealed page refers to a private file the build did not make');
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    m = { name: nameOf(), key: newKey(), type: TYPES[ext] ?? 'application/octet-stream' };
    const sealedBytes = await seal(m.key, new Uint8Array(readFileSync(file)), mediaAad(build, m.name));
    const out = join(dist, '_sealed', build, `${m.name}.bin`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, sealedBytes);
    sealedMedia.set(url, m);
    return m;
  };

  /** A region's HTML with every private-origin file swapped for its sealed address, and the keys it needs. */
  const rewrite = async (/** @type {string} */ html) => {
    /** @type {Record<string, { key: string; type: string }>} */
    const media = {};
    for (const url of assets.keys()) {
      if (!html.includes(url)) continue;
      const m = await sealMedia(url);
      const to = `${base}/_sealed/${build}/${m.name}.bin`;
      html = html.split(url).join(to);
      media[m.name] = { key: b64.encode(m.key), type: m.type };
    }
    // the browser must never fetch a sealed file as a picture or a video: the runtime decrypts it first
    html = html.replace(/(\s)(src|srcset|poster)="([^"]*\/_sealed\/[^"]*)"/g, '$1data-sealed-$2="$3"');
    return { html, media };
  };

  let sealedPages = 0;
  let sealedCards = 0;
  const meta = `<meta name="site-build" content="${build}">`;
  for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
    let html = readFileSync(file, 'utf8');
    const original = html;
    if (html.includes('<!--sealed:')) {
      html = await replaceAsync(html, MAIN, async (_, id, inner) => {
        const k = keyOf(id);
        const r = await rewrite(inner);
        const payload = utf8.encode(JSON.stringify({ v: 1, html: r.html, media: r.media }));
        sealedPages++;
        return `<template data-sealed="main" data-kid="${k.kid}">${b64.encode(await seal(k.key, payload, pageAad(build, k.kid)))}</template>`;
      });
      html = await replaceAsync(html, CARD, async (_, id, after, inner) => {
        const k = keyOf(id);
        const r = await rewrite(inner);
        const payload = utf8.encode(JSON.stringify({ v: 1, html: r.html, after: after || null, media: r.media }));
        sealedCards++;
        return `<template data-sealed="card" data-kid="${k.kid}">${b64.encode(await seal(k.key, payload, cardAad(build, k.kid)))}</template>`;
      });
      if (html.includes('<!--sealed:')) throw new Error('a seal marker was left unmatched: the build is not sealed');
    }
    html = html.replace('</head>', `${meta}</head>`);
    if (html !== original) writeFileSync(file, html);
  }

  // every file made from a private master goes, sealed or not; so does any copy of a private master itself
  for (const url of assets.keys()) {
    const file = fileOfUrl(url);
    if (existsSync(file)) {
      rmSync(file);
      removed.add(url);
    }
  }
  const masterHashes = new Set();
  for (const f of walk(join(privateRoot, 'media'))) if (!f.endsWith('.json')) masterHashes.add(sha256(readFileSync(f)));
  for (const f of walk(dist)) {
    if (f.includes(`${sep}_sealed${sep}`) || statSync(f).size === 0) continue;
    if (masterHashes.has(sha256(readFileSync(f)))) {
      rmSync(f);
      removed.add(base + '/' + relative(dist, f).split(sep).join('/'));
    }
  }

  // a keyring for each grant that still works, holding the keys of the built pages it covers
  const accessFile = join(privateRoot, 'access.json');
  const overlayFile = join(privateRoot, 'structures', 'overlay.json');
  const grants = existsSync(accessFile) ? JSON.parse(readFileSync(accessFile, 'utf8')).grants ?? [] : [];
  const overlay = existsSync(overlayFile) ? JSON.parse(readFileSync(overlayFile, 'utf8')) : { sections: [] };
  const protectedPages = [
    ...(overlay.sections ?? []).flatMap((/** @type {any} */ s) => s.pages.map((/** @type {any} */ p) => ({ id: p.item.id, section: s.section, access: /** @type {const} */ ('private') }))),
  ];
  const built = new Set(pages.map((p) => p.id));
  let keyrings = 0;
  for (const g of grants) {
    if (!isValid(g, now)) continue;
    const salt = b64.decode(g.secret.salt);
    const kek = g.kind === 'code' ? await deriveCodeKey(g.secret.words, salt) : await deriveLinkKey(b64.decode(g.secret.key), salt);
    /** @type {Record<string, string>} */
    const body = {};
    for (const id of covers(g, protectedPages)) {
      const k = keys.get(id);
      if (k && built.has(id)) body[k.kid] = b64.encode(k.key);
    }
    const lookup = lookupOf(g);
    // who it's for and why, for the agreement the reader sees first (encrypted with the rest; never the notes)
    const reader = readerOf(g);
    const env = await sealKeyring(kek, lookup, { build, kdf: g.kind === 'code' ? 'pbkdf2-sha256' : 'hkdf-sha256', salt: g.secret.salt }, { v: 1, grant: g.id, ...(g.expiresAt ? { expiresAt: g.expiresAt } : {}), ...(reader ? { reader } : {}), keys: body });
    const out = join(dist, '_access', build, `${lookup}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(env));
    keyrings++;
  }

  const summary = { build, base, privateRoot, dist, pages: pages.map((p) => ({ route: p.route, id: p.id, access: p.access })), removed: [...removed], sealedMedia: [...sealedMedia.values()].map((m) => m.name) };
  mkdirSync(dirname(summaryFile), { recursive: true });
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  log(`sealed ${sealedPages} page${sealedPages === 1 ? '' : 's'}, ${sealedCards} card${sealedCards === 1 ? '' : 's'} and ${sealedMedia.size} file${sealedMedia.size === 1 ? '' : 's'}; removed ${removed.size} readable file${removed.size === 1 ? '' : 's'}; wrote ${keyrings} keyring${keyrings === 1 ? '' : 's'}`);
  return { build, sealedPages, sealedCards, sealedFiles: sealedMedia.size, removed: removed.size, keyrings, summary };
}

/** @returns {import('astro').AstroIntegration} */
export default function sealer() {
  let base = '';
  let privateRoot = '';
  return {
    name: 'site-seal',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        base = config.base.replace(/\/$/, '');
        if (command === 'build') privateRoot = privateRootFor(fileURLToPath(config.root), command);
      },
      'astro:build:start': () => resetProvenance(),
      'astro:build:done': async ({ dir, logger }) => {
        await sealSite({ dist: fileURLToPath(dir), base, privateRoot, log: (m) => logger.info(m) });
      },
    },
  };
}
