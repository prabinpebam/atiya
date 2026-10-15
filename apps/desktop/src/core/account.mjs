// @ts-check
/**
 * Who's signed in and which site is open (documentation/desktop/spec.md §7.2, plan stage 7C): the GitHub repository a
 * checkout's remote names, a site's address on GitHub Pages, and the sites the app remembers, as the title bar's
 * account menu lists them. Pure.
 */

/**
 * The owner and repository a GitHub remote names, from either form (https or ssh); null for anything else.
 * @param {string | null | undefined} url @returns {{ owner: string, repo: string } | null}
 */
export function parseRemote(url) {
  const m = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

/**
 * A repository's GitHub Pages address: the account's own site for `<owner>.github.io`, else a project site under it.
 * @param {string} repository `owner/repo`
 */
export function siteAddress(repository) {
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) return null;
  const host = `${owner.toLowerCase()}.github.io`;
  return repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
}

/** An address as a person reads it: no scheme, no last slash. @param {string | null | undefined} url */
export const shortAddress = (url) => (url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '');

/**
 * @typedef {{ kind: 'developer' | 'managed', path: string, name?: string, repository?: string, url?: string }} Remembered
 * @typedef {{ path: string, name: string, kind: 'developer' | 'managed', repository: string | null, address: string, current: boolean }} SiteEntry
 */

/**
 * The sites the account menu lists: every remembered one, the open one first and marked, each with its address
 * (or, for a checkout with no GitHub remote, its folder's name).
 * @param {readonly Remembered[]} remembered @param {string | null | undefined} current
 * @returns {SiteEntry[]}
 */
export function sitesFor(remembered, current) {
  const same = (/** @type {string} */ a, /** @type {string | null | undefined} */ b) => !!b && a.toLowerCase() === b.toLowerCase();
  const entries = remembered.map((w) => {
    const folder = w.path.split(/[\\/]/).filter(Boolean).pop() ?? w.path;
    const url = w.url ?? (w.repository ? siteAddress(w.repository) : null);
    return {
      path: w.path,
      name: w.name || folder,
      kind: w.kind,
      repository: w.repository ?? null,
      address: url ? shortAddress(url) : w.kind === 'developer' ? `Source checkout: ${folder}` : folder,
      current: same(w.path, current),
    };
  });
  return [...entries.filter((e) => e.current), ...entries.filter((e) => !e.current)];
}
