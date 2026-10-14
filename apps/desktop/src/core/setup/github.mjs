// @ts-check
/**
 * The GitHub calls setup makes (documentation/desktop/spec.md §4.4, §7.5), over fetch, against
 * api.github.com or the fake GitHub in the tests. The token is only ever an Authorization header.
 */

export class GitHubError extends Error {
  /** @param {string} message @param {{ status?: number, kind?: 'auth' | 'scope' | 'rate-limit' | 'not-found' | 'conflict' | 'network' | 'refused', reset?: number }} [o] */
  constructor(message, o = {}) {
    super(message);
    this.status = o.status;
    this.kind = o.kind ?? 'refused';
    this.reset = o.reset;
  }
}

/** The scopes setup needs from a classic token or an OAuth App's (spec §5.2). */
export const NEEDED_SCOPES = ['repo', 'workflow'];

/**
 * Which needed scopes a token lacks, from its `X-OAuth-Scopes` header; [] when the header is absent
 * (fine-grained and GitHub App tokens carry permissions, which the calls themselves test).
 * @param {string | null} header
 */
export function missingScopes(header) {
  if (header === null) return [];
  const have = new Set(header.split(',').map((s) => s.trim()).filter(Boolean));
  return NEEDED_SCOPES.filter((s) => !have.has(s) && !(s === 'repo' && have.has('public_repo')));
}

export class GitHub {
  /**
   * @param {{ token?: string | null, api?: string, web?: string, fetch?: typeof fetch, userAgent?: string }} o
   */
  constructor(o = {}) {
    this.token = o.token ?? null;
    this.api = (o.api ?? 'https://api.github.com').replace(/\/$/, '');
    this.web = (o.web ?? 'https://github.com').replace(/\/$/, '');
    this.fetch = o.fetch ?? fetch;
    this.userAgent = o.userAgent ?? 'Atiya-Studio';
  }

