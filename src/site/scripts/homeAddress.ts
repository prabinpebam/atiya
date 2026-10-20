/**
 * The home views' addresses (tier 0, pure; docs: documentation/home-views/bento.md §5, proof-grid.md §5): which
 * strength, and which of its kinds of proof, a link opens. The views' scripts read them; unit-tested.
 */

const decoded = (hash: string) => {
  try {
    return decodeURIComponent(hash);
  } catch {
    // a malformed escape: read it as written
    return hash;
  }
};

/** The strength an address names (`#cap-<id>`), or null. */
export function capabilityFromHash(hash: string): string | null {
  return /^#cap-(.+)$/.exec(decoded(hash))?.[1] ?? null;
}

export interface GridTarget {
  id: string;
  /** A kind's evidence, or the row's whole (`all`). */
  kind: string;
}

/**
 * What an address opens in the proof grid: `#cap-<id>-<kind>` a cell, `#cap-<id>` a row. IDs can hold hyphens,
 * so the longest ID that fits wins; null for anything else.
 */
export function gridTarget(hash: string, ids: readonly string[], kinds: readonly string[]): GridTarget | null {
  const rest = capabilityFromHash(hash);
  if (!rest) return null;
  for (const id of [...ids].sort((a, b) => b.length - a.length)) {
    if (rest === id) return { id, kind: 'all' };
    const kind = rest.startsWith(`${id}-`) ? rest.slice(id.length + 1) : '';
    if (kinds.includes(kind)) return { id, kind };
  }
  return null;
}
