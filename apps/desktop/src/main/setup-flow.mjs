// @ts-check
/**
 * The first run's state (documentation/desktop/spec.md §4): signing in, the email, the one prefilled
 * Your site screen, creating, and going live in the background. It drives the stage 2 setup machine and
 * tells the screens what to show through `change` events. Everything outside it (the clipboard, the
 * browser, the keychain, opening edit mode) is passed in, so it has no Electron in it.
 */
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { pollForToken, requestCode } from '../core/setup/device.mjs';
import { GitHub, GitHubError } from '../core/setup/github.mjs';
import { runSetup, siteUrl } from '../core/setup/machine.mjs';
import { findToken } from '../core/setup/tokens.mjs';

/**
 * @typedef {{ name: string, repo: string, url: string, dir: string, explore: 'little-planet' | 'site', samples: boolean, dirChanged?: boolean }} Proposal
 * @typedef {{
 *   phase: 'welcome' | 'connect' | 'code' | 'email' | 'site' | 'choose-site' | 'creating' | 'error',
 *   mode: 'new' | 'existing',
 *   code: null | { userCode: string, verificationUri: string, expiresAt: number },
 *   user: null | { login: string, name: string | null, avatar: string | null },
 *   proposal: null | Proposal,
 *   sites: { owner: string, name: string }[],
 *   steps: Record<string, { state: string, message: string }>,
 *   error: null | { message: string, retry: 'sign-in' | 'create' | 'none', url?: string },
 *   busy: boolean,
 *   notice: string | null,
 * }} FlowState
 * @typedef {{
 *   api: string, web: string, clientId: string | null, home: string, gitConfigFile: string,
 *   engine: { version: string, commit: string | null, sha256: string | null }, starter?: string,
 *   tokens: { load(): string | null, save(t: string): void, clear(): void },
 *   copy(text: string): void, openExternal(url: string): void,
 *   onReadyToEdit(site: { repository: string, url: string, dir: string, name: string }): void,
 *   onLive(state: { state: 'going' | 'live' | 'failed', message?: string, url?: string }): void,
 *   saveSetup(s: { mode: 'new' | 'existing', inputs: Proposal } | null): void,
 *   pollMs?: number, emailPollMs?: number, firstRunWaitMs?: number,
 * }} FlowDeps
 */

export class SetupFlow extends EventEmitter {
  /** @param {FlowDeps} deps */
  constructor(deps) {
    super();
    this.d = deps;
    /** @type {FlowState} */
    this.s = { phase: 'welcome', mode: 'new', code: null, user: null, proposal: null, sites: [], steps: {}, error: null, busy: false, notice: null };
    /** @type {GitHub | null} */
    this.gh = null;
    this.abort = new AbortController();
  }

  /** @returns {FlowState} */
  state() {
    return structuredClone(this.s);
  }

  /** @param {Partial<FlowState>} patch */
  set(patch) {
    this.s = { ...this.s, ...patch };
    this.emit('change', this.state());
  }

  /** Make my site, or Open my existing site. @param {'new' | 'existing'} mode */
  async start(mode) {
    this.set({ mode, phase: 'connect', error: null, notice: null });
    const token = this.d.tokens.load();
    if (token && (await this.useToken(token))) return;
  }

  /** Continue with GitHub: the device flow, with the code copied and GitHub's page opened (F1, F2). */
  async signIn() {
    this.set({ busy: true, error: null });
    try {
      if (!this.d.clientId) {
        // until the app's OAuth App is registered (stage 5), sign in as the GitHub CLI or GH_TOKEN does
        const found = await findToken('auto');
        if (found && (await this.useToken(found.token))) return;
        this.set({ busy: false, phase: 'connect', error: { message: "Signing in with GitHub isn't set up in this copy of the app yet. Sign in with the GitHub CLI (gh auth login), then choose Continue with GitHub again.", retry: 'sign-in' } });
        return;
      }
      const code = await requestCode({ web: this.d.web, clientId: this.d.clientId });
      this.d.copy(code.userCode);
      this.d.openExternal(code.verificationUri);
      this.set({ busy: false, phase: 'code', code: { userCode: code.userCode, verificationUri: code.verificationUri, expiresAt: Date.now() + code.expiresIn * 1000 } });
      const r = await pollForToken({ web: this.d.web, clientId: this.d.clientId, deviceCode: code.deviceCode, interval: code.interval, expiresIn: code.expiresIn, signal: this.abort.signal });
      if (r.ok) {
        await this.useToken(r.token);
        return;
      }
      const message = r.reason === 'denied' ? "GitHub wasn't connected. Atiya Studio needs it to keep and publish your site." : r.reason === 'expired' ? 'That code has run out.' : '';
      if (message) this.set({ phase: 'connect', code: null, error: { message, retry: 'sign-in' } });
    } catch (e) {
      this.set({ busy: false, phase: 'connect', error: { message: e instanceof GitHubError && e.kind === 'network' ? "Can't reach GitHub. Check your connection, then try again." : /** @type {Error} */ (e).message, retry: 'sign-in' } });
    }
  }

  /** Opens GitHub's device page again. */
  openGitHubAgain() {
    if (this.s.code) this.d.openExternal(this.s.code.verificationUri);
  }

  /** Copies the code again. */
  copyCode() {
    if (this.s.code) this.d.copy(this.s.code.userCode);
  }

