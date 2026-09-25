import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from 'zustand';
import { AnimationMixer, Box3, Group, LoopOnce, Matrix4, Quaternion, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { damp } from '../math/sphere';
import { contactPhase, crossedPhase } from '../audio/audioLogic';
import { ProceduralAvatar } from './Character';
import { CHARACTERS, characterById, type CharacterId } from './characters';
import { prefs } from '../platform/prefs';
import { withLampLights } from '../world/lampLights';
import { addOcclusionOutline, countOutlines } from './outline';
import { SEAT } from '../systems/seating';
import { selectAmbientPaused } from '../state/store';

const R = CONFIG.planetRadius;
/** Target standing height in world units (≈ door height plus a head; the planet camera is tuned for ~1.25 u). */
export const CHARACTER_HEIGHT = 1.25;
/** Kenney models face +Z like the sim's heading convention. */
const MODEL_YAW = 0;
/**
 * Ground speed (u/s) of the planted foot when the Run clip plays at 1× at CHARACTER_HEIGHT
 * (measured by animating the skeleton: ≈ 2.4 u/s). timeScale = speed / this, clamped.
 */
const RUN_CLIP_SPEED = 2.5;
const _foot = new Vector3();
/** Height of the rig's hip joints (u) when standing at CHARACTER_HEIGHT (measured from the skeleton). */
const HIP_Y = 0.4;
/** Seated, the hip joints sit this far above the seat (about half a thigh's thickness). */
const HIP_OVER_SEAT = 0.055;

type Limb = { side: 1 | -1; up: Object3D | null; leg: Object3D | null; foot: Object3D | null; toes: Object3D | null; arm: Object3D | null; fore: Object3D | null; hand: Object3D | null };

const _pq = new Quaternion();
const _aim = new Quaternion();
const _want = new Vector3();
const _cur = new Vector3();
const _fwd = new Vector3();
const _left = new Vector3();
const _dir = new Vector3();
const DOWN = new Vector3(0, -1, 0);

/** Turn `bone` (by weight `w`) so its child points along world direction `dir`, whatever the rig's local axes. */
function aimBone(bone: Object3D | null, child: Object3D | null, dir: Vector3, w: number): void {
  if (!bone || !child || !bone.parent) return;
  bone.parent.getWorldQuaternion(_pq).invert();
  _want.copy(dir).applyQuaternion(_pq).normalize();
  _cur.copy(child.position).applyQuaternion(bone.quaternion);
  if (_cur.lengthSq() < 1e-12) return;
  _aim.setFromUnitVectors(_cur.normalize(), _want).multiply(bone.quaternion);
  bone.quaternion.slerp(_aim, w);
}

/**
 * Sitting pose over whatever the mixer played (weight `w`): thighs forward along the seat, shins
 * hanging over its edge (feet swinging gently unless `still`), hands resting toward the knees.
 */
function sitPose(limbs: readonly Limb[], heading: number, w: number, time: number, still: boolean): void {
  _fwd.set(Math.sin(heading), 0, Math.cos(heading));
  _left.set(Math.cos(heading), 0, -Math.sin(heading));
  for (const l of limbs) {
    const kick = still ? 0 : Math.sin(time * 2.4 + (l.side > 0 ? 0 : Math.PI)) * 0.3;
    aimBone(l.up, l.leg, _dir.copy(_fwd).addScaledVector(DOWN, 0.1).addScaledVector(_left, 0.08 * l.side), w);
    aimBone(l.leg, l.foot, _dir.copy(DOWN).addScaledVector(_fwd, 0.18 + kick), w);
    aimBone(l.foot, l.toes, _dir.copy(_fwd).addScaledVector(DOWN, 0.25), w);
    aimBone(l.arm, l.fore, _dir.copy(DOWN).addScaledVector(_fwd, 0.15).addScaledVector(_left, 0.16 * l.side), w);
    aimBone(l.fore, l.hand, _dir.copy(_fwd).addScaledVector(DOWN, 0.9).addScaledVector(_left, -0.08 * l.side), w);
  }
}

// Start fetching the chosen character as soon as the game chunk loads (no Draco/Meshopt → no decoder CDN requests).
useGLTF.preload(characterById(prefs.getCharacter()).url, false, false);

/** Rigged CC0 character (Kenney "Animated Characters: Protagonists") with idle/run blending. */
function KenneyAvatar({ controller, id }: { controller: GameController; id: CharacterId }) {
  const { scene, animations } = useGLTF(characterById(id).url, false, false);
  const root = useRef<Group>(null);

  const fit = useMemo(() => {
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
        const mat = m.material as MeshStandardMaterial;
        mat.roughness = 0.85;
        mat.metalness = 0;
        // walking under a lamp lights the character too (once per cached material)
        if (!mat.userData.lamps) {
          withLampLights(mat);
          mat.userData.lamps = true;
          mat.needsUpdate = true;
        }
      }
    });
    // measure unscaled: a remount (switching back to this character) finds the cached scene already scaled
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene, true);
    const h = Math.max(1e-6, box.max.y - box.min.y);
    const s = CHARACTER_HEIGHT / h;
    return { scale: s, lift: -box.min.y * s };
  }, [scene]);

  // outline shows through whatever hides the character
  useEffect(() => {
    const remove = addOcclusionOutline(scene);
    const n = countOutlines(scene);
    controller.outlines += n;
    return () => {
      remove();
      controller.outlines -= n;
    };
  }, [scene, controller]);

  const { mixer, idle, run, jump } = useMemo(() => {
    const mx = new AnimationMixer(scene);
    const clip = (name: string) => animations.find((a) => a.name === name);
    const a = (name: string) => {
      const c = clip(name);
      return c ? mx.clipAction(c) : null;
    };
    return { mixer: mx, idle: a('idle'), run: a('run'), jump: a('jump') };
  }, [scene, animations]);

  useEffect(() => {
    controller.avatar = 'model';
    controller.avatarModel = id;
    idle?.play();
    run?.play();
    run?.setEffectiveWeight(0);
    if (jump) {
      jump.setLoop(LoopOnce, 1);
      jump.clampWhenFinished = false;
    }
    controller.onArrive = () => {
      if (!jump || controller.store.getState().reducedMotionUser || controller.store.getState().reducedMotionSystem) return;
      jump.reset().setEffectiveWeight(1).fadeIn(0.08).play();
    };
    return () => {
      controller.onArrive = null;
      controller.avatar = 'procedural';
      controller.avatarModel = null;
      mixer.stopAllAction();
    };
  }, [idle, run, jump, mixer, controller, id]);

  // when each foot lands in the run cycle (for footsteps), measured once from the clip itself
  const stepPhases = useMemo(() => {
    const clip = animations.find((a) => a.name === 'run');
    const feet = [scene.getObjectByName('LeftFoot'), scene.getObjectByName('RightFoot')];
    if (!clip || !feet[0] || !feet[1]) return [];
    const rest: Array<[Object3D, Matrix4]> = [];
    scene.traverse((o) => rest.push([o, o.matrix.clone()]));
    const mx = new AnimationMixer(scene);
    mx.clipAction(clip).play();
    const heights: number[][] = [[], []];
    for (let i = 0; i < 48; i++) {
      mx.setTime((clip.duration * i) / 48);
      scene.updateMatrixWorld(true);
      feet.forEach((f, k) => heights[k].push(f!.getWorldPosition(_foot).y));
    }
    mx.stopAllAction();
    mx.uncacheRoot(scene);
    for (const [o, m] of rest) m.decompose(o.position, o.quaternion, o.scale);
    scene.updateMatrixWorld(true);
    return heights.map((h) => contactPhase(h));
  }, [scene, animations]);
  const cycle = useRef(0);

  const limbs = useMemo<Limb[]>(() => {
    const b = (n: string) => scene.getObjectByName(n) ?? null;
    return (['Left', 'Right'] as const).map((s) => ({
      side: s === 'Left' ? 1 : -1,
      up: b(`${s}UpLeg`),
      leg: b(`${s}Leg`),
      foot: b(`${s}Foot`),
      toes: b(`${s}Toes`),
      arm: b(`${s}Arm`),
      fore: b(`${s}ForeArm`),
      hand: b(`${s}Hand`),
    }));
  }, [scene]);
  const seatGroup = useRef<Group>(null);
  const clock = useRef(0);

  const blend = useRef(0);
  const flying = useRef(false);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const sim = controller.sim;
    // take off with a hop (it lands with one too, via onArrive)
    const fly = sim.travel?.mode === 'flyover';
    if (fly && !flying.current && jump) jump.reset().setEffectiveWeight(1).fadeIn(0.08).play();
    flying.current = fly;
    const speed = sim.speed;
    if (root.current) root.current.rotation.y = sim.heading + MODEL_YAW;
    blend.current = damp(blend.current, Math.min(1, speed / 1.2), 10, dt);
    // While the arrival hop plays it dominates the blend.
    const hop = jump?.isRunning() ? 0.9 : 0;
    idle?.setEffectiveWeight((1 - blend.current) * (1 - hop));
    if (run) {
      run.setEffectiveWeight(blend.current * (1 - hop));
      run.timeScale = Math.min(1.7, Math.max(0.6, speed / RUN_CLIP_SPEED));
    }
    mixer.update(dt);
    // on a bench: lower the body onto the seat and pose the limbs over the animation
    clock.current += dt;
    const pose = controller.seatMotion.pose;
    if (seatGroup.current) seatGroup.current.position.y = pose * (SEAT.seatY - controller.lift + HIP_OVER_SEAT - HIP_Y);
    if (pose > 1e-3) sitPose(limbs, sim.heading, pose, clock.current, selectAmbientPaused(controller.store.getState()));
    if (run) {
      const t = (run.time / run.getClip().duration) % 1;
      if (blend.current > 0.35 && !jump?.isRunning() && crossedPhase(cycle.current, t, stepPhases)) controller.footstep();
      cycle.current = t;
    }
  });

  return (
    <group ref={root}>
      <group ref={seatGroup}>
        <primitive object={scene} scale={fit.scale} position={[0, fit.lift, 0]} />
      </group>
    </group>
  );
}

class AvatarBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('Character model failed to load; using the procedural avatar.', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Player: the rigged model when available, the procedural avatar while loading or if it fails. */
export function Player({ controller }: { controller: GameController }) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  // (no blob shadow: the character casts a real shadow from the sun and moon)
  useFrame(() => {
    if (group.current) group.current.position.y = R + controller.lift;
    // flying: the body rises above the ground under it
    if (body.current) body.current.position.y = controller.sim.hover;
  });
  const id = useStore(controller.store, (s) => s.character);
  // fetch the other character in the background once the game is up, so switching is instant
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const c of CHARACTERS) if (c.id !== id) useGLTF.preload(c.url, false, false);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [id]);
  const fallback = <ProceduralAvatar controller={controller} />;
  return (
    <group ref={group} position={[0, R, 0]} name="player">
      <group ref={body}>
        {/* keyed by character, so a failed model only falls back for that one */}
        <AvatarBoundary key={id} fallback={fallback}>
          <Suspense fallback={fallback}>
            <KenneyAvatar controller={controller} id={id} />
          </Suspense>
        </AvatarBoundary>
      </group>
    </group>
  );
}
