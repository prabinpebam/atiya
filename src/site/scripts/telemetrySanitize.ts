/**
 * Telemetry's last line before anything leaves the browser (documentation/access/spec.md §9.2, §9.4), pure
 * so it's unit-tested: how a followed link and a played video are described, and `before_send`, which
 * strips fragments from every address on every page and replaces a private page's token with `private`
 * wherever it appears (security review P7), and on protected pages and the Sign in page lets
 * through only the allowlisted events and properties, with the page's address, title and referrer replaced
 * by opaque ones. Only the PostHog chunk (scripts/telemetryClient.ts) carries it.
 */
import type { PageFacts } from './telemetryRules';
import { RESERVED } from '../content/routes';

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

const LIGHTBOX_PLACES = ['album', 'section', 'article', 'block'];
const LIGHTBOX_KINDS = ['picture', 'animated', 'drawing', 'video', 'embed'];

/**
 * `lightbox_opened`'s properties (gallery spec §14), from the lightbox's `site:lightbox` detail: where it opened
 * (`album`, `section`, `article` or `block`) and the kind of item, never which; null for anything else. A band's
 * tile (`band`) opens it on a section's page (`index`) or in an article's album block; `page` is an article.
 */
export function lightboxProps(detail: unknown, index: boolean): { place: string; kind: string } | null {
  const d = (detail ?? {}) as { place?: unknown; kind?: unknown };
  const place = d.place === 'band' ? (index ? 'section' : 'block') : d.place === 'page' ? 'article' : d.place;
  return typeof place === 'string' && typeof d.kind === 'string' && LIGHTBOX_PLACES.includes(place) && LIGHTBOX_KINDS.includes(d.kind) ? { place, kind: d.kind } : null;
}

/**
 * `video_played`'s properties: nothing for a band's tile playing on its own, only the place `lightbox` from the
 * lightbox's player (gallery spec §14), else an open page's published file's media ID or where it played.
 */
export function videoProps(q: { v?: Pick<Element, 'closest'>; src: string; place: string; open: boolean }, base: string): { media: string } | { place: string } | null {
  if (q.v?.closest('[data-band-motion]')) return null;
  if (q.v?.closest('[data-lightbox-dialog]')) return { place: 'lightbox' };
  const id = q.open ? mediaId(q.src, base) : null;
  return id ? { media: id } : { place: q.place };
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

/** A private page's token, the last segment of its address (the schema's `accessToken`; documentation/access/spec.md §2). */
const TOKEN = '[a-z2-7]{10}';
const masks = new Map<string, RegExp>();

/**
 * `v` with every private page's token replaced by `private` (`/work/private/`), wherever it is: an address,
 * a path, or inside a longer string (autocapture's element chain). A private page is a token under a section
 * (`<base>/<section>/<token>`), so every path of that shape is taken for one, except the code's own
 * (`/play/<building>/`, the design library) and `own`, the open page being sent (a public slug can have the shape).
 */
export function maskTokens(v: string, base: string, own?: string): string {
  if (!v.includes('/') && !/%2f/i.test(v)) return v;
  let re = masks.get(base);
  // a slash, or one encoded in a query (`?return=%2Fwork%2F…`)
  const s = '(/|%2[Ff])';
  const b = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '(?:/|%2[Ff])');
  if (!re) masks.set(base, (re = new RegExp(`(^|["'=\\s(]|//[^/"'\\s]+)(${b})${s}([a-z0-9][a-z0-9-]*)${s}(${TOKEN})(?=[/?#&%"'\\s)]|$)`, 'g')));
  return v.replace(re, (m, pre: string, at: string, s1: string, seg: string, s2: string, tok: string) =>
    RESERVED.includes(seg) || own?.startsWith(`${base}/${seg}/${tok}/`) || own === `${base}/${seg}/${tok}` ? m : `${pre}${at}${s1}${seg}${s2}private`,
  );
}

/** Every string, at any depth, without a private page's token, and every address-like one without its fragment (every page). Only plain objects and arrays are copied: a `Date` (the event's timestamp) is kept as it is. */
function scrub(v: unknown, mask: (s: string) => string): unknown {
  if (typeof v === 'string') return mask(URLISH.test(v) && v.includes('#') ? withoutFragment(v) : v);
  if (Array.isArray(v)) return v.map((x) => scrub(x, mask));
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x, mask)]));
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
  lightbox_opened: ['place', 'kind'],
  web_vitals: ['kind', 'lcp', 'lcp_rating', 'inp', 'inp_rating', 'cls', 'cls_rating'],
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

/**
 * `before_send`: the event as it may leave the browser, or null to drop it. `base` is the site's base path
 * (`/atiya`, or empty), so a private page's token is found in every address it sends.
 */
export function sanitize(e: CaptureEvent | null, page: PageFacts, base: string): CaptureEvent | null {
  if (!e) return null;
  // the page being sent keeps its own address when it's open (never a private page's)
  const self = page.access ? undefined : page.pathname;
  const clean = scrub(e, (s) => maskTokens(s, base, self)) as CaptureEvent;
  // a place is a path without the base (`/work/<token>/`)
  const place = clean.properties?.place;
  if (typeof place === 'string') clean.properties!.place = maskTokens(place, '', self?.slice(base.length));
  if (page.mode === 'open') return clean;
  const own = ALLOWLIST[clean.event];
  if (!own) return null;
  const props = clean.properties ?? {};
  const kept: Record<string, unknown> = {};
  for (const k of [...SYSTEM_PROPS, ...own]) if (k in props) kept[k] = props[k];
  if (clean.event === '$pageview') {
    const path = maskTokens(page.pathname, base, self);
    kept.$current_url = `${page.origin}${path}`;
    kept.$pathname = path;
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
