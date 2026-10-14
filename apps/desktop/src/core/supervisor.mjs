// @ts-check
/**
 * Runs the site's dev server for the app and keeps it running (documentation/desktop/spec.md §7.3, §7.6):
 * checks the port first, starts the server, waits until it answers, restarts it after 1, 2 then 4
 * seconds if it stops on its own, then gives up and says why, with the last lines of its log.
 * Everything it touches outside itself is injected, so the unit tests drive it with fakes.
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { get } from 'node:http';
import { isListening as netIsListening, killTree as netKillTree, portOwner as netPortOwner } from './ports.mjs';

/** The waits before each restart; after the last, the supervisor stops trying. */
export const BACKOFF = [1000, 2000, 4000];

/**
 * The wait before restart number `attempt` (0-based), or null when there are no more.
 * @param {number} attempt
 * @param {readonly number[]} [schedule]
 */
export function nextDelay(attempt, schedule = BACKOFF) {
  return attempt >= 0 && attempt < schedule.length ? schedule[attempt] : null;
}

/** Terminal colour codes, which a log shown in the app shouldn't carry. @param {string} s */
export const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/**
 * Does anything answer HTTP at this address? Any status counts: the server is up.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export function probeHttp(url) {
  return new Promise((resolvePromise) => {
    const req = get(url, (res) => {
      res.resume();
      resolvePromise(true);
    });
    req.setTimeout(1500, () => {
      req.destroy();
      resolvePromise(false);
    });
    req.on('error', () => resolvePromise(false));
  });
}

/**
 * @typedef {'idle' | 'checking' | 'starting' | 'ready' | 'restarting' | 'failed' | 'port-busy' | 'external' | 'stopped'} ServerState
 * @typedef {{ state: ServerState, url: string, port: number, attempt: number, nextInMs?: number, owner?: { pid: number, name: string } | null, message?: string, log: string[] }} ServerStatus
 * @typedef {{
 *   command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv, port: number, host?: string,
 *   readyPath?: string, backoff?: readonly number[], stableMs?: number, readyTimeoutMs?: number, pollMs?: number, logLines?: number,
 *   spawn?: typeof nodeSpawn, probe?: (url: string) => Promise<boolean>, isListening?: (port: number, host?: string) => Promise<boolean>,
 *   portOwner?: (port: number) => Promise<{ pid: number, name: string } | null>, killTree?: (pid: number) => Promise<void>,
 *   setTimer?: (fn: () => void, ms: number) => unknown, clearTimer?: (t: unknown) => void, now?: () => number,
 * }} SupervisorOptions
 */

export class Supervisor extends EventEmitter {
  /** @param {SupervisorOptions} o */
  constructor(o) {
    super();
    this.o = {
      host: 'localhost', readyPath: '/', backoff: BACKOFF, stableMs: 60_000, readyTimeoutMs: 180_000, pollMs: 400, logLines: 200,
      spawn: nodeSpawn, probe: probeHttp, isListening: netIsListening, portOwner: netPortOwner, killTree: netKillTree,
      setTimer: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setTimeout(fn, ms), clearTimer: (/** @type {any} */ t) => clearTimeout(t), now: () => Date.now(),
      ...o,
    };
    /** @type {ServerStatus} */
    this.s = { state: 'idle', url: `http://${this.o.host}:${o.port}/`, port: o.port, attempt: 0, log: [] };
    /** @type {import('node:child_process').ChildProcess | null} */
    this.child = null;
    this.stopping = false;
    /** @type {unknown} */
    this.timer = null;
    this.readyAt = 0;
    this.generation = 0;
  }

  /** @returns {ServerStatus} */
  status() {
    return { ...this.s, log: [...this.s.log] };
  }

  /** @param {Partial<ServerStatus>} patch */
  set(patch) {
    this.s = { ...this.s, ...patch };
    if (!('nextInMs' in patch) && patch.state && patch.state !== 'restarting') delete this.s.nextInMs;
    this.emit('status', this.status());
  }

  /** @param {string} chunk */
  log(chunk) {
    const lines = stripAnsi(chunk).split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return;
    this.s.log = [...this.s.log, ...lines].slice(-this.o.logLines);
    this.emit('log', lines);
  }

