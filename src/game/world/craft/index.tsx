/**
 * The crafting chunk (docs: crafting.md, swing.md): the crafting table, Chopper's house (its ghost,
 * the build, the paint), the old oak's swing (its ghost, the build; riding it and pushing whoever's on it), the jute row behind
 * the vegetable garden, and their screens. Loaded alongside the textures (`game-mount.tsx`) and
 * attached to the controller before the scene mounts.
 */
import { createStore } from 'zustand/vanilla';
import type { CraftAttachment, GameController } from '../../controller';
import { CONFIG } from '../../config';
import { arcDistance, clamp, moveAlong, tangentToward } from '../../math/sphere';
import { faBone, faChair, faChildReaching, faHand, faPaintRoller, faScissors, faScrewdriverWrench, faTree } from '@fortawesome/free-solid-svg-icons';
import { selectAmbientPaused, selectReducedMotion } from '../../state/store';
import { itemDef, type ItemId } from '../../inventory/items';
import { HOTBAR } from '../../inventory/inventory';
import type { Target } from '../../systems/interactables';
import type { Seat } from '../../systems/seating';
import type { SwingPlace } from '../home/family';
import { CRAFT_RADIUS } from '../layout';
import { HOME_R, SWING } from '../homestead';
import { Pendulum, swingFrame, type SwingFrame } from './swing';
import { SWING_RIG } from './swingModels';
import { BED_U, DOGHOUSE, DOORWAY_U } from './models';
import { BUILD_S, CRAFT_S, GHOST_FAR, GHOST_NEAR, HOUSE_R, SWING_NEEDS, TARGET_REACH, colourName, craft, landedSlots, listNeeds, missing, parseSite, spendPaint, takeHouse, takeNeeds, type HouseColour, type Recipe } from './recipes';
import { CraftView } from './CraftView';
import { SwingView } from './SwingView';
import { CraftScreens } from './ui';

const KEY = 'site.dogHouse';
const SWING_KEY = 'site.swing';
const KNOCKS = [0.15, 0.5, 0.85];
/** A picked jute plant grows back after this long (s), and gives this many bundles (swing.md §4.2). */
export const JUTE = { regrow: 90, yield: 2, reach: 0.8 } as const;

export interface CraftState {
  built: boolean;
  colour: HouseColour;
  /** Seconds into the build moment (null when not building). */
  building: number | null;
  /** The site card is up, and for which site. */
  near: 'house' | 'swing' | null;
  swingBuilt: boolean;
  /** Seconds into the swing's build (null when not building). */
  swingBuilding: number | null;
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

function loadSwing(): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SWING_KEY) ?? 'null') as { built?: unknown } | null)?.built === true;
  } catch {
    return false;
  }
}

