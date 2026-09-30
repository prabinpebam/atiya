/**
 * Edit mode's server rules (documentation/editor/spec.md §8): the request guard, and the store's
 * transactions against a throwaway content folder (versions, the contract, rollback, Windows retries).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { guard, FRAME_HEADERS } from '../../src/site/editor/model/guard';
import { commit, jsonBytes, pathOf, readDoc, versionOf } from '../../src/site/editor/server/store';
import { contentState } from '../../src/site/content/source';

const req = (o: { method?: string; ip?: string; headers?: Record<string, string> }) => {
  const headers: Record<string, string> = { host: 'localhost:4321', ...(o.headers ?? {}) };
  return { method: o.method ?? 'GET', url: new URL('http://localhost:4321/_edit/api/x'), clientAddress: 'ip' in o ? o.ip : '127.0.0.1', header: (n: string) => headers[n.toLowerCase()] ?? null };
};
const write = { 'x-editor': '1', origin: 'http://localhost:4321', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };

describe('the request guard', () => {
  it('lets loopback clients read, naming the local host', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(guard(req({ ip })).ok, ip).toBe(true);
    for (const host of ['localhost:4321', '127.0.0.1:4321', '[::1]:4321']) expect(guard(req({ headers: { host } })).ok, host).toBe(true);
  });

  it('refuses another machine, and a foreign host name (DNS rebinding)', () => {
    expect(guard(req({ ip: '192.168.1.20' })).ok).toBe(false);
    expect(guard(req({ ip: undefined as unknown as string })).ok).toBe(false);
    expect(guard(req({ headers: { host: 'evil.example:4321' } })).ok).toBe(false);
    expect(guard(req({ headers: { host: 'localhost.evil.example' } })).ok).toBe(false);
  });

  it('lets a write through only with the header, this exact origin, same-site and a JSON or multipart body', () => {
    expect(guard(req({ method: 'PUT', headers: write })).ok).toBe(true);
    expect(guard(req({ method: 'POST', headers: { ...write, 'content-type': 'multipart/form-data; boundary=x' } })).ok).toBe(true);
    const without = (name: string) => Object.fromEntries(Object.entries(write).filter(([k]) => k !== name));
    expect(guard(req({ method: 'PUT', headers: without('x-editor') })).ok).toBe(false);
    expect(guard(req({ method: 'PUT', headers: without('origin') })).ok).toBe(false);
    expect(guard(req({ method: 'PUT', headers: { ...write, origin: 'http://localhost:5173' } })).ok).toBe(false);
    expect(guard(req({ method: 'PUT', headers: { ...write, origin: 'http://evil.example' } })).ok).toBe(false);
    expect(guard(req({ method: 'PUT', headers: { ...write, 'sec-fetch-site': 'cross-site' } })).ok).toBe(false);
    expect(guard(req({ method: 'PUT', headers: { ...write, 'content-type': 'text/plain' } })).ok).toBe(false);
  });

  it('keeps every editor response out of other sites\u2019 frames', () => {
    expect(FRAME_HEADERS['Content-Security-Policy']).toBe("frame-ancestors 'self'");
    expect(FRAME_HEADERS['X-Frame-Options']).toBe('SAMEORIGIN');
  });
});

// ---------- the store ----------
let root: string;
const put = (key: string, value: unknown) => {
  const abs = join(root, ...key.replace(/^\/content\//, '').split('/'));
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, jsonBytes(value));
};
const version = (key: string) => versionOf(readFileSync(pathOf(key, root)!));
const article = (over: Record<string, unknown> = {}) => ({ id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body: [], ...over });
const STRUCTURE = { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', template: 'home', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] } };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'editor-store-'));
  put('/content/site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en' });
  put('/content/people/p.json', { id: 'p', name: 'P' });
  put('/content/structures/site.json', STRUCTURE);
  put('/content/articles/a.json', article());
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('the store', () => {
  const key = '/content/articles/a.json';

  it('writes a valid change, answers with its version, and moves the generation on', async () => {
    const before = contentState().generation;
    const next = article({ title: 'Better' });
    const r = await commit({ changes: [{ key, bytes: jsonBytes(next) }], ifMatch: { [key]: version(key) } }, { root });
    expect(r).toEqual({ ok: true, versions: { [key]: versionOf(jsonBytes(next)) } });
    expect(readDoc(key, root)?.value).toMatchObject({ title: 'Better' });
    expect(readFileSync(pathOf(key, root)!, 'utf8')).toMatch(/\n$/);
    expect(contentState().generation).toBe(before + 1);
    expect(readdirSync(join(root, 'articles')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('refuses what the contract refuses, naming the field, and writes nothing', async () => {
    const r = await commit({ changes: [{ key, bytes: jsonBytes(article({ summary: 'x'.repeat(200) })) }], ifMatch: { [key]: version(key) } }, { root });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.issues).toContainEqual(expect.objectContaining({ file: 'content/articles/a.json', path: 'summary' }));
    }
    expect(readDoc(key, root)?.value).toMatchObject({ summary: 'S' });
  });

  it('refuses a stale version (the file changed since it was opened) with 409', async () => {
    const stale = version(key);
    put(key, article({ title: 'Edited by hand' }));
    const r = await commit({ changes: [{ key, bytes: jsonBytes(article({ title: 'Mine' })) }], ifMatch: { [key]: stale } }, { root });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(readDoc(key, root)?.value).toMatchObject({ title: 'Edited by hand' });
  });

  it('refuses a change without a version, a path the model doesn\u2019t allow, and one outside the folder', async () => {
    expect(await commit({ changes: [{ key, bytes: jsonBytes(article()) }], ifMatch: {} }, { root })).toMatchObject({ ok: false, status: 422 });
    for (const bad of ['/content/../x.json', '/content/articles/A.json', '/content/articles/a.exe', '/etc/passwd']) {
      expect(pathOf(bad, root), bad).toBeNull();
      expect(await commit({ changes: [{ key: bad, bytes: jsonBytes({}) }], ifMatch: { [bad]: null } }, { root }), bad).toMatchObject({ ok: false, status: 422 });
    }
  });

  it('is one transaction: a failure on the second rename leaves every file as it was', async () => {
    const sKey = '/content/structures/site.json';
    const structure = { home: { ...STRUCTURE.home, children: [...STRUCTURE.home.children, { id: 'b', kind: 'item', item: { type: 'article', id: 'b' } }] } };
    const bKey = '/content/articles/b.json';
    let renames = 0;
    const r = await commit(
      { changes: [{ key: bKey, bytes: jsonBytes(article({ id: 'b', slug: 'b' })) }, { key: sKey, bytes: jsonBytes(structure) }], ifMatch: { [bKey]: null, [sKey]: version(sKey) } },
      {
        root,
        rename: (from, to) => {
          if (++renames === 2) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
          return (require('node:fs') as typeof import('node:fs')).renameSync(from, to);
        },
      },
    );
    expect(r).toMatchObject({ ok: false });
    expect(existsSync(pathOf(bKey, root)!)).toBe(false);
    expect(readDoc(sKey, root)?.value).toEqual(STRUCTURE);
    expect(readdirSync(join(root, 'articles')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('retries the brief locks Windows takes (EPERM, EBUSY) and then succeeds', async () => {
    let fails = 2;
    const r = await commit(
      { changes: [{ key, bytes: jsonBytes(article({ title: 'Locked a moment' })) }], ifMatch: { [key]: version(key) } },
      {
        root,
        rename: (from, to) => {
          if (fails-- > 0) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
          return (require('node:fs') as typeof import('node:fs')).renameSync(from, to);
        },
      },
    );
    expect(r.ok).toBe(true);
    expect(readDoc(key, root)?.value).toMatchObject({ title: 'Locked a moment' });
  });

  it('refuses only new problems: content already broken by hand can still be edited', async () => {
    put('/content/articles/broken.json', { id: 'broken' });
    const r = await commit({ changes: [{ key, bytes: jsonBytes(article({ title: 'Still savable' })) }], ifMatch: { [key]: version(key) } }, { root });
    expect(r.ok).toBe(true);
  });

  it('records its own writes, so the dev integration can tell them from edits made elsewhere', async () => {
    const next = jsonBytes(article({ title: 'Recorded' }));
    await commit({ changes: [{ key, bytes: next }], ifMatch: { [key]: version(key) } }, { root });
    expect([...contentState().writes.values()]).toContain(versionOf(next));
  });
});
