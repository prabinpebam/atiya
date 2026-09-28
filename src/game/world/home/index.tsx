/**
 * The home and family chunk (docs: family.md): loaded alongside the textures (`game-mount.tsx`)
 * and attached to the controller before the scene mounts, so its materials compile with the rest.
 */
import { Vector3 } from 'three';
import type { GameController, HomeAttachment } from '../../controller';
import { CONFIG } from '../../config';
import { UP, arcDistance, moveAlong } from '../../math/sphere';
import { FLOWER_KINDS } from '../layout';
import { CRAFT_STAND, FAMILY, Family, KIDS, LinePicker, welcomeLines, type DialogueProvider, type FamilyWorld, type NpcId } from './family';
import { FamilyView } from './FamilyView';
import { HomeView, homeSteps } from './HomeView';
import { runSliced } from '../summoner';
import { TalkBox } from './TalkBox';
import { homePads } from './homePads';
import { DuckFeed } from '../../systems/duckFeed';
import { faDroplet, faHandHoldingDroplet } from '@fortawesome/free-solid-svg-icons';
import type { Target } from '../../systems/interactables';
import { GARDEN, Garden } from './garden';
import { GardenView } from './GardenView';
import { wateringPose } from './poses';

export function attachHome(controller: GameController): HomeAttachment | null {
  const home = controller.props.home;
  if (!home) return null;
  const R = CONFIG.planetRadius;
  const craft = controller.props.craft;
  // Prabin starts at the crafting table (the first person a visitor meets)
  const prabinAt = craft ? moveAlong(craft.n, craft.facing, (CRAFT_STAND + 1.2) / R) : undefined;
  const family = new Family(home, R, Math.random, prabinAt);
  const ducks = new DuckFeed();
  const garden = new Garden(home, R);
  // the lines come from a provider: preset now, an AI agent later (prabin-npc.md §4.6)
  const lines: DialogueProvider = new LinePicker();
  const brain = controller.chopper;
  const playerVel = new Vector3();
  const pond = controller.props.pond;
  const flowers = FLOWER_KINDS.flatMap((k) => controller.props.flowers[k].map((f) => f.n)).filter((n) => arcDistance(n, home.centre, R) < home.range);
  const world: FamilyWorld = {
    R,
    home,
    player: controller.sim.pLocal,
    // the fixed obstacles (the family, Chopper and the character keep clear of each other separately)
    obstacles: controller.staticObstacles,
    // (and they keep off the spots for Chopper's house and the swing, built or not: crafting.md §4.3, swing.md §4.4)
    blocked: (n) => (pond ? arcDistance(n, pond.n, R) < controller.terrain.pondShore(n) + 0.05 : false) || controller.terrain.waterDepth(n) > 0.12 || arcDistance(n, home.dogHouse.n, R) < 0.6 || arcDistance(n, home.swing.n, R) < 0.55,
    rabbits: [],
    flowers,
    hours: controller.timeOfDay,
    others: [controller.chopper.n],
    pond: pond ? { n: pond.n, shore: (n) => controller.terrain.pondShore(n) } : null,
    playerVel,
    planet: {
      spawn: UP.clone(),
      landmarks: controller.geos.map((g) => ({ id: g.id, n: g.n, approach: g.approach, footprintU: g.footprintU })),
      craft: craft ? { n: craft.n, facing: craft.facing } : null,
      bridges: controller.props.bridges.flatMap((b) => [-1, 1].map((s) => moveAlong(b.n, b.along, (s * (b.halfLengthU + 0.8)) / R))),
    },
    // Chopper's free to play when he isn't answering a whistle, heeling, in his house or off far away
    dog: { n: brain.n, free: () => !['whistled', 'heel', 'house', 'fetch'].includes(brain.behaviour) && !brain.inside && arcDistance(brain.n, controller.sim.pLocal, R) < 5 },
    garden,
  };
  const water = attachGarden(controller, garden);
  // the family are talk targets that answer for themselves: E talks, while they're out and not hurrying
  // (someone on the move who could stop for you counts: facing them, they notice you and stop, family.notice)
  const canTalk = (p: (typeof family.npcs)[number]) => !p.indoors && (p.speed < 1.2 || family.canNotice(p));
  for (const p of family.npcs)
    controller.targets.push({
      kind: 'npc',
      key: `npc:${p.id}`,
      n: p.n,
      edgeU: 0,
      // (the ring clears a chair when they're seated)
      markU: 0.34,
      reachU: FAMILY.talkRange,
      standU: 0.8,
      index: 0,
      who: p.id,
      name: p.name,
      scale: 1,
      usable: () => canTalk(p) && !controller.sim.travel,
      use: () => controller.startTalk(p.id),
    });
  const nav = Family.navFor(world);
  family.nav = nav;
  // a build changed what blocks (the viewing deck's steps): the grid is stamped again, the steps kept open
  const reblock = () => family.obstaclesChanged(world, controller.navOpen);
  if (controller.navOpen.length) reblock();
  controller.obstacleWatch.push(reblock);
  // Chopper uses the same planner, and plays fetch with Prabin's stick (dogWorld is his view of the world)
  const dw = controller.dogWorld;
  dw.fetch = family.fetch;
  dw.plan = (from, to, stuck) => {
    if (!stuck && nav.visible(from, to)) return [to.clone()];
    const avoid = stuck ? [...family.npcs.filter((n) => !n.indoors).map((n) => ({ n: n.n, r: 0.18 })), { n: controller.sim.pLocal, r: 0.35 }].filter((b) => arcDistance(b.n, to, R) > 0.5) : [];
    return nav.path(from, to, avoid);
  };
  // (the house, the yard and the rest are built ahead, a few a frame, while the home waits for its turn)
  controller.summoner.prepare.set('home', () => runSliced(homeSteps(controller, home)));
  const View = () => (
    <>
      <HomeView controller={controller} home={home} family={family} />
      <GardenView controller={controller} home={home} garden={garden} />
    </>
  );
  const People = () => <FamilyView controller={controller} family={family} />;
  return {
    family,
    pads: homePads(home, R),
    people: family.npcs.map((n) => ({ id: n.id, name: n.name, n: n.n, dir: n.dir })),
    kids: family.npcs.filter((n) => KIDS.has(n.id)).map((n) => n.n),
    step(dt) {
      world.rabbits = controller.wildlife?.rabbits ?? [];
      world.hours = controller.timeOfDay;
      world.swing = controller.swing;
      world.deckSeat = controller.deckSeat;
      // the character's velocity in the planet's frame (for looking ahead when giving way)
      playerVel.copy(controller.sim.vel).applyQuaternion(controller.sim.planetQ.clone().invert());
      const aim = controller.store.getState().target?.key;
      family.notice(aim?.startsWith('npc:') ? (aim.slice(4) as NpcId) : null);
      family.step(dt, world);
      ducks.step(dt);
      water(dt);
    },
    canTalk: (id) => canTalk(family.get(id as NpcId)),
    startChat(id, hours) {
      const n = family.get(id as NpcId);
      family.startChat(n.id);
      return lines.conversation(n.id, n.activity, hours);
    },
    greet(at, face, o) {
      family.greet('prabin', at, face, world);
      return { id: 'prabin', lines: welcomeLines(o.touch, o.back) };
    },
    endChat: (id) => family.endChat(id as NpcId),
    state: () =>
      family.npcs.map((n) => ({
        id: n.id,
        activity: n.activity,
        pose: n.pose,
        speed: n.speed,
        chatting: n.chatting,
        indoors: n.indoors,
        d: arcDistance(n.n, controller.sim.pLocal, R),
        home: arcDistance(n.n, home.centre, R),
        seat: n.seat ? `${n.seat.seat.id}:${n.seat.phase}` : null,
        link: n.link ? `${n.link.dir}:${n.link.phase}` : null,
        held: n.held,
      })),
    door: () => family.door.open,
    meal: () => ({ food: family.foodOnTable, phase: family.meal?.phase ?? null, schedule: family.schedule }),
    hold: (id, activity) => family.hold(id as NpcId, activity, world),
    ducks,
    garden,
    View,
    People,
    Hud: () => <TalkBox controller={controller} />,
  };
}

