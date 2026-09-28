import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { CapsuleGeometry, Group, Quaternion, SphereGeometry, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { selectReducedMotion } from '../state/store';
import { Kit, type KitGeometry, type V3 } from '../world/kit';
import { KitModel } from '../world/KitModel';
import { addOcclusionOutline, countOutlines } from './outline';
import { SEAT } from '../systems/seating';

/** The avatar's scale and its hip pivot height (local units), for sitting on benches. */
const AVATAR_SCALE = 0.96;
const HIP_PIVOT = 0.3;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const C = {
  skin: '#f6c29a',
  skinShade: '#eeaa82',
  blush: '#ff9d9d',
  hair: '#3a2622',
  hairHi: '#5a3a30',
  eye: '#33241d',
  iris: '#7b4a2c',
  sweater: '#5b8def',
  sweaterHi: '#7fa6f5',
  collar: '#fbfaf6',
  shorts: '#2f3a57',
  shoe: '#f25c54',
  sole: '#fbfaf6',
  strap: '#8a5534',
  bag: '#d59b5c',
  frame: '#2d2a32',
};

const HEAD_R = 0.3;
const HEAD_C: V3 = [0, 0.27, 0];
const Z = new Vector3(0, 0, 1);

/** Point + outward orientation on the head sphere (theta: yaw from +z toward +x, phi: elevation). */
function onHead(theta: number, phi: number, out = 0): { p: V3; q: Quaternion } {
  const n = new Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta));
  const p = n.clone().multiplyScalar(HEAD_R + out).add(new Vector3(...HEAD_C));
  return { p: [p.x, p.y, p.z], q: new Quaternion().setFromUnitVectors(Z, n) };
}

function buildHead(): KitGeometry {
  const k = new Kit();
  k.sphere(HEAD_R, C.skin, { p: HEAD_C, s: [1.04, 0.96, 1] }, [28, 20]);
  // ears
  for (const s of [-1, 1]) k.sphere(0.07, C.skin, { ...onHead(s * Math.PI * 0.5, 0, -0.02), s: [0.8, 1, 0.45] }, [12, 10]);
  // nose, blush, smile
  k.sphere(0.03, C.skinShade, onHead(0, -0.08, -0.005), [10, 8]);
  for (const s of [-1, 1]) k.sphere(0.055, C.blush, { ...onHead(s * 0.62, -0.13, -0.012), s: [1.2, 0.8, 0.25] }, [12, 8]);
  k.group(onHead(0, -0.25, -0.004), () => k.torus(0.045, 0.009, C.eye, { r: [0, 0, Math.PI] }, Math.PI, [5, 14]));
  // round glasses (the designer's signature)
  for (const s of [-1, 1]) k.group(onHead(s * 0.36, 0.03, 0.035), () => k.torus(0.078, 0.01, C.frame, {}, Math.PI * 2, [5, 22]));
  k.group(onHead(0, 0.06, 0.05), () => k.box([0.07, 0.016, 0.016], C.frame, {}, 0.006));
  for (const s of [-1, 1]) k.box([0.016, 0.016, 0.22], C.frame, { p: [s * 0.29, HEAD_C[1] + 0.03, 0.08], r: [0, s * 0.1, 0] }, 0.006);
  // hair: back shell + top cap + fringe + cowlick
  k.sphere(HEAD_R + 0.025, C.hair, { p: HEAD_C, s: [1.04, 0.96, 1] }, [24, 16], 'solid', [Math.PI, Math.PI, 0, 2.05]);
  k.sphere(HEAD_R + 0.03, C.hair, { p: HEAD_C, s: [1.05, 0.97, 1.02] }, [24, 12], 'solid', [0, Math.PI * 2, 0, 0.95]);
  const fringe: [number, number, number][] = [
    [-0.42, 0.5, 0.12],
    [-0.12, 0.56, 0.13],
    [0.2, 0.55, 0.12],
    [0.5, 0.46, 0.1],
  ];
  fringe.forEach(([theta, phi, r], i) => {
    const h = onHead(theta, phi, 0.0);
    k.blob(r, i % 2 ? C.hair : C.hairHi, { p: h.p, q: h.q, s: [1.25, 0.7, 0.55] }, 1);
  });
  k.cone(0.05, 0.14, C.hair, { p: [0.04, HEAD_C[1] + HEAD_R + 0.07, -0.05], r: [-0.5, 0, 0.3] }, 8);
  return k.build();
}

