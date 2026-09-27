import { describe, expect, it } from 'vitest';
import { BACKPACK_SLOTS, CHEST_SLOTS, HOTBAR, Inventory, type SlotRef } from '../../src/game/inventory/inventory';
import { BLOOM_COLOURS, ITEM_IDS, flowerItem, itemDef } from '../../src/game/inventory/items';
import { doubleClick, dropHeld, leftClick, moveAllOf, numberSwap, planSpread, rightClick, shiftClick, sortSection, spread, storeAll, takeAll, wheelMove } from '../../src/game/inventory/screenOps';

const B = (i: number): SlotRef => ({ c: 'backpack', i });
const C = (i: number): SlotRef => ({ c: 'chest', i });
const ids = (inv: Inventory, c: 'backpack' | 'chest' = 'backpack') => inv.slots(c).map((s) => (s ? `${s.id}:${s.n}` : '-'));

describe('items', () => {
  it('registers 7 materials, 5 crafted ones, 3 flowers × 7 colours and 7 paints, each with a name and a 64 stack', () => {
    expect(ITEM_IDS.length).toBe(7 + 5 + 3 * BLOOM_COLOURS.length + BLOOM_COLOURS.length);
    for (const id of ITEM_IDS) {
      expect(itemDef(id).name.length).toBeGreaterThan(2);
      expect(itemDef(id).maxStack).toBe(64);
    }
    expect(flowerItem('tulip', 0)).toBe('tulip-red');
    expect(flowerItem('pansy', 6)).toBe('pansy-blue');
    expect(flowerItem('cosmos', 9)).toBe('cosmos-yellow');
    expect(itemDef('cosmos-white').name).toBe('White cosmos');
    expect(itemDef('paint-blue').name).toBe('Blue paint');
  });
});

describe('inventory: picking up (Inventory.add)', () => {
  it('has 36 backpack slots (9 hotbar) and 27 chest slots', () => {
    const inv = new Inventory();
    expect(inv.backpack.length).toBe(BACKPACK_SLOTS);
    expect(HOTBAR).toBe(9);
    expect(inv.chest.length).toBe(CHEST_SLOTS);
  });

  it('tops up existing stacks first (hotbar first), then fills empty slots in order', () => {
    const inv = new Inventory();
    inv.backpack[12] = { id: 'apple', n: 60 };
    inv.backpack[3] = { id: 'apple', n: 62 };
    expect(inv.add('apple', 10)).toBe(0);
    expect(inv.backpack[3]).toEqual({ id: 'apple', n: 64 });
    expect(inv.backpack[12]).toEqual({ id: 'apple', n: 64 });
    expect(inv.backpack[0]).toEqual({ id: 'apple', n: 4 });
    inv.add('stone', 70);
    expect(inv.backpack[1]).toEqual({ id: 'stone', n: 64 });
    expect(inv.backpack[2]).toEqual({ id: 'stone', n: 6 });
  });

  it('returns what does not fit, and room() predicts it', () => {
    const inv = new Inventory();
    for (let i = 0; i < BACKPACK_SLOTS; i++) inv.backpack[i] = { id: 'stone', n: i === 5 ? 60 : 64 };
    expect(inv.room('stone')).toBe(4);
    expect(inv.room('log')).toBe(0);
    expect(inv.add('stone', 10)).toBe(6);
    expect(inv.add('log', 3)).toBe(3);
    expect(inv.count('stone')).toBe(BACKPACK_SLOTS * 64);
  });
});

