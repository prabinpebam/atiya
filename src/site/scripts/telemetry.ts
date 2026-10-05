/**
 * Telemetry (documentation/access/spec.md §9): PostHog, only in a production build given a project key,
 * never in dev or edit mode, and not at all where the visitor opted out (Global Privacy Control, Do Not
 * Track, or `?telemetry=off` on this device). This part runs on every page and stays small: it hears the
 * sign-in runtime's `site:access` events, links followed on allowlisted pages and videos played, and queues
 * them; PostHog and the rules for what it may send (scripts/telemetryClient.ts) are fetched on idle. A test
 * build sends to a fake host, and only when a test asks (`localStorage['site.test.telemetry']`).
 */
import { OPT_OUT_KEY, optOut, type PageFacts, type Queued } from './telemetryRules';

export const TEST_HOST = 'https://telemetry.test';
const TEST = import.meta.env.MODE === 'test';
const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const html = document.documentElement;

const queue: Queued[] = [];
let client: { run: (q: Queued) => void } | null = null;
let started = false;
/** Shared cards were shown on this page: from then on it's allowlisted, like a protected page. */
let shared = false;

/** Whether this build and this visitor send anything. */
function enabled(): boolean {
  if (import.meta.env.DEV) return false;
  let s: Storage | null = null;
  try {
    s = localStorage;
  } catch {
    /* storage is off: no stored choice */
  }
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  const o = optOut({ gpc: n.globalPrivacyControl, dnt: n.doNotTrack, search: location.search, stored: s?.getItem(OPT_OUT_KEY) ?? null });
  if (o.store) s?.setItem(OPT_OUT_KEY, o.store);
  else if (o.store === null) s?.removeItem(OPT_OUT_KEY);
  if (o.off) return false;
  return TEST ? s?.getItem('site.test.telemetry') === '1' : !!import.meta.env.PUBLIC_POSTHOG_KEY;
}

/** What this page is: a protected page, the Sign in page or a page showing shared cards is allowlisted. */
export function pageFacts(): PageFacts {
  const access = html.dataset.access;
  const signIn = !access && !!document.querySelector('[data-unlock-panel]');
  return { mode: access || signIn || shared ? 'allowlist' : 'open', access, signIn, origin: location.origin, pathname: location.pathname };
}

const push = (q: Queued) => (client ? client.run(q) : queue.push(q));

/** Sends one of the site's own events (the planet's `planet_opened`). */
export function track(event: string, props: Record<string, unknown> = {}) {
  if (started) push({ kind: 'capture', event, props });
}

function onAccess(e: Event) {
  const { event, ...props } = (e as CustomEvent<{ event: string; grant?: string; cards?: number }>).detail ?? {};
  if (!event) return;
  if (props.grant && (event === 'access_session' || event === 'access_signed_in')) push({ kind: 'identify', grant: props.grant });
  if (event === 'access_session') return;
  if (event === 'access_opened' && props.cards !== undefined && !shared) {
    shared = true;
    push({ kind: 'allowlist' });
  }
  const out = event === 'access_signed_out';
  push({ kind: 'capture', event, props, beacon: out });
  if (out) {
    push({ kind: 'reset' });
    // leaving the page at once: forget the identity even if PostHog never loaded
    if (!client)
      try {
        for (const k of Object.keys(sessionStorage)) if (k.startsWith('ph_')) sessionStorage.removeItem(k);
      } catch {
        /* nothing was kept */
      }
  }
}

/** Starts telemetry on this page (once; a page the router swaps in sends its own page view). */
export function startTelemetry(): void {
  if (started || !enabled()) return;
  started = true;
  const d = document;
  d.addEventListener('site:access', onAccess);
  d.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (a && pageFacts().mode === 'allowlist') push({ kind: 'link', href: a.getAttribute('href')!, here: location.href });
    },
    true,
  );
  d.addEventListener(
    'play',
    (e) => {
      if (e.target instanceof HTMLVideoElement) push({ kind: 'video', src: e.target.currentSrc, place: location.pathname.slice(base.length), open: pageFacts().mode === 'open' });
    },
    true,
  );
  d.addEventListener('astro:after-swap', () => {
    shared = false;
    push({ kind: 'pageview' });
  });
  push({ kind: 'pageview' });
  const load = () =>
    import('./telemetryClient').then(
      (m) => {
        client = m.connect({ test: TEST, testHost: TEST_HOST, base, page: pageFacts });
        for (const q of queue.splice(0)) client.run(q);
      },
      () => {
        /* blocked or offline: nothing is sent */
      },
    );
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 1500);
}
