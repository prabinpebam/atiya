// @ts-check
/**
 * Contact and visitor counts for agents and setup (documentation/desktop/spec.md §5.1, §5.4, §9.5; plan stage
 * 11.7): the options from the engine's catalogue (src/site/services/catalogue.json, the one edit mode reads), the
 * settings a choice makes in a site's content/site.json, a check that each answers, and the skill a new site's
 * repository carries. The value shapes mirror src/site/services/services.ts (test/services.test.mjs keeps them
 * equal). Nothing here is secret: every value is public by design.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineRoot } from './setup/engine.mjs';
import { findCheckoutAbove } from './checkout.mjs';

/** @typedef {{ who: 'person' | 'agent', text: string, url?: string }} Step */
/** @typedef {{ id: string, kind: string, tier: string, name: string, gives: string, asks: string, value: { field: string, label: string, shape: string, example: string }, steps: Step[], site?: string, pricing?: string, dashboard?: string, cookies: boolean, check: string, csp?: Record<string, string[]> }} Option */
/** @typedef {{ embedHosts: { host: string, name: string, path?: string }[], contact: Option[], counts: Option[], addons: Option[], shapes: Record<string, string> }} Catalogue */

/**
 * The engine's catalogue; an engine bundled before it existed (a stale apps/desktop/engine) falls back to the
 * checkout the app lives in. @param {string} [root] @returns {Catalogue}
 */
export function loadCatalogue(root = engineRoot()) {
  const file = (/** @type {string} */ dir) => join(dir, 'src', 'site', 'services', 'catalogue.json');
  const here = findCheckoutAbove(dirname(fileURLToPath(import.meta.url)));
  const found = [root, here].find((d) => d && existsSync(file(d)));
  if (!found) throw new Error(`The services catalogue isn't in the engine (${file(root)}).`);
  return JSON.parse(readFileSync(file(found), 'utf8'));
}

/** The shape each pasted value must have (as src/site/services/services.ts `SHAPES`). */
export const SHAPES = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  goatcounter: /^[a-z0-9-]{2,50}$/,
  ga4: /^G-[A-Z0-9]{4,}$/,
  clarity: /^[a-z0-9]{6,20}$/,
};

/** The allowed service an embed's link is on, or null. @param {Catalogue} c @param {string} url */
export function embedHost(c, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  return c.embedHosts.find((e) => (h === e.host || h.endsWith(`.${e.host}`)) && (!e.path || u.pathname.startsWith(e.path))) ?? null;
}

/** @param {Catalogue} c @param {string} shape @param {string} value */
export const fits = (c, shape, value) => (shape === 'embed' ? !!embedHost(c, value) : !!(/** @type {Record<string, RegExp>} */ (SHAPES))[shape]?.test(value));

/** Every option with its group. @param {Catalogue} c */
export const allOptions = (c) => [...c.contact.map((o) => ({ ...o, group: 'contact' })), ...c.counts.map((o) => ({ ...o, group: 'counts' })), ...c.addons.map((o) => ({ ...o, group: 'addons' }))];

/**
 * The option an id names: a catalogue option, or `embed` (any allowed form).
 * @param {Catalogue} c @param {string} id @returns {(Option & { group: string }) | null}
 */
export function optionOf(c, id) {
  if (id === 'embed') return /** @type {Option & { group: string }} */ ({ id: 'embed', kind: 'embed', group: 'contact', tier: 'powerful', name: 'Another form', value: { field: 'url', label: "The form's link", shape: 'embed', example: 'https://forms.office.com/r/abc123' }, steps: [{ who: 'person', text: 'Build the form on the service you use and copy its link.' }], check: 'preview', cookies: false });
  return allOptions(c).find((o) => o.id === id) ?? null;
}

/** Which option a site has chosen in a group, or null. @param {Catalogue} c @param {any} services @param {'contact' | 'counts'} group */
export function chosenIn(c, services, group) {
  if (group === 'contact') {
    const s = services?.contact;
    if (!s) return null;
    if (s.endpoint) return 'relay';
    if (s.kind === 'embed') return c.contact.find((o) => o.kind === 'embed' && o.name === embedHost(c, s.url)?.name)?.id ?? 'embed';
    return s.kind;
  }
  return services?.telemetry ? 'posthog' : (services?.counts?.kind ?? null);
}

