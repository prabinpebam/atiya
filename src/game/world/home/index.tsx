/**
 * The home and family chunk (docs: family.md): loaded alongside the textures (`game-mount.tsx`)
 * and attached to the controller before the scene mounts, so its materials compile with the rest.
 */
import type { GameController, HomeAttachment } from '../../controller';
import { CONFIG } from '../../config';
import { arcDistance } from '../../math/sphere';
import { FLOWER_KINDS } from '../layout';
import { Family, LinePicker, type FamilyWorld, type NpcId } from './family';
import { FamilyView } from './FamilyView';
import { HomeView } from './HomeView';

export function attachHome(controller: GameController): HomeAttachment | null {
  const home = controller.props.home;
  if (!home) return null;
  const R = CONFIG.planetRadius;
  const family = new Family(home, R);
  const lines = new LinePicker();
  const pond = controller.props.pond;
  const flowers = FLOWER_KINDS.flatMap((k) => controller.props.flowers[k].map((f) => f.n)).filter((n) => arcDistance(n, home.centre, R) < home.range);
  const world: FamilyWorld = {
    R,
    home,
    player: controller.sim.pLocal,
    // the fixed obstacles (the family, Chopper and the character keep clear of each other separately)
    obstacles: controller.staticObstacles,
    blocked: (n) => (pond ? arcDistance(n, pond.n, R) < controller.terrain.pondShore(n) + 0.05 : false) || controller.terrain.waterDepth(n) > 0.12,
    rabbits: [],
    flowers,
    hours: controller.timeOfDay,
    others: [controller.chopper.n],
    pond: pond ? { n: pond.n, shore: (n) => controller.terrain.pondShore(n) } : null,
  };
  family.nav = Family.navFor(world);
  const View = () => (
    <>
      <HomeView controller={controller} home={home} family={family} />
      <FamilyView controller={controller} family={family} />
    </>
  );
  return {
    family,
    people: family.npcs.map((n) => ({ id: n.id, name: n.name, n: n.n })),
    kids: family.npcs.filter((n) => n.id !== 'rojina').map((n) => n.n),
    step(dt) {
      world.rabbits = controller.wildlife?.rabbits ?? [];
      world.hours = controller.timeOfDay;
      family.step(dt, world);
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
      family.npcs.map((n) => ({ id: n.id, activity: n.activity, pose: n.pose, speed: n.speed, chatting: n.chatting, indoors: n.indoors, d: arcDistance(n.n, controller.sim.pLocal, R), home: arcDistance(n.n, home.centre, R) })),
    meal: () => ({ food: family.foodOnTable, phase: family.meal?.phase ?? null, schedule: family.schedule }),
    hold: (id, activity) => family.hold(id as NpcId, activity, world),
    View,
  };
}
