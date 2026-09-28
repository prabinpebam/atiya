/**
 * Crafting rules (docs: crafting.md §4.1, §4.3): the recipes, how many you can make, crafting
 * itself, and what Chopper's house needs. Pure: no rendering, no DOM (the unit tests drive it).
 */
import { roomFor, type Inventory, type Slot } from '../../inventory/inventory';
import { BLOOM_COLOURS, FLOWER_ITEM_KINDS, itemDef, type BloomColour, type ItemId, type PaintId } from '../../inventory/items';
import { FURNACE_RADIUS } from '../layout';

/** One ingredient: `n` of any mix of `any` (a paint takes any three flowers of its colour). */
export interface Need {
  any: readonly ItemId[];
  n: number;
  /** What the screen calls it, and the icon it shows. */
  label: string;
  icon: ItemId;
}

export interface Recipe {
  id: string;
  out: ItemId;
  yield: number;
  needs: readonly Need[];
  /** A line about it on the crafting screen. */
  line: string;
}

/** The furnace's smelting (furnace.md §4.1): each ingot burns one firewood. */
export const SMELT_S = 1.4;

/** The most you can craft in one go. */
export const BULK_MAX = 10;
/** The most materials a recipe takes (crafting-screen.md §4.3: the detail has a slot for each). */
export const MAX_NEEDS = 4;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const one = (id: ItemId, n: number): Need => ({ any: [id], n, label: itemDef(id).name, icon: id });

export const RECIPES: readonly Recipe[] = [
  { id: 'planks', out: 'planks', yield: 4, needs: [one('log', 1)], line: 'Split a log into four smooth planks.' },
  { id: 'beam', out: 'beam', yield: 1, needs: [one('log', 2)], line: 'Two logs, squared off into one sturdy beam.' },
  { id: 'slab', out: 'slab', yield: 1, needs: [one('stone', 2)], line: 'Two stones, chiselled flat into a slab.' },
  { id: 'rope', out: 'rope', yield: 1, needs: [one('jute', 3)], line: 'Twist three bundles of jute into a strong rope.' },
  { id: 'block', out: 'block', yield: 1, needs: [one('stone', 3)], line: 'Three stones, chiselled square into one solid building block.' },
  { id: 'firewood', out: 'firewood', yield: 3, needs: [one('log', 1)], line: 'Split a log into three sticks of firewood for the furnace.' },
  { id: 'nails', out: 'nails', yield: 6, needs: [one('ingot', 1)], line: 'Hammer an iron ingot, smelted at the furnace, into six sturdy nails.' },
  ...BLOOM_COLOURS.map(
    (c): Recipe => ({
      id: `paint-${c.name}`,
      out: `paint-${c.name}` as PaintId,
      yield: 1,
      needs: [{ any: FLOWER_ITEM_KINDS.map((k) => `${k}-${c.name}` as ItemId), n: 3, label: `${cap(c.name)} flowers (any kind)`, icon: `tulip-${c.name}` as ItemId }],
      line: `Crush three ${c.name} flowers (tulips, cosmos or pansies) into a pot of paint.`,
    }),
  ),
];

/** The furnace's recipes (furnace.md §4.5): iron ore and a stick of firewood into an ingot. */
export const SMELTING: readonly Recipe[] = [{ id: 'ingot', out: 'ingot', yield: 1, needs: [one('iron', 1), one('firewood', 1)], line: 'Melt a lump of iron ore over burning firewood into a bar of iron.' }];

export const recipeById = (id: string): Recipe | undefined => [...RECIPES, ...SMELTING].find((r) => r.id === id);

/** How many of an ingredient the backpack holds. */
export const haveOf = (inv: Inventory, need: Need): number => need.any.reduce((s, id) => s + inv.count(id), 0);

