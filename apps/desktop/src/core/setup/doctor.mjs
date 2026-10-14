// @ts-check
/**
 * Check my site, and `atiya doctor` (documentation/desktop/spec.md §3 J8, §5.1): every check of a site's
 * state, each with what to do when it fails. One module, so the app and the CLI report the same checks.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Git, sameRemote } from './git.mjs';

/** The checks, in the order they're reported. */
export const CHECKS = ['atiya.json', 'content', 'repository', 'saved', 'pushed', 'built', 'publishing'];

/**
 * @typedef {{ check: string, ok: boolean, message: string, fix?: string, url?: string }} Check
 * @param {string} dir the site's workspace
 * @param {{ github: import('./github.mjs').GitHub, gitConfigFile: string }} o
 * @returns {Promise<{ ok: boolean, checks: Check[], site: { repository: string | null, url: string | null } }>}
 */
export async function checkSite(dir, o) {
  /** @type {Check[]} */
  const checks = [];
  /** @param {string} check @param {boolean} ok @param {string} message @param {string} [fix] @param {string} [url] */
  const add = (check, ok, message, fix = '', url) => checks.push({ check, ok, message, ...(ok || !fix ? {} : { fix }), ...(url ? { url } : {}) });
  const done = (/** @type {string | null} */ repository = null, /** @type {string | null} */ url = null) => ({ ok: checks.length > 0 && checks.every((c) => c.ok), checks, site: { repository, url } });

  const atiyaFile = join(dir, 'atiya.json');
  if (!existsSync(atiyaFile)) {
    add('site', false, "This folder isn't an Atiya site.", 'Open your site\'s own folder, or make a site.');
    return done();
  }
  /** @type {any} */
  let atiya;
  try {
    atiya = JSON.parse(readFileSync(atiyaFile, 'utf8'));
    add('atiya.json', atiya?.schema === 1 && typeof atiya?.engine?.version === 'string', `Engine ${atiya?.engine?.version ?? 'unknown'}`, "atiya.json is damaged: put it back as it was last saved (git checkout -- atiya.json).");
  } catch {
    add('atiya.json', false, "atiya.json can't be read.", "Put it back as it was last saved (git checkout -- atiya.json).");
    return done();
  }
  add('content', existsSync(join(dir, 'content', 'site.json')) && existsSync(join(dir, 'content', 'structures', 'site.json')), 'The content folder is there', "The site's settings or structure are missing: put them back as they were last saved.");

  const stateFile = join(dir, '.atiya', 'setup.json');
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
  const [owner, name] = String(state?.repository ?? `${atiya.owner?.login ?? ''}/`).split('/');
  const git = new Git({ token: null, identity: { name: 'Atiya Studio', email: 'noreply@example.com' }, configFile: o.gitConfigFile });
  const origin = await git.origin(dir);
  const repo = owner && name ? await o.github.repo(owner, name).catch(() => null) : null;
  add('repository', !!repo && sameRemote(origin, repo.cloneUrl), repo ? `${owner}/${name} on GitHub` : "The site wasn't found on GitHub", 'Run setup again for this folder: it reconnects it.');
  const dirty = await git.run(['status', '--porcelain'], { cwd: dir }).catch(() => 'unknown');
  add('saved', dirty === '', dirty === '' ? 'Every change is committed' : 'Some changes aren\'t committed yet', 'Choose Save to remote in edit mode.');
  const head = await git.head(dir);
  const remote = repo ? await o.github.branchSha(owner, name, 'main').catch(() => null) : null;
  add('pushed', !!head && head === remote, head && head === remote ? 'GitHub has every change' : "Some changes aren't on GitHub yet", 'Choose Save to remote in edit mode.');
  const runs = head && repo ? await o.github.runs(owner, name, head).catch(() => []) : [];
  const run = runs.sort((a, b) => b.id - a.id)[0];
  const building = run && run.status !== 'completed';
  add('built', run?.conclusion === 'success', run ? (building ? 'Building now' : run.conclusion === 'success' ? 'The last build worked' : "The last build didn't work") : 'Not built yet', run?.conclusion === 'failure' ? 'Look at the build on GitHub, then save again.' : 'Wait a few minutes after a save.', run?.conclusion === 'failure' ? run.url : undefined);
  const pages = repo ? await o.github.pages(owner, name).catch(() => null) : null;
  add('publishing', pages?.buildType === 'workflow', pages ? 'Publishing is on' : 'Publishing is off', 'Run setup again for this folder: it turns publishing on.');
  return done(repo ? `${owner}/${name}` : null, state?.url ?? null);
}
