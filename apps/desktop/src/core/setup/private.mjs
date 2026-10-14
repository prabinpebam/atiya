// @ts-check
/**
 * Private pages on first use (documentation/desktop/spec.md §4.4, F8): a second, private repository for
 * the private pages, a read-only deploy key on it whose private half is sealed into the site
 * repository's PRIVATE_CONTENT_KEY secret (the build fetches the pages with it), and the `private-pages`
 * submodule in the site. The same check-and-act machine as setup: a second run changes nothing, and an
 * interrupted one carries on. The key's private half exists only in memory, on its way to the secret.
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Git } from './git.mjs';
import { GitHubError } from './github.mjs';
import { EXIT, SetupError } from './machine.mjs';
import { ed25519KeyPair } from './sshkey.mjs';
import { sealSecret } from './seal.mjs';

export const PRIVATE_STEPS = ['private-repository', 'private-files', 'build-key', 'submodule'];
export const SECRET = 'PRIVATE_CONTENT_KEY';
export const KEY_TITLE = 'Atiya Studio: the site build reads private pages';

/**
 * The private pages' first files: no pages yet, no access codes, and the words offered with a new one.
 * @param {string} siteUrl the live site's address
 * @returns {Record<string, string>}
 */
export function privateSeed(siteUrl) {
  const json = (/** @type {unknown} */ v) => JSON.stringify(v, null, 2) + '\n';
  return {
    'README.md': 'The private pages of an Atiya site: only you can see this repository. Atiya Studio keeps it; the site\'s build reads it with a read-only key and publishes the pages sealed.\n',
    'access.json': json({ grants: [] }),
    'access-message.json': json({
      site: siteUrl.replace(/\/$/, ''),
      code: 'Hi {name}, here is access to some of my work that is not public. Open {link} and sign in with this access code: {code}. It works until {expires}.',
      link: 'Hi {name}, here is a page I would like to share with you: {link} It works until {expires}.',
    }),
    'structures/overlay.json': json({ sections: [] }),
  };
}

/**
 * The site repository a workspace belongs to, from what setup recorded.
 * @param {string} dir
 * @returns {{ owner: string, name: string, url: string }}
 */
export function siteOf(dir) {
  const file = join(dir, '.atiya', 'setup.json');
  if (!existsSync(join(dir, 'atiya.json')) || !existsSync(file)) throw new SetupError(`${dir} isn't a site made by Atiya Studio.`, { code: EXIT.conflict, step: 'private-repository' });
  const s = JSON.parse(readFileSync(file, 'utf8'));
  const [owner, name] = String(s.repository).split('/');
  return { owner, name, url: String(s.url) };
}

/** Does the site's .gitmodules name the private pages? @param {string} dir */
const hasSubmodule = (dir) => existsSync(join(dir, '.gitmodules')) && /path\s*=\s*private-pages\s*$/m.test(readFileSync(join(dir, '.gitmodules'), 'utf8'));

/**
 * @typedef {{
 *   github: import('./github.mjs').GitHub, dir: string, apply: boolean, gitConfigFile: string, git?: string,
 *   emit?: (e: import('./machine.mjs').SetupEvent) => void, failAfter?: string,
 * }} PrivateOptions
 */

/**
 * Sets up private pages for the site in `dir`.
 * @param {PrivateOptions} o
 * @returns {Promise<{ type: 'result', ok: boolean, applied: boolean, code?: number, message?: string, detail?: string, repository?: string }>}
 */
export async function runPrivateSetup(o) {
  const emit = o.emit ?? (() => {});
  const gh = o.github;
  /** @param {string} s @param {Extract<import('./machine.mjs').SetupEvent, { type: 'step' }>['state']} state @param {string} message */
  const step = (s, state, message) => emit({ type: 'step', step: s, state, message });
  const stop = (/** @type {string} */ s) => {
    if (o.failAfter === s) throw new Error(`stopped after ${s} (a test's interruption)`);
  };
  /** @param {Omit<Awaited<ReturnType<typeof runPrivateSetup>>, 'type'>} r */
  const result = (r) => {
    /** @type {Awaited<ReturnType<typeof runPrivateSetup>>} */
    const ev = { type: 'result', ...r };
    emit(/** @type {any} */ (ev));
    return ev;
  };
  let repository;
  try {
    const site = siteOf(o.dir);
    const user = await gh.user();
    if (user.login.toLowerCase() !== site.owner.toLowerCase()) throw new SetupError(`This site is ${site.owner}'s; GitHub is connected as ${user.login}.`, { code: EXIT.refused, step: 'private-repository' });
    const privName = `${site.name}-private`;
    repository = `${site.owner}/${privName}`;
    emit({ type: 'plan', steps: PRIVATE_STEPS, site: { repository, url: site.url, dir: join(o.dir, 'private-pages') } });
    const atiya = JSON.parse(readFileSync(join(o.dir, 'atiya.json'), 'utf8'));
    const name = JSON.parse(readFileSync(join(o.dir, 'content', 'site.json'), 'utf8')).name ?? user.login;
    const git = new Git({ git: o.git, token: gh.isGitHubDotCom ? gh.token : null, identity: { name, email: `${atiya.owner?.id ?? user.id}+${user.login}@users.noreply.github.com` }, configFile: o.gitConfigFile });

    // 1. the private repository
    let repo = await gh.repo(site.owner, privName);
    if (repo && !repo.private) throw new SetupError(`${repository} is public, so it can't keep private pages. Make it private on GitHub, or rename it, then try again.`, { code: EXIT.conflict, step: 'private-repository' });
    if (repo) step('private-repository', 'done', `${repository} is ready, and private`);
    else if (!o.apply) step('private-repository', 'todo', `Create ${repository}, private`);
    else {
      step('private-repository', 'doing', 'Creating a private repository for your private pages');
      repo = await gh.createPrivateRepo(privName, `${name}'s private pages (Atiya Studio)`);
      step('private-repository', 'done', `Created ${repository}, private`);
    }
    stop('private-repository');

    // 2. its first files
    const seeded = repo ? !!(await gh.branchSha(site.owner, privName, 'main')) : false;
    if (seeded) step('private-files', 'done', 'The private repository has its first files');
    else if (!o.apply || !repo) step('private-files', 'todo', 'Save the private pages\' first files');
    else {
      step('private-files', 'doing', 'Saving the private pages\' first files');
      const tmp = mkdtempSync(join(tmpdir(), 'atiya-private-seed-'));
      for (const [f, text] of Object.entries(privateSeed(site.url))) {
        mkdirSync(join(tmp, f, '..'), { recursive: true });
        writeFileSync(join(tmp, f), text);
      }
      await git.run(['init', '--initial-branch=main'], { cwd: tmp });
      await git.run(['add', '-A'], { cwd: tmp });
      await git.run(['commit', '-m', 'Set up private pages'], { cwd: tmp });
      await git.run(['push', repo.cloneUrl, 'main'], { cwd: tmp, network: true });
      // pushed: a temporary folder left behind is the system's to clear
      try {
        removeTree(tmp);
      } catch {}
      step('private-files', 'done', 'The private repository has its first files');
    }
    stop('private-files');

    // 3. the build's key: a read-only deploy key on the private repository, its private half sealed into
    // the site repository's secret. Made together, since the private half is never kept: if either is
    // missing, both are made again.
    const keys = repo && seeded ? (await gh.deployKeys(site.owner, privName)).filter((k) => k.title === KEY_TITLE) : [];
    const secret = repo ? await gh.hasSecret(site.owner, site.name, SECRET) : false;
    if (keys.length === 1 && keys[0].readOnly && secret) step('build-key', 'done', 'The site\'s build can read the private pages');
    else if (!o.apply || !repo) step('build-key', 'todo', 'Give the site\'s build a read-only key to the private pages');
    else {
      step('build-key', 'doing', 'Giving the site\'s build a read-only key');
      for (const k of keys) await gh.deleteDeployKey(site.owner, privName, k.id);
      const pair = ed25519KeyPair(`atiya-build@${site.owner}/${site.name}`);
      await gh.addDeployKey(site.owner, privName, KEY_TITLE, pair.publicKey);
      await gh.putSecret(site.owner, site.name, SECRET, pair.privateKey, sealSecret);
      step('build-key', 'done', 'The site\'s build can read the private pages');
    }
    stop('build-key');

    // 4. the submodule in the site, saved to GitHub
    const local = hasSubmodule(o.dir) && existsSync(join(o.dir, 'private-pages', '.git'));
    const remote = repo ? await gh.hasFile(site.owner, site.name, '.gitmodules') : false;
    const head = await git.head(o.dir);
    const pushed = head && head === (await gh.branchSha(site.owner, site.name, 'main'));
    if (local && remote && pushed) step('submodule', 'done', 'Your site has its private pages');
    else if (!o.apply || !repo) step('submodule', 'todo', 'Add the private pages to your site');
    else {
      step('submodule', 'doing', 'Adding the private pages to your site');
      // a local remote (the fake GitHub) needs file clones allowed for the submodule; GitHub's is https
      const allowFile = /^https?:/.test(repo.cloneUrl) ? [] : ['-c', 'protocol.file.allow=always'];
      if (!local) {
        if (existsSync(join(o.dir, 'private-pages'))) removeTree(join(o.dir, 'private-pages'));
        await git.run([...allowFile, 'submodule', 'add', '-b', 'main', repo.cloneUrl, 'private-pages'], { cwd: o.dir, network: true });
        await git.run(['commit', '-m', 'Set up private pages'], { cwd: o.dir });
      }
      await git.run(['push', 'origin', 'main'], { cwd: o.dir, network: true }).catch(() => {
        throw new SetupError("Your site changed on GitHub since this computer last had it, so the private pages couldn't be added there yet. Open the site again (it brings in the changes), then try again.", { code: EXIT.conflict, step: 'submodule' });
      });
      step('submodule', 'done', 'Your site has its private pages');
    }
    stop('submodule');
    return result({ ok: true, applied: o.apply, repository });
  } catch (e) {
    const err =
      e instanceof SetupError ? e
      : e instanceof GitHubError ? new SetupError(e.kind === 'auth' ? "GitHub isn't connected: sign in again." : e.kind === 'network' ? "Can't reach GitHub. Try again when you're back online." : `GitHub refused: ${e.message}`, { code: e.kind === 'auth' ? EXIT.needsPerson : EXIT.refused })
      : null;
    // anything else is this computer's: plain words for the person, the detail for an agent (--json)
    const message = err?.message ?? 'Something went wrong on this computer. Try again: it carries on where it stopped.';
    if (err?.step) step(err.step, 'failed', message);
    return result({ ok: false, applied: o.apply, code: err?.code ?? EXIT.other, message, ...(err ? {} : { detail: /** @type {Error} */ (e).message }), repository });
  }
}

/** Removes a folder, git's read-only object files too (Windows refuses to delete those as they are). @param {string} dir */
export function removeTree(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    const writable = (/** @type {string} */ d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) writable(p);
        else chmodSync(p, 0o666);
      }
    };
    writable(dir);
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}