/** Which items to take for `k` crafts: from whichever of the options there's most of first. */
export function takePlan(inv: Inventory, r: Recipe, k: number): Array<[ItemId, number]> | null {
  const out: Array<[ItemId, number]> = [];
  for (const need of r.needs) {
    let left = need.n * k;
    const opts = need.any.map((id) => [id, inv.count(id)] as const).sort((a, b) => b[1] - a[1]);
    for (const [id, have] of opts) {
      if (left <= 0) break;
      const t = Math.min(have, left);
      if (t > 0) out.push([id, t]);
      left -= t;
    }
    if (left > 0) return null;
  }
  return out;
}

/** Take `n` of an item out of a copy of the slots (the same order as `Inventory.remove`). */
function takeFrom(slots: Slot[], id: ItemId, n: number): void {
  for (let i = slots.length - 1; i >= 0 && n > 0; i--) {
    const s = slots[i];
    if (!s || s.id !== id) continue;
    const k = Math.min(s.n, n);
    n -= k;
    slots[i] = s.n - k > 0 ? { id, n: s.n - k } : null;
  }
}

/** Would `k` crafts' results fit once their materials have gone? */
export function fits(inv: Inventory, r: Recipe, k: number): boolean {
  const plan = takePlan(inv, r, k);
  if (!plan) return false;
  const slots = inv.backpack.map((s) => (s ? { ...s } : null));
  for (const [id, n] of plan) takeFrom(slots, id, n);
  return roomFor(slots, r.out, k * r.yield) >= k * r.yield;
}

/** How many you could make with what's in the backpack (ignoring room), up to BULK_MAX. */
export function byMaterials(inv: Inventory, r: Recipe): number {
  return Math.min(BULK_MAX, ...r.needs.map((need) => Math.floor(haveOf(inv, need) / need.n)));
}

/** How many you can make right now: capped by the materials and by room for the result. */
export function maxCraftable(inv: Inventory, r: Recipe): number {
  let k = byMaterials(inv, r);
  while (k > 0 && !fits(inv, r, k)) k--;
  return k;
}

/**
 * Craft `k`: the materials leave the backpack and the results go in. Returns how many were made
 * and how many didn't fit (the caller drops those at the character's feet), or null if it can't.
 */
export function craft(inv: Inventory, r: Recipe, k: number): { made: number; left: number } | null {
  if (k < 1 || k > byMaterials(inv, r)) return null;
  const plan = takePlan(inv, r, k);
  if (!plan) return null;
  for (const [id, n] of plan) inv.remove(id, n);
  const made = k * r.yield;
  return { made, left: inv.add(r.out, made) };
}

/**
 * Where a craft's results went (crafting-screen.md §4.3): the backpack slots that gained `id` between
 * `before` and `after`, the most first (at most `max`), for the landing animation.
 */
export function landedSlots(before: readonly Slot[], after: readonly Slot[], id: ItemId, max = 3): Array<{ i: number; n: number }> {
  const out: Array<{ i: number; n: number }> = [];
  after.forEach((s, i) => {
    const was = before[i]?.id === id ? before[i]!.n : 0;
    if (s?.id === id && s.n > was) out.push({ i, n: s.n - was });
  });
  return out.sort((a, b) => b.n - a.n || a.i - b.i).slice(0, max);
}

// ---------- Chopper's house (§4.3) ----------

export const HOUSE_NEEDS: ReadonlyArray<{ id: ItemId; n: number }> = [
  { id: 'slab', n: 2 },
  { id: 'beam', n: 2 },
  { id: 'planks', n: 4 },
  { id: 'nails', n: 6 },
];

/** The swing under the old oak's branch (swing.md §4.4). */
export const SWING_NEEDS: ReadonlyArray<{ id: ItemId; n: number }> = [
  { id: 'rope', n: 2 },
  { id: 'planks', n: 3 },
];

export type Needs = ReadonlyArray<{ id: ItemId; n: number }>;

/** The viewing deck's three builds (viewing-deck.md §4): the lower steps, the upper steps, the platform. */
export const DECK_NEEDS: readonly Needs[] = [
  [
    { id: 'slab', n: 4 },
    { id: 'planks', n: 6 },
    { id: 'beam', n: 3 },
    { id: 'nails', n: 12 },
  ],
  [
    { id: 'slab', n: 2 },
    { id: 'planks', n: 6 },
    { id: 'beam', n: 2 },
    { id: 'nails', n: 12 },
  ],
  [
    { id: 'planks', n: 8 },
    { id: 'beam', n: 4 },
    { id: 'nails', n: 18 },
  ],
];

