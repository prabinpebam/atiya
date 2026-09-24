import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, FrontSide, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { moveAlong } from '../math/sphere';
import { selectAmbientPaused } from '../state/store';
import { mesaRadius, type Bridge, type Mesa, type River } from './features';
import { Kit, hash3, mix } from './kit';
import { KitModel } from './KitModel';
import { registerDaylit } from './materials';
import { ARCH, shade } from './parts';
import { withRockDetail } from './rockDetail';
import { RIVER_WATER_U, bridgeArch } from './terrain';
import { gameTexture } from './textures';

const R = CONFIG.planetRadius;

// ---------------------------------------------------------------------------
// Cliffs: faceted, layered rock walls around each mesa, with a grassy lip
// ---------------------------------------------------------------------------

const STRATA = ['#b59a7c', '#9c8f84', '#c9ae8a', '#8e8279', '#bfa585'];

function dirAt(m: Mesa, a: number): Vector3 {
  return m.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(m.east, Math.sin(a)).normalize();
}

/** Planet-local point at polar (a, r) around a mesa, `y` u above the base sphere. */
function mesaPoint(center: Vector3, m: Mesa, a: number, r: number, y: number): Vector3 {
  return moveAlong(center, dirAt(m, a), r / R).normalize().multiplyScalar(R + y);
}

class Tris {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  /** (u, v, rock weight) per vertex for the painted strata texture. */
  readonly ruv: number[] = [];
  tri(a: Vector3, b: Vector3, c: Vector3, color: Color, uv?: [number, number, number, number, number, number], w = 0) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
    if (uv) this.ruv.push(uv[0], uv[1], w, uv[2], uv[3], w, uv[4], uv[5], w);
    else this.ruv.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
  /** Quad a-b-c-d; `uv` gives (u, v) for a, b, c, d. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color, uv?: [number, number][], w = 0) {
    this.tri(a, b, c, color, uv && [...uv[0], ...uv[1], ...uv[2]], w);
    this.tri(a, c, d, color, uv && [...uv[0], ...uv[2], ...uv[3]], w);
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aRockUV', new Float32BufferAttribute(this.ruv, 3));
    g.computeVertexNormals(); // non-indexed → flat facets (the chiselled rock look)
    return g;
  }
}

/** Wall texture repeats horizontally about every 1.4 u, rounded so each ring wraps seamlessly. */
const ROCK_TILE_U = 1.4;

/** One wall ring from `y0` to `y1` following an irregular outline, in rocky strata. */
function wallRing(t: Tris, m: Mesa, center: Vector3, radius: number, seed: number, y0: number, y1: number) {
  const count = Math.max(24, Math.ceil((Math.PI * 2 * radius) / 0.2));
  const layers = Math.max(3, Math.round((y1 - y0) / 0.24));
  const pts: Vector3[][] = [];
  for (let j = 0; j <= layers; j++) {
    const f = j / layers;
    const y = y0 + (y1 - y0) * f;
    // strata ledges: each band bulges at its base and tucks in at its top
    const band = (f * layers) % 1;
    const ledge = j === layers ? -0.02 : 0.07 - 0.07 * band;
    const row: Vector3[] = [];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const jitter = (hash3(k * 1.7, j * 3.1, seed) - 0.5) * 0.09;
      const r = mesaRadius(radius, seed, a) + ledge + jitter + (j === 0 ? 0.08 : 0);
      row.push(mesaPoint(center, m, a, r, y));
    }
    pts.push(row);
  }
  const c = new Color();
  // u in tiles around the ring (integer total, so it wraps without a seam), v in tiles up the wall
  const reps = Math.max(1, Math.round((Math.PI * 2 * radius) / ROCK_TILE_U));
  const uAt = (k: number) => (k / count) * reps;
  const vAt = (j: number) => (y0 + ((y1 - y0) * j) / layers) / ROCK_TILE_U;
  for (let j = 0; j < layers; j++) {
    const base = STRATA[(j + Math.floor(seed * 3)) % STRATA.length];
    for (let k = 0; k < count; k++) {
      const k2 = (k + 1) % count;
      c.set(mix(base, '#ffffff', (hash3(k, j, seed + 1) - 0.5) * 0.12 + 0.02));
      t.quad(pts[j][k], pts[j][k2], pts[j + 1][k2], pts[j + 1][k], c, [
        [uAt(k), vAt(j)],
        [uAt(k + 1), vAt(j)],
        [uAt(k + 1), vAt(j + 1)],
        [uAt(k), vAt(j + 1)],
      ], 1);
    }
  }
  // grassy lip: a lumpy green band over the rim, drooping slightly over the edge
  const lipCount = count;
  const green = new Color('#86c653');
  const greenDark = new Color('#6fae4a');
  for (let k = 0; k < lipCount; k++) {
    const a0 = (k / lipCount) * Math.PI * 2;
    const a1 = ((k + 1) / lipCount) * Math.PI * 2;
    const droop0 = 0.07 + 0.05 * hash3(k, 7, seed);
    const droop1 = 0.07 + 0.05 * hash3(k + 1 === lipCount ? 0 : k + 1, 7, seed);
    const r0o = mesaRadius(radius, seed, a0) + 0.05;
    const r1o = mesaRadius(radius, seed, a1) + 0.05;
    const top = y1 + 0.03;
    const oA = mesaPoint(center, m, a0, r0o, top);
    const oB = mesaPoint(center, m, a1, r1o, top);
    const iA = mesaPoint(center, m, a0, r0o - 0.32, top);
    const iB = mesaPoint(center, m, a1, r1o - 0.32, top);
    const dA = mesaPoint(center, m, a0, r0o + 0.02, top - droop0);
    const dB = mesaPoint(center, m, a1, r1o + 0.02, top - droop1);
    t.quad(iA, oA, oB, iB, green);
    t.quad(oA, dA, dB, oB, greenDark);
  }
}