/**
 * The visitor at the vegetable garden (family.md §3.2): the watering can and each plant are targets
 * that answer for themselves. Pick the can up, walk to a plant and E waters it (the `water` cycle);
 * put the can back at its spot, or it goes back by itself if you walk off with it or fly away.
 * Returns the garden's step.
 */
function attachGarden(controller: GameController, garden: Garden): (dt: number) => void {
  const R = CONFIG.planetRadius;
  const can = garden.can;
  const holding = () => garden.holder === 'visitor';
  const cycle = controller.cycles.water;
  controller.poses.water = wateringPose(cycle);
  controller.targets.push({
    kind: 'can',
    key: 'can',
    n: can.n,
    edgeU: 0.1,
    reachU: 0.8,
    standU: 0.45,
    index: 0,
    scale: 1,
    label: () => (holding() ? 'Put the can back' : 'Pick up the watering can'),
    usable: () => garden.holder === null || holding(),
    icon: () => faHandHoldingDroplet,
    use() {
      if (holding()) {
        garden.putBack();
        controller.announce('You put the watering can back by the beds.');
      } else if (garden.take('visitor')) controller.announce('You pick up the watering can. Walk up to a plant to water it.');
      controller.sound.pickup();
      controller.refreshTarget();
    },
  });
  for (const p of garden.plants) {
    const name = p.kind === 'cabbage' ? 'cabbage' : 'tomato plant';
    const t: Target = {
      kind: 'plant',
      key: `plant:${p.i}`,
      n: p.n,
      edgeU: 0.1,
      reachU: GARDEN.reachU,
      standU: GARDEN.standU,
      index: p.i,
      scale: 1,
      label: () => `Water the ${name}`,
      // (its ring sits on the bed's soil, round the plant)
      markU: p.kind === 'cabbage' ? 0.17 : 0.15,
      markLift: GARDEN.soil,
      usable: () => holding() && garden.wet[p.i] < GARDEN.full,
      icon: () => faDroplet,
      use: () => controller.startAction('water', t),
    };
    controller.targets.push(t);
  }
  let last = 0;
  let say: string | null = null;
  let ended = false;
  return (dt) => {
    garden.step(dt);
    const a = controller.action;
    const i = a.kind === 'water' ? (a.target?.index ?? -1) : -1;
    if (i >= 0) {
      // the pour starts once you've stepped up to the plant, and the water reaches it a moment later
      if (last < cycle.approach && a.t >= cycle.approach) garden.pour(i, controller.sim.pLocal);
      if (last < GARDEN.wetAt && a.t >= GARDEN.wetAt) {
        garden.water(i);
        controller.sound.step('water', false);
        const left = garden.plants.filter((p) => garden.wet[p.i] < GARDEN.full).length;
        say = left ? `Watered the ${garden.plants[i].kind === 'cabbage' ? 'cabbage' : 'tomato plant'}.` : 'Every plant is watered. Put the can back by the beds.';
      }
      last = a.t;
    } else {
      last = 0;
      // said once the pour is over, with the next prompt (which would otherwise replace it in the live region)
      if (say && ended) {
        const next = controller.store.getState().target;
        controller.announce(next ? `${say} ${next.label}: press E.` : say);
        say = null;
      }
      ended = Boolean(say);
    }
    // walked off with it, or flew away: it goes back by the beds
    if (holding() && (controller.sim.travel || arcDistance(controller.sim.pLocal, can.n, R) > GARDEN.leaveU)) {
      garden.putBack();
      controller.showToast('You left the watering can back by the beds.');
      controller.refreshTarget();
    }
  };
}