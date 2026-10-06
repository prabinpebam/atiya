/**
 * Sealing the build and the leak check (documentation/access/spec.md §5, §6; benchmark QB1, QB1a, QB1b):
 * the sealer, run on a small built site made here, seals a private page, its card and its picture, removes
 * every readable copy and writes keyrings only for grants that still work; what it sealed opens with the
 * fixtures' codes; and the leak check passes on it, then catches every kind of leak planted in a copy, without
 * ever printing the protected words.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealSite } from '../../integrations/seal.mjs';
import { fold, protectedTerms, publicCorpus, verifySealed, wordsToCheck } from '../../scripts/verify-sealed.mjs';
import { b64, deriveCodeKey, deriveLinkKey, open, utf8 } from '../../src/site/access/crypto';
import { cardAad, checkEnvelope, openKeyring, pageAad } from '../../src/site/access/keyring';

const FIXTURES = join(__dirname, '../fixtures/private-pages');
const NOW = new Date('2026-10-05T12:00:00+05:30');
const grants = JSON.parse(readFileSync(join(FIXTURES, 'access.json'), 'utf8')).grants as { id: string; name?: string; secret: { words?: string; key?: string; salt: string } }[];
const grant = (id: string) => grants.find((g) => g.id === id)!;

const ASSET = '/_astro/harbour.abc123.webp';
const TITLE = 'Fixture private alpha: the harbour lantern study';
const page = (title: string, body: string, head = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;

let root: string;
let dist: string;
let summaryFile: string;
let sealed: Awaited<ReturnType<typeof sealSite>>;
const logs: string[] = [];
const provenance = [
  { kind: 'page' as const, route: '/side-projects/alphaaaaa2/', access: 'private' as const, id: 'fx-private-alpha' },
  { kind: 'asset' as const, url: ASSET, master: '/private/media/articles/fx-private-alpha/harbour.webp' },
];

/** A small built site: an open home page, a section with a private card, the private page, its picture, and an emitted copy of a private master. */
function build(dir: string) {
  mkdirSync(join(dir, '_astro'), { recursive: true });
  mkdirSync(join(dir, 'side-projects', 'alphaaaaa2'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), page('Home — Site', '<a href="/side-projects/">Side projects</a>'));
  writeFileSync(
    join(dir, 'side-projects', 'index.html'),
    page('Side projects — Site', `<div data-cards><div class="item" data-node="atiya">An open card</div></div><div hidden data-sealed-cards><!--sealed:card:fx-private-alpha:atiya--><div class="item" data-node="fx-private-alpha"><img src="${ASSET}" alt="x"><a href="/side-projects/alphaaaaa2/">${TITLE}</a></div><!--/sealed:card--></div>`),
  );
  writeFileSync(
    join(dir, 'side-projects', 'alphaaaaa2', 'index.html'),
    page('Private page', `<main id="main"><div data-access-gate="private">Sign in</div><!--sealed:main:fx-private-alpha--><span hidden data-page-title>${TITLE}</span><h1>${TITLE}</h1><a href="${ASSET}" data-lightbox="g"><img src="${ASSET}" srcset="${ASSET} 480w" alt="Fixture picture: a harbour lantern glowing over still water at dusk."></a><!--/sealed:main--></main>`, '<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="same-origin">'),
  );
  writeFileSync(join(dir, ASSET), Buffer.from('a picture size made from the private master'));
  // an emitted copy of a private master itself, which no page names
  cpSync(join(FIXTURES, 'media/articles/fx-private-alpha/harbour.webp'), join(dir, '_astro', 'harbour.original.webp'));
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'sealed-'));
  dist = join(root, 'dist');
  summaryFile = join(root, 'sealed.json');
  build(dist);
  sealed = await sealSite({ dist, base: '', privateRoot: FIXTURES, now: NOW, provenance, summaryFile, log: (m: string) => logs.push(m) });
}, 60_000);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('the sealer', () => {
  it('seals the page and its card, and leaves no marker or readable copy', () => {
    const shell = readFileSync(join(dist, 'side-projects/alphaaaaa2/index.html'), 'utf8');
    expect(shell).toMatch(/<template data-sealed="main" data-kid="[\w-]+">[\w-]+<\/template>/);
    expect(shell).not.toMatch(/sealed:|Fixture|harbour/);
    expect(shell).toContain(`<meta name="site-build" content="${sealed.build}">`);
    const section = readFileSync(join(dist, 'side-projects/index.html'), 'utf8');
    expect(section).toMatch(/<template data-sealed="card" data-kid="[\w-]+">/);
    expect(section).not.toMatch(/Fixture|alphaaaaa2|fx-private/);
    expect(existsSync(join(dist, ASSET))).toBe(false);
    expect(existsSync(join(dist, '_astro/harbour.original.webp'))).toBe(false);
    expect(readdirSync(join(dist, '_sealed', sealed.build))).toHaveLength(1);
    expect(sealed).toMatchObject({ sealedPages: 1, sealedCards: 1, sealedFiles: 1, removed: 2 });
  });

  it('writes a keyring for each grant that still works, and none for an expired or withdrawn one', () => {
    const dir = join(dist, '_access', sealed.build);
    expect(readdirSync(join(dir, 'c')).sort()).toEqual(['harbor.json', 'lantern.json']);
    expect(readdirSync(join(dir, 'l'))).toEqual(['gfixlink2.json']);
    expect(sealed.keyrings).toBe(3);
  });

  it('what it sealed opens with the code, and only for the pages a grant covers', async () => {
    const one = grant('gfixone22');
    const env = checkEnvelope(JSON.parse(readFileSync(join(dist, '_access', sealed.build, 'c', 'lantern.json'), 'utf8')));
    const kek = await deriveCodeKey(one.secret.words!, b64.decode(one.secret.salt));
    const ring = await openKeyring(kek, 'c/lantern', env, NOW);
    expect(Object.keys(ring.keys)).toHaveLength(1);
    const shell = readFileSync(join(dist, 'side-projects/alphaaaaa2/index.html'), 'utf8');
    const [, kid, data] = /<template data-sealed="main" data-kid="([\w-]+)">([\w-]+)<\/template>/.exec(shell)!;
    const payload = JSON.parse(utf8.decode(await open(b64.decode(ring.keys[kid]), b64.decode(data), pageAad(sealed.build, kid))));
    expect(payload.html).toContain(TITLE);
    // the browser never fetches a sealed picture before it's decrypted
    expect(payload.html).toMatch(/data-sealed-src="\/_sealed\//);
    expect(payload.html).toMatch(/data-sealed-srcset="\/_sealed\//);
    expect(payload.html).not.toMatch(/\ssrc="\/_sealed/);
    expect(Object.values(payload.media)).toHaveLength(1);
    const section = readFileSync(join(dist, 'side-projects/index.html'), 'utf8');
    const [, ckid, cdata] = /<template data-sealed="card" data-kid="([\w-]+)">([\w-]+)<\/template>/.exec(section)!;
    const card = JSON.parse(utf8.decode(await open(b64.decode(ring.keys[ckid]), b64.decode(cdata), cardAad(sealed.build, ckid))));
    expect(card.after).toBe('atiya');
    // the link grant covers only a private page this site didn't build: its keyring opens, and holds nothing
    const link = grant('gfixlink2');
    const lenv = checkEnvelope(JSON.parse(readFileSync(join(dist, '_access', sealed.build, 'l', 'gfixlink2.json'), 'utf8')));
    const lring = await openKeyring(await deriveLinkKey(b64.decode(link.secret.key!), b64.decode(link.secret.salt)), 'l/gfixlink2', lenv, NOW);
    expect(lring.keys).toEqual({});
  });

  it('says only how many it sealed (QB1b)', () => {
    const said = fold(logs.join('\n'));
    for (const term of protectedTerms(FIXTURES).keys()) expect(said.includes(term), 'the log names something protected').toBe(false);
    expect(logs.join('\n')).toMatch(/^sealed 1 page, 1 card and 1 file; removed 2 readable files; wrote 3 keyrings$/);
  });
});

describe('the leak check', () => {
  it('passes on what the sealer made (QB1)', () => {
    expect(verifySealed({ dist, summary: sealed.summary, provenance })).toEqual([]);
  });

  /** Plants one leak in a fresh copy of the sealed site and returns what the check finds. */
  const planted = (plant: (dir: string) => void, extra: object[] = []) => {
    const copy = mkdtempSync(join(root, 'leak-'));
    cpSync(dist, copy, { recursive: true });
    plant(copy);
    return verifySealed({ dist: copy, summary: { ...sealed.summary, dist: copy }, provenance: [...provenance, ...extra] });
  };
  const append = (dir: string, file: string, text: string) => {
    const p = join(dir, file);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, (existsSync(p) ? readFileSync(p, 'utf8') : '') + text);
  };
  const categories = (f: { category: string }[]) => f.map((x) => x.category).join('\n');
  const master = (rel: string) => readFileSync(join(FIXTURES, 'media/articles', rel));

  const LEAKS: [string, (dir: string) => void, RegExp, object[]?][] = [
    ['a short title', (d) => append(d, 'index.html', '<p>Fixture private gamma: quiet orchard notes</p>'), /protected words: a title/],
    ['a heading in a script', (d) => append(d, '_astro/app.js', 'const h = "Fixture heading beta: what the families did";'), /protected words: a heading/],
    ['an attribute', (d) => append(d, 'index.html', '<img alt="Fixture picture: a harbour lantern glowing over still water at dusk.">'), /protected words: an alt text/],
    ['an HTML-encoded title', (d) => append(d, 'index.html', 'Fixture&#32;private&#32;delta:&#x20;copper bridge case study'), /protected words: a title/],
    ['a sentence in JSON', (d) => append(d, 'data.json', '{"t":"the velvet compass memo points north toward a small\\u002c careful launch"}'), /protected words: a sentence/],
    ['a picture size', (d) => writeFileSync(join(d, ASSET), 'back again'), /a file made from a private master is still readable/],
    ['a dark version', (d) => writeFileSync(join(d, '_astro/dark.webp'), master('fx-private-alpha/harbour.dark.webp')), /a private master is readable/],
    ['a poster', (d) => writeFileSync(join(d, '_astro/poster.webp'), master('fx-private-beta/tidepool.poster.webp')), /a private master is readable/],
    ['a video', (d) => (mkdirSync(join(d, 'media'), { recursive: true }), writeFileSync(join(d, 'media/clip.mp4'), master('fx-private-beta/tidepool.mp4'))), /a private master is readable/],
    ['an orphan private file', (d) => writeFileSync(join(d, '_astro/orphan.webp'), 'made from a private master, named by no page'), /a file made from a private master is still readable/, [{ kind: 'asset', url: '/_astro/orphan.webp', master: '/private/media/x.webp' }]],
    ['an open page linking to a token', (d) => append(d, 'index.html', '<a href="/side-projects/alphaaaaa2/">a way in</a>'), /an open page links to a protected page/],
    ['a shell without noindex', (d) => writeFileSync(join(d, 'side-projects/alphaaaaa2/index.html'), readFileSync(join(d, 'side-projects/alphaaaaa2/index.html'), 'utf8').replace(/<meta name="robots"[^>]*>/, '')), /not kept out of search/],
    ['a seal marker', (d) => append(d, 'index.html', '<!--sealed:main:x-->'), /a seal marker was left/],
    ['a real title on a shell', (d) => writeFileSync(join(d, 'side-projects/alphaaaaa2/index.html'), readFileSync(join(d, 'side-projects/alphaaaaa2/index.html'), 'utf8').replace('<title>Private page</title>', '<title>Work</title>')), /a sealed page has a real title/],
    ['a grant recipient', (d) => append(d, 'index.html', 'Fixture Reader Withdrawn'), /protected words: a recipient/],
    ['a token in a script', (d) => append(d, '_astro/app.js', 'go("deltaddd55")'), /protected words: a token/],
  ];

  it.each(LEAKS)('catches %s (QB1a)', (_, plant, expected, extra) => {
    const f = planted(plant, extra);
    expect(categories(f)).toMatch(expected);
    // and never says what it found (QB1b)
    const said = fold(JSON.stringify(f));
    for (const term of protectedTerms(FIXTURES).keys()) expect(said.includes(term), 'a finding names something protected').toBe(false);
  });

  it('fails a build the sealer never ran on', () => {
    expect(categories(verifySealed({ dist, summary: null as unknown as object, provenance: [] }))).toMatch(/not sealed/);
  });

  it('lets off words the public sources already hold (the open site says them anyway), but never a token or a grant ID', () => {
    const heading = 'Fixture heading beta: what the families did';
    const plant = (d: string) => (append(d, 'index.html', `<h2>${heading}</h2>`), append(d, '_astro/app.js', 'go("deltaddd55")'));
    const copy = mkdtempSync(join(root, 'leak-'));
    cpSync(dist, copy, { recursive: true });
    plant(copy);
    const check = (publicText: string) => categories(verifySealed({ dist: copy, summary: { ...sealed.summary, dist: copy }, provenance, publicText }));
    // private words alone: both found
    expect(check('')).toMatch(/protected words: a heading/);
    expect(check('')).toMatch(/protected words: a token/);
    // the heading in a public source: not a leak; the token still is
    const open = check(fold(`## ${heading}\nand a token deltaddd55 and a grant gfixall22 in a public file`));
    expect(open).not.toMatch(/a heading/);
    expect(open).toMatch(/protected words: a token/);
    const { kept, public: let_off } = wordsToCheck(protectedTerms(FIXTURES), fold(`${heading} deltaddd55 gfixall22`));
    expect(let_off.get('a heading')).toBe(1);
    expect([...kept.keys()]).toEqual(expect.arrayContaining(['deltaddd55', 'gfixall22']));
    // the real public sources hold none of the fixtures' words, so every planted leak above is still caught
    expect(wordsToCheck(protectedTerms(FIXTURES), publicCorpus()).public.size).toBe(0);
  });
});
