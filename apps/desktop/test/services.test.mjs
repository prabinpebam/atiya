// @ts-check
import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allOptions, checkServices, chosenIn, embedHost, fits, loadCatalogue, offService, servicesSkill, setService, SHAPES } from '../src/core/services.mjs';
import { embedHost as siteEmbedHost, SHAPES as SITE_SHAPES } from '../../../src/site/services/services';
import { siteSettings } from '../../../src/site/content/schema';
import { EXIT } from '../src/core/setup/machine.mjs';

/** Contact and visitor counts for agents (desktop plan 11.7): `atiya services` and the site's skill. */
const c = loadCatalogue();
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI = fileURLToPath(new URL('../bin/atiya.mjs', import.meta.url));
const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
const base = { name: 'Ada', description: 'Her site.', owner: 'ada', locale: 'en' };
const site = () => {
  const dir = mkdtempSync(join(tmpdir(), 'atiya-services-'));
  cpSync(join(ROOT, 'starter', 'content'), join(dir, 'content'), { recursive: true });
  return dir;
};
/** @param {string[]} args */
const atiya = (args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '' } });
  return { code: r.status, lines: r.stdout.split('\n').filter(Boolean), out: r.stdout };
};

describe("the app's rules are the site's", () => {
  it('the same value shapes and allowed hosts as src/site/services/services.ts', () => {
    expect(Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.source]))).toEqual(Object.fromEntries(Object.entries(SITE_SHAPES).map(([k, v]) => [k, v.source])));
    for (const url of ['https://tally.so/r/x', 'https://docs.google.com/forms/d/x', 'https://docs.google.com/document/d/x', 'https://evil.example/', 'http://tally.so/x', 'not a link', 'https://a.typeform.com/to/x'])
      expect(embedHost(c, url)?.name ?? null, url).toBe(siteEmbedHost(url)?.name ?? null);
  });

  it('every option, set with its example, makes settings the content contract takes', () => {
    for (const o of allOptions(c)) {
      const start = o.group === 'addons' ? setService(c, base, { id: 'goatcounter', value: 'ada', address: 'https://ada.github.io' }) : { ok: true, site: base };
      if (!start.ok) throw new Error(/** @type {any} */ (start).message);
      const r = setService(c, start.site, { id: o.id, value: o.value.example, address: 'https://ada.github.io' });
      if (!r.ok) throw new Error(`${o.id}: ${r.message}`);
      expect(siteSettings.safeParse(r.site).success, o.id).toBe(true);
      if (o.group !== 'addons') expect(chosenIn(c, r.site.services, /** @type {'contact'} */ (o.group))).toBe(o.id);
    }
  });

  it('a missing value is a step for the person; a value of the wrong shape says why', () => {
    expect(setService(c, base, { id: 'web3forms' })).toMatchObject({ ok: false, needsPerson: true, message: expect.stringMatching(/https:\/\/web3forms\.com\/.*atiya services set web3forms --value <key>/) });
    expect(setService(c, base, { id: 'web3forms', value: 'abc' })).toMatchObject({ ok: false, needsPerson: false, message: expect.stringMatching(/^That access key doesn't look right: A UUID/) });
    expect(setService(c, base, { id: 'goatcounter', value: 'ada' })).toMatchObject({ ok: false, message: expect.stringMatching(/--address/) });
    expect(setService(c, base, { id: 'clarity', value: 'abc123def4' })).toMatchObject({ ok: false, message: expect.stringMatching(/^Clarity counts beside/) });
    expect(setService(c, base, { id: 'nope', value: 'x' })).toMatchObject({ ok: false, message: 'No option called nope. Try atiya services list.' });
    expect(fits(c, 'email', 'ada@example.com')).toBe(true);
  });

  it('turning counts off turns Clarity off too, and keeps contact', () => {
    const on = { ...base, services: { contact: { kind: 'email', address: 'a@b.co' }, counts: { kind: 'goatcounter', code: 'ada', site: 'https://ada.github.io/' }, clarity: { id: 'abc123def4' } } };
    expect(offService(on, 'counts').services).toEqual({ contact: { kind: 'email', address: 'a@b.co' } });
    expect(offService(offService(on, 'counts'), 'contact').services).toBeUndefined();
  });

  it('checks: an embed and a GoatCounter dashboard answer; a Web3Forms test message only when asked', async () => {
    /** @type {string[]} */
    const asked = [];
    const fetch = /** @type {any} */ (async (/** @type {string} */ url) => (asked.push(url), { ok: !url.includes('missing'), json: async () => ({ success: true }) }));
    const s = { ...base, services: { contact: { kind: 'embed', url: 'https://tally.so/r/x' }, counts: { kind: 'goatcounter', code: 'missing', site: 'https://ada.github.io/' } } };
    expect(await checkServices(c, s, { fetch })).toEqual([
      { check: 'contact', ok: true, message: 'The embedded form at https://tally.so/r/x.' },
      { check: 'counts', ok: false, message: "GoatCounter's dashboard at https://missing.goatcounter.com/ (counting https://ada.github.io/)." },
    ]);
    const w = { ...base, services: { contact: { kind: 'web3forms', key: KEY } } };
    expect((await checkServices(c, w, { fetch }))[0].message).toMatch(/Add --send/);
    expect((await checkServices(c, w, { fetch, send: true }))[0]).toEqual({ check: 'contact', ok: true, message: 'Web3Forms took a test message: look in your inbox.' });
    expect(asked).toEqual(['https://tally.so/r/x', 'https://missing.goatcounter.com/', 'https://api.web3forms.com/submit']);
  });
});

describe('atiya services', () => {
  it('lists the options by tier, sets one in the site folder, checks it and turns it off, without signing in', () => {
    const dir = site();
    const list = JSON.parse(atiya(['services', 'list', '--dir', dir, '--json']).lines[0]);
    expect(list.type).toBe('services');
    expect(list.chosen).toEqual({ contact: null, counts: null, clarity: false });
    expect(list.options.map((/** @type {any} */ o) => `${o.group}:${o.id}:${o.tier}`)).toContain('counts:goatcounter:simple');
    const set = atiya(['services', 'set', 'email', '--value', 'ada@example.com', '--dir', dir, '--json']);
    expect(set.code).toBe(EXIT.ok);
    expect(JSON.parse(readFileSync(join(dir, 'content', 'site.json'), 'utf8')).services).toEqual({ contact: { kind: 'email', address: 'ada@example.com' } });
    expect(atiya(['services', 'set', 'goatcounter', '--value', 'ada', '--address', 'https://ada.github.io', '--dir', dir]).code).toBe(EXIT.ok);
    expect(JSON.parse(atiya(['services', 'list', '--dir', dir, '--json']).lines[0]).chosen).toEqual({ contact: 'email', counts: 'goatcounter', clarity: false });
    expect(atiya(['services', 'off', 'counts', '--dir', dir]).out).toMatch(/^Done/);
    expect(JSON.parse(readFileSync(join(dir, 'content', 'site.json'), 'utf8')).services).toEqual({ contact: { kind: 'email', address: 'ada@example.com' } });
    const check = atiya(['services', 'check', '--dir', dir, '--json']);
    expect(JSON.parse(check.lines[0])).toMatchObject({ type: 'check', ok: true });
  });

  it('exit 10 with the step and its address when a person must act; --dry-run writes nothing', () => {
    const dir = site();
    const r = atiya(['services', 'set', 'web3forms', '--dir', dir, '--json']);
    expect(r.code).toBe(EXIT.needsPerson);
    expect(JSON.parse(r.lines[0])).toMatchObject({ type: 'action', needs: 'person', url: 'https://web3forms.com/' });
    expect(JSON.parse(r.lines[1])).toMatchObject({ type: 'result', ok: false, code: EXIT.needsPerson });
    const before = readFileSync(join(dir, 'content', 'site.json'), 'utf8');
    expect(atiya(['services', 'set', 'web3forms', '--value', KEY, '--dir', dir, '--dry-run']).code).toBe(EXIT.ok);
    expect(readFileSync(join(dir, 'content', 'site.json'), 'utf8')).toBe(before);
  });

  it('help names it', () => {
    expect(atiya(['help']).out).toMatch(/atiya services list\|check\|set/);
  });
});

describe("the site's skill", () => {
  it('names every option with its tier, its steps by who does them, and the command that sets it', () => {
    const skill = servicesSkill(c);
    expect(skill).toMatch(/^---\nname: site-services\ndescription: Use when/);
    for (const o of allOptions(c)) {
      expect(skill, o.id).toContain(`### ${o.name} (${o.tier[0].toUpperCase()}${o.tier.slice(1)}, \`${o.id}\`)`);
      expect(skill, o.id).toContain(`atiya services set ${o.id} --value <${o.value.field}>`);
    }
    expect(skill).toContain('**The person:** Sign up at GoatCounter');
    expect(skill).toContain('Never sign up for a service on the person');
    expect(execFileSync('git', ['--version'], { encoding: 'utf8' })).toBeTruthy();
  });
});
