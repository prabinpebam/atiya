/**
 * Edit mode's access (documentation/access/spec.md §4.1, §8; benchmark QB10): the pure model (the overlay,
 * a section's full order, messages and links), the store's grant rules (none deleted, no ID reused, a
 * withdrawn grant left as it is), the public commit message, and the server's operations on a copy of both
 * folders: making and withdrawing grants, locking and opening a page in its place, a section's order.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { endOfDay, fillMessage, insertAfter, magicLink, openBefore, placeLocked, reorderSection, sectionOrder, unplaceProtected } from '../../src/site/editor/model/access';
import { suggestMessage } from '../../src/site/editor/model/names';
import { publicMessage } from '../../src/site/editor/server/git';
import type { Overlay, SiteStructure } from '../../src/site/content/schema';

const ROOT = join(__dirname, '../..');
const FIX = join(ROOT, 'tests/fixtures/private-pages');
const json = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
const titles = { article: (id: string) => ({ 'fx-locked-alpha': 'Fixture locked alpha: the harbour lantern study', khonjel: 'Khonjel' })[id], person: () => undefined };

describe('the access model', () => {
  const structure = json<SiteStructure>(join(ROOT, 'content/structures/site.json'));
  const overlay = json<Overlay>(join(FIX, 'structures/overlay.json'));

  it("a section's full order: the overlay's, then the rest", () => {
    const order = sectionOrder(structure, overlay, 'side-projects');
    expect(order.slice(0, 6).map((p) => `${p.id}:${p.access}`)).toEqual(['atiya:open', 'fx-locked-alpha:locked', 'watai:open', 'fx-locked-beta:locked', 'story:open', 'fx-locked-gamma:locked']);
    expect(openBefore(order, 'fx-locked-beta')).toBe('watai');
    expect(openBefore(order, 'atiya')).toBeNull();
  });

  it('a new order keeps both: the overlay whole, the public structure its open pages', () => {
    const order = sectionOrder(structure, overlay, 'side-projects').map((p) => p.id);
    const moved = [order[1], order[0], ...order.slice(2)];
    const r = reorderSection(structure, overlay, 'side-projects', moved);
    expect(r.overlay.sections[0].order?.slice(0, 2)).toEqual(['fx-locked-alpha', 'atiya']);
    const hub = r.structure.home.children!.find((c) => c.id === 'side-projects') as { children: { id: string }[] };
    expect(hub.children[0].id).toBe('atiya');
    expect(JSON.stringify(r.structure.menus)).toBe(JSON.stringify(structure.menus));
  });

  it('unplacing and placing a protected page', () => {
    const off = unplaceProtected(overlay, 'fx-locked-delta');
    expect(off.sections.map((s) => s.section)).toEqual(['side-projects']);
    const back = placeLocked(off, 'work', { id: 'fx-locked-delta', token: 'deltaddd55', item: { type: 'article', id: 'fx-locked-delta' } }, ['fx-locked-delta']);
    expect(back.sections.find((s) => s.section === 'work')?.pages.map((p) => p.id)).toEqual(['fx-locked-delta']);
    const priv = unplaceProtected(overlay, 'fx-private-one');
    expect(priv.private.map((p) => p.id)).toEqual(['fx-private-two']);
  });

  it('an opened page goes back after the open page it followed', () => {
    const s = insertAfter(structure, 'side-projects', { id: 'x', kind: 'item', item: { type: 'article', id: 'x' } }, 'watai');
    const hub = s.home.children!.find((c) => c.id === 'side-projects') as { children: { id: string }[] };
    expect(hub.children.map((c) => c.id).slice(0, 3)).toEqual(['atiya', 'watai', 'x']);
  });

  it('the message and the link', () => {
    expect(fillMessage('Hi {name}, open {link} with {code}, until {expires}.', { name: 'Jane Doe', code: 'a-b', link: 'https://x/', expires: '5 November 2026' })).toBe('Hi Jane, open https://x/ with a-b, until 5 November 2026.');
    expect(magicLink('https://prabinpebam.github.io/atiya/', '/p/privone222/', 'gfixlink2', 'K')).toBe('https://prabinpebam.github.io/atiya/p/privone222/#a=gfixlink2.K');
    expect(endOfDay('2026-11-05', new Date('2026-10-05T12:00:00+05:30'))).toMatch(/^2026-11-05T23:59:59[+-]\d{2}:\d{2}$/);
  });
});

describe('publishing: no private words in public history (QB10)', () => {
  const files = [
    { key: '/content/articles/khonjel.json', status: 'changed' as const },
    { key: '/private/articles/fx-locked-alpha.json', status: 'changed' as const },
  ];
  it('the suggestion is made from public changes only', () => {
    expect(suggestMessage(files, titles)).toBe('Content: Khonjel');
    expect(suggestMessage(files, titles)).not.toMatch(/Fixture|harbour/);
  });
  it('the public commit gets your words only when nothing private changed', () => {
    expect(publicMessage('Edit the harbour lantern study', [files[0]], titles)).toBe('Edit the harbour lantern study');
    expect(publicMessage('Edit the harbour lantern study', files, titles)).toBe('Content: Khonjel; Private pages: update');
    expect(publicMessage('Edit the harbour lantern study', [files[1]], titles)).toBe('Private pages: update');
  });
});

describe('the operations, on a copy of both folders', () => {
  let dir: string;
  const env = { CONTENT_ROOT: process.env.CONTENT_ROOT, PRIVATE_ROOT: process.env.PRIVATE_ROOT };
  type Access = typeof import('../../src/site/editor/server/access');
  let access: Access;
  let store: typeof import('../../src/site/editor/server/store');

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'editor-access-'));
    cpSync(join(ROOT, 'content'), join(dir, 'content'), { recursive: true });
    cpSync(FIX, join(dir, 'private'), { recursive: true });
    process.env.CONTENT_ROOT = join(dir, 'content');
    process.env.PRIVATE_ROOT = join(dir, 'private');
    access = await import('../../src/site/editor/server/access');
    store = await import('../../src/site/editor/server/store');
  });
  afterAll(() => {
    Object.assign(process.env, env);
    rmSync(dir, { recursive: true, force: true });
  });
  const grants = () => json<{ grants: { id: string; name?: string; kind: string; revokedAt?: string; scope: object; secret: { words?: string; key?: string } }[] }>(join(dir, 'private/access.json')).grants;

  it('makes an access code (a name and four words) and a magic link, each with its message', async () => {
    const c = await access.createGrant({ kind: 'code', recipient: { name: 'Jane Doe', organisation: 'Contoso' }, purpose: 'First screen', scope: { sections: ['side-projects'] }, expires: '2099-01-01' });
    expect(c.ok).toBe(true);
    expect(c.grant!.id).toMatch(/^g[a-z2-7]{8}$/);
    expect(c.grant!.secret.words!.split('-')).toHaveLength(4);
    expect(c.share!.message).toMatch(/^Hi Jane, /);
    expect(c.share!.message).toContain(`${c.grant!.name}-${c.grant!.secret.words}`);
    expect(c.share!.link).toBe('https://prabinpebam.github.io/atiya/sign-in/');
    const l = await access.createGrant({ kind: 'link', recipient: { name: 'Sam Lee' }, purpose: '', scope: { pages: ['fx-private-two'] }, expires: null });
    expect(l.ok).toBe(true);
    expect(l.share!.link).toMatch(/^https:\/\/prabinpebam\.github\.io\/atiya\/p\/privtwo333\/#a=g[a-z2-7]{8}\.[\w-]{43}$/);
    expect(grants().map((g) => g.id)).toContain(l.grant!.id);
  });

  it('refuses a code that would open a private page (V26)', async () => {
    const r = await access.createGrant({ kind: 'code', recipient: { name: 'X' }, purpose: '', scope: { pages: ['fx-private-one'] } });
    expect(r.ok).toBe(false);
  });

  it('withdraws a grant, and then leaves it as it is', async () => {
    const id = grants()[0].id;
    expect((await access.withdrawGrant(id)).ok).toBe(true);
    expect(grants()[0].revokedAt).toBeTruthy();
    expect((await access.rescopeGrant(id, { sections: ['work'] })).ok).toBe(false);
    expect((await access.extendGrant(id, '2099-01-01')).ok).toBe(false);
  });

  it('the store refuses a deleted grant, a reused ID and a changed withdrawn grant, whoever writes them (V30)', async () => {
    const key = '/private/access.json';
    const doc = store.readDoc<{ grants: { id: string; scope: object; notes?: string }[] }>(key)!;
    const write = (grantsNext: unknown[]) => store.commit({ changes: [{ key, bytes: store.jsonBytes({ grants: grantsNext }) }], ifMatch: { [key]: doc.version } });
    expect((await write(doc.value.grants.slice(1))).ok).toBe(false);
    expect((await write([...doc.value.grants, { ...doc.value.grants[0] }])).ok).toBe(false);
    const withdrawn = doc.value.grants.findIndex((g) => (g as { revokedAt?: string }).revokedAt);
    const changed = doc.value.grants.map((g, i) => (i === withdrawn ? { ...g, scope: { sections: ['work'] } } : g));
    expect((await write(changed)).ok).toBe(false);
    // its notes may change
    const noted = doc.value.grants.map((g, i) => (i === withdrawn ? { ...g, notes: 'Called back on Tuesday' } : g));
    expect((await write(noted)).ok).toBe(true);
  });

  it('locks an open page in its place, moving its file into private-pages/, and opens it back where it was', async () => {
    const before = access.accessView().sections.find((s) => s.id === 'side-projects')!.pages.map((p) => p.id);
    expect((await access.setPageAccess('watai', 'locked')).ok).toBe(true);
    expect(existsSync(join(dir, 'private/articles/watai.json'))).toBe(true);
    expect(existsSync(join(dir, 'content/articles/watai.json'))).toBe(false);
    const locked = access.accessView().sections.find((s) => s.id === 'side-projects')!.pages;
    expect(locked.map((p) => p.id)).toEqual(before);
    expect(locked.find((p) => p.id === 'watai')?.access).toBe('locked');
    expect((await access.setPageAccess('watai', 'open')).ok).toBe(true);
    expect(existsSync(join(dir, 'content/articles/watai.json'))).toBe(true);
    expect(access.accessView().sections.find((s) => s.id === 'side-projects')!.pages.map((p) => p.id)).toEqual(before);
  });

  it("orders a section's open and locked pages together, and changes a private page's address", async () => {
    const pages = access.accessView().sections.find((s) => s.id === 'side-projects')!.pages.map((p) => p.node);
    const next = [pages[1], pages[0], ...pages.slice(2)];
    expect((await access.setSectionOrder('side-projects', next)).ok).toBe(true);
    expect(access.accessView().sections.find((s) => s.id === 'side-projects')!.pages.map((p) => p.node)).toEqual(next);
    const was = access.accessView().private.find((p) => p.id === 'fx-private-two')!.path;
    expect((await access.changeAddress('fx-private-two')).ok).toBe(true);
    expect(access.accessView().private.find((p) => p.id === 'fx-private-two')!.path).not.toBe(was);
  });

  it('a new page can be locked or private from the start: written straight into private-pages/, never content/', async () => {
    const articles = await import('../../src/site/editor/server/articles');
    const locked = await articles.createArticle({ title: 'A locked case study', summary: 'For invited readers.', kind: 'note', section: 'work', access: 'locked' });
    expect(locked.ok).toBe(true);
    expect(existsSync(join(dir, 'private/articles', `${locked.id}.json`))).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${locked.id}.json`))).toBe(false);
    expect(access.accessView().sections.find((s) => s.id === 'work')!.pages.find((p) => p.id === locked.id)?.access).toBe('locked');
    const priv = await articles.createArticle({ title: 'A private note', summary: 'From a link.', kind: 'note', section: null, access: 'private' });
    expect(priv.ok).toBe(true);
    expect(access.accessView().private.some((p) => p.id === priv.id)).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${priv.id}.json`))).toBe(false);
    // a locked page needs its section
    expect((await articles.createArticle({ title: 'No section', summary: 'x', kind: 'note', section: null, access: 'locked' })).ok).toBe(false);
    // a copy keeps its access, and stays out of content/
    const copy = await articles.duplicateArticle(locked.id!);
    expect(copy.ok).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${copy.id}.json`))).toBe(false);
    expect(access.accessView().sections.find((s) => s.id === 'work')!.pages.find((p) => p.id === copy.id)?.access).toBe('locked');
    // a locked page moves to another section and stays locked; a private one becomes public in a section
    expect((await access.setPageAccess(locked.id!, 'locked', 'side-projects')).ok).toBe(true);
    expect(access.accessView().sections.find((s) => s.id === 'side-projects')!.pages.find((p) => p.id === locked.id)?.access).toBe('locked');
    expect(access.accessView().sections.find((s) => s.id === 'work')!.pages.some((p) => p.id === locked.id)).toBe(false);
    expect((await access.setPageAccess(priv.id!, 'open', 'writing')).ok).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${priv.id}.json`))).toBe(true);
  });
});
