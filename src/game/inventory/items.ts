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
export type ItemId = 'log' | 'leaves' | 'apple' | 'orange' | 'stone' | FlowerItemId;

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
];

const FLOWERS: ItemDef[] = FLOWER_ITEM_KINDS.flatMap((k) =>
  BLOOM_COLOURS.map((c) => {
    const id = `${k}-${c.name}` as FlowerItemId;
    return { id, name: `${cap(c.name)} ${k}`, maxStack: 64, icon: id, model: k, tint: c.hex };
  }),
);

export const ITEMS: ReadonlyMap<ItemId, ItemDef> = new Map([...BASE, ...FLOWERS].map((d) => [d.id, d]));
export const ITEM_IDS: readonly ItemId[] = [...ITEMS.keys()];

export const isItemId = (s: unknown): s is ItemId => typeof s === 'string' && ITEMS.has(s as ItemId);
export const itemDef = (id: ItemId): ItemDef => ITEMS.get(id)!;
export const maxStack = (id: ItemId): number => ITEMS.get(id)?.maxStack ?? 64;

/** The flower item for a planted flower of `kind` whose tint picks bloom colour `colourIndex`. */
export const flowerItem = (kind: FlowerItemKind, colourIndex: number): FlowerItemId =>
  `${kind}-${BLOOM_COLOURS[((colourIndex % BLOOM_COLOURS.length) + BLOOM_COLOURS.length) % BLOOM_COLOURS.length].name}` as FlowerItemId;

/** "Apple, 5"-style label for announcements and slot names. */
export const stackLabel = (id: ItemId, n: number): string => `${itemDef(id).name}, ${n}`;
