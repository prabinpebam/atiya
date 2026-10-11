/**
 * Test runs, read for edit mode and for agents (documentation/editor/test-runs.md §4.3, §7). Finds every run in
 * every worktree of this repository (`git worktree list`), and judges each with the pure model: its health
 * (with whether its process is still there), its failures' verdicts against the stable tree's runs, its
 * summary and the time left. Node only, and plain enough to run without the dev server
 * (`node scripts/test-run.mjs status` imports it).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  RunFolder,
  areaOf,
  countsOf,
  currentStep,
  healthOf,
  summaryOf,
  timeLeft,
  usualTimes,
  verdictOf,
  type Counts,
  type Health,
  type RunEvent,
  type RunState,
  type StepState,
  type TestState,
  type TestStatus,
  type Verdict,
} from '../model/testRun.ts';

export const RUNS_DIR = '.test-runs';
const RUN_ID = /^[\w.-]+$/;

export interface RunInfo {
  id: string;
  /** Who started it: you, an agent, a script; unknown when it didn't go through the launcher. */
  by: string;
  purpose: string;
  cwd: string;
  branch?: string;
  commit?: string;
  dirty?: boolean;
  args?: string[];
  startedAt: number;
  pid?: number;
  childPid?: number;
  launcher: boolean;
  /** The test servers' ports, and whether one was already running before the run (and so reused). */
  servers?: { port: number; reused: boolean }[];
}

export interface Worktree {
  path: string;
  branch: string;
  /** The repository's main worktree: the stable tree, which failures are judged against. */
  main: boolean;
}

export interface Exit {
  code: number | null;
  at: number;
  reason?: string;
}

export interface RunListing {
  id: string;
  dir: string;
  worktree: Worktree;
  info: RunInfo;
  state?: RunState;
  exit?: Exit;
  alive: boolean | null;
  active: boolean;
}

const readJson = <T>(file: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
};

// a run's files are read every half second while a screen watches: each is parsed again only when it changes
const parsed = new Map<string, { mtime: number; size: number; value: unknown }>();
const readJsonCached = <T>(file: string): T | undefined => {
  let st;
  try {
    st = statSync(file);
  } catch {
    parsed.delete(file);
    return undefined;
  }
  const hit = parsed.get(file);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.value as T;
  const value = readJson<T>(file);
  // a file caught mid-write: keep what was last read
  if (value === undefined) return hit?.value as T | undefined;
  parsed.set(file, { mtime: st.mtimeMs, size: st.size, value });
  return value;
};

/** Whether a process is still there (null: no process to ask about). */
export function alive(pid: number | undefined): boolean | null {
  if (!pid) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

let cached: { at: number; root: string; list: Worktree[] } | undefined;
/** This repository's worktrees, the main one first (cached for 10 s). */
export function worktrees(root = process.cwd()): Worktree[] {
  if (cached && cached.root === root && Date.now() - cached.at < 10_000) return cached.list;
  let list: Worktree[] = [{ path: resolve(root), branch: '', main: true }];
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    list = out
      .split(/\r?\n\r?\n/)
      .map((block) => ({ path: /^worktree (.+)$/m.exec(block)?.[1] ?? '', branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? (/^detached$/m.test(block) ? 'detached' : '') }))
      .filter((w) => w.path)
      .map((w, i) => ({ path: resolve(w.path), branch: w.branch, main: i === 0 }));
  } catch {
    // not a git checkout: just this folder
  }
  cached = { at: Date.now(), root, list };
  return list;
}

const SILENCE_GONE_MS = 30_000;

/** One run's folder, read. */
export function readRun(dir: string, worktree: Worktree, now = Date.now()): RunListing | undefined {
  const info = readJsonCached<RunInfo>(join(dir, 'run.json'));
  const state = readJsonCached<RunState>(join(dir, 'state.json'));
  if (!info && !state) return undefined;
  const id = basename(dir);
  const exit = readJsonCached<Exit>(join(dir, 'end.json'));
  const a = alive(info?.childPid ?? info?.pid);
  const done = exit || state?.phase === 'done';
  const active = !done && (a === true || (a === null && !!state && now - state.beat < SILENCE_GONE_MS));
  return { id, dir, worktree, info: info ?? { id, by: 'unknown', purpose: '', cwd: worktree.path, startedAt: state?.startedAt ?? 0, launcher: false }, ...(state ? { state } : {}), ...(exit ? { exit } : {}), alive: a, active: !!active };
}

