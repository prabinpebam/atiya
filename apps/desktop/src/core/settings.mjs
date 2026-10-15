// @ts-check
/** The app's remembered choices, as a small JSON file in its data folder. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * @typedef {{ kind: 'developer' | 'managed', path: string, name?: string }} Workspace
 * @typedef {{ workspaces: Workspace[], current: string | null, keepInTray: boolean, theme?: 'system' | 'light' | 'dark' }} Settings
 */

/** @returns {Settings} */
export const defaults = () => ({ workspaces: [], current: null, keepInTray: true });

export class SettingsStore {
  /** @param {string} dir */
  constructor(dir) {
    this.file = join(dir, 'settings.json');
  }

  /** @returns {Settings} */
  read() {
    if (!existsSync(this.file)) return defaults();
    try {
      return { ...defaults(), ...JSON.parse(readFileSync(this.file, 'utf8')) };
    } catch {
      return defaults();
    }
  }

  /** @param {(s: Settings) => Settings | void} change */
  update(change) {
    const s = this.read();
    const next = change(s) ?? s;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
    renameSync(tmp, this.file);
    return next;
  }

  /** Remembers a workspace and makes it the current one. @param {Workspace} w */
  remember(w) {
    return this.update((s) => {
      s.workspaces = [w, ...s.workspaces.filter((x) => x.path.toLowerCase() !== w.path.toLowerCase())].slice(0, 10);
      s.current = w.path;
    });
  }

  /** @returns {Workspace | null} */
  current() {
    const s = this.read();
    return s.workspaces.find((w) => w.path === s.current) ?? null;
  }
}
