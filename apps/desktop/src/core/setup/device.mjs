// @ts-check
/**
 * Signing in with GitHub's device flow (documentation/desktop/spec.md F1, F2, §5.2): ask for a code, show
 * it, poll at the interval GitHub gives, add 5 seconds when told to slow down, stop at expiry or a refusal.
 */
import { GitHubError } from './github.mjs';

/** The scopes the app asks for. */
export const SCOPES = 'repo workflow user:email';

/**
 * @param {{ web: string, clientId: string, fetch?: typeof fetch }} o
 * @returns {Promise<{ deviceCode: string, userCode: string, verificationUri: string, interval: number, expiresIn: number }>}
 */
export async function requestCode(o) {
  const res = await (o.fetch ?? fetch)(`${o.web.replace(/\/$/, '')}/login/device/code`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: o.clientId, scope: SCOPES }),
  }).catch(() => null);
  if (!res) throw new GitHubError("Can't reach GitHub.", { kind: 'network' });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.device_code) throw new GitHubError(d.error_description ?? "GitHub didn't give a sign-in code.", { status: res.status });
  return { deviceCode: d.device_code, userCode: d.user_code, verificationUri: d.verification_uri, interval: Number(d.interval) || 5, expiresIn: Number(d.expires_in) || 900 };
}

/**
 * Polls until the person authorizes (the token), refuses, or the code expires.
 * @param {{ web: string, clientId: string, deviceCode: string, interval: number, expiresIn: number,
 *   fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>, now?: () => number, signal?: AbortSignal }} o
 * @returns {Promise<{ ok: true, token: string, scopes: string } | { ok: false, reason: 'denied' | 'expired' | 'aborted' }>}
 */
export async function pollForToken(o) {
  const sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const f = o.fetch ?? fetch;
  const deadline = now() + o.expiresIn * 1000;
  let interval = o.interval * 1000;
  for (;;) {
    await sleep(interval);
    if (o.signal?.aborted) return { ok: false, reason: 'aborted' };
    if (now() >= deadline) return { ok: false, reason: 'expired' };
    const res = await f(`${o.web.replace(/\/$/, '')}/login/oauth/access_token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: o.clientId, device_code: o.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    }).catch(() => null);
    if (!res) continue;
    const d = await res.json().catch(() => ({}));
    if (d.access_token) return { ok: true, token: String(d.access_token), scopes: String(d.scope ?? '') };
    if (d.error === 'authorization_pending') continue;
    if (d.error === 'slow_down') {
      interval += 5000;
      continue;
    }
    if (d.error === 'expired_token') return { ok: false, reason: 'expired' };
    if (d.error === 'access_denied') return { ok: false, reason: 'denied' };
  }
}