/** Every run, in every worktree, the newest first. */
export function listRuns(root = process.cwd(), now = Date.now()): RunListing[] {
  const out: RunListing[] = [];
  for (const w of worktrees(root)) {
    const base = join(w.path, RUNS_DIR);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      if (!RUN_ID.test(name)) continue;
      const dir = join(base, name);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const r = readRun(dir, w, now);
      if (r) out.push(r);
    }
  }
  return out.sort((a, b) => b.info.startedAt - a.info.startedAt);
}

export function findRun(id: string, root = process.cwd()): RunListing | undefined {
  if (!RUN_ID.test(id)) return undefined;
  return listRuns(root).find((r) => r.id === id);
}

/** Each test's latest result on the stable tree (the main worktree), from its finished runs. */
export function baselineOf(runs: RunListing[]): Map<string, TestStatus> {
  const base = new Map<string, TestStatus>();
  for (const r of runs) {
    if (!r.worktree.main || r.active || !r.state) continue;
    for (const t of Object.values(r.state.tests)) if (!base.has(t.id) && t.status !== 'queued' && t.status !== 'running') base.set(t.id, t.status);
  }
  return base;
}

const historyOf = (runs: RunListing[], except: string) => runs.filter((r) => r.id !== except && r.state && !r.active).slice(0, 10).map((r) => r.state!);

export interface FailureView {
  id: string;
  area: string;
  path: string[];
  status: TestStatus;
  verdict: Verdict;
  message?: string;
}

export interface RunView {
  id: string;
  worktree: Worktree;
  info: RunInfo;
  active: boolean;
  alive: boolean | null;
  exit?: Exit;
  /** The server's time when it was judged: the screen counts on from here. */
  asOf: number;
  health: Health;
  counts: Counts;
  left?: number;
  summary: string;
  phase: RunState['phase'] | 'unknown';
  /** When the first test began: the end of getting ready. */
  testsFrom?: number;
  beat?: number;
  cpu?: number;
  lastLine?: string;
  /** The test running now, its path of steps, and its usual time. */
  now?: { id: string; area: string; path: string[]; start?: number; timeout: number; usual?: number; steps: { title: string; category: string; start: number; count: number; timeout?: number }[] };
  failures: FailureView[];
  /** Other runs active at the same time (they slow each other down). */
  overlapping: { id: string; branch: string; purpose: string }[];
  state?: RunState;
  /** The last lines the runner printed (the launcher's log). */
  output: string[];
}

