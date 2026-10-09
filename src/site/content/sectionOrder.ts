/**
 * Merges hidden items into the public list by their nearest preceding public item. Items sharing an
 * anchor keep their own order; `after: null` is the group before the first public item.
 */
export function mergeAfterAnchors<T>(
  publicItems: readonly T[],
  hiddenItems: readonly { after: string | null; value: T }[],
  idOf: (item: T) => string,
): T[] {
  const merged = [...publicItems];
  const tails = new Map<string, string>();
  for (const hidden of hiddenItems) {
    const group = hidden.after ?? '';
    const anchor = tails.get(group) ?? hidden.after;
    const anchorIndex = anchor === null ? -1 : merged.findIndex((item) => idOf(item) === anchor);
    const at = anchor === null ? 0 : anchorIndex >= 0 ? anchorIndex + 1 : merged.length;
    merged.splice(at, 0, hidden.value);
    tails.set(group, idOf(hidden.value));
  }
  return merged;
}
