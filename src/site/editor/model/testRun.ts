/**
 * A test run, read (documentation/editor/test-runs.md §4, §5): the events the live reporter writes, folded into
 * the run's state, and the rules that judge it (its health, a failure's verdict, the summary). Pure: the
 * reporter folds with it, the server judges with it, the Tests screen only draws what it says.
 */

export type TestStatus = 'queued' | 'running' | 'retrying' | 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted' | 'flaky';

export interface TestInfo {
  id: string;
  project: string;
  file: string;
  /** The describe groups, then the test's title. */
  path: string[];
  line: number;
  /** Its time limit (ms); 0 for none. */
  timeout: number;
  retries: number;
}

export interface ErrorInfo {
  message: string;
  /** The code around the line that failed, as Playwright prints it. */
  snippet?: string;
  file?: string;
  line?: number;
}

export interface Attachment {
  name: string;
  contentType: string;
  /** Relative to the run's folder, or absolute when the test runner kept it elsewhere. */
  path?: string;
}

export type RunEvent =
  | { t: number; type: 'begin'; tests: TestInfo[] }
  | { t: number; type: 'test-begin'; id: string; retry: number }
  | { t: number; type: 'test-end'; id: string; status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'; expected: string; retry: number; duration: number; error?: ErrorInfo; attachments?: Attachment[] }
  | { t: number; type: 'step-begin'; test: string; step: string; parent?: string; title: string; category: string; timeout?: number }
  | { t: number; type: 'step-end'; test: string; step: string; error?: string }
  | { t: number; type: 'out'; test?: string; stream: 'out' | 'err'; text: string }
  /** Every second, whatever happens: the machine's CPU use since the last beat (0 to 100). */
  | { t: number; type: 'beat'; cpu?: number }
  | { t: number; type: 'error'; message: string }
  | { t: number; type: 'end'; status: string };

export interface StepState {
  title: string;
  category: string;
  start: number;
  end?: number;
  error?: string;
  /** Repeated steps fold into one (an expect.poll's tries): how many. */
  count: number;
  timeout?: number;
  children: StepState[];
}

export interface TestState extends TestInfo {
  status: TestStatus;
  start?: number;
  end?: number;
  duration?: number;
  retry: number;
  error?: ErrorInfo;
  attachments?: Attachment[];
  steps: StepState[];
  /** Its last console lines. */
  out: string[];
}

export interface RunState {
  v: 1;
  startedAt: number;
  updatedAt: number;
  /** The last heartbeat. */
  beat: number;
  /** The machine's CPU use at the last beat, and since when it has been idle (under 10%). */
  cpu?: number;
  idleSince?: number;
  phase: 'preparing' | 'tests' | 'done';
  /** While preparing: the last line the runner or its web server printed. */
  lastLine?: string;
  endStatus?: string;
  tests: Record<string, TestState>;
  order: string[];
  errors: string[];
}

export const MAX_STEPS = 400;
const OUT_LINES = 20;
const IDLE_CPU = 10;

export function newRun(t: number): RunState {
  return { v: 1, startedAt: t, updatedAt: t, beat: t, phase: 'preparing', tests: {}, order: [], errors: [] };
}

/** Folds events into a run's state, keeping the step index outside the state (it isn't serialised). */
export class RunFolder {
  readonly state: RunState;
  private steps = new Map<string, StepState>();
  private stepCount = new Map<string, number>();
  private keepSteps: boolean;

  /** `keepSteps`: keep a passing test's steps (a test's detail, folded from the event log). */
  constructor(t: number, state?: RunState, opts: { keepSteps?: boolean } = {}) {
    this.state = state ?? newRun(t);
    this.keepSteps = !!opts.keepSteps;
  }

  apply(e: RunEvent): void {
    const s = this.state;
    s.updatedAt = Math.max(s.updatedAt, e.t);
    switch (e.type) {
      case 'begin':
        s.phase = 'tests';
        s.lastLine = undefined;
        for (const info of e.tests) {
          if (!s.tests[info.id]) s.order.push(info.id);
          s.tests[info.id] = { ...info, status: 'queued', retry: 0, steps: [], out: [] };
        }
        break;
      case 'test-begin': {
        const t = s.tests[e.id];
        if (!t) break;
        Object.assign(t, { status: 'running', start: e.t, end: undefined, duration: undefined, retry: e.retry, steps: [], error: undefined });
        this.stepCount.set(e.id, 0);
        break;
      }
      case 'test-end': {
        const t = s.tests[e.id];
        if (!t) break;
        t.end = e.t;
        t.duration = e.duration;
        t.retry = e.retry;
        if (e.error) t.error = e.error;
        if (e.attachments?.length) t.attachments = e.attachments;
        const ok = e.status === e.expected;
        if (!ok && e.retry < t.retries) t.status = 'retrying';
        else if (ok && e.retry > 0 && e.status === 'passed') t.status = 'flaky';
        else t.status = e.status === 'passed' || ok ? (e.status === 'skipped' ? 'skipped' : 'passed') : e.status;
        // close anything a timeout left open
        const close = (list: StepState[]) => list.forEach((x) => ((x.end ??= e.t), close(x.children)));
        close(t.steps);
        // a test that went as expected keeps its steps in the event log only (read on demand), so the state stays small
        if (!this.keepSteps && (t.status === 'passed' || t.status === 'skipped')) t.steps = [];
        break;
      }
      case 'step-begin': {
        const t = s.tests[e.test];
        if (!t) break;
        const siblings = e.parent ? this.steps.get(e.parent)?.children : t.steps;
        if (!siblings) break;
        const last = siblings[siblings.length - 1];
        // the same step again, right after the last one ended (a poll, a wait's tries): one row, counted
        if (last && last.end !== undefined && last.title === e.title && last.category === e.category && !last.error) {
          last.count++;
          last.end = undefined;
          this.steps.set(e.step, last);
          break;
        }
        const n = this.stepCount.get(e.test) ?? 0;
        if (n >= MAX_STEPS) break;
        this.stepCount.set(e.test, n + 1);
        const step: StepState = { title: e.title, category: e.category, start: e.t, count: 1, children: [], ...(e.timeout ? { timeout: e.timeout } : {}) };
        siblings.push(step);
        this.steps.set(e.step, step);
        break;
      }
      case 'step-end': {
        const step = this.steps.get(e.step);
        if (!step) break;
        step.end = e.t;
        if (e.error) step.error = e.error;
        this.steps.delete(e.step);
        break;
      }
      case 'out': {
        const line = e.text.replace(/\s+$/, '');
        if (!line) break;
        const t = e.test ? s.tests[e.test] : undefined;
        if (t) t.out = [...t.out, ...line.split('\n')].slice(-OUT_LINES);
        else if (s.phase === 'preparing') s.lastLine = line.split('\n').pop()!.slice(0, 300);
        break;
      }
      case 'beat':
        s.beat = e.t;
        if (e.cpu !== undefined) {
          s.cpu = e.cpu;
          if (e.cpu < IDLE_CPU) s.idleSince ??= e.t;
          else s.idleSince = undefined;
        }
        break;
      case 'error':
        s.errors = [...s.errors, e.message].slice(-10);
        break;
      case 'end':
        s.phase = 'done';
        s.endStatus = e.status;
        for (const id of s.order) if (s.tests[id].status === 'running') s.tests[id].status = 'interrupted';
        break;
    }
  }
}

export function foldRun(events: RunEvent[], t = events[0]?.t ?? 0): RunState {
  const f = new RunFolder(t);
  for (const e of events) f.apply(e);
  return f.state;
}

// ---------- reading a run ----------

const AREAS: Record<string, string> = {
  'planet.spec.ts': 'The planet',
  'site.spec.ts': 'The website',
  'editor.spec.ts': 'Edit mode',
  'editor-access.spec.ts': 'Edit mode: private pages',
  'protected.spec.ts': 'Private pages',
  'contact.spec.ts': 'The contact form',
};

/** A spec file's area, in words. */
export const areaOf = (file: string) => AREAS[file.split(/[\\/]/).pop() ?? file] ?? file.split(/[\\/]/).pop() ?? file;

export const FAILED: ReadonlySet<TestStatus> = new Set(['failed', 'timedOut', 'interrupted']);
const DONE: ReadonlySet<TestStatus> = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted', 'flaky']);

export interface Counts {
  total: number;
  done: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  running: number;
  queued: number;
}

export function countsOf(tests: TestState[]): Counts {
  const c: Counts = { total: tests.length, done: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, running: 0, queued: 0 };
  for (const t of tests) {
    if (DONE.has(t.status)) c.done++;
    if (t.status === 'passed') c.passed++;
    else if (FAILED.has(t.status)) c.failed++;
    else if (t.status === 'flaky') c.flaky++;
    else if (t.status === 'skipped') c.skipped++;
    else if (t.status === 'running' || t.status === 'retrying') c.running++;
    else c.queued++;
  }
  return c;
}

/** The innermost step still running, and the path of steps to it. */
export function currentStep(t: TestState): StepState[] {
  const path: StepState[] = [];
  let list = t.steps;
  for (;;) {
    const open = [...list].reverse().find((s) => s.end === undefined);
    if (!open) return path;
    path.push(open);
    list = open.children;
  }
}

/** m:ss, or h:mm:ss. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "about 22 min", "about 1 h 10 min", "under a minute". */
export function roughly(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'under a minute';
  if (min < 60) return `about ${min} min`;
  return `about ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Each test's usual time (the median of its passing runs), from earlier runs. */
export function usualTimes(history: RunState[]): Map<string, number> {
  const all = new Map<string, number[]>();
  for (const r of history) for (const t of Object.values(r.tests)) if (t.status === 'passed' && t.duration) all.set(t.id, [...(all.get(t.id) ?? []), t.duration]);
  return new Map([...all].map(([id, xs]) => [id, median(xs)!]));
}

/** Time left: each test not finished at its usual time (or this run's median), the running ones less what they've had; unknown until there's something of its own to go on. */
export function timeLeft(run: RunState, usual: Map<string, number>, now: number): number | undefined {
  const tests = run.order.map((id) => run.tests[id]);
  const fallback = median(tests.filter((t) => t.status === 'passed' && t.duration).map((t) => t.duration!));
  let left = 0;
  for (const t of tests) {
    const each = usual.get(t.id) ?? fallback;
    if (t.status !== 'queued' && t.status !== 'retrying' && t.status !== 'running') continue;
    // a test with no history, in a run with nothing finished yet: no honest estimate
    if (each === undefined) return undefined;
    if (t.status === 'running') left += Math.max(0, each - (now - (t.start ?? now)));
    else left += each;
  }
  return left;
}

// ---------- judging ----------

export type HealthState = 'preparing' | 'ok' | 'slow' | 'idle' | 'silent' | 'dead' | 'failed' | 'passed' | 'stopped';

export interface Liveness {
  now: number;
  /** Whether the runner's process is still there (null: not known, the run didn't go through the launcher). */
  alive: boolean | null;
  /** How the launcher saw it end, if it did. */
  exit?: { code: number | null; at: number; reason?: string };
}

export interface Health {
  state: HealthState;
  /** One word or two: "On track". */
  label: string;
  /** Its reason, in words. */
  reason: string;
}

const SILENT_MS = 5000;
const IDLE_MS = 20000;
const at = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The run's health, always with its reason (documentation/editor/test-runs.md §5). */
export function healthOf(run: RunState, live: Liveness, usual: Map<string, number> = new Map()): Health {
  const c = countsOf(run.order.map((id) => run.tests[id]));
  if (run.phase === 'done' || live.exit) {
    const finished = run.phase === 'done';
    if (!finished || run.endStatus === 'interrupted') {
      const code = live.exit?.code;
      if (live.exit?.reason === 'stopped' || run.endStatus === 'interrupted') return { state: 'stopped', label: 'Stopped', reason: `Stopped at ${at(live.exit?.at ?? run.updatedAt)}, with ${c.done} of ${c.total} done.` };
      return { state: 'dead', label: 'Ended unexpectedly', reason: `The run ended unexpectedly at ${at(live.exit?.at ?? run.updatedAt)}${code !== undefined && code !== null ? ` (exit code ${code})` : ''}, with ${c.done} of ${c.total} done.` };
    }
    if (c.failed || run.endStatus === 'failed' || run.endStatus === 'timedout') return { state: 'failed', label: 'Failed', reason: summaryOf(run).sentence };
    return { state: 'passed', label: 'Passed', reason: summaryOf(run).sentence };
  }
  if (live.alive === false && live.now - run.updatedAt > SILENT_MS) return { state: 'dead', label: 'Ended unexpectedly', reason: `Its process is gone, and it hasn't said why: the last word was at ${at(run.updatedAt)}.` };
  const quiet = live.now - run.beat;
  if (quiet > SILENT_MS) {
    const proc = live.alive === true ? 'its process is still running' : live.alive === false ? 'its process is gone' : "whether its process is still running isn't known";
    return { state: 'silent', label: 'No word', reason: `No word from the run for ${clock(quiet)}; ${proc}.` };
  }
  if (run.phase === 'preparing') return { state: 'preparing', label: 'Preparing', reason: run.lastLine ? `Getting ready: ${run.lastLine}` : 'Getting ready: building the test site and starting its server.' };
  const running = run.order.map((id) => run.tests[id]).filter((t) => t.status === 'running');
  const t = running[0];
  if (!t) return { state: 'ok', label: 'On track', reason: 'Between tests.' };
  const steps = currentStep(t);
  const step = steps[steps.length - 1];
  const doing = step ? `${step.title}${step.count > 1 ? ` (${step.count} tries)` : ''}` : 'starting';
  const limit = step?.timeout || t.timeout;
  const left = limit ? limit - (live.now - (step?.timeout ? step.start : t.start ?? live.now)) : undefined;
  if (run.idleSince !== undefined && live.now - run.idleSince >= IDLE_MS && step) {
    return { state: 'idle', label: 'Waiting, idle', reason: `Waiting for ${doing}, with the machine idle for ${clock(live.now - run.idleSince)}${left !== undefined ? `; it gives up in ${clock(left)}` : ''}.` };
  }
  const took = live.now - (t.start ?? live.now);
  const norm = usual.get(t.id);
  if (norm !== undefined && took > norm * 1.5) return { state: 'slow', label: 'Slower than usual', reason: `${clock(took)} so far; it usually takes ${clock(norm)}. Still working.` };
  if (norm === undefined && t.timeout && took > t.timeout / 2) return { state: 'slow', label: 'Slower than usual', reason: `Past half its time limit: ${clock(took)} of ${clock(t.timeout)}. Still working.` };
  return { state: 'ok', label: 'On track', reason: norm !== undefined ? `Within its usual time (${clock(norm)}), and the machine is working.` : `Within its time limit${t.timeout ? ` (${clock(t.timeout)})` : ''}; no earlier run of it to compare with yet.` };
}

export type Verdict = 'new' | 'known' | 'flaky' | 'unknown';

/** A failure, judged against the stable tree's latest result for the same test. */
export function verdictOf(t: TestState, baseline: Map<string, TestStatus> | undefined): Verdict | undefined {
  if (t.status === 'flaky') return 'flaky';
  if (!FAILED.has(t.status)) return undefined;
  const before = baseline?.get(t.id);
  if (!before) return 'unknown';
  if (before === 'passed' || before === 'flaky') return 'new';
  if (FAILED.has(before)) return 'known';
  return 'unknown';
}

export const VERDICT_WORDS: Record<Verdict, string> = {
  new: 'New: passes on the stable tree',
  known: 'Known: fails on the stable tree too',
  flaky: 'Flaky: passed on a retry',
  unknown: 'Not compared: no run of it on the stable tree yet',
};

export interface Summary {
  sentence: string;
  counts: Counts;
}

/** What a run proved, in a sentence written for a decision. */
export function summaryOf(run: RunState, baseline?: Map<string, TestStatus>, now = run.updatedAt): Summary {
  const tests = run.order.map((id) => run.tests[id]);
  const counts = countsOf(tests);
  const failed = tests.filter((t) => FAILED.has(t.status));
  const v = (k: Verdict) => failed.filter((t) => verdictOf(t, baseline) === k);
  const parts = [`${counts.passed} passed.`];
  if (failed.length) {
    const fresh = v('new');
    const known = v('known');
    const bits = [fresh.length && `${fresh.length} new (${fresh.map((t) => t.path[t.path.length - 1].split(':')[0]).slice(0, 3).join('; ')})`, known.length && `${known.length} known`, v('unknown').length && `${v('unknown').length} not compared`].filter(Boolean);
    parts.push(`${failed.length} failed${bits.length ? `: ${bits.join(', ')}` : ''}.`);
  }
  if (counts.flaky) parts.push(`${counts.flaky} flaky.`);
  const notRun = counts.queued + counts.running;
  if (notRun) parts.push(`${notRun} not run.`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped.`);
  parts.push(`${roughly(now - run.startedAt).replace(/^about /, '')}.`);
  return { sentence: parts.join(' '), counts };
}