function buildCliffs(mesas: readonly Mesa[]): BufferGeometry | null {
  if (!mesas.length) return null;
  const t = new Tris();
  for (const m of mesas) {
    wallRing(t, m, m.n, m.radiusU, m.seed, -0.4, m.heightU);
    if (m.tier) wallRing(t, m, m.tier.n, m.tier.radiusU, m.seed + 2.2, m.heightU - 0.12, m.heightU + m.tier.heightU);
  }
  return t.build();
}

export function Cliffs({ controller }: { controller: GameController }) {
  const geo = useMemo(() => buildCliffs(controller.props.mesas), [controller]);
  const mat = useMemo(
    () => withRockDetail(new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true }), 'uv', 0.85, 1),
    [],
  );
  if (!geo) return null;
  return <mesh geometry={geo} material={mat} castShadow receiveShadow name="cliffs" />;
}

// ---------------------------------------------------------------------------
// Water: the river ribbon and the waterfall, with scrolling flow
// ---------------------------------------------------------------------------

const flowTime = { value: 0 };

/**
 * Stylised flowing water (MeshStandardMaterial + flow shader). `uv.x` runs across the stream
 * (0…1) and `uv.y` along it in world units; `fall` makes faster, whiter vertical streaks.
 */
function waterMaterial(fall: boolean): MeshStandardMaterial {
  const caustics = fall ? null : gameTexture('water');
  const m = registerDaylit(
    new MeshStandardMaterial({
      color: '#ffffff',
      emissive: fall ? '#6fc3e0' : '#1d86ad',
      emissiveIntensity: fall ? 0.45 : 0.35,
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      side: fall ? DoubleSide : FrontSide,
    }),
  );
  if (caustics) m.defines = { USE_WATER_TEX: '' };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFlow = flowTime;
    if (caustics) shader.uniforms.uCaustics = { value: caustics };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFlow;\nvarying vec2 vFlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFlow;
varying vec2 vFlow;
#ifdef USE_WATER_TEX
uniform sampler2D uCaustics;
#endif
float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float across = abs(vFlow.x * 2.0 - 1.0);
  ${
    fall
      ? `float t = uFlow * 2.6;
  float streak = wn(vec2(vFlow.x * 14.0, vFlow.y * 1.5 - t * 2.0));
  streak = smoothstep(0.45, 0.9, streak);
  vec3 c = mix(vec3(0.42, 0.74, 0.88), vec3(0.95, 0.98, 1.0), streak * 0.85 + 0.15);
  float a = (0.78 + 0.2 * streak) * (1.0 - smoothstep(0.75, 1.0, across));`
      : `float t = uFlow;
  vec3 deep = vec3(0.13, 0.47, 0.72);
  vec3 shallow = vec3(0.36, 0.76, 0.86);
  vec3 c = mix(deep, shallow, smoothstep(0.1, 0.95, across));
  // drifting ripples and bright flow lines, advected downstream
  float n1 = wn(vec2(vFlow.x * 5.0, vFlow.y * 1.1 - t * 1.1));
  float n2 = wn(vec2(vFlow.x * 9.0 + 3.0, vFlow.y * 2.3 - t * 1.7));
  float lines = smoothstep(0.62, 0.72, n1) * (1.0 - smoothstep(0.72, 0.84, n1));
#ifdef USE_WATER_TEX
  // hand-painted caustics, two layers drifting downstream at different speeds
  float cA = texture2D(uCaustics, vec2(vFlow.x * 0.55, vFlow.y * 0.42 - t * 0.32)).r;
  float cB = texture2D(uCaustics, vec2(vFlow.x * 0.8 + 0.37, vFlow.y * 0.61 - t * 0.21 + 0.5)).r;
  float cau = smoothstep(0.45, 0.95, min(cA, cB) * 0.5 + max(cA, cB) * 0.5);
  lines = max(lines * 0.4, cau);
#endif
  c = mix(c, vec3(0.8, 0.95, 1.0), lines * 0.55);
  c += (n2 - 0.5) * 0.06;
  // foam along the banks, broken up by noise
  float foam = smoothstep(0.62, 0.92, across) * smoothstep(0.35, 0.75, wn(vec2(vFlow.x * 7.0, vFlow.y * 2.8 - t * 1.4)));
  c = mix(c, vec3(0.97, 0.99, 1.0), foam * 0.8);
  // sparkles
  float sp = step(0.985, wh(floor(vec2(vFlow.x * 30.0, vFlow.y * 10.0 - t * 2.0))));
  c = mix(c, vec3(1.0), sp * 0.7);
  float a = 0.88 * (1.0 - smoothstep(0.86, 1.0, across));`
  }
  diffuseColor.rgb = c * c;
  diffuseColor.a *= a;
}`,
      );
  };
  m.customProgramCacheKey = () => (fall ? 'water-fall-v1' : caustics ? 'water-river-v2-tex' : 'water-river-v2');
  return m;
}

/** River surface: a ribbon along the centre line, a little wider than the wetted bed. */
function buildRiverGeometry(river: River): BufferGeometry {
  const across = 5;
  const pos: number[] = [];
  const flow: number[] = [];
  const idx: number[] = [];
  const side = new Vector3();
  const p = new Vector3();
  river.samples.forEach((c, i) => {
    side.crossVectors(c, river.tangent[i]).normalize();
    const hw = river.halfWidth[i] + 0.22;
    for (let k = 0; k < across; k++) {
      const u = k / (across - 1);
      p.copy(moveAlong(c, side, ((u - 0.5) * 2 * hw) / R)).multiplyScalar(R + RIVER_WATER_U);
      pos.push(p.x, p.y, p.z);
      flow.push(u, river.along[i]);
    }
  });
  for (let i = 0; i < river.samples.length - 1; i++) {
    for (let k = 0; k < across - 1; k++) {
      const a = i * across + k;
      const b = a + across;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new Float32BufferAttribute(flow, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A curved sheet pouring off the cliff rim into the plunge pool. */
function buildFallGeometry(mesa: Mesa, river: River): BufferGeometry {
  const src = river.samples[0];
  const dir = new Vector3().subVectors(src, mesa.n);
  dir.addScaledVector(mesa.n, -dir.dot(mesa.n)).normalize();
  const a = Math.atan2(dir.dot(mesa.east), dir.dot(mesa.north));
  const edge = mesaRadius(mesa.radiusU, mesa.seed, a);
  const side = new Vector3().crossVectors(mesa.n, dir).normalize();
  const width = 0.62;
  const rows = 10;
  const cols = 4;
  const pos: number[] = [];
  const flow: number[] = [];
  const idx: number[] = [];
  const top = mesa.heightU + 0.05;
  for (let j = 0; j <= rows; j++) {
    const f = j / rows;
    // arcs out from the lip, then drops almost straight into the pool
    const r = edge - 0.02 + 0.32 * Math.sin(f * Math.PI * 0.5) + 0.05 * f;
    const y = top + (RIVER_WATER_U + 0.02 - top) * (f * f * 0.65 + f * 0.35);
    for (let k = 0; k <= cols; k++) {
      const u = k / cols;
      const w = width * (0.85 + 0.25 * f);
      const p = moveAlong(moveAlong(mesa.n, dir, r / R), side, ((u - 0.5) * w) / R).multiplyScalar(R + y);
      pos.push(p.x, p.y, p.z);
      flow.push(u, f * (top - RIVER_WATER_U));
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let k = 0; k < cols; k++) {
      const a0 = j * (cols + 1) + k;
      const b0 = a0 + cols + 1;
      idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new Float32BufferAttribute(flow, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Foam puffs where the waterfall lands, plus a little spring channel on the cliff top. */
function buildFoam(mesa: Mesa, river: River): { foam: BufferGeometry; spring: BufferGeometry } {
  const k = new Kit();
  const src = river.samples[0];
  const side = new Vector3().crossVectors(src, river.tangent[0]).normalize();
  for (let i = 0; i < 9; i++) {
    const s = (i / 8 - 0.5) * 0.9;
    const fwd = (hash3(i, 3, 1) - 0.5) * 0.3;
    const p = moveAlong(moveAlong(src, side, s / R), river.tangent[0], fwd / R).multiplyScalar(R + RIVER_WATER_U + 0.02);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), src);
    k.group({ p: [p.x, p.y, p.z], q }, () => k.blob(0.11 + 0.06 * hash3(i, 1, 2), '#f4fbff', { s: [1.3, 0.55, 1.1] }, 1, 'solid', 0.2, i));
  }
  const foam = k.build().solid!;
  // spring: a short, shallow channel on the mesa top running to the lip
  const dir = new Vector3().subVectors(src, mesa.n);
  dir.addScaledVector(mesa.n, -dir.dot(mesa.n)).normalize();
  const a = Math.atan2(dir.dot(mesa.east), dir.dot(mesa.north));
  const edge = mesaRadius(mesa.radiusU, mesa.seed, a);
  const sideM = new Vector3().crossVectors(mesa.n, dir).normalize();
  const pos: number[] = [];
  const flow: number[] = [];
  const idx: number[] = [];
  const rows = 6;
  for (let j = 0; j <= rows; j++) {
    const f = j / rows;
    const r = edge * (0.35 + 0.65 * f) - 0.02;
    for (let c = 0; c <= 2; c++) {
      const u = c / 2;
      const w = 0.28 + 0.34 * f;
      const p = moveAlong(moveAlong(mesa.n, dir, r / R), sideM, ((u - 0.5) * w) / R).multiplyScalar(R + mesa.heightU + 0.05);
      pos.push(p.x, p.y, p.z);
      flow.push(u, f * edge * 0.65);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let c = 0; c < 2; c++) {
      const a0 = j * 3 + c;
      idx.push(a0, a0 + 3, a0 + 1, a0 + 1, a0 + 3, a0 + 4);
    }
  }
  const spring = new BufferGeometry();
  spring.setAttribute('position', new Float32BufferAttribute(pos, 3));
  spring.setAttribute('aFlow', new Float32BufferAttribute(flow, 2));
  spring.setIndex(idx);
  spring.computeVertexNormals();
  return { foam, spring };
}

export function Water({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const { river, mesas } = controller.props;
  const parts = useMemo(() => {
    if (!river) return null;
    const source = mesas[0];
    return {
      river: buildRiverGeometry(river),
      fall: source ? buildFallGeometry(source, river) : null,
      extras: source ? buildFoam(source, river) : null,
      riverMat: waterMaterial(false),
      fallMat: waterMaterial(true),
      foamMat: registerDaylit(new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.25 })),
    };
  }, [river, mesas]);
  useFrame((_, dt) => {
    if (!paused) flowTime.value += dt;
  });
  if (!parts) return null;
  return (
    <group name="water">
      <mesh geometry={parts.river} material={parts.riverMat} receiveShadow renderOrder={1} />
      {parts.fall && <mesh geometry={parts.fall} material={parts.fallMat} renderOrder={2} />}
      {parts.extras && <mesh geometry={parts.extras.spring} material={parts.riverMat} renderOrder={1} />}
      {parts.extras && <mesh geometry={parts.extras.foam} material={parts.foamMat} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bridge: a cozy arched plank bridge with rails, stone abutments and lanterns
// ---------------------------------------------------------------------------

function bridgeFrame(b: Bridge): { p: Vector3; q: Quaternion } {
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(b.across, b.n, b.along));
  return { p: b.n.clone().multiplyScalar(R), q };
}

function buildBridge(b: Bridge) {
  const k = new Kit();
  const L = b.halfLengthU;
  const W = b.halfWidthU;
  // deck height in the flat kit frame: the arch, minus the sphere's fall-off away from the centre
  const deck = (z: number) => bridgeArch(z, L) - (z * z) / (2 * R);
  const slope = (z: number) => (deck(z + 0.01) - deck(z - 0.01)) / 0.02;
  const wood = ARCH.wood;
  const plank = (i: number) => shade(wood, (hash3(i, 2, 5) - 0.5) * 0.18);

  // planks across the deck
  const n = Math.round((2 * L) / 0.17);
  for (let i = 0; i <= n; i++) {
    const z = -L + (2 * L * i) / n;
    k.box([2 * W - 0.1, 0.06, 0.15], plank(i), { p: [0, deck(z) - 0.03, z], r: [-Math.atan(slope(z)), 0, (hash3(i, 1, 1) - 0.5) * 0.03] }, 0.012);
  }
  // curved stringers beneath
  for (const x of [-W + 0.22, W - 0.22]) {
    for (let i = 0; i < 12; i++) {
      const z0 = -L + (2 * L * i) / 12;
      const z1 = -L + (2 * L * (i + 1)) / 12;
      const zm = (z0 + z1) / 2;
      k.box([0.12, 0.14, z1 - z0 + 0.02], ARCH.woodDark, { p: [x, deck(zm) - 0.13, zm], r: [-Math.atan(slope(zm)), 0, 0] }, 0.02);
    }
  }
  // rails: posts with caps and a gently arched hand rail
  const posts = 6;
  for (const x of [-W + 0.04, W - 0.04]) {
    for (let i = 0; i < posts; i++) {
      const z = -L + 0.08 + ((2 * L - 0.16) * i) / (posts - 1);
      const y = deck(z);
      k.box([0.1, 0.52, 0.1], ARCH.woodDark, { p: [x, y + 0.22, z] }, 0.02);
      k.sphere(0.065, shade(ARCH.woodDark, 0.1), { p: [x, y + 0.5, z] }, [8, 6]);
    }
    for (let i = 0; i < 14; i++) {
      const z0 = -L + 0.08 + ((2 * L - 0.16) * i) / 14;
      const z1 = -L + 0.08 + ((2 * L - 0.16) * (i + 1)) / 14;
      const zm = (z0 + z1) / 2;
      k.box([0.07, 0.06, z1 - z0 + 0.01], shade(wood, 0.08), { p: [x, deck(zm) + 0.4, zm], r: [-Math.atan(slope(zm)), 0, 0] }, 0.015);
      k.box([0.05, 0.04, z1 - z0 + 0.01], shade(wood, -0.05), { p: [x, deck(zm) + 0.18, zm], r: [-Math.atan(slope(zm)), 0, 0] }, 0.01);
    }
  }
  // stone abutments on both banks
  for (const s of [-1, 1]) {
    const z = s * (L - 0.12);
    const y = deck(z);
    k.box([2 * W + 0.1, 0.38, 0.42], ARCH.stone, { p: [0, y - 0.24, z] }, 0.06);
    for (let i = 0; i < 4; i++) {
      k.blob(0.12 + 0.04 * hash3(i, s, 3), shade(ARCH.stoneDark, (hash3(i, 4, s) - 0.5) * 0.2), { p: [(i - 1.5) * 0.46, y - 0.34, z + s * 0.22], s: [1.2, 0.7, 1] }, 1, 'solid', 0.2, i);
    }
    // a little lantern on one post at each end (glows at night)
    const x = s < 0 ? -W + 0.04 : W - 0.04;
    const zl = s * (L - 0.08);
    const yl = deck(zl);
    k.box([0.05, 0.28, 0.05], ARCH.iron, { p: [x, yl + 0.66, zl] }, 0.01);
    k.box([0.14, 0.16, 0.14], ARCH.iron, { p: [x, yl + 0.86, zl] }, 0.02);
    k.box([0.1, 0.12, 0.1], ARCH.lit, { p: [x, yl + 0.86, zl] }, 0.01, 'glow');
    k.cone(0.11, 0.08, ARCH.iron, { p: [x, yl + 0.98, zl] }, 8);
  }
  return k.build();
}

export function Bridges({ controller }: { controller: GameController }) {
  const items = useMemo(() => controller.props.bridges.map((b) => ({ frame: bridgeFrame(b), geo: buildBridge(b) })), [controller]);
  return (
    <group name="bridges">
      {items.map(({ frame, geo }, i) => (
        <group key={i} position={frame.p} quaternion={frame.q}>
          <KitModel geo={geo} />
        </group>
      ))}
    </group>
  );
}