  /** @param {string} token @returns {Promise<boolean>} */
  async useToken(token) {
    const gh = new GitHub({ token, api: this.d.api, web: this.d.web });
    let user;
    try {
      user = await gh.user();
    } catch {
      this.d.tokens.clear();
      this.set({ busy: false, phase: 'connect' });
      return false;
    }
    this.d.tokens.save(token);
    this.gh = gh;
    this.set({ busy: false, code: null, user: { login: user.login, name: user.name, avatar: user.avatar } });
    // a new account must confirm its email before GitHub lets it keep a site (F3)
    let verified = await gh.primaryEmailVerified();
    if (verified === false) {
      this.set({ phase: 'email' });
      while (verified === false && !this.abort.signal.aborted) {
        await new Promise((r) => setTimeout(r, this.d.emailPollMs ?? 5000));
        verified = await gh.primaryEmailVerified();
      }
    }
    if (this.s.mode === 'existing') {
      this.set({ busy: true });
      const sites = await gh.atiyaSites();
      this.set({ busy: false, phase: 'choose-site', sites: sites.map((s) => ({ owner: s.owner, name: s.name })) });
      return true;
    }
    await this.propose(user);
    return true;
  }

  /** Checks the email again now (Check now). */
  async checkEmail() {
    const v = await this.gh?.primaryEmailVerified();
    if (v !== false) this.set({ notice: null });
  }

  /** Your site, prefilled (F4, F5): the planned address comes from the machine's own checks. @param {{ login: string, name: string | null }} user */
  async propose(user) {
    this.set({ busy: true });
    /** @type {{ repository: string, url: string, dir: string } | null} */
    let planned = null;
    await runSetup({
      github: /** @type {GitHub} */ (this.gh),
      inputs: { home: this.d.home },
      apply: false,
      engine: this.d.engine,
      gitConfigFile: this.d.gitConfigFile,
      emit: (e) => {
        if (e.type === 'plan') planned = e.site;
      },
    });
    const site = /** @type {{ repository: string, url: string, dir: string } | null} */ (planned);
    const repo = site ? site.repository.split('/')[1] : `${user.login.toLowerCase()}.github.io`;
    this.set({
      busy: false,
      phase: 'site',
      proposal: { name: user.name || user.login, repo, url: site?.url ?? siteUrl(user.login, repo), dir: site?.dir ?? join(this.d.home, 'Atiya', repo), explore: 'little-planet', samples: true },
    });
  }

  /** A change on Your site (the address's name moves the address and the folder with it). @param {Partial<Proposal>} patch */
  edit(patch) {
    if (!this.s.proposal || !this.s.user) return;
    const p = { ...this.s.proposal, ...patch };
    if (patch.repo !== undefined) {
      p.repo = patch.repo.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
      p.url = siteUrl(this.s.user.login, p.repo);
      if (!p.dirChanged) p.dir = join(this.d.home, 'Atiya', p.repo);
    }
    if (patch.dir !== undefined) p.dirChanged = true;
    this.set({ proposal: p });
  }

  /** Open my existing site: the chosen one is cloned and opened. @param {string} name */
  async chooseSite(name) {
    if (!this.s.user) return;
    await this.create({ name: this.s.user.name || this.s.user.login, repo: name, url: siteUrl(this.s.user.login, name), dir: join(this.d.home, 'Atiya', name), explore: 'little-planet', samples: true });
  }

  /** Create my site: runs the machine, opening edit mode after the first save (F9). @param {Proposal} [inputs] */
  async create(inputs = /** @type {Proposal} */ (this.s.proposal)) {
    if (!inputs) return;
    if (!this.gh) {
      const token = this.d.tokens.load();
      if (!token || !(await this.useTokenQuietly(token))) {
        this.set({ phase: 'connect', error: { message: "GitHub isn't connected any more.", retry: 'sign-in' } });
        return;
      }
    }
    this.d.saveSetup({ mode: this.s.mode, inputs });
    this.set({ phase: 'creating', proposal: inputs, steps: {}, error: null });
    let editing = false;
    const result = await runSetup({
      github: /** @type {GitHub} */ (this.gh),
      inputs: { name: inputs.name, repo: inputs.repo, explore: inputs.explore, samples: inputs.samples, dir: inputs.dir, home: this.d.home },
      apply: true,
      waitForEmail: true,
      engine: this.d.engine,
      gitConfigFile: this.d.gitConfigFile,
      starter: this.d.starter,
      pollMs: this.d.pollMs,
      emailPollMs: this.d.emailPollMs,
      firstRunWaitMs: this.d.firstRunWaitMs,
      emit: (e) => {
        if (e.type === 'step') this.set({ steps: { ...this.s.steps, [e.step]: { state: e.state, message: e.message } } });
        if (e.type === 'milestone') {
          editing = true;
          this.d.saveSetup(null);
          this.d.onReadyToEdit({ ...e.site, name: inputs.name });
          this.d.onLive({ state: 'going' });
        }
      },
    });
    if (result.ok) {
      this.d.onLive(result.live ? { state: 'live', url: result.site?.url } : { state: 'going' });
      return;
    }
    if (editing) this.d.onLive({ state: 'failed', message: result.message });
    else this.set({ phase: 'error', error: { message: result.message ?? 'Setup stopped.', retry: result.code === 10 ? 'sign-in' : 'create' } });
  }

  /** @param {string} token */
  async useTokenQuietly(token) {
    const gh = new GitHub({ token, api: this.d.api, web: this.d.web });
    try {
      const user = await gh.user();
      this.gh = gh;
      this.s.user = { login: user.login, name: user.name, avatar: user.avatar };
      return true;
    } catch {
      return false;
    }
  }

  /** Back to the welcome. */
  reset() {
    this.abort.abort();
    this.abort = new AbortController();
    this.set({ phase: 'welcome', code: null, error: null, busy: false });
  }

  stop() {
    this.abort.abort();
  }
}
