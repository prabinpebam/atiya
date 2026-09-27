import { BACKPACK_SLOTS, CHEST_SLOTS, HOTBAR, moveInto, type ContainerId, type Inventory, type Screen, type Slot, type SlotRef, type Stack } from './inventory';
import { ITEM_IDS, maxStack, type ItemId } from './items';

/**
 * What you can do to the slots while the backpack or chest screen is open (docs:
 * collection-inventory.md §4.3): Minecraft Java's clicks, drags and keys, Mouse Tweaks' shift-drag and
 * wheel, and sorting and chest shortcuts. Pure (no DOM); it loads with the screen, not the game.
 * Every change bumps `inv.version`; the screen then calls `controller.invChanged()`.
 */

const clone = (s: Slot): Slot => (s ? { id: s.id, n: s.n } : null);
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);
const keyOf = (r: SlotRef) => `${r.c}:${r.i}`;

function put(inv: Inventory, r: SlotRef, s: Slot): void {
  inv.slots(r.c)[r.i] = s && s.n > 0 ? s : null;
}

// ---------- clicks (Minecraft Java) ----------

/** Left-click: pick up the stack / put the held stack down / merge / swap. */
export function leftClick(inv: Inventory, r: SlotRef): void {
  const s = inv.get(r);
  const h = inv.held;
  if (!h) {
    if (!s) return;
    inv.held = clone(s);
    put(inv, r, null);
  } else if (!s) {
    put(inv, r, clone(h));
    inv.held = null;
  } else if (s.id === h.id) {
    const k = Math.min(maxStack(s.id) - s.n, h.n);
    if (k <= 0) {
      // full stack of the same item: swap (Minecraft)
      put(inv, r, clone(h));
      inv.held = clone(s);
    } else {
      s.n += k;
      inv.held = h.n - k > 0 ? { id: h.id, n: h.n - k } : null;
    }
  } else {
    put(inv, r, clone(h));
    inv.held = clone(s);
  }
  inv.version++;
}

/** Right-click: pick up half (the larger half) / put one down / swap with a different item. */
export function rightClick(inv: Inventory, r: SlotRef): void {
  const s = inv.get(r);
  const h = inv.held;
  if (!h) {
    if (!s) return;
    const take = Math.ceil(s.n / 2);
    inv.held = { id: s.id, n: take };
    put(inv, r, s.n - take > 0 ? { id: s.id, n: s.n - take } : null);
  } else if (!s) {
    put(inv, r, { id: h.id, n: 1 });
    inv.held = h.n > 1 ? { id: h.id, n: h.n - 1 } : null;
  } else if (s.id === h.id) {
    if (s.n >= maxStack(s.id)) return;
    s.n += 1;
    inv.held = h.n > 1 ? { id: h.id, n: h.n - 1 } : null;
  } else {
    put(inv, r, clone(h));
    inv.held = clone(s);
  }
  inv.version++;
}

/** Where Shift+click sends a slot's stack, in fill order (Minecraft's `quickMoveStack`). */
export function quickTargets(r: SlotRef, screen: Screen): { c: ContainerId; order: number[] } {
  if (screen === 'chest') {
    if (r.c === 'chest') {
      // chest → player: from the end of the player's slots (hotbar right-to-left, then main bottom-up)
      return { c: 'backpack', order: [...range(0, HOTBAR).reverse(), ...range(HOTBAR, BACKPACK_SLOTS).reverse()] };
    }
    return { c: 'chest', order: range(0, CHEST_SLOTS) };
  }
  return r.i < HOTBAR ? { c: 'backpack', order: range(HOTBAR, BACKPACK_SLOTS) } : { c: 'backpack', order: range(0, HOTBAR) };
}

/** Shift+click: move the slot's stack to the other section; whatever doesn't fit stays. Returns how many moved. */
export function shiftClick(inv: Inventory, r: SlotRef, screen: Screen): number {
  const s = inv.get(r);
  if (!s) return 0;
  const t = quickTargets(r, screen);
  const left = moveInto(inv.slots(t.c), t.order, clone(s)!);
  if (left === s.n) return 0;
  const moved = s.n - left;
  put(inv, r, left > 0 ? { id: s.id, n: left } : null);
  inv.version++;
  return moved;
}

/**
 * Shift+double-click (Minecraft Java): every stack of `id` goes too. With a chest open, from the clicked
 * slot's side (the chest, or the whole backpack) to the other; in the backpack screen, they're gathered
 * into the main inventory from its top-left (back into the hotbar only if the main inventory is full).
 */
export function moveAllOf(inv: Inventory, r: SlotRef, id: ItemId, screen: Screen): number {
  let moved = 0;
  if (screen === 'chest') {
    const n = r.c === 'chest' ? CHEST_SLOTS : BACKPACK_SLOTS;
    for (let i = 0; i < n; i++) if (inv.get({ c: r.c, i })?.id === id) moved += shiftClick(inv, { c: r.c, i }, screen);
    return moved;
  }
  const bp = inv.backpack;
  const before = bp.map((s) => (s?.id === id ? s.n : 0));
  const total = before.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  for (let i = 0; i < BACKPACK_SLOTS; i++) if (before[i]) bp[i] = null;
  const left = moveInto(bp, range(HOTBAR, BACKPACK_SLOTS), { id, n: total });
  if (left > 0) moveInto(bp, range(0, HOTBAR), { id, n: left });
  if (!bp.some((s, i) => (s?.id === id ? s.n : 0) !== before[i])) return 0;
  inv.version++;
  return total;
}

/** Double-click with a stack held: gather that item from every visible slot onto the cursor (non-full stacks first). */
export function doubleClick(inv: Inventory, screen: Screen): void {
  const h = inv.held;
  if (!h) return;
  const max = maxStack(h.id);
  const refs: SlotRef[] = [
    ...(screen === 'chest' ? range(0, CHEST_SLOTS).map((i) => ({ c: 'chest' as const, i })) : []),
    ...range(0, BACKPACK_SLOTS).map((i) => ({ c: 'backpack' as const, i })),
  ];
  let moved = false;
  for (const pass of [0, 1]) {
    for (const r of refs) {
      if (h.n >= max) break;
      const s = inv.get(r);
      if (!s || s.id !== h.id || (pass === 0 && s.n >= max)) continue;
      const k = Math.min(max - h.n, s.n);
      h.n += k;
      put(inv, r, s.n - k > 0 ? { id: s.id, n: s.n - k } : null);
      moved = true;
    }
  }
  if (moved) inv.version++;
}

/** 1–9 while hovering a slot (nothing held): swap it with hotbar slot `k`. */
export function numberSwap(inv: Inventory, r: SlotRef, k: number): void {
  if (inv.held || k < 0 || k >= HOTBAR) return;
  const hot: SlotRef = { c: 'backpack', i: k };
  if (r.c === hot.c && r.i === hot.i) return;
  const a = clone(inv.get(r));
  const b = clone(inv.get(hot));
  if (!a && !b) return;
  put(inv, r, b);
  put(inv, hot, a);
  inv.version++;
}

// ---------- dragging with a stack held ----------

export interface SpreadPlan {
  /** The new stack in each slot that takes some (by `c:i`). */
  slots: Map<string, Stack>;
  /** What stays on the cursor. */
  left: number;
}

/**
 * Drag across slots with a stack held: `even` (left-drag) spreads it evenly over the slots that can take
 * it (empty, or the same item and not full); otherwise (right-drag) one per slot. As in Minecraft, a drag
 * uses at most as many slots as there are items, and the remainder stays on the cursor. Pure: the screen
 * shows this plan while you drag, and `spread` applies it on release.
 */
export function planSpread(inv: Inventory, refs: readonly SlotRef[], even: boolean): SpreadPlan | null {
  const h = inv.held;
  if (!h) return null;
  const max = maxStack(h.id);
  const seen = new Set<string>();
  const ok = refs
    .filter((r) => {
      const key = keyOf(r);
      if (seen.has(key)) return false;
      seen.add(key);
      const s = inv.get(r);
      return !s || (s.id === h.id && s.n < max);
    })
    .slice(0, h.n);
  if (!ok.length) return null;
  const each = even ? Math.floor(h.n / ok.length) : 1;
  const slots = new Map<string, Stack>();
  let left = h.n;
  for (const r of ok) {
    const have = inv.get(r)?.n ?? 0;
    const k = Math.min(each, left, max - have);
    if (k <= 0) continue;
    slots.set(keyOf(r), { id: h.id, n: have + k });
    left -= k;
  }
  return { slots, left };
}