/**
 * The site settings with a choice made, its value checked. Exit 10 (a person's step) when the value is missing.
 * @param {Catalogue} c @param {any} site content/site.json
 * @param {{ id: string, value?: string, address?: string }} o
 * @returns {{ ok: true, site: any } | { ok: false, needsPerson: boolean, message: string, steps?: Step[] }}
 */
export function setService(c, site, o) {
  const option = optionOf(c, o.id);
  if (!option) return { ok: false, needsPerson: false, message: `No option called ${o.id}. Try atiya services list.` };
  const value = (o.value ?? '').trim();
  if (!value) return { ok: false, needsPerson: option.steps.some((s) => s.who === 'person'), message: `${option.name} needs ${option.value.label.toLowerCase()}: ${option.steps.map((s) => `${s.who === 'person' ? '(you) ' : ''}${s.text}${s.url ? ` ${s.url}` : ''}`).join(' ')} Then run: atiya services set ${option.id} --value <${option.value.field}>`, steps: option.steps };
  if (!fits(c, option.value.shape, value)) return { ok: false, needsPerson: false, message: `That ${option.value.label.toLowerCase()} doesn't look right: ${c.shapes[option.value.shape]}` };
  if (option.value.shape === 'email' && /noreply\.github\.com$/i.test(value)) return { ok: false, needsPerson: false, message: "That's GitHub's no-reply address, which nobody reads: use the address visitors should write to." };
  const services = { ...site.services };
  if (option.group === 'contact') services.contact = { kind: option.kind, [option.value.field]: value };
  else if (option.group === 'counts') {
    const at = (o.address ?? services.counts?.site ?? services.telemetry?.site ?? '').trim();
    if (!/^https:\/\/[^/\s]+/.test(at)) return { ok: false, needsPerson: false, message: "Give the site's address with --address https://…: only a build for that address counts visits." };
    services.counts = { kind: option.kind, [option.value.field]: value, site: at.endsWith('/') ? at : `${at}/` };
    delete services.telemetry;
  } else {
    if (!services.counts && !services.telemetry) return { ok: false, needsPerson: false, message: 'Clarity counts beside a counting tool: set one first (atiya services set goatcounter …).' };
    services.clarity = { id: value };
  }
  return { ok: true, site: { ...site, services } };
}

/** The site settings without a group's choice (`counts` turns Clarity off too). @param {any} site @param {'contact' | 'counts' | 'clarity'} group */
export function offService(site, group) {
  const services = { ...site.services };
  if (group === 'contact') delete services.contact;
  if (group === 'counts') for (const k of ['counts', 'telemetry', 'clarity']) delete services[k];
  if (group === 'clarity') delete services.clarity;
  const next = { ...site, services };
  if (!Object.keys(services).length) delete next.services;
  return next;
}

/** A site folder's settings file. @param {string} dir */
export const siteFile = (dir) => join(dir, 'content', 'site.json');
/** @param {string} dir */
export function readSite(dir) {
  const f = siteFile(dir);
  if (!existsSync(f)) throw new Error(`No site here: ${f} doesn't exist. Use --dir with your site's folder.`);
  return JSON.parse(readFileSync(f, 'utf8'));
}
/** Writes content/site.json as the store does: two spaces, a final newline. @param {string} dir @param {any} site */
export const writeSite = (dir, site) => writeFileSync(siteFile(dir), JSON.stringify(site, null, 2) + '\n');

/**
 * Whether the chosen services answer: an embed's page and each counting tool's script load. A Web3Forms key is
 * checked by sending the person a test message, only when asked (`send`), since it lands in their inbox.
 * @param {Catalogue} c @param {any} site @param {{ fetch?: typeof fetch, send?: boolean }} [o]
 * @returns {Promise<{ check: string, ok: boolean, message: string }[]>}
 */
