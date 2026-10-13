/**
 * The incremental content snapshot (documentation/engineering/performance-report.md R8): a read parses
 * only the documents that changed, its digest is exactly a fresh read's, readers never share a change to
 * a document, another folder never sees this one's documents, and the store hands the snapshot it wrote to
 * the next reader at that generation.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentState, currentSnapshot, readSnapshot, snapshotAfter, snapshotCache } from '../../src/site/content/source';
import { loadContent } from '../../src/site/content/load';
import { commit, jsonBytes, versionOf } from '../../src/site/editor/server/store';

const ROOT = join(__dirname, '../..');
const SCRATCH = join(ROOT, 'node_modules', '.cache', 'unit-snapshot');
mkdirSync(SCRATCH, { recursive: true });
let dir: string;
let content: string;
let priv: string;
const put = (base: string, rel: string, value: unknown) => {
  const abs = join(base, ...rel.split('/'));
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, typeof value === 'string' ? value : jsonBytes(value));
  return abs;
};
const fresh = () => {
  snapshotCache.clear();
  return readSnapshot(content, priv);
};

beforeEach(() => {
  dir = mkdtempSync(join(SCRATCH, 's-'));
  content = join(dir, 'content');
  priv = join(dir, 'private-pages');
  put(content, 'site.json', { name: 'N' });
  put(content, 'articles/a.json', { id: 'a', title: 'A', body: [{ type: 'p', text: 'x' }] });
  put(content, 'articles/b.json', { id: 'b', title: 'B' });
  put(content, 'media/shared/p.webp', 'not really a picture');
  snapshotCache.clear();
});
afterEach(() => {
  snapshotCache.freeze(false);
  snapshotCache.clear();
  rmSync(dir, { recursive: true, force: true });
});
afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

describe('the incremental content snapshot', () => {
  it('parses a document again only when its size or time changes, with the digest of a fresh read', () => {
    const first = readSnapshot(content, priv);
    expect(snapshotCache.parsed).toBe(3);
    const again = readSnapshot(content, priv);
    expect(snapshotCache.parsed).toBe(3);
    expect(again.digest).toBe(first.digest);
    expect(again.docs).toEqual(first.docs);

    // one file changed: only it is parsed again
    put(content, 'articles/b.json', { id: 'b', title: 'B, changed' });
    const after = readSnapshot(content, priv);
    expect(snapshotCache.parsed).toBe(4);
    expect(after.docs['/content/articles/b.json']).toEqual({ id: 'b', title: 'B, changed' });
    expect(after.docs['/content/articles/a.json']).toBe(first.docs['/content/articles/a.json']);
    expect(after.digest).not.toBe(first.digest);
    const uncached = fresh();
    expect(after.digest).toBe(uncached.digest);
    expect(after.docs).toEqual(uncached.docs);
    expect([...after.masters]).toEqual([...uncached.masters]);
  });

  it('reads a change of time alone (same size) again', () => {
    const abs = put(content, 'articles/b.json', { id: 'b', title: 'B' });
    readSnapshot(content, priv);
    writeFileSync(abs, jsonBytes({ id: 'b', title: 'C' }));
    const t = statSync(abs).mtime;
    utimesSync(abs, t, new Date(t.getTime() + 5000));
    expect(readSnapshot(content, priv).docs['/content/articles/b.json']).toEqual({ id: 'b', title: 'C' });
  });

  it('keeps errors: a file that is not JSON, then fixed', () => {
    const abs = put(content, 'articles/c.json', '{ not json');
    expect(readSnapshot(content, priv).errors.some((e) => e.startsWith('content/articles/c.json: not valid JSON'))).toBe(true);
    expect(readSnapshot(content, priv).errors).toHaveLength(1);
    writeFileSync(abs, '{"id":"c","title":"Cee"}\n');
    expect(readSnapshot(content, priv).errors).toEqual([]);
  });

  it('gives every reader its own record, and a shared document that is frozen cannot be changed', () => {
    snapshotCache.freeze();
    const one = readSnapshot(content, priv);
    delete one.docs['/content/site.json'];
    one.docs['/content/x.json'] = {};
    const two = readSnapshot(content, priv);
    expect(two.docs['/content/site.json']).toEqual({ name: 'N' });
    expect('/content/x.json' in two.docs).toBe(false);
    const a = two.docs['/content/articles/a.json'] as { title: string; body: { text: string }[] };
    expect(() => {
      a.title = 'changed';
    }).toThrow(TypeError);
    expect(() => {
      a.body[0].text = 'changed';
    }).toThrow(TypeError);
    expect((readSnapshot(content, priv).docs['/content/articles/a.json'] as { title: string }).title).toBe('A');
  });

  it("never changes a document it validates (the real content, frozen)", () => {
    snapshotCache.clear();
    snapshotCache.freeze();
    const s = readSnapshot(join(ROOT, 'content'), join(ROOT, 'tests/fixtures/private-pages'));
    expect(() => loadContent(s.docs, s.masters, s.errors)).not.toThrow(TypeError);
  });

  it('keeps each folder to its own documents (by absolute path)', () => {
    const other = join(dir, 'other');
    put(other, 'site.json', { name: 'Other' });
    put(other, 'articles/a.json', { id: 'a', title: 'Other A' });
    expect(readSnapshot(content, priv).docs['/content/site.json']).toEqual({ name: 'N' });
    expect(readSnapshot(other, priv).docs['/content/site.json']).toEqual({ name: 'Other' });
    expect(readSnapshot(content, priv).docs['/content/articles/a.json']).toMatchObject({ title: 'A' });
  });

  it('works out the snapshot after a write exactly as a fresh read would', () => {
    const before = readSnapshot(content, priv);
    put(content, 'articles/b.json', { id: 'b', title: 'Bee' });
    put(content, 'articles/0.json', { id: '0', title: 'Zero' });
    put(content, 'media/shared/q.webp', 'another');
    rmSync(join(content, 'articles', 'a.json'));
    const after = snapshotAfter(before, [
      { key: '/content/articles/b.json', deleted: false, doc: { id: 'b', title: 'Bee' } },
      { key: '/content/articles/0.json', deleted: false, doc: { id: '0', title: 'Zero' } },
      { key: '/content/media/shared/q.webp', deleted: false },
      { key: '/content/articles/a.json', deleted: true },
    ])!;
    const uncached = fresh();
    expect(after.digest).toBe(uncached.digest);
    expect(Object.keys(after.docs)).toEqual(Object.keys(uncached.docs));
    expect(after.docs).toEqual(uncached.docs);
    expect([...after.masters]).toEqual([...uncached.masters]);
    expect(after.errors).toEqual(uncached.errors);
  });
});

describe('the store and the snapshot', () => {
  const seed = () => {
    rmSync(content, { recursive: true, force: true });
    put(content, 'site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en' });
    put(content, 'people/p.json', { id: 'p', name: 'P' });
    put(content, 'structures/site.json', { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [] } });
    snapshotCache.clear();
  };

  it('hands what it wrote to the next reader, without reading again', async () => {
    seed();
    readSnapshot(content, priv);
    const parsed = snapshotCache.parsed;
    const r = await commit({ changes: [{ key: '/content/people/q.json', bytes: jsonBytes({ id: 'q', name: 'Q' }) }], ifMatch: { '/content/people/q.json': null } }, { root: content, privateRoot: priv });
    expect(r.ok).toBe(true);
    const handed = currentSnapshot(content, priv);
    const uncached = fresh();
    expect(handed.digest).toBe(uncached.digest);
    expect(handed.docs).toEqual(uncached.docs);
    expect(handed.errors).toEqual(uncached.errors);
    // it is the store's (a file written behind its back, with no generation moved, isn't in it; the dev
    // integration's watcher moves the generation for any such change)
    put(content, 'people/z.json', { id: 'z', name: 'Z' });
    expect('/content/people/z.json' in currentSnapshot(content, priv).docs).toBe(false);
    contentState().generation++;
    expect('/content/people/z.json' in currentSnapshot(content, priv).docs).toBe(true);
    rmSync(join(content, 'people', 'z.json'));
    // and what the store parsed is kept: a read now parses nothing new
    snapshotCache.clear();
    readSnapshot(content, priv);
    const p0 = snapshotCache.parsed;
    await commit({ changes: [{ key: '/content/people/q.json', bytes: jsonBytes({ id: 'q', name: 'Queue' }) }], ifMatch: { '/content/people/q.json': versionOf(jsonBytes({ id: 'q', name: 'Q' })) } }, { root: content, privateRoot: priv });
    readSnapshot(content, priv);
    expect(snapshotCache.parsed).toBe(p0);
    expect(parsed).toBeGreaterThan(0);
  });

  it('reads the folders again when anything else moved the generation', async () => {
    seed();
    await commit({ changes: [{ key: '/content/people/q.json', bytes: jsonBytes({ id: 'q', name: 'Q' }) }], ifMatch: { '/content/people/q.json': null } }, { root: content, privateRoot: priv });
    put(content, 'people/r.json', { id: 'r', name: 'R' });
    contentState().generation++;
    expect(currentSnapshot(content, priv).docs['/content/people/r.json']).toEqual({ id: 'r', name: 'R' });
  });
});
