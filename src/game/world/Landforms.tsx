import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Matrix4, MeshStandardMaterial, PointLight, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { arcDistance, moveAlong } from '../math/sphere';
import { selectAmbientPaused } from '../state/store';
import { buildCliffs } from './cliffs';
import { lampPoolMaterial, lampsOn } from './DayNight';
import { mesaRadius, type Bridge, type Mesa, type River } from './features';
import { Kit, hash3 } from './kit';
import { KitModel } from './KitModel';
import type { Pond } from './layout';
import { angleGap, pondFrame, shoreRadius } from './pond';
import { registerDaylit } from './materials';
import { ARCH, shade } from './parts';
import { withRockDetail } from './rockDetail';
import { RIVER_WATER_U, bridgeArch } from './terrain';
import { gameTexture } from './textures';

const R = CONFIG.planetRadius;

// ---------------------------------------------------------------------------
// Cliffs: faceted, layered rock walls around each mesa (geometry in cliffs.ts; the grassy caps are part of the ground)
// ---------------------------------------------------------------------------

export function Cliffs({ controller }: { controller: GameController }) {
  const geo = useMemo(() => buildCliffs(controller.props.mesas), [controller]);
  const mat = useMemo(() => withRockDetail(new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true }), 0.85, 1), []);
  if (!geo) return null;
  return <mesh geometry={geo} material={mat} castShadow receiveShadow name="cliffs" />;
}

// ---------------------------------------------------------------------------
// Water: the river ribbon and the waterfall, with scrolling flow
// ---------------------------------------------------------------------------

const flowTime = { value: 0 };

/**
 * Stylised water (MeshStandardMaterial + flow shader), one look for the stream and the pond so
 * they read as a single body of water.
 * - `river`: `aFlow.x` runs across the stream (0…1), `.y` along it in world units, `.z` fades the
 *   ribbon out as it enters the pond.
 * - `fall`: faster, whiter vertical streaks.
 * - `pond`: still water. `aFlow.x` is 0.5 + 0.5 × distance-from-centre / radius (so the shallow
 *   edge and shoreline foam match the stream's banks), `.y` opens the foam where the stream flows
 *   in; `aPlanar` holds planar coordinates (u) for the slowly drifting ripples and caustics.
 */
