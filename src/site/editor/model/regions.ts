/**
 * Region fragments (documentation/engineering/performance-report.md R4): a screen fetched again to swap
 * some of its regions says which in a header, and the server draws only those (the rest of the page is
 * its shell, and each screen leaves out the work behind a region nobody asked for). A request without the
 * header is a whole screen. Pure: used by the client and by the screens.
 */

/** The request header that names the regions wanted, comma-separated. */
export const REGIONS_HEADER = 'X-Editor-Regions';

/** The regions a request asks for, or null for the whole screen. */
export function regionsAsked(header: string | null | undefined): Set<string> | null {
  if (header == null) return null;
  const names = header
    .split(',')
    .map((n) => n.trim())
    .filter((n) => /^[a-z0-9-]+$/.test(n));
  return names.length ? new Set(names) : null;
}

/** Whether any of `names` is drawn: always for a whole screen. */
export const wants = (asked: Set<string> | null, ...names: string[]): boolean => !asked || names.some((n) => asked.has(n));

/** The regions that always come along with a swap: the counts of changes to save to remote (the top bar's, the navigation's, the dashboard's). */
export const ALWAYS = ['editor-pending', 'editor-nav', 'pending-summary'] as const;

/** The header's value for a swap of `names` (the counts always come along). */
export const regionsHeader = (names: string[]): string => [...new Set([...names, ...ALWAYS])].join(',');
