/**
 * The gallery's sample data (documentation/game-ui/design-system.md §9.1): a stand-in controller and crafting
 * chunk that the real components render from, with a real store and a real inventory, so what the gallery
 * shows is exactly what the game draws. Development and test builds only (integrations/game-gallery.mjs).
 */
import { createStore } from 'zustand/vanilla';
import type { GameController } from '../controller';
import type { Crafting } from '../world/craft/index';
import { createGameStore, type GameState } from '../state/store';
import { Inventory } from '../inventory/inventory';
import type { ItemId } from '../inventory/items';
import { PLACES } from '../world/places';
import type { LandmarkData } from '../types';

/** The seven buildings with made-up words (the real ones are content: the gallery never reads it). */
const WORDS: Record<string, [string, string]> = {
  workshop: ['Workshop', 'Tools and making'],
  'town-hall': ['Town hall', 'Talks and community'],
  lighthouse: ['Lighthouse', 'Leading the way'],
  library: ['Library', 'Writing and research'],
  amphitheater: ['Amphitheater', 'Stage and speaking'],
  greenhouse: ['Greenhouse', 'Growing things'],
  'post-office': ['Post office', 'Get in touch'],
};

/** Sample buildings, from the world's places and the words above. */
export const SAMPLE_LANDMARKS: LandmarkData[] = PLACES.map((p) => ({
  ...p,
  title: WORDS[p.id]?.[0] ?? p.id,
  kicker: WORDS[p.id]?.[1] ?? '',
  summary: 'A sample summary: what this building holds, in a sentence or two.',
  pages: p.id === 'greenhouse' ? [] : [{ id: 'sample', title: 'A sample page', href: '#sample' }],
  siteHref: '#classic',
}));

const BACKPACK: ReadonlyArray<readonly [number, ItemId, number]> = [
  [0, 'log', 12],
  [1, 'apple', 3],
  [2, 'stone', 30],
  [3, 'planks', 8],
  [4, 'lantern', 1],
  [6, 'rope', 2],
  [9, 'leaves', 40],
  [10, 'clay', 5],
  [11, 'iron', 4],
  [12, 'ingot', 2],
  [14, 'nails', 16],
  [20, 'jute', 7],
  [27, 'orange', 1],
];

/** A backpack with a little of everything, and a chest with a few stacks. */
export function sampleInventory(): Inventory {
  const inv = new Inventory();
  for (const [i, id, n] of BACKPACK) inv.backpack[i] = { id, n };
  inv.chest[0] = { id: 'log', n: 64 };
  inv.chest[1] = { id: 'slab', n: 6 };
  inv.chest[4] = { id: 'beam', n: 3 };
  inv.selected = 1;
  return inv;
}

/**
 * A stand-in for the game's controller: a real store (`state` over the defaults, playing), a real inventory
 * and the sample buildings; every action is a no-op, so a press changes nothing but the component's own state.
 */
export function sampleController(state: Partial<GameState> = {}, extra: Record<string, unknown> = {}): GameController {
  const base: Record<string | symbol, unknown> = {
    store: createGameStore({ phase: 'playing', loadTier: 'complete', ...state }),
    inventory: sampleInventory(),
    landmarks: SAMPLE_LANDMARKS,
    dataById: new Map(SAMPLE_LANDMARKS.map((l) => [l.id, l])),
    timeOfDay: 9.5,
    timeHeld: false,
    talkTyping: false,
    targets: [],
    seatMotion: { seat: null },
    fadeEl: { current: null },
    hudActions: null,
    craft: null,
    home: null,
    touch: null,
    openPage: null,
    northAngle: () => 0.35,
    isAtSpawn: () => false,
    classicHref: () => '#classic',
    ...extra,
  };
  const noop = () => undefined;
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop) }) as unknown as GameController;
}

/** A stand-in for the crafting chunk: its store (`near`: a build site's card), and actions that do nothing. */
export function sampleCrafting(near: 'house' | null = null): Crafting {
  const store = createStore(() => ({ near, colour: 'original', crafting: null, landed: null, built: false }));
  return { store, ghost: 0, swingGhost: 0, swing: null, jute: { left: [], version: 0 }, startCraft: () => undefined, paint: () => undefined } as unknown as Crafting;
}
