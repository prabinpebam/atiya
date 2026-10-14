// @ts-check
/**
 * A managed site's dev server runs under Electron's own Node, as a utility process (documentation/desktop/
 * spec.md §7.3): Electron's way to run Node in a shipped app, so a person needs no Node.js. This makes one
 * look like a child process to the supervisor (its stdout and stderr, its pid, `exit` and `error`).
 */
import { utilityProcess } from 'electron';
import { EventEmitter } from 'node:events';

/**
 * A spawn for the supervisor: `args[0]` is the module to run, the rest its arguments; `command` is unused.
 * @param {string} _command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} o
 */
export function utilitySpawn(_command, args, o) {
  const p = utilityProcess.fork(args[0], args.slice(1), { cwd: o.cwd, env: /** @type {any} */ (o.env), stdio: 'pipe', serviceName: 'Atiya Studio site' });
  /** @type {any} */
  const child = new EventEmitter();
  child.stdout = p.stdout;
  child.stderr = p.stderr;
  Object.defineProperty(child, 'pid', { get: () => p.pid });
  child.kill = () => p.kill();
  p.on('exit', (code) => child.emit('exit', code));
  // a utility process that can't start reports it as an error (its type and where)
  p.on(/** @type {any} */ ('error'), (/** @type {any} */ type, /** @type {any} */ location) => child.emit('error', new Error(`the site's process failed (${type}${location ? ` at ${location}` : ''})`)));
  return child;
}
