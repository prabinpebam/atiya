import { describe, expect, it } from 'vitest';
import { contactChoices, countsChoices, dashboardOf, pagesAddress, valueIssue, withContact, withCounts } from '../../src/site/editor/model/services';
import type { SiteSettings } from '../../src/site/content/schema';
import { siteSettings } from '../../src/site/content/schema';

/** Edit mode's Contact and Visitor counts cards (plan stage 11.6). */
const base: SiteSettings = { name: 'Ada', description: 'Her site.', owner: 'ada', locale: 'en' };
const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
const SITE = 'https://ada.github.io/';
const valid = (r: ReturnType<typeof withContact>) => {
  if (!('site' in r)) throw new Error(r.issue);
  expect(siteSettings.safeParse(r.site).success).toBe(true);
  return r.site;
};

describe('the Contact card', () => {
  it('offers the tiers from the catalogue, then any other form; nothing chosen on a site without contact', () => {
    const { chosen, choices } = contactChoices(base);
    expect(chosen).toBe('none');
    expect(choices.map((c) => c.id)).toEqual(['email', 'web3forms', 'tally', 'google-forms', 'jotform', 'cal-com', 'embed']);
    expect(choices.map((c) => c.tier)).toEqual(['simple', 'simple', 'balanced', 'balanced', 'powerful', 'powerful', 'powerful']);
  });

  it('makes each kind of setting, keeping everything else', () => {
    const site = { ...base, services: { telemetry: { key: 'phc_x', site: SITE } } };
    expect(valid(withContact(site, 'email', ' ada@example.com ')).services).toEqual({ telemetry: { key: 'phc_x', site: SITE }, contact: { kind: 'email', address: 'ada@example.com' } });
    expect(valid(withContact(base, 'web3forms', KEY)).services?.contact).toEqual({ kind: 'web3forms', key: KEY });
    expect(valid(withContact(base, 'tally', 'https://tally.so/r/x')).services?.contact).toEqual({ kind: 'embed', url: 'https://tally.so/r/x' });
    expect(valid(withContact(base, 'embed', 'https://calendly.com/ada')).services?.contact).toEqual({ kind: 'embed', url: 'https://calendly.com/ada' });
  });

  it('shows the current choice and its value', () => {
    const site = valid(withContact(base, 'tally', 'https://tally.so/r/x'));
    const { chosen, choices } = contactChoices(site);
    expect(chosen).toBe('tally');
    expect(choices.find((c) => c.id === 'tally')?.current).toBe('https://tally.so/r/x');
    expect(choices.find((c) => c.id === 'google-forms')?.current).toBeUndefined();
  });

  it("says what's wrong with a value, in words", () => {
    const r = (id: string, v: string) => withContact(base, id, v);
    expect(r('email', '')).toEqual({ issue: 'Paste the email address first.' });
    expect(r('email', '123+ada@users.noreply.github.com')).toMatchObject({ issue: expect.stringMatching(/no-reply/) });
    expect(r('web3forms', 'abc')).toMatchObject({ issue: expect.stringMatching(/^That doesn't look right: A UUID/) });
    expect(r('tally', 'https://evil.example/x')).toMatchObject({ issue: expect.stringMatching(/isn't on a service the site can show \(Tally, Google Forms/) });
    expect(r('tally', 'tally.so/r/x')).toEqual({ issue: 'Paste the full link, starting with https://.' });
    expect(r('nope', '')).toEqual({ issue: 'Choose how visitors reach you.' });
  });

  it("keeps the owner's own contact service as it is", () => {
    const owner = { ...base, services: { contact: { endpoint: 'https://contact.example' } } };
    const { chosen, choices } = contactChoices(owner);
    expect(chosen).toBe('relay');
    expect(choices[0]).toMatchObject({ id: 'relay', kept: true });
    expect(withContact(owner, 'relay', '')).toEqual({ site: owner });
  });
});

describe('the Visitor counts card', () => {
  it("offers the tiers and Don't count visits, at the site's address", () => {
    const { chosen, choices, address } = countsChoices(base, SITE);
    expect(chosen).toBe('none');
    expect(choices.map((c) => c.id)).toEqual(['goatcounter', 'umami', 'ga4', 'none']);
    expect(address).toBe(SITE);
  });

  it('sets a tool for the address, with Clarity beside it, and turns it off', () => {
    const on = valid(withCounts(base, 'goatcounter', 'ada', 'https://ada.github.io', 'abc123def4'));
    expect(on.services).toEqual({ counts: { kind: 'goatcounter', code: 'ada', site: SITE }, clarity: { id: 'abc123def4' } });
    expect(countsChoices(on, '')).toMatchObject({ chosen: 'goatcounter', address: SITE, clarity: 'abc123def4' });
    const off = valid(withCounts(on, 'none', '', SITE, ''));
    expect(off.services).toBeUndefined();
    expect(withCounts(on, 'none', '', SITE, 'abc123def4')).toMatchObject({ issue: expect.stringMatching(/^Clarity counts beside/) });
  });

  it('needs an https address and a value of the right shape', () => {
    expect(withCounts(base, 'umami', KEY, '', '')).toMatchObject({ issue: expect.stringMatching(/your site's address/) });
    expect(withCounts(base, 'ga4', 'UA-1', SITE, '')).toMatchObject({ issue: expect.stringMatching(/^That doesn't look right: G-/) });
    expect(withCounts(base, 'goatcounter', 'ada', SITE, 'BAD!')).toMatchObject({ issue: expect.stringMatching(/Clarity project ID/) });
  });

  it("replaces PostHog when another tool is chosen, and keeps it otherwise (the owner's)", () => {
    const owner = { ...base, services: { telemetry: { key: 'phc_x', site: 'https://prabinpebam.github.io/atiya/' } } };
    expect(countsChoices(owner, '')).toMatchObject({ chosen: 'posthog', address: 'https://prabinpebam.github.io/atiya/' });
    expect(withCounts(owner, 'posthog', '', '', '')).toEqual({ site: owner });
    expect(valid(withCounts(owner, 'umami', KEY, SITE, '')).services).toEqual({ counts: { kind: 'umami', id: KEY, site: SITE } });
  });

  it("names the dashboard, and the site's address comes from its GitHub remote", () => {
    const goat = countsChoices(base, SITE).choices[0];
    expect(dashboardOf(goat, 'ada')).toBe('https://ada.goatcounter.com/');
    expect(valueIssue(goat, 'ada')).toBeNull();
    expect(pagesAddress('https://github.com/Ada/portfolio.git')).toBe('https://ada.github.io/portfolio/');
    expect(pagesAddress('git@github.com:ada/ada.github.io.git')).toBe('https://ada.github.io/');
    expect(pagesAddress('https://github.com/prabinpebam/atiya')).toBe('https://prabinpebam.github.io/atiya/');
    expect(pagesAddress('E:/tmp/remote.git')).toBe('');
    expect(pagesAddress(null)).toBe('');
  });
});
