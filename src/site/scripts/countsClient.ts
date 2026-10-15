/**
 * The other counting tools (desktop spec §9.5, plan stage 11.4): GoatCounter, Umami, Google Analytics and
 * Microsoft Clarity, from the person's own accounts. Fetched on idle by the telemetry shim, only in a build for
 * the site's own address, and never where the visitor opted out. Each page it may count (scripts/countsRules.ts)
 * tells the tools its path; the tools that set cookies wait for the cookie notice's Accept.
 */
import { CONSENT_KEY, cleanReferrer, mayCount, needsConsent, scriptOf, toolsOf, type CountPage, type Tool } from './countsRules';

type Fn = ((...a: unknown[]) => void) & { q?: unknown[] };
type W = Window & {
  goatcounter?: { count(o: Record<string, unknown>): void };
  umami?: { track(f: (p: Record<string, unknown>) => Record<string, unknown>): void };
  dataLayer?: unknown[];
  gtag?: Fn;
  clarity?: Fn;
};
const w = window as W;

function page(): CountPage {
  const h = document.documentElement;
  return {
    access: h.dataset.access,
    signedIn: h.dataset.signedIn !== undefined,
    sealed: !!document.querySelector('template[data-sealed], [data-unlock-panel], [data-access-gate], [data-sealed-cards]'),
    hash: location.hash,
    search: location.search,
  };
}

const loaded = new Map<string, Promise<void>>();
function load(t: Tool): Promise<void> {
  const { src, attrs } = scriptOf(t);
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.async = true;
      s.src = src;
      for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('blocked'));
      document.head.append(s);
    });
    loaded.set(src, p);
  }
  return p;
}

function consent(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

/** Tells one tool about this page. */
function countOne(t: Tool) {
  const path = location.pathname;
  const referrer = cleanReferrer(document.referrer);
  const quiet = () => {
    /* blocked or offline: nothing is counted */
  };
  if (t.tool === 'goatcounter') void load(t).then(() => w.goatcounter?.count({ path, referrer, title: document.title }), quiet);
  else if (t.tool === 'umami') void load(t).then(() => w.umami?.track((p) => ({ ...p, url: path, referrer })), quiet);
  else if (t.tool === 'ga4') {
    if (!w.gtag) {
      w.dataLayer ??= [];
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag('js', new Date());
      w.gtag('config', t.id, { send_page_view: false });
    }
    w.gtag('event', 'page_view', { page_location: `${location.origin}${path}`, page_referrer: referrer, page_title: document.title });
    void load(t).catch(quiet);
  } else {
    w.clarity ??= Object.assign((...a: unknown[]) => void (w.clarity!.q ??= []).push(a), {});
    w.clarity('start');
    void load(t).catch(quiet);
  }
}

/** Counts this page with every tool that may, and stops Clarity where it may not record. */
function countPage(tools: Tool[]) {
  const p = page();
  const answer = consent();
  for (const t of tools) {
    if (!mayCount(p, t)) {
      if (t.tool === 'clarity') w.clarity?.('stop');
      continue;
    }
    if (needsConsent(t) && answer !== 'yes') continue;
    countOne(t);
  }
  // the cookie notice, while the visitor hasn't answered and a tool here waits for it
  const notice = document.querySelector<HTMLElement>('[data-consent]');
  if (notice) notice.hidden = !(answer === null && tools.some((t) => needsConsent(t) && mayCount(p, t)));
}

/** Starts counting (once per page load; a page the router swaps in is counted too). */
export function startCounts(json: string | undefined): void {
  const tools = toolsOf(json);
  if (!tools.length) return;
  const answer = (yes: boolean) => {
    try {
      localStorage.setItem(CONSENT_KEY, yes ? 'yes' : 'no');
    } catch {
      /* not kept: asked again on the next page */
    }
    const notice = document.querySelector<HTMLElement>('[data-consent]');
    if (notice) notice.hidden = true;
    if (yes) for (const t of tools.filter(needsConsent)) if (mayCount(page(), t)) countOne(t);
  };
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('[data-consent-answer]');
    if (b) answer(b.getAttribute('data-consent-answer') === 'yes');
  });
  document.addEventListener('astro:after-swap', () => countPage(tools));
  countPage(tools);
}