/** The furnace behind the workyard (furnace.md §4.4). */
export const FURNACE_NEEDS: Needs = [
  { id: 'block', n: 6 },
  { id: 'clay', n: 4 },
];
/** The built furnace's collision radius (u). */
export const FURNACE_R = FURNACE_RADIUS;
/** It stays warm this long (s) after smelting, cooling as it goes. */
export const FURNACE_COOL_S = 25;

/** What's still short for a build (the house by default; empty when you can build it). */
export function missing(inv: Inventory, needs: Needs = HOUSE_NEEDS): Array<{ id: ItemId; n: number; have: number }> {
  return needs.map((x) => ({ ...x, have: inv.count(x.id) })).filter((x) => x.have < x.n);
}

/** Take a build's materials. False (and nothing taken) if anything's short. */
export function takeNeeds(inv: Inventory, needs: Needs): boolean {
  if (missing(inv, needs).length) return false;
  for (const x of needs) inv.remove(x.id, x.n);
  return true;
}

/** "2 stone slabs and 4 planks" (how many more of each). */
export function listNeeds(items: ReadonlyArray<{ id: ItemId; n: number; have?: number }>): string {
  const names = items.map((x) => {
    const n = x.n - (x.have ?? 0);
    const name = itemDef(x.id).name.toLowerCase();
    return `${n} ${n === 1 || /(s|ore|clay|wood)$/.test(name) ? name : `${name}s`}`;
  });
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Take the house's materials. False (and nothing taken) if anything's short. */
export function takeHouse(inv: Inventory): boolean {
  return takeNeeds(inv, HOUSE_NEEDS);
}

/** The ghost: faint from this far (u)… (a hint of what could be built, not a sign it's ready to use: that's the target ring) */
export const GHOST_FAR = 6;
/** …clear from this close. */
export const GHOST_NEAR = 2;
/** The build moment (s): knocks, the house rising, a sparkle. */
export const BUILD_S = 2.2;
/** The hammering when you craft (s). */
export const CRAFT_S = 0.6;
/** Collision radius of the built house (u). */
export const HOUSE_R = 0.62;

/** From how far (u, past their edge) the crafting table and the house's site offer their prompt. */
export const TARGET_REACH = { table: 0.95, site: 1.0 } as const;

export type HouseColour = 'original' | BloomColour;

/** Roof and trim colours: the default red, and a slightly deeper shade of each paint. */
export const HOUSE_HEX: Record<HouseColour, string> = {
  original: '#c4523f',
  red: '#e0474f',
  pink: '#ef8fb6',
  yellow: '#f2c94c',
  white: '#f1ede4',
  orange: '#ef8a3a',
  purple: '#9a7ee0',
  blue: '#5c95e0',
};

export const colourName = (c: HouseColour): string => (c === 'original' ? 'Original red' : cap(c));

/** The palette: Original red (free) and every paint colour, with how many pots of it you have. */
export function paintOptions(inv: Inventory): Array<{ colour: HouseColour; pots: number }> {
  return [{ colour: 'original' as HouseColour, pots: Infinity }, ...BLOOM_COLOURS.map((c) => ({ colour: c.name as HouseColour, pots: inv.count(`paint-${c.name}` as PaintId) }))];
}

/** Paint the house: a pot of that paint is used (Original red is free). False if there's no pot. */
export function spendPaint(inv: Inventory, c: HouseColour): boolean {
  if (c === 'original') return true;
  return inv.remove(`paint-${c}` as PaintId, 1);
}

export interface SiteState {
  built: boolean;
  colour: HouseColour;
}

export function parseSite(raw: unknown): SiteState {
  const o = raw && typeof raw === 'object' ? (raw as Partial<SiteState>) : {};
  return { built: o.built === true, colour: typeof o.colour === 'string' && o.colour in HOUSE_HEX ? o.colour : 'original' };
}