function tail(file: string, lines = 30): string[] {
  try {
    const st = statSync(file);
    const from = Math.max(0, st.size - 16_000);
    const buf = readFileSync(file).subarray(from);
    return buf.toString('utf8').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/).filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

/** A run judged: what the Tests screen and `status` show. */
export function viewOf(run: RunListing, runs: RunListing[], now = Date.now()): RunView {
  const state = run.state;
  const usual = usualTimes(historyOf(runs, run.id));
  const baseline = baselineOf(runs);
  const live = { now, alive: run.alive, ...(run.exit ? { exit: run.exit } : {}) };
  const health: Health = state
    ? healthOf(state, live, usual)
    : run.exit || run.alive === false
      ? { state: 'dead', label: 'Ended unexpectedly', reason: run.exit ? `It ended before its first report (exit code ${run.exit.code}${run.exit.reason ? `: ${run.exit.reason}` : ''}).` : 'Its process is gone, and it never reported.' }
      : { state: 'preparing', label: 'Starting', reason: 'Starting the test runner.' };
  const output = tail(join(run.dir, 'output.log'));
  // while it gets ready, the runner's own last line (the test server's build) says what it's doing
  const lastOut = output.filter((l) => l.trim()).pop();
  if (health.state === 'preparing' && !state?.lastLine && lastOut) health.reason = `Getting ready: ${lastOut.slice(0, 300)}`;
  const tests = state ? state.order.map((id) => state.tests[id]) : [];
  const running = tests.find((t) => t.status === 'running');
  const failures = tests
    .map((t) => ({ t, v: verdictOf(t, baseline) }))
    .filter((x): x is { t: TestState; v: Verdict } => !!x.v)
    .map(({ t, v }) => ({ id: t.id, area: areaOf(t.file), path: t.path, status: t.status, verdict: v, ...(t.error ? { message: t.error.message.split('\n')[0] } : {}) }));
  const steps = running ? currentStep(running).map((s: StepState) => ({ title: s.title, category: s.category, start: s.start, count: s.count, ...(s.timeout ? { timeout: s.timeout } : {}) })) : [];
  return {
    id: run.id,
    worktree: run.worktree,
    info: run.info,
    active: run.active,
    alive: run.alive,
    ...(run.exit ? { exit: run.exit } : {}),
    asOf: now,
    health,
    counts: countsOf(tests),
    ...(state && run.active && state.phase === 'tests' ? { left: timeLeft(state, usual, now) } : {}),
    summary: state ? summaryOf(state, baseline, state.phase === 'done' ? state.updatedAt : now).sentence : '',
    phase: state?.phase ?? 'unknown',
    ...(() => {
      const starts = tests.map((t) => t.start).filter((s): s is number => s !== undefined);
      return starts.length ? { testsFrom: Math.min(...starts) } : {};
    })(),
    ...(state ? { beat: state.beat, cpu: state.cpu, lastLine: state.lastLine } : {}),
    ...(running ? { now: { id: running.id, area: areaOf(running.file), path: running.path, start: running.start, timeout: running.timeout, usual: usual.get(running.id), steps } } : {}),
    failures,
    overlapping: runs.filter((r) => r.active && r.id !== run.id).map((r) => ({ id: r.id, branch: r.worktree.branch, purpose: r.info.purpose })),
    ...(state ? { state } : {}),
    output,
  };
}

/** One test's full detail, folded from the run's event log (a passing test's steps live only there). */
export function testDetail(run: RunListing, testId: string): TestState | undefined {
  const file = join(run.dir, 'events.ndjson');
  if (!existsSync(file) || !run.state?.tests[testId]) return run.state?.tests[testId];
  const t0 = run.state.startedAt;
  const folder = new RunFolder(t0, undefined, { keepSteps: true });
  folder.apply({ t: t0, type: 'begin', tests: [run.state.tests[testId]] });
  const needle = `"${testId}"`;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes(needle)) continue;
    try {
      const e = JSON.parse(line) as RunEvent;
      if (e.type !== 'begin') folder.apply(e);
    } catch {
      // a line being written: the next read has it
    }
  }
  const t = folder.state.tests[testId];
  // the event log has the steps a passing test's state dropped; the state has the rest
  return { ...run.state.tests[testId], steps: t.steps.length ? t.steps : run.state.tests[testId].steps, out: t.out.length ? t.out : run.state.tests[testId].out };
}

/** The newest active run, else the newest run. */
export function currentRun(runs: RunListing[]): RunListing | undefined {
  return runs.find((r) => r.active) ?? runs[0];
}

export interface RunBrief {
  id: string;
  branch: string;
  main: boolean;
  by: string;
  purpose: string;
  startedAt: number;
  active: boolean;
  health: Health;
  counts: Counts;
  beat?: number;
}

/** A run in a list: who, why, where, and its health and counts. */
export function briefOf(run: RunListing, now = Date.now()): RunBrief {
  const tests = run.state ? run.state.order.map((id) => run.state!.tests[id]) : [];
  const health: Health = run.state ? healthOf(run.state, { now, alive: run.alive, ...(run.exit ? { exit: run.exit } : {}) }) : { state: run.exit || run.alive === false ? 'dead' : 'preparing', label: run.exit || run.alive === false ? 'Ended unexpectedly' : 'Starting', reason: '' };
  return { id: run.id, branch: run.worktree.branch, main: run.worktree.main, by: run.info.by, purpose: run.info.purpose, startedAt: run.info.startedAt, active: run.active, health, counts: countsOf(tests), ...(run.state ? { beat: run.state.beat } : {}) };
}