export function spread(inv: Inventory, refs: readonly SlotRef[], even: boolean): void {
  const plan = planSpread(inv, refs, even);
  const h = inv.held;
  if (!plan || !h) return;
  for (const [key, st] of plan.slots) {
    const [c, i] = key.split(':');
    put(inv, { c: c as ContainerId, i: Number(i) }, st);
  }
  inv.held = plan.left > 0 ? { id: h.id, n: plan.left } : null;
  inv.version++;
}

/** Throw from the cursor (click outside the panel): all (left) or one (right). */
export function dropHeld(inv: Inventory, all: boolean): Stack | null {
  const h = inv.held;
  if (!h) return null;
  const k = all ? h.n : 1;
  inv.held = h.n - k > 0 ? { id: h.id, n: h.n - k } : null;
  inv.version++;
  return { id: h.id, n: k };
}

// ---------- the mouse wheel (Mouse Tweaks) ----------

/**
 * The wheel over a slot, with nothing held: down (`dir` > 0) moves one item from it to where Shift+click
 * would send it; up pulls one of the same item back into it from there (the last one first). Returns
 * whether anything moved.
 */
export function wheelMove(inv: Inventory, r: SlotRef, dir: number, screen: Screen): boolean {
  const s = inv.get(r);
  if (inv.held || !s || !dir) return false;
  const t = quickTargets(r, screen);
  const other = inv.slots(t.c);
  if (dir > 0) {
    if (moveInto(other, t.order, { id: s.id, n: 1 }) > 0) return false;
    put(inv, r, { id: s.id, n: s.n - 1 });
  } else {
    if (s.n >= maxStack(s.id)) return false;
    const from = [...t.order].reverse().find((i) => other[i]?.id === s.id);
    if (from === undefined) return false;
    const o = other[from]!;
    other[from] = o.n > 1 ? { id: o.id, n: o.n - 1 } : null;
    s.n += 1;
  }
  inv.version++;
  return true;
}

// ---------- organising ----------

const ORDER = new Map(ITEM_IDS.map((id, k) => [id, k]));

/**
 * Sort slots `from`–`to` of a container: merge part stacks of the same item, then lay them out
 * from the first slot in the item list's order (materials, crafted parts, flowers, paints). Returns
 * whether anything changed.
 */
export function sortSection(inv: Inventory, c: ContainerId, from: number, to: number): boolean {
  const slots = inv.slots(c);
  const totals = new Map<ItemId, number>();
  for (let i = from; i < to; i++) {
    const s = slots[i];
    if (s) totals.set(s.id, (totals.get(s.id) ?? 0) + s.n);
  }
  const next: Slot[] = [];
  for (const id of [...totals.keys()].sort((a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0))) {
    let n = totals.get(id)!;
    const max = maxStack(id);
    while (n > 0) {
      next.push({ id, n: Math.min(max, n) });
      n -= max;
    }
  }
  let changed = false;
  for (let i = from; i < to; i++) {
    const s = next[i - from] ?? null;
    const was = slots[i];
    if ((was?.id ?? null) !== (s?.id ?? null) || (was?.n ?? 0) !== (s?.n ?? 0)) changed = true;
    slots[i] = s;
  }
  if (changed) inv.version++;
  return changed;
}

/** The chest screen's shortcuts: everything from the chest into the backpack (as Shift+click would). Returns how many moved. */
export function takeAll(inv: Inventory): number {
  let moved = 0;
  for (let i = 0; i < CHEST_SLOTS; i++) moved += shiftClick(inv, { c: 'chest', i }, 'chest');
  return moved;
}

/** Everything in the backpack (the hotbar too) into the chest; or, with `matching`, only items the chest already holds. */
export function storeAll(inv: Inventory, matching = false): number {
  const inChest = new Set(inv.chest.flatMap((s) => (s ? [s.id] : [])));
  let moved = 0;
  for (let i = 0; i < BACKPACK_SLOTS; i++) {
    const s = inv.backpack[i];
    if (s && (!matching || inChest.has(s.id))) moved += shiftClick(inv, { c: 'backpack', i }, 'chest');
  }
  return moved;
}
