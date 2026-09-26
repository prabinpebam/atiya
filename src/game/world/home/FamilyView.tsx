import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from 'zustand';
import {
  AnimationMixer,
  Box3,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  type AnimationAction,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import type { GameController } from '../../controller';
import { arcDistance, damp, moveAlong, tangentToward } from '../../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../../state/store';
import { aimBone } from '../../player/Player';
import { characterById, type CharacterId } from '../../player/characters';
import { withLampLights } from '../lampLights';
import { kitMaterials } from '../materials';
import { KitModel } from '../KitModel';
import { CRAFT_STAND, type Family, type NpcId } from './family';
import { bodyPose, HIP_FRACTION } from './poses';
import { HOUSE, HOUSE_STEPS, birdhouseModel, bookModel, bubbleModel, guitarModel, hammerModel, stickModel, toyCarModel, paperModel } from './models';
import { seatHip } from './seats';
import { PROP_SCALE } from '../homestead';
import { Kit } from '../kit';
import { withBase } from '../../platform/base';

const R = CONFIG.planetRadius;
/** Ground speed (u/s) of the run clip at 1× for a 1.25 u character (as the player's avatar). */
const RUN_CLIP_SPEED = 2.5;

/** How each of them looks (docs: family.md §4). */
export const LOOKS: Record<NpcId, { model: CharacterId; height: number; head: number; skin: string; hair: 'pigtails' | null; glasses: boolean; book: string }> = {
  // Rojina wears Sunny's model: its ponytail and scrunchie take her atlas's dark hair and teal tee
  rojina: { model: 'sunny', height: 1.18, head: 1, skin: withBase('/models/skins/rojina.png'), hair: null, glasses: true, book: '#6f9fc8' },
  laija: { model: 'skater', height: 0.92, head: 1.12, skin: withBase('/models/skins/laija.png'), hair: 'pigtails', glasses: false, book: '#e2554c' },
  lingjel: { model: 'skater', height: 0.74, head: 1.2, skin: withBase('/models/skins/lingjel.png'), hair: null, glasses: false, book: '#3fb45a' },
  // Prabin: the playable Skater's model in his own T-shirt, trousers and shoes (prabin-npc.md §4.6)
  prabin: { model: 'skater', height: 1.28, head: 1, skin: withBase('/models/skins/prabin.png'), hair: null, glasses: false, book: '#6f9fc8' },
};

/** Where the guitar sits against the body (the held group's frame: x left, y up, z forward), and how it's tilted. */
const GUITAR_AT = { x: 0.06, y: 0.05, z: 0.17, rot: [-0.15, 0, -1.2] as const };
/** Points on the guitar model (its own units, before PROP_SCALE): the strings over the sound hole, and the neck where the left hand frets. */
const GUITAR_STRUM: readonly [number, number, number] = [0, 0.3, 0.1];
const GUITAR_FRET: readonly [number, number, number] = [0.01, 0.72, -0.03];
/** One strum every half second: the chord changes every four (G, C, D, Em). */
const STRUM_T = 0.5;

const _s = new Vector3();
const _e = new Vector3();
const _h = new Vector3();
const _pole = new Vector3();
const _tmp = new Vector3();

/**
 * Two-bone IK for an arm: the hand bone to `target` (world), the elbow bending toward `pole`. Built on
 * `aimBone`, so it works whatever the rig's local axes.
 */
function reachArm(arm: Object3D | null, fore: Object3D | null, hand: Object3D | null, target: Vector3, pole: Vector3, w: number): void {
  if (!arm || !fore || !hand) return;
  arm.getWorldPosition(_s);
  fore.getWorldPosition(_e);
  hand.getWorldPosition(_h);
  const a = _s.distanceTo(_e);
  const b = _e.distanceTo(_h);
  const to = _tmp.copy(target).sub(_s);
  const len = to.length();
  if (len < 1e-6 || a < 1e-6 || b < 1e-6) return;
  const d = Math.min(Math.max(len, Math.abs(a - b) + 1e-3), a + b - 1e-3);
  to.multiplyScalar(1 / len);
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const perp = _pole.copy(pole).sub(_s);
  perp.addScaledVector(to, -perp.dot(to));
  if (perp.lengthSq() < 1e-12) return;
  perp.normalize();
  const elbow = _e.copy(_s).addScaledVector(to, a * cosA).addScaledVector(perp, a * Math.sqrt(1 - cosA * cosA));
  aimBone(arm, fore, _h.copy(elbow).sub(_s), w);
  fore.getWorldPosition(_e);
  aimBone(fore, hand, _h.copy(target).sub(_e), w);
}

/** The front steps and the floor behind the door (house-local heights above its base, and their outer edges from its centre, u; home/models.ts). */
const STEPS: ReadonlyArray<[number, number]> = [
  ...Array.from({ length: HOUSE_STEPS.n }, (_, i): [number, number] => [HOUSE.d / 2 + 0.06 + HOUSE_STEPS.tread * (HOUSE_STEPS.n - i), HOUSE_STEPS.rise * (i + 1)]),
  [HOUSE.d / 2 + 0.05, HOUSE_STEPS.rise * HOUSE_STEPS.n],
];
const stepHeight = (d: number) => {
  let h = 0;
  for (const [edge, top] of STEPS) if (d < edge) h = top;
  return h;
};

const _m = new Matrix4();
const _q = new Quaternion();
const _x = new Vector3();
const _v = new Vector3();
const _w = new Vector3();
const _fwd = new Vector3();
const _left = new Vector3();
const _up = new Vector3(0, 1, 0);
const _dir = new Vector3();

/**
 * Hair and glasses, authored in the Kenney model's units (the head spans y 2.61–3.77, x ±0.44, z ±0.53,
 * the face at +z) and moved onto the Head bone with `HEAD_SPACE` (its frame is 1/100 of those units,
 * with its origin at y 2.70).
 */
const HEAD_SPACE = new Matrix4().makeScale(0.01, 0.01, 0.01).multiply(new Matrix4().makeTranslation(0, -2.7, 0));

function accessories(look: (typeof LOOKS)[NpcId]): { hair: BufferGeometry | null; glasses: BufferGeometry | null } {
  const strip = (g: BufferGeometry) => {
    g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  };
  let hair: BufferGeometry | null = null;
  if (look.hair === 'pigtails') {
    const parts: BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      parts.push(new SphereGeometry(0.17, 10, 8).scale(0.85, 1.35, 0.85).translate(s * 0.52, 3.0, -0.26));
      parts.push(new TorusGeometry(0.09, 0.035, 6, 12).rotateY(Math.PI / 2).translate(s * 0.47, 3.22, -0.24));
    }
    hair = mergeGeometries(parts.map(strip))!;
  }
  let glasses: BufferGeometry | null = null;
  if (look.glasses) {
    const k = new Kit();
    for (const s of [-1, 1]) {
      k.torus(0.12, 0.02, '#2b2524', { p: [s * 0.19, 3.08, 0.56], s: [1.1, 0.85, 1] }, Math.PI * 2, [6, 18]);
      k.box([0.03, 0.03, 0.5], '#2b2524', { p: [s * 0.44, 3.1, 0.3] });
    }
    k.box([0.1, 0.025, 0.025], '#2b2524', { p: [0, 3.1, 0.57] });
    glasses = k.build().solid;
  }
  return { hair, glasses };
}

