/**
 * Edit mode's access (documentation/access/spec.md §4.1, §8; benchmark QB10): the pure model (the overlay,
 * a section's full order, pages moved with open and private ones together, messages and links, and the
 * Access screen's groups, dates and lines), the store's grant rules (a grant may be deleted, no ID reused,
 * a withdrawn grant left as it is), the public commit message, and the server's operations on a copy of
 * both folders: making, changing, withdrawing and deleting grants, making a page private and public again
 * in its place, moving and ordering a section's pages, and what a page's Share dialog lists.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dateLine,
  daysAfter,
  endDateIssue,
  endOfDay,
  fillMessage,
  findText,
  grantGroups,
  insertAfter,
  listWords,
  magicLink,
  movePages,
  openBefore,
  placePrivate,
  privateNode,
  reorderSection,
  scopeGroups,
  scopeLine,
  sectionOrder,
  unplacePrivate,
  type ListedGrant,
} from '../../src/site/editor/model/access';
import { suggestMessage } from '../../src/site/editor/model/names';
import { publicMessage } from '../../src/site/editor/server/git';
import type { HubNode, Overlay, SiteStructure } from '../../src/site/content/schema';

const ROOT = join(__dirname, '../..');
const FIX = join(ROOT, 'tests/fixtures/private-pages');
const json = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
const titles = { article: (id: string) => ({ 'fx-private-alpha': 'Fixture private alpha: the harbour lantern study', khonjel: 'Khonjel' })[id], person: () => undefined };
const hubKids = (s: SiteStructure, id: string) => ((s.home.children ?? []).find((c) => c.id === id) as HubNode).children?.map((c) => c.id) ?? [];

describe('the access model', () => {
  const structure = json<SiteStructure>(join(ROOT, 'content/structures/site.json'));
  const overlay = json<Overlay>(join(FIX, 'structures/overlay.json'));

  it("a section's full order: the overlay's, then the rest", () => {
    const order = sectionOrder(structure, overlay, 'side-projects');
    expect(order.slice(0, 6).map((p) => `${p.id}:${p.access}`)).toEqual(['atiya:open', 'fx-private-alpha:private', 'watai:open', 'fx-private-beta:private', 'story:open', 'fx-private-gamma:private']);
    expect(openBefore(order, 'fx-private-beta')).toBe('watai');
    expect(openBefore(order, 'atiya')).toBeNull();
  });

  it('a new order keeps both: the overlay whole, the public structure its open pages', () => {
    const order = sectionOrder(structure, overlay, 'side-projects').map((p) => p.id);
    const moved = [order[1], order[0], ...order.slice(2)];
    const r = reorderSection(structure, overlay, 'side-projects', moved);
    expect(r.overlay.sections[0].order?.slice(0, 2)).toEqual(['fx-private-alpha', 'atiya']);
    expect(hubKids(r.structure, 'side-projects')[0]).toBe('atiya');
    expect(JSON.stringify(r.structure.menus)).toBe(JSON.stringify(structure.menus));
  });

  it('a private page is always in a section: unplacing, placing and finding one', () => {
    expect(privateNode(overlay, 'fx-private-one')).toMatchObject({ section: 'writing', node: { token: 'privone222' } });
    expect(privateNode(overlay, 'khonjel')).toBeUndefined();
    const off = unplacePrivate(overlay, 'fx-private-delta');
    expect(off.sections.map((s) => s.section)).toEqual(['side-projects', 'writing']);
    const back = placePrivate(off, 'work', { id: 'fx-private-delta', token: 'deltaddd55', item: { type: 'article', id: 'fx-private-delta' } }, ['fx-private-delta']);
    expect(back.sections.find((s) => s.section === 'work')?.pages.map((p) => p.id)).toEqual(['fx-private-delta']);
  });

  it('moves open and private pages together, keeping their nodes and tokens', () => {
    const r = movePages(structure, overlay, ['fx-private-alpha', 'khonjel'], 'work', 0, (id) => id);
    if (typeof r === 'string') throw new Error(r);
    const work = sectionOrder(r.structure, r.overlay, 'work').map((p) => `${p.id}:${p.access}`);
    expect(work.slice(0, 3)).toEqual(['fx-private-alpha:private', 'khonjel:open', ...work.slice(2, 3)]);
    expect(privateNode(r.overlay, 'fx-private-alpha')).toMatchObject({ section: 'work', node: { token: 'alphaaaaa2' } });
    expect(hubKids(r.structure, 'work')[0]).toBe('khonjel');
    expect(hubKids(r.structure, 'side-projects')).not.toContain('khonjel');
    expect(r.overlay.sections.find((s) => s.section === 'side-projects')?.order).not.toContain('fx-private-alpha');
    expect(JSON.stringify(r.structure.menus)).toBe(JSON.stringify(structure.menus));
    // within a section: a private page moves among open ones
    const within = movePages(structure, overlay, ['fx-private-gamma'], 'side-projects', 0, (id) => id);
    if (typeof within === 'string') throw new Error(within);
    expect(sectionOrder(within.structure, within.overlay, 'side-projects')[0].id).toBe('fx-private-gamma');
    // a private page can't leave the site; an open one can
    expect(movePages(structure, overlay, ['fx-private-alpha'], '_off', undefined, (id) => id)).toMatch(/always in a section/);
    const off = movePages(structure, overlay, ['khonjel'], '_off', undefined, (id) => id);
    expect(typeof off === 'string' ? off : hubKids(off.structure, 'side-projects')).not.toContain('khonjel');
  });

  it('a page made public goes back after the open page it followed', () => {
    const s = insertAfter(structure, 'side-projects', { id: 'x', kind: 'item', item: { type: 'article', id: 'x' } }, 'watai');
    expect(hubKids(s, 'side-projects').slice(0, 3)).toEqual(['atiya', 'watai', 'x']);
  });

  it('the message and the link', () => {
    expect(fillMessage('Hi {name}, open {link} with {code}, until {expires}.', { name: 'Jane Doe', code: 'a-b', link: 'https://x/', expires: '5 November 2026' })).toBe('Hi Jane, open https://x/ with a-b, until 5 November 2026.');
    expect(magicLink('https://prabinpebam.github.io/atiya/', '/writing/privone222/', 'gfixlink2', 'K')).toBe('https://prabinpebam.github.io/atiya/writing/privone222/#a=gfixlink2.K');
    expect(endOfDay('2026-11-05', new Date('2026-10-05T12:00:00+05:30'))).toMatch(/^2026-11-05T23:59:59[+-]\d{2}:\d{2}$/);
  });
});

describe("the Access screen's words", () => {
  const listed = (o: Partial<ListedGrant>): ListedGrant =>
    ({ id: 'gaaaaaaaa', kind: 'code', name: 'harbor', recipient: { name: 'Jane Doe' }, purpose: '', scope: {}, createdAt: '2026-10-01T09:00:00+05:30', secret: { salt: 'x' }, state: 'active', opens: [], ...o }) as ListedGrant;

  it('groups by state, what needs you first, newest first in each; empty groups left out', () => {
    const groups = grantGroups([
      listed({ id: 'a', state: 'active', createdAt: '2026-10-01T09:00:00+05:30' }),
      listed({ id: 'b', state: 'withdrawn' }),
      listed({ id: 'c', state: 'active', createdAt: '2026-10-03T09:00:00+05:30' }),
      listed({ id: 'd', state: 'expiring' }),
    ]);
    expect(groups.map((g) => `${g.label}: ${g.grants.map((x) => x.id).join(',')}`)).toEqual(['Ends soon: d', 'Active: c,a', 'Withdrawn: b']);
  });

  it("says a grant's dates by its state", () => {
    expect(dateLine({ state: 'active' })).toBe('No end date');
    expect(dateLine({ state: 'active', expiresAt: '2026-11-05T23:59:59+05:30' })).toBe('Until 5 Nov 2026');
    expect(dateLine({ state: 'expiring', expiresAt: '2026-10-07T23:59:59+05:30' })).toBe('Ends 7 Oct 2026');
    expect(dateLine({ state: 'expired', expiresAt: '2026-10-02T23:59:59+05:30' })).toBe('Expired 2 Oct 2026');
    expect(dateLine({ state: 'withdrawn', expiresAt: '2026-11-05T23:59:59+05:30', revokedAt: '2026-10-03T10:00:00+05:30' })).toBe('Withdrawn 3 Oct 2026');
  });

  it('says what a grant opens in one line, counting past a few', () => {
    expect(listWords(['A', 'B', 'C'])).toBe('A, B and C');
    expect(scopeLine([], [])).toMatch(/^Opens nothing yet/);
    expect(scopeLine(['Work'], [])).toBe('Opens every private page in Work');
    expect(scopeLine(['Work', 'Writing'], ['Lantern'])).toBe('Opens every private page in Work and Writing, and Lantern');
    expect(scopeLine(['A', 'B', 'C', 'D'], ['p', 'q', 'r'])).toBe('Opens every private page in 4 sections, and 3 single pages');
  });

  it('every section with its private pages; what a grant names that has gone comes last', () => {
    const view = {
      sections: [
        { id: 'work', title: 'Work' },
        { id: 'notes', title: 'Notes' },
      ],
      pages: [{ id: 'p1', title: 'P1', section: 'Work', sectionId: 'work', published: true }],
    };
    const g = scopeGroups(view, { sections: ['work', 'old'], pages: ['p1', 'gone'] });
    expect(g.sections.map((s) => `${s.id}:${s.pages.length}`)).toEqual(['work:1', 'notes:0']);
    expect(g.unknown).toEqual({ sections: ['old'], pages: ['gone'] });
  });

  it('is found by who, why, notes, its code name and what it opens', () => {
    const text = findText(listed({ recipient: { name: 'Jane Doe', organisation: 'Contoso' }, purpose: 'Panel', notes: 'Met at a talk', opens: ['Every private page in Work'] }));
    for (const word of ['jane', 'contoso', 'panel', 'met at', 'harbor', 'access code', 'work']) expect(text).toContain(word);
  });

  it('a last day is a date, today or later', () => {
    expect(endDateIssue('2026-10-06', '2026-10-06')).toBeNull();
    expect(endDateIssue('2026-10-05', '2026-10-06')).toMatch(/today or later/);
    expect(endDateIssue('soon', '2026-10-06')).toMatch(/as a date/);
    expect(daysAfter(30, new Date('2026-10-06T12:00:00'))).toBe('2026-11-05');
  });
});

describe('publishing: no private words in public history (QB10)', () => {
  const files = [
    { key: '/content/articles/khonjel.json', status: 'changed' as const },
    { key: '/private/articles/fx-private-alpha.json', status: 'changed' as const },
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
  const grants = () => json<{ grants: { id: string; name?: string; kind: string; revokedAt?: string; expiresAt?: string; scope: { pages?: string[]; sections?: string[] }; secret: { words?: string; key?: string } }[] }>(join(dir, 'private/access.json')).grants;
  /** A refusal's first issue. */
  const refusal = (r: { ok: boolean }) => ('issues' in r ? (r.issues as { path?: string; message: string }[])[0] : undefined);
  const structureNow = () => json<SiteStructure>(join(dir, 'content/structures/site.json'));
  const overlayNow = () => json<Overlay>(join(dir, 'private/structures/overlay.json'));
  /** A section's open and private pages, in its full order, as the files now have them. */
  const order = (section: string) => sectionOrder(structureNow(), overlayNow(), section);

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
    expect(l.share!.link).toMatch(/^https:\/\/prabinpebam\.github\.io\/atiya\/writing\/privtwo333\/#a=g[a-z2-7]{8}\.[\w-]{43}$/);
    expect(grants().map((g) => g.id)).toContain(l.grant!.id);
  });

  it('a code opens any private page, as a link does (V26)', async () => {
    const r = await access.createGrant({ kind: 'code', recipient: { name: 'X' }, purpose: '', scope: { pages: ['fx-private-one'] } });
    expect(r.ok).toBe(true);
    expect((await access.createGrant({ kind: 'code', recipient: { name: 'Y' }, purpose: '', scope: { pages: ['khonjel'] } })).ok).toBe(false);
  });

  it("a page's Share dialog lists the grants that open it, by the page or by its section; the Access screen offers every section", () => {
    const view = access.sharingView('fx-private-alpha');
    const ids = view.grants.map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['gfixall22', 'gfixone22']));
    expect(ids).not.toContain('gfixlink2');
    expect(view.grants.find((g) => g.id === 'gfixall22')?.opens).toContain('Every private page in Side projects');
    expect(view.pages.map((p) => p.id)).toEqual(expect.arrayContaining(['fx-private-alpha', 'fx-private-one']));
    expect(view.pages.find((p) => p.id === 'fx-private-one')).toMatchObject({ sectionId: 'writing', section: 'Writing' });
    // a grant can open every private page in a section before it holds any: every section is offered
    const hubs = (structureNow().home.children ?? []).filter((c) => c.kind === 'hub').map((c) => c.id);
    expect(view.sections.map((s) => s.id)).toEqual(hubs);
    expect(access.sharingView().grants.length).toBeGreaterThan(ids.length);
  });

  it('withdraws a grant, and then leaves it as it is', async () => {
    const id = grants()[0].id;
    expect((await access.withdrawGrant(id)).ok).toBe(true);
    expect(grants()[0].revokedAt).toBeTruthy();
    expect((await access.rescopeGrant(id, { sections: ['work'] })).ok).toBe(false);
    expect((await access.extendGrant(id, '2099-01-01')).ok).toBe(false);
  });

  it('the store lets a grant be deleted, and refuses a reused ID and a changed withdrawn grant', async () => {
    const key = '/private/access.json';
    const doc = store.readDoc<{ grants: { id: string; scope: object; notes?: string }[] }>(key)!;
    const write = (grantsNext: unknown[]) => store.commit({ changes: [{ key, bytes: store.jsonBytes({ grants: grantsNext }) }], ifMatch: { [key]: doc.version } });
    expect((await write([...doc.value.grants, { ...doc.value.grants[0] }])).ok).toBe(false);
    const withdrawn = doc.value.grants.findIndex((g) => (g as { revokedAt?: string }).revokedAt);
    const changed = doc.value.grants.map((g, i) => (i === withdrawn ? { ...g, scope: { sections: ['work'] } } : g));
    expect((await write(changed)).ok).toBe(false);
    // its notes may change
    const noted = doc.value.grants.map((g, i) => (i === withdrawn ? { ...g, notes: 'Called back on Tuesday' } : g));
    expect((await write(noted)).ok).toBe(true);
  });

  it("changes a grant's details, what it opens and its last day in one save, keeping an unchanged grant's bytes", async () => {
    const made = await access.createGrant({ kind: 'code', recipient: { name: 'Ana Ruiz', organisation: 'Contoso' }, purpose: 'Panel', scope: { pages: ['fx-private-alpha'] }, expires: '2099-01-01' });
    const id = made.grant!.id;
    const before = readFileSync(join(dir, 'private/access.json'), 'utf8');
    // the same values again: nothing changes, to the byte
    expect((await access.updateGrant(id, { recipient: { name: 'Ana Ruiz', organisation: 'Contoso', role: '', email: '' }, purpose: 'Panel', notes: '', scope: { pages: ['fx-private-alpha'] }, expires: '2099-01-01' })).ok).toBe(true);
    expect(readFileSync(join(dir, 'private/access.json'), 'utf8')).toBe(before);
    const r = await access.updateGrant(id, { recipient: { name: 'Ana Ruiz-Diaz', role: 'Design manager' }, purpose: 'Second round', notes: 'Asked by Sam', scope: { sections: ['work'], pages: ['fx-private-alpha'] }, expires: null });
    expect(r.ok).toBe(true);
    const g = grants().find((x) => x.id === id) as unknown as { recipient: object; purpose: string; notes?: string; expiresAt?: string; scope: object; secret: object };
    expect(g).toMatchObject({ recipient: { name: 'Ana Ruiz-Diaz', role: 'Design manager' }, purpose: 'Second round', notes: 'Asked by Sam', scope: { sections: ['work'], pages: ['fx-private-alpha'] } });
    expect(g.recipient).not.toHaveProperty('organisation');
    expect(g.expiresAt).toBeUndefined();
    expect(g.secret).toEqual(made.grant!.secret);
    // refusals, each naming its field
    expect(refusal(await access.updateGrant(id, { recipient: { name: ' ' } }))).toMatchObject({ path: 'recipient.name' });
    expect(refusal(await access.updateGrant(id, { scope: {} }))).toMatchObject({ path: 'scope' });
    expect(refusal(await access.updateGrant(id, { expires: '2001-01-01' }))).toMatchObject({ path: 'expires' });
    expect((await access.updateGrant(id, { expires: '2099-06-30' })).ok).toBe(true);
    expect(grants().find((x) => x.id === id)?.expiresAt).toMatch(/^2099-06-30T23:59:59/);
  });

  it('a withdrawn grant changes only why and its notes; any grant can be deleted', async () => {
    const withdrawn = grants().find((g) => g.revokedAt)!;
    expect((await access.updateGrant(withdrawn.id, { purpose: 'Closed', notes: 'Role filled' })).ok).toBe(true);
    expect(grants().find((g) => g.id === withdrawn.id)).toMatchObject({ purpose: 'Closed', notes: 'Role filled' });
    expect((await access.updateGrant(withdrawn.id, { scope: { sections: ['writing'] } })).ok).toBe(false);
    expect((await access.updateGrant(withdrawn.id, { recipient: { name: 'Someone else' } })).ok).toBe(false);
    const working = grants().find((g) => !g.revokedAt)!;
    const count = grants().length;
    expect((await access.deleteGrant(withdrawn.id)).ok).toBe(true);
    expect((await access.deleteGrant(working.id)).ok).toBe(true);
    expect(grants()).toHaveLength(count - 2);
    expect(grants().some((g) => g.id === working.id || g.id === withdrawn.id)).toBe(false);
    expect((await access.deleteGrant(working.id)).ok).toBe(false);
  });

  it('makes an open page private in its place, moving its file into private-pages/, and public again where it was', async () => {
    const before = order('side-projects').map((p) => p.id);
    expect((await access.setPageAccess('watai', 'private')).ok).toBe(true);
    expect(existsSync(join(dir, 'private/articles/watai.json'))).toBe(true);
    expect(existsSync(join(dir, 'content/articles/watai.json'))).toBe(false);
    expect(order('side-projects').map((p) => p.id)).toEqual(before);
    expect(order('side-projects').find((p) => p.id === 'watai')?.access).toBe('private');
    expect(privateNode(overlayNow(), 'watai')?.node.token).toMatch(/^[a-z2-7]{10}$/);
    // a grant made for it alone stops naming it once it's public (V26: a grant opens private pages only)
    const g = await access.createGrant({ kind: 'link', recipient: { name: 'Watai reader' }, purpose: '', scope: { pages: ['watai'] } });
    expect(g.ok).toBe(true);
    expect((await access.setPageAccess('watai', 'open')).ok).toBe(true);
    expect(existsSync(join(dir, 'content/articles/watai.json'))).toBe(true);
    expect(order('side-projects').map((p) => p.id)).toEqual(before);
    expect(grants().find((x) => x.id === g.grant!.id)?.scope.pages ?? []).not.toContain('watai');
  });

  it("orders a section's open and private pages together, and changes a private page's address", async () => {
    const pages = order('side-projects').map((p) => p.id);
    const next = [pages[1], pages[0], ...pages.slice(2)];
    expect((await access.setSectionOrder('side-projects', next)).ok).toBe(true);
    expect(order('side-projects').map((p) => p.id)).toEqual(next);
    const was = privateNode(overlayNow(), 'fx-private-two')!.node.token;
    expect((await access.changeAddress('fx-private-two')).ok).toBe(true);
    expect(privateNode(overlayNow(), 'fx-private-two')!.node.token).not.toBe(was);
    expect((await access.changeAddress('khonjel')).ok).toBe(false);
  });

  it('moves pages in the Sections screen with private ones among them, in one transaction', async () => {
    expect((await access.moveSectionPages(['fx-private-alpha', 'khonjel'], 'work', 0)).ok).toBe(true);
    expect(order('work').slice(0, 2).map((p) => `${p.id}:${p.access}`)).toEqual(['fx-private-alpha:private', 'khonjel:open']);
    expect(order('side-projects').map((p) => p.id)).not.toContain('fx-private-alpha');
    expect(privateNode(overlayNow(), 'fx-private-alpha')?.node.token).toBe('alphaaaaa2');
    const off = await access.moveSectionPages(['fx-private-alpha'], '_off');
    expect(off.ok).toBe(false);
    expect(privateNode(overlayNow(), 'fx-private-alpha')?.section).toBe('work');
  });

  it('a new page can be private from the start: written straight into private-pages/, never content/', async () => {
    const articles = await import('../../src/site/editor/server/articles');
    const made = await articles.createArticle({ title: 'A private case study', summary: 'For invited readers.', kind: 'note', section: 'work', access: 'private' });
    expect(made.ok).toBe(true);
    expect(existsSync(join(dir, 'private/articles', `${made.id}.json`))).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${made.id}.json`))).toBe(false);
    expect(order('work').find((p) => p.id === made.id)?.access).toBe('private');
    // a private page needs its section, like any page
    expect((await articles.createArticle({ title: 'No section', summary: 'x', kind: 'note', section: null, access: 'private' })).ok).toBe(false);
    // a copy keeps its access and its section, and stays out of content/
    const copy = await articles.duplicateArticle(made.id!);
    expect(copy.ok).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${copy.id}.json`))).toBe(false);
    expect(order('work').find((p) => p.id === copy.id)?.access).toBe('private');
    // a private page moves to another section and stays private, with its address; then becomes public there
    const token = privateNode(overlayNow(), made.id!)!.node.token;
    expect((await access.setPageAccess(made.id!, 'private', 'side-projects')).ok).toBe(true);
    expect(order('side-projects').find((p) => p.id === made.id)?.access).toBe('private');
    expect(order('work').some((p) => p.id === made.id)).toBe(false);
    expect(privateNode(overlayNow(), made.id!)!.node.token).toBe(token);
    expect((await access.setPageAccess(made.id!, 'open')).ok).toBe(true);
    expect(existsSync(join(dir, 'content/articles', `${made.id}.json`))).toBe(true);
    expect(order('side-projects').find((p) => p.id === made.id)?.access).toBe('open');
  });
});