/**
 * The review (documentation/editor/ai-editing.md §8): a proposal's changes found by block key against the article
 * it was made from, in the article's order with unchanged blocks folded; whether you've changed a block since
 * (§8.3); and applying only the accepted changes to the article as it is now. Pure: the Review tab and the tests
 * use it, and the server keeps the proposal (server/aiProposals.ts).
 */
import type { Block } from '../../content/schema';
import { plainText } from '../../content/markdown';
import { excerptOf, kindOf } from './ops';
import { wordDiff, wordsField, type DiffPart } from './aiText';

export type ChangeKind = 'changed' | 'retyped' | 'added' | 'removed' | 'moved';

/** One change, named by its block's key. */
export interface ReviewChange {
  key: string;
  kind: ChangeKind;
  /** The block in the article the proposal was made from (null: added). */
  before: Block | null;
  /** The block as proposed (null: removed). */
  after: Block | null;
  /** Added or moved, and changed too when it moved: the key it goes after in the proposal (null: first). */
  afterKey: string | null;
  /** A moved block whose content changed as well. */
  edited?: true;
}

/** A row of the review: a change, or a run of unchanged blocks folded into one line. */
export type ReviewItem = { change: ReviewChange } | { unchanged: number };

export type Decision = 'accept' | 'reject';
/** §8.3: you've changed the block since (`mine`), or removed it (`removed`). */
export type Conflict = 'mine' | 'removed';

/** Any value with its object keys sorted, so two blocks compare by content alone. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])])) : v;

/** Two blocks with the same content, their keys aside. */
export function sameBlock(a: Block, b: Block): boolean {
  const { key: _a, ...x } = a;
  const { key: _b, ...y } = b;
  return JSON.stringify(canonical(x)) === JSON.stringify(canonical(y));
}

/** The keys of `a` that keep their order in `b`: the longest common subsequence (both hold the same keys). */
function steady(a: string[], b: string[]): Set<string> {
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = new Set<string>();
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) {
      out.add(a[i]);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return out;
}

/** The review's rows: every change in the proposal's order, a removed block where it stood, and unchanged runs folded. */
export function reviewItems(base: Block[], proposed: Block[]): ReviewItem[] {
  const was = new Map(base.filter((b) => b.key).map((b) => [b.key!, b]));
  const now = new Map(proposed.filter((b) => b.key).map((b) => [b.key!, b]));
  const kept = steady(
    base.map((b) => b.key!).filter((k) => k && now.has(k)),
    proposed.map((b) => b.key!).filter((k) => k && was.has(k)),
  );

  // where each removed block goes: after the nearest block before it that's still there
  const removedAfter = new Map<string | null, Block[]>();
  let lastKept: string | null = null;
  for (const b of base) {
    if (!b.key) continue;
    if (now.has(b.key)) lastKept = b.key;
    else removedAfter.set(lastKept, [...(removedAfter.get(lastKept) ?? []), b]);
  }

  const items: ReviewItem[] = [];
  let quiet = 0;
  const push = (change: ReviewChange) => {
    if (quiet) items.push({ unchanged: quiet });
    quiet = 0;
    items.push({ change });
  };
  const removed = (after: string | null) => {
    for (const b of removedAfter.get(after) ?? []) push({ key: b.key!, kind: 'removed', before: b, after: null, afterKey: null });
  };

  removed(null);
  let prev: string | null = null;
  for (const b of proposed) {
    const key = b.key;
    if (!key) continue;
    const old = was.get(key);
    if (!old) push({ key, kind: 'added', before: null, after: b, afterKey: prev });
    else if (!kept.has(key)) push({ key, kind: 'moved', before: old, after: b, afterKey: prev, ...(sameBlock(old, b) ? {} : { edited: true as const }) });
    else if (old.type !== b.type) push({ key, kind: 'retyped', before: old, after: b, afterKey: null });
    else if (!sameBlock(old, b)) push({ key, kind: 'changed', before: old, after: b, afterKey: null });
    else quiet++;
    removed(key);
    prev = key;
  }
  if (quiet) items.push({ unchanged: quiet });
  return items;
}

