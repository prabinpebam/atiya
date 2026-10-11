import { describe, expect, it } from 'vitest';
import { RunFolder, areaOf, clock, countsOf, currentStep, foldRun, healthOf, summaryOf, timeLeft, usualTimes, verdictOf, type RunEvent, type TestInfo, type TestStatus } from '../../src/site/editor/model/testRun';

const T0 = Date.parse('2026-10-11T09:00:00Z');
const info = (id: string, title = id, timeout = 60_000): TestInfo => ({ id, project: 'chromium', file: 'tests/e2e/planet.spec.ts', path: ['crafting', title], line: 1, timeout, retries: 0 });
const begin = (...ids: string[]): RunEvent => ({ t: T0, type: 'begin', tests: ids.map((i) => info(i)) });

describe('folding a run', () => {
  it('starts preparing, with the last line the runner printed, until the tests begin', () => {
    const f = new RunFolder(T0);
    f.apply({ t: T0 + 10, type: 'out', stream: 'out', text: '[WebServer] building pages 12/80\n' });
    expect(f.state).toMatchObject({ phase: 'preparing', lastLine: '[WebServer] building pages 12/80' });
    f.apply(begin('a', 'b'));
    expect(f.state.phase).toBe('tests');
    expect(countsOf(Object.values(f.state.tests))).toMatchObject({ total: 2, queued: 2 });
  });

  it('follows a test through its steps, folding a repeated step into one counted row', () => {
    const r = foldRun([
      begin('a'),
      { t: T0 + 1, type: 'test-begin', id: 'a', retry: 0 },
      { t: T0 + 2, type: 'step-begin', test: 'a', step: 's1', title: 'build the swing', category: 'test.step' },
      ...[0, 1, 2].flatMap((i): RunEvent[] => [
        { t: T0 + 3 + i * 2, type: 'step-begin', test: 'a', step: `p${i}`, parent: 's1', title: 'expect.poll', category: 'expect' },
        { t: T0 + 4 + i * 2, type: 'step-end', test: 'a', step: `p${i}` },
      ]),
      { t: T0 + 20, type: 'step-begin', test: 'a', step: 'e1', parent: 's1', title: 'page.evaluate', category: 'pw:api', timeout: 300_000 },
    ]);
    const t = r.tests.a;
    expect(t.status).toBe('running');
    expect(t.steps[0].children).toHaveLength(2);
    expect(t.steps[0].children[0]).toMatchObject({ title: 'expect.poll', count: 3 });
    expect(currentStep(t).map((s) => s.title)).toEqual(['build the swing', 'page.evaluate']);
  });

  it('ends a test with its error, closes what a timeout left open, and counts it', () => {
    const r = foldRun([
      begin('a', 'b'),
      { t: T0 + 1, type: 'test-begin', id: 'a', retry: 0 },
      { t: T0 + 2, type: 'step-begin', test: 'a', step: 's', title: 'page.evaluate', category: 'pw:api' },
      { t: T0 + 9, type: 'test-end', id: 'a', status: 'timedOut', expected: 'passed', retry: 0, duration: 8, error: { message: 'Test timeout of 300000ms exceeded.' } },
    ]);
    expect(r.tests.a).toMatchObject({ status: 'timedOut', duration: 8, error: { message: /timeout/ } });
    expect(r.tests.a.steps[0].end).toBe(T0 + 9);
    expect(countsOf(Object.values(r.tests))).toMatchObject({ done: 1, failed: 1, queued: 1 });
  });

  it('a test that passes on a retry is flaky', () => {
    const tests = [{ ...info('a'), retries: 1 }];
    const r = foldRun([
      { t: T0, type: 'begin', tests },
      { t: T0 + 1, type: 'test-begin', id: 'a', retry: 0 },
      { t: T0 + 2, type: 'test-end', id: 'a', status: 'failed', expected: 'passed', retry: 0, duration: 1 },
      { t: T0 + 3, type: 'test-begin', id: 'a', retry: 1 },
      { t: T0 + 4, type: 'test-end', id: 'a', status: 'passed', expected: 'passed', retry: 1, duration: 1 },
    ]);
    expect(r.tests.a.status).toBe('flaky');
  });

  it('keeps an idle stretch from the heartbeats: it starts when the CPU drops and clears when it rises', () => {
    const f = new RunFolder(T0);
    f.apply({ t: T0 + 1000, type: 'beat', cpu: 60 });
    f.apply({ t: T0 + 2000, type: 'beat', cpu: 3 });
    f.apply({ t: T0 + 3000, type: 'beat', cpu: 4 });
    expect(f.state.idleSince).toBe(T0 + 2000);
    f.apply({ t: T0 + 4000, type: 'beat', cpu: 80 });
    expect(f.state.idleSince).toBeUndefined();
  });
});

describe('judging a run', () => {
  const running = (extra: RunEvent[] = []) =>
    foldRun([
      begin('a', 'b'),
      { t: T0 + 1000, type: 'test-begin', id: 'a', retry: 0 },
      { t: T0 + 2000, type: 'step-begin', test: 'a', step: 's', title: 'page.evaluate', category: 'pw:api' },
      ...extra,
    ]);
  const alive = (now: number) => ({ now, alive: true as const });

  it('on track while the beats come and the test is within its usual time', () => {
    const r = running([{ t: T0 + 5000, type: 'beat', cpu: 70 }]);
    expect(healthOf(r, alive(T0 + 5500))).toMatchObject({ state: 'ok', label: 'On track', reason: 'Within its time limit (1:00); no earlier run of it to compare with yet.' });
    expect(healthOf(r, alive(T0 + 5500), new Map([['a', 40_000]])).reason).toBe('Within its usual time (0:40), and the machine is working.');
  });

  it('slower than usual past one and a half times its usual time, still working', () => {
    const r = running([{ t: T0 + 100_000, type: 'beat', cpu: 70 }]);
    const h = healthOf(r, alive(T0 + 100_500), new Map([['a', 40_000]]));
    expect(h).toMatchObject({ state: 'slow', label: 'Slower than usual' });
    expect(h.reason).toBe('1:39 so far; it usually takes 0:40. Still working.');
  });

  it('waiting, idle when the machine has done nothing for 20 s, with when it gives up', () => {
    const r = running([
      { t: T0 + 5000, type: 'beat', cpu: 2 },
      { t: T0 + 30_000, type: 'beat', cpu: 2 },
    ]);
    const h = healthOf(r, alive(T0 + 30_000));
    expect(h.state).toBe('idle');
    expect(h.reason).toBe('Waiting for page.evaluate, with the machine idle for 0:25; it gives up in 0:31.');
  });

  it('no word after 5 s without a heartbeat, saying whether the process is there', () => {
    const r = running([{ t: T0 + 5000, type: 'beat', cpu: 50 }]);
    expect(healthOf(r, alive(T0 + 17_000))).toMatchObject({ state: 'silent', reason: 'No word from the run for 0:12; its process is still running.' });
    expect(healthOf(r, { now: T0 + 7000, alive: null }).state).toBe('ok');
  });

  it('ended unexpectedly when its process is gone without an end, or it exited before finishing', () => {
    const r = running([{ t: T0 + 5000, type: 'beat', cpu: 50 }]);
    expect(healthOf(r, { now: T0 + 12_000, alive: false }).state).toBe('dead');
    const h = healthOf(r, { now: T0 + 6000, alive: false, exit: { code: 1, at: T0 + 5500 } });
    expect(h.state).toBe('dead');
    expect(h.reason).toMatch(/^The run ended unexpectedly at \d\d:\d\d \(exit code 1\), with 0 of 2 done\.$/);
    expect(healthOf(r, { now: T0 + 6000, alive: false, exit: { code: 1, at: T0 + 5500, reason: 'stopped' } }).state).toBe('stopped');
  });

  it('preparing says what it is getting ready, from its last line', () => {
    const f = new RunFolder(T0);
    f.apply({ t: T0 + 500, type: 'out', stream: 'out', text: '[WebServer] 12:01:02 [build] 40 page(s) built' });
    f.apply({ t: T0 + 1000, type: 'beat', cpu: 90 });
    expect(healthOf(f.state, alive(T0 + 1500))).toMatchObject({ state: 'preparing', reason: 'Getting ready: [WebServer] 12:01:02 [build] 40 page(s) built' });
  });

  it('a failure is new, known, flaky or not compared, against the stable tree', () => {
    const t = { ...info('a'), status: 'failed' as TestStatus, retry: 0, steps: [], out: [] };
    expect(verdictOf(t, new Map([['a', 'passed']]))).toBe('new');
    expect(verdictOf(t, new Map([['a', 'timedOut']]))).toBe('known');
    expect(verdictOf(t, new Map())).toBe('unknown');
    expect(verdictOf({ ...t, status: 'flaky' }, undefined)).toBe('flaky');
    expect(verdictOf({ ...t, status: 'passed' }, new Map())).toBeUndefined();
  });

  it('the summary is written for a decision', () => {
    const r = foldRun([
      begin('a', 'b', 'c'),
      { t: T0 + 1, type: 'test-begin', id: 'a', retry: 0 },
      { t: T0 + 2, type: 'test-end', id: 'a', status: 'passed', expected: 'passed', retry: 0, duration: 1 },
      { t: T0 + 3, type: 'test-begin', id: 'b', retry: 0 },
      { t: T0 + 4, type: 'test-end', id: 'b', status: 'timedOut', expected: 'passed', retry: 0, duration: 1 },
      { t: T0 + 3_000_000, type: 'end', status: 'failed' },
    ]);
    expect(summaryOf(r, new Map([['b', 'passed']])).sentence).toBe('1 passed. 1 failed: 1 new (b). 1 not run. 50 min.');
    expect(healthOf(r, { now: T0 + 3_000_001, alive: false }).state).toBe('failed');
  });

  it('time left adds each unfinished test at its usual time, and says nothing without anything to go on', () => {
    const r = running();
    expect(timeLeft(r, new Map([['a', 10_000], ['b', 20_000]]), T0 + 6000)).toBe(5000 + 20_000);
    expect(timeLeft(r, new Map([['a', 10_000]]), T0 + 6000)).toBeUndefined();
    expect(timeLeft(r, new Map(), T0 + 6000)).toBeUndefined();
    expect(usualTimes([foldRun([begin('a'), { t: T0, type: 'test-begin', id: 'a', retry: 0 }, { t: T0 + 1, type: 'test-end', id: 'a', status: 'passed', expected: 'passed', retry: 0, duration: 7 }])]).get('a')).toBe(7);
  });

  it('words: areas and clocks', () => {
    expect(areaOf('tests/e2e/planet.spec.ts')).toBe('The planet');
    expect(areaOf('tests\\e2e\\editor-access.spec.ts')).toBe('Edit mode: private pages');
    expect(clock(161_000)).toBe('2:41');
    expect(clock(3_723_000)).toBe('1:02:03');
  });
});

describe('the live reporter', () => {
  it("reads a test's own time limit from its body, which Playwright doesn't tell reporters", async () => {
    const { declaredTimeout } = await import('../reporters/live');
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const file = join(mkdtempSync(join(tmpdir(), 'live-')), 'a.spec.ts');
    writeFileSync(file, ["test('slow', async () => {", '  // a long sequence', '  test.setTimeout(300_000);', '});', "test('quick', async () => {", '  await go();', '});'].join('\n'));
    expect(declaredTimeout(file, 1, 60_000)).toBe(300_000);
    expect(declaredTimeout(file, 5, 60_000)).toBe(60_000);
  });
});
