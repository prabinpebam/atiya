/**
 * What the visitor does and carries anywhere (docs: rest.md), in the crafting chunk: sitting on the
 * grass and lying back on it (the poses the avatar blends over its clip, `controller.restPose`), and
 * the hand lantern (given once), held in the left hand while it's the selected hotbar slot, set down
 * beside you while you rest, and lighting the way at night (a real lamp: lampLights.ts).
 */
import { Color, Group, Mesh, Quaternion, Vector3 } from 'three';
import type { GameController, GearFrame } from '../../controller';
import { JUMP_POSE, jumpPose, restPose } from './restPoses';
import { JUMP } from '../../systems/movement';
import { actionPose } from '../../player/actionPoses';
import { Kit } from '../kit';
import { kitMaterials } from '../materials';
import { addLamp, type Lamp } from '../lampLights';
import { lampsOn } from '../DayNight';

/** The lantern (model units = u): hung from its ring at the origin, the body below it. */
const LANTERN = { ring: 0.035, cap: 0.075, h: 0.15, w: 0.1 };

function lanternModel() {
  const k = new Kit();
  const iron = '#3a3634';
  const L = LANTERN;
  k.surface('metal', () => {
    k.torus(L.ring, 0.006, iron, { p: [0, -L.ring, 0], r: [0, Math.PI / 2, 0] }, Math.PI * 2, [5, 12]);
    k.cone(L.w * 0.62, L.cap, iron, { p: [0, -L.ring * 2 - L.cap / 2, 0] }, 4);
    k.box([L.w * 1.05, 0.016, L.w * 1.05], iron, { p: [0, -L.ring * 2 - L.cap, 0] }, 0.004);
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      k.box([0.012, L.h, 0.012], iron, { p: [(x * L.w) / 2, -L.ring * 2 - L.cap - L.h / 2, (z * L.w) / 2] }, 0.003);
    k.box([L.w * 1.1, 0.022, L.w * 1.1], iron, { p: [0, -L.ring * 2 - L.cap - L.h - 0.011, 0] }, 0.005);
  });
  // the glass and the flame behind it: the glow layer, so it shines at night
  k.box([L.w * 0.86, L.h * 0.9, L.w * 0.86], '#ffcf7a', { p: [0, -L.ring * 2 - L.cap - L.h / 2, 0] }, 0.01, 'glow');
  return k.build();
}

/** Where the lamp sits in the lantern (its middle), below the ring. */
const LAMP_Y = -(LANTERN.ring * 2 + LANTERN.cap + LANTERN.h / 2);
const GIVEN = 'game.lantern';

export interface GearAttachment {
  /** Is the lantern in the hand now (the selected hotbar slot, not travelling)? For the test hook. */
  held(): boolean;
  lamp: Lamp;
  /** Ease the resting pose toward where it's heading. */
  step(dt: number, reduced: boolean): void;
}

