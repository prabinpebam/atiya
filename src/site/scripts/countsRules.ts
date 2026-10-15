/**
 * The other counting tools' rules (desktop spec §9.5, plan stage 11.4): which pages they may count, what each
 * is told, and which wait for the visitor's consent. Pure; scripts/countsClient.ts applies them. Every tool
 * hears only a page's path (never its query or fragment, where a code may be) and a referrer cut to its
 * origin and path.
 */

export type Tool = { tool: 'goatcounter'; code: string } | { tool: 'umami'; id: string; host?: string } | { tool: 'ga4'; id: string } | { tool: 'clarity'; id: string };

/** The tools a build carries (PUBLIC_COUNTS); anything unreadable is none. */
export function toolsOf(json: string | undefined): Tool[] {
  try {
    const list = JSON.parse(json || '[]') as Tool[];
    return Array.isArray(list) ? list.filter((t) => ['goatcounter', 'umami', 'ga4', 'clarity'].includes(t?.tool)) : [];
  } catch {
    return [];
  }
}

/** Tools that set cookies, so they load only after the visitor accepts. */
export const needsConsent = (t: Tool) => t.tool === 'ga4' || t.tool === 'clarity';

/** The key the visitor's answer is kept under ('yes' or 'no'). */
export const CONSENT_KEY = 'site.consent';

/** The tools' names, for the cookie notice. */
export const TOOL_NAMES: Record<Tool['tool'], string> = { goatcounter: 'GoatCounter', umami: 'Umami', ga4: 'Google Analytics', clarity: 'Microsoft Clarity' };

/** What a page is, as far as counting goes. */
export interface CountPage {
  /** A private page (`<html data-access>`). */
  access?: string;
  /** Signed in on this device (`<html data-signed-in>`): any page may show shared cards. */
  signedIn: boolean;
  /** Something sealed, a sign-in panel, a gate or shared cards on the page. */
  sealed: boolean;
  /** The address's fragment and query. */
  hash: string;
  search: string;
}

/**
 * Whether a page may be counted: never a private page, the Sign in page, a page that can show shared cards, a
 * magic link, or anything while signed in. Clarity, which records what's on the page and its whole address,
 * also stays off a page opened with a query or a fragment.
 */
export function mayCount(p: CountPage, t?: Tool): boolean {
  if (p.access || p.signedIn || p.sealed || /(^#|&)a=/.test(p.hash)) return false;
  return t?.tool !== 'clarity' || (!p.hash && !p.search);
}

/** A referrer as a tool may hear it: its origin and path, or nothing. */
export function cleanReferrer(ref: string): string {
  try {
    const u = new URL(ref);
    return /^https?:$/.test(u.protocol) ? `${u.origin}${u.pathname}` : '';
  } catch {
    return '';
  }
}

/**
 * GoatCounter's hit, sent by the site itself rather than its count.js, which always adds the page's query (`q`).
 * Its own endpoint's parameters: path, referrer, title, and a random value against caching.
 */
export function goatcounterHit(code: string, o: { path: string; referrer: string; title: string; rnd: string }): string {
  const q = new URLSearchParams({ p: o.path, ...(o.referrer ? { r: o.referrer } : {}), t: o.title, rnd: o.rnd });
  return `https://${code}.goatcounter.com/count?${q}`;
}

/** The script each tool loads, with its attributes (GoatCounter's only names its host: the site sends its hits, goatcounterHit). */
export function scriptOf(t: Tool): { src: string; attrs: Record<string, string> } {
  switch (t.tool) {
    case 'goatcounter':
      return { src: 'https://gc.zgo.at/count.js', attrs: { 'data-goatcounter': `https://${t.code}.goatcounter.com/count`, 'data-goatcounter-settings': '{"no_onload":true}' } };
    case 'umami':
      return { src: `${(t.host ?? 'https://cloud.umami.is').replace(/\/+$/, '')}/script.js`, attrs: { 'data-website-id': t.id, 'data-auto-track': 'false', 'data-exclude-search': 'true', 'data-exclude-hash': 'true' } };
    case 'ga4':
      return { src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t.id)}`, attrs: {} };
    case 'clarity':
      return { src: `https://www.clarity.ms/tag/${encodeURIComponent(t.id)}`, attrs: {} };
  }
}

/** The hosts a counting tool's script comes from: none may be in a sealed page (scripts/verify-sealed.mjs). */
export const COUNT_HOSTS = ['gc.zgo.at', 'goatcounter.com', 'cloud.umami.is', 'umami.is', 'googletagmanager.com', 'google-analytics.com', 'clarity.ms'];