/** The changes alone, in order. */
export const changesOf = (items: ReviewItem[]): ReviewChange[] => items.flatMap((i) => ('change' in i ? [i.change] : []));

/** §8.3: whether the article now still holds the block as the proposal found it. An added block has nothing to conflict with. */
export function conflictOf(change: ReviewChange, current: Block[]): Conflict | null {
  if (!change.before) return null;
  const mine = current.find((b) => b.key === change.key);
  if (!mine) return 'removed';
  return sameBlock(mine, change.before) ? null : 'mine';
}

/**
 * The article's body with the accepted changes made, on the article as it is now. Undecided and rejected changes
 * are dropped. A change to a block you've removed since is skipped. An added or moved block goes after the
 * nearest block before it in the proposal that the body still has (first, if none).
 */
export function applyDecisions(current: Block[], items: ReviewItem[], decisions: Record<string, Decision | undefined>): Block[] {
  const changes = changesOf(items).filter((c) => decisions[c.key] === 'accept');
  if (!changes.length) return current;
  let body = [...current];
  const at = (key: string) => body.findIndex((b) => b.key === key);

  for (const c of changes) {
    if (c.kind === 'removed') body = body.filter((b) => b.key !== c.key);
    else if ((c.kind === 'changed' || c.kind === 'retyped') && at(c.key) >= 0) body[at(c.key)] = c.after!;
  }

  const placed = changes.filter((c) => c.kind === 'added' || (c.kind === 'moved' && at(c.key) >= 0));
  // each placed block's anchor in the proposal, so a placement can fall back to an earlier neighbour
  const prevOf = new Map(changesOf(items).filter((c) => c.after).map((c) => [c.key, c.afterKey]));
  for (const c of placed) {
    if (c.kind === 'moved') body = body.filter((b) => b.key !== c.key);
    let after = c.afterKey;
    const seen = new Set<string>();
    // walk back past neighbours the body doesn't have (a rejected insert): their own anchor stands in
    while (after !== null && at(after) < 0 && !seen.has(after)) {
      seen.add(after);
      after = prevOf.has(after) ? prevOf.get(after)! : null;
    }
    const i = after === null || at(after) < 0 ? 0 : at(after) + 1;
    body.splice(i, 0, c.after!);
  }
  return body;
}

// ---------- words (§8.1) ----------

/** A row's kind, as its tag says it. */
export function kindTag(c: ReviewChange, label: (type: string) => string): string {
  switch (c.kind) {
    case 'changed':
      return 'Changed';
    case 'retyped':
      return `Retyped (from ${label(c.before!.type)} to ${label(c.after!.type)})`;
    case 'added':
      return 'Added';
    case 'removed':
      return 'Removed';
    case 'moved':
      return c.edited ? 'Moved and changed' : 'Moved';
  }
}

/** The head: who proposed it, how many changes, and the summary. */
export function headLine(service: string, count: number, summary: string): string {
  const n = count === 1 ? '1 change' : `${count} changes`;
  return summary ? `${service} proposed ${n}: ${summary}` : `${service} proposed ${n}.`;
}

/** The Apply button, with the count of accepted changes. */
export const applyLabel = (accepted: number): string => (accepted === 1 ? 'Apply 1 change' : `Apply ${accepted} changes`);

/** A folded run of unchanged blocks. */
export const unchangedLine = (n: number): string => (n === 1 ? '1 block unchanged' : `${n} blocks unchanged`);

/** §8.3's words. */
export const CONFLICT_LINE: Record<Conflict, string> = {
  mine: "You've changed this block since.",
  removed: 'This block was removed.',
};

// ---------- the Review tab's view (§8.1) ----------

