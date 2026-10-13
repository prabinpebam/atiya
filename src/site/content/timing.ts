/**
 * Where a dev request's server time goes (documentation/engineering/performance.md §3). The dev
 * integration (integrations/perf.mjs) opens a collector for every request it serves; inside one, `timed`
 * and `timedAsync` add a named span to it, and every span also counts in the process's running totals.
 * In a build, a preview or the unit tests nothing collects: they only run the work.
 *
 * The collector lives on globalThis (the integration and these modules share one process), so the site's
 * code never imports node:async_hooks or anything of the editor.
 */

export interface SpanSink {
  add(name: string, ms: number): void;
}

interface TimingGlobal {
  __siteTiming?: { getStore(): SpanSink | undefined };
  __sitePerfTotals?: Map<string, { count: number; ms: number; max: number }>;
}

const g = globalThis as typeof globalThis & TimingGlobal;

/** Adds a span to the request being served (if any) and to the process's totals. */
export function addSpan(name: string, ms: number): void {
  if (!g.__siteTiming) return;
  g.__siteTiming.getStore()?.add(name, ms);
  const totals = (g.__sitePerfTotals ??= new Map());
  const t = totals.get(name) ?? { count: 0, ms: 0, max: 0 };
  t.count++;
  t.ms += ms;
  t.max = Math.max(t.max, ms);
  totals.set(name, t);
}

/** Runs `fn`, timing it as `name` when a dev collector is listening. */
export function timed<T>(name: string, fn: () => T): T {
  if (!g.__siteTiming) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    addSpan(name, performance.now() - start);
  }
}

/** The same, for work that waits (an image transform, a git process). */
export async function timedAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!g.__siteTiming) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    addSpan(name, performance.now() - start);
  }
}