function buildEyes(): KitGeometry {
  const k = new Kit();
  for (const s of [-1, 1]) {
    // positions are relative to the eye line (group is placed at eye height for blinking)
    const h = onHead(s * 0.36, 0.03, 0);
    h.p[1] -= HEAD_C[1] + Math.sin(0.03) * HEAD_R;
    k.group({ p: h.p, q: h.q }, () => {
      k.sphere(0.062, C.eye, { s: [0.82, 1, 0.3] }, [14, 10]);
      k.sphere(0.042, C.iris, { p: [0, -0.006, 0.012], s: [0.82, 1, 0.3] }, [12, 8]);
      k.sphere(0.018, '#ffffff', { p: [-0.016, 0.024, 0.022] }, [8, 6]);
      k.sphere(0.009, '#ffffff', { p: [0.018, -0.016, 0.022] }, [6, 4]);
    });
  }
  return k.build();
}

function buildTorso(): KitGeometry {
  const k = new Kit();
  // shorts
  k.lathe(
    [
      [0.001, 0.28],
      [0.18, 0.28],
      [0.2, 0.38],
      [0.2, 0.46],
      [0.001, 0.46],
    ],
    C.shorts,
    {},
    18,
  );
  // knit sweater
  k.lathe(
    [
      [0.001, 0.4],
      [0.205, 0.4],
      [0.22, 0.48],
      [0.21, 0.62],
      [0.16, 0.72],
      [0.001, 0.75],
    ],
    C.sweater,
    {},
    20,
  );
  k.torus(0.208, 0.022, C.sweaterHi, { p: [0, 0.415, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [6, 22]);
  for (let i = 0; i < 4; i++) k.torus(0.214, 0.006, C.sweaterHi, { p: [0, 0.5 + i * 0.045, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 22]);
  k.torus(0.1, 0.03, C.collar, { p: [0, 0.73, 0.0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [6, 18]);
  // crossbody bag
  k.torus(0.235, 0.014, C.strap, { p: [0, 0.56, 0], r: [Math.PI / 2 + 0.05, 0.75, 0] }, Math.PI * 2, [4, 28]);
  k.box([0.16, 0.13, 0.06], C.bag, { p: [-0.2, 0.42, 0.1], r: [0, -0.6, 0.1] }, 0.03);
  k.box([0.16, 0.05, 0.065], '#b97f45', { p: [-0.2, 0.46, 0.105], r: [0, -0.6, 0.1] }, 0.02);
  return k.build();
}

function buildArm(): KitGeometry {
  const k = new Kit();
  k.add(new CapsuleGeometry(0.066, 0.1, 4, 12), C.sweater, { p: [0, -0.08, 0] });
  k.torus(0.058, 0.014, C.sweaterHi, { p: [0, -0.15, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 14]);
  k.add(new CapsuleGeometry(0.048, 0.08, 4, 10), C.skin, { p: [0, -0.2, 0] });
  k.add(new SphereGeometry(0.062, 14, 10), C.skin, { p: [0, -0.28, 0.005] });
  return k.build();
}

function buildLeg(): KitGeometry {
  const k = new Kit();
  k.add(new CapsuleGeometry(0.058, 0.12, 4, 10), C.skin, { p: [0, -0.1, 0] });
  k.cyl(0.062, 0.062, 0.05, C.collar, { p: [0, -0.2, 0] }, 12);
  k.box([0.13, 0.085, 0.21], C.shoe, { p: [0, -0.245, 0.035] }, 0.04);
  k.box([0.135, 0.03, 0.215], C.sole, { p: [0, -0.28, 0.035] }, 0.012);
  k.box([0.07, 0.02, 0.06], C.sole, { p: [0, -0.2, 0.09] }, 0.008);
  return k.build();
}

/** Procedural fallback avatar: chibi proportions, walk/run, idle breathing and blinking. */
export function ProceduralAvatar({ controller }: { controller: GameController }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const phase = useRef(0);
  const time = useRef(0);
  const nextBlink = useRef(2.5);
  const reduced = useStore(controller.store, selectReducedMotion);

  const parts = useMemo(() => ({ head: buildHead(), eyes: buildEyes(), torso: buildTorso(), arm: buildArm(), leg: buildLeg() }), []);

  // outline shows through whatever hides the character (as for the rigged model)
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const remove = addOcclusionOutline(r);
    const n = countOutlines(r);
    controller.outlines += n;
    return () => {
      remove();
      controller.outlines -= n;
    };
  }, [controller]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const sim = controller.sim;
    const speed = sim.speed;
    time.current += dt;
    if (root.current) root.current.rotation.y = sim.heading;
    // on a bench: raise the hips to the seat, legs out along it and hands forward
    const sit = controller.seatMotion.pose;
    const seatY = controller.seatMotion.seat?.height ?? SEAT.seatY;
    if (root.current) root.current.position.y = (sit * (seatY - controller.lift + 0.06 - HIP_PIVOT * AVATAR_SCALE)) / AVATAR_SCALE;
    // on the swing: the legs pump and the hands hold the ropes (the Player swings the whole body)
    const ride = controller.ride;
    const kick = reduced ? 0 : Math.sin(time.current * 2.4) * 0.18;
    const walk = Math.min(1, speed / CONFIG.walkSpeed);
    const run = Math.min(1, Math.max(0, (speed - CONFIG.walkSpeed) / (CONFIG.runSpeed - CONFIG.walkSpeed)));
    const stride = Math.floor(phase.current / Math.PI + 0.5);
    phase.current += speed * dt * 4.4;
    // a foot plants at each end of the leg swing (sin = ±1)
    if (Math.floor(phase.current / Math.PI + 0.5) !== stride) controller.footstep();
    const s = Math.sin(phase.current);
    const legSwing = s * (0.55 + 0.35 * run) * walk;
    const armSwing = s * (0.6 + 0.5 * run) * walk;
    const pump = ride ? ride.pump * 0.45 : 0;
    if (legL.current) legL.current.rotation.x = mix(legSwing, -1.15 + (ride ? -pump : kick), sit);
    if (legR.current) legR.current.rotation.x = mix(-legSwing, -1.15 - (ride ? pump : kick), sit);
    const arms = ride ? -2.7 : -0.55;
    if (armL.current) {
      armL.current.rotation.x = mix(-armSwing, arms, sit);
      armL.current.rotation.z = 0.14 + run * 0.1;
    }
    if (armR.current) {
      armR.current.rotation.x = mix(armSwing, arms, sit);
      armR.current.rotation.z = -0.14 - run * 0.1;
    }
    if (body.current) {
      const bob = reduced ? 0 : Math.abs(Math.cos(phase.current)) * 0.045 * walk;
      const breathe = reduced ? 0 : Math.sin(time.current * 2.2) * 0.008 * (1 - walk);
      body.current.position.y = bob;
      body.current.rotation.x = reduced ? 0 : 0.1 * walk + 0.12 * run;
      body.current.scale.set(1, 1 + breathe, 1);
    }
    if (head.current) head.current.rotation.z = reduced ? 0 : Math.sin(phase.current) * 0.04 * walk;
    // action cycles: the arms follow the same poses (forward component → swing, up → raise), the body bends
    const act = controller.action;
    const ap = act.kind && controller.actionPose?.(act.kind, act.t);
    if (ap) {
      const w = ap.w;
      const armAngle = (d: readonly [number, number, number]) => -Math.atan2(d[0], -d[1]);
      if (armL.current) armL.current.rotation.x = mix(armL.current.rotation.x, armAngle(ap.arms.l.upper), w);
      if (armR.current) armR.current.rotation.x = mix(armR.current.rotation.x, armAngle(ap.arms.r.upper), w);
      if (body.current) body.current.rotation.x = mix(body.current.rotation.x, Math.atan2(ap.spine[0], ap.spine[1]), w);
      if (root.current) root.current.position.y -= (ap.hip * w) / AVATAR_SCALE;
    }
    // blink
    if (eyes.current) {
      if (time.current > nextBlink.current) {
        const b = time.current - nextBlink.current;
        eyes.current.scale.y = b < 0.07 ? 1 - b / 0.07 : b < 0.14 ? (b - 0.07) / 0.07 : 1;
        if (b >= 0.14) nextBlink.current = time.current + 2.2 + Math.random() * 2.8;
      }
      eyes.current.scale.y = Math.max(0.08, eyes.current.scale.y);
    }
  });

  const eyeY = HEAD_C[1] + Math.sin(0.03) * HEAD_R;

  return (
    <group name="procedural-avatar" scale={AVATAR_SCALE}>
      <group ref={root}>
        <group ref={legL} position={[0.09, 0.3, 0]}>
          <KitModel geo={parts.leg} />
        </group>
        <group ref={legR} position={[-0.09, 0.3, 0]}>
          <KitModel geo={parts.leg} />
        </group>
        <group ref={body}>
          <KitModel geo={parts.torso} />
          <group ref={armL} position={[0.22, 0.66, 0]}>
            <KitModel geo={parts.arm} />
          </group>
          <group ref={armR} position={[-0.22, 0.66, 0]}>
            <KitModel geo={parts.arm} />
          </group>
          <group ref={head} position={[0, 0.72, 0]}>
            <KitModel geo={parts.head} />
            <group ref={eyes} position={[0, eyeY, 0]}>
              <KitModel geo={parts.eyes} shadows={false} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
