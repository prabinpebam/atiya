/**
 * The home and family chunk (docs: family.md): loaded alongside the textures (`game-mount.tsx`)
 * and attached to the controller before the scene mounts, so its materials compile with the rest.
 */
import { Vector3 } from 'three';
import type { GameController, HomeAttachment } from '../../controller';
import { CONFIG } from '../../config';
import { UP, arcDistance, moveAlong } from '../../math/sphere';
import { FLOWER_KINDS } from '../layout';
import { CRAFT_STAND, Family, KIDS, LinePicker, type DialogueProvider, type FamilyWorld, type NpcId } from './family';
import { FamilyView } from './FamilyView';
import { HomeView } from './HomeView';
import { TalkBox } from './TalkBox';
import { homePads } from './homePads';
import { DuckFeed } from '../../systems/duckFeed';

export function attachHome(controller: GameController): HomeAttachment | null {
  const home = controller.props.home;
  if (!home) return null;
  const R = CONFIG.planetRadius;
  const craft = controller.props.craft;
  // Prabin starts at the crafting table (the first person a visitor meets)
  const prabinAt = craft ? moveAlong(craft.n, craft.facing, (CRAFT_STAND + 1.2) / R) : undefined;
  const family = new Family(home, R, Math.random, prabinAt);
  const ducks = new DuckFeed();
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
    // (and they keep off the spot for Chopper's house, built or not: crafting.md §4.3)
    blocked: (n) => (pond ? arcDistance(n, pond.n, R) < controller.terrain.pondShore(n) + 0.05 : false) || controller.terrain.waterDepth(n) > 0.12 || arcDistance(n, home.dogHouse.n, R) < 0.6,
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
  };
  const nav = Family.navFor(world);
  family.nav = nav;
  // Chopper uses the same planner, and plays fetch with Prabin's stick (dogWorld is his view of the world)
  const dw = controller.dogWorld;
  dw.fetch = family.fetch;
  dw.plan = (from, to, stuck) => {
    if (!stuck && nav.visible(from, to)) return [to.clone()];
    const avoid = stuck ? [...family.npcs.filter((n) => !n.indoors).map((n) => ({ n: n.n, r: 0.18 })), { n: controller.sim.pLocal, r: 0.35 }].filter((b) => arcDistance(b.n, to, R) > 0.5) : [];
    return nav.path(from, to, avoid);
  };
  const View = () => (
    <>
      <HomeView controller={controller} home={home} family={family} />
      <FamilyView controller={controller} family={family} />
    </>
  );
  return {
    family,
    pads: homePads(home, R),
    people: family.npcs.map((n) => ({ id: n.id, name: n.name, n: n.n })),
    kids: family.npcs.filter((n) => KIDS.has(n.id)).map((n) => n.n),
    step(dt) {
      world.rabbits = controller.wildlife?.rabbits ?? [];
      world.hours = controller.timeOfDay;
      // the character's velocity in the planet's frame (for looking ahead when giving way)
      playerVel.copy(controller.sim.vel).applyQuaternion(controller.sim.planetQ.clone().invert());
      family.step(dt, world);
      ducks.step(dt);
    },
    canTalk: (id) => {
      const n = family.get(id as NpcId);
      return !n.indoors && n.speed < 1.2;
    },
    startChat(id, hours) {
      const n = family.get(id as NpcId);
      family.startChat(n.id);
      return lines.conversation(n.id, n.activity, hours);
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
    View,
    Hud: () => <TalkBox controller={controller} />,
  };
}
