// @ts-check
/**
 * Where an agent's token comes from (documentation/desktop/spec.md §5.2): GH_TOKEN or GITHUB_TOKEN, then
 * the GitHub CLI's (`gh auth token`). The device flow is the third source, run by the caller.
 */
import { execFile } from 'node:child_process';

/**
 * @param {'env' | 'gh' | 'auto'} source
 * @param {{ env?: NodeJS.ProcessEnv, gh?: () => Promise<string | null> }} [o]
 * @returns {Promise<{ token: string, source: 'env' | 'gh' } | null>}
 */
export async function findToken(source, o = {}) {
  const env = o.env ?? process.env;
  if (source === 'env' || source === 'auto') {
    const t = env.GH_TOKEN || env.GITHUB_TOKEN;
    if (t) return { token: t.trim(), source: 'env' };
    if (source === 'env') return null;
  }
  const t = await (o.gh ?? ghToken)();
  return t ? { token: t, source: 'gh' } : null;
}

/** The GitHub CLI's token, or null if it isn't installed or signed in. @returns {Promise<string | null>} */
export function ghToken() {
  return new Promise((resolvePromise) =>
    execFile('gh', ['auth', 'token'], { windowsHide: true, timeout: 10_000 }, (err, out) => resolvePromise(err ? null : String(out).trim() || null)),
  );
}

/** Hides anything that looks like a token in text bound for a log or the screen. @param {string} text @param {string[]} [secrets] */
export function redact(text, secrets = []) {
  let out = String(text);
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join('[token]');
  return out.replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[token]');
}
