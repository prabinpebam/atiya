import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { serviceVars } from '../../integrations/services.mjs';
import { siteSettings } from '../../src/site/content/schema';

const site = { services: { contact: { endpoint: 'https://contact.example' }, telemetry: { key: 'phc_abc', host: 'https://eu.i.posthog.com' } } };

describe("the site's services are content (desktop spec §6.3, plan stage 10)", () => {
  it('a published build reads the endpoint and the telemetry key from content/site.json', () => {
    expect(serviceVars(site, { command: 'build', siteUrl: 'https://ada.github.io' })).toEqual({
      PUBLIC_CONTACT_ENDPOINT: 'https://contact.example',
      PUBLIC_POSTHOG_KEY: 'phc_abc',
      PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
    });
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
    expect(serviceVars({ name: 'Ada' }, { command: 'build', siteUrl: 'https://ada.github.io' })).toEqual({ PUBLIC_CONTACT_ENDPOINT: '', PUBLIC_POSTHOG_KEY: '', PUBLIC_POSTHOG_HOST: '' });
    expect(serviceVars(null, { command: 'dev' })).toMatchObject({ PUBLIC_CONTACT_ENDPOINT: '' });
  });

  it('the schema takes addresses and a public key, and nothing else', () => {
    const base = { name: 'Ada', description: 'Her site.', owner: 'ada', locale: 'en' };
    expect(siteSettings.safeParse({ ...base, ...site }).success).toBe(true);
    expect(siteSettings.safeParse({ ...base, services: { contact: { endpoint: 'http://plain.example' } } }).success).toBe(false);
    expect(siteSettings.safeParse({ ...base, services: { telemetry: { key: 'not-a-key' } } }).success).toBe(false);
    expect(siteSettings.safeParse({ ...base, services: { secret: 'x' } }).success).toBe(false);
  });

  it("the engine's own repository keeps no endpoint in .env: the owner's is in his content", () => {
    expect(existsSync('.env') && /PUBLIC_CONTACT_ENDPOINT/.test(readFileSync('.env', 'utf8'))).toBe(false);
    const owner = JSON.parse(readFileSync('content/site.json', 'utf8'));
    expect(owner.services?.contact?.endpoint).toMatch(/^https:\/\//);
  });
});
