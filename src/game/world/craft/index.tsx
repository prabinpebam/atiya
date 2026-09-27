/**
 * The crafting chunk (docs: crafting.md): the crafting table, Chopper's house (its ghost, the
 * build, the paint) and their screens. Loaded alongside the textures (`game-mount.tsx`) and
 * attached to the controller before the scene mounts.
 */
import { createStore } from 'zustand/vanilla';
import type { CraftAttachment, GameController } from '../../controller';
import { CONFIG } from '../../config';
import { arcDistance, clamp, moveAlong, tangentToward } from '../../math/sphere';
import { faBone, faPaintRoller, faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import { selectReducedMotion } from '../../state/store';
import { itemDef, type ItemId } from '../../inventory/items';
import { HOTBAR } from '../../inventory/inventory';
import { CRAFT_RADIUS } from '../layout';
import { BED_U, DOGHOUSE, DOORWAY_U } from './models';
import { BUILD_S, CRAFT_S, GHOST_FAR, GHOST_NEAR, HOUSE_R, TARGET_REACH, colourName, craft, landedSlots, listNeeds, missing, parseSite, spendPaint, takeHouse, type HouseColour, type Recipe } from './recipes';
import { CraftView } from './CraftView';
import { CraftScreens } from './ui';

const KEY = 'site.dogHouse';
const KNOCKS = [0.15, 0.5, 0.85];

export interface CraftState {
  built: boolean;
  colour: HouseColour;
  /** Seconds into the build moment (null when not building). */
  building: number | null;
  /** The site card is up. */
  near: boolean;
  /** Hammering away at a recipe (the crafting screen's progress). */
  crafting: { recipe: Recipe; k: number; t: number } | null;
  /** The last craft's results: which backpack slots they went to (the screen's landing animation). */
  landed: { id: ItemId; slots: Array<{ i: number; n: number }> } | null;
}

export type CraftStore = ReturnType<typeof makeStore>;

const makeStore = (init: CraftState) => createStore<CraftState>()(() => init);

function load(): { built: boolean; colour: HouseColour } {
  try {
    return parseSite(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return parseSite(null);
  }
}

function save(s: { built: boolean; colour: HouseColour }): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ built: s.built, colour: s.colour }));
  } catch {
    // private mode: it just won't be remembered
  }
}

/** What the crafting screens and the scene need from the chunk. */
export interface Crafting {
  store: CraftStore;
  /** The ghost's visibility, 0 (far) … 1 (close); 0 once built. */
  ghost: number;
  /** Craft `k` of a recipe (after the hammering). */
  startCraft(r: Recipe, k: number): void;
  /** Paint the house (a pot of paint; Original red is free). */
  paint(c: HouseColour): void;
}

export function attachCraft(controller: GameController): CraftAttachment | null {
  const R = CONFIG.planetRadius;
  const site = controller.props.home?.dogHouse ?? null;
  const saved = load();
  const store = makeStore({ built: Boolean(site) && saved.built, colour: saved.colour, building: null, near: false, crafting: null, landed: null });
  const inv = controller.inventory;

  // where Chopper stands to go in (outside the doorway), and where he sits inside on his bed, facing out
  const door = site ? moveAlong(site.n, site.facing, DOORWAY_U / R) : null;
  const inside = site ? moveAlong(site.n, site.facing, BED_U / R) : null;
  const doorFacing = site && door ? (tangentToward(door, moveAlong(site.n, site.facing, 3 / R)) ?? site.facing.clone()) : null;
  const houseUp = () => {
    if (!site || !door || !doorFacing || !inside) return;
    controller.addObstacle({ n: site.n, radiusU: HOUSE_R });
    controller.dogWorld.house = { n: site.n, door, inside, facing: doorFacing, floor: DOGHOUSE.base };
  };
  if (store.getState().built) houseUp();

  const persist = () => save(store.getState());

  const crafting: Crafting = {
    store,
    ghost: 0,
    startCraft(r, k) {
      if (store.getState().crafting) return;
      store.setState({ crafting: { recipe: r, k, t: 0 } });
      controller.sound.hit();
    },
    paint(c) {
      if (!store.getState().built) return;
      if (!spendPaint(inv, c)) {
        controller.showToast(`You don't have any ${colourName(c).toLowerCase()} paint yet. Make some at the crafting table.`);
        return;
      }
      store.setState({ colour: c });
      persist();
      controller.invChanged();
      controller.sound.pickup();
      controller.announce(c === 'original' ? "Chopper's house is back to its original red." : `Chopper's house is ${colourName(c).toLowerCase()} now. He approves.`);
      controller.closeCraft();
    },
  };

  const finishCraft = (r: Recipe, k: number) => {
    const before = inv.backpack.map((s) => (s ? { ...s } : null));
    const res = craft(inv, r, k);
    if (!res) {
      controller.showToast(`Not enough materials for ${itemDef(r.out).name.toLowerCase()} now. Check your backpack.`);
      return;
    }
    if (res.left > 0) controller.throwStack({ id: r.out, n: res.left }, false);
    const slots = landedSlots(before, inv.backpack, r.out);
    store.setState({ landed: { id: r.out, slots } });
    controller.invChanged();
    controller.sound.pickup();
    const name = itemDef(r.out).name.toLowerCase();
    const made = `${res.made} ${res.made === 1 || name.endsWith('s') ? name : `${name}s`}`;
    const where = slots.length === 1 && slots[0].i < HOTBAR ? `in hotbar slot ${slots[0].i + 1}` : 'in your backpack';
    controller.announce(res.left ? `Crafted ${made}; ${res.left} dropped at your feet: your backpack is full.` : `Crafted ${made}: ${where}.`);
  };

  const build = () => {
    if (!site || !takeHouse(inv)) return;
    controller.invChanged();
    store.setState({ built: true, building: 0 });
    persist();
    // step back out of its footprint, then it goes up
    const p = controller.sim.pLocal;
    if (arcDistance(p, site.n, R) < HOUSE_R + CONFIG.playerRadius + 0.05) {
      const out = tangentToward(site.n, p) ?? site.facing;
      controller.sim.placeAt(moveAlong(site.n, out, (HOUSE_R + CONFIG.playerRadius + 0.1) / R));
    }
    houseUp();
    controller.chopper.visitHouse(true);
    controller.announce("You build Chopper's house! Here he comes to try it out.");
    controller.refreshTarget();
  };

  // the crafting table and the house's site are targets that answer for themselves (their prompt, E, the icon)
  const table = controller.props.craft;
  if (table)
    controller.targets.push({
      kind: 'craft',
      key: 'craft',
      n: table.n,
      edgeU: CRAFT_RADIUS,
      reachU: TARGET_REACH.table,
      standU: CRAFT_RADIUS + 0.45,
      index: 0,
      facing: table.facing,
      scale: 1,
      use: () => controller.openCraft('table'),
      icon: () => faScrewdriverWrench,
    });
  if (site)
    controller.targets.push({
      kind: 'site',
      key: 'site',
      n: site.n,
      edgeU: HOUSE_R,
      reachU: TARGET_REACH.site,
      standU: 1.1,
      index: 0,
      facing: site.facing,
      scale: 1,
      label() {
        const s = store.getState();
        if (s.built) return "Paint Chopper's house";
        return missing(inv).length ? "See what Chopper's house needs" : "Build Chopper's house";
      },
      use() {
        const s = store.getState();
        if (s.building !== null) return;
        if (s.built) {
          controller.openCraft('paint');
          return;
        }
        const miss = missing(inv);
        if (miss.length) {
          controller.showToast(`Chopper's house still needs ${listNeeds(miss)}. Craft them at the crafting table by the Workshop.`);
          return;
        }
        build();
      },
      icon: () => (store.getState().built ? faPaintRoller : faBone),
    });

  return {
    View: () => <CraftView controller={controller} crafting={crafting} />,
    Screens: () => <CraftScreens controller={controller} crafting={crafting} />,
    step(dt) {
      const s = store.getState();
      const g = controller.store.getState();
      const reduced = selectReducedMotion(g);
      // the ghost, by how close you are; the site card only while the site is what E would use (its prompt
      // is up), so it never shows for the garden or the home beside it
      const d = site ? arcDistance(controller.sim.pLocal, site.n, R) : Infinity;
      crafting.ghost = s.built ? 0 : clamp((GHOST_FAR - d) / (GHOST_FAR - GHOST_NEAR), 0, 1);
      const near = Boolean(site) && !s.built && g.target?.key === 'site' && g.phase === 'playing' && !g.traveling && !g.openId && !g.craftScreen && !g.invScreen && !g.talk && !g.chopperOpen;
      if (near !== s.near) store.setState({ near });
      if (near !== g.siteNear) controller.store.setState({ siteNear: near });
      if (s.building !== null) {
        const t = reduced ? BUILD_S : s.building + dt;
        for (const k of KNOCKS) if (s.building < k && t >= k && !reduced) controller.sound.hit();
        if (t >= BUILD_S) {
          store.setState({ building: null });
          controller.sound.pickup();
        } else store.setState({ building: t });
      }
      if (s.crafting) {
        const t = s.crafting.t + dt;
        if (t >= CRAFT_S) {
          store.setState({ crafting: null });
          finishCraft(s.crafting.recipe, s.crafting.k);
        } else store.setState({ crafting: { ...s.crafting, t } });
      }
    },
    state() {
      const s = store.getState();
      return { built: s.built, colour: s.colour, building: s.building !== null, ghost: crafting.ghost, near: s.near };
    },
  };
}
