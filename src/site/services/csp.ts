/**
 * The site's Content Security Policy and referrer policy (documentation/access/spec.md §6.4; security review F4,
 * P4): what a built page may load, run, connect to and frame, made from the site's services, so every site the
 * engine builds allows exactly its own. GitHub Pages sends no headers, so it's a `<meta http-equiv>` at the top
 * of every page's head; never in dev (Vite runs inline modules, eval and a websocket). Pure, for the build
 * (integrations/services.mjs, integrations/csp.mjs), the leak check (scripts/verify-sealed.mjs) and the tests.
 *
 * Inline scripts are allowed by their hashes, collected from the whole build after it's written (one policy for
 * every page, as the client-side router keeps the first page's): `'unsafe-inline'` stands in for them until then.
 */
import { catalogue, embedHost, type ContactSetting } from './services.ts';
import { VIDEO_HOSTS } from '../content/providers.ts';

export const DIRECTIVES = ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'media-src', 'worker-src', 'object-src', 'base-uri', 'form-action'] as const;
export type Directive = (typeof DIRECTIVES)[number];
export type Sources = Partial<Record<Directive, string[]>>;

/** The players a video block embeds (VideoEmbed.astro): every provider's hosts (src/site/content/providers.ts). */
export { VIDEO_HOSTS };
/** PostHog's host when the site names none (scripts/telemetryClient.ts). */
export const POSTHOG_DEFAULT = 'https://us.i.posthog.com';
/** Umami's host when the site names none (scripts/countsRules.ts). */
export const UMAMI_DEFAULT = 'https://cloud.umami.is';
/** The test build's made-up hosts (scripts/telemetry.ts `TEST_HOST`, .env.test): the E2E tests intercept them. */
export const TEST_TELEMETRY = 'https://telemetry.test';

/** What every site allows: its own files, and nothing else until a service asks. */
export const BASE: Record<Directive, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  // blob: the planet's glTF loader fetches the pictures packed in its models through blob URLs it made itself
  'connect-src': ["'self'", 'blob:'],
  'frame-src': ["'self'", ...VIDEO_HOSTS],
  'media-src': ["'self'", 'blob:'],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/** A counting tool the build carries (PUBLIC_COUNTS, scripts/countsRules.ts `Tool`). */
export type CountTool = { tool: 'goatcounter'; code: string } | { tool: 'umami'; id: string; host?: string } | { tool: 'ga4'; id: string } | { tool: 'clarity'; id: string };

export interface PolicyInput {
  /** The site's contact setting (`services.contact`): Web3Forms posts to its API, an embedded form is framed. */
  contact?: ContactSetting;
  /** The contact service the build carries (PUBLIC_CONTACT_ENDPOINT): the form and a private page's agreement post to it. */
  contactEndpoint?: string;
  /** PostHog's host, when the build sends telemetry. */
  telemetryHost?: string;
  /** The counting tools the build carries. */
  counts?: CountTool[];
}

/** An address's origin, if it's one a policy may name (https, or http on this computer); else null. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const local = u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
    return u.protocol === 'https:' || local ? u.origin : null;
  } catch {
    return null;
  }
}

/** A host source a catalogue option may add: an https origin, optionally a `*.` subdomain wildcard. */
const HOST_SOURCE = /^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i;

/** An option's `csp` with its placeholders filled; a source that comes out malformed is dropped. */
function fill(csp: Sources | undefined, values: Record<string, string | null | undefined>): Sources {
  const out: Sources = {};
  for (const [d, list] of Object.entries(csp ?? {}) as [Directive, string[]][]) {
    out[d] = list.flatMap((s) => {
      let missing = false;
      const v = s.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? ((missing = true), ''));
      return !missing && HOST_SOURCE.test(v) ? [v] : [];
    });
  }
  return out;
}

const optionCsp = (id: string) => [...catalogue.contact, ...catalogue.counts, ...catalogue.addons].find((o) => o.id === id && 'csp' in o) as { csp: Sources } | undefined;

/** What the contact setting adds: Web3Forms' API, or the embedded form's origin. */
function contactSources(c: ContactSetting | undefined): Sources {
  if (!c || 'endpoint' in c) return {};
  if (c.kind === 'embed') {
    if (!embedHost(c.url)) return {};
    const named = catalogue.contact.find((o) => o.kind === 'embed' && o.name === embedHost(c.url)?.name);
    return fill((named && optionCsp(named.id)?.csp) ?? { 'frame-src': ['{origin}'] }, { origin: originOf(c.url) });
  }
  return fill(optionCsp(c.kind)?.csp, {});
}

/** What a counting tool adds. */
function countSources(t: CountTool): Sources {
  const values = t.tool === 'goatcounter' ? { code: /^[a-z0-9-]{2,50}$/.test(t.code) ? t.code : null } : t.tool === 'umami' ? { host: originOf(t.host ?? UMAMI_DEFAULT) } : {};
  return fill(optionCsp(t.tool)?.csp, values);
}