/** A row as the Review tab draws it. */
export interface ReviewRow {
  key: string;
  kind: ChangeKind;
  tag: string;
  /** The block's type and first words. */
  name: string;
  /** Words struck and inserted for a block of words; before and after for anything else; null for a move alone. */
  diff: { words: DiffPart[] } | { before: string | null; after: string | null } | null;
  decision: Decision | null;
  conflict: Conflict | null;
}

export type ReviewLine = { row: ReviewRow } | { unchanged: number };

export interface ReviewView {
  head: string;
  lines: ReviewLine[];
  /** The changes accepted that can be applied: Apply's count. */
  accepted: number;
}

const wordsOf = (b: Block): string | null => {
  const f = wordsField(b.type);
  if (!f) return null;
  const v = (b as unknown as Record<string, string>)[f] ?? '';
  return f === 'markdown' ? plainText(v) : v;
};
const nameOf = (b: Block) => {
  const words = excerptOf(b, undefined, 48);
  return words ? `${kindOf(b)}: ${words}` : kindOf(b);
};

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const fieldName = (k: string) => k.charAt(0).toUpperCase() + k.slice(1).replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);

/** What changed in a block that isn't words: each field that differs, its value on each side ("Caption: …"). */
function fieldsOf(a: Block, b: Block): { before: string; after: string } | null {
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(ra), ...Object.keys(rb)])].filter((k) => k !== 'key' && k !== 'type' && JSON.stringify(ra[k]) !== JSON.stringify(rb[k]));
  if (!keys.length) return null;
  const scalar = (v: unknown) => v === undefined || v === null || typeof v !== 'object';
  const say = (r: Record<string, unknown>, after: boolean) =>
    keys
      .map((k) => {
        const v = r[k];
        if (!scalar(ra[k]) || !scalar(rb[k])) return after ? `${fieldName(k)} (changed)` : fieldName(k);
        return `${fieldName(k)}: ${v === undefined || v === null || v === '' ? 'none' : clip(typeof v === 'string' ? plainText(v) : String(v))}`;
      })
      .join('; ');
  return { before: say(ra, false), after: say(rb, true) };
}

function diffOf(c: ReviewChange, from: Block | null): ReviewRow['diff'] {
  if (c.kind === 'moved' && !c.edited) return null;
  const a = from;
  const b = c.after;
  const wa = a ? wordsOf(a) : '';
  const wb = b ? wordsOf(b) : '';
  // words to words, or a block of words added or removed: a word diff; the same kind of block, the fields that
  // changed; anything else, before and after
  if (wa !== null && wb !== null && (!a || !b || a.type === b.type)) return { words: wordDiff(wa, wb) };
  const fields = a && b && a.type === b.type ? fieldsOf(a, b) : null;
  if (fields) return fields;
  return { before: a ? excerptOf(a) || kindOf(a) : null, after: b ? excerptOf(b) || kindOf(b) : null };
}

/** The Review tab's rows for a kept proposal, against the article as it is now. */
export function reviewView(p: { by: string; summary: string; base: Block[]; proposed: Block[]; decisions: Record<string, Decision> }, current: Block[]): ReviewView {
  const items = reviewItems(p.base, p.proposed);
  let count = 0;
  let accepted = 0;
  const lines = items.map((item): ReviewLine => {
    if (!('change' in item)) return item;
    const c = item.change;
    count++;
    const conflict = conflictOf(c, current);
    const decision = conflict === 'removed' && p.decisions[c.key] === 'accept' ? null : (p.decisions[c.key] ?? null);
    if (decision === 'accept') accepted++;
    // a block you changed since is compared with yours: what accepting would do to it
    const mine = conflict === 'mine' ? (current.find((b) => b.key === c.key) ?? c.before) : c.before;
    const label = (type: string) => kindOf(type === c.before?.type ? c.before! : c.after!);
    return { row: { key: c.key, kind: c.kind, tag: kindTag(c, label), name: nameOf((c.after ?? c.before)!), diff: diffOf(c, mine), decision, conflict } };
  });
  return { head: headLine(p.by, count, p.summary), lines, accepted };
}
