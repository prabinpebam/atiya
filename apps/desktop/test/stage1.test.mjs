// @ts-check
/** Stage 1 (documentation/desktop/plan.md): the folder check, the port helpers, the view rules, the supervisor, settings. */
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCheckout, findCheckoutAbove, siteName } from '../src/core/checkout.mjs';
import { nameFromTasklist, pidFromNetstat } from '../src/core/ports.mjs';
import { isBridgeCaller, isExternalSafe, staysInWindow, viewPreferences } from '../src/core/security.mjs';
import { SettingsStore } from '../src/core/settings.mjs';
import { BACKOFF, nextDelay, stripAnsi, Supervisor } from '../src/core/supervisor.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'atiya-unit-'));

/** @param {string} dir @param {{ name?: string, config?: boolean, astro?: boolean, site?: string }} o */
function folder(dir, o = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: o.name ?? 'personal-site' }));
  if (o.config !== false) writeFileSync(join(dir, 'astro.config.mjs'), '');
  if (o.astro !== false) {
    mkdirSync(join(dir, 'node_modules', 'astro'), { recursive: true });
    mkdirSync(join(dir, 'node_modules', 'astro', 'bin'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'astro', 'package.json'), JSON.stringify({ name: 'astro', bin: { astro: './bin/astro.mjs' } }));
    writeFileSync(join(dir, 'node_modules', 'astro', 'bin', 'astro.mjs'), '');
  }
  if (o.site) {
    mkdirSync(join(dir, 'content'), { recursive: true });
    writeFileSync(join(dir, 'content', 'site.json'), JSON.stringify({ name: o.site }));
  }
  return dir;
}

describe('the folder check (1.2)', () => {
  it('accepts a checkout of the site, named from its settings', () => {
    const r = checkCheckout(folder(join(tmp(), 'a'), { site: 'Ada Lovelace' }));
    expect(r).toEqual({ ok: true, name: 'Ada Lovelace' });
  });
  it('refuses anything else, saying why', () => {
    const base = tmp();
    expect(checkCheckout(base)).toMatchObject({ ok: false, reason: expect.stringContaining('no package.json') });
    expect(checkCheckout(folder(join(base, 'b'), { name: 'other' }))).toMatchObject({ ok: false, reason: expect.stringContaining('another project') });
    expect(checkCheckout(folder(join(base, 'c'), { config: false }))).toMatchObject({ ok: false, reason: expect.stringContaining('astro.config.mjs') });
    expect(checkCheckout(folder(join(base, 'd'), { astro: false }))).toMatchObject({ ok: false, reason: expect.stringContaining('npm install') });
  });
  it('names a site without settings after its folder', () => {
    expect(siteName(join(tmp(), 'my-site'))).toBe('my-site');
  });
  it('finds the checkout the app lives in', () => {
    const repo = resolve(import.meta.dirname, '..', '..', '..');
    expect(findCheckoutAbove(resolve(import.meta.dirname))).toBe(repo);
    expect(findCheckoutAbove(tmp())).toBeNull();
  });
});

describe('ports (1.5)', () => {
  it('reads the listening PID from netstat', () => {
    const out = ['  Proto  Local Address          Foreign Address        State           PID', '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1100', '  TCP    127.0.0.1:4321         0.0.0.0:0              LISTENING       9876', '  TCP    127.0.0.1:43210        127.0.0.1:4321         ESTABLISHED     5555', '  TCP    [::1]:4395             [::]:0                 LISTENING       7777', '  TCP    127.0.0.1:4398         0.0.0.0:0              CLOSED          8888'].join('\r\n');
    expect(pidFromNetstat(out, 4321)).toBe(9876);
    expect(pidFromNetstat(out, 4322)).toBeNull();
    expect(pidFromNetstat(out, 4395)).toBe(7777);
    expect(pidFromNetstat(out, 4398)).toBe(8888);
  });
  it('reads the image name from tasklist', () => {
    expect(nameFromTasklist('"node.exe","9876","Console","1","120,000 K"\r\n')).toBe('node.exe');
    expect(nameFromTasklist('INFO: No tasks are running')).toBeNull();
  });
});

describe('the views (1.6)', () => {
  it('are sandboxed and isolated, with no Node', () => {
    const p = viewPreferences({ preload: 'x.cjs' });
    expect(p).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false, webSecurity: true, preload: 'x.cjs' });
    expect(viewPreferences()).not.toHaveProperty('preload');
  });
  it('navigate in place only within their origin, or between the app and its dev server', () => {
    const dev = 'http://localhost:4321';
    expect(staysInWindow('http://localhost:4321/_edit/', 'http://localhost:4321/work/', [dev])).toBe(true);
    expect(staysInWindow('app://ui/welcome.html', 'http://localhost:4321/_edit/', [dev, 'app://ui'])).toBe(true);
    expect(staysInWindow('http://localhost:4321/_edit/', 'https://example.com/', [dev])).toBe(false);
    expect(staysInWindow('http://localhost:4321/_edit/', 'http://127.0.0.1:4321/', [dev])).toBe(false);
    expect(staysInWindow('http://localhost:4321/', 'javascript:alert(1)', [dev])).toBe(false);
  });
  it('open only web and mail addresses outside', () => {
    expect(isExternalSafe('https://github.com/')).toBe(true);
    expect(isExternalSafe('mailto:a@b.c')).toBe(true);
    expect(isExternalSafe('file:///C:/Windows/')).toBe(false);
    expect(isExternalSafe('javascript:alert(1)')).toBe(false);
  });
  it('the bridge answers only the app\'s own pages', () => {
    expect(isBridgeCaller('app://ui/frame.html')).toBe(true);
    expect(isBridgeCaller('http://localhost:4321/_edit/')).toBe(false);
    expect(isBridgeCaller('app://evil/x.html')).toBe(false);
    expect(isBridgeCaller(undefined)).toBe(false);
  });
});

