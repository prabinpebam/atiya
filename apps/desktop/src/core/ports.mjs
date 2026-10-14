// @ts-check
/** Ports and the processes that hold them (documentation/desktop/spec.md §7.6). */
import { execFile } from 'node:child_process';
import { connect } from 'node:net';

/**
 * Does something accept connections on this port of the loopback address?
 * @param {number} port
 * @param {string} [host]
 * @returns {Promise<boolean>}
 */
export function isListening(port, host = 'localhost') {
  return new Promise((resolvePromise) => {
    const socket = connect({ port, host });
    const done = (/** @type {boolean} */ v) => {
      socket.destroy();
      resolvePromise(v);
    };
    socket.setTimeout(800, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** @param {string} file @param {string[]} args @returns {Promise<string>} */
const run = (file, args) =>
  new Promise((resolvePromise) => execFile(file, args, { windowsHide: true, timeout: 8000 }, (err, out) => resolvePromise(err ? '' : String(out))));

/**
 * The process listening on a port, or null if it can't be told.
 * @param {number} port
 * @returns {Promise<{ pid: number, name: string } | null>}
 */
export async function portOwner(port) {
  if (process.platform === 'win32') {
    // a listening socket is one with no remote end: some Windows machines report its state as empty or CLOSED
    const ps = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$c = Get-NetTCPConnection -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -in @('0.0.0.0', '::') } | Select-Object -First 1; if ($c) { $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; "$($c.OwningProcess)|$($p.ProcessName)" }`]);
    const m = /^(\d+)\|(.*)$/m.exec(ps.trim());
    if (m) return { pid: Number(m[1]), name: m[2] ? `${m[2]}.exe` : 'another program' };
    const pid = pidFromNetstat(await run('netstat', ['-ano']), port);
    if (!pid) return null;
    return { pid, name: nameFromTasklist(await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])) ?? 'another program' };
  }
  const out = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc']);
  const pid = Number(/^p(\d+)/m.exec(out)?.[1]);
  if (!pid) return null;
  return { pid, name: /^c(.+)$/m.exec(out)?.[1] ?? 'another program' };
}

/**
 * The PID listening on a port, from `netstat -ano` output (Windows). Pure.
 * @param {string} out
 * @param {number} port
 */
export function pidFromNetstat(out, port) {
  for (const line of out.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    // listening rows have no remote end; their state can read LISTENING, CLOSED or nothing at all
    if (cols.length < 4 || cols[0] !== 'TCP' || !/^(0\.0\.0\.0|\[::\]):0$/.test(cols[2])) continue;
    if (cols[1].endsWith(`:${port}`)) return Number(cols[cols.length - 1]) || null;
  }
  return null;
}

/** The image name from `tasklist /FO CSV /NH` output (Windows). Pure. @param {string} out */
export function nameFromTasklist(out) {
  const m = /^"([^"]+)"/m.exec(out.trim());
  return m ? m[1] : null;
}

/**
 * Stops a process and everything it started: on Windows by PID (`taskkill /T`), elsewhere its
 * process group, which the supervisor starts detached.
 * @param {number} pid
 */
export async function killTree(pid) {
  if (process.platform === 'win32') {
    await run('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}
