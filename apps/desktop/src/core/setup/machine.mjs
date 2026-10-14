// @ts-check
/**
 * The setup machine (documentation/desktop/spec.md §4.4): one list of steps, each a check and an act.
 * Every run checks every step and acts only where it isn't done, so a second run changes nothing and an
 * interrupted one carries on. The app's screens and the `atiya` CLI both drive it; it talks to them
 * only through events.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentsMd, atiyaJson, GITATTRIBUTES, GITIGNORE, readme, workflow } from './files.mjs';
import { Git, sameRemote } from './git.mjs';
import { GitHubError, missingScopes } from './github.mjs';
import { writeStarter } from './starter.mjs';

/** The exit codes of spec §5.3. */
export const EXIT = { ok: 0, needsPerson: 10, conflict: 20, refused: 30, other: 1 };

/** The steps, in order (spec §4.4; the app opens edit mode between first-save and first-build). */
export const STEPS = ['signed-in', 'email', 'repository', 'workspace', 'publishing', 'first-save', 'first-build', 'live'];

export class SetupError extends Error {
  /** @param {string} message @param {{ code?: number, step?: string, action?: { needs: string, url?: string } }} [o] */
  constructor(message, o = {}) {
    super(message);
    this.code = o.code ?? EXIT.other;
    this.step = o.step;
    this.action = o.action;
  }
}

/**
 * @typedef {{ type: 'plan', steps: string[], site: SiteRef }
 *   | { type: 'step', step: string, state: 'checking' | 'doing' | 'done' | 'todo' | 'skipped' | 'waiting' | 'failed', message: string }
 *   | { type: 'action', needs: string, message: string, url?: string, code?: string }
 *   | { type: 'milestone', name: 'ready-to-edit', site: SiteRef }
 *   | { type: 'result', ok: boolean, live: boolean, applied: boolean, site: SiteRef | null, code?: number, message?: string }} SetupEvent
 * @typedef {{ repository: string, url: string, dir: string }} SiteRef
 * @typedef {{
 *   github: import('./github.mjs').GitHub,
 *   inputs: { name?: string | null, repo?: string | null, explore?: 'little-planet' | 'site', samples?: boolean, dir?: string | null, home: string },
 *   apply: boolean, wait?: boolean, waitForEmail?: boolean,
 *   engine: { version: string, commit: string | null, sha256: string | null },
 *   gitConfigFile: string, git?: string, starter?: string,
 *   emit?: (e: SetupEvent) => void, sleep?: (ms: number) => Promise<void>, now?: () => number, today?: string,
 *   pollMs?: number, emailPollMs?: number, firstRunWaitMs?: number, buildTimeoutMs?: number, liveTimeoutMs?: number,
 *   fetchSite?: (url: string) => Promise<{ ok: boolean, text: string }>,
 *   failAfter?: string,
 * }} SetupOptions
 */

const escapeHtml = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** @param {string} url */
async function defaultFetchSite(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    return { ok: r.ok, text: r.ok ? await r.text() : '' };
  } catch {
    return { ok: false, text: '' };
  }
}

/** The site's address for a repository (spec F5). @param {string} login @param {string} repo */
export function siteUrl(login, repo) {
  const host = `${login.toLowerCase()}.github.io`;
  return repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
}

/**
 * Runs setup: plans it (every check), and with `apply` does what isn't done.
 * @param {SetupOptions} o
 * @returns {Promise<Extract<SetupEvent, { type: 'result' }>>}
 */
