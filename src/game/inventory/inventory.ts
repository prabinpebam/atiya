import { isItemId, maxStack, type ItemId } from './items';

/**
 * Slot containers and the Minecraft Java slot operations (docs: collection-inventory.md §4).
 * Pure logic (no DOM, no three.js): the UI and the controller call these and re-render on `version`.
 */

export interface Stack {
  id: ItemId;
  n: number;
}
export type Slot = Stack | null;

export type ContainerId = 'backpack' | 'chest';
export interface SlotRef {
  c: ContainerId;
  i: number;
}

export const HOTBAR = 9;
export const BACKPACK_SLOTS = 36;
export const CHEST_SLOTS = 27;

/** Which screen is open: the player's own (backpack) or a chest's. Decides Shift+click targets. */
export type Screen = 'backpack' | 'chest';

const clone = (s: Slot): Slot => (s ? { id: s.id, n: s.n } : null);
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);

/** Minecraft's `moveItemStackTo`: top up same-item stacks, then the first empty slot, in `order`. Returns what's left. */
export function moveInto(slots: Slot[], order: readonly number[], stack: Stack): number {
  let left = stack.n;
  const max = maxStack(stack.id);
  for (const i of order) {
    if (left <= 0) break;
    const s = slots[i];
    if (s && s.id === stack.id && s.n < max) {
      const k = Math.min(max - s.n, left);
      s.n += k;
      left -= k;
    }
  }
  for (const i of order) {
    if (left <= 0) break;
    if (!slots[i]) {
      const k = Math.min(max, left);
      slots[i] = { id: stack.id, n: k };
      left -= k;
    }
  }
  return left;
}

/** How many of `id` would fit into `slots` (at most `want`). */
export function roomFor(slots: readonly Slot[], id: ItemId, want = Infinity): number {
  const max = maxStack(id);
  let room = 0;
  for (const s of slots) {
    room += !s ? max : s.id === id ? max - s.n : 0;
    if (room >= want) return want;
  }
  return room;
}

export class Inventory {
  readonly backpack: Slot[] = new Array(BACKPACK_SLOTS).fill(null);
  readonly chest: Slot[] = new Array(CHEST_SLOTS).fill(null);
  /** The stack carried on the cursor while a screen is open. */
  held: Slot = null;
  /** Selected hotbar slot (0–8). */
  selected = 0;
  /** Bumped on every change (UI re-render, persistence). */
  version = 0;

  private changed(): void {
    this.version++;
  }

  slots(c: ContainerId): Slot[] {
    return c === 'chest' ? this.chest : this.backpack;
  }

  get(r: SlotRef): Slot {
    return this.slots(r.c)[r.i] ?? null;
  }

  private set(r: SlotRef, s: Slot): void {
    this.slots(r.c)[r.i] = s && s.n > 0 ? s : null;
  }

  /** Total count of an item in the backpack. */
  count(id: ItemId): number {
    return this.backpack.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
  }

  // ---------- picking things up (world → backpack) ----------

  /** How many of `n` would fit in the backpack. */
  room(id: ItemId, n = Infinity): number {
    return roomFor(this.backpack, id, n);
  }

  /** Minecraft's `Inventory.add`: top up stacks (hotbar first), then empty slots (hotbar first). Returns the leftover. */
  add(id: ItemId, n: number): number {
    if (n <= 0) return 0;
    const left = moveInto(this.backpack, range(0, BACKPACK_SLOTS), { id, n });
    if (left !== n) this.changed();
    return left;
  }

