/**
 * The home views' addresses (tier 0, pure; docs: documentation/home-views/bento.md §5, proof-grid.md §5,
 * spotlight.md §5): which strength, which of its kinds of proof or which highlight a link opens. The views'
 * scripts read them; unit-tested.
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

/** The highlight an address names (`#h-<id>`) when the show has it, or null. */
export function highlightFromHash(hash: string, ids: readonly string[]): string | null {
  const id = /^#h-(.+)$/.exec(decoded(hash))?.[1];
  return id && ids.includes(id) ? id : null;
}

/**
 * Where a press on a strength in Spotlight's Jump to goes: its first highlight, or, when one of its own is on the
 * stage, the one after it, round to the first (spotlight.md §5). Null when it has none.
 */
export function jumpTarget(own: readonly string[], current: string | null): string | null {
  if (own.length === 0) return null;
  const i = current ? own.indexOf(current) : -1;
  return own[(i + 1) % own.length];
}
