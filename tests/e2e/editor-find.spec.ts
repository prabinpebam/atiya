/**
 * The action center's side of edit mode (documentation/desktop/action-center.md §8.2, §8.3; desktop plan 7E.7,
 * 7E.11): the index read from the content alone, a picture's thumbnail when asked, and the site's settings changed
 * through the store (refusals, conflicts, a way to explore). The editor project, on the fixture server (port 4330).
 *
 *   npx playwright test --project=editor -g "editor: the action center"
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE, reset } from '../../scripts/editor-test-server.mjs';

const WRITE = { 'content-type': 'application/json', 'X-Editor': '1', Origin: 'http://localhost:4330' };
const siteJson = () => JSON.parse(readFileSync(join(FIXTURE, 'content/site.json'), 'utf8'));
const waysJson = () => JSON.parse(readFileSync(join(FIXTURE, 'content/structures/ways.json'), 'utf8'));
type Index = {
  pages: { id: string; title: string; text: string; statusLabel: string; kindLabel: string; private: boolean; path: string | null; picture: string | null; section: { id: string } | null }[];
  sections: { id: string; title: string; path: string; pages: number }[];
  media: { id: string; kind: string; title: string; ownerLabel: string }[];
  screens: { id: string; label: string; href: string; words: string[] }[];
  settings: { id: string; value: unknown; version: string | null; control: string }[];
};

test.describe('editor: the action center', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);
  test.beforeEach(() => reset());
  test.afterAll(() => reset());

  test("the index lists pages with their words, sections, pictures, the side navigation's screens and the site's settings", async ({ page, request }) => {
    const r = await request.get('/_edit/api/find');
    expect(r.status()).toBe(200);
    const index = (await r.json()) as Index;
    // every page, with its body as words and where it opens
    expect(index.pages.length).toBeGreaterThan(3);
    const withWords = index.pages.find((p) => p.text.length > 200);
    expect(withWords, 'a page with words in its body').toBeTruthy();
    expect(withWords!.text).not.toMatch(/\*\*|\]\(/);
    expect(index.pages.every((p) => p.statusLabel && p.kindLabel)).toBe(true);
    expect(index.pages.some((p) => p.path?.startsWith('/'))).toBe(true);
    // sections with their counts; pictures with the page they belong to
    expect(index.sections.length).toBeGreaterThan(0);
    for (const s of index.sections) expect(s.pages).toBe(index.pages.filter((p) => p.section?.id === s.id).length);
    expect(index.media.length).toBeGreaterThan(0);
    expect(index.media.some((m) => m.ownerLabel)).toBe(true);
    // the screens are the side navigation's, in its order, then the places within a screen (Contact, Visitor counts)
    await page.goto('/_edit/');
    const nav = await page.getByRole('navigation', { name: 'Edit mode' }).getByRole('link').allInnerTexts();
    expect(index.screens.map((s) => s.label)).toEqual([...nav.map((t) => t.split('\n')[0].trim()), 'Contact', 'Visitor counts']);
    expect(index.screens.find((s) => s.id === 'settings-counts')?.href).toBe('/_edit/settings/#settings-counts');
    expect(index.screens.find((s) => s.id === 'publish')?.href).toBe('/_edit/publish/');
    // the site's settings, as saved
    const name = index.settings.find((s) => s.id === 'site-name');
    expect(name).toMatchObject({ control: 'text', value: siteJson().name });
    expect(index.settings.find((s) => s.id === 'way:little-planet')).toMatchObject({ control: 'switch' });

    // a thumbnail, drawn when it's asked for
    const pic = index.media.find((m) => m.kind === 'image')!;
    const t = await request.get(`/_edit/api/find/thumb?id=${encodeURIComponent(pic.id)}`);
    expect(t.status()).toBe(200);
    const { thumb } = await t.json();
    expect(thumb).toMatch(/^\//);
    const img = await request.get(thumb);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toMatch(/^image\//);
    expect((await request.get('/_edit/api/find/thumb?id=no/such/picture')).status()).toBe(404);
  });

  test("the site's name changes through the store: saved, refused in the screen's words, and a stale version is a conflict", async ({ request }) => {
    const index = (await (await request.get('/_edit/api/find')).json()) as Index;
    const name = index.settings.find((s) => s.id === 'site-name')!;
    // edit mode's guard holds for these writes too
    expect((await request.put('/_edit/api/find/settings/site-name', { headers: { 'content-type': 'application/json' }, data: { value: 'X', version: name.version } })).status()).toBe(403);

    const ok = await request.put('/_edit/api/find/settings/site-name', { headers: WRITE, data: { value: '  Ada   King ', version: name.version } });
    expect(ok.status()).toBe(200);
    const saved = await ok.json();
    expect(saved).toMatchObject({ ok: true, restarts: false, setting: { id: 'site-name', value: 'Ada King' } });
    expect(siteJson().name).toBe('Ada King');

    const refused = await request.put('/_edit/api/find/settings/site-name', { headers: WRITE, data: { value: '   ', version: saved.setting.version } });
    expect(refused.status()).toBe(422);
    expect((await refused.json()).issues[0].message).toBe('The site needs a name.');
    expect(siteJson().name).toBe('Ada King');

    const stale = await request.put('/_edit/api/find/settings/site-name', { headers: WRITE, data: { value: 'Someone else', version: name.version } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).setting.value).toBe('Ada King');
    expect((await request.put('/_edit/api/find/settings/no-such-setting', { headers: WRITE, data: { value: 1, version: null } })).status()).toBe(404);
  });

  test('a way to explore turns off as the Ways to explore screen turns it off, and edit mode starts again', async ({ request }) => {
    const startedNow = async () => (await (await request.get('/_edit/__warm').catch(() => null))?.json().catch(() => null))?.started ?? null;
    // the reset can rename the site back (the test before renames it), which restarts the dev server once it's
    // quiet: begin only when it has stayed up, the same start, for longer than that
    let seen: string | null = null;
    await expect
      .poll(
        async () => {
          const now = await startedNow();
          const settled = now !== null && now === seen;
          seen = now;
          return settled;
        },
        { timeout: 120_000, intervals: [4000] },
      )
      .toBe(true);
    const index = (await (await request.get('/_edit/api/find')).json()) as Index;
    const way = index.settings.find((s) => s.id === 'way:little-planet')!;
    expect(way.value).toBe(true);
    const before = await startedNow();
    const r = await request.put('/_edit/api/find/settings/way%3Alittle-planet', { headers: WRITE, data: { value: false, version: way.version } });
    expect(r.status()).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, restarts: true, setting: { value: false } });
    expect(waysJson().modes).toEqual([{ id: 'little-planet', on: false, mount: 'play' }]);
    expect(waysJson().primary).toBe('site');
    await expect.poll(startedNow, { timeout: 120_000, intervals: [500] }).not.toBe(before);
    await expect.poll(startedNow, { timeout: 120_000, intervals: [500] }).not.toBeNull();
  });
});
