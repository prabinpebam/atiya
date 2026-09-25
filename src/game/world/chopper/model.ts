/**
 * Chopper's body (docs: chopper.md §2): a Lhasa Apso built from smooth blobs and capsules, merged
 * into one skinned mesh on a small skeleton, with per-vertex fur length, gloss and colour for the
 * shell-fur material (`fur.ts`). Every furry part is repeated as `shells` offset copies in the same
 * geometry (one draw call); the fur shader pushes each copy out along its normal.
 *
 * Dog-local frame: +z forward, +y up, paws on y = 0. About 0.62 u nose to tail, 0.46 u to the top
 * of the head: knee-high beside the 1.25 u character, like a real Lhasa beside a person.
 *
 * Skin weights are **envelopes**: each vertex is bound to the nearest bones of its own part's chain
 * by inverse-square distance to their segments (top 4, normalised), so joints bend smoothly.
 */
import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Skeleton,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash3 } from '../kit';

export type BoneName =
  | 'root'
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'jaw'
  | 'tongue'
  | 'eyeL'
  | 'eyeR'
  | 'earL'
  | 'earL2'
  | 'earR'
  | 'earR2'
  | 'tail0'
  | 'tail1'
  | 'tail2'
  | 'tail3'
  | 'shoulderL'
  | 'elbowL'
  | 'wristL'
  | 'shoulderR'
  | 'elbowR'
  | 'wristR'
  | 'hipL'
  | 'kneeL'
  | 'hockL'
  | 'hipR'
  | 'kneeR'
  | 'hockR';

type V3 = [number, number, number];

/** Skeleton: parent and offset from it (dog-local units). Every bone starts with no rotation. */
export const BONES: ReadonlyArray<{ name: BoneName; parent: BoneName | null; at: V3 }> = [
  { name: 'root', parent: null, at: [0, 0, 0] },
  { name: 'hips', parent: 'root', at: [0, 0.235, -0.13] },
  { name: 'spine', parent: 'hips', at: [0, 0.01, 0.1] },
  { name: 'chest', parent: 'spine', at: [0, 0, 0.11] },
  { name: 'neck', parent: 'chest', at: [0, 0.05, 0.06] },
  { name: 'head', parent: 'neck', at: [0, 0.095, 0.045] },
  { name: 'jaw', parent: 'head', at: [0, -0.04, 0.045] },
  { name: 'tongue', parent: 'jaw', at: [0, 0.004, 0.02] },
  { name: 'eyeL', parent: 'head', at: [0.035, 0.019, 0.06] },
  { name: 'eyeR', parent: 'head', at: [-0.035, 0.019, 0.06] },
  { name: 'earL', parent: 'head', at: [0.066, 0.035, -0.01] },
  { name: 'earL2', parent: 'earL', at: [0.012, -0.075, 0.004] },
  { name: 'earR', parent: 'head', at: [-0.066, 0.035, -0.01] },
  { name: 'earR2', parent: 'earR', at: [-0.012, -0.075, 0.004] },
  { name: 'tail0', parent: 'hips', at: [0, 0.035, -0.075] },
  { name: 'tail1', parent: 'tail0', at: [0, 0.055, -0.025] },
  { name: 'tail2', parent: 'tail1', at: [0, 0.045, 0.02] },
  { name: 'tail3', parent: 'tail2', at: [0, 0.015, 0.045] },
  { name: 'shoulderL', parent: 'chest', at: [0.058, -0.03, 0.015] },
  { name: 'elbowL', parent: 'shoulderL', at: [0, -0.08, -0.03] },
  { name: 'wristL', parent: 'elbowL', at: [0, -0.08, 0.025] },
  { name: 'shoulderR', parent: 'chest', at: [-0.058, -0.03, 0.015] },
  { name: 'elbowR', parent: 'shoulderR', at: [0, -0.08, -0.03] },
  { name: 'wristR', parent: 'elbowR', at: [0, -0.08, 0.025] },
  { name: 'hipL', parent: 'hips', at: [0.06, -0.03, -0.02] },
  { name: 'kneeL', parent: 'hipL', at: [0, -0.075, 0.035] },
  { name: 'hockL', parent: 'kneeL', at: [0, -0.08, -0.04] },
  { name: 'hipR', parent: 'hips', at: [-0.06, -0.03, -0.02] },
  { name: 'kneeR', parent: 'hipR', at: [0, -0.075, 0.035] },
  { name: 'hockR', parent: 'kneeR', at: [0, -0.08, -0.04] },
];

