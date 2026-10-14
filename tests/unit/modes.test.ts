/**
 * Navigation modes' data and rules (documentation/desktop/modes.md §5.2, §6; plan stage 8.2): mode data
 * holds no draft or private page, and V33 to V37 refuse what they name.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadContent, type ContentIndex } from '../../src/site/content/load';
import { readSnapshot } from '../../src/site/content/source';
import { BUILTIN_MODES } from '../../src/site/modes/builtin';
import { modeManifest, siteModes, type BuiltinMode } from '../../src/site/modes/contract';
import { buildModeData } from '../../src/site/modes/data';
import { checkModes } from '../../src/site/modes/rules';
import { writeStarter } from '../../apps/desktop/src/core/setup/starter.mjs';
import { privateSeed } from '../../apps/desktop/src/core/setup/private.mjs';

const ROOT = join(__dirname, '../..');
const PLANET = BUILTIN_MODES.get('little-planet')!;

/** The starter (Ada's site, with the planet), one of its pages made a draft, and one private page in Work. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'atiya-modes-'));
  writeStarter(dir, { name: 'Ada Lovelace', planet: true, samples: true, today: '2026-10-14', starter: join(ROOT, 'starter', 'content') });
  const content = join(dir, 'content');
  const priv = join(dir, 'private-pages');
  for (const [f, text] of Object.entries(privateSeed('https://ada.github.io/')) as [string, string][]) {
    mkdirSync(dirname(join(priv, f)), { recursive: true });
    writeFileSync(join(priv, f), text);
  }
  const load = () => {
    const snap = readSnapshot(content, priv);
    return loadContent(snap.docs, snap.masters, snap.errors);
  };
  // a published, open page in a section, made a draft
  const first = load();
  const page = first.routes.find((r) => r.node.kind === 'item' && r.published && r.access === 'open' && r.parent && r.parent.id !== 'home')!;
  const draftId = page.node.kind === 'item' ? page.node.item.id : '';
  const draftFile = join(content, 'articles', `${draftId}.json`);
  writeFileSync(draftFile, JSON.stringify({ ...JSON.parse(readFileSync(draftFile, 'utf8')), status: 'draft' }, null, 2));
  mkdirSync(join(priv, 'articles'), { recursive: true });
  writeFileSync(
    join(priv, 'articles', 'ada-private-one.json'),
    JSON.stringify({ id: 'ada-private-one', type: 'article', kind: 'note', slug: 'ada-private-one', title: 'Engine notes, for a few readers', summary: 'Kept for invited readers.', status: 'published', visibility: 'public', publishedAt: '2026-10-14', updatedAt: '2026-10-14', locale: 'en', body: [{ type: 'text', markdown: 'Private.' }] }),
  );
  writeFileSync(join(priv, 'structures', 'overlay.json'), JSON.stringify({ sections: [{ section: 'work', pages: [{ id: 'ada-private-one', token: 'adaprvloom', item: { type: 'article', id: 'ada-private-one' } }] }] }));
  const index = load();
  const planet = JSON.parse(readFileSync(join(content, 'structures', 'planet.json'), 'utf8'));
  return { index, planet, draftId, draftTitle: index.articles.get(draftId)!.title };
}

const ON = siteModes.parse({ modes: [{ id: 'little-planet', on: true, mount: 'play' }], primary: 'site' });
const check = (index: ContentIndex, structures: Record<string, unknown>, modes = ON, catalogue?: ReadonlyMap<string, BuiltinMode>) => checkModes({ index, structures, modes, catalogue });
const rules = (r: ReturnType<typeof check>) => r.issues.map((i) => i.rule);

describe('mode data (8.2)', () => {
  it('holds only published, open pages; a section with private pages says only that it has some', () => {
    const f = fixture();
    const data = buildModeData(f.index, { id: 'little-planet', mount: 'play', structure: PLANET.readStructure(f.planet), base: '/atiya/' });
    const pages = data.sections.flatMap((s) => s.pages);
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) {
      const route = f.index.routes.find((r) => r.node.kind === 'item' && r.node.item.id === p.id)!;
      expect(route.published && route.access === 'open').toBe(true);
      expect(p.url.startsWith('/atiya/')).toBe(true);
    }
    const text = JSON.stringify(data);
    expect(text).not.toContain(f.draftId);
    expect(pages.map((p) => p.title)).not.toContain(f.draftTitle);
    expect(text).not.toContain('ada-private-one');
    expect(text).not.toContain('Engine notes');
    expect(text).not.toContain('adaprvloom');
    expect(data.sections.find((s) => s.id === 'work')?.hasPrivate).toBe(true);
    expect(data.sections.filter((s) => s.hasPrivate).map((s) => s.id)).toEqual(['work']);
    expect(data.slots.map((s) => s.id)).toEqual([...(PLANET.manifest.slots.kind === 'fixed' ? PLANET.manifest.slots.ids : [])]);
    expect(data.site).toMatchObject({ name: 'Ada Lovelace', base: '/atiya/' });
    expect(data.links).toMatchObject({ home: '/atiya/', signIn: '/atiya/sign-in/' });
  });

  it("the starter with the planet on passes every rule, and the planet's data is built", () => {
    const f = fixture();
    const r = check(f.index, { 'little-planet': f.planet });
    expect(r.issues).toEqual([]);
    expect(r.data).toHaveLength(1);
    expect(r.data[0].mode).toMatchObject({ id: 'little-planet', mount: 'play' });
  });

  it("the owner's own site passes, with his planet as the little planet's structure", () => {
    const snap = readSnapshot(join(ROOT, 'content'), null);
    const index = loadContent(snap.docs, snap.masters, snap.errors);
    const planet = JSON.parse(readFileSync(join(ROOT, 'content', 'structures', 'planet.json'), 'utf8'));
    expect(check(index, { 'little-planet': planet }).issues).toEqual([]);
  });
});

describe('V33 to V37 refuse what they name (8.2)', () => {
  /** Another mode, for the rules that need two. */
  const other = (o: Partial<{ api: number; mount: string }> = {}): BuiltinMode => ({
    manifest: modeManifest.parse({ ...PLANET.manifest, id: 'constellation', name: 'Constellation', slots: { kind: 'per-section', max: 3 }, api: o.api ?? 1, mount: o.mount ?? 'stars' }),
    structureFile: 'structures/modes/constellation.json',
    readStructure: (raw) => raw as never,
  });
  const both = (o?: Parameters<typeof other>[0]) => new Map([...BUILTIN_MODES, ['constellation', other(o)]]);
  const twoOn = (extra: Record<string, unknown> = {}) => siteModes.parse({ modes: [{ id: 'little-planet', on: true }, { id: 'constellation', on: true, ...extra }] });

  it('V33: a mode the engine doesn\'t know, a contract it doesn\'t host, and a primary that isn\'t on', () => {
    const f = fixture();
    expect(rules(check(f.index, {}, siteModes.parse({ modes: [{ id: 'github:someone/orbit', on: true }] })))).toEqual(['V33']);
    expect(rules(check(f.index, { 'little-planet': f.planet, constellation: { slots: [] } }, twoOn(), both({ api: 2 })))).toEqual(['V33']);
    expect(rules(check(f.index, { 'little-planet': f.planet }, siteModes.parse({ modes: [{ id: 'little-planet', on: true }], primary: 'constellation' })))).toEqual(['V33']);
    // an unknown mode that's off asks for nothing
    expect(check(f.index, { 'little-planet': f.planet }, siteModes.parse({ modes: [{ id: 'little-planet', on: true }, { id: 'github:someone/orbit', on: false }] })).issues).toEqual([]);
  });

  it("V34: two modes at one address, or a mode at a section's or the site's own", () => {
    const f = fixture();
    const s = { 'little-planet': f.planet, constellation: { slots: [] } };
    expect(rules(check(f.index, s, twoOn({ mount: 'play' }), both()))).toEqual(['V34']);
    expect(rules(check(f.index, s, twoOn({ mount: 'work' }), both()))).toEqual(['V34']);
    expect(rules(check(f.index, s, twoOn({ mount: 'design' }), both()))).toEqual(['V34']);
    expect(check(f.index, s, twoOn(), both()).issues).toEqual([]);
  });

  it("V35: no structure, one that doesn't fit, a slot that isn't the mode's, too many or repeated slots", () => {
    const f = fixture();
    expect(rules(check(f.index, {}))).toEqual(['V35']);
    expect(rules(check(f.index, { 'little-planet': { places: [{ ...f.planet.places[0], id: 'castle' }] } }))).toEqual(['V35']);
    const s = (slots: unknown[]) => ({ 'little-planet': f.planet, constellation: { slots } });
    const slot = (id: string, section: string | null = null) => ({ id, section, words: {} });
    expect(rules(check(f.index, s([slot('a'), slot('b'), slot('c'), slot('d')]), twoOn(), both()))).toEqual(['V35']);
    expect(rules(check(f.index, s([slot('a'), slot('a')]), twoOn(), both()))).toEqual(['V35']);
  });

  it('V36: a slot showing a section that isn\'t there, or one section shown by two slots', () => {
    const f = fixture();
    const missing = { places: f.planet.places.map((p: { site: string }, i: number) => (i === 0 ? { ...p, site: 'nowhere' } : p)) };
    expect(rules(check(f.index, { 'little-planet': missing }))).toEqual(['V36']);
    const twice = { places: f.planet.places.map((p: { site: string }, i: number) => (i === 1 ? { ...p, site: f.planet.places[0].site } : p)) };
    expect(rules(check(f.index, { 'little-planet': twice }))).toEqual(['V36']);
  });

  it('V37: a mode turned off keeps its structure, and builds no data', () => {
    const f = fixture();
    const off = siteModes.parse({ modes: [{ id: 'little-planet', on: false }] });
    expect(rules(check(f.index, {}, off))).toEqual(['V37']);
    const kept = check(f.index, { 'little-planet': f.planet }, off);
    expect(kept.issues).toEqual([]);
    expect(kept.data).toEqual([]);
  });
});