export async function runSetup(o) {
  const emit = o.emit ?? (() => {});
  const sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const pollMs = o.pollMs ?? 5000;
  const gh = o.github;
  /** @type {SiteRef | null} */
  let site = null;
  /** @param {string} step @param {Extract<SetupEvent, { type: 'step' }>['state']} state @param {string} message */
  const step = (step, state, message) => emit({ type: 'step', step, state, message });
  const stop = (/** @type {string} */ s) => {
    if (o.failAfter === s) throw new Error(`stopped after ${s} (a test's interruption)`);
  };

  try {
    // 1. signed in
    step('signed-in', 'checking', 'Checking the GitHub connection');
    let user;
    try {
      user = await gh.user();
    } catch (e) {
      if (e instanceof GitHubError && e.kind === 'auth') throw new SetupError("GitHub isn't connected: sign in again.", { code: EXIT.needsPerson, step: 'signed-in', action: { needs: 'sign-in' } });
      throw e;
    }
    const lacking = missingScopes(user.scopes);
    if (lacking.length)
      throw new SetupError(`The GitHub token can't ${lacking.includes('workflow') ? 'add the workflow that publishes the site' : 'create repositories'} (it lacks the ${lacking.join(' and ')} scope). With the GitHub CLI, run: gh auth refresh -s ${lacking.join(',')}`, { code: EXIT.refused, step: 'signed-in' });
    step('signed-in', 'done', `Signed in as ${user.login}`);

    // 2. a confirmed email
    step('email', 'checking', "Checking that the account's email is confirmed");
    let verified = await gh.primaryEmailVerified();
    if (verified === false) {
      const action = { needs: 'confirm-email', url: `${gh.web}/settings/emails` };
      emit({ type: 'action', ...action, message: `GitHub needs ${user.login} to confirm their email before it can keep the site.` });
      if (!o.waitForEmail) throw new SetupError('GitHub needs the account\'s email confirmed: open the email from GitHub and choose its link, then run setup again.', { code: EXIT.needsPerson, step: 'email', action });
      step('email', 'waiting', 'Waiting for the email to be confirmed');
      while (verified === false) {
        await sleep(o.emailPollMs ?? 5000);
        verified = await gh.primaryEmailVerified();
      }
    }
    step('email', verified === null ? 'skipped' : 'done', verified === null ? "The token can't read emails: skipped" : 'Email confirmed');

    // the repository's name and the site's address (F5)
    const name = (o.inputs.name ?? '').trim() || user.name || user.login;
    const repoName = await chooseRepo(gh, user.login, o.inputs.repo ?? null);
    const dir = o.inputs.dir ?? join(o.inputs.home, 'Atiya', repoName);
    site = { repository: `${user.login}/${repoName}`, url: siteUrl(user.login, repoName), dir };
    emit({ type: 'plan', steps: STEPS, site });

    const git = new Git({ git: o.git, token: gh.isGitHubDotCom ? gh.token : null, identity: { name, email: `${user.id}+${user.login}@users.noreply.github.com` }, configFile: o.gitConfigFile });

    // 3. the repository
    let repo = await gh.repo(user.login, repoName);
    if (repo) step('repository', 'done', `${site.repository} is ready`);
    else if (!o.apply) step('repository', 'todo', `Create ${site.repository}, public`);
    else {
      step('repository', 'doing', 'Creating your site on GitHub');
      repo = await gh.createRepo(repoName, `${name}'s portfolio site`);
      step('repository', 'done', `Created ${site.repository}`);
    }
    stop('repository');

    // 4. the workspace
    const ours = existsSync(join(dir, '.git')) && existsSync(join(dir, 'atiya.json')) && repo && sameRemote(await git.origin(dir), repo.cloneUrl);
    if (ours) step('workspace', 'done', `Your site's files are in ${dir}`);
    else if (existsSync(dir) && readdirSync(dir).some((f) => f !== '.atiya'))
      throw new SetupError(`The folder ${dir} already holds something else. Choose another folder (--dir).`, { code: EXIT.conflict, step: 'workspace' });
    else if (!o.apply || !repo) step('workspace', 'todo', `Write your first pages into ${dir}`);
    else {
      step('workspace', 'doing', 'Saving your first pages');
      await makeWorkspace({ o, git, gh, repo, dir, name, user, site });
      step('workspace', 'done', `Your site's files are in ${dir}`);
    }
    stop('workspace');

    // 5. publishing (Pages, built by Actions)
    let pages = repo ? await gh.pages(user.login, repoName) : null;
    let pagesLater = false;
    if (pages?.buildType === 'workflow') step('publishing', 'done', 'Publishing is on');
    else if (!o.apply || !repo) step('publishing', 'todo', 'Turn on publishing with GitHub Pages');
    else {
      step('publishing', 'doing', 'Turning on publishing');
      try {
        pages = await gh.enablePages(user.login, repoName);
        step('publishing', 'done', 'Publishing is on');
      } catch (e) {
        if (!(e instanceof GitHubError) || e.kind === 'rate-limit' || e.kind === 'network') throw e;
        // GitHub may refuse Pages on an empty repository: it's turned on after the first save
        pagesLater = true;
        step('publishing', 'waiting', 'Publishing turns on after the first save');
      }
    }
    stop('publishing');

    // 6. the first save (push)
    const local = existsSync(join(dir, '.git')) ? await git.head(dir) : null;
    const remote = repo ? await gh.branchSha(user.login, repoName, 'main') : null;
    let dispatchedAt = 0;
    if (local && local === remote) step('first-save', 'done', 'Your first pages are on GitHub');
    else if (!o.apply || !local) step('first-save', 'todo', 'Save your first pages to GitHub');
    else {
      step('first-save', 'doing', 'Saving your first pages to GitHub');
      await git.run(['push', '-u', 'origin', 'main'], { cwd: dir, network: true });
      step('first-save', 'done', 'Your first pages are on GitHub');
      if (pagesLater) {
        pages = await gh.enablePages(user.login, repoName);
        step('publishing', 'done', 'Publishing is on');
        dispatchedAt = now();
        await gh.dispatch(user.login, repoName, 'site.yml');
      }
    }
    stop('first-save');

    if (!o.apply) {
      for (const s of ['first-build', 'live']) step(s, local && local === remote ? 'checking' : 'todo', s === 'live' ? `Go live at ${site.url}` : 'Build the site');
      if (local && local === remote) {
        const built = await latestRun(gh, user.login, repoName, local, 0);
        step('first-build', built?.conclusion === 'success' ? 'done' : 'todo', built ? `The last build ${built.conclusion ?? built.status}` : 'Not built yet');
      }
      return result(emit, { ok: true, live: false, applied: false, site });
    }

    emit({ type: 'milestone', name: 'ready-to-edit', site });
    if (o.wait === false) return result(emit, { ok: true, live: false, applied: true, site });

    // 7. the first build
    const sha = /** @type {string} */ (await git.head(dir));
    const started = now();
    let dispatched = dispatchedAt > 0;
    let lastState = '';
    for (;;) {
      const run = await latestRun(gh, user.login, repoName, sha, dispatchedAt);
      if (run?.status === 'completed') {
        if (run.conclusion === 'success') {
          step('first-build', 'done', 'Your site is built');
          break;
        }
        const failed = await gh.failedStep(user.login, repoName, run.id).catch(() => null);
        throw new SetupError(`Your site didn't publish${failed ? `: the step "${failed}" failed` : ''}.`, { code: EXIT.other, step: 'first-build', action: { needs: 'look-at-build', url: run.url } });
      }
      const state = run ? (run.status === 'queued' ? 'Waiting for GitHub to build your site' : 'Building your site') : 'Waiting for GitHub to start building';
      if (state !== lastState) step('first-build', 'doing', state);
      lastState = state;
      if (!run && !dispatched && now() - started > (o.firstRunWaitMs ?? 30_000)) {
        dispatched = true;
        dispatchedAt = now();
        await gh.dispatch(user.login, repoName, 'site.yml');
      }
      if (now() - started > (o.buildTimeoutMs ?? 20 * 60_000)) throw new SetupError('Your site is taking longer than usual to build. It will go live by itself; check again later.', { code: EXIT.other, step: 'first-build' });
      await sleep(pollMs);
    }

    // 8. live
    const url = pages?.url ?? site.url;
    const fetchSite = o.fetchSite ?? defaultFetchSite;
    step('live', 'doing', 'Putting your site online');
    const liveStart = now();
    for (;;) {
      const r = await fetchSite(url);
      if (r.ok && r.text.includes(escapeHtml(name))) {
        step('live', 'done', `Your site is live at ${site.url}`);
        return result(emit, { ok: true, live: true, applied: true, site });
      }
      if (now() - liveStart > (o.liveTimeoutMs ?? 10 * 60_000)) {
        step('live', 'waiting', 'Your site is built; GitHub is still putting it online');
        return result(emit, { ok: true, live: false, applied: true, site });
      }
      await sleep(pollMs);
    }
  } catch (e) {
    const err = e instanceof SetupError ? e : e instanceof GitHubError ? fromGitHub(e) : new SetupError(/** @type {Error} */ (e).message);
    if (err.step) step(err.step, 'failed', err.message);
    return result(emit, { ok: false, live: false, applied: o.apply, site, code: err.code, message: err.message });
  }
}

