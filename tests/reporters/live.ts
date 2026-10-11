/**
 * The live reporter (documentation/editor/test-runs.md §4.1): every run on this machine writes what happens as
 * it happens, so edit mode's Tests screen (and an agent's `node scripts/test-run.mjs status`) can show it.
 *
 * - `.test-runs/<run>/events.ndjson`: one line per event, appended as it comes;
 * - `.test-runs/<run>/state.json`: the run folded (src/site/editor/model/testRun.ts), rewritten at most
 *   four times a second and on every heartbeat;
 * - a heartbeat every second, whatever is happening, with the machine's CPU use, so a quiet stretch is
 *   never a mystery.
 *
 * It's in playwright.config.ts for every run; the launcher (scripts/test-run.mjs) names the run's folder and
 * says who started it and why. A run started without it gets a folder of its own, "started by: unknown".
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, relative } from 'node:path';
import { RunFolder, type ErrorInfo, type RunEvent } from '../../src/site/editor/model/testRun.ts';

const ROOT = process.cwd();
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const plain = (s: string | undefined, max = 4000) => (s ?? '').replace(ANSI, '').slice(0, max);

/** A run's ID: when it started, and a few random letters. */
export const runId = (t = new Date()) => `${t.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-')}-${Math.random().toString(36).slice(2, 6)}`;

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total };
}

export function writeJson(file: string, value: unknown) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, file);
}

const errorOf = (e: TestError | undefined): ErrorInfo | undefined =>
  e && { message: plain(e.message ?? e.value ?? 'Error'), ...(e.snippet ? { snippet: plain(e.snippet) } : {}), ...(e.location ? { file: relative(ROOT, e.location.file).split('\\').join('/'), line: e.location.line } : {}) };

export default class LiveReporter implements Reporter {
  readonly dir: string;
  private folder = new RunFolder(Date.now());
  private timer: ReturnType<typeof setInterval>;
  private lastWrite = 0;
  private pending = false;
  private stepIds = new WeakMap<TestStep, string>();
  private n = 0;
  private cpu = cpuTimes();

  constructor() {
    const id = process.env.TEST_RUN_ID ?? runId();
    this.dir = process.env.TEST_RUN_DIR ?? join(ROOT, '.test-runs', id);
    mkdirSync(this.dir, { recursive: true });
    if (!existsSync(join(this.dir, 'run.json'))) writeJson(join(this.dir, 'run.json'), { id, by: 'unknown', purpose: '', cwd: ROOT, startedAt: Date.now(), pid: process.pid, launcher: false });
    this.timer = setInterval(() => this.beat(), 1000);
    this.timer.unref?.();
    this.write(true);
  }

  printsToStdio() {
    return false;
  }

  private emit(e: RunEvent) {
    try {
      appendFileSync(join(this.dir, 'events.ndjson'), JSON.stringify(e) + '\n');
    } catch {
      // a reader holding the file on Windows: the state still carries it
    }
    this.folder.apply(e);
    this.write();
  }

  private write(force = false) {
    const now = Date.now();
    if (!force && now - this.lastWrite < 250) {
      this.pending = true;
      return;
    }
    this.lastWrite = now;
    this.pending = false;
    try {
      writeJson(join(this.dir, 'state.json'), this.folder.state);
    } catch {
      // a reader holding the file on Windows: the next beat writes it
      this.pending = true;
    }
  }

  private beat() {
    const now = cpuTimes();
    const total = now.total - this.cpu.total;
    const cpu = total > 0 ? Math.round(100 * (1 - (now.idle - this.cpu.idle) / total)) : undefined;
    this.cpu = now;
    this.emit({ t: Date.now(), type: 'beat', ...(cpu !== undefined ? { cpu } : {}) });
    if (this.pending) this.write(true);
  }

  onBegin(_config: FullConfig, suite: Suite) {
    const tests = suite.allTests().map((t: TestCase) => ({
      id: t.id,
      project: t.parent.project()?.name ?? '',
      file: relative(ROOT, t.location.file).split('\\').join('/'),
      path: t.titlePath().slice(3),
      line: t.location.line,
      timeout: t.timeout,
      retries: t.retries,
    }));
    this.emit({ t: Date.now(), type: 'begin', tests });
  }

  onTestBegin(test: TestCase, result: TestResult) {
    this.emit({ t: Date.now(), type: 'test-begin', id: test.id, retry: result.retry });
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep) {
    const id = String(++this.n);
    this.stepIds.set(step, id);
    const parent = step.parent ? this.stepIds.get(step.parent) : undefined;
    this.emit({ t: Date.now(), type: 'step-begin', test: test.id, step: id, ...(parent ? { parent } : {}), title: plain(step.title, 300), category: step.category });
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep) {
    const id = this.stepIds.get(step);
    if (!id) return;
    this.emit({ t: Date.now(), type: 'step-end', test: test.id, step: id, ...(step.error ? { error: plain(step.error.message, 500).split('\n')[0] } : {}) });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.emit({
      t: Date.now(),
      type: 'test-end',
      id: test.id,
      status: result.status,
      expected: test.expectedStatus,
      retry: result.retry,
      duration: result.duration,
      ...(result.errors[0] ? { error: errorOf(result.errors[0]) } : {}),
      ...(result.attachments.length ? { attachments: result.attachments.map((a) => ({ name: a.name, contentType: a.contentType, ...(a.path ? { path: a.path } : {}) })) } : {}),
    });
  }

  onStdOut(chunk: string | Buffer, test?: TestCase) {
    this.emit({ t: Date.now(), type: 'out', stream: 'out', text: plain(String(chunk), 2000), ...(test ? { test: test.id } : {}) });
  }

  onStdErr(chunk: string | Buffer, test?: TestCase) {
    this.emit({ t: Date.now(), type: 'out', stream: 'err', text: plain(String(chunk), 2000), ...(test ? { test: test.id } : {}) });
  }

  onError(error: TestError) {
    this.emit({ t: Date.now(), type: 'error', message: plain(error.message ?? error.value ?? 'Error', 2000) });
  }

  onEnd(result: FullResult) {
    this.emit({ t: Date.now(), type: 'end', status: result.status });
    clearInterval(this.timer);
    this.write(true);
  }
}