describe('inventory: hotbar', () => {
  it('selects with 1–9 and scrolls round', () => {
    const inv = new Inventory();
    inv.select(4);
    expect(inv.selected).toBe(4);
    inv.scroll(1);
    expect(inv.selected).toBe(5);
    inv.select(8);
    inv.scroll(1);
    expect(inv.selected).toBe(0);
    inv.scroll(-1);
    expect(inv.selected).toBe(8);
  });

  it('Q drops one of the selected item, Ctrl+Q the whole stack', () => {
    const inv = new Inventory();
    inv.backpack[2] = { id: 'log', n: 5 };
    inv.select(2);
    expect(inv.dropSelected(false)).toEqual({ id: 'log', n: 1 });
    expect(inv.backpack[2]).toEqual({ id: 'log', n: 4 });
    expect(inv.dropSelected(true)).toEqual({ id: 'log', n: 4 });
    expect(inv.backpack[2]).toBeNull();
    expect(inv.dropSelected(false)).toBeNull();
  });
});

describe('inventory: clicks (Minecraft Java)', () => {
  it('left-click picks up, puts down, merges (remainder stays held) and swaps', () => {
    const inv = new Inventory();
    inv.backpack[0] = { id: 'apple', n: 40 };
    inv.backpack[1] = { id: 'apple', n: 30 };
    inv.backpack[2] = { id: 'stone', n: 3 };
    leftClick(inv, B(0));
    expect(inv.held).toEqual({ id: 'apple', n: 40 });
    expect(inv.backpack[0]).toBeNull();
    leftClick(inv, B(1)); // merge 34 in, 6 left on the cursor
    expect(inv.backpack[1]).toEqual({ id: 'apple', n: 64 });
    expect(inv.held).toEqual({ id: 'apple', n: 6 });
    leftClick(inv, B(2)); // swap with a different item
    expect(inv.backpack[2]).toEqual({ id: 'apple', n: 6 });
    expect(inv.held).toEqual({ id: 'stone', n: 3 });
    leftClick(inv, B(0)); // put down in an empty slot
    expect(inv.backpack[0]).toEqual({ id: 'stone', n: 3 });
    expect(inv.held).toBeNull();
  });

  it('right-click takes half (rounded up), puts one down, and swaps different items', () => {
    const inv = new Inventory();
    inv.backpack[0] = { id: 'log', n: 7 };
    rightClick(inv, B(0));
    expect(inv.held).toEqual({ id: 'log', n: 4 });
    expect(inv.backpack[0]).toEqual({ id: 'log', n: 3 });
    rightClick(inv, B(5));
    expect(inv.backpack[5]).toEqual({ id: 'log', n: 1 });
    rightClick(inv, B(0));
    expect(inv.backpack[0]).toEqual({ id: 'log', n: 4 });
    expect(inv.held).toEqual({ id: 'log', n: 2 });
    inv.backpack[6] = { id: 'stone', n: 9 };
    rightClick(inv, B(6));
    expect(inv.held).toEqual({ id: 'stone', n: 9 });
    expect(inv.backpack[6]).toEqual({ id: 'log', n: 2 });
    // a single item: right-click picks up that one
    inv.held = null;
    inv.backpack[7] = { id: 'apple', n: 1 };
    rightClick(inv, B(7));
    expect(inv.held).toEqual({ id: 'apple', n: 1 });
    expect(inv.backpack[7]).toBeNull();
  });

  it('shift-click moves hotbar ↔ main in the backpack screen', () => {
    const inv = new Inventory();
    inv.backpack[0] = { id: 'apple', n: 10 };
    inv.backpack[20] = { id: 'apple', n: 60 };
    shiftClick(inv, B(0), 'backpack');
    expect(inv.backpack[20]).toEqual({ id: 'apple', n: 64 });
    expect(inv.backpack[9]).toEqual({ id: 'apple', n: 6 });
    expect(inv.backpack[0]).toBeNull();
    shiftClick(inv, B(9), 'backpack');
    expect(inv.backpack[0]).toEqual({ id: 'apple', n: 6 });
  });

  it('shift-click moves backpack → chest (in order) and chest → backpack (hotbar from the right first)', () => {
    const inv = new Inventory();
    inv.backpack[4] = { id: 'stone', n: 20 };
    inv.chest[3] = { id: 'stone', n: 50 };
    shiftClick(inv, B(4), 'chest');
    expect(inv.chest[3]).toEqual({ id: 'stone', n: 64 });
    expect(inv.chest[0]).toEqual({ id: 'stone', n: 6 });
    expect(inv.backpack[4]).toBeNull();
    inv.chest[10] = { id: 'leaves', n: 12 };
    shiftClick(inv, C(10), 'chest');
    expect(inv.backpack[8]).toEqual({ id: 'leaves', n: 12 });
    expect(inv.chest[10]).toBeNull();
  });

  it('shift-click leaves what does not fit where it was', () => {
    const inv = new Inventory();
    for (let i = 0; i < CHEST_SLOTS; i++) inv.chest[i] = { id: 'log', n: i === 0 ? 62 : 64 };
    inv.backpack[0] = { id: 'log', n: 10 };
    shiftClick(inv, B(0), 'chest');
    expect(inv.chest[0]).toEqual({ id: 'log', n: 64 });
    expect(inv.backpack[0]).toEqual({ id: 'log', n: 8 });
  });

  it('double-click gathers the held item from every visible slot, non-full stacks first, up to 64', () => {
    const inv = new Inventory();
    inv.backpack[3] = { id: 'apple', n: 64 };
    inv.backpack[5] = { id: 'apple', n: 10 };
    inv.chest[0] = { id: 'apple', n: 20 };
    inv.backpack[6] = { id: 'stone', n: 4 };
    inv.held = { id: 'apple', n: 5 };
    doubleClick(inv, 'chest');
    expect(inv.held).toEqual({ id: 'apple', n: 64 });
    expect(inv.chest[0]).toBeNull();
    expect(inv.backpack[5]).toBeNull();
    expect(inv.backpack[3]).toEqual({ id: 'apple', n: 35 });
    expect(inv.backpack[6]).toEqual({ id: 'stone', n: 4 });
  });

  it('number keys swap the hovered slot with that hotbar slot (only with nothing held)', () => {
    const inv = new Inventory();
    inv.backpack[15] = { id: 'log', n: 3 };
    inv.backpack[2] = { id: 'apple', n: 1 };
    numberSwap(inv, B(15), 2);
    expect(inv.backpack[2]).toEqual({ id: 'log', n: 3 });
    expect(inv.backpack[15]).toEqual({ id: 'apple', n: 1 });
    inv.chest[4] = { id: 'stone', n: 8 };
    numberSwap(inv, C(4), 0);
    expect(inv.backpack[0]).toEqual({ id: 'stone', n: 8 });
    expect(inv.chest[4]).toBeNull();
    inv.held = { id: 'leaves', n: 1 };
    numberSwap(inv, B(15), 5);
    expect(inv.backpack[5]).toBeNull();
  });

  it('left-drag spreads evenly (remainder held); right-drag puts one in each; invalid slots are skipped', () => {
    const inv = new Inventory();
    inv.held = { id: 'stone', n: 10 };
    inv.backpack[11] = { id: 'log', n: 1 };
    spread(inv, [B(9), B(10), B(11), B(12), B(10)], true);
    expect(ids(inv).slice(9, 13)).toEqual(['stone:3', 'stone:3', 'log:1', 'stone:3']);
    expect(inv.held).toEqual({ id: 'stone', n: 1 });
    inv.held = { id: 'apple', n: 2 };
    spread(inv, [B(20), B(21), B(22)], false);
    expect(ids(inv).slice(20, 23)).toEqual(['apple:1', 'apple:1', '-']);
    expect(inv.held).toBeNull();
  });

  it('dropping from the cursor and closing the screen', () => {
    const inv = new Inventory();
    inv.held = { id: 'apple', n: 5 };
    expect(dropHeld(inv, false)).toEqual({ id: 'apple', n: 1 });
    expect(inv.held).toEqual({ id: 'apple', n: 4 });
    expect(inv.returnHeld()).toBeNull();
    expect(inv.backpack[0]).toEqual({ id: 'apple', n: 4 });
    expect(inv.held).toBeNull();
    for (let i = 0; i < BACKPACK_SLOTS; i++) inv.backpack[i] = { id: 'stone', n: 64 };
    inv.held = { id: 'log', n: 3 };
    expect(inv.returnHeld()).toEqual({ id: 'log', n: 3 }); // no room: dropped at your feet
  });

  it('every change bumps the version', () => {
    const inv = new Inventory();
    const v = inv.version;
    inv.add('log', 1);
    leftClick(inv, B(0));
    leftClick(inv, B(1));
    expect(inv.version).toBe(v + 3);
    leftClick(inv, B(5)); // nothing to do
    expect(inv.version).toBe(v + 3);
  });
});