export const BONE_INDEX: Record<BoneName, number> = Object.fromEntries(BONES.map((b, i) => [b.name, i])) as Record<BoneName, number>;

/** Height of the wrists and hocks above the paw soles (u). */
export const PAW_H = 0.05;

/** Bind-pose (rest) position of every bone in dog-local space. */
export function bindPositions(): Record<BoneName, Vector3> {
  const out = {} as Record<BoneName, Vector3>;
  for (const b of BONES) {
    const p = new Vector3(...b.at);
    if (b.parent) p.add(out[b.parent]);
    out[b.name] = p;
  }
  return out;
}

/** Where each bone's segment ends (its chain child, or a short reach past a leaf), for the envelope weights. */
const SEGMENT_END: Partial<Record<BoneName, BoneName | V3>> = {
  root: 'hips',
  hips: 'spine',
  spine: 'chest',
  chest: 'neck',
  neck: 'head',
  head: [0, -0.01, 0.07],
  jaw: [0, 0, 0.05],
  tongue: [0, 0, 0.03],
  earL: 'earL2',
  earL2: [0.004, -0.06, 0],
  earR: 'earR2',
  earR2: [-0.004, -0.06, 0],
  tail0: 'tail1',
  tail1: 'tail2',
  tail2: 'tail3',
  tail3: [0, 0, 0.03],
  shoulderL: 'elbowL',
  elbowL: 'wristL',
  wristL: [0, -PAW_H * 0.8, 0.01],
  shoulderR: 'elbowR',
  elbowR: 'wristR',
  wristR: [0, -PAW_H * 0.8, 0.01],
  hipL: 'kneeL',
  kneeL: 'hockL',
  hockL: [0, -PAW_H * 0.8, 0.01],
  hipR: 'kneeR',
  kneeR: 'hockR',
  hockR: [0, -PAW_H * 0.8, 0.01],
};

function segmentEnds(bind: Record<BoneName, Vector3>): Record<BoneName, Vector3> {
  const out = {} as Record<BoneName, Vector3>;
  for (const b of BONES) {
    const e = SEGMENT_END[b.name];
    out[b.name] = !e ? bind[b.name].clone() : typeof e === 'string' ? bind[e].clone() : bind[b.name].clone().add(new Vector3(...e));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Palette (after his photos)
// ---------------------------------------------------------------------------

export const CHOPPER_COLOURS = {
  white: '#f3eee4',
  cream: '#e9dfcd',
  tan: '#b9a58c',
  greyTan: '#9d8f80',
  ear: '#2a2522',
  earTip: '#c9c0b4',
  nose: '#161212',
  eye: '#24170f',
  pad: '#2b2320',
  tongue: '#e46f86',
  mouth: '#5a3434',
  collar: '#3e6fb0',
  tag: '#cf3438',
  shine: '#ffffff',
} as const;

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

interface Part {
  geo: BufferGeometry;
  /** Bones this part may bind to (its own chain plus its parent). */
  bones: BoneName[];
  /** Colour per vertex, from its bind position and normal. */
  paint: (p: Vector3, n: Vector3) => Color;
  /** Fur length (u) per vertex; 0 = bare (eyes, nose, pads, tongue, collar, tag). */
  fur: (p: Vector3, n: Vector3) => number;
  /** Which way the coat lies (dog-local; its length is how strongly the strands bend that way). */
  comb: (p: Vector3, n: Vector3) => V3;
  /** 0 = matte fur … 1 = wet nose / eyes. */
  gloss: number;
}

const _c = new Color();
const col = (hex: string) => new Color(hex);
const mixc = (a: string, b: string, t: number) => _c.set(a).lerp(col(b), Math.min(1, Math.max(0, t))).clone();
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** An ellipsoid blob at `c` with radii `r`, gently lumpy so it reads organic. */
function blob(c: V3, r: V3, detail = 2, lump = 0.06, seed = 0, rot?: V3): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + (hash3(Math.round(v.x * 3) + seed, Math.round(v.y * 3), Math.round(v.z * 3)) - 0.5) * lump;
    pos.setXYZ(i, v.x * r[0] * k, v.y * r[1] * k, v.z * r[2] * k);
  }
  if (rot) g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rot[0], rot[1], rot[2])));
  g.translate(c[0], c[1], c[2]);
  g.computeVertexNormals();
  return g;
}

/** A capsule from `a` to `b` with radius `r`. */
function limb(a: Vector3, b: Vector3, r: number): BufferGeometry {
  const len = a.distanceTo(b);
  let g: BufferGeometry = new CapsuleGeometry(r, Math.max(1e-3, len), 3, 8);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  g.computeVertexNormals();
  return g;
}

/** A torus ring (the collar) round `c`, its axis along `axis`. */
function ring(c: Vector3, axis: Vector3, radius: number, tube: number): BufferGeometry {
  let g: BufferGeometry = new TorusGeometry(radius, tube, 6, 28);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis.clone().normalize()));
  g.translate(c.x, c.y, c.z);
  g.computeVertexNormals();
  return g;
}

const bare = () => 0;
const NONE: V3 = [0, 0, 0];

function parts(): Part[] {
  const C = CHOPPER_COLOURS;
  const B = bindPositions();
  const out: Part[] = [];
  const add = (geo: BufferGeometry, bones: BoneName[], paint: Part['paint'], fur: Part['fur'] | number, comb: Part['comb'] | V3 = NONE, gloss = 0) =>
    out.push({ geo, bones, paint, fur: typeof fur === 'number' ? () => fur : fur, comb: typeof comb === 'function' ? comb : () => comb, gloss });
  const white = (p: Vector3) => mixc(C.white, C.cream, 0.3 - p.y * 0.7 + hash3(p.x * 40, p.y * 40, p.z * 40) * 0.25);
  // the long coat parts along the spine and falls down each side, a little toward the tail
  const coat = (p: Vector3): V3 => [Math.sign(p.x) * 0.45, -0.85, -0.25];

  // --- body: barrel torso, deep chest, rump; a skirt of longer fur under the belly
  add(blob([0, 0.24, -0.035], [0.1, 0.098, 0.19], 3, 0.05, 1), ['hips', 'spine', 'chest'], white, (p) => 0.04 + Math.max(0, 0.2 - p.y) * 0.3, coat);
  add(blob([0, 0.235, 0.075], [0.094, 0.104, 0.092], 2, 0.06, 2), ['spine', 'chest', 'neck'], white, (p) => 0.042 + Math.max(0, 0.22 - p.y) * 0.3, (p) => [Math.sign(p.x) * 0.35, -0.9, 0.1]);
  add(blob([0, 0.24, -0.15], [0.092, 0.092, 0.082], 2, 0.06, 3), ['hips', 'spine'], white, 0.042, coat);
  // --- neck (the collar sits on it)
  add(blob([0, 0.305, 0.135], [0.068, 0.073, 0.066], 2, 0.05, 4), ['chest', 'neck', 'head'], white, 0.036, (p) => [Math.sign(p.x) * 0.4, -0.8, 0]);

  // --- head: round skull, short square muzzle, fringe and a white beard; soft grey-tan about the eyes and crown
  const head = B.head;
  const eyeAt = [B.eyeL, B.eyeR];
  // the fur thins right round the eyes, so they peek out under the fringe as in his photos
  const clear = (p: Vector3) => smoothstep(0.017, 0.04, Math.min(p.distanceTo(eyeAt[0]), p.distanceTo(eyeAt[1])));
  const face = (p: Vector3, n: Vector3) => {
    const up = p.y - head.y;
    const back = head.z + 0.02 - p.z;
    // grey-tan on the crown and round the eyes (the face mask), white muzzle and beard
    const eyes = Math.max(0, 1 - Math.hypot((Math.abs(p.x) - 0.036) / 0.032, (p.y - head.y - 0.022) / 0.03)) * (n.z > 0 ? 1 : 0.5);
    const crown = smoothstep(0.01, 0.07, up) * 0.75 + smoothstep(0, 0.07, back) * 0.35;
    const t = Math.min(1, crown + eyes * 0.6);
    return mixc(C.white, t > 0.55 ? C.greyTan : C.tan, t * 0.85 + (hash3(p.x * 60, p.y * 60, p.z * 60) - 0.5) * 0.15);
  };
  add(blob([0, head.y + 0.005, head.z - 0.005], [0.082, 0.077, 0.076], 3, 0.04, 5), ['neck', 'head'], face, (p) => (p.y > head.y + 0.03 ? 0.046 : 0.032) * clear(p), (p) => [Math.sign(p.x) * 0.55, -0.6, p.z > head.z ? 0.25 : -0.3]);
  // fringe over the brow: soft, parting in the middle, falling to the sides and a little forward
  add(blob([0, head.y + 0.05, head.z + 0.028], [0.064, 0.028, 0.048], 2, 0.1, 6), ['head'], face, (p) => 0.036 * clear(p), (p) => [Math.sign(p.x) * 0.6, -0.5, 0.35]);
  // muzzle (the moustache sweeps forward and down)
  add(blob([0, head.y - 0.022, head.z + 0.07], [0.043, 0.035, 0.04], 2, 0.05, 7), ['head'], white, (p) => 0.022 * clear(p), [0, -0.6, 0.6]);
  // lower jaw and the beard hanging from it
  add(blob([0, head.y - 0.048, head.z + 0.062], [0.031, 0.02, 0.035], 2, 0.05, 8), ['jaw'], white, 0.026, [0, -0.9, 0.3]);
  add(blob([0, head.y - 0.052, head.z + 0.05], [0.05, 0.034, 0.032], 2, 0.1, 9), ['jaw', 'head'], white, (p) => 0.045 + Math.max(0, head.y - 0.04 - p.y) * 0.4, [0, -1, 0.15]);
  // mouth: a dark lip line inside the jaw (shows when he pants)
  add(blob([0, head.y - 0.036, head.z + 0.07], [0.028, 0.008, 0.03], 1, 0, 10), ['jaw'], () => col(C.mouth), bare, NONE, 0.4);
  // tongue: hidden in the mouth until the tongue bone scales it out
  add(blob([0, head.y - 0.038, head.z + 0.084], [0.018, 0.006, 0.03], 1, 0, 11), ['tongue'], () => col(C.tongue), bare, NONE, 0.8);
  // button nose
  add(blob([0, head.y - 0.012, head.z + 0.11], [0.018, 0.014, 0.013], 2, 0, 12), ['head'], () => col(C.nose), bare, NONE, 0.9);
  // eyes: big, round and dark, each with a catch-light; they close (blink) by scaling their bone
  for (const side of ['L', 'R'] as const) {
    const e = B[`eye${side}`];
    const sx = side === 'L' ? 1 : -1;
    add(blob([e.x, e.y, e.z], [0.0155, 0.0155, 0.012], 2, 0, 13), [`eye${side}`], () => col(C.eye), bare, NONE, 1);
    add(blob([e.x + 0.004 * sx, e.y + 0.006, e.z + 0.0105], [0.004, 0.004, 0.002], 1, 0, 14), [`eye${side}`], () => col(C.shine), bare, NONE, 1);
  }

  // --- ears: long, hanging, charcoal with pale feathered tips, framing the face
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const top = B[`ear${side}`];
    const ear = (p: Vector3) => mixc(C.ear, C.earTip, smoothstep(0.075, 0.13, top.y - p.y) + (hash3(p.x * 50, p.y * 50, p.z * 50) - 0.5) * 0.2);
    add(
      blob([top.x + 0.012 * sx, top.y - 0.062, top.z + 0.008], [0.022, 0.072, 0.04], 2, 0.12, 15 + (sx > 0 ? 0 : 1), [0, 0, -0.1 * sx]),
      [`ear${side}`, `ear${side}2`, 'head'],
      ear,
      (p) => 0.036 + Math.max(0, top.y - 0.05 - p.y) * 0.2,
      [sx * 0.15, -1, 0],
    );
  }

  // --- legs: short and sturdy; fluffy round paws with dark pads
  for (const side of ['L', 'R'] as const) {
    const sh = B[`shoulder${side}`];
    const el = B[`elbow${side}`];
    const wr = B[`wrist${side}`];
    add(limb(sh, el, 0.04), [`shoulder${side}`, `elbow${side}`, 'chest'], white, 0.036, [0, -0.8, 0]);
    add(limb(el, wr, 0.029), [`elbow${side}`, `wrist${side}`], white, 0.034, [0, -0.8, 0]);
    const hp = B[`hip${side}`];
    const kn = B[`knee${side}`];
    const hk = B[`hock${side}`];
    // a round haunch over the thigh
    add(blob([hp.x, hp.y - 0.02, hp.z], [0.05, 0.068, 0.062], 2, 0.06, 20 + (side === 'L' ? 0 : 1)), ['hips', `hip${side}`, `knee${side}`], white, 0.04, coat);
    add(limb(kn, hk, 0.028), [`knee${side}`, `hock${side}`], white, 0.034, [0, -0.8, 0]);
    for (const [j, bone] of [
      [wr, `wrist${side}`],
      [hk, `hock${side}`],
    ] as const) {
      const pawC: V3 = [j.x, 0.026, j.z + 0.016];
      add(blob(pawC, [0.033, 0.026, 0.041], 2, 0.08, 22), [bone], (p) => (p.y < 0.008 ? col(C.pad) : white(p)), (p) => 0.028 * smoothstep(0.004, 0.016, p.y), [0, -0.4, 0.5]);
    }
  }

  // --- tail: a white plume curled up over the back, its long hair falling to one side
  const tailBones: BoneName[] = ['tail0', 'tail1', 'tail2', 'tail3'];
  tailBones.forEach((name, i) => {
    const p = B[name];
    const r = [0.028, 0.034, 0.038, 0.034][i];
    add(blob([p.x, p.y, p.z], [r, r * 1.1, r * 1.2], 2, 0.1, 30 + i), [tailBones[Math.max(0, i - 1)], name, tailBones[Math.min(3, i + 1)]], white, 0.058 + i * 0.008, [0.45, -0.9, -0.1]);
  });

  // --- collar and its little red bone tag
  const nk = B.neck;
  add(ring(new Vector3(0, nk.y + 0.012, nk.z + 0.012), new Vector3(0, 0.55, 1), 0.064, 0.0075), ['neck', 'chest'], () => col(C.collar), bare, NONE, 0.25);
  const tagC = new Vector3(0, nk.y - 0.058, nk.z + 0.068);
  const tagP = (x: number, y: number, s: number): BufferGeometry => blob([tagC.x + x, tagC.y + y, tagC.z], [s, s, 0.004], 1, 0, 40);
  const bar = blob([tagC.x, tagC.y, tagC.z], [0.014, 0.0055, 0.0035], 1, 0, 41);
  add(mergeGeometries([bar, tagP(0.013, 0.004, 0.0055), tagP(0.013, -0.004, 0.0055), tagP(-0.013, 0.004, 0.0055), tagP(-0.013, -0.004, 0.0055)], false)!, ['neck', 'chest'], () => col(C.tag), bare, NONE, 0.6);
  add(ring(new Vector3(0, tagC.y + 0.012, tagC.z - 0.002), new Vector3(1, 0, 0), 0.005, 0.0012), ['neck'], () => col('#c8c8c8'), bare, NONE, 0.9);
  return out;
}

// ---------------------------------------------------------------------------
// Skinning and shells
// ---------------------------------------------------------------------------

const _ab = new Vector3();
const _ap = new Vector3();

/** Distance from `p` to the segment a–b. */
export function segDist(p: Vector3, a: Vector3, b: Vector3): number {
  _ab.subVectors(b, a);
  const l2 = _ab.lengthSq();
  const t = l2 < 1e-12 ? 0 : Math.min(1, Math.max(0, _ap.subVectors(p, a).dot(_ab) / l2));
  return _ap.copy(a).addScaledVector(_ab, t).distanceTo(p);
}

/** Envelope weights for `p` over `bones`: inverse-square distance falloff, top 4, summing to 1. */
export function envelopeWeights(p: Vector3, bones: readonly BoneName[], bind = bindPositions(), ends = segmentEnds(bind)): Array<[number, number]> {
  const w = bones.map((b) => [BONE_INDEX[b], 1 / Math.pow(segDist(p, bind[b], ends[b]) + 0.012, 3)] as [number, number]);
  w.sort((a, b) => b[1] - a[1]);
  const top = w.slice(0, 4);
  const sum = top.reduce((s, x) => s + x[1], 0);
  return top.map(([i, x]) => [i, x / sum]);
}

export interface ChopperStats {
  vertices: number;
  triangles: number;
  baseTriangles: number;
  shells: number;
}

const cache = new Map<number, BufferGeometry>();

/**
 * The whole dog as one geometry: every part once (`aShell` 0), then the furry parts again for each
 * of `shells` shells (`aShell` k / shells). Cached per shell count.
 */
export function chopperGeometry(shells = 12): BufferGeometry {
  const hit = cache.get(shells);
  if (hit) return hit;
  const bind = bindPositions();
  const ends = segmentEnds(bind);
  const baked: BufferGeometry[] = [];
  const furry: BufferGeometry[] = [];
  const p = new Vector3();
  const n = new Vector3();
  for (const part of parts()) {
    const g = part.geo;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const count = pos.count;
    const color = new Float32Array(count * 3);
    const fur = new Float32Array(count);
    const gloss = new Float32Array(count).fill(part.gloss);
    const comb = new Float32Array(count * 3);
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    let anyFur = false;
    for (let i = 0; i < count; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      const c = part.paint(p, n);
      color.set([c.r, c.g, c.b], i * 3);
      fur[i] = part.fur(p, n);
      comb.set(part.comb(p, n), i * 3);
      if (fur[i] > 0) anyFur = true;
      envelopeWeights(p, part.bones, bind, ends).forEach(([bi, w], k) => {
        skinIndex[i * 4 + k] = bi;
        skinWeight[i * 4 + k] = w;
      });
    }
    g.setAttribute('color', new Float32BufferAttribute(color, 3));
    g.setAttribute('aFur', new Float32BufferAttribute(fur, 1));
    g.setAttribute('aGloss', new Float32BufferAttribute(gloss, 1));
    g.setAttribute('aComb', new Float32BufferAttribute(comb, 3));
    g.setAttribute('aBind', new Float32BufferAttribute((pos.array as Float32Array).slice(), 3));
    g.setAttribute('skinIndex', new BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4));
    g.setAttribute('aShell', new Float32BufferAttribute(new Float32Array(count), 1));
    baked.push(g);
    if (anyFur) furry.push(g);
  }
  const layers: BufferGeometry[] = [...baked];
  const furBase = mergeGeometries(furry, false)!;
  for (let k = 1; k <= shells; k++) {
    const s = furBase.clone();
    (s.getAttribute('aShell').array as Float32Array).fill(k / shells);
    layers.push(s);
  }
  const all = mergeGeometries(layers, false)!;
  all.computeBoundingSphere();
  all.boundingSphere!.radius += 0.12; // skinned poses and fur reach past the bind pose
  all.name = `chopper-${shells}`;
  // the base (every part once) comes first in the index: the shadow caster draws just that
  all.userData.baseIndexCount = baked.reduce((s, g) => s + g.index!.count, 0);
  cache.set(shells, all);
  return all;
}