export async function checkServices(c, site, o = {}) {
  const f = o.fetch ?? fetch;
  const s = site.services ?? {};
  /** @type {{ check: string, ok: boolean, message: string }[]} */
  const out = [];
  const answers = async (/** @type {string} */ url) => {
    try {
      const r = await f(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
      return r.ok;
    } catch {
      return false;
    }
  };
  if (!s.contact) out.push({ check: 'contact', ok: false, message: 'No contact set: visitors have no way to reach you. Try atiya services set email --value you@example.com.' });
  else if (s.contact.kind === 'email') out.push({ check: 'contact', ok: true, message: `Email me opens ${s.contact.address}.` });
  else if (s.contact.kind === 'embed') out.push({ check: 'contact', ok: await answers(s.contact.url), message: `The embedded form at ${s.contact.url}.` });
  else if (s.contact.kind === 'web3forms') {
    if (!o.send) out.push({ check: 'contact', ok: true, message: 'Web3Forms is set. Add --send to send yourself a test message.' });
    else {
      let ok = false;
      try {
        const r = await f('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ access_key: s.contact.key, subject: 'A test message from Atiya Studio', from_name: 'Atiya Studio', message: 'Your Contact form works: messages from your site arrive here.' }), signal: AbortSignal.timeout(15_000) });
        ok = r.ok && (await r.json().catch(() => ({}))).success !== false;
      } catch {
        ok = false;
      }
      out.push({ check: 'contact', ok, message: ok ? 'Web3Forms took a test message: look in your inbox.' : "Web3Forms didn't take the test message: check the access key." });
    }
  } else out.push({ check: 'contact', ok: true, message: `Your own contact service at ${s.contact.endpoint}.` });
  const tool = s.counts ? optionOf(c, s.counts.kind) : null;
  if (s.counts?.kind === 'goatcounter') out.push({ check: 'counts', ok: await answers(`https://${s.counts.code}.goatcounter.com/`), message: `GoatCounter's dashboard at https://${s.counts.code}.goatcounter.com/ (counting ${s.counts.site}).` });
  else if (tool) out.push({ check: 'counts', ok: true, message: `${tool.name} counts ${s.counts.site}.` });
  else if (s.telemetry) out.push({ check: 'counts', ok: true, message: `PostHog counts ${s.telemetry.site}.` });
  if (s.clarity) out.push({ check: 'clarity', ok: true, message: 'Microsoft Clarity records visits, after a visitor accepts its cookies.' });
  return out;
}

/** The skill a new site's repository carries (.github/skills/site-services/SKILL.md), from the catalogue. @param {Catalogue} c */
export function servicesSkill(c) {
  const tier = (/** @type {string} */ t) => t[0].toUpperCase() + t.slice(1);
  const section = (/** @type {Option[]} */ list) =>
    list
      .map((o) => [`### ${o.name} (${tier(o.tier)}, \`${o.id}\`)`, '', `${o.gives} It asks: ${o.asks.replace(/^./, (s) => s.toLowerCase())}`, '', ...o.steps.map((s, i) => `${i + 1}. **${s.who === 'person' ? 'The person' : 'You (the agent) or the person'}:** ${s.text}${s.url ? ` <${s.url}>` : ''}`), '', `Then: \`atiya services set ${o.id} --value <${o.value.field}>\` (${c.shapes[o.value.shape]})`, ''].join('\n'))
      .join('\n');
  return `---
name: site-services
description: Use when the person wants visitors to reach them (a contact form, Email me, a booking page) or wants to count visits to their site (GoatCounter, Umami, Google Analytics, Microsoft Clarity). Sets content/site.json's services with the atiya command.
---

# Contact and visitor counts

This site has no server of its own: a contact form or a visit count is the person's own account with a service, set in \`content/site.json\`'s \`services\`. Every value is public by design (an address, a public key, an ID); never put a secret there.

- **List the options:** \`atiya services list --json\` (each with its tier: Simple, Balanced, Powerful).
- **Choose one:** \`atiya services set <id> --value <value> [--address https://…]\` (the address, for counts, is the site's own: only a build for it counts). Exit code 10 means a step only the person can do (a sign-up, an email click): show them the step and its link, then run the command again.
- **Check:** \`atiya services check [--send]\` (\`--send\` sends the person a test message through Web3Forms).
- **Turn off:** \`atiya services off contact|counts|clarity\`.
- Then commit \`content/site.json\` and push (or use Save to remote in Atiya Studio): the site changes with its next build.

Rules:

- Never sign up for a service on the person's behalf, and never use a provider's admin API without a key the person made and gave you.
- At most one counting tool. Google Analytics and Clarity set cookies: the site asks visitors before loading them.
- Counting tools never load on a private page, the Sign in page or a page showing shared cards; don't try to change that.
- An embedded form must be on one of these services: ${[...new Set(c.embedHosts.map((h) => h.name))].join(', ')}.

## Contact

${section(c.contact)}
### Another form (\`embed\`)

A form or booking page from any of the services above that isn't listed on its own. \`atiya services set embed --value <link>\`.

## Visitor counts

${section(c.counts)}
## Beside a count

${section(c.addons)}`;
}
