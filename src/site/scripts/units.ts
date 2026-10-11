/**
 * Reading a token's value in a script (tier 0; docs: documentation/site-ui/design-system.md §2). Pure and
 * unit-tested; the components' scripts read the computed custom property and pass it here.
 */

/**
 * A custom property's value as a number: a length in px (rem times the root's font size), a duration in
 * ms (the build's minifier may write 3600ms as 3.6s), anything else as it reads (NaN if it isn't a number).
 */
export function cssNumber(value: string, remPx = 16): number {
  const v = value.trim();
  const n = parseFloat(v);
  if (v.endsWith('rem')) return n * remPx;
  if (v.endsWith('ms')) return n;
  if (v.endsWith('s')) return n * 1000;
  return n;
}