/** @param {(e: SetupEvent) => void} emit @param {Omit<Extract<SetupEvent, { type: 'result' }>, 'type'>} r */
function result(emit, r) {
  /** @type {Extract<SetupEvent, { type: 'result' }>} */
  const ev = { type: 'result', ...r };
  emit(ev);
  return ev;
}

/** @param {GitHubError} e */
function fromGitHub(e) {
  if (e.kind === 'auth') return new SetupError("GitHub isn't connected: sign in again.", { code: EXIT.needsPerson, action: { needs: 'sign-in' } });
  if (e.kind === 'rate-limit') return new SetupError(`GitHub asked us to wait. Try again after ${new Date(e.reset ?? Date.now()).toLocaleTimeString()}.`, { code: EXIT.refused });
  if (e.kind === 'network') return new SetupError("Can't reach GitHub. Check the connection, then run setup again: it carries on where it stopped.", { code: EXIT.other });
  if (/actions/i.test(e.message) && /disabled/i.test(e.message)) return new SetupError('GitHub Actions is off for this account, and it publishes the site. Turn it on in GitHub\'s settings, then try again.', { code: EXIT.refused });
  return new SetupError(`GitHub refused: ${e.message}`, { code: EXIT.refused });
}

/**
 * The repository's name: the one asked for, else `<login>.github.io`, else `site`, `site-2`… taking the
 * first that's free, empty, or already an Atiya site of theirs (spec F5).
 * @param {import('./github.mjs').GitHub} gh @param {string} login @param {string | null} asked
 */