function Person({ controller, family, id }: { controller: GameController; family: Family; id: NpcId }) {
  const gltf = useGLTF(characterById(LOOKS[id].model).url, false, false);
  const reduced = useStore(controller.store, selectReducedMotion);
  const paused = useStore(controller.store, selectAmbientPaused);
  const camera = useThree((s) => s.camera);
  const look = LOOKS[id];
  const npc = family.get(id);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as Group;
    // the player's avatar adds occlusion-outline twins to the shared model: not for the family
    const twins: Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.isOutline) twins.push(o);
      delete o.userData.outline;
    });
    for (const t of twins) t.removeFromParent();
    const tex = new TextureLoader().load(look.skin);
    tex.flipY = false;
    tex.colorSpace = SRGBColorSpace;
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const mat = new MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
      m.material = withLampLights(mat);
    });
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene, true);
    const h = Math.max(1e-6, box.max.y - box.min.y);
    const s = look.height / h;
    const b = (n: string) => scene.getObjectByName(n) ?? null;
    const head = b('Head');
    // hair and glasses ride on the head bone
    const acc = accessories(look);
    const toHead = HEAD_SPACE;
    const hairMat = new MeshStandardMaterial({ color: '#241a17', roughness: 0.7, metalness: 0, side: DoubleSide });
    if (head && acc.hair) {
      const hairMesh = new Mesh(acc.hair.clone().applyMatrix4(toHead), withLampLights(hairMat));
      hairMesh.castShadow = true;
      head.add(hairMesh);
    }
    if (head && acc.glasses) head.add(new Mesh(acc.glasses.clone().applyMatrix4(toHead), kitMaterials().solid));
    if (head && look.head !== 1) head.scale.setScalar(look.head);
    const limbs = (['Left', 'Right'] as const).map((side) => ({
      side: side === 'Left' ? 1 : -1,
      up: b(`${side}UpLeg`),
      leg: b(`${side}Leg`),
      foot: b(`${side}Foot`),
      arm: b(`${side}Arm`),
      fore: b(`${side}ForeArm`),
      hand: b(`${side}Hand`),
    }));
    const spine = { spine: b('Spine'), chest: b('Chest'), upper: b('UpperChest') };
    const mixer = new AnimationMixer(scene);
    const clip = (name: string) => gltf.animations.find((a) => a.name === name);
    const act = (name: string): AnimationAction | null => {
      const c = clip(name);
      return c ? mixer.clipAction(c) : null;
    };
    const idle = act('idle');
    const run = act('run');
    // hip-joint height at rest (u), to sit the body on a seat or lay it down
    const hipRest = HIP_FRACTION * look.height;
    // each bone and its pose as the clips left it (see the frame loop)
    const bones: Array<[Object3D, Quaternion]> = [];
    scene.traverse((o) => {
      if ((o as { isBone?: boolean }).isBone) bones.push([o, o.quaternion.clone()]);
    });
    return { scene, scale: s, lift: -box.min.y * s, limbs, spine, head, bones, mixer, idle, run, hipRest, tex };
  }, [gltf, look]);
  // the clips start with the component (and stop with it): started in the memo, React's
  // mount–unmount–mount check in development stopped them for good and left the family in a T-pose
  useEffect(() => {
    rig.idle?.play();
    rig.run?.play();
    rig.run?.setEffectiveWeight(0);
    return () => {
      rig.mixer.stopAllAction();
    };
  }, [rig]);
  useEffect(() => () => rig.tex.dispose(), [rig]);

  const props = useMemo(
    () => ({
      guitar: guitarModel(),
      hammer: hammerModel(),
      stick: stickModel(),
      book: bookModel(look.book),
      car: toyCarModel(id === 'lingjel' ? '#e33b3b' : '#f6c629'),
      paper: paperModel(),
      bubble: bubbleModel(),
      pebble: new SphereGeometry(0.035, 8, 6),
      basket: (() => {
        const k = new Kit();
        k.surface('wood', () => {
          k.cyl(0.14, 0.12, 0.12, '#c79a5b', { p: [0, 0.06, 0] }, 12);
          k.torus(0.11, 0.012, '#a67a42', { p: [0, 0.12, 0] }, Math.PI, [5, 12]);
        });
        k.box([0.22, 0.02, 0.18], '#e2554c', { p: [0, 0.125, 0] }, 0.008);
        return k.build();
      })(),
    }),
    [look, id],
  );

  const root = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const held = useRef<Group>(null);
  const paper = useRef<Group>(null);
  const bubble = useRef<Group>(null);
  const weight = useRef(0);
  const hipNow = useRef<number | null>(null);
  const pitchNow = useRef(0);
  const backNow = useRef(0);
  const blend = useRef(0);
  const clock = useRef(0);
  const bubbleS = useRef(0);
  const lastPose = useRef(npc.pose);
  const headYaw = useRef(0);
  const nodNow = useRef(0);
  const liftNow = useRef(0);
  const knock = useRef(0);
  const strum = useRef(-1);
  const home = family.home;
  const houseBase = controller.terrain.height(home.house.n);

  useFrame((_, rawDt) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const dt = Math.min(rawDt, 0.1);
    if (!paused) clock.current += dt;
    // in the house for the night: not drawn (the lit windows say they're home)
    g.visible = !npc.indoors;
    if (npc.indoors) return;
    // on the planet, facing their way (up the front steps and onto the floor in the doorway)
    const ground = controller.terrain.walkHeight(npc.n);
    const onSteps = npc.link ? Math.max(0, houseBase + stepHeight(arcDistance(npc.n, home.house.n, R)) - ground) : 0;
    liftNow.current = reduced ? onSteps : damp(liftNow.current, onSteps, 12, dt);
    const h = ground + liftNow.current;
    g.position.copy(npc.n).multiplyScalar(R + h);
    _x.crossVectors(npc.n, npc.dir).normalize();
    _m.makeBasis(_x, npc.n, npc.dir);
    _q.setFromRotationMatrix(_m);
    if (reduced) g.quaternion.copy(_q);
    else g.quaternion.slerp(_q, 1 - Math.exp(-dt * 14));

    // clips: idle, or the run cycle at the speed they move
    const moving = npc.speed > 0.08 && npc.pose !== 'crawl';
    blend.current = damp(blend.current, moving ? Math.min(1, npc.speed / 1.0) : 0, 10, dt);
    rig.idle?.setEffectiveWeight(1 - blend.current);
    if (rig.run) {
      rig.run.setEffectiveWeight(blend.current);
      rig.run.timeScale = Math.min(1.8, Math.max(0.5, (npc.speed / RUN_CLIP_SPEED) * (1.25 / look.height)));
    }
    // Undo last frame's procedural offsets (back to what the clips left), let the clips run, then
    // remember their result. (The mixer only writes a bone whose value changed since it last wrote
    // it, so resetting to the bind pose instead left unchanged bones in a T-pose; offsets on top of
    // last frame's pose, on the other hand, pile up: the heads spun.)
    for (const [bone, keep] of rig.bones) bone.quaternion.copy(keep);
    rig.mixer.update(paused ? 0 : dt);
    for (const [bone, keep] of rig.bones) keep.copy(bone.quaternion);

    // the pose over the clip, faded in and out, and the body sunk to a seat or laid down
    if (npc.pose !== lastPose.current) {
      lastPose.current = npc.pose;
      weight.current = Math.min(weight.current, 0.35);
    }
    const bp = bodyPose(moving ? 'stand' : npc.pose, npc.poseT, npc.held, npc.speed > 0.05);
    const active = bp.arms || bp.legs || bp.spine || bp.hip !== null;
    weight.current = reduced ? (active ? 1 : 0) : damp(weight.current, active ? 1 : 0, 7, dt);
    // on a seat, the hips go to that seat's own height and depth (seats.ts), whatever the body's size
    const su = npc.seat;
    const onSeat = su && su.phase !== 'out' && bp.hip !== null;
    const hipTarget = onSeat ? seatHip(su.seat, look.height) : bp.hip === null ? rig.hipRest : bp.hip * look.height;
    const backTarget = onSeat ? su.seat.back : (bp.back ?? 0) * look.height;
    hipNow.current = hipNow.current === null || reduced ? hipTarget : damp(hipNow.current, hipTarget, 8, dt);
    pitchNow.current = reduced ? bp.pitch : damp(pitchNow.current, bp.pitch, 7, dt);
    backNow.current = reduced ? backTarget : damp(backNow.current, backTarget, 8, dt);
    pv.position.set(0, hipNow.current, -backNow.current);
    pv.rotation.set(pitchNow.current, 0, 0);
    const w = weight.current;
    if (w > 1e-3) {
      g.updateMatrixWorld(true);
      g.getWorldQuaternion(_q);
      _fwd.set(0, 0, 1).applyQuaternion(_q);
      _left.set(1, 0, 0).applyQuaternion(_q);
      _up.set(0, 1, 0).applyQuaternion(_q);
      const toW = (d: readonly [number, number, number], side: number) => _dir.copy(_fwd).multiplyScalar(d[0]).addScaledVector(_up, d[1]).addScaledVector(_left, d[2] * side);
      if (bp.spine) aimBone(rig.spine.spine, rig.spine.chest, toW(bp.spine, 0), w);
      if (bp.chest) aimBone(rig.spine.chest, rig.spine.upper, toW(bp.chest, 0), w);
      for (const l of rig.limbs) {
        if (bp.arms) {
          const a = l.side > 0 ? bp.arms.l : bp.arms.r;
          aimBone(l.arm, l.fore, toW(a.upper, l.side), w);
          aimBone(l.fore, l.hand, toW(a.lower, l.side), w);
        }
        if (bp.legs) {
          const a = l.side > 0 ? bp.legs.l : bp.legs.r;
          aimBone(l.up, l.leg, toW(a.upper, l.side), w);
          aimBone(l.leg, l.foot, toW(a.lower, l.side), w);
        }
      }
    }
    // playing the guitar: the guitar across the lap, the left hand on its neck and the right strumming
    // over the sound hole (two-bone IK to points on the guitar), a strum sounding from it on each downstroke
    const hmG = held.current;
    if (npc.pose === 'guitar' && npc.held === 'guitar' && hmG && w > 1e-3) {
      hmG.position.set(GUITAR_AT.x, (hipNow.current ?? 0.4) + GUITAR_AT.y, -backNow.current + GUITAR_AT.z);
      hmG.rotation.set(...GUITAR_AT.rot);
      hmG.updateMatrixWorld(true);
      const onGuitar = (p: readonly [number, number, number], out: Vector3) => hmG.localToWorld(out.set(p[0] * PROP_SCALE, (p[1] - 0.17) * PROP_SCALE, p[2] * PROP_SCALE));
      const c = (npc.poseT % STRUM_T) / STRUM_T;
      // a quick downstroke, then a slower lift back up: across the strings (the guitar's x)
      const across = c < 0.2 ? 0.07 - 0.14 * (c / 0.2) : -0.07 + 0.14 * ((c - 0.2) / 0.8);
      const strumAt = onGuitar([GUITAR_STRUM[0] + across, GUITAR_STRUM[1], GUITAR_STRUM[2]], _v.clone());
      const fretAt = onGuitar(GUITAR_FRET, _w.clone());
      g.getWorldQuaternion(_q);
      const fwd = _fwd.set(0, 0, 1).applyQuaternion(_q);
      const left = _left.set(1, 0, 0).applyQuaternion(_q);
      const up = _dir.set(0, 1, 0).applyQuaternion(_q);
      const r = rig.limbs[1];
      const l = rig.limbs[0];
      r.arm?.getWorldPosition(_s);
      reachArm(r.arm, r.fore, r.hand, strumAt, _tmp.copy(_s).addScaledVector(fwd, -0.2).addScaledVector(left, -0.35).addScaledVector(up, -0.4).clone(), w);
      l.arm?.getWorldPosition(_s);
      reachArm(l.arm, l.fore, l.hand, fretAt, _tmp.copy(_s).addScaledVector(left, 0.4).addScaledVector(up, -0.45).addScaledVector(fwd, -0.05).clone(), w);
      // the sound, from the guitar: panned to where it is on screen, softer further off
      const beat = Math.floor(npc.poseT / STRUM_T);
      if (beat !== strum.current && !paused) {
        strum.current = beat;
        const d = arcDistance(npc.n, controller.sim.pLocal, R);
        const near = Math.max(0, Math.min(1, 1 - (d - 1.5) / 9));
        _e.copy(strumAt).project(camera);
        controller.sound.strum(Math.floor(beat / 4) % 4, Math.max(-1, Math.min(1, _e.x)), near * near);
      }
    }
    // the head: toward what they're looking at (eased), and nodding over a book
    if (rig.head) {
      let yawTarget = 0;
      if (npc.look) {
        const to = tangentToward(npc.n, npc.look, _v);
        if (to) yawTarget = Math.max(-1, Math.min(1, Math.atan2(to.dot(_x), to.dot(npc.dir)))) * 0.8;
      }
      headYaw.current = reduced ? yawTarget : damp(headYaw.current, yawTarget, 6, dt);
      nodNow.current = reduced ? bp.nod * w : damp(nodNow.current, bp.nod * w, 6, dt);
      if (Math.abs(nodNow.current) > 1e-3) rig.head.rotateX(nodNow.current);
      if (Math.abs(headYaw.current) > 1e-3) {
        // about the body's own up (world space, brought into the head's frame: its parents are rotated)
        g.getWorldQuaternion(_q);
        _w.set(0, 1, 0).applyQuaternion(_q);
        rig.head.getWorldQuaternion(_q).invert();
        rig.head.rotateOnAxis(_w.applyQuaternion(_q).normalize(), headYaw.current);
      }
    }

    // what they're holding
    const hm = held.current;
    if (hm) {
      const kind = npc.held;
      for (const c of hm.children) c.visible = c.name === kind;
      const lh = rig.limbs[0].hand;
      const rh = rig.limbs[1].hand;
      if (kind && lh && rh) {
        g.updateMatrixWorld(true);
        const a = g.worldToLocal(lh.getWorldPosition(_v));
        const b = g.worldToLocal(rh.getWorldPosition(_w));
        hm.rotation.set(0, 0, 0);
        if (kind === 'book' || kind === 'basket') hm.position.copy(a).add(b).multiplyScalar(0.5);
        else if (kind === 'guitar') {
          // across the lap, the neck out to the left
          hm.position.set(GUITAR_AT.x, (hipNow.current ?? 0.4) + GUITAR_AT.y, -backNow.current + GUITAR_AT.z);
        } else hm.position.copy(b);
        if (kind === 'car' && npc.pose === 'crawl') hm.position.y = 0.01;
        // the pebble leaves the hand at the throw and comes back with the next one
        const c = npc.poseT % 1.6;
        if (kind === 'pebble') hm.visible = !(c > 0.55 && c < 1.25);
        else hm.visible = true;
        if (kind === 'book') hm.rotation.set(-0.9, 0, 0);
        else if (kind === 'guitar') hm.rotation.set(...GUITAR_AT.rot);
        else if (kind === 'hammer' || kind === 'stick') {
          // along the forearm, from the fist
          rig.limbs[1].fore?.getWorldPosition(_w);
          g.worldToLocal(_w);
          _dir.copy(hm.position).sub(_w).normalize();
          hm.quaternion.setFromUnitVectors(_up.set(0, 1, 0), _dir);
        }
        if (kind === 'book') hm.position.addScaledVector(_up.set(0, 1, 0), 0.03).z += 0.04;
      } else hm.visible = false;
    }
    if (paper.current) paper.current.visible = npc.pose === 'paint';
    // the hammer's knock at the bottom of each swing (quiet, and only close by)
    if (npc.pose === 'hammer' && !paused) {
      const c = Math.floor(npc.poseT / 0.8);
      const d = arcDistance(npc.n, controller.sim.pLocal, R);
      if (c !== knock.current && npc.poseT % 0.8 > 0.5) {
        knock.current = c;
        if (d < 6) controller.sound.hit(0.5 * (1 - d / 6));
      }
    }
    // a speech bubble over whoever is talking (to one of the family), billboarded
    const bb = bubble.current;
    if (bb) {
      bubbleS.current = damp(bubbleS.current, npc.bubble && !npc.chatting ? 1 : 0, 12, dt);
      bb.visible = bubbleS.current > 0.02;
      if (bb.visible) {
        bb.scale.setScalar(bubbleS.current * (look.height / 1.18));
        bb.position.set(0.12, look.height + 0.22 + (npc.pose === 'paint' ? -0.6 : 0), 0);
        g.getWorldQuaternion(_q).invert();
        bb.quaternion.copy(_q).multiply(camera.quaternion);
      }
    }
  });

  return (
    <group ref={root} name={`npc-${id}`}>
      <group ref={pivot}>
        <primitive object={rig.scene} scale={rig.scale} position={[0, rig.lift - rig.hipRest, 0]} />
      </group>
      <group ref={held}>
        <group name="guitar">
          <group position={[0, -0.17 * PROP_SCALE, 0]} scale={PROP_SCALE}>
            <KitModel geo={props.guitar} shadows={false} />
          </group>
        </group>
        <group name="hammer">
          <KitModel geo={props.hammer} shadows={false} />
        </group>
        <group name="stick">
          <KitModel geo={props.stick} shadows={false} />
        </group>
        <group name="book">
          <KitModel geo={props.book} shadows={false} />
        </group>
        <group name="car">
          <KitModel geo={props.car} shadows={false} />
        </group>
        <group name="basket">
          <KitModel geo={props.basket} shadows={false} />
        </group>
        <mesh name="pebble" geometry={props.pebble} material={kitMaterials().solid} />
      </group>
      <group ref={paper} position={[0, 0.01, look.height * 0.78]} visible={false}>
        <KitModel geo={props.paper} shadows="receive" />
      </group>
      <group ref={bubble} visible={false}>
        <KitModel geo={props.bubble} shadows={false} />
      </group>
    </group>
  );
}

