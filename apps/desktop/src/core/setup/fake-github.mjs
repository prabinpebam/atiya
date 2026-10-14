// @ts-check
/**
 * A fake GitHub for setup's tests and for trying the app without touching GitHub (documentation/desktop/
 * plan.md, stage 2): the REST calls setup makes, the device flow, real bare git repositories as remotes,
 * builds that pass after `buildMs`, and a published site at /sites/<owner>/<repo>/. It records every call.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { secretKeyPair } from './seal.mjs';

/**
 * @typedef {{ login: string, id: number, name: string | null, emailVerified: boolean, scopes: string }} FakeUser
 * @typedef {{ id: number, sha: string, created: number, event: string }} FakeRun
 * @typedef {{ id: number, owner: string, name: string, private: boolean, bare: string, pages: null | { buildType: string }, runs: FakeRun[], site: null | { name: string },
 *   keys: { id: number, title: string, key: string, read_only: boolean }[], secrets: Map<string, string> }} FakeRepo
 * @typedef {{ root: string, port?: number, users?: Record<string, FakeUser>, buildMs?: number, buildFails?: boolean,
 *   pagesNeedsCommit?: boolean, actionsDisabled?: boolean, deviceInterval?: number, deviceApproveAfterMs?: number | null, deviceToken?: string }} FakeOptions
 */

export const ADA = { login: 'ada', id: 1001, name: 'Ada Lovelace', emailVerified: true, scopes: 'repo, workflow, user:email' };