describe("the planet reads mode data (8.1)", () => {
  it("its buildings are exactly what they were: the owner's site, with private fixtures beside it", async () => {
    vi.resetModules();
    const repo = await import('../../src/site/content/repository');
    const { PLACES } = await import('../../src/game/world/places');
    const { landmarksFrom } = await import('../../src/game/world/modeLandmarks');
    const { withBase } = await import('../../src/game/platform/base');
    // play.astro's own join, before mode data
    const planet = repo.getPlanet()!;
    const routes = repo.getRoutes();
    const before = PLACES.map((world) => {
      const place = planet.places.find((p) => p.id === world.id)!;
      const site = place.site ? routes.find((r) => r.node.id === place.site)?.path : undefined;
      return {
        ...world,
        title: place.title,
        kicker: place.kicker,
        summary: place.summary,
        pages: repo.placePages(world.id).map(({ article, route }) => ({ id: article.id, title: article.title, href: withBase(route.path) })),
        siteHref: withBase(site ?? '/#sections'),
      };
    });
    const after = landmarksFrom(PLACES, repo.getModeData('little-planet')!);
    expect(after).toEqual(before);
    expect(after.some((l) => l.pages.length > 0)).toBe(true);
  });

  it('a slot with no section has no pages and leads to the list of sections', async () => {
    const { PLACES } = await import('../../src/game/world/places');
    const { landmarksFrom } = await import('../../src/game/world/modeLandmarks');
    const f = fixture();
    const structure = PLANET.readStructure(f.planet);
    structure.slots[0] = { ...structure.slots[0], section: null };
    const data = buildModeData(f.index, { id: 'little-planet', mount: 'play', structure, base: '/atiya/' });
    const first = landmarksFrom(PLACES, data).find((l) => l.id === structure.slots[0].id)!;
    expect(first.pages).toEqual([]);
    expect(first.siteHref).toBe('/atiya/#sections');
    expect(() => landmarksFrom(PLACES, { ...data, slots: data.slots.slice(1) })).toThrow(/has no/);
  });
});