export function attachGear(controller: GameController): GearAttachment {
  const inv = controller.inventory;
  const r = controller.rest;
  // sit on the grass (X) or lie back (Z): the same key again, Space, E or a step gets you up (controller.standUp);
  // from sitting, lying goes on from the sit (the lie's first half is the sit), and back
  // the action cycles' poses (a chunk's own, like the home's watering, first)
  controller.actionPose = (kind, t) => controller.poses[kind]?.(t) ?? actionPose(kind, t);
  controller.restAs = (kind) => {
    if (r.kind === kind && r.goal === 1) return controller.standUp();
    const s = controller.store.getState();
    if (s.phase !== 'playing' || controller.sim.travel || controller.seatMotion.stage || controller.action.busy || controller.sim.jumpH > 0) return;
    controller.sim.cancelAutoWalk();
    controller.sim.vel.set(0, 0, 0);
    if (r.kind === 'lie' && kind === 'sit') r.goal = 0.5;
    else {
      if (r.kind === 'sit') r.k = 0.5;
      r.kind = kind;
      r.goal = 1;
    }
    controller.store.setState({ seated: true, target: null });
    controller.announce(kind === 'sit' ? 'Sitting on the grass. Press Space to stand up.' : 'Lying back on the grass. Press Space to get up.');
  };
  // the lantern: in the visitor's backpack from the start (once; an E2E test flag leaves it out)
  const skip = import.meta.env.MODE !== 'production' && localStorage.getItem('game.test.lantern') === '0';
  if (!skip && !localStorage.getItem(GIVEN) && inv.add('lantern', 1) === 0) {
    localStorage.setItem(GIVEN, '1');
    controller.invChanged();
  }
  const geo = lanternModel();
  const m = kitMaterials();
  const lantern = new Group();
  lantern.name = 'lantern';
  lantern.add(new Mesh(geo.solid!, m.solid), new Mesh(geo.glow!, m.glow));
  for (const c of lantern.children) (c as Mesh).castShadow = true;
  lantern.visible = false;
  // (packed before the other lamps: it's the one by the character)
  const lamp: Lamp = { pos: new Vector3(), dir: null, color: new Color('#ffc27a'), intensity: 0, range: 2.6, first: true };
  addLamp(lamp);
  const _h = new Vector3();
  const _w = new Vector3();
  const _q = new Quaternion();
  const _dir = new Vector3();
  const _fwd = new Vector3();
  const _left = new Vector3();
  let swing = 0;
  let t = 0;
  // the hop: time in the air, and since landing (−1: not landing)
  let last = 0;
  let air = 0;
  let land = -1;
  const held = () => inv.backpack[inv.selected]?.id === 'lantern' && !controller.sim.travel;

  controller.gear = (f: GearFrame) => {
    const root = f.root;
    if (!root) return;
    if (r.kind && r.k > 1e-3) {
      const p = restPose(r.kind, r.k, f.time);
      f.pose(p, p.w);
      if (f.body) f.body.position.y -= p.hip * p.w;
    }
    // the hop (and the arms out while flying over the planet)
    const dt = Math.min(0.1, Math.max(0, f.time - last));
    last = f.time;
    const sim = controller.sim;
    const up = sim.jumpH > 0 || sim.jumpV > 0;
    if (up) {
      air += dt;
      land = -1;
    } else if (air > 0) {
      air = 0;
      land = 0;
    } else if (land >= 0) land += dt;
    const jp = jumpPose(sim.jumpV, JUMP.v, air, up ? -1 : land, Math.min(1, sim.speed / 1.5));
    if (jp && jp.w > 1e-3) {
      f.pose(jp, jp.w);
      if (f.body) f.body.position.y -= jp.hip * jp.w;
    } else if (sim.hover > 0.01) f.pose({ w: 1, pickaxe: 0, ...JUMP_POSE.fall }, Math.min(1, sim.hover / 0.6));
    if (lantern.parent !== root) root.add(lantern);
    const on = held();
    lantern.visible = on;
    lamp.intensity = on ? 2.4 * lampsOn(controller.sky.night) : 0;
    if (!on) return;
    t += 1 / 60;
    const rest = controller.rest.k;
    const hand = f.hands.find((h) => h.side > 0);
    if (rest > 0.5 || !hand?.hand) {
      // resting: set down on the grass at your left side
      lantern.position.set(0.3, -LAMP_Y + LANTERN.h / 2 + 0.022, 0.12);
      lantern.rotation.set(0, 0.4, 0);
    } else {
      // held out a little in the left hand, swinging gently as you walk
      _fwd.set(Math.sin(f.heading), 0, Math.cos(f.heading));
      _left.set(Math.cos(f.heading), 0, -Math.sin(f.heading));
      const w = 0.85 * (1 - rest * 2);
      f.aim(hand.arm, hand.fore, _dir.copy(_fwd).multiplyScalar(0.28).addScaledVector(_left, 0.2).add(_w.set(0, -0.94, 0)), w);
      f.aim(hand.fore, hand.hand, _dir.copy(_fwd).multiplyScalar(0.8).addScaledVector(_left, 0.05).add(_w.set(0, -0.35, 0)), w);
      root.updateMatrixWorld(true);
      root.worldToLocal(hand.hand.getWorldPosition(_h));
      lantern.position.copy(_h);
      swing = Math.sin(t * 5.2) * Math.min(1, controller.sim.speed / 2) * 0.22;
      lantern.rotation.set(swing, 0, swing * 0.5);
    }
    // the lamp at the lantern's middle, in the planet's own frame (the world turns too in full planet)
    lantern.updateMatrixWorld(true);
    _q.copy(controller.sim.planetQ);
    if (controller.world) _q.premultiply(controller.world.quaternion);
    lamp.pos.set(0, LAMP_Y, 0).applyMatrix4(lantern.matrixWorld).applyQuaternion(_q.invert());
  };
  return {
    held,
    lamp,
    step(dt, reduced) {
      if (!r.kind) return;
      r.k = reduced ? r.goal : r.k + Math.sign(r.goal - r.k) * Math.min(Math.abs(r.goal - r.k), dt / 0.9);
      // (lying back down to sitting: the sit is the lie's first half)
      if (r.kind === 'lie' && r.goal === 0.5 && r.k === 0.5) Object.assign(r, { kind: 'sit', k: 1, goal: 1 });
      if (r.goal === 0 && r.k === 0) r.kind = null;
    },
  };
}