function waterMaterial(kind: 'river' | 'fall' | 'pond'): MeshStandardMaterial {
  const fall = kind === 'fall';
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
  m.defines = { ...(caustics ? { USE_WATER_TEX: '' } : {}), ...(kind === 'pond' ? { WATER_POND: '' } : {}) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFlow = flowTime;
    if (caustics) shader.uniforms.uCaustics = { value: caustics };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFlow;\nvarying vec3 vFlow;\n#ifdef WATER_POND\nattribute vec2 aPlanar;\nvarying vec2 vPlanar;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;\n#ifdef WATER_POND\nvPlanar = aPlanar;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFlow;
varying vec3 vFlow;
#ifdef WATER_POND
varying vec2 vPlanar;
#endif
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
  vec3 deep = vec3(0.13, 0.47, 0.72);
  vec3 shallow = vec3(0.36, 0.76, 0.86);
  ${
    fall
      ? `float t = uFlow * 2.6;
  float streak = wn(vec2(vFlow.x * 14.0, vFlow.y * 1.5 - t * 2.0));
  streak = smoothstep(0.45, 0.9, streak);
  vec3 c = mix(vec3(0.42, 0.74, 0.88), vec3(0.95, 0.98, 1.0), streak * 0.85 + 0.15);
  float a = (0.78 + 0.2 * streak) * (1.0 - smoothstep(0.75, 1.0, across));`
      : kind === 'pond'
        ? `float t = uFlow * 0.25;
  vec2 pp = vPlanar;
  // the stream's deeper channel carries on into the pond where it flows in
  vec3 c = mix(deep, shallow, smoothstep(0.25, 0.95, across * (1.0 - 0.55 * vFlow.y)));
  // slow, wandering ripples (still water)
  float n1 = wn(pp * 1.6 + vec2(t * 0.6, -t * 0.4));
  float n2 = wn(pp * 3.1 + 3.0 - vec2(t * 0.3, t * 0.5));
  float lines = smoothstep(0.62, 0.72, n1) * (1.0 - smoothstep(0.72, 0.84, n1));
#ifdef USE_WATER_TEX
  float cA = texture2D(uCaustics, pp * 0.3 + vec2(t * 0.08, t * 0.05)).r;
  float cB = texture2D(uCaustics, pp * 0.43 + vec2(0.37 - t * 0.06, 0.5 + t * 0.07)).r;
  float cau = smoothstep(0.45, 0.95, min(cA, cB) * 0.5 + max(cA, cB) * 0.5);
  lines = max(lines * 0.4, cau);
#endif
  c = mix(c, vec3(0.8, 0.95, 1.0), lines * 0.5);
  c += (n2 - 0.5) * 0.06;
  // shoreline foam, opened where the stream flows in
  float foam = smoothstep(0.8, 0.97, across) * smoothstep(0.35, 0.75, wn(pp * 5.0 + t)) * (1.0 - vFlow.y);
  c = mix(c, vec3(0.97, 0.99, 1.0), foam * 0.8);
  float sp = step(0.988, wh(floor(pp * 14.0 + vec2(t * 2.0, 0.0))));
  c = mix(c, vec3(1.0), sp * 0.6);
  float a = 0.9;`
        : `float t = uFlow;
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
  // foam along the banks, broken up by noise (fading out as the stream opens into the pond)
  float foam = smoothstep(0.62, 0.92, across) * smoothstep(0.35, 0.75, wn(vec2(vFlow.x * 7.0, vFlow.y * 2.8 - t * 1.4))) * (1.0 - vFlow.z);
  c = mix(c, vec3(0.97, 0.99, 1.0), foam * 0.8);
  // sparkles
  float sp = step(0.985, wh(floor(vec2(vFlow.x * 30.0, vFlow.y * 10.0 - t * 2.0))));
  c = mix(c, vec3(1.0), sp * 0.7);
  // the ribbon dissolves into the pond so the two waters meet without a seam
  float a = 0.88 * (1.0 - smoothstep(0.86, 1.0, across)) * (1.0 - vFlow.z);`
  }
  diffuseColor.rgb = c * c;
  diffuseColor.a *= a;
}`,
      );
  };
  m.customProgramCacheKey = () => `water-${kind}-v3${caustics ? '-tex' : ''}`;
  return m;
}

/** River surface: a ribbon along the centre line, a little wider than the wetted bed. */
function buildRiverGeometry(river: River, pond: Pond | null): BufferGeometry {
  const across = 5;
  const pos: number[] = [];
  const flow: number[] = [];
  const idx: number[] = [];
  const side = new Vector3();
  const p = new Vector3();
  river.samples.forEach((c, i) => {
    side.crossVectors(c, river.tangent[i]).normalize();
    const hw = river.halfWidth[i] + 0.22;
    // cross-fade into the pond water (which runs 0.3 u out under the mouth): fully gone before the ribbon ends
    let fade = 0;
    if (pond) {
      const t = Math.min(1, Math.max(0, (pond.radiusU + 0.25 - arcDistance(c, pond.n, R)) / 0.55));
      fade = t * t * (3 - 2 * t);
    }
    for (let k = 0; k < across; k++) {
      const u = k / (across - 1);
      p.copy(moveAlong(c, side, ((u - 0.5) * 2 * hw) / R)).multiplyScalar(R + RIVER_WATER_U);
      pos.push(p.x, p.y, p.z);
      flow.push(u, river.along[i], fade);
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
  g.setAttribute('aFlow', new Float32BufferAttribute(flow, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Pond surface at the stream's water level (a hair lower, so the fading ribbon draws cleanly on
 * top). It extends past the rim and the deepened basin clips it, giving an organic shoreline.
 */
function buildPondGeometry(pond: Pond, river: River | null): BufferGeometry {
  const rings = 12;
  const segs = 56;
  // shared frame; `mouth` is where the stream flows in (seen from the pond centre)
  const frame = pondFrame(pond, river);
  const { tan, bit, mouth } = frame;
  const pos: number[] = [];
  const flow: number[] = [];
  const planar: number[] = [];
  const idx: number[] = [];
  const vert = (x: number, y: number, shore: number) => {
    const n = pond.n.clone().addScaledVector(tan, x / R).addScaledVector(bit, y / R).normalize().multiplyScalar(R + RIVER_WATER_U - 0.004);
    pos.push(n.x, n.y, n.z);
    const rho = Math.hypot(x, y);
    let open = 0;
    if (mouth !== null && rho > 0.01) {
      const da = angleGap(Math.atan2(y, x), mouth);
      const t = Math.min(1, Math.max(0, (0.75 - da) / 0.4));
      open = t * t * (3 - 2 * t);
    }
    flow.push(0.5 + 0.5 * Math.min(1, rho / shore), open, 0);
    planar.push(x, y);
  };
  vert(0, 0, pond.radiusU);
  for (let j = 1; j <= rings; j++) {
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      // follow the lobed shoreline and run a little under the bank, where the ground clips it
      const shore = shoreRadius(pond, frame, a);
      const rho = (shore + 0.3) * (j / rings);
      vert(Math.cos(a) * rho, Math.sin(a) * rho, shore);
    }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + s, 1 + ((s + 1) % segs));
  for (let j = 1; j < rings; j++) {
    const a0 = 1 + (j - 1) * segs;
    const b0 = 1 + j * segs;
    for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs;
      idx.push(a0 + s, b0 + s, b0 + s2, a0 + s, b0 + s2, a0 + s2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new Float32BufferAttribute(flow, 3));
  g.setAttribute('aPlanar', new Float32BufferAttribute(planar, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
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
    // runs out level over the grassy rim (so the rim never hides its top), arcs out from the
    // lip, then drops almost straight into the pool
    const r = edge - 0.02 + 0.32 * Math.sin(f * Math.PI * 0.5) + 0.05 * f;
    const g = Math.max(0, (f - 0.15) / 0.85);
    const y = top + (RIVER_WATER_U + 0.02 - top) * (g * g * 0.65 + g * 0.35);
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
  const { river, mesas, pond } = controller.props;
  const parts = useMemo(() => {
    const source = mesas[0];
    return {
      river: river ? buildRiverGeometry(river, pond) : null,
      pond: pond ? buildPondGeometry(pond, river) : null,
      fall: source && river ? buildFallGeometry(source, river) : null,
      extras: source && river ? buildFoam(source, river) : null,
      riverMat: waterMaterial('river'),
      pondMat: waterMaterial('pond'),
      fallMat: waterMaterial('fall'),
      foamMat: registerDaylit(new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.25 })),
    };
  }, [river, mesas, pond]);
  useFrame((_, dt) => {
    if (!paused) flowTime.value += dt;
  });
  return (
    <group name="water">
      {parts.pond && <mesh geometry={parts.pond} material={parts.pondMat} receiveShadow renderOrder={0} name="pond-water" />}
      {parts.river && <mesh geometry={parts.river} material={parts.riverMat} receiveShadow renderOrder={1} />}
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

/** Lantern glow: warm light that reaches the deck, rails, banks and anyone crossing. */
const LANTERN = { color: '#ffc98a', intensity: 2.4, distance: 3.2, decay: 1.6 } as const;

/**
 * A little iron lantern on a rail post, centred on `c` (kit frame): base and top plates, four
 * corner bars and a pyramid roof with a ring, around a lit glass core that shows between the bars
 * (the `glow` layer, so it blooms at night).
 */
function lantern(k: Kit, [x, y, z]: [number, number, number]) {
  k.surface('metal', () => {
    k.box([0.05, 0.28, 0.05], ARCH.iron, { p: [x, y - 0.2, z] }, 0.01);
    k.box([0.16, 0.03, 0.16], ARCH.iron, { p: [x, y - 0.085, z] }, 0.008);
    k.box([0.16, 0.03, 0.16], ARCH.iron, { p: [x, y + 0.085, z] }, 0.008);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      k.box([0.022, 0.16, 0.022], ARCH.iron, { p: [x + dx * 0.068, y, z + dz * 0.068] }, 0.004);
    }
    k.cone(0.12, 0.09, ARCH.iron, { p: [x, y + 0.145, z], r: [0, Math.PI / 4, 0] }, 4);
    k.torus(0.022, 0.007, ARCH.iron, { p: [x, y + 0.215, z] }, Math.PI * 2, [4, 10]);
  });
  k.box([0.11, 0.14, 0.11], ARCH.lit, { p: [x, y, z] }, 0.01, 'glow');
}

/**
 * Warm pools of lamplight on the deck around each lantern: a grid laid over the arched planks
 * (so it follows the deck), UV-mapped so the radial falloff is centred on the lantern.
 */
function lanternPools(lamps: [number, number, number][], L: number, W: number, deck: (z: number) => number, radius = 1.0): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const nx = 6;
  const nz = 10;
  for (const [lx, , lz] of lamps) {
    const z0 = Math.max(-L, lz - radius);
    const z1 = Math.min(L, lz + radius);
    const base = pos.length / 3;
    for (let j = 0; j <= nz; j++) {
      const z = z0 + ((z1 - z0) * j) / nz;
      for (let i = 0; i <= nx; i++) {
        const x = -W + 0.06 + ((2 * W - 0.12) * i) / nx;
        pos.push(x, deck(z) + 0.012, z);
        uv.push((x - lx) / (2 * radius) + 0.5, (z - lz) / (2 * radius) + 0.5);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = base + j * (nx + 1) + i;
        const c = a + nx + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function buildBridge(b: Bridge) {
  const k = new Kit();
  const lamps: [number, number, number][] = [];
  const L = b.halfLengthU;
  const W = b.halfWidthU;
  // deck height in the flat kit frame: the arch, minus the sphere's fall-off away from the centre
  const deck = (z: number) => bridgeArch(z, L) - (z * z) / (2 * R);
  const slope = (z: number) => (deck(z + 0.01) - deck(z - 0.01)) / 0.02;
  k.surface('wood', () => bridgeTimber(k, L, W, deck, slope));
  // stone abutments on both banks
  for (const s of [-1, 1]) {
    const z = s * (L - 0.12);
    const y = deck(z);
    k.surface('stone', () => {
      k.box([2 * W + 0.1, 0.38, 0.42], ARCH.stone, { p: [0, y - 0.24, z] }, 0.06);
      for (let i = 0; i < 4; i++) {
        k.blob(0.12 + 0.04 * hash3(i, s, 3), shade(ARCH.stoneDark, (hash3(i, 4, s) - 0.5) * 0.2), { p: [(i - 1.5) * 0.46, y - 0.34, z + s * 0.22], s: [1.2, 0.7, 1] }, 1, 'solid', 0.2, i);
      }
    });
    // a lantern on the end post, on opposite sides at the two ends (lit at night)
    const x = s < 0 ? -W + 0.04 : W - 0.04;
    const zl = s * (L - 0.08);
    lamps.push([x, deck(zl) + 0.86, zl]);
    lantern(k, lamps[lamps.length - 1]);
  }
  return { geo: k.build(), lamps, pools: lanternPools(lamps, L, W, deck) };
}

/** The bridge's planks, stringers and rails. */
function bridgeTimber(k: Kit, L: number, W: number, deck: (z: number) => number, slope: (z: number) => number) {
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
}

/**
 * The bridges, with working lanterns: after dusk each lantern's glass glows (shared `glow`
 * material), a real point light (no shadows) warms the deck, rails, banks and the character, and
 * a soft pool of light lies on the planks. The lights stay in the scene (visible) by day at zero
 * intensity, so the light count and the shader programs never change; with ambient motion on, the flames flicker very gently.
 */
export function Bridges({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const items = useMemo(() => controller.props.bridges.map((b) => ({ frame: bridgeFrame(b), ...buildBridge(b) })), [controller]);
  const poolMat = useMemo(() => lampPoolMaterial(), []);
  const lights = useMemo(
    () =>
      items.map(({ lamps }) =>
        lamps.map(([x, y, z]) => {
          const l = new PointLight(LANTERN.color, 0, LANTERN.distance, LANTERN.decay);
          l.position.set(x, y, z);
          l.castShadow = false;
          return l;
        }),
      ),
    [items],
  );
  controller.bridgeLamps.count = lights.reduce((n, ls) => n + ls.length, 0);
  const clock = useMemo(() => ({ t: 0 }), []);
  useFrame((_, dt) => {
    if (!paused) clock.t += dt;
    const on = lampsOn(controller.sky.night);
    controller.bridgeLamps.lit = on;
    let peak = 0;
    poolMat.opacity = on * 0.6;
    lights.forEach((ls) =>
      ls.forEach((l, i) => {
        const flicker = paused ? 1 : 1 + 0.05 * Math.sin(clock.t * 7.3 + i * 2.1) + 0.03 * Math.sin(clock.t * 13.1 + i);
        l.intensity = LANTERN.intensity * on * flicker;
        peak = Math.max(peak, l.intensity);
      }),
    );
    controller.bridgeLamps.intensity = peak;
  });
  return (
    <group name="bridges">
      {items.map(({ frame, geo, pools }, i) => (
        <group key={i} position={frame.p} quaternion={frame.q}>
          <KitModel geo={geo} />
          <mesh geometry={pools} material={poolMat} renderOrder={1} name="bridge-lamp-pools" />
          {lights[i].map((l, j) => (
            <primitive key={j} object={l} />
          ))}
        </group>
      ))}
    </group>
  );
}