// bare repositories are named explicitly: a safe.bareRepository=explicit setting refuses them found by folder
const git = (/** @type {string[]} */ args, /** @type {string} */ bare) => execFileSync('git', [`--git-dir=${bare}`, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();

/** @param {FakeOptions} o */
export async function startFakeGitHub(o) {
  const users = o.users ?? { 'fake-ada': { ...ADA } };
  /** @type {Map<string, FakeRepo>} */
  const repos = new Map();
  /** @type {{ method: string, path: string }[]} */
  const calls = [];
  /** @type {Map<string, { userCode: string, token: string, approved: boolean | null, created: number }>} */
  const devices = new Map();
  let ids = 5000;
  let base = '';
  const buildMs = o.buildMs ?? 1500;
  const settings = { buildFails: !!o.buildFails, pagesNeedsCommit: !!o.pagesNeedsCommit, actionsDisabled: !!o.actionsDisabled, slowCreateMs: 0 };
  // the secrets' key pair: the fake opens what's sealed for it, so a test can read what was set
  const secretKeys = await secretKeyPair();

  /** @param {FakeRepo} r */
  const mainSha = (r) => {
    try {
      return git(['rev-parse', '--verify', '-q', 'refs/heads/main'], r.bare) || null;
    } catch {
      return null;
    }
  };
  /** @param {FakeRepo} r @param {string} sha @param {string} path */
  const fileAt = (r, sha, path) => {
    try {
      return git(['show', `${sha}:${path}`], r.bare);
    } catch {
      return null;
    }
  };
  /** A push to main with the site's workflow starts a run, as GitHub would. @param {FakeRepo} r */
  const observePushes = (r) => {
    const sha = mainSha(r);
    if (!sha || settings.actionsDisabled || r.runs.some((x) => x.sha === sha && x.event === 'push')) return;
    if (fileAt(r, sha, '.github/workflows/site.yml') === null) return;
    r.runs.push({ id: ++ids, sha, created: Date.now(), event: 'push' });
  };
  /** @param {FakeRepo} r @param {FakeRun} run */
  const runView = (r, run) => {
    const age = Date.now() - run.created;
    const done = age >= buildMs;
    const success = done && !settings.buildFails && !!r.pages;
    if (success && !r.site) {
      const siteJson = fileAt(r, run.sha, 'content/site.json');
      r.site = { name: siteJson ? JSON.parse(siteJson).name : r.name };
    }
    return {
      id: run.id, head_sha: run.sha, event: run.event, path: '.github/workflows/site.yml', created_at: new Date(run.created).toISOString(),
      status: done ? 'completed' : age < buildMs / 3 ? 'queued' : 'in_progress', conclusion: done ? (success ? 'success' : 'failure') : null,
      html_url: `${base}/${r.owner}/${r.name}/actions/runs/${run.id}`,
    };
  };
  /** @param {FakeRepo} r */
  const repoView = (r) => ({ id: r.id, name: r.name, full_name: `${r.owner}/${r.name}`, owner: { login: r.owner }, private: r.private, clone_url: r.bare.replace(/\\/g, '/'), html_url: `${base}/${r.owner}/${r.name}`, default_branch: 'main' });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    if (!path.startsWith('/__fake/')) calls.push({ method, path: path + url.search });
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    /** @param {number} status @param {unknown} data @param {Record<string, string>} [headers] */
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(data === undefined ? '' : JSON.stringify(data));
    };
    const auth = /^(?:Bearer|token) (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const user = auth ? users[auth] : undefined;
    /** @type {RegExpExecArray | null} */
    let m;

    // the fake's own controls, for tests and the app's --fake-github mode
    if (path === '/__fake/calls') return send(200, calls);
    if (path === '/__fake/approve' && method === 'POST') {
      for (const d of devices.values()) if (d.approved === null) d.approved = true;
      return send(200, { ok: true });
    }
    if (path === '/__fake/deny' && method === 'POST') {
      for (const d of devices.values()) if (d.approved === null) d.approved = false;
      return send(200, { ok: true });
    }
    if (path === '/__fake/settings' && method === 'POST') {
      Object.assign(settings, body);
      return send(200, settings);
    }
    if (path === '/__fake/user' && method === 'POST') {
      const u = users[body.token];
      if (u) Object.assign(u, body.patch);
      return send(200, u ?? null);
    }

    // a published site
    if ((m = /^\/sites\/([^/]+)\/([^/]+)\/$/.exec(path))) {
      const r = repos.get(`${m[1]}/${m[2]}`.toLowerCase());
      if (!r?.site) {
        res.writeHead(404, { 'content-type': 'text/html' });
        return res.end('<!doctype html><title>Site not found</title>');
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><html lang="en"><head><title>${r.site.name}</title></head><body><h1>${r.site.name}</h1></body></html>`);
    }

    // the device flow (github.com's web endpoints)
    if (path === '/login/device/code' && method === 'POST') {
      const code = `dc-${++ids}`;
      const token = o.deviceToken ?? Object.keys(users)[0];
      devices.set(code, { userCode: 'WDJB-MJHT', token, approved: null, created: Date.now() });
      return send(200, { device_code: code, user_code: 'WDJB-MJHT', verification_uri: `${base}/login/device`, expires_in: 900, interval: o.deviceInterval ?? 1 });
    }
    if (path === '/login/oauth/access_token' && method === 'POST') {
      const d = devices.get(body.device_code);
      if (!d) return send(200, { error: 'expired_token' });
      if (d.approved === null && o.deviceApproveAfterMs != null && Date.now() - d.created >= o.deviceApproveAfterMs) d.approved = true;
      if (d.approved === null) return send(200, { error: 'authorization_pending' });
      if (d.approved === false) return send(200, { error: 'access_denied' });
      return send(200, { access_token: d.token, token_type: 'bearer', scope: users[d.token]?.scopes.replace(/\s/g, '') ?? '' });
    }
    if (path === '/login/device') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<!doctype html><title>Device activation (fake)</title><h1>Enter the code</h1>');
    }

    if (!user) return send(401, { message: 'Bad credentials' });
    const login = user.login;

    if (path === '/user' && method === 'GET') return send(200, { login, id: user.id, name: user.name, avatar_url: null }, { 'x-oauth-scopes': user.scopes });
    if (path === '/user/emails' && method === 'GET') return send(200, [{ email: `${login}@example.com`, primary: true, verified: user.emailVerified }]);
    if (path === '/user/repos' && method === 'GET') return send(200, [...repos.values()].filter((r) => r.owner === login).map(repoView));
    if (path === '/user/repos' && method === 'POST') {
      if (settings.slowCreateMs) await new Promise((r) => setTimeout(r, settings.slowCreateMs));
      if (!user.emailVerified) return send(403, { message: 'You need to verify your email address first.' });
      const key = `${login}/${body.name}`.toLowerCase();
      if (repos.has(key)) return send(422, { message: 'Repository creation failed: name already exists on this account' });
      const bare = join(o.root, login, `${body.name}.git`);
      mkdirSync(bare, { recursive: true });
      execFileSync('git', ['init', '--bare', '--initial-branch=main', bare], { stdio: 'ignore', windowsHide: true });
      const r = { id: ++ids, owner: login, name: body.name, private: !!body.private, bare, pages: null, runs: [], site: null, keys: [], secrets: new Map() };
      repos.set(key, r);
      return send(201, repoView(r));
    }

    if ((m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(path))) {
      const r = repos.get(`${m[1]}/${m[2]}`.toLowerCase());
      const rest = m[3] ?? '';
      if (!r) return send(404, { message: 'Not Found' });
      if (rest === '' && method === 'GET') return send(200, repoView(r));
      if ((m = /^\/branches\/([^/]+)$/.exec(rest))) {
        const sha = m[1] === 'main' ? mainSha(r) : null;
        return sha ? send(200, { name: 'main', commit: { sha } }) : send(404, { message: 'Branch not found' });
      }
      if ((m = /^\/contents\/(.+)$/.exec(rest))) {
        const sha = mainSha(r);
        return sha && fileAt(r, sha, m[1]) !== null ? send(200, { path: m[1], type: 'file' }) : send(404, { message: 'Not Found' });
      }
      if (rest === '/pages') {
        const view = () => ({ build_type: r.pages?.buildType, html_url: `${base}/sites/${r.owner}/${r.name}/` });
        if (method === 'GET') return r.pages ? send(200, view()) : send(404, { message: 'Not Found' });
        if (method === 'POST' || method === 'PUT') {
          if (settings.pagesNeedsCommit && !mainSha(r)) return send(422, { message: 'The repository is empty.' });
          r.pages = { buildType: body.build_type ?? 'workflow' };
          return send(method === 'POST' ? 201 : 204, method === 'POST' ? view() : undefined);
        }
      }
      if (rest === '/keys' && method === 'GET') return send(200, r.keys);
      if (rest === '/keys' && method === 'POST') {
        if (!/^ssh-ed25519 [A-Za-z0-9+/=]+/.test(String(body.key))) return send(422, { message: 'key is invalid' });
        const k = { id: ++ids, title: String(body.title ?? ''), key: String(body.key).split(' ').slice(0, 2).join(' '), read_only: !!body.read_only };
        r.keys.push(k);
        return send(201, k);
      }
      if ((m = /^\/keys\/(\d+)$/.exec(rest)) && method === 'DELETE') {
        const before = r.keys.length;
        r.keys = r.keys.filter((k) => k.id !== Number(m?.[1]));
        return r.keys.length < before ? send(204, undefined) : send(404, { message: 'Not Found' });
      }
      if (rest === '/actions/secrets/public-key' && method === 'GET') return send(200, { key_id: 'fake-key-1', key: secretKeys.publicKey });
      if ((m = /^\/actions\/secrets\/([A-Z0-9_]+)$/.exec(rest))) {
        const secret = m[1];
        if (method === 'GET') return r.secrets.has(secret) ? send(200, { name: secret, created_at: new Date().toISOString() }) : send(404, { message: 'Not Found' });
        if (method === 'PUT') {
          if (body.key_id !== 'fake-key-1') return send(422, { message: 'key_id is wrong' });
          let value;
          try {
            value = secretKeys.open(String(body.encrypted_value));
          } catch {
            return send(422, { message: 'the secret could not be opened' });
          }
          const created = !r.secrets.has(secret);
          r.secrets.set(secret, value);
          return send(created ? 201 : 204, undefined);
        }
      }
      if (rest === '/actions/runs' && method === 'GET') {
        observePushes(r);
        const sha = url.searchParams.get('head_sha');
        const runs = r.runs.filter((x) => !sha || x.sha === sha).map((x) => runView(r, x));
        return send(200, { total_count: runs.length, workflow_runs: runs.reverse() });
      }
      if ((m = /^\/actions\/runs\/(\d+)\/jobs$/.exec(rest))) {
        const run = r.runs.find((x) => x.id === Number(m?.[1]));
        if (!run) return send(404, { message: 'Not Found' });
        const v = runView(r, run);
        const failed = v.conclusion === 'failure';
        return send(200, { jobs: [{ name: 'site / build', steps: [{ name: 'Check out the site', conclusion: 'success' }, { name: 'Build the site', conclusion: failed ? 'failure' : v.conclusion ?? null }] }] });
      }
      if (/^\/actions\/workflows\/[^/]+\/dispatches$/.test(rest) && method === 'POST') {
        if (settings.actionsDisabled) return send(403, { message: 'Actions is disabled for this repository.' });
        const sha = mainSha(r);
        if (!sha) return send(422, { message: 'No ref found for: main' });
        r.runs.push({ id: ++ids, sha, created: Date.now(), event: 'workflow_dispatch' });
        return send(204, undefined);
      }
    }
    return send(404, { message: 'Not Found' });
  });

  await new Promise((r) => server.listen(o.port ?? 0, 'localhost', () => r(null)));
  const address = server.address();
  base = `http://localhost:${typeof address === 'object' && address ? address.port : o.port}`;
  if (!existsSync(o.root)) mkdirSync(o.root, { recursive: true });
  return {
    url: base,
    calls,
    repos,
    users,
    settings,
    /** Write calls (anything but GET) to the API. */
    writes: () => calls.filter((c) => c.method !== 'GET' && !c.path.startsWith('/login/')),
    close: () => new Promise((r) => server.close(() => r(null))),
  };
}