describe('the supervisor (1.1, 1.3, 1.4, 1.5)', () => {
  it('waits 1, 2, then 4 seconds, then stops trying', () => {
    expect(BACKOFF).toEqual([1000, 2000, 4000]);
    expect([0, 1, 2, 3].map((a) => nextDelay(a))).toEqual([1000, 2000, 4000, null]);
    expect(stripAnsi('\x1b[32mready\x1b[39m in 200ms')).toBe('ready in 200ms');
  });

  class FakeChild extends EventEmitter {
    constructor(/** @type {number} */ pid) {
      super();
      this.pid = pid;
      this.stdout = new EventEmitter();
      this.stderr = new EventEmitter();
    }
  }

  /** @param {Partial<import('../src/core/supervisor.mjs').SupervisorOptions> & { up?: () => boolean }} o */
  function rig(o = {}) {
    /** @type {FakeChild[]} */
    const children = [];
    const killed = [];
    const sup = new Supervisor({
      command: 'node', args: ['astro.js', 'dev'], cwd: '.', port: 4999, backoff: [10, 20, 40], pollMs: 5, stableMs: 10_000,
      isListening: async () => false,
      portOwner: async () => null,
      probe: async () => (o.up ? o.up() : true),
      killTree: async (pid) => {
        killed.push(pid);
        children.find((c) => c.pid === pid)?.emit('exit', null);
      },
      // @ts-ignore a fake child is enough for the supervisor
      spawn: () => {
        const c = new FakeChild(100 + children.length);
        children.push(c);
        return c;
      },
      ...o,
    });
    /** @type {string[]} */
    const states = [];
    sup.on('status', (s) => states.push(s.state));
    return { sup, children, killed, states };
  }
  const until = async (/** @type {() => boolean} */ f, ms = 2000) => {
    const end = Date.now() + ms;
    while (!f()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  it('starts the server and is ready when it answers', async () => {
    const { sup, states } = rig();
    await sup.start();
    await until(() => sup.status().state === 'ready');
    expect(states).toEqual(['checking', 'starting', 'ready']);
    expect(sup.status().url).toBe('http://localhost:4999/');
  });

  it('restarts a server that stops, after each wait in turn, then gives up with the log', async () => {
    const { sup, children } = rig();
    /** @type {number[]} */
    const waits = [];
    sup.on('status', (s) => s.state === 'restarting' && waits.push(/** @type {number} */ (s.nextInMs)));
    await sup.start();
    for (let i = 0; i < 4; i++) {
      await until(() => sup.status().state === 'ready');
      children.at(-1)?.stdout.emit('data', `run ${i}\n`);
      children.at(-1)?.emit('exit', 1);
      if (i < 3) await until(() => children.length === i + 2);
    }
    await until(() => sup.status().state === 'failed');
    expect(waits).toEqual([10, 20, 40]);
    expect(sup.status().message).toMatch(/restarting it didn't help/);
    expect(sup.status().log).toContain('run 3');
  });

  it('names what holds a taken port, and can use it', async () => {
    const { sup, children } = rig({ isListening: async () => true, portOwner: async () => ({ pid: 42, name: 'node.exe' }) });
    await sup.start();
    expect(sup.status()).toMatchObject({ state: 'port-busy', owner: { pid: 42, name: 'node.exe' } });
    expect(sup.status().message).toContain('node.exe (process 42)');
    expect(children).toHaveLength(0);
    sup.useExisting();
    expect(sup.status().state).toBe('external');
  });

  it('stops the server and everything it started', async () => {
    const { sup, killed } = rig();
    await sup.start();
    await until(() => sup.status().state === 'ready');
    await sup.stop();
    expect(killed).toEqual([100]);
    expect(sup.status().state).toBe('stopped');
  });

  it('restart starts again from the first wait', async () => {
    const { sup, children } = rig();
    await sup.start();
    await until(() => sup.status().state === 'ready');
    children[0].emit('exit', 1);
    await until(() => sup.status().state === 'ready' && children.length === 2);
    expect(sup.status().attempt).toBe(1);
    await sup.restart();
    await until(() => sup.status().state === 'ready');
    expect(sup.status().attempt).toBe(0);
  });

  it('says Node.js is missing when it is', async () => {
    const { sup, children } = rig();
    await sup.start();
    children[0].emit('error', Object.assign(new Error('spawn node ENOENT'), { code: 'ENOENT' }));
    await until(() => sup.status().state === 'failed');
    expect(sup.status().message).toMatch(/Install Node\.js/);
  });
});

describe('settings (1.2)', () => {
  it('remembers the current workspace, most recent first, without duplicates', () => {
    const store = new SettingsStore(tmp());
    expect(store.current()).toBeNull();
    store.remember({ kind: 'developer', path: 'C:\\a' });
    store.remember({ kind: 'developer', path: 'C:\\b' });
    store.remember({ kind: 'developer', path: 'c:\\A' });
    expect(store.read().workspaces.map((w) => w.path)).toEqual(['c:\\A', 'C:\\b']);
    expect(store.current()?.path).toBe('c:\\A');
    expect(store.read().keepInTray).toBe(true);
  });
});
