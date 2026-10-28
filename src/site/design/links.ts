import { svgOf } from './icons';

/** Defined by integrations/editor.mjs: the host the site is published under (its own, never the code's owner's). */
declare const __SITE_PARENT_DOMAIN__: string | undefined;

/** The production host the site shares with its owner's other GitHub Pages projects ('' when unknown). */
export const SITE_PARENT_DOMAIN: string = typeof __SITE_PARENT_DOMAIN__ === 'string' ? __SITE_PARENT_DOMAIN__ : '';

/** The accessible note appended to links that open a separate tab. */
export const NEW_TAB_NOTE = ' (opens in a new tab)';

/**
 * The sign after a link that opens a new tab: a small arrow for the eye (base.css `[data-new-tab]`)
 * and the note for a screen reader. Every link that opens a new tab ends with it, so the two never part.
 * Its span doesn't wrap and carries word joiners (base.css), which hold the arrow to the last word and to
 * any punctuation after the link (a line may otherwise break on either side of an inline SVG); the span
 * is aria-hidden and the joiners are generated content, so the link's text stays its words and the note.
 */
export function newTabSign(): string {
  const arrow = svgOf('new-tab');
  return `<span aria-hidden="true" data-new-tab><svg viewBox="${arrow.viewBox}" focusable="false" data-icon="${arrow.name}">${arrow.body}</svg></span><span class="sr-only">${NEW_TAB_NOTE}</span>`;
}

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
  return !within(host, current) && !(parent && within(host, parent));
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
