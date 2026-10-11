/**
 * The test launcher (documentation/editor/test-runs.md §4.2): start every end-to-end run through this, so
 * edit mode's Tests screen (/_edit/tests/) shows who started it, why, on what code, and whether it's alive.
 *
 *   node scripts/test-run.mjs --by agent --purpose "Check the swing" -- --project=chromium -g "the swing"
 *   node scripts/test-run.mjs status          the newest active run (else the newest), in the screen's words
 *   node scripts/test-run.mjs status --json   the same, as the screen gets it
 *
 * Everything after `--` goes to `playwright test`. The live reporter (tests/reporters/live.ts) is always on:
 * if the arguments name reporters, it's added to them. The run's folder is .test-runs/<id>/: run.json (who,
 * why, what code, the servers, the processes), output.log (everything the runner printed, also shown here),
 * events.ndjson and state.json (the reporter's), and end.json (how it ended). The last 20 runs are kept.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const RUNS = join(ROOT, '.test-runs');
const KEEP = 20;
const PORTS = [4329, 4330];
const REPORTER = './tests/reporters/live.ts';

const writeJson = (file, value) => {
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2));
  renameSync(`${file}.tmp`, file);
};
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const runId = (t = new Date()) => `${t.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-')}-${Math.random().toString(36).slice(2, 6)}`;
const listening = (port) =>
  new Promise((done) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.setTimeout(500);
    s.on('connect', () => (s.destroy(), done(true)));
    s.on('error', () => done(false));
    s.on('timeout', () => (s.destroy(), done(false)));
  });

/** The arguments for `playwright test`, with the live reporter always among the reporters. */
export function withLiveReporter(args) {
  const i = args.findIndex((a) => a === '--reporter' || a.startsWith('--reporter='));
  if (i < 0) return args;
  const out = [...args];
  if (out[i] === '--reporter') out[i + 1] = out[i + 1].includes('live') ? out[i + 1] : `${out[i + 1]},${REPORTER}`;
  else if (!out[i].includes('live')) out[i] = `${out[i]},${REPORTER}`;
  return out;
}

function prune() {
  if (!existsSync(RUNS)) return;
  const dirs = readdirSync(RUNS).filter((d) => existsSync(join(RUNS, d, 'run.json')) || existsSync(join(RUNS, d, 'state.json'))).sort().reverse();
  for (const d of dirs.slice(KEEP)) if (existsSync(join(RUNS, d, 'end.json'))) rmSync(join(RUNS, d), { recursive: true, force: true });
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

async function run(argv) {
  let by = 'unknown';
  let purpose = '';
  const sep = argv.indexOf('--');
  const own = sep < 0 ? argv : argv.slice(0, sep);
  const rest = sep < 0 ? [] : argv.slice(sep + 1);
  for (let i = 0; i < own.length; i++) {
    if (own[i] === '--by') by = own[++i] ?? by;
    else if (own[i] === '--purpose') purpose = own[++i] ?? purpose;
    else rest.push(own[i]);
  }
  const id = runId();
  const dir = join(RUNS, id);
  mkdirSync(dir, { recursive: true });
  process.env.TEST_RUN_DIR_FAILED = dir;
  const servers = await Promise.all(PORTS.map(async (port) => ({ port, reused: await listening(port) })));
  const args = withLiveReporter(rest);
  const info = {
    id,
    by,
    purpose,
    cwd: ROOT,
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    commit: git('rev-parse', '--short', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=no').length > 0,
    args,
    startedAt: Date.now(),
    pid: process.pid,
    launcher: true,
    servers,
  };
  writeJson(join(dir, 'run.json'), info);
  prune();
  for (const s of servers) if (s.reused) console.log(`[test-run] A server is already on port ${s.port}: Playwright will reuse it, so this run may test an older build.`);
  console.log(`[test-run] ${id}: watch it at http://localhost:4321/_edit/tests/`);

  const cli = join(dirname(createRequire(join(ROOT, 'package.json')).resolve('@playwright/test/package.json')), 'cli.js');
  const log = createWriteStream(join(dir, 'output.log'), { flags: 'a' });
  const child = spawn(process.execPath, [cli, 'test', ...args], { cwd: ROOT, env: { ...process.env, TEST_RUN_ID: id, TEST_RUN_DIR: dir }, stdio: ['inherit', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  writeJson(join(dir, 'run.json'), { ...info, childPid: child.pid });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      log.write(chunk);
      (stream === child.stderr ? process.stderr : process.stdout).write(chunk);
    });
  }
  let reason;
  const stop = () => {
    reason = 'stopped';
    killTree(child.pid);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code, signal) => {
    writeJson(join(dir, 'end.json'), { code, signal, at: Date.now(), ...(reason ? { reason } : {}) });
    log.end();
    process.exitCode = code ?? 1;
  });
}

async function status(argv) {
  const { listRuns, currentRun, viewOf } = await import('../src/site/editor/server/testRuns.ts');
  const { clock, roughly } = await import('../src/site/editor/model/testRun.ts');
  const runs = listRuns(ROOT);
  const r = currentRun(runs);
  if (!r) return console.log('No test runs yet.');
  const v = viewOf(r, runs);
  if (argv.includes('--json')) {
    const { state, ...rest } = v;
    return console.log(JSON.stringify(rest, null, 2));
  }
  const c = v.counts;
  const lines = [
    `${v.health.label} · ${c.done} of ${c.total} · ${c.failed} failed${v.left !== undefined ? ` · ${roughly(v.left)} left` : ''} · last signal ${v.beat ? clock(Date.now() - v.beat) : '?'} ago`,
    v.health.reason,
  ];
  if (v.now) lines.push(`Now: ${v.now.area} › ${v.now.path.join(' › ')}${v.now.steps.length ? ` · ${v.now.steps[v.now.steps.length - 1].title}` : ''} · ${clock(Date.now() - (v.now.start ?? Date.now()))}${v.now.usual ? `, usually ${clock(v.now.usual)}` : ''}`);
  lines.push(`Started by ${v.info.by}${v.info.purpose ? ` · "${v.info.purpose}"` : ''} · ${v.worktree.branch || 'this tree'}${v.info.commit ? ` @ ${v.info.commit}` : ''} · run ${v.id}`);
  for (const f of v.failures) lines.push(`  ✗ ${f.area} › ${f.path.join(' › ')} (${f.verdict})${f.message ? `: ${f.message}` : ''}`);
  if (!v.active && v.summary && v.summary !== v.health.reason) lines.push(v.summary);
  if (v.overlapping.length) lines.push(`Also running: ${v.overlapping.map((o) => `${o.id} (${o.branch})`).join(', ')}. Runs at once slow each other down.`);
  console.log(lines.join('\n'));
}

const argv = process.argv.slice(2);
if (argv[0] === 'status') await status(argv.slice(1));
else {
  try {
    await run(argv);
  } catch (e) {
    // the launcher's own failure is the run's end too, with its reason
    const dir = process.env.TEST_RUN_DIR_FAILED;
    if (dir) writeJson(join(dir, 'end.json'), { code: 1, signal: null, at: Date.now(), reason: String(e?.message ?? e).split('\n')[0] });
    throw e;
  }
}