function saveSwing(): void {
  try {
    localStorage.setItem(SWING_KEY, JSON.stringify({ built: true }));
  } catch {
    // private mode: it just won't be remembered
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
  /** The same for the swing's ghost. */
  swingGhost: number;
  /** The swing's frame (from the ground under its seat) and its pendulum; null without a home. */
  swing: { frame: SwingFrame; pendulum: Pendulum } | null;
  /** Each jute plant's seconds until it's grown back (0: ready to pick), and a counter bumped on every change. */
  jute: { left: number[]; version: number };
  /** Craft `k` of a recipe (after the hammering). */
  startCraft(r: Recipe, k: number): void;
  /** Paint the house (a pot of paint; Original red is free). */
  paint(c: HouseColour): void;
}

export function attachCraft(controller: GameController): CraftAttachment | null {
  const R = CONFIG.planetRadius;
  const site = controller.props.home?.dogHouse ?? null;
  const saved = load();
  const home = controller.props.home;
  const swingSaved = loadSwing();
  const store = makeStore({ built: Boolean(site) && saved.built, colour: saved.colour, building: null, near: null, swingBuilt: Boolean(home) && swingSaved, swingBuilding: null, crafting: null, landed: null });
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

  const swingAt = home
    ? swingFrame(home.tree, home.swingLimb, controller.terrain.height(home.tree), home.swing, controller.terrain.height(home.swing.n), R, SWING.out, SWING_RIG.branchY, SWING_RIG.seatY)
    : null;
  const swingUp = () => home && controller.addObstacle({ n: home.swing.n, radiusU: HOME_R.swing });
  if (store.getState().swingBuilt) swingUp();

  const pendulum = swingAt ? new Pendulum(swingAt.length) : null;
  // the swing, shared with the family (they ride it too, one at a time: swing.md §6)
  const link: SwingPlace | null =
    home && swingAt && pendulum
      ? {
          seat: home.swing,
          built: () => store.getState().swingBuilt && store.getState().swingBuilding === null,
          rider: null,
          boarding: false,
          get a() {
            return pendulum.a;
          },
          get w() {
            return pendulum.w;
          },
          pivot: swingAt.pivot.y,
          pump: (k = 1) => pendulum.pump(k),
        }
      : null;
  controller.swing = link;
  // the visitor's seat on it: sit on the plank, facing the pond; E pumps, Escape gets off in front
  const riderSeat: Seat | null =
    home && link
      ? {
          id: 'swing',
          n: home.swing.n.clone(),
          facing: home.swing.facing.clone(),
          sit: home.swing.n.clone(),
          stand: moveAlong(home.swing.n, home.swing.facing, 0.75 / R),
          byPond: false,
          height: controller.terrain.height(home.swing.n) + SWING.seatY + SWING.seatT / 2,
          action: { label: 'Swing higher', icon: faChildReaching, run: () => link.pump(1) },
        }
      : null;

  const crafting: Crafting = {
    store,
    ghost: 0,
    swingGhost: 0,
    swing: swingAt && pendulum ? { frame: swingAt, pendulum } : null,
    jute: { left: (home?.yard.jute ?? []).map(() => 0), version: 0 },
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

  const buildSwing = () => {
    if (!home || !takeNeeds(inv, SWING_NEEDS)) return;
    controller.invChanged();
    store.setState({ swingBuilt: true, swingBuilding: 0 });
    saveSwing();
    // step out from under it, then it drops down from the branch
    const p = controller.sim.pLocal;
    if (arcDistance(p, home.swing.n, R) < HOME_R.swing + CONFIG.playerRadius + 0.05) {
      const out = tangentToward(home.swing.n, p) ?? home.swing.facing;
      controller.sim.placeAt(moveAlong(home.swing.n, out, (HOME_R.swing + CONFIG.playerRadius + 0.1) / R));
    }
    swingUp();
    controller.announce("You build the swing! It's ready for a push.");
    controller.refreshTarget();
  };
  let pushed = 0;
  const pushSwing = () => {
    const sw = crafting.swing;
    if (!sw || !home) return;
    // away from where you stand: from its front you push it back, from behind you push it forward
    const rel = controller.sim.pLocal.clone().multiplyScalar(R).sub(home.swing.n.clone().multiplyScalar(R));
    sw.pendulum.push(rel.dot(sw.frame.z) > 0 ? 1 : -1, selectReducedMotion(controller.store.getState()) ? 0.6 : 1);
    controller.sound.rustle();
    if (pushed++ === 0) controller.announce('You push the swing. Wheee!');
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

  if (home) {
    const sw = home.swing;
    const swingTarget: Target = {
      kind: 'site',
      key: 'site:swing',
      n: sw.n,
      edgeU: HOME_R.swing,
      reachU: TARGET_REACH.site,
      standU: 0.9,
      index: 0,
      facing: sw.facing,
      scale: 1,
      label() {
        const s = store.getState();
        // someone's on it: push them; nobody is: sit on it
        if (s.swingBuilt) return link?.rider ? 'Push the swing' : 'Sit on the swing';
        return missing(inv, SWING_NEEDS).length ? 'See what the swing needs' : 'Build the swing';
      },
      // (while someone's getting on or off, it's theirs)
      usable: () => !link?.boarding,
      use() {
        const s = store.getState();
        if (s.swingBuilding !== null) return;
        if (s.swingBuilt) {
          if (link?.rider) controller.startAction('open', swingTarget);
          else if (riderSeat && controller.sitOn(riderSeat, 'On the swing. Press E to swing higher, or Escape to get off.') && link) {
            link.rider = 'visitor';
            link.boarding = true;
          }
          return;
        }
        const miss = missing(inv, SWING_NEEDS);
        if (miss.length) {
          controller.showToast(`The swing still needs ${listNeeds(miss)}. Pick jute behind the vegetable garden and make them at the crafting table.`);
          return;
        }
        buildSwing();
      },
      onBeat: (b) => b === 'open' && pushSwing(),
      icon: () => (!store.getState().swingBuilt ? faTree : link?.rider ? faHand : faChair),
    };
    controller.targets.push(swingTarget);
    // the jute row: pick a plant (the pick cycle), its bundles fall at your feet, and it grows back
    home.yard.jute.forEach((j, i) => {
      const t: Target = {
        kind: 'jute',
        key: `jute:${i}`,
        n: j.n,
        edgeU: 0.12,
        reachU: JUTE.reach,
        standU: 0.45,
        index: i,
        facing: j.facing,
        scale: 1,
        markU: 0.32,
        label: () => 'Pick jute',
        usable: () => crafting.jute.left[i] <= 0,
        use: () => {
          if (crafting.jute.left[i] <= 0) controller.startAction('pick', t);
        },
        onBeat: (b) => {
          if (b !== 'pluck' || crafting.jute.left[i] > 0) return;
          crafting.jute.left[i] = JUTE.regrow;
          crafting.jute.version++;
          const at = j.n.clone().multiplyScalar(R + controller.terrain.height(j.n) + 0.5);
          for (let k = 0; k < JUTE.yield; k++) controller.spawnDrop('jute', 1, at, 1.6, 0.4, 0.5);
          controller.sound.rustle();
          controller.refreshTarget();
        },
        icon: () => faScissors,
      };
      controller.targets.push(t);
    });
  }

  return {
    View: () => (
      <>
        <CraftView controller={controller} crafting={crafting} />
        <SwingView controller={controller} crafting={crafting} />
      </>
    ),
    Screens: () => <CraftScreens controller={controller} crafting={crafting} />,
    step(dt) {
      const s = store.getState();
      const g = controller.store.getState();
      const reduced = selectReducedMotion(g);
      // the ghost, by how close you are; the site card only while the site is what E would use (its prompt
      // is up), so it never shows for the garden or the home beside it
      const d = site ? arcDistance(controller.sim.pLocal, site.n, R) : Infinity;
      crafting.ghost = s.built ? 0 : clamp((GHOST_FAR - d) / (GHOST_FAR - GHOST_NEAR), 0, 1);
      const ds = home ? arcDistance(controller.sim.pLocal, home.swing.n, R) : Infinity;
      crafting.swingGhost = s.swingBuilt ? 0 : clamp((GHOST_FAR - ds) / (GHOST_FAR - GHOST_NEAR), 0, 1);
      const free = g.phase === 'playing' && !g.traveling && !g.openId && !g.craftScreen && !g.invScreen && !g.talk && !g.chopperOpen;
      const key = g.target?.key;
      const near = !free ? null : site && !s.built && key === 'site' ? 'house' : home && !s.swingBuilt && key === 'site:swing' ? 'swing' : null;
      if (near !== s.near) store.setState({ near });
      if (Boolean(near) !== g.siteNear) controller.store.setState({ siteNear: Boolean(near) });
      // the jute grows back; the swing swings (frozen while ambient motion is paused)
      let grew = false;
      crafting.jute.left.forEach((left, i) => {
        if (left <= 0) return;
        crafting.jute.left[i] = Math.max(0, left - dt);
        if (crafting.jute.left[i] === 0) grew = true;
      });
      if (grew) crafting.jute.version++;
      // the visitor on the swing (swing.md §6): theirs from sitting down until they're up again
      const m = controller.seatMotion;
      const mine = Boolean(riderSeat) && m.seat === riderSeat;
      if (link) {
        if (mine) {
          link.rider = 'visitor';
          link.boarding = m.stage !== 'seated';
        } else if (link.rider === 'visitor') {
          link.rider = null;
          link.boarding = false;
        }
      }
      // (a ride the visitor started swings on even while ambient motion is paused; the rest is ambient)
      if (pendulum && s.swingBuilt && (!selectAmbientPaused(g) || mine)) {
        if (link?.boarding) pendulum.brake(dt);
        pendulum.step(dt, link?.rider ? 0 : controller.wind.gust, reduced);
      }
      controller.ride =
        mine && swingAt && pendulum
          ? { tilt: -pendulum.a, pivot: swingAt.pivot.y + controller.terrain.height(home!.swing.n) - controller.lift, pump: clamp(pendulum.w / 1.4, -1, 1) }
          : null;
      if (s.swingBuilding !== null) {
        const t = reduced ? BUILD_S : s.swingBuilding + dt;
        for (const k of KNOCKS) if (s.swingBuilding < k && t >= k && !reduced) controller.sound.hit();
        if (t >= BUILD_S) {
          store.setState({ swingBuilding: null });
          controller.sound.pickup();
        } else store.setState({ swingBuilding: t });
      }
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
      const sw = crafting.swing;
      return {
        built: s.built,
        colour: s.colour,
        building: s.building !== null,
        ghost: crafting.ghost,
        near: s.near === 'house',
        swing: sw ? { built: s.swingBuilt, building: s.swingBuilding !== null, ghost: crafting.swingGhost, near: s.near === 'swing', angle: sw.pendulum.a, rider: link?.rider ?? null, jute: [...crafting.jute.left] } : null,
      };
    },
  };
}
