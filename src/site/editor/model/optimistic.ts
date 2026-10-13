/**
 * Optimistic edits (documentation/editor/spec.md §3.6): a change shows in the outline, the inspector and
 * the canvas at once, from the document the editor holds, before the server has saved or drawn it. This
 * works out where each block went, and renames what carries a block's position. Pure and unit-tested.
 *
 * The document operations keep every block they don't change (the same object), so a moved block is found
 * wherever it went; a duplicate is a structured clone, so a block equal to the one before it is a copy of
 * it; anything else is new.
 */

/** Where a block of the new body came from: its index before (a copy of it when `copy`), or null for a new one. */
export type Origin = { from: number; copy: boolean } | null;

/** Where each block of `after` came from in `before`. */
export function originsOf(before: readonly unknown[], after: readonly unknown[]): Origin[] {
  const at = new Map<unknown, number>();
  before.forEach((b, i) => {
    if (!at.has(b)) at.set(b, i);
  });
  const used = new Set<number>();
  const json = new Map<number, string>();
  const textOf = (i: number) => {
    if (!json.has(i)) json.set(i, JSON.stringify(before[i]));
    return json.get(i)!;
  };
  return after.map((b, j) => {
    const i = at.get(b);
    if (i !== undefined && !used.has(i)) {
      used.add(i);
      return { from: i, copy: false };
    }
    if (i !== undefined) return { from: i, copy: true };
    // a copy: equal to a block before (the one just placed before it first: a duplicate goes after its original)
    const text = JSON.stringify(b);
    const prev = j > 0 ? after[j - 1] : undefined;
    const prevAt = prev !== undefined ? at.get(prev) : undefined;
    if (prevAt !== undefined && textOf(prevAt) === text) return { from: prevAt, copy: true };
    for (let k = 0; k < before.length; k++) if (textOf(k) === text) return { from: k, copy: true };
    return null;
  });
}

/** Whether a change only moved, removed, copied or added blocks (no block kept in place was edited): then it can show at once. */
export function isStructural(before: readonly unknown[], after: readonly unknown[], origins = originsOf(before, after)): boolean {
  // every block kept is the same object; one that changed (an edit) has no origin, and would be drawn as "new"
  const kept = origins.filter((o) => o && !o.copy).length;
  const added = origins.filter((o) => o === null).length;
  // an edit looks like a removal plus an addition at the same place: not structural
  if (added && kept + added === after.length && before.length - kept === added) {
    const removed = before.map((_, i) => i).filter((i) => !origins.some((o) => o && !o.copy && o.from === i));
    const fresh = origins.map((o, j) => (o === null ? j : -1)).filter((j) => j >= 0);
    if (removed.length === fresh.length && removed.every((i, n) => i === fresh[n])) return false;
  }
  return true;
}

/** Where each block before went (its index after), or -1 when it's gone. */
export function targetsOf(origins: readonly Origin[], before: number): number[] {
  const to = new Array<number>(before).fill(-1);
  origins.forEach((o, j) => {
    if (o && !o.copy) to[o.from] = j;
  });
  return to;
}

/** Attributes whose whole value is a block's position. */
export const INDEX_ATTRS = ['data-block-form', 'data-index', 'data-editor-subheading', 'data-editor-turn-open', 'data-editor-select', 'data-row', 'data-editor-drag'] as const;

/**
 * An attribute's value with a block's position renamed from `from` to `to`: a field path (`body.3.caption`
 * becomes `body.4.caption`), a field's id (`f-3-caption`, in a list of ids too), or, for an attribute that
 * is a position, the position itself. A nested position (an item's, `body.3.items.3`) is left as it is.
 */
export function renameIndex(name: string, value: string, from: number, to: number): string {
  if ((INDEX_ATTRS as readonly string[]).includes(name)) return value === String(from) ? String(to) : value;
  return value.replace(/(^|[^\w.])body\.(\d+)(?=\.|\b)/g, (m, lead: string, n: string) => (Number(n) === from ? `${lead}body.${to}` : m)).replace(/(^|\s)f-(\d+)-/g, (m, lead: string, n: string) => (Number(n) === from ? `${lead}f-${to}-` : m));
}

/** The attributes of an element (and everything in it) renamed for its block's move from `from` to `to`. */
export function renameTree(root: Element, from: number, to: number): void {
  if (from === to) return;
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      const next = renameIndex(attr.name, attr.value, from, to);
      if (next !== attr.value) el.setAttribute(attr.name, next);
    }
  }
}