/** If the character model can't load, the family just isn't drawn (the rest of the planet carries on). */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('The family could not be drawn (the character model failed to load).', err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The crafting table's top above the ground (u; craft/models.ts `TABLE.h`). */
const TABLE_TOP = 0.52;

/**
 * Prabin's things out in the world: the stick for fetch (flying, in Chopper's mouth, or lying where
 * he dropped it) and the birdhouse he's building on the crafting table.
 */
function PrabinProps({ controller, family }: { controller: GameController; family: Family }) {
  const geo = useMemo(() => ({ stick: stickModel(), birdhouse: birdhouseModel() }), []);
  const stick = useRef<Group>(null);
  const bird = useRef<Group>(null);
  const craft = controller.props.craft;
  const birdAt = useMemo(() => {
    if (!craft) return null;
    const n = moveAlong(craft.n, craft.facing, (CRAFT_STAND - 0.45) / R);
    const x = new Vector3().crossVectors(n, craft.facing).normalize();
    const z = new Vector3().crossVectors(x, n).normalize();
    return { p: n.clone().multiplyScalar(R + controller.terrain.height(n) + TABLE_TOP), q: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, n, z)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5)) };
  }, [craft, controller]);
  useFrame(() => {
    const p = family.get('prabin');
    const b = bird.current;
    if (b) b.visible = p.activity === 'hammer' && p.stage > 0;
    const s = stick.current;
    if (!s) return;
    const f = family.fetch;
    const dog = controller.chopper;
    s.visible = f.state !== 'none';
    if (!s.visible) return;
    let at: Vector3;
    let lift = 0.03;
    if (f.state === 'carried') {
      // in his mouth, crosswise
      at = moveAlong(dog.n, dog.dir, 0.3 / R);
      lift = 0.33;
    } else if (f.state === 'thrown' && f.flight < 0.6) {
      // a little arc from the hand to where it lands
      const k = f.flight / 0.6;
      at = f.from.clone().lerp(f.stick, k).normalize();
      lift = 0.9 * (1 - k) + 1.1 * k * (1 - k) + 0.03;
    } else at = f.stick;
    s.position.copy(at).multiplyScalar(R + controller.terrain.walkHeight(at) + lift);
    s.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), at);
    s.rotateZ(Math.PI / 2);
    if (f.state === 'carried') s.rotateX(Math.atan2(dog.dir.x, dog.dir.z));
  });
  return (
    <>
      <group ref={stick} visible={false}>
        <KitModel geo={geo.stick} shadows={false} />
      </group>
      {birdAt && (
        <group ref={bird} position={birdAt.p} quaternion={birdAt.q} visible={false}>
          <KitModel geo={geo.birdhouse} />
        </group>
      )}
    </>
  );
}

/** Rojina, Laija, Lingjel and Prabin (docs: family.md, prabin-npc.md). */
export function FamilyView({ controller, family }: { controller: GameController; family: Family }) {
  return (
    <Boundary>
      <Suspense fallback={null}>
        {family.npcs.map((n) => (
          <Person key={n.id} controller={controller} family={family} id={n.id} />
        ))}
      </Suspense>
      <PrabinProps controller={controller} family={family} />
    </Boundary>
  );
}