  /** Is this the real GitHub (so git gets the token for github.com)? */
  get isGitHubDotCom() {
    return this.api === 'https://api.github.com';
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<{ status: number, data: any, headers: Headers }>}
   */
  async request(method, path, body) {
    /** @type {Record<string, string>} */
    const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': this.userAgent };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res;
    try {
      res = await this.fetch(this.api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new GitHubError("Can't reach GitHub.", { kind: 'network' });
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (res.status === 401) throw new GitHubError('GitHub isn\'t connected any more.', { status: 401, kind: 'auth' });
    if ((res.status === 403 || res.status === 429) && (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.get('retry-after'))) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000 || Date.now() + Number(res.headers.get('retry-after') ?? 60) * 1000;
      throw new GitHubError('GitHub asked us to wait.', { status: res.status, kind: 'rate-limit', reset });
    }
    return { status: res.status, data, headers: res.headers };
  }

  /** @param {string} method @param {string} path @param {unknown} [body] */
  async ok(method, path, body) {
    const r = await this.request(method, path, body);
    if (r.status >= 200 && r.status < 300) return r;
    const message = typeof r.data?.message === 'string' ? r.data.message : `GitHub answered ${r.status}`;
    throw new GitHubError(message, { status: r.status, kind: r.status === 404 ? 'not-found' : r.status === 409 || r.status === 422 ? 'conflict' : 'refused' });
  }

  /** Who the token belongs to, and its scopes header. */
  async user() {
    const r = await this.ok('GET', '/user');
    return { login: String(r.data.login), id: Number(r.data.id), name: r.data.name ? String(r.data.name) : null, avatar: r.data.avatar_url ?? null, scopes: r.headers.get('x-oauth-scopes') };
  }

  /** Is the primary email confirmed? null when the token can't read emails. */
  async primaryEmailVerified() {
    const r = await this.request('GET', '/user/emails');
    if (r.status !== 200 || !Array.isArray(r.data)) return null;
    const primary = r.data.find((e) => e.primary) ?? r.data[0];
    return primary ? !!primary.verified : null;
  }

  /** @param {string} owner @param {string} name */
  async repo(owner, name) {
    const r = await this.request('GET', `/repos/${owner}/${name}`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new GitHubError(r.data?.message ?? `GitHub answered ${r.status}`, { status: r.status });
    return { name: String(r.data.name), owner: String(r.data.owner?.login), private: !!r.data.private, cloneUrl: String(r.data.clone_url), htmlUrl: String(r.data.html_url), id: Number(r.data.id) };
  }

  /** A public, empty repository in the token's account. @param {string} name @param {string} description */
  async createRepo(name, description) {
    const r = await this.ok('POST', '/user/repos', { name, description, private: false, auto_init: false, has_wiki: false, has_projects: false });
    return { name: String(r.data.name), owner: String(r.data.owner?.login), private: !!r.data.private, cloneUrl: String(r.data.clone_url), htmlUrl: String(r.data.html_url), id: Number(r.data.id) };
  }

  /** The commit a branch points at, or null (no such branch, or an empty repository). @param {string} owner @param {string} name @param {string} branch */
  async branchSha(owner, name, branch) {
    const r = await this.request('GET', `/repos/${owner}/${name}/branches/${branch}`);
    if (r.status === 404 || r.status === 409) return null;
    if (r.status !== 200) throw new GitHubError(r.data?.message ?? `GitHub answered ${r.status}`, { status: r.status });
    return String(r.data.commit.sha);
  }

  /** Does the default branch hold this file? @param {string} owner @param {string} name @param {string} path */
  async hasFile(owner, name, path) {
    const r = await this.request('GET', `/repos/${owner}/${name}/contents/${path}`);
    return r.status === 200;
  }

  /** Pages' settings, or null when it's off. @param {string} owner @param {string} name */
  async pages(owner, name) {
    const r = await this.request('GET', `/repos/${owner}/${name}/pages`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new GitHubError(r.data?.message ?? `GitHub answered ${r.status}`, { status: r.status });
    return { buildType: r.data.build_type ?? null, url: String(r.data.html_url) };
  }

  /** Turns Pages on, built by Actions (or switches a branch-built site to Actions). @param {string} owner @param {string} name */
  async enablePages(owner, name) {
    const existing = await this.pages(owner, name);
    if (existing) {
      await this.ok('PUT', `/repos/${owner}/${name}/pages`, { build_type: 'workflow' });
      return { buildType: 'workflow', url: existing.url };
    }
    const r = await this.ok('POST', `/repos/${owner}/${name}/pages`, { build_type: 'workflow' });
    return { buildType: r.data.build_type ?? 'workflow', url: String(r.data.html_url) };
  }

  /** The site workflow's runs for a commit. @param {string} owner @param {string} name @param {string} sha */
  async runs(owner, name, sha) {
    const r = await this.ok('GET', `/repos/${owner}/${name}/actions/runs?head_sha=${sha}&per_page=20`);
    return /** @type {any[]} */ (r.data.workflow_runs ?? []).map((w) => ({ id: Number(w.id), status: String(w.status), conclusion: w.conclusion ?? null, url: String(w.html_url), path: String(w.path ?? ''), created: Date.parse(w.created_at) || 0 }));
  }

  /** @param {string} owner @param {string} name @param {number} id */
  async failedStep(owner, name, id) {
    const r = await this.ok('GET', `/repos/${owner}/${name}/actions/runs/${id}/jobs`);
    for (const job of r.data.jobs ?? []) for (const step of job.steps ?? []) if (step.conclusion === 'failure') return String(step.name);
    return null;
  }

  /** @param {string} owner @param {string} name @param {string} workflow */
  async dispatch(owner, name, workflow) {
    await this.ok('POST', `/repos/${owner}/${name}/actions/workflows/${workflow}/dispatches`, { ref: 'main' });
  }

  /** The person's repositories that hold an atiya.json. */
  async atiyaSites() {
    const r = await this.ok('GET', '/user/repos?per_page=100&affiliation=owner&sort=updated');
    const sites = [];
    for (const repo of r.data ?? []) if (await this.hasFile(repo.owner.login, repo.name, 'atiya.json')) sites.push({ owner: String(repo.owner.login), name: String(repo.name), private: !!repo.private });
    return sites;
  }
}
