/** The production host shared by this site and the owner's other GitHub Pages projects. */
export const SITE_PARENT_DOMAIN = 'prabinpebam.github.io';

/** The accessible note appended to links that open a separate tab. */
export const NEW_TAB_NOTE = ' (opens in a new tab)';

const normalHost = (host: string) => host.trim().toLowerCase().replace(/\.$/, '');
const within = (host: string, parent: string) => host === parent || host.endsWith(`.${parent}`);

/**
 * Whether following an address leaves both the current host and the site's parent domain.
 * Relative, fragment, mail, telephone and download links keep their browser-native behaviour.
 */
export function leavesParentDomain(href: string, currentHostname = SITE_PARENT_DOMAIN): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  const host = normalHost(new URL(href).hostname);
  const current = normalHost(currentHostname);
  const parent = normalHost(SITE_PARENT_DOMAIN);
  return !within(host, current) && !within(host, parent);
}

/** The navigation attributes for a link under the site's tab policy. */
export function linkAttrs(href: string | undefined, currentHostname = SITE_PARENT_DOMAIN, forceNewTab = false) {
  const newTab = !!href && (forceNewTab || leavesParentDomain(href, currentHostname));
  return {
    newTab,
    target: newTab ? ('_blank' as const) : undefined,
    rel: newTab ? 'noopener noreferrer' : undefined,
  };
}
