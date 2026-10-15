import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countsVar, sameAddress, serviceVars, telemetryNote } from '../../integrations/services.mjs';
import { siteSettings } from '../../src/site/content/schema';

const site = { services: { contact: { endpoint: 'https://contact.example' }, telemetry: { key: 'phc_abc', host: 'https://eu.i.posthog.com', site: 'https://ada.github.io/' } } };

describe("the site's services are content (desktop spec §6.3, plan stage 10)", () => {
  it('a published build reads the endpoint and the telemetry key from content/site.json', () => {
    expect(serviceVars(site, { command: 'build', siteUrl: 'https://ada.github.io' })).toEqual({
      PUBLIC_CONTACT_ENDPOINT: 'https://contact.example',
      PUBLIC_POSTHOG_KEY: 'phc_abc',
      PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
      PUBLIC_COUNTS: '',
    });
  });

  it("only a build for the site's own address gets the telemetry key: a copy published anywhere else doesn't", () => {
    expect(serviceVars(site, { command: 'build', siteUrl: 'https://bob.github.io' })).toMatchObject({ PUBLIC_CONTACT_ENDPOINT: 'https://contact.example', PUBLIC_POSTHOG_KEY: '', PUBLIC_POSTHOG_HOST: '' });
    expect(serviceVars(site, { command: 'build', siteUrl: 'https://ada.github.io', base: '/copy' })).toMatchObject({ PUBLIC_POSTHOG_KEY: '' });
    const noAddress = { services: { telemetry: { key: 'phc_abc' } } };
    expect(serviceVars(noAddress, { command: 'build', siteUrl: 'https://ada.github.io' })).toMatchObject({ PUBLIC_POSTHOG_KEY: '' });
    const owner = JSON.parse(readFileSync('content/site.json', 'utf8'));
    expect(serviceVars(owner, { command: 'build', siteUrl: 'https://prabinpebam.github.io', base: '/atiya' })?.PUBLIC_POSTHOG_KEY).toMatch(/^phc_/);
    expect(serviceVars(owner, { command: 'build', siteUrl: 'https://someone.github.io', base: '/atiya' })?.PUBLIC_POSTHOG_KEY).toBe('');
  });

  it("a published build that leaves the key out says why, naming only addresses", () => {
    expect(telemetryNote(site, { siteUrl: 'https://ada.github.io' })).toBeNull();
    expect(telemetryNote(site, { siteUrl: 'https://bob.github.io', base: '/copy' })).toBe('This build is for https://bob.github.io/copy, not https://ada.github.io/ (services.telemetry.site), so it leaves the telemetry key out.');
    expect(telemetryNote({ services: { telemetry: { key: 'phc_abc' } } }, { siteUrl: 'https://ada.github.io' })).toMatch(/no `site` address/);
    expect(telemetryNote(site, {})).toBeNull();
    expect(telemetryNote({ name: 'Ada' }, { siteUrl: 'https://ada.github.io' })).toBeNull();
  });

  it('compares addresses as a published site has them', () => {
    expect(sameAddress('https://prabinpebam.github.io/atiya/', 'https://prabinpebam.github.io', '/atiya')).toBe(true);
    expect(sameAddress('https://prabinpebam.github.io/atiya', 'https://prabinpebam.github.io', '/atiya/')).toBe(true);
    expect(sameAddress('https://ada.github.io/', 'https://ada.github.io')).toBe(true);
    expect(sameAddress('https://ada.github.io/', 'https://ada.github.io', '/atiya')).toBe(false);
    expect(sameAddress('not a url', 'https://ada.github.io')).toBe(false);
  });

  it("a build for no published address (this computer's) never gets the telemetry key", () => {
    expect(serviceVars(site, { command: 'build' })).toMatchObject({ PUBLIC_CONTACT_ENDPOINT: 'https://contact.example', PUBLIC_POSTHOG_KEY: '', PUBLIC_POSTHOG_HOST: '' });
    expect(serviceVars(site, { command: 'dev', siteUrl: 'https://ada.github.io' })).toMatchObject({ PUBLIC_POSTHOG_KEY: '' });
  });

  it('a test build never reads them: its endpoint is .env.test\'s made-up host', () => {
    expect(serviceVars(site, { command: 'build', mode: 'test', siteUrl: 'https://ada.github.io' })).toBeNull();
    expect(readFileSync('.env.test', 'utf8')).toMatch(/^PUBLIC_CONTACT_ENDPOINT=https:\/\/contact\.test$/m);
  });

  it('a site without services has none, and the environment is not read', () => {
    expect(serviceVars({ name: 'Ada' }, { command: 'build', siteUrl: 'https://ada.github.io' })).toEqual({ PUBLIC_CONTACT_ENDPOINT: '', PUBLIC_POSTHOG_KEY: '', PUBLIC_POSTHOG_HOST: '', PUBLIC_COUNTS: '' });
    expect(serviceVars(null, { command: 'dev' })).toMatchObject({ PUBLIC_CONTACT_ENDPOINT: '' });
  });

  it('the schema takes addresses and a public key, and nothing else', () => {
    const base = { name: 'Ada', description: 'Her site.', owner: 'ada', locale: 'en' };
    expect(siteSettings.safeParse({ ...base, ...site }).success).toBe(true);
    expect(siteSettings.safeParse({ ...base, services: { contact: { endpoint: 'http://plain.example' } } }).success).toBe(false);
    expect(siteSettings.safeParse({ ...base, services: { telemetry: { key: 'not-a-key', site: 'https://ada.github.io/' } } }).success).toBe(false);
    expect(siteSettings.safeParse({ ...base, services: { telemetry: { key: 'phc_abc' } } }).success).toBe(false);
    expect(siteSettings.safeParse({ ...base, services: { secret: 'x' } }).success).toBe(false);
  });

  it("the engine's own repository keeps no endpoint in .env: the owner's is in his content", () => {
    expect(existsSync('.env') && /PUBLIC_CONTACT_ENDPOINT/.test(readFileSync('.env', 'utf8'))).toBe(false);
    const owner = JSON.parse(readFileSync('content/site.json', 'utf8'));
    expect(owner.services?.contact?.endpoint).toMatch(/^https:\/\//);
  });
});

describe('contact and visitor counts (desktop spec §9.5, plan stage 11.1)', () => {
  const base = { name: 'Ada', description: 'Her site.', owner: 'ada', locale: 'en' };
  const ok = (services: unknown) => siteSettings.safeParse({ ...base, services }).success;
  const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';

  it('takes every kind of contact, each in its own shape', () => {
    expect(ok({ contact: { endpoint: 'https://contact.example' } })).toBe(true);
    expect(ok({ contact: { kind: 'relay', endpoint: 'https://contact.example' } })).toBe(true);
    expect(ok({ contact: { kind: 'email', address: 'ada@example.com' } })).toBe(true);
    expect(ok({ contact: { kind: 'web3forms', key: KEY } })).toBe(true);
    for (const url of ['https://tally.so/r/wA1bC2', 'https://docs.google.com/forms/d/e/1FAIpQL/viewform', 'https://form.jotform.com/241234567890', 'https://cal.com/ada/30min', 'https://calendly.com/ada', 'https://forms.office.com/r/abc'])
      expect(ok({ contact: { kind: 'embed', url } }), url).toBe(true);
  });

  it('refuses a value of the wrong shape, an embed from another host, and a mix of kinds', () => {
    expect(ok({ contact: { kind: 'email', address: 'not an address' } })).toBe(false);
    expect(ok({ contact: { kind: 'web3forms', key: 'abc' } })).toBe(false);
    expect(ok({ contact: { kind: 'embed', url: 'https://evil.example/form' } })).toBe(false);
    expect(ok({ contact: { kind: 'embed', url: 'https://docs.google.com/document/d/1' } })).toBe(false);
    expect(ok({ contact: { kind: 'embed', url: 'http://tally.so/r/x' } })).toBe(false);
    expect(ok({ contact: { kind: 'embed', url: 'https://tally.so.evil.example/r/x' } })).toBe(false);
    expect(ok({ contact: { kind: 'email', address: 'ada@example.com', key: KEY } })).toBe(false);
  });

  it('takes one counting tool for its address, and Clarity beside it', () => {
    expect(ok({ counts: { kind: 'goatcounter', code: 'ada', site: 'https://ada.github.io/' } })).toBe(true);
    expect(ok({ counts: { kind: 'umami', id: KEY, site: 'https://ada.github.io/' } })).toBe(true);
    expect(ok({ counts: { kind: 'ga4', id: 'G-AB12CD34EF', site: 'https://ada.github.io/' }, clarity: { id: 'abc123def4' } })).toBe(true);
    expect(ok({ counts: { kind: 'goatcounter', code: 'Ada!', site: 'https://ada.github.io/' } })).toBe(false);
    expect(ok({ counts: { kind: 'goatcounter', code: 'ada' } })).toBe(false);
    expect(ok({ counts: { kind: 'ga4', id: 'UA-1234', site: 'https://ada.github.io/' } })).toBe(false);
    expect(ok({ counts: { kind: 'goatcounter', code: 'ada', site: 'https://ada.github.io/' }, telemetry: site.services.telemetry })).toBe(false);
    expect(ok({ clarity: { id: 'abc123def4' } })).toBe(false);
  });

  it("a published build for the tools' address gets them as one list; any other build gets none", () => {
    const services = { counts: { kind: 'umami', id: KEY, host: 'https://umami.example', site: 'https://ada.github.io/' }, clarity: { id: 'abc123def4' } };
    expect(JSON.parse(serviceVars({ services }, { command: 'build', siteUrl: 'https://ada.github.io' })!.PUBLIC_COUNTS)).toEqual([
      { tool: 'umami', id: KEY, host: 'https://umami.example' },
      { tool: 'clarity', id: 'abc123def4' },
    ]);
    expect(serviceVars({ services }, { command: 'build', siteUrl: 'https://bob.github.io' })!.PUBLIC_COUNTS).toBe('');
    expect(serviceVars({ services }, { command: 'dev', siteUrl: 'https://ada.github.io' })!.PUBLIC_COUNTS).toBe('');
    expect(countsVar({ clarity: { id: 'abc123def4' } }, true)).toBe('[{"tool":"clarity","id":"abc123def4"}]');
    expect(countsVar({}, true)).toBe('');
  });

  it("the owner's site is unchanged: his relay and PostHog, no other counting tool", () => {
    const owner = JSON.parse(readFileSync('content/site.json', 'utf8'));
    expect(siteSettings.safeParse(owner).success).toBe(true);
    expect(serviceVars(owner, { command: 'build', siteUrl: 'https://prabinpebam.github.io', base: '/atiya' })?.PUBLIC_COUNTS).toBe('');
  });
});