  /** Take `n` of an item out of the backpack (crafting, building): the main slots first, then the hotbar. False (and nothing taken) if there aren't enough. */
  remove(id: ItemId, n: number): boolean {
    if (n <= 0) return true;
    if (this.count(id) < n) return false;
    let left = n;
    for (let i = BACKPACK_SLOTS - 1; i >= 0 && left > 0; i--) {
      const s = this.backpack[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(s.n, left);
      s.n -= k;
      left -= k;
      if (s.n <= 0) this.backpack[i] = null;
    }
    this.changed();
    return true;
  }

  // ---------- hotbar ----------

  select(i: number): void {
    const k = ((Math.round(i) % HOTBAR) + HOTBAR) % HOTBAR;
    if (k !== this.selected) {
      this.selected = k;
      this.changed();
    }
  }

  /** Scroll the selection by `dir` slots (wraps). */
  scroll(dir: number): void {
    this.select(this.selected + Math.sign(dir));
  }

  /** Q / Ctrl+Q on the hotbar: take one (or the whole stack) out of the selected slot. */
  dropSelected(all: boolean): Stack | null {
    return this.takeFrom({ c: 'backpack', i: this.selected }, all ? Infinity : 1);
  }

  /** Remove up to `n` from a slot; returns what was taken. */
  takeFrom(r: SlotRef, n: number): Stack | null {
    const s = this.get(r);
    if (!s || n <= 0) return null;
    const k = Math.min(s.n, n);
    this.set(r, k === s.n ? null : { id: s.id, n: s.n - k });
    this.changed();
    return { id: s.id, n: k };
  }

  // ---------- screen operations (Minecraft Java) ----------

  /** Left-click: pick up the stack / put the held stack down / merge / swap. */
  leftClick(r: SlotRef): void {
    const s = this.get(r);
    const h = this.held;
    if (!h) {
      if (!s) return;
      this.held = clone(s);
      this.set(r, null);
    } else if (!s) {
      this.set(r, clone(h));
      this.held = null;
    } else if (s.id === h.id) {
      const k = Math.min(maxStack(s.id) - s.n, h.n);
      if (k <= 0) {
        // full stack of the same item: swap (Minecraft)
        this.set(r, clone(h));
        this.held = clone(s);
      } else {
        s.n += k;
        this.held = h.n - k > 0 ? { id: h.id, n: h.n - k } : null;
      }
    } else {
      this.set(r, clone(h));
      this.held = clone(s);
    }
    this.changed();
  }

  /** Right-click: pick up half (rounded up) / put one down / swap with a different item. */
  rightClick(r: SlotRef): void {
    const s = this.get(r);
    const h = this.held;
    if (!h) {
      if (!s) return;
      const take = Math.ceil(s.n / 2);
      this.held = { id: s.id, n: take };
      this.set(r, s.n - take > 0 ? { id: s.id, n: s.n - take } : null);
    } else if (!s) {
      this.set(r, { id: h.id, n: 1 });
      this.held = h.n > 1 ? { id: h.id, n: h.n - 1 } : null;
    } else if (s.id === h.id) {
      if (s.n >= maxStack(s.id)) return;
      s.n += 1;
      this.held = h.n > 1 ? { id: h.id, n: h.n - 1 } : null;
    } else {
      this.set(r, clone(h));
      this.held = clone(s);
    }
    this.changed();
  }

  /** Where Shift+click sends a slot's stack, in fill order (Minecraft's `quickMoveStack`). */
  quickTargets(r: SlotRef, screen: Screen): { c: ContainerId; order: number[] } {
    if (screen === 'chest') {
      if (r.c === 'chest') {
        // chest → player: from the end of the player's slots (hotbar right-to-left, then main bottom-up)
        return { c: 'backpack', order: [...range(0, HOTBAR).reverse(), ...range(HOTBAR, BACKPACK_SLOTS).reverse()] };
      }
      return { c: 'chest', order: range(0, CHEST_SLOTS) };
    }
    return r.i < HOTBAR ? { c: 'backpack', order: range(HOTBAR, BACKPACK_SLOTS) } : { c: 'backpack', order: range(0, HOTBAR) };
  }

  /** Shift+click: move the slot's stack to the other section; whatever doesn't fit stays. */
  shiftClick(r: SlotRef, screen: Screen): void {
    const s = this.get(r);
    if (!s) return;
    const t = this.quickTargets(r, screen);
    const left = moveInto(this.slots(t.c), t.order, clone(s)!);
    if (left === s.n) return;
    this.set(r, left > 0 ? { id: s.id, n: left } : null);
    this.changed();
  }

  /** Double-click with a stack held: gather that item from every visible slot onto the cursor (non-full stacks first). */
  doubleClick(screen: Screen): void {
    const h = this.held;
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
        const s = this.get(r);
        if (!s || s.id !== h.id || (pass === 0 && s.n >= max)) continue;
        const k = Math.min(max - h.n, s.n);
        h.n += k;
        this.set(r, s.n - k > 0 ? { id: s.id, n: s.n - k } : null);
        moved = true;
      }
    }
    if (moved) this.changed();
  }

  /** 1–9 while hovering a slot (nothing held): swap it with hotbar slot `k`. */
  numberSwap(r: SlotRef, k: number): void {
    if (this.held || k < 0 || k >= HOTBAR) return;
    const hot: SlotRef = { c: 'backpack', i: k };
    if (r.c === hot.c && r.i === hot.i) return;
    const a = clone(this.get(r));
    const b = clone(this.get(hot));
    if (!a && !b) return;
    this.set(r, b);
    this.set(hot, a);
    this.changed();
  }

  /**
   * Drag across slots with a stack held: `even` (left-drag) spreads it evenly over the slots that
   * can take it; otherwise (right-drag) one per slot. The remainder stays on the cursor.
   */
  distribute(refs: readonly SlotRef[], even: boolean): void {
    const h = this.held;
    if (!h) return;
    const max = maxStack(h.id);
    const seen = new Set<string>();
    const ok = refs.filter((r) => {
      const key = `${r.c}:${r.i}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const s = this.get(r);
      return !s || (s.id === h.id && s.n < max);
    });
    if (!ok.length) return;
    const each = even ? Math.floor(h.n / ok.length) : 1;
    if (each < 1) return;
    let left = h.n;
    for (const r of ok) {
      if (left <= 0) break;
      const s = this.get(r);
      const k = Math.min(each, left, max - (s ? s.n : 0));
      if (k <= 0) continue;
      this.set(r, { id: h.id, n: (s ? s.n : 0) + k });
      left -= k;
    }
    this.held = left > 0 ? { id: h.id, n: left } : null;
    this.changed();
  }

  /** Throw from the cursor (click outside the panel): all (left) or one (right). */
  dropHeld(all: boolean): Stack | null {
    const h = this.held;
    if (!h) return null;
    const k = all ? h.n : 1;
    this.held = h.n - k > 0 ? { id: h.id, n: h.n - k } : null;
    this.changed();
    return { id: h.id, n: k };
  }

  /** Closing a screen: the cursor stack goes back into the backpack; returns what didn't fit (to drop). */
  returnHeld(): Stack | null {
    const h = this.held;
    if (!h) return null;
    this.held = null;
    const left = moveInto(this.backpack, range(0, BACKPACK_SLOTS), h);
    this.changed();
    return left > 0 ? { id: h.id, n: left } : null;
  }

  // ---------- persistence ----------

  toJSON(): SavedInventory {
    const enc = (s: Slot): SavedSlot => (s ? [s.id, s.n] : null);
    return { v: 1, backpack: this.backpack.map(enc), chest: this.chest.map(enc), selected: this.selected };
  }

  /** Load a saved inventory, dropping anything unknown or malformed. */
  load(data: unknown): void {
    const d = data as Partial<SavedInventory> | null;
    if (!d || d.v !== 1) return;
    const dec = (arr: unknown, into: Slot[]) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < into.length; i++) {
        const e = arr[i];
        if (Array.isArray(e) && isItemId(e[0]) && Number.isInteger(e[1]) && e[1] > 0) into[i] = { id: e[0], n: Math.min(e[1], maxStack(e[0])) };
        else into[i] = null;
      }
    };
    dec(d.backpack, this.backpack);
    dec(d.chest, this.chest);
    if (Number.isInteger(d.selected) && d.selected! >= 0 && d.selected! < HOTBAR) this.selected = d.selected!;
    this.changed();
  }
}

export type SavedSlot = [ItemId, number] | null;
export interface SavedInventory {
  v: 1;
  backpack: SavedSlot[];
  chest: SavedSlot[];
  selected: number;
}