describe('inventory: organising (screenOps)', () => {
  it('a drag uses at most as many slots as there are items (Minecraft), and the preview is what the release does', () => {
    const inv = new Inventory();
    inv.held = { id: 'apple', n: 3 };
    const refs = [B(9), B(10), B(11), B(12), B(13)];
    const plan = planSpread(inv, refs, true)!;
    expect([...plan.slots.entries()]).toEqual([
      ['backpack:9', { id: 'apple', n: 1 }],
      ['backpack:10', { id: 'apple', n: 1 }],
      ['backpack:11', { id: 'apple', n: 1 }],
    ]);
    expect(plan.left).toBe(0);
    spread(inv, refs, true);
    expect(ids(inv).slice(9, 14)).toEqual(['apple:1', 'apple:1', 'apple:1', '-', '-']);
    expect(inv.held).toBeNull();
    // topping up part stacks: capped at 64, the rest stays held
    inv.backpack[20] = { id: 'stone', n: 60 };
    inv.held = { id: 'stone', n: 20 };
    spread(inv, [B(20), B(21)], true);
    expect(ids(inv).slice(20, 22)).toEqual(['stone:64', 'stone:10']);
    expect(inv.held).toEqual({ id: 'stone', n: 6 });
  });

  it('Shift+double-click moves every stack of that item: chest screen, from the clicked side to the other', () => {
    const inv = new Inventory();
    inv.backpack[0] = { id: 'apple', n: 5 };
    inv.backpack[14] = { id: 'apple', n: 64 };
    inv.backpack[30] = { id: 'apple', n: 7 };
    inv.backpack[2] = { id: 'log', n: 3 };
    inv.chest[4] = { id: 'apple', n: 1 };
    expect(moveAllOf(inv, B(14), 'apple', 'chest')).toBe(76);
    expect(inv.count('apple')).toBe(0);
    expect(inv.backpack[2]).toEqual({ id: 'log', n: 3 });
    expect(inv.chest.reduce((n, s) => n + (s?.id === 'apple' ? s.n : 0), 0)).toBe(77);
    // and back: from the chest side
    expect(moveAllOf(inv, C(0), 'apple', 'chest')).toBe(77);
    expect(inv.count('apple')).toBe(77);
  });

  it('Shift+double-click in the backpack screen gathers the item into the main inventory from its top-left', () => {
    const inv = new Inventory();
    inv.backpack[0] = { id: 'apple', n: 5 };
    inv.backpack[3] = { id: 'apple', n: 60 };
    inv.backpack[9] = { id: 'log', n: 2 };
    inv.backpack[25] = { id: 'apple', n: 10 };
    expect(moveAllOf(inv, B(3), 'apple', 'backpack')).toBe(75);
    expect(ids(inv).slice(0, 12)).toEqual(['-', '-', '-', '-', '-', '-', '-', '-', '-', 'log:2', 'apple:64', 'apple:11']);
    expect(inv.backpack[25]).toBeNull();
    expect(moveAllOf(inv, B(10), 'apple', 'backpack')).toBe(0); // already gathered: no change
  });

  it('the wheel moves one at a time: down sends one where Shift+click would, up pulls one back', () => {
    const inv = new Inventory();
    inv.backpack[4] = { id: 'stone', n: 3 };
    expect(wheelMove(inv, B(4), 1, 'chest')).toBe(true);
    expect(inv.chest[0]).toEqual({ id: 'stone', n: 1 });
    expect(inv.backpack[4]).toEqual({ id: 'stone', n: 2 });
    wheelMove(inv, B(4), 1, 'chest');
    wheelMove(inv, B(4), 1, 'chest');
    expect(inv.backpack[4]).toBeNull();
    expect(inv.chest[0]).toEqual({ id: 'stone', n: 3 });
    expect(wheelMove(inv, B(4), 1, 'chest')).toBe(false);
    expect(wheelMove(inv, C(0), -1, 'chest')).toBe(false); // nothing of it on the other side
    inv.backpack[8] = { id: 'stone', n: 1 };
    expect(wheelMove(inv, C(0), -1, 'chest')).toBe(true);
    expect(inv.chest[0]).toEqual({ id: 'stone', n: 4 });
    expect(inv.backpack[8]).toBeNull();
    inv.held = { id: 'log', n: 1 };
    expect(wheelMove(inv, C(0), 1, 'chest')).toBe(false); // not while holding a stack
  });

  it('sorting merges part stacks and lays them out in the item order; other sections are untouched', () => {
    const inv = new Inventory();
    inv.backpack[0] = { id: 'stone', n: 2 };
    inv.backpack[12] = { id: 'tulip-red', n: 3 };
    inv.backpack[15] = { id: 'apple', n: 40 };
    inv.backpack[20] = { id: 'log', n: 9 };
    inv.backpack[33] = { id: 'apple', n: 40 };
    expect(sortSection(inv, 'backpack', HOTBAR, BACKPACK_SLOTS)).toBe(true);
    expect(ids(inv).slice(9, 14)).toEqual(['log:9', 'apple:64', 'apple:16', 'tulip-red:3', '-']);
    expect(inv.backpack[0]).toEqual({ id: 'stone', n: 2 });
    expect(inv.count('apple')).toBe(80);
    const v = inv.version;
    expect(sortSection(inv, 'backpack', HOTBAR, BACKPACK_SLOTS)).toBe(false);
    expect(inv.version).toBe(v);
  });

  it('the chest shortcuts: take all, store all, store only what the chest already has', () => {
    const inv = new Inventory();
    inv.chest[0] = { id: 'log', n: 10 };
    inv.chest[5] = { id: 'apple', n: 3 };
    expect(takeAll(inv)).toBe(13);
    expect(inv.chest.every((s) => !s)).toBe(true);
    expect(inv.count('log')).toBe(10);
    inv.chest[2] = { id: 'log', n: 1 };
    expect(storeAll(inv, true)).toBe(10);
    expect(inv.count('log')).toBe(0);
    expect(inv.count('apple')).toBe(3);
    expect(storeAll(inv)).toBe(3);
    expect(inv.backpack.every((s) => !s)).toBe(true);
  });
});

describe('inventory: persistence', () => {
  it('round-trips through JSON and drops unknown or bad entries', () => {
    const inv = new Inventory();
    inv.add('apple', 70);
    inv.chest[2] = { id: 'tulip-red', n: 3 };
    inv.select(3);
    const saved = JSON.parse(JSON.stringify(inv.toJSON()));
    const back = new Inventory();
    back.load(saved);
    expect(ids(back)).toEqual(ids(inv));
    expect(ids(back, 'chest')).toEqual(ids(inv, 'chest'));
    expect(back.selected).toBe(3);
    saved.backpack[0] = ['diamond', 3];
    saved.backpack[1] = ['log', -2];
    saved.backpack[2] = ['log', 500];
    const bad = new Inventory();
    bad.load(saved);
    expect(bad.backpack[0]).toBeNull();
    expect(bad.backpack[1]).toBeNull();
    expect(bad.backpack[2]).toEqual({ id: 'log', n: 64 });
    const none = new Inventory();
    none.load({ v: 99 });
    none.load(null);
    expect(ids(none).every((s) => s === '-')).toBe(true);
  });
});
