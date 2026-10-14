// @ts-check
/**
 * Sync (documentation/desktop/spec.md §4.7): on opening a site, bring in what another computer saved.
 * Nothing unsaved here: fast-forward. Both sides changed: this computer's commits go on top (rebase). A
 * page changed on both: stop and ask which to keep, per resource, in words; then do it again with the
 * answers. Edit mode saves without committing, so unsaved work here is committed first, as Save to
 * remote would. Never forces, never loses either side without being asked.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {{ file: string, name: string }} Conflict
 * @typedef {{ state: 'no-remote' | 'up-to-date' | 'ahead' | 'fast-forwarded' | 'rebased', committed: boolean }
 *   | { state: 'conflict', committed: boolean, conflicts: Conflict[] }} SyncResult
 * @typedef {Record<string, 'mine' | 'theirs'>} Choices keyed by file: keep this computer's, or the other's
 */

/** What a changed file is, in words (spec §4.7). @param {string} dir @param {string} file */
export function resourceName(dir, file) {
  const f = file.replace(/\\/g, '/');
  const titled = (/** @type {string} */ kind) => {
    try {
      const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return `${kind}: ${doc.title ?? doc.name ?? f.split('/').pop()?.replace(/\.json$/, '')}`;
    } catch {
      return `${kind}: ${f.split('/').pop()?.replace(/\.json$/, '')}`;
    }
  };
  if (/^content\/articles\/[^/]+\.json$/.test(f)) return titled('Page');
  if (f === 'content/structures/site.json') return 'The sections and navigation';
  if (f === 'content/structures/planet.json') return "The planet's buildings";
  if (f === 'content/site.json') return 'The site settings';
  if (/^content\/people\//.test(f)) return titled('Person');
  if (/^content\/media\//.test(f)) return `Picture: ${f.split('/').pop()}`;
  return f;
}

/**
 * @param {import('./git.mjs').Git} git
 * @param {string} dir the workspace
 * @param {{ choices?: Choices }} [o]
 * @returns {Promise<SyncResult>}
 */
export async function sync(git, dir, o = {}) {
  const run = (/** @type {string[]} */ args, /** @type {Partial<Parameters<typeof git.run>[1]>} */ x = {}) => git.run(args, { cwd: dir, ...x });
  // a rebase left half done (a crash) is put back first
  if (existsSync(join(dir, '.git', 'rebase-merge')) || existsSync(join(dir, '.git', 'rebase-apply'))) await run(['rebase', '--abort']).catch(() => {});
  await run(['fetch', 'origin'], { network: true });
  const remote = await run(['rev-parse', '--verify', '-q', 'refs/remotes/origin/main']).catch(() => '');
  if (!remote) return { state: 'no-remote', committed: false };

  let committed = false;
  if ((await run(['status', '--porcelain'])) !== '') {
    await run(['add', '-A']);
    await run(['commit', '-m', 'Changes made on this computer']);
    committed = true;
  }
  const local = await run(['rev-parse', 'HEAD']);
  if (local === remote) return { state: 'up-to-date', committed };
  const base = await run(['merge-base', 'HEAD', 'refs/remotes/origin/main']).catch(() => '');
  if (base === remote) return { state: 'ahead', committed };
  if (base === local) {
    await run(['merge', '--ff-only', 'refs/remotes/origin/main']);
    return { state: 'fast-forwarded', committed };
  }

  const quiet = { env: { GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' } };
  const conflicted = async () => (await run(['diff', '--name-only', '--diff-filter=U'])).split('\n').filter(Boolean);
  let ok = await run(['rebase', 'refs/remotes/origin/main'], quiet).then(() => true, () => false);
  while (!ok) {
    const files = await conflicted();
    if (!files.length) {
      // a step with nothing left to resolve (both sides made the same change)
      ok = await run(['rebase', '--continue'], quiet).then(() => true, () => run(['rebase', '--skip'], quiet).then(() => true, () => false));
      continue;
    }
    const missing = files.filter((f) => !o.choices?.[f]);
    if (missing.length) {
      await run(['rebase', '--abort']);
      // named after the abort: the files are this computer's again, not half merged
      const conflicts = files.map((file) => ({ file, name: resourceName(dir, file) }));
      return { state: 'conflict', committed, conflicts };
    }
    for (const f of files) {
      // during a rebase, "ours" is the other computer's (the base being rebuilt on), "theirs" this computer's commit
      const side = o.choices?.[f] === 'mine' ? '--theirs' : '--ours';
      const kept = await run(['checkout', side, '--', f]).then(() => true, () => false);
      if (kept) await run(['add', '--', f]);
      else await run(['rm', '-q', '--', f]);
    }
    ok = await run(['rebase', '--continue'], quiet).then(() => true, () => false);
  }
  return { state: 'rebased', committed };
}
