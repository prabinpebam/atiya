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
import { damp, tangentToward } from '../../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../../state/store';
import { aimBone } from '../../player/Player';
import { characterById, type CharacterId } from '../../player/characters';
import { withLampLights } from '../lampLights';
import { kitMaterials } from '../materials';
import { KitModel } from '../KitModel';
import type { Family, NpcId } from './family';
import { bodyPose, HIP_FRACTION } from './poses';
import { bookModel, bubbleModel, toyCarModel, paperModel } from './models';
import { Kit } from '../kit';

const R = CONFIG.planetRadius;
/** Ground speed (u/s) of the run clip at 1× for a 1.25 u character (as the player's avatar). */
const RUN_CLIP_SPEED = 2.5;

/** How each of them looks (docs: family.md §4). */
export const LOOKS: Record<NpcId, { model: CharacterId; height: number; head: number; skin: string; hair: 'pigtails' | null; glasses: boolean; book: string }> = {
  // Rojina wears Sunny's model: its ponytail and scrunchie take her atlas's dark hair and teal tee
  rojina: { model: 'sunny', height: 1.18, head: 1, skin: '/models/skins/rojina.png', hair: null, glasses: true, book: '#6f9fc8' },
  laija: { model: 'skater', height: 0.92, head: 1.12, skin: '/models/skins/laija.png', hair: 'pigtails', glasses: false, book: '#e2554c' },
  lingjel: { model: 'skater', height: 0.74, head: 1.2, skin: '/models/skins/lingjel.png', hair: null, glasses: false, book: '#3fb45a' },
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

  useFrame((_, rawDt) => {
    const g = root.current;
    const pv = pivot.current;
    if (!g || !pv) return;
    const dt = Math.min(rawDt, 0.1);
    if (!paused) clock.current += dt;
    // in the house for the night: not drawn (the lit windows say they're home)
    g.visible = !npc.indoors;
    if (npc.indoors) return;
    // on the planet, facing their way
    const h = controller.terrain.walkHeight(npc.n);
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
    const hipTarget = bp.hip === null ? rig.hipRest : bp.hip * look.height;
    hipNow.current = hipNow.current === null || reduced ? hipTarget : damp(hipNow.current, hipTarget, 8, dt);
    pitchNow.current = reduced ? bp.pitch : damp(pitchNow.current, bp.pitch, 7, dt);
    backNow.current = reduced ? (bp.back ?? 0) : damp(backNow.current, bp.back ?? 0, 8, dt);
    pv.position.set(0, hipNow.current, -backNow.current * look.height);
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
        if (kind === 'book' || kind === 'basket') hm.position.copy(a).add(b).multiplyScalar(0.5);
        else hm.position.copy(b);
        if (kind === 'car' && npc.pose === 'crawl') hm.position.y = 0.01;
        // the pebble leaves the hand at the throw and comes back with the next one
        const c = npc.poseT % 1.6;
        if (kind === 'pebble') hm.visible = !(c > 0.55 && c < 1.25);
        else hm.visible = true;
        hm.rotation.set(kind === 'book' ? -0.9 : 0, 0, 0);
        if (kind === 'book') hm.position.addScaledVector(_up.set(0, 1, 0), 0.03).z += 0.04;
      } else hm.visible = false;
    }
    if (paper.current) paper.current.visible = npc.pose === 'paint';
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

/** Rojina, Laija and Lingjel (docs: family.md). */
export function FamilyView({ controller, family }: { controller: GameController; family: Family }) {
  return (
    <Boundary>
      <Suspense fallback={null}>
        {family.npcs.map((n) => (
          <Person key={n.id} controller={controller} family={family} id={n.id} />
        ))}
      </Suspense>
    </Boundary>
  );
}
