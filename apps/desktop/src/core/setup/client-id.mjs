// @ts-check
/**
 * The OAuth App's client ID for GitHub's device flow (documentation/desktop/plan.md, 5.1 and 9P.5): the
 * environment's (ATIYA_GITHUB_CLIENT_ID), else the one the app was built with (`atiya.githubClientId` in its
 * package.json, since an installed app has no environment of ours), else none: sign-in then borrows the GitHub
 * CLI's token. A client ID is public; it's checked for shape only. Pure.
 * @param {Record<string, string | undefined>} env @param {string | null} packageJson the app's package.json, as text
 * @returns {string | null}
 */
export function githubClientId(env, packageJson) {
  const shape = (/** @type {unknown} */ v) => (typeof v === 'string' && /^[A-Za-z0-9._-]{8,64}$/.test(v) ? v : null);
  if (env.ATIYA_GITHUB_CLIENT_ID) return shape(env.ATIYA_GITHUB_CLIENT_ID);
  try {
    return shape(JSON.parse(packageJson ?? '{}').atiya?.githubClientId);
  } catch {
    return null;
  }
}
