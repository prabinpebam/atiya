#!/usr/bin/env node
/**
 * A stand-in for the GitHub CLI the app carries (src/core/setup/gh-login.mjs), for the tests and for trying the
 * app on the fake GitHub: `auth login` asks the fake for a device code at ATIYA_FAKE_GH_WEB, writes the code and
 * the page as the CLI does (to stderr), waits for the fake to approve, and keeps the token in GH_CONFIG_DIR (the
 * stand-in's keychain); `auth refresh` does the same; `auth token` prints it; `auth logout` forgets it.
 *   node bin/fake-gh.mjs auth login|refresh|token|logout …
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cmd, sub] = process.argv.slice(2);
const dir = process.env.GH_CONFIG_DIR;
const web = (process.env.ATIYA_FAKE_GH_WEB ?? '').replace(/\/$/, '');
const tokenFile = dir ? join(dir, 'fake-token') : '';

if (cmd === 'auth' && sub === 'logout') {
  if (tokenFile && existsSync(tokenFile)) rmSync(tokenFile);
  process.stderr.write('✓ Logged out of github.com\n');
  process.exit(0);
}
if (cmd === 'auth' && sub === 'token') {
  if (!tokenFile || !existsSync(tokenFile)) {
    process.stderr.write('no oauth token found for github.com\n');
    process.exit(1);
  }
  process.stdout.write(readFileSync(tokenFile, 'utf8'));
  process.exit(0);
}
if (cmd !== 'auth' || (sub !== 'login' && sub !== 'refresh') || !web || !dir) {
  process.stderr.write('fake gh: only auth login, refresh, token and logout, with ATIYA_FAKE_GH_WEB and GH_CONFIG_DIR\n');
  process.exit(2);
}

// the connection closes after each answer, and the process ends on its own: process.exit() while fetch's sockets
// close trips a libuv assertion on Windows
const post = async (path, body) => (await fetch(`${web}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', connection: 'close' }, body: JSON.stringify(body) })).json();
async function login() {
  try {
    const c = await post('/login/device/code', { client_id: 'fake-gh-cli', scope: 'repo read:org gist workflow' });
    process.stderr.write(`\n! First copy your one-time code: ${c.user_code}\nOpen this URL to continue in your web browser: ${c.verification_uri}\n`);
    const end = Date.now() + c.expires_in * 1000;
    for (;;) {
      await new Promise((r) => setTimeout(r, Math.max(200, (c.interval ?? 1) * 1000)));
      const t = await post('/login/oauth/access_token', { client_id: 'fake-gh-cli', device_code: c.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
      if (t.access_token) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(tokenFile, t.access_token);
        process.stderr.write('✓ Authentication complete.\n✓ Logged in as fake\n');
        return 0;
      }
      if (t.error === 'access_denied') {
        process.stderr.write('error: access_denied: The user has denied your application access.\n');
        return 1;
      }
      if (t.error === 'expired_token' || Date.now() > end) {
        process.stderr.write('error: the device code has expired\n');
        return 1;
      }
    }
  } catch {
    process.stderr.write(`error: could not resolve host ${web}\n`);
    return 1;
  }
}
process.exitCode = await login();