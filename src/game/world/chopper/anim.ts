/**
 * Chopper's animation (docs: chopper.md §3), all procedural on his skeleton:
 *
 * 1. **Locomotion**: one oscillator; each leg has a phase offset and a duty factor per gait (walk,
 *    trot, gallop), blended by speed. In stance the paw sweeps back at body speed (so it doesn't
 *    slide); in swing it lifts and comes forward. Two-bone IK puts each paw on its target.
 * 2. **Poses** (`CLIPS`): target joint values and paw targets, eased with critically damped springs.
 * 3. **Additive layers**: tail wag by mood, breathing, panting, barks, look-at, blinks.
 * 4. **Secondary**: ears and the tail on under-damped springs, kicked by the body's bounce.
 */
import type { Bone } from 'three';
import { Matrix4, Vector3 } from 'three';
import { BONES, PAW_H, bindPositions, type BoneName, type ChopperRig } from './model';

export type Clip = 'stand' | 'sit' | 'lie' | 'sniffGround' | 'sniffHigh' | 'scratch' | 'pant' | 'bark' | 'playBow' | 'headTilt' | 'shake' | 'lookUp';

export type LegId = 'fL' | 'fR' | 'hL' | 'hR';
export const LEGS: readonly LegId[] = ['fL', 'fR', 'hL', 'hR'];

// ---------------------------------------------------------------------------
// Gaits
// ---------------------------------------------------------------------------

export interface Gait {
  /** Phase offset per leg (fraction of the cycle). */
  offset: Record<LegId, number>;
  /** Fraction of the cycle each paw is on the ground. */
  duty: number;
  /** Paw lift at mid-swing (u). */
  lift: number;
}

/** Walk: 4-beat lateral sequence; trot: diagonal pairs; gallop: a small dog's bounding rotary gallop. */
export const GAITS: Record<'walk' | 'trot' | 'gallop', Gait> = {
  walk: { offset: { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, duty: 0.62, lift: 0.028 },
  trot: { offset: { hL: 0, fR: 0, hR: 0.5, fL: 0.5 }, duty: 0.5, lift: 0.042 },
  gallop: { offset: { hL: 0, hR: 0.1, fL: 0.5, fR: 0.6 }, duty: 0.38, lift: 0.055 },
};

/** Speeds (u/s) where each gait takes over. */
export const GAIT_SPEED = { trot: 0.95, gallop: 2.3 } as const;
/** Longest stride a paw can make (u): faster than that, the legs speed up instead (zoomies). */
const MAX_STRIDE = 0.2;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Blend weights of walk / trot / gallop at `speed`. */
export function gaitWeights(speed: number): { walk: number; trot: number; gallop: number } {
  const t = smooth(GAIT_SPEED.trot - 0.25, GAIT_SPEED.trot + 0.25, speed);
  const g = smooth(GAIT_SPEED.gallop - 0.35, GAIT_SPEED.gallop + 0.35, speed);
  return { walk: 1 - t, trot: t * (1 - g), gallop: g };
}

export interface GaitState {
  /** Cycle frequency (Hz). */
  freq: number;
  duty: number;
  lift: number;
  /** Paw travel per stance (u). */
  stride: number;
  offset: Record<LegId, number>;
  /** 0 walk … 1 gallop (drives the body's bounce and flex). */
  gallop: number;
  trot: number;
}

/** The blended gait at `speed` (u/s). */
export function gaitAt(speed: number): GaitState {
  const w = gaitWeights(speed);
  const duty = w.walk * GAITS.walk.duty + w.trot * GAITS.trot.duty + w.gallop * GAITS.gallop.duty;
  const lift = w.walk * GAITS.walk.lift + w.trot * GAITS.trot.lift + w.gallop * GAITS.gallop.lift;
  const base = 1.5 + speed * 0.75;
  // a short-legged dog takes quicker steps rather than longer ones
  const freq = Math.min(7, Math.max(base, (speed * duty) / MAX_STRIDE));
  const offset = {} as Record<LegId, number>;
  for (const leg of LEGS) {
    // circular blend of the phase offsets, so a changing gait never jumps
    let s = 0;
    let c = 0;
    for (const [k, wk] of Object.entries(w) as ['walk' | 'trot' | 'gallop', number][]) {
      const a = GAITS[k].offset[leg] * Math.PI * 2;
      s += Math.sin(a) * wk;
      c += Math.cos(a) * wk;
    }
    offset[leg] = ((Math.atan2(s, c) / (Math.PI * 2)) % 1 + 1) % 1;
  }
  return { freq, duty, lift, stride: (speed * duty) / freq, offset, gallop: w.gallop, trot: w.trot };
}

/**
 * Paw offset (u, dog-local: z forward, y up) from its rest spot at cycle phase `phase` (0…1).
 * Stance: from +stride/2 back to −stride/2 at a constant rate (= body speed); swing: lifted forward.
 */
export function pawOffset(g: Pick<GaitState, 'duty' | 'stride' | 'lift'>, phase: number): { z: number; y: number; swing: number } {
  const p = ((phase % 1) + 1) % 1;
  if (p < g.duty) return { z: g.stride / 2 - g.stride * (p / g.duty), y: 0, swing: 0 };
  const s = (p - g.duty) / (1 - g.duty);
  return { z: -g.stride / 2 + g.stride * s * s * (3 - 2 * s), y: g.lift * Math.sin(Math.PI * s), swing: Math.sin(Math.PI * s) };
}

// ---------------------------------------------------------------------------
// Two-bone IK (in a leg's sagittal plane)
// ---------------------------------------------------------------------------

/** Swing angle of a (z, y) vector: 0 straight down, + toward −z (back): the sign of a +X rotation. */
const swingAngle = (z: number, y: number) => Math.atan2(-z, -y);

/**
 * Rotations (about X) of a leg's upper and lower bones so the lower bone's end reaches (tz, ty)
 * from the upper bone's joint. `r1`, `r2`: the bones' rest offsets (z, y). `bend` +1 puts the middle
 * joint forward (a hind knee), −1 behind (a front elbow).
 */
export function solveLeg(tz: number, ty: number, r1: [number, number], r2: [number, number], bend: 1 | -1): [number, number] {
  const l1 = Math.hypot(r1[0], r1[1]);
  const l2 = Math.hypot(r2[0], r2[1]);
  const len = Math.hypot(tz, ty);
  const D = Math.min(Math.max(len, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999);
  const nz = len > 1e-9 ? tz / len : 0;
  const ny = len > 1e-9 ? ty / len : -1;
  const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const kz = nz * a + -ny * h * bend;
  const ky = ny * a + nz * h * bend;
  const rot1 = swingAngle(kz, ky) - swingAngle(r1[0], r1[1]);
  const rot2 = swingAngle(nz * D - kz, ny * D - ky) - swingAngle(r2[0], r2[1]) - rot1;
  return [rot1, rot2];
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

/** Animated channels: body joints (radians, or u for `rootY`/`rootZ`), then paw targets per leg. */
export const BODY_CH = [
  'rootY',
  'rootZ',
  'hipsX',
  'hipsZ',
  'spineX',
  'spineY',
  'chestX',
  'neckX',
  'neckY',
  'headX',
  'headY',
  'headZ',
  'jaw',
  'tongue',
  'earX',
  'earFlap',
  'tailX',
  'tailCurl',
  'lids',
] as const;
export type BodyCh = (typeof BODY_CH)[number];
export type LegCh = `${LegId}${'Z' | 'Y' | 'X' | 'P'}`;
export type Channel = BodyCh | LegCh;
export const CHANNELS: readonly Channel[] = [...BODY_CH, ...LEGS.flatMap((l) => (['Z', 'Y', 'X', 'P'] as const).map((a) => `${l}${a}` as LegCh))];
const CH_INDEX = Object.fromEntries(CHANNELS.map((c, i) => [c, i])) as Record<Channel, number>;

export type Pose = Partial<Record<Channel, number>>;

/** Each clip's pose; `t` is the time since it started (s), for the ones that move. */
export const CLIPS: Record<Clip, (t: number) => Pose> = {
  stand: (t) => ({ neckY: Math.sin(t * 0.4) * 0.12, headZ: Math.sin(t * 0.23) * 0.05 }),
  sit: (t) => ({
    rootY: -0.07,
    rootZ: -0.01,
    hipsX: -0.62,
    spineX: 0.12,
    chestX: 0.12,
    neckX: 0.18,
    headX: 0.2,
    neckY: Math.sin(t * 0.35) * 0.15,
    fLZ: 0.035,
    fRZ: 0.035,
    hLZ: 0.1,
    hRZ: 0.1,
    hLX: 0.018,
    hRX: 0.018,
    tailX: -0.5,
    tailCurl: -0.4,
  }),
  lie: (t) => ({
    rootY: -0.125,
    hipsX: -0.04,
    neckX: -0.12,
    headX: 0.05,
    neckY: Math.sin(t * 0.3) * 0.18,
    fLZ: 0.11,
    fRZ: 0.12,
    hLZ: 0.05,
    hRZ: 0.05,
    hLX: 0.035,
    hRX: 0.035,
    fLP: -0.35,
    fRP: -0.35,
    tailX: -1.1,
    tailCurl: -0.7,
    earFlap: 0.1,
  }),
  sniffGround: (t) => ({
    rootY: -0.025,
    chestX: 0.2,
    neckX: 0.72,
    headX: 0.55 + Math.sin(t * 17) * 0.035 * (Math.sin(t * 1.9) > 0 ? 1 : 0.2),
    headY: Math.sin(t * 1.3) * 0.18,
    fLZ: -0.015,
    fRZ: -0.015,
    tailX: 0.1,
  }),
  sniffHigh: (t) => ({
    hipsX: -0.28,
    rootY: -0.01,
    neckX: -0.3,
    headX: -0.32 + Math.sin(t * 16) * 0.03 * (Math.sin(t * 2.1) > 0 ? 1 : 0.2),
    fLY: 0.045,
    fLZ: 0.05,
    fLP: -0.5,
    hLZ: 0.03,
    hRZ: 0.03,
    tailX: 0.2,
  }),
  scratch: (t) => ({
    ...CLIPS.sit(t),
    headZ: -0.38,
    headX: 0.3,
    neckY: -0.25,
    neckX: 0.25,
    hRZ: 0.2,
    hRY: 0.13 + Math.sin(t * Math.PI * 2 * 7) * 0.022,
    hRX: 0.055 + Math.sin(t * Math.PI * 2 * 7) * 0.012,
    hRP: -0.6,
    lids: 0.55,
    earFlap: 0.15,
  }),
  pant: (t) => ({ ...CLIPS.stand(t), jaw: 0.3, tongue: 1, headX: -0.05 }),
  bark: () => ({ neckX: -0.15, headX: -0.1, tailX: 0.2 }),
  playBow: (t) => ({
    hipsX: 0.42,
    rootY: 0.005 + Math.abs(Math.sin(t * 5.5)) * 0.012,
    spineX: 0.08,
    neckX: -0.55,
    headX: -0.18,
    fLZ: 0.13,
    fRZ: 0.13,
    fLP: -1.0,
    fRP: -1.0,
    hLZ: -0.02,
    hRZ: -0.02,
    tailX: 0.35,
    earFlap: 0.2,
  }),
  headTilt: (t) => ({ ...CLIPS.stand(t), headZ: 0.42 * (Math.sin(t * 0.9) > -0.3 ? 1 : -1), neckY: 0.08, earX: -0.2, headX: -0.05 }),
  shake: (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t / 1.1));
    // a real dog's shake-off runs head to tail at ≈ 4–5 Hz; the head's part is kept small
    const w = Math.sin(t * Math.PI * 2 * 4.5) * env;
    return { hipsZ: w * 0.2, spineY: w * 0.22, headY: -w * 0.28, headZ: w * 0.2, neckY: -w * 0.12, lids: env * 0.8, tailX: 0.1, rootY: -0.01 * env };
  },
  lookUp: () => ({ neckX: -0.32, headX: -0.28, earX: -0.25, tailX: 0.25 }),
};

// ---------------------------------------------------------------------------
// The animator
// ---------------------------------------------------------------------------

export interface AnimInput {
  /** Ground speed (u/s). */
  speed: number;
  /** Turn rate (rad/s, + = left). */
  turn: number;
  clip: Clip;
  /** Seconds since the clip started. */
  clipTime: number;
  /** Tail wag excitement 0…1. */
  wag: number;
  /** Look direction relative to the body (rad), or null to look ahead. */
  look: { yaw: number; pitch: number } | null;
  /** Seconds since the last bark (large = none lately). */
  barkAge: number;
  /** Mouth open and tongue out (hot or excited). */
  pant: number;
  /** Reduce motion: stiff springs, no bounces. */
  reduced: boolean;
}

const _m = new Matrix4();
const _mi = new Matrix4();
const _v = new Vector3();

interface LegRig {
  id: LegId;
  side: 1 | -1;
  upper: Bone;
  lower: Bone;
  paw: Bone;
  /** The bone they hang from (chest / hips). */
  parent: Bone;
  r1: [number, number];
  r2: [number, number];
  bend: 1 | -1;
  /** Rest wrist / hock spot (dog-local). */
  rest: Vector3;
  front: boolean;
  /** The leg's full length (u): the farthest its paw can reach from the top joint. */
  reach: number;
}

export class ChopperAnim {
  /** Gait cycle phase (0…1). */
  phase = 0;
  private readonly x = new Float32Array(CHANNELS.length);
  private readonly v = new Float32Array(CHANNELS.length);
  private readonly target = new Float32Array(CHANNELS.length);
  private move = 0;
  private wagPhase = 0;
  private wagAmp = 0;
  private breath = 0;
  private blinkT = 2;
  private blink = 0;
  private ear = { x: 0, v: 0, flap: 0, fv: 0 };
  private tail = { x: 0, v: 0 };
  private lastBob = 0;
  private lastBobV = 0;
  /** The turn rate and the look, eased: the brain's heading can flick between frames (steering round
   * things), and a look target passing behind him flips from one side to the other. Fed straight to the
   * neck, either made his head shake like a vibration. */
  private turnS = 0;
  private lookY = 0;
  private lookP = 0;
  private legs: LegRig[];
  private readonly rest: Record<BoneName, Vector3>;
  private rand: () => number;

  constructor(private readonly rig: ChopperRig, rand: () => number = Math.random) {
    this.rand = rand;
    this.rest = bindPositions();
    const B = rig.bones;
    const at = (n: BoneName) => BONES.find((b) => b.name === n)!.at;
    const leg = (id: LegId, upper: BoneName, lower: BoneName, paw: BoneName, parent: BoneName, bend: 1 | -1): LegRig => ({
      id,
      side: id.endsWith('L') ? 1 : -1,
      upper: B[upper],
      lower: B[lower],
      paw: B[paw],
      parent: B[parent],
      r1: [at(lower)[2], at(lower)[1]],
      r2: [at(paw)[2], at(paw)[1]],
      bend,
      rest: this.rest[paw].clone().setY(PAW_H),
      front: id.startsWith('f'),
      reach: Math.hypot(at(lower)[2], at(lower)[1]) + Math.hypot(at(paw)[2], at(paw)[1]),
    });
    this.legs = [
      leg('fL', 'shoulderL', 'elbowL', 'wristL', 'chest', -1),
      leg('fR', 'shoulderR', 'elbowR', 'wristR', 'chest', -1),
      leg('hL', 'hipL', 'kneeL', 'hockL', 'hips', 1),
      leg('hR', 'hipR', 'kneeR', 'hockR', 'hips', 1),
    ];
  }

  /** Jump straight to a clip's pose (no easing), e.g. when he first appears. */
  snap(clip: Clip): void {
    this.fill(CLIPS[clip](0));
    this.x.set(this.target);
    this.v.fill(0);
  }

  private fill(p: Pose): void {
    this.target.fill(0);
    for (const k in p) this.target[CH_INDEX[k as Channel]] = p[k as Channel]!;
  }

  /** Advance by `dt` and pose the skeleton. */
  update(dt: number, inp: AnimInput): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const reduced = inp.reduced;
    // 1. the clip's pose, eased with critically damped springs
    this.fill(CLIPS[inp.clip](inp.clipTime));
    const w = reduced ? 22 : 11;
    const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < this.x.length; i++) {
        const a = w * w * (this.target[i] - this.x[i]) - 2 * w * this.v[i];
        this.v[i] += a * h;
        this.x[i] += this.v[i] * h;
      }
    }
    const P = (c: Channel) => this.x[CH_INDEX[c]];

    // 2. locomotion
    const moving = Math.min(1, Math.max(0, (inp.speed - 0.04) / 0.3));
    this.move += (moving - this.move) * (1 - Math.exp(-dt * 10));
    const g = gaitAt(Math.max(inp.speed, 0.05));
    this.phase = (this.phase + g.freq * dt * (this.move > 0.01 ? 1 : 0)) % 1;
    const mw = this.move;
    const ph = this.phase * Math.PI * 2;
    // body bounce: twice per cycle at the walk and trot, a rocking bound at the gallop
    const bob = mw * ((1 - g.gallop) * -Math.cos(ph * 2) * (0.004 + g.trot * 0.004) + g.gallop * Math.sin(ph) * 0.016);
    const gallopPitch = mw * g.gallop * Math.cos(ph) * 0.1;
    const flex = mw * g.gallop * Math.sin(ph) * 0.14;
    const ease = (rate: number) => (reduced ? 1 : 1 - Math.exp(-dt * rate));
    this.turnS += (Math.max(-3, Math.min(3, inp.turn)) - this.turnS) * ease(5);
    const roll = mw * (1 - g.gallop) * Math.sin(ph) * 0.035 - Math.max(-0.2, Math.min(0.2, this.turnS * 0.05)) * mw;
    const bobV = dt > 0 ? (bob - this.lastBob) / dt : 0;
    const bobA = dt > 0 ? (bobV - this.lastBobV) / dt : 0;
    this.lastBob = bob;
    this.lastBobV = bobV;

    // 3. additive layers
    const wagRate = 2.2 + inp.wag * 6;
    this.wagPhase += dt * wagRate * Math.PI * 2;
    this.wagAmp += (0.1 + inp.wag * 0.45 - this.wagAmp) * (1 - Math.exp(-dt * 4));
    this.breath += dt * (inp.pant > 0.5 ? 3.2 : 0.35) * Math.PI * 2;
    const breathe = Math.sin(this.breath) * (inp.pant > 0.5 ? 0.006 : 0.0025);
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.16;
      this.blinkT = 2 + this.rand() * 4.5;
    }
    this.blink = Math.max(0, this.blink - dt);
    const lids = Math.max(P('lids'), this.blink > 0 ? Math.sin((this.blink / 0.16) * Math.PI) : 0);
    const bark = inp.barkAge < 0.3 ? Math.sin((inp.barkAge / 0.3) * Math.PI) : 0;
    const look = inp.look;
    // (a target right behind him isn't looked at: over the shoulder it would flip side to side)
    const wantYaw = look && Math.abs(look.yaw) < 2.2 ? Math.max(-1.1, Math.min(1.1, look.yaw)) : 0;
    const wantPitch = look ? Math.max(-0.5, Math.min(0.5, look.pitch)) : 0;
    this.lookY += (wantYaw - this.lookY) * ease(5);
    this.lookP += (wantPitch - this.lookP) * ease(5);
    const lookYaw = this.lookY;
    const lookPitch = this.lookP;

    // 4. secondary: ears and tail on springs, kicked by the bounce and the head's motion
    const earK = reduced ? 20 : 26;
    const earZ = reduced ? 1 : 0.28;
    const earT = P('earX') - Math.min(0.5, mw * inp.speed * 0.12);
    const earA = earK * earK * (earT - this.ear.x) - 2 * earZ * earK * this.ear.v + (reduced ? 0 : bobA * 1.2);
    this.ear.v += earA * dt;
    this.ear.x += this.ear.v * dt;
    const flapT = P('earFlap') + mw * g.gallop * 0.25;
    const flapA = earK * earK * (flapT - this.ear.flap) - 2 * earZ * earK * this.ear.fv + (reduced ? 0 : -bobA * 0.8);
    this.ear.fv += flapA * dt;
    this.ear.flap += this.ear.fv * dt;
    const tailA = earK * earK * (P('tailX') - this.tail.x) - 2 * earZ * earK * this.tail.v + (reduced ? 0 : -bobA * 1.5);
    this.tail.v += tailA * dt;
    this.tail.x += this.tail.v * dt;

    // --- apply to the bones
    const B = this.rig.bones;
    const R = this.rest;
    B.hips.position.set(0, R.hips.y + P('rootY') + bob + breathe * 0.3 + bark * 0.012, R.hips.z + P('rootZ'));
    B.hips.rotation.set(P('hipsX') + gallopPitch, 0, P('hipsZ') + roll);
    B.spine.rotation.set(P('spineX') - flex * 0.5, P('spineY'), 0);
    B.chest.rotation.set(P('chestX') - flex * 0.5 + breathe, 0, 0);
    const bodyPitch = P('hipsX') + gallopPitch + P('spineX') - flex + P('chestX');
    B.neck.rotation.set(P('neckX') - bodyPitch * 0.35 + lookPitch * 0.4 - bark * 0.1, P('neckY') + lookYaw * 0.4 + this.turnS * 0.06, 0);
    B.head.rotation.set(P('headX') - bodyPitch * 0.3 + lookPitch * 0.6 - bark * 0.12, P('headY') + lookYaw * 0.6, P('headZ'));
    B.jaw.rotation.set(Math.max(P('jaw'), bark * 0.42) + (inp.pant > 0.5 ? Math.sin(this.breath) * 0.04 : 0), 0, 0);
    const tongue = Math.min(1, Math.max(0, P('tongue')));
    B.tongue.scale.setScalar(0.35 + tongue * 0.65);
    B.tongue.position.set(0, 0.004 - tongue * 0.008, 0.02 + tongue * 0.012);
    B.tongue.rotation.set(tongue * 0.45, 0, 0);
    const lid = 1 - Math.min(1, lids) * 0.88;
    B.eyeL.scale.set(1, lid, 1);
    B.eyeR.scale.set(1, lid, 1);
    for (const [e, e2, s] of [
      [B.earL, B.earL2, 1],
      [B.earR, B.earR2, -1],
    ] as const) {
      e.rotation.set(this.ear.x * 0.6 - B.head.rotation.x * 0.25, 0, s * (this.ear.flap + 0.02));
      e2.rotation.set(this.ear.x * 0.5 + this.ear.v * 0.01, 0, s * this.ear.flap * 0.5);
    }
    const wag = Math.sin(this.wagPhase) * this.wagAmp * (reduced ? 0.6 : 1);
    B.tail0.rotation.set(this.tail.x, wag, 0);
    const curl = P('tailCurl');
    B.tail1.rotation.set(0.1 + curl * 0.4, Math.sin(this.wagPhase - 0.6) * this.wagAmp * 0.5, 0);
    B.tail2.rotation.set(0.15 + curl * 0.3, Math.sin(this.wagPhase - 1.2) * this.wagAmp * 0.4, 0);
    B.tail3.rotation.set(0.1 + curl * 0.2, 0, 0);

    // legs: gait paw targets blended with the clip's, then IK in the parent bone's frame
    const target = (L: LegRig) => {
      const off = pawOffset(g, this.phase + g.offset[L.id]);
      const tz = L.rest.z + P(`${L.id}Z`) * (1 - mw) + off.z * mw;
      const lift = P(`${L.id}Y`) * (1 - mw) + off.y * mw;
      const tx = L.rest.x + L.side * P(`${L.id}X`) * (1 - mw);
      // dog-local target → the parent bone's frame
      _v.set(tx, L.rest.y + lift, tz).applyMatrix4(_mi);
      _m.copy(L.parent.matrixWorld).invert();
      _v.applyMatrix4(_m).sub(L.upper.position);
      return { off, lift };
    };
    // Foot IK's pelvis adjustment (as in Unity's and Unreal's foot IK): where a planted paw's target is
    // out of the leg's reach (a pose holding the chest high, a bark's bounce), lower the body just
    // enough that it reaches, so the paws stay on the ground instead of floating or dipping
    for (let pass = 0; pass < 3; pass++) {
      this.rig.root.updateMatrixWorld(true);
      _mi.copy(this.rig.root.matrixWorld);
      let drop = 0;
      for (const L of this.legs) {
        const { lift } = target(L);
        if (lift > 0.006) continue;
        // (the IK works in the leg's sagittal plane: its reach there is what counts)
        drop = Math.max(drop, Math.hypot(_v.z, _v.y) - L.reach * 0.995);
      }
      if (drop <= 1e-5) break;
      B.hips.position.y -= drop;
    }
    this.rig.root.updateMatrixWorld(true);
    _mi.copy(this.rig.root.matrixWorld);
    for (const L of this.legs) {
      const { off } = target(L);
      const [a1, a2] = solveLeg(_v.z, _v.y, L.r1, L.r2, L.bend);
      // the leg's splay out of its plane: measured against its length in that plane, so it can't flip
      // round when the paw is level with the joint (the play bow's forelegs: atan2(x, −y) jumped to ±π there)
      const lateral = Math.atan2(_v.x, Math.hypot(_v.y, _v.z)) * 0.8;
      L.upper.rotation.set(a1, 0, lateral);
      L.lower.rotation.set(a2, 0, 0);
      // keep the paw level with the ground (plus its own flex: folding back in swing, flat when lying)
      const parentPitch = L.front ? bodyPitch : P('hipsX') + gallopPitch;
      const flexPaw = off.swing * mw * (L.front ? 1.0 : 0.55) + P(`${L.id}P`) * (1 - mw);
      L.paw.rotation.set(-(parentPitch + a1 + a2) + flexPaw, 0, -lateral);
    }
  }
}