  /** Starts the server, unless it's running or starting. */
  async start() {
    if (this.child || ['checking', 'starting', 'ready'].includes(this.s.state)) return;
    this.stopping = false;
    const gen = ++this.generation;
    this.set({ state: 'checking', message: undefined, owner: undefined });
    if (await this.o.isListening(this.o.port, this.o.host)) {
      if (gen !== this.generation) return;
      const owner = await this.o.portOwner(this.o.port);
      if (gen !== this.generation) return;
      this.set({ state: 'port-busy', owner, message: `Port ${this.o.port} is already in use${owner ? ` by ${owner.name} (process ${owner.pid})` : ''}.` });
      return;
    }
    if (gen !== this.generation) return;
    this.set({ state: 'starting' });
    let child;
    try {
      child = this.o.spawn(this.o.command, this.o.args, {
        cwd: this.o.cwd,
        env: this.o.env ?? process.env,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      this.failed(`The dev server couldn't start: ${/** @type {Error} */ (e).message}`);
      return;
    }
    this.child = child;
    child.stdout?.on('data', (d) => this.log(String(d)));
    child.stderr?.on('data', (d) => this.log(String(d)));
    child.once('error', (e) => {
      if (this.child !== child) return;
      this.child = null;
      const missing = /** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT';
      this.failed(missing ? `${this.o.command} wasn't found. Install Node.js (version 22.12 or later), then choose Restart.` : `The dev server couldn't start: ${e.message}`);
    });
    child.once('exit', (code) => this.exited(child, code));
    this.waitReady(child, gen);
  }

  /** @param {import('node:child_process').ChildProcess} child @param {number} gen */
  async waitReady(child, gen) {
    const deadline = this.o.now() + this.o.readyTimeoutMs;
    while (this.child === child && gen === this.generation && this.s.state === 'starting') {
      if (await this.o.probe(this.s.url + this.o.readyPath.replace(/^\//, ''))) {
        if (this.child === child && this.s.state === 'starting') {
          this.readyAt = this.o.now();
          this.set({ state: 'ready' });
        }
        return;
      }
      if (this.o.now() > deadline) {
        this.log(`The dev server didn't answer within ${Math.round(this.o.readyTimeoutMs / 1000)} seconds.`);
        await this.o.killTree(child.pid ?? 0);
        return;
      }
      await new Promise((r) => this.o.setTimer(() => r(undefined), this.o.pollMs));
    }
  }

  /** @param {import('node:child_process').ChildProcess} child @param {number | null} code */
  exited(child, code) {
    if (this.child !== child) return;
    this.child = null;
    if (this.stopping) {
      this.set({ state: 'stopped' });
      return;
    }
    this.log(`The dev server stopped${code === null ? '' : ` (exit code ${code})`}.`);
    // a server that ran a good while before stopping starts its retries afresh
    const attempt = this.readyAt && this.o.now() - this.readyAt > this.o.stableMs ? 0 : this.s.attempt;
    this.readyAt = 0;
    const delay = nextDelay(attempt, this.o.backoff);
    if (delay === null) {
      this.failed('The dev server stopped, and restarting it didn\'t help.');
      return;
    }
    this.set({ state: 'restarting', attempt: attempt + 1, nextInMs: delay });
    this.timer = this.o.setTimer(() => {
      this.timer = null;
      if (this.s.state === 'restarting') this.start();
    }, delay);
  }

  /** @param {string} message */
  failed(message) {
    this.set({ state: 'failed', message });
  }

  /** Stops the server and everything it started; resolves once it has exited. */
  async stop() {
    this.stopping = true;
    this.generation++;
    if (this.timer) this.o.clearTimer(this.timer);
    this.timer = null;
    const child = this.child;
    if (!child) {
      if (this.s.state !== 'idle') this.set({ state: 'stopped' });
      return;
    }
    const gone = new Promise((r) => child.once('exit', r));
    await this.o.killTree(child.pid ?? 0);
    await Promise.race([gone, new Promise((r) => this.o.setTimer(() => r(undefined), 5000))]);
    if (this.child === child) {
      this.child = null;
      this.set({ state: 'stopped' });
    }
  }

  /** Restarts from scratch: the retries count again from the first. */
  async restart() {
    await this.stop();
    this.s.attempt = 0;
    await this.start();
  }

  /** Uses the server that's already on the port (after `port-busy`). */
  useExisting() {
    this.generation++;
    this.set({ state: 'external', message: undefined });
  }
}