async function chooseRepo(gh, login, asked) {
  const usable = async (/** @type {string} */ n) => {
    const r = await gh.repo(login, n);
    if (!r) return true;
    if (r.private || r.owner.toLowerCase() !== login.toLowerCase()) return false;
    return (await gh.hasFile(login, n, 'atiya.json')) || !(await gh.branchSha(login, n, 'main'));
  };
  if (asked) {
    if (!(await usable(asked))) throw new SetupError(`${login}/${asked} already holds something else. Choose another name (--repo).`, { code: EXIT.conflict, step: 'repository' });
    return asked;
  }
  for (const n of [`${login.toLowerCase()}.github.io`, 'site', 'site-2', 'site-3', 'site-4']) if (await usable(n)) return n;
  throw new SetupError('Every name setup tries is taken in this account. Choose one (--repo).', { code: EXIT.conflict, step: 'repository' });
}

/**
 * The newest run of the site's workflow for a commit, created at or after `since` (ms).
 * @param {import('./github.mjs').GitHub} gh @param {string} owner @param {string} name @param {string} sha @param {number} since
 */
async function latestRun(gh, owner, name, sha, since) {
  const runs = (await gh.runs(owner, name, sha)).filter((r) => /site\.yml$/.test(r.path) || !r.path);
  const fresh = since ? runs.filter((r) => r.created >= since - 1000) : runs;
  return fresh.sort((a, b) => b.id - a.id)[0] ?? null;
}

/**
 * Writes the first content and files, and commits them, in a folder beside the workspace that's renamed
 * into place when it's whole, so an interrupted run leaves no half-made workspace. If the repository
 * already holds an Atiya site (another computer), clones it instead.
 * @param {{ o: SetupOptions, git: Git, gh: import('./github.mjs').GitHub, repo: NonNullable<Awaited<ReturnType<import('./github.mjs').GitHub['repo']>>>,
 *   dir: string, name: string, user: { login: string, id: number }, site: SiteRef }} a
 */
async function makeWorkspace({ o, git, gh, repo, dir, name, user, site }) {
  const parent = join(dir, '..');
  mkdirSync(parent, { recursive: true });
  if (await gh.branchSha(user.login, repo.name, 'main')) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    await git.run(['clone', repo.cloneUrl, dir], { cwd: parent, network: true });
  } else {
    const partial = `${dir}.partial`;
    rmSync(partial, { recursive: true, force: true });
    mkdirSync(partial, { recursive: true });
    const facts = { login: user.login, id: user.id, name, repo: repo.name, url: site.url, explore: o.inputs.explore ?? 'little-planet', engine: o.engine };
    writeStarter(partial, { name, planet: facts.explore === 'little-planet', samples: o.inputs.samples ?? true, today: o.today ?? new Date().toISOString().slice(0, 10), starter: o.starter });
    writeFileSync(join(partial, 'atiya.json'), atiyaJson(facts));
    mkdirSync(join(partial, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(partial, '.github', 'workflows', 'site.yml'), workflow(facts));
    writeFileSync(join(partial, 'AGENTS.md'), agentsMd(facts));
    writeFileSync(join(partial, 'README.md'), readme(facts));
    writeFileSync(join(partial, '.gitattributes'), GITATTRIBUTES);
    writeFileSync(join(partial, '.gitignore'), GITIGNORE);
    await git.run(['init', '--initial-branch=main'], { cwd: partial });
    await git.run(['add', '-A'], { cwd: partial });
    await git.run(['commit', '-m', 'Create my site'], { cwd: partial });
    await git.run(['remote', 'add', 'origin', repo.cloneUrl], { cwd: partial });
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    renameSync(partial, dir);
  }
  mkdirSync(join(dir, '.atiya'), { recursive: true });
  writeFileSync(join(dir, '.atiya', 'setup.json'), JSON.stringify({ schema: 1, repository: site.repository, url: site.url, cloneUrl: repo.cloneUrl, createdAt: new Date(o.now ? o.now() : Date.now()).toISOString() }, null, 2) + '\n');
}
