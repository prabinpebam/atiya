/**
 * Telemetry's last line before anything leaves the browser (documentation/access/spec.md §9.2, §9.4), pure
 * so it's unit-tested: how a followed link and a played video are described, and `before_send`, which
 * strips fragments from every address on every page, and on protected pages and the Sign in page lets
 * through only the allowlisted events and properties, with the page's address, title and referrer replaced
 * by opaque ones. Only the PostHog chunk (scripts/telemetryClient.ts) carries it.
 */
import type { PageFacts } from './telemetryRules';

/** A followed link, as `access_link` describes it: its kind and, if it leaves the site, its domain only. */
export function linkKind(href: string, here: string, base: string): { kind: 'internal' | 'outbound' | 'download'; domain?: string } | null {
  let url: URL;
  try {
    url = new URL(href, here);
  } catch {
    return null;
  }
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return { kind: 'outbound', domain: url.protocol.slice(0, -1) };
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const origin = new URL(here).origin;
  if (url.origin !== origin) return { kind: 'outbound', domain: url.hostname };
  const root = base.replace(/\/$/, '');
  return url.pathname.startsWith(`${root}/media/`) && /\.(pdf|zip|docx?|pptx?|xlsx?)$/i.test(url.pathname) ? { kind: 'download' } : { kind: 'internal' };
}

/** A played video's media ID, from a published file's address (`<base>/media/<id>.<ext>`); none for a decrypted one. */
export function mediaId(src: string, base: string): string | null {
  const root = base.replace(/\/$/, '');
  const m = /^(?:https?:\/\/[^/]+)?(.*)$/.exec(src)?.[1] ?? '';
  if (!m.startsWith(`${root}/media/`)) return null;
  const id = m.slice(root.length + '/media/'.length).replace(/\.[a-z0-9]+$/i, '');
  return /^[\w.-]+$/.test(id) ? id : null;
}

/** The neutral title an allowlisted page view carries. */
export function neutralTitle(access: string | undefined, signIn: boolean): string {
  return access === 'private' ? 'Private page' : signIn ? 'Sign in' : 'Page';
}

/** An address without its fragment (where a magic link's secret lives). */
export function withoutFragment(value: string): string {
  const i = value.indexOf('#');
  return i < 0 ? value : value.slice(0, i);
}

const URLISH = /^(https?:)?\/\/|^\//;

/** Every address-like string, at any depth, without its fragment (every page). Only plain objects and arrays are copied: a `Date` (the event's timestamp) is kept as it is. */
function stripFragments(v: unknown): unknown {
  if (typeof v === 'string') return URLISH.test(v) && v.includes('#') ? withoutFragment(v) : v;
  if (Array.isArray(v)) return v.map(stripFragments);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripFragments(x)]));
  return v;
}

/** The events a protected page (or the Sign in page) may send, and each one's own properties. */
export const ALLOWLIST: Record<string, readonly string[]> = {
  $pageview: ['$current_url', '$pathname', '$title', '$referrer', '$referring_domain'],
  $identify: ['$anon_distinct_id'],
  access_signed_in: ['grant', 'via'],
  access_opened: ['grant', 'place', 'cards'],
  access_failed: ['reason'],
  access_signed_out: ['grant'],
  access_agreed: ['grant'],
  access_link: ['kind', 'domain'],
  video_played: ['place'],
};

/**
 * What PostHog adds to every event that says nothing about the page's content: the library, the device,
 * the browser, the session and the identity. Kept on allowlisted events, since they're what make a visit.
 */
export const SYSTEM_PROPS: readonly string[] = [
  'token',
  'distinct_id',
  '$device_id',
  '$session_id',
  '$window_id',
  '$insert_id',
  '$time',
  '$lib',
  '$lib_version',
  '$lib_custom_api_host',
  '$is_identified',
  '$process_person_profile',
  '$os',
  '$os_version',
  '$browser',
  '$browser_version',
  '$browser_language',
  '$browser_language_prefix',
  '$device',
  '$device_type',
  '$screen_height',
  '$screen_width',
  '$viewport_height',
  '$viewport_width',
  '$timezone',
  '$timezone_offset',
  '$raw_user_agent',
  '$host',
  '$configured_session_timeout_ms',
  '$pageview_id',
  '$sent_at',
];

export interface CaptureEvent {
  event: string;
  properties?: Record<string, unknown>;
  [k: string]: unknown;
}


/** The referrer's origin only (allowlisted pages), or nothing. */
function originOnly(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v || v === '$direct') return typeof v === 'string' ? v : undefined;
  try {
    return new URL(v).origin;
  } catch {
    return undefined;
  }
}

/** `before_send`: the event as it may leave the browser, or null to drop it. */
export function sanitize(e: CaptureEvent | null, page: PageFacts): CaptureEvent | null {
  if (!e) return null;
  const clean = stripFragments(e) as CaptureEvent;
  if (page.mode === 'open') return clean;
  const own = ALLOWLIST[clean.event];
  if (!own) return null;
  const props = clean.properties ?? {};
  const kept: Record<string, unknown> = {};
  for (const k of [...SYSTEM_PROPS, ...own]) if (k in props) kept[k] = props[k];
  if (clean.event === '$pageview') {
    kept.$current_url = `${page.origin}${page.pathname}`;
    kept.$pathname = page.pathname;
    kept.$title = neutralTitle(page.access, page.signIn);
    const ref = originOnly(props.$referrer);
    if (ref) kept.$referrer = ref;
    else delete kept.$referrer;
  }
  // the event's own top-level fields: no person properties ($set, $set_once) leave a protected page
  const out: CaptureEvent = { event: clean.event, properties: kept };
  for (const k of ['uuid', 'timestamp']) if (k in clean) out[k] = clean[k];
  return out;
}