/** A view of `g` that draws only its base (no fur shells), sharing its vertex buffers. */
export function baseOnly(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) out.setAttribute(name, a);
  out.setIndex(g.index);
  out.setDrawRange(0, g.userData.baseIndexCount as number);
  out.boundingSphere = g.boundingSphere;
  return out;
}

/** Free a cached geometry (the profile card's, when it closes). */
export function releaseChopperGeometry(shells: number): void {
  cache.get(shells)?.dispose();
  cache.delete(shells);
}

export function chopperStats(shells = 12): ChopperStats {
  const g = chopperGeometry(shells);
  const idx = g.index!.array;
  const shell = g.getAttribute('aShell').array as Float32Array;
  const tris = idx.length / 3;
  let shellTris = 0;
  for (let i = 0; i < idx.length; i += 3) if (shell[idx[i]] > 0) shellTris++;
  return { vertices: g.getAttribute('position').count, triangles: tris, baseTriangles: tris - shellTris, shells };
}

export interface ChopperRig {
  root: Bone;
  bones: Record<BoneName, Bone>;
  skeleton: Skeleton;
}

/** A fresh skeleton in the bind pose (attach `root` to the mesh, then `mesh.bind(skeleton)`). */
export function chopperRig(): ChopperRig {
  const bones = {} as Record<BoneName, Bone>;
  for (const b of BONES) {
    const bone = new Bone();
    bone.name = b.name;
    bone.position.set(...b.at);
    bones[b.name] = bone;
    if (b.parent) bones[b.parent].add(bone);
  }
  const root = bones.root;
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(BONES.map((b) => bones[b.name]));
  return { root, bones, skeleton };
}
