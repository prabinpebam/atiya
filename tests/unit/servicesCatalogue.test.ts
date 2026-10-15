import { describe, expect, it } from 'vitest';
import { catalogue, contactView, embedHost, fits, optionOf, SHAPES, shapeText, type Shape } from '../../src/site/services/services';
import { siteSettings } from '../../src/site/content/schema';

/** The site's contact and visitor-count options (desktop spec §9.5, plan stage 11.2): one catalogue, held to the content contract. */
const base = { name: 'Ada', description: 'Her site.', owner: 'ada', locale: 'en' };
const SITE = 'https://ada.github.io/';
const all = [...catalogue.contact.map((o) => ({ ...o, group: 'contact' })), ...catalogue.counts.map((o) => ({ ...o, group: 'counts' })), ...catalogue.addons.map((o) => ({ ...o, group: 'addons' }))];

/** A setting made from an option and its example value, as edit mode and `atiya services set` make it. */
function settingOf(o: (typeof all)[number]) {
  const value = { [o.value.field]: o.value.example };
  if (o.group === 'contact') return { contact: { kind: o.kind, ...value } };
  if (o.group === 'counts') return { counts: { kind: o.kind, ...value, site: SITE } };
  return { counts: { kind: 'goatcounter', code: 'ada', site: SITE }, clarity: value };
}

describe('the services catalogue', () => {
  it('every option has a tier, what it gives and asks, steps by who does them, and a value of a known shape', () => {
    const ids = new Set<string>();
    for (const o of all) {
      expect(ids.has(o.id), o.id).toBe(false);
      ids.add(o.id);
      expect(['simple', 'balanced', 'powerful'], o.id).toContain(o.tier);
      expect(o.gives.length, o.id).toBeGreaterThan(10);
      expect(o.asks.length, o.id).toBeGreaterThan(5);
      expect(o.steps.length, o.id).toBeGreaterThan(0);
      for (const s of o.steps) {
        expect(['person', 'agent'], o.id).toContain(s.who);
        if ('url' in s) expect(s.url, o.id).toMatch(/^https:\/\//);
      }
      expect([...Object.keys(SHAPES), 'embed'], o.id).toContain(o.value.shape);
      expect(shapeText(o.value.shape as Shape), o.id).toBeTruthy();
      expect(fits(o.value.shape as Shape, o.value.example), `${o.id}'s example fits its shape`).toBe(true);
      expect(['none', 'test-message', 'preview', 'dashboard'], o.id).toContain(o.check);
      for (const k of ['site', 'pricing', 'dashboard'] as const) if (k in o) expect((o as unknown as Record<string, string>)[k], o.id).toMatch(/^https:\/\//);
    }
  });

  it('every tier has an option in contact and in counts, and the simplest asks for no account', () => {
    for (const group of [catalogue.contact, catalogue.counts]) expect(new Set(group.map((o) => o.tier))).toEqual(new Set(['simple', 'balanced', 'powerful']));
    expect(catalogue.contact[0]).toMatchObject({ id: 'email', tier: 'simple' });
    expect(catalogue.counts[0]).toMatchObject({ id: 'goatcounter', tier: 'simple', cookies: false });
  });

  it('agrees with the content contract: each option, with its example, makes a valid setting', () => {
    for (const o of all) {
      const services = settingOf(o) as unknown as { contact?: never; counts?: never };
      const r = siteSettings.safeParse({ ...base, services });
      expect(r.success, `${o.id}: ${r.error?.message}`).toBe(true);
      if (o.group !== 'addons') expect(optionOf(services.contact ?? services.counts), o.id).toBe(o.id);
    }
  });

  it('only tools that set cookies say so, and they are the ones that wait for consent', () => {
    expect(all.filter((o) => o.cookies).map((o) => o.id).sort()).toEqual(['clarity', 'ga4']);
  });

  it('an embed must be https on an allowed host, its subdomains, or its path', () => {
    expect(embedHost('https://tally.so/r/x')?.name).toBe('Tally');
    expect(embedHost('https://form.jotform.com/1')?.name).toBe('Jotform');
    expect(embedHost('https://docs.google.com/forms/d/e/x/viewform')?.name).toBe('Google Forms');
    expect(embedHost('https://docs.google.com/spreadsheets/d/x')).toBeNull();
    expect(embedHost('https://nottally.so/r/x')).toBeNull();
    expect(embedHost('https://user:pw@tally.so/r/x')).toBeNull();
    expect(embedHost('javascript:alert(1)')).toBeNull();
    expect(embedHost('not a link')).toBeNull();
  });
});

describe('what the Contact page draws (plan stage 11.3)', () => {
  it('by kind; an embed from a host no longer allowed draws nothing', () => {
    expect(contactView(undefined)).toEqual({ kind: 'none' });
    expect(contactView({ endpoint: 'https://contact.example' })).toEqual({ kind: 'relay', endpoint: 'https://contact.example' });
    expect(contactView({ kind: 'email', address: 'ada@example.com' })).toEqual({ kind: 'email', address: 'ada@example.com' });
    expect(contactView({ kind: 'web3forms', key: 'k' })).toEqual({ kind: 'web3forms', key: 'k' });
    expect(contactView({ kind: 'embed', url: 'https://tally.so/r/x' })).toEqual({ kind: 'embed', url: 'https://tally.so/r/x', name: 'Tally' });
    expect(contactView({ kind: 'embed', url: 'https://evil.example/x' })).toEqual({ kind: 'none' });
  });

  it('a test build always draws the relay form on its made-up endpoint', () => {
    expect(contactView({ kind: 'email', address: 'ada@example.com' }, { test: true, testEndpoint: 'https://contact.test' })).toEqual({ kind: 'relay', endpoint: 'https://contact.test' });
    expect(contactView({ kind: 'email', address: 'ada@example.com' }, { test: true })).toEqual({ kind: 'none' });
  });
});
