/**
 * The site's field data (documentation/access/spec.md §9.2; documentation/engineering/performance.md, field
 * data): Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift from real visits,
 * measured with the browser's own PerformanceObserver (no library) and sent once, as `web_vitals`, the first
 * time the page is hidden or left. Only PostHog's chunk (scripts/telemetryClient.ts) carries it, so it runs
 * only where telemetry does; its observers are buffered, so starting them on idle still sees the page's
 * first paints and shifts. The rules are pure, so they're unit-tested: the thresholds and ratings, CLS's
 * session windows, INP from interactions, the page's coarse kind, and what the event carries (numbers,
 * rounded, and ratings: never an address, a title or an ID).
 */

export type Vital = 'lcp' | 'inp' | 'cls';
export type Rating = 'good' | 'needs-improvement' | 'poor';

/** Web Vitals' thresholds (web.dev/articles/vitals): good up to the first, poor beyond the second. LCP and INP in ms. */
export const THRESHOLDS: Record<Vital, readonly [number, number]> = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] };

/** A value's rating against its thresholds. */
export function rating(metric: Vital, value: number): Rating {
  const [good, poor] = THRESHOLDS[metric];
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

/** A value as it's sent: LCP and INP to the nearest 10 ms, CLS to three decimals. */
export function rounded(metric: Vital, value: number): number {
  return metric === 'cls' ? Math.round(value * 1000) / 1000 : Math.round(value / 10) * 10;
}

/** A `layout-shift` entry, as CLS needs it. */
export interface Shift {
  value: number;
  startTime: number;
  hadRecentInput?: boolean;
}

/**
 * CLS: the largest session window's sum. A window gathers shifts less than 1 s apart, for at most 5 s; a
 * shift just after the reader's own input doesn't count.
 */
export function clsOf(shifts: readonly Shift[]): number {
  let best = 0;
  let sum = 0;
  let first = 0;
  let last = 0;
  let open = false;
  for (const s of shifts) {
    if (s.hadRecentInput) continue;
    if (open && s.startTime - last < 1000 && s.startTime - first < 5000) sum += s.value;
    else {
      sum = s.value;
      first = s.startTime;
      open = true;
    }
    last = s.startTime;
    best = Math.max(best, sum);
  }
  return best;
}

/** An `event` or `first-input` entry, as INP needs it: the events of one interaction share its ID (0: not an interaction). */
export interface InteractionEntry {
  interactionId?: number;
  duration: number;
}

/** Keeps each interaction's longest event. */
export function addInteraction(longest: Map<number, number>, e: InteractionEntry): void {
  if (!e.interactionId) return;
  longest.set(e.interactionId, Math.max(longest.get(e.interactionId) ?? 0, e.duration));
}

/**
 * INP: the longest interaction, leaving out one for every 50 the page had (its 98th percentile), or nothing
 * without one. `count` is how many interactions the page had (`performance.interactionCount`, where the
 * browser has it: the short ones the observer doesn't hear count too); at least those heard.
 */
export function inpOf(longest: ReadonlyMap<number, number>, count = 0): number | undefined {
  if (!longest.size) return undefined;
  const d = [...longest.values()].sort((a, b) => b - a);
  return d[Math.min(d.length - 1, Math.floor(Math.max(count, longest.size) / 50))];
}

/** A `largest-contentful-paint` entry, as LCP needs it. */
export interface PaintEntry {
  startTime: number;
}

/**
 * LCP: the last candidate painted before the page was first hidden (a paint after it isn't what the reader
 * waited for), from the page's activation (a prerendered page's start), or nothing without one.
 */
export function lcpOf(entries: readonly PaintEntry[], o: { hiddenAt?: number; activationStart?: number } = {}): number | undefined {
  let at: number | undefined;
  for (const e of entries) if (o.hiddenAt === undefined || e.startTime <= o.hiddenAt) at = e.startTime;
  return at === undefined ? undefined : Math.max(0, at - (o.activationStart ?? 0));
}

/** What a page is, coarsely: never its address, title or ID. */
export type PageKind = 'home' | 'section' | 'page' | 'planet' | 'planet-page' | 'library' | 'sign-in' | 'private';

/** The page's kind, from its path below the base, its access and its frame. */
export function pageKind(p: { path: string; access?: string; signIn: boolean; frame?: string }): PageKind {
  if (p.access) return 'private';
  if (p.signIn) return 'sign-in';
  if (p.frame === 'planet') return 'planet-page';
  const parts = p.path.split(/[?#]/)[0].split('/').filter(Boolean);
  if (parts[0] === 'play') return 'planet';
  if (parts[0] === 'design') return 'library';
  return parts.length === 0 ? 'home' : parts.length === 1 ? 'section' : 'page';
}

/** The properties `web_vitals` may carry (telemetrySanitize.ts's allowlist holds the same). */
export const VITALS_PROPS = ['kind', 'lcp', 'lcp_rating', 'inp', 'inp_rating', 'cls', 'cls_rating'] as const;

/** What `web_vitals` carries: the page's kind, and each metric measured, rounded, with its rating; nothing if none was. */
export function vitalsProps(kind: PageKind, v: Partial<Record<Vital, number>>): Record<string, string | number> | null {
  const out: Record<string, string | number> = { kind };
  let any = false;
  for (const m of ['lcp', 'inp', 'cls'] as const) {
    const x = v[m];
    if (x === undefined || !Number.isFinite(x) || x < 0) continue;
    out[m] = rounded(m, x);
    out[`${m}_rating`] = rating(m, x);
    any = true;
  }
  return any ? out : null;
}

/**
 * Watches this page's paints, shifts and interactions, and calls `send` once, the first time the page is
 * hidden or left. A page opened in the background isn't measured (its paint isn't one a reader waited for),
 * nor one in a browser without PerformanceObserver; a metric the browser doesn't report is left out.
 */
export function watchVitals(send: (v: Partial<Record<Vital, number>>) => void): void {
  const PO = globalThis.PerformanceObserver;
  if (!PO || document.visibilityState === 'hidden') return;
  const types = PO.supportedEntryTypes ?? [];
  const paints: PaintEntry[] = [];
  const shifts: Shift[] = [];
  const longest = new Map<number, number>();
  const watching: [PerformanceObserver, (e: PerformanceEntry) => void][] = [];
  const observe = (type: string, take: (e: PerformanceEntry) => void, more: Record<string, unknown> = {}) => {
    if (!types.includes(type)) return;
    try {
      const o = new PO((list) => list.getEntries().forEach(take));
      o.observe({ type, buffered: true, ...more } as PerformanceObserverInit);
      watching.push([o, take]);
    } catch {
      /* not this browser's: left out */
    }
  };
  observe('largest-contentful-paint', (e) => paints.push(e));
  observe('layout-shift', (e) => shifts.push(e as unknown as Shift));
  observe('event', (e) => addInteraction(longest, e as unknown as InteractionEntry), { durationThreshold: 40 });
  observe('first-input', (e) => addInteraction(longest, e as unknown as InteractionEntry));
  let sent = false;
  const report = () => {
    if (sent) return;
    sent = true;
    for (const [o, take] of watching) {
      o.takeRecords().forEach(take);
      o.disconnect();
    }
    const perf = performance as Performance & { interactionCount?: number };
    const hiddenAt = perf.getEntriesByType('visibility-state').find((e) => e.name === 'hidden')?.startTime;
    const nav = perf.getEntriesByType('navigation')[0] as (PerformanceEntry & { activationStart?: number }) | undefined;
    send({
      lcp: lcpOf(paints, { hiddenAt, activationStart: nav?.activationStart }),
      inp: inpOf(longest, perf.interactionCount),
      cls: types.includes('layout-shift') ? clsOf(shifts) : undefined,
    });
  };
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') report();
  });
  addEventListener('pagehide', report);
}
