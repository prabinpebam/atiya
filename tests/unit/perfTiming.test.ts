/**
 * The dev server's timing (documentation/engineering/performance.md §3): spans are recorded only while a
 * dev collector is listening (a build and the unit tests just run the work), a request's spans stay its
 * own across awaits, and the dev integration sorts requests by what they are.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, describe, expect, it } from 'vitest';
import { addSpan, timed, timedAsync, type SpanSink } from '../../src/site/content/timing';
import { kindOf } from '../../integrations/perf.mjs';

const g = globalThis as typeof globalThis & { __siteTiming?: AsyncLocalStorage<SpanSink>; __sitePerfTotals?: Map<string, { count: number; ms: number; max: number }> };

const sink = () => {
  const spans: [string, number][] = [];
  return { spans, add: (name: string, ms: number) => void spans.push([name, ms]) };
};

afterEach(() => {
  delete g.__siteTiming;
  delete g.__sitePerfTotals;
});

describe('server timing', () => {
  it('outside the dev server it only runs the work, and records nothing', async () => {
    expect(timed('x', () => 2)).toBe(2);
    expect(await timedAsync('y', async () => 3)).toBe(3);
    addSpan('z', 5);
    expect(g.__sitePerfTotals).toBeUndefined();
  });

  it("adds a span to the request being served, and to the process's totals, even when the work throws", async () => {
    g.__siteTiming = new AsyncLocalStorage<SpanSink>();
    const a = sink();
    await g.__siteTiming.run(a, async () => {
      timed('content.read', () => 1);
      await timedAsync('git', async () => new Promise((r) => setTimeout(r, 5)));
      expect(() => timed('store.check', () => { throw new Error('refused'); })).toThrow('refused');
    });
    expect(a.spans.map(([n]) => n)).toEqual(['content.read', 'git', 'store.check']);
    expect(a.spans[1][1]).toBeGreaterThanOrEqual(4);
    expect(g.__sitePerfTotals?.get('git')).toMatchObject({ count: 1 });
  });

  it('keeps two requests served at once apart, across awaits', async () => {
    g.__siteTiming = new AsyncLocalStorage<SpanSink>();
    const a = sink();
    const b = sink();
    await Promise.all([
      g.__siteTiming.run(a, async () => {
        await new Promise((r) => setTimeout(r, 5));
        timed('picture.url', () => 0);
      }),
      g.__siteTiming.run(b, async () => {
        await timedAsync('git', async () => 0);
      }),
    ]);
    expect(a.spans.map(([n]) => n)).toEqual(['picture.url']);
    expect(b.spans.map(([n]) => n)).toEqual(['git']);
    expect(g.__sitePerfTotals?.get('picture.url')?.count).toBe(1);
  });

  it('sorts dev requests: pages, editor screens, the canvas, the API, modules, images and assets', () => {
    expect(kindOf('/side-projects/atiya/')).toBe('page');
    expect(kindOf('/')).toBe('page');
    expect(kindOf('/_edit/')).toBe('editor');
    expect(kindOf('/_edit')).toBe('editor');
    expect(kindOf('/_edit/articles/x/')).toBe('editor');
    expect(kindOf('/_edit/canvas/articles/x/')).toBe('canvas');
    expect(kindOf('/_edit/api/perf?since=1')).toBe('api');
    expect(kindOf('/src/site/editor/scripts/editor.ts?v=1')).toBe('module');
    expect(kindOf('/@vite/client')).toBe('module');
    expect(kindOf('/node_modules/.vite/deps/react.js')).toBe('module');
    expect(kindOf('/_image?href=x&w=480')).toBe('image');
    expect(kindOf('/favicon.svg')).toBe('asset');
  });
});
