/** Item registry (docs: documentation/poc-3d-navigation/collection-inventory.md §1). */

export const FLOWER_ITEM_KINDS = ['tulip', 'cosmos', 'pansy'] as const;
export type FlowerItemKind = (typeof FLOWER_ITEM_KINDS)[number];

/** The planet's bloom colours, in the order `Props.tsx` indexes them by an instance's tint. */
export const BLOOM_COLOURS = [
  { name: 'red', hex: '#ff5a6a' },
  { name: 'pink', hex: '#ff9ec4' },
  { name: 'yellow', hex: '#ffd84d' },
  { name: 'white', hex: '#ffffff' },
  { name: 'orange', hex: '#ff9a4d' },
  { name: 'purple', hex: '#a98cff' },
  { name: 'blue', hex: '#7fb2ff' },
] as const;
export type BloomColour = (typeof BLOOM_COLOURS)[number]['name'];

export type FlowerItemId = `${FlowerItemKind}-${BloomColour}`;
export type PaintId = `paint-${BloomColour}`;
export type ItemId = 'log' | 'leaves' | 'apple' | 'orange' | 'stone' | 'iron' | 'jute' | 'clay' | 'planks' | 'beam' | 'slab' | 'rope' | 'nails' | 'block' | 'firewood' | 'ingot' | 'lantern' | FlowerItemId | PaintId;

export interface ItemDef {
  id: ItemId;
  name: string;
  maxStack: number;
  /** Key into the icon manifest (`iconManifest.ts`). */
  icon: string;
  /** Model the world drop uses (`world/Drops.tsx`), and its tint. */
  model: 'log' | 'leaves' | 'fruit' | 'stone' | FlowerItemKind;
  tint: string;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const BASE: ItemDef[] = [
  { id: 'log', name: 'Wood log', maxStack: 64, icon: 'log', model: 'log', tint: '#b07a48' },
  { id: 'leaves', name: 'Leaves', maxStack: 64, icon: 'leaves', model: 'leaves', tint: '#6fbf4a' },
  { id: 'apple', name: 'Apple', maxStack: 64, icon: 'apple', model: 'fruit', tint: '#e8453c' },
  { id: 'orange', name: 'Orange', maxStack: 64, icon: 'orange', model: 'fruit', tint: '#ff9a2e' },
  { id: 'stone', name: 'Stone', maxStack: 64, icon: 'stone', model: 'stone', tint: '#9a978f' },
  // mined from the rust-streaked boulders (viewing-deck.md)
  { id: 'iron', name: 'Iron ore', maxStack: 64, icon: 'iron', model: 'stone', tint: '#8a5440' },
  // picked from the jute row behind the vegetable garden (swing.md)
  { id: 'jute', name: 'Jute', maxStack: 64, icon: 'jute', model: 'leaves', tint: '#d9b86a' },
  // dug from the clay beds on the banks of the stream and the pond (furnace.md)
  { id: 'clay', name: 'Clay', maxStack: 64, icon: 'clay', model: 'stone', tint: '#b5aa9c' },
  // crafted at the crafting table (crafting.md)
  { id: 'planks', name: 'Planks', maxStack: 64, icon: 'planks', model: 'log', tint: '#d9b27c' },
  { id: 'beam', name: 'Wooden beam', maxStack: 64, icon: 'beam', model: 'log', tint: '#b8844f' },
  { id: 'slab', name: 'Stone slab', maxStack: 64, icon: 'slab', model: 'stone', tint: '#b9b5ab' },
  { id: 'rope', name: 'Jute rope', maxStack: 64, icon: 'rope', model: 'log', tint: '#c09050' },
  { id: 'nails', name: 'Nails', maxStack: 64, icon: 'nails', model: 'stone', tint: '#b8c0c8' },
  // the furnace (furnace.md): stone blocks and firewood from the crafting table, iron ingots from the furnace
  { id: 'block', name: 'Stone block', maxStack: 64, icon: 'block', model: 'stone', tint: '#a8a397' },
  { id: 'firewood', name: 'Firewood', maxStack: 64, icon: 'firewood', model: 'log', tint: '#a0713f' },
  { id: 'ingot', name: 'Iron ingot', maxStack: 64, icon: 'ingot', model: 'stone', tint: '#95a1ad' },
  // the visitor's hand lantern (rest.md): held while it's the selected hotbar slot, it lights the way at night
  { id: 'lantern', name: 'Lantern', maxStack: 1, icon: 'lantern', model: 'stone', tint: '#e0a64a' },
];

const FLOWERS: ItemDef[] = FLOWER_ITEM_KINDS.flatMap((k) =>
  BLOOM_COLOURS.map((c) => {
    const id = `${k}-${c.name}` as FlowerItemId;
    return { id, name: `${cap(c.name)} ${k}`, maxStack: 64, icon: id, model: k, tint: c.hex };
  }),
);

const PAINTS: ItemDef[] = BLOOM_COLOURS.map((c) => ({ id: `paint-${c.name}` as PaintId, name: `${cap(c.name)} paint`, maxStack: 64, icon: `paint-${c.name}`, model: 'fruit', tint: c.hex }));

export const ITEMS: ReadonlyMap<ItemId, ItemDef> = new Map([...BASE, ...FLOWERS, ...PAINTS].map((d) => [d.id, d]));
export const ITEM_IDS: readonly ItemId[] = [...ITEMS.keys()];

export const isItemId = (s: unknown): s is ItemId => typeof s === 'string' && ITEMS.has(s as ItemId);
export const itemDef = (id: ItemId): ItemDef => ITEMS.get(id)!;
export const maxStack = (id: ItemId): number => ITEMS.get(id)?.maxStack ?? 64;

/** The flower item for a planted flower of `kind` whose tint picks bloom colour `colourIndex`. */
export const flowerItem = (kind: FlowerItemKind, colourIndex: number): FlowerItemId =>
  `${kind}-${BLOOM_COLOURS[((colourIndex % BLOOM_COLOURS.length) + BLOOM_COLOURS.length) % BLOOM_COLOURS.length].name}` as FlowerItemId;

/** "Apple, 5"-style label for announcements and slot names. */
export const stackLabel = (id: ItemId, n: number): string => `${itemDef(id).name}, ${n}`;