/** Every directive's sources for a site: the base, then each service's own. */
export function cspSources(input: PolicyInput): Record<Directive, string[]> {
  const out = Object.fromEntries(DIRECTIVES.map((d) => [d, [...BASE[d]]])) as Record<Directive, string[]>;
  const add = (s: Sources) => {
    for (const [d, list] of Object.entries(s) as [Directive, string[]][]) for (const v of list) if (!out[d].includes(v)) out[d].push(v);
  };
  const endpoint = originOf(input.contactEndpoint);
  if (endpoint) add({ 'connect-src': [endpoint] });
  add(contactSources(input.contact));
  const telemetry = originOf(input.telemetryHost);
  if (telemetry) add({ 'connect-src': [telemetry] });
  for (const t of input.counts ?? []) add(countSources(t));
  return out;
}

/** The policy as a meta tag's content. */
export const cspPolicy = (input: PolicyInput) => serialize(cspSources(input));

export function serialize(sources: Partial<Record<Directive, string[]>>): string {
  return DIRECTIVES.filter((d) => sources[d]?.length)
    .map((d) => `${d} ${sources[d]!.join(' ')}`)
    .join('; ');
}

/** A policy read back into its directives. */
export function parsePolicy(policy: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) m.set(name.toLowerCase(), values);
  }
  return m;
}

/** The policy with its scripts allowed by these hashes (`'sha256-…'`) instead of `'unsafe-inline'`. */
export function withScriptHashes(policy: string, hashes: string[]): string {
  return policy
    .split('; ')
    .map((part) => {
      if (!part.startsWith('script-src ')) return part;
      const kept = part.split(' ').filter((s) => s !== "'unsafe-inline'");
      return [...kept, ...[...new Set(hashes)].sort().map((h) => `'${h}'`)].join(' ');
    })
    .join('; ');
}

/** The referrer policy: a private page's is stricter (no referrer to other sites, documentation/access/spec.md §5.4). */
export const referrerPolicy = (sealed: boolean) => (sealed ? 'same-origin' : 'strict-origin-when-cross-origin');

const EXECUTABLE = /^(|module|text\/javascript|application\/javascript)$/i;

/** The text of each inline script a page runs (not a `src` script, not JSON data), as the browser hashes it (UTF-8, sha256, base64). */
export function inlineScripts(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1] ?? '';
    // the parser turns every CR LF and lone CR into LF before the browser hashes the text
    if (EXECUTABLE.test(type)) out.push(m[2].replace(/\r\n?/g, '\n'));
  }
  return out;
}

/** The CSP meta tag's policy on a page, or null. */
export function policyIn(html: string): string | null {
  const tag = /<meta\b[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/i.exec(html)?.[0];
  return tag ? (/\scontent="([^"]*)"/i.exec(tag)?.[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') ?? null) : null;
}

/** The referrer policies a page may carry: the site's, or a stricter one. */
export const REFERRER_POLICIES = ['strict-origin-when-cross-origin', 'same-origin', 'strict-origin', 'no-referrer'];

/**
 * What's wrong with a built page's head, as categories (never the page's words): the policy and the referrer
 * policy must come before anything it loads or runs, scripts are allowed by hash only, no eval, no inline
 * event handler (no hash allows one), and every inline script it runs is one the policy names.
 * @param hash an inline script's hash, `sha256-…`
 */
export function headFindings(html: string, hash: (text: string) => string): string[] {
  const found: string[] = [];
  const first = html.search(/<(script|link|style|base)\b/i);
  const before = first < 0 ? html : html.slice(0, first);
  const policy = policyIn(before);
  if (!policy) found.push('no Content Security Policy before the first script, link or style');
  const referrer = /<meta\b[^>]*name=["']?referrer["']?[^>]*content="([^"]*)"/i.exec(before)?.[1];
  if (!referrer || !REFERRER_POLICIES.includes(referrer)) found.push('no referrer policy before the first script, link or style');
  if (policy) {
    const p = parsePolicy(policy);
    const scripts = p.get('script-src') ?? [];
    if (/'unsafe-eval'/.test(policy)) found.push("the policy allows 'unsafe-eval'");
    if (scripts.includes("'unsafe-inline'")) found.push("the policy allows any inline script ('unsafe-inline')");
    for (const d of ['script-src', 'connect-src'] as const) if ((p.get(d) ?? []).some((s) => s === '*' || /^(https?|wss?|data):?$/i.test(s) || (d === 'script-src' && /^blob:?$/i.test(s)))) found.push(`${d} allows any host or scheme`);
    for (const d of ['object-src', 'base-uri']) if (!p.has(d)) found.push(`the policy has no ${d}`);
    const allowed = new Set(scripts);
    if (inlineScripts(html).some((s) => !allowed.has(`'${hash(s)}'`))) found.push('an inline script the policy has no hash for');
  }
  if (/<[a-z][^>]*\son[a-z]+\s*=\s*["'][^"']/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''))) found.push('an inline event handler (no policy can allow it by hash)');
  return found;
}
