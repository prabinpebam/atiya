import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { moveAlong } from '../math/sphere';
import { selectAmbientPaused } from '../state/store';
import { leafTexture } from './foliage';
import { mulberry32 } from './layout';
import { registerDaylit } from './materials';
import { gustAt, windAt, windStrength, windUniforms } from './windField';

const R = CONFIG.planetRadius;

/** Advances the shared wind clock and strength (frozen while ambient motion is paused). */
export function WindDriver({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const t = useRef(0);
  useFrame((_, rawDt) => {
    if (paused) return;
    const dt = Math.min(rawDt, 0.1);
    t.current += dt;
    const forced = controller.windOverride;
    const gust = forced ?? gustAt(t.current);
    const s = forced === null ? windStrength(t.current) : 0.3 + 0.7 * forced;
    // gusts also quicken the rustle; integrating keeps the phase continuous
    windUniforms.uWindTime.value += dt * (0.8 + 0.6 * s);
    windUniforms.uWindStrength.value = s;
    controller.wind.strength = s;
    controller.wind.gust = gust;
    controller.wind.time = t.current;
  });
  return null;
}

// ---------------------------------------------------------------------------
// Flying leaves: a handful of leaves and petals riding the wind around the player
// ---------------------------------------------------------------------------

const LEAF_COUNT = 30;
const LEAF_COLORS = ['#9fd45a', '#f2cf4a', '#f3a24c', '#ffb8cc', '#c8e070', '#ff9a7a', '#fff1c4'].map((c) => new Color(c));

interface Leaf {
  n: Vector3;
  ground: number;
  alt: number;
  age: number;
  life: number;
  spin: Vector3;
  angle: number;
  phase: number;
  size: number;
  alive: boolean;
}

function upwindSpawn(controller: GameController, rand: () => number, leaf: Leaf) {
  const p = controller.sim.pLocal;
  const w = windAt(p).normalize();
  const side = new Vector3().crossVectors(p, w).normalize();
  let n = moveAlong(p, w, -(1.5 + rand() * 4.5) / R);
  n = moveAlong(n, side, ((rand() - 0.5) * 7) / R).normalize();
  leaf.n.copy(n);
  leaf.ground = Math.max(0, controller.terrain.walkHeight(n));
  leaf.alt = 0.35 + rand() * 1.6;
  leaf.age = 0;
  leaf.life = 4 + rand() * 4;
  leaf.spin.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
  leaf.angle = rand() * Math.PI * 2;
  leaf.phase = rand() * 10;
  leaf.size = 0.8 + rand() * 0.5;
  leaf.alive = true;
}

export function FlyingLeaves({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const ref = useRef<InstancedMesh>(null);
  const { geo, mat, leaves, rand } = useMemo(() => {
    const g = new PlaneGeometry(0.25, 0.25);
    const m = registerDaylit(
      new MeshStandardMaterial({ map: leafTexture('single'), alphaTest: 0.5, side: DoubleSide, roughness: 0.8, emissive: '#6a5a30', emissiveIntensity: 0.3 }),
    );
    const r = mulberry32(99);
    const list: Leaf[] = Array.from({ length: LEAF_COUNT }, () => ({
      n: new Vector3(0, 1, 0),
      ground: 0,
      alt: 1,
      age: 0,
      life: 0,
      spin: new Vector3(0, 1, 0),
      angle: 0,
      phase: 0,
      size: 1,
      alive: false,
    }));
    return { geo: g, mat: m, leaves: list, rand: r };
  }, []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    leaves.forEach((_, i) => mesh.setColorAt(i, LEAF_COLORS[i % LEAF_COLORS.length]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [leaves]);

  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), spin: new Quaternion(), up: new Quaternion(), p: new Vector3(), s: new Vector3(), w: new Vector3() }), []);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.visible = !paused;
    if (paused) {
      controller.wind.leaves = 0;
      return;
    }
    const dt = Math.min(rawDt, 0.1);
    const { strength, gust, time } = controller.wind;
    // more leaves take to the air during gusts
    const wanted = Math.round(LEAF_COUNT * (0.2 + 0.8 * gust));
    let alive = 0;
    leaves.forEach((leaf, i) => {
      if (!leaf.alive && i < wanted && rand() < dt * 1.5) upwindSpawn(controller, rand, leaf);
      if (leaf.alive) {
        leaf.age += dt;
        const w = windAt(leaf.n, tmp.w);
        const speed = (0.8 + 2.4 * strength) * (0.4 + 0.6 * w.length());
        w.normalize();
        const side = new Vector3().crossVectors(leaf.n, w);
        const wander = Math.sin(time * 1.3 + leaf.phase) * 0.6;
        leaf.n.copy(moveAlong(moveAlong(leaf.n, w, (speed * dt) / R), side, (wander * dt) / R)).normalize();
        leaf.angle += dt * (3 + strength * 5);
        if (Math.floor(leaf.age * 2) !== Math.floor((leaf.age - dt) * 2)) leaf.ground = Math.max(0, controller.terrain.walkHeight(leaf.n));
        const far = leaf.n.dot(controller.sim.pLocal) < Math.cos(9 / R);
        if (leaf.age > leaf.life || far) leaf.alive = false;
      }
      // fade by scale at both ends of a leaf's flight
      const fade = leaf.alive ? Math.min(1, leaf.age / 0.5, (leaf.life - leaf.age) / 0.7) : 0;
      if (fade > 0) alive++;
      const y = R + leaf.ground + leaf.alt + 0.25 * Math.sin(time * 1.7 + leaf.phase) + 0.12 * Math.sin(time * 4.3 + leaf.phase * 2);
      tmp.p.copy(leaf.n).multiplyScalar(y);
      tmp.up.setFromUnitVectors(new Vector3(0, 1, 0), leaf.n);
      tmp.spin.setFromAxisAngle(leaf.spin, leaf.angle);
      tmp.q.copy(tmp.up).multiply(tmp.spin);
      tmp.s.setScalar(Math.max(0, fade) * leaf.size);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      mesh.setMatrixAt(i, tmp.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    controller.wind.leaves = alive;
  });

  return <instancedMesh ref={ref} args={[geo, mat, LEAF_COUNT]} frustumCulled={false} name="flying-leaves" />;
}

// ---------------------------------------------------------------------------
// Wind swirls: occasional white streaks that sweep downwind and curl into a loop
// ---------------------------------------------------------------------------

const SWIRL_POOL = 3;
const SWIRL_LIFE = 2.8;
const SWIRL_POINTS = 72;

/** A ribbon along a gentle S-curve with one loop, in a tilted plane so the loop reads from above. */
function swirlGeometry(seed: number): BufferGeometry {
  const rand = mulberry32(seed);
  const L = 3.0 + rand() * 1.2;
  const loopAt = 0.45 + rand() * 0.2;
  const r = 0.34 + rand() * 0.14;
  const pts: Vector3[] = [];
  const up = new Vector3(0, 0.4, 0.92).normalize();
  for (let i = 0; i < SWIRL_POINTS; i++) {
    const s = i / (SWIRL_POINTS - 1);
    const u = Math.min(1, Math.max(0, (s - (loopAt - 0.12)) / 0.24));
    const phi = Math.PI * 2 * (u * u * (3 - 2 * u));
    const x = s * L - r * Math.sin(phi);
    const v = r * (1 - Math.cos(phi)) + 0.12 * Math.sin(s * Math.PI * 2 + seed);
    pts.push(new Vector3(x - L / 2, 0, 0).addScaledVector(up, v));
  }
  const pos: number[] = [];
  const tan: number[] = [];
  const along: number[] = [];
  const side: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new Vector3().subVectors(b, a).normalize();
    for (const s of [-1, 1]) {
      pos.push(p.x, p.y, p.z);
      tan.push(t.x, t.y, t.z);
      along.push(i / (pts.length - 1));
      side.push(s);
    }
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aTan', new Float32BufferAttribute(tan, 3));
  g.setAttribute('aS', new Float32BufferAttribute(along, 1));
  g.setAttribute('aSide', new Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

function swirlMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uHead: { value: 0 }, uOpacity: { value: 0 }, uWidth: { value: 0.055 } },
    vertexShader: /* glsl */ `
      attribute vec3 aTan;
      attribute float aS;
      attribute float aSide;
      uniform float uHead;
      uniform float uWidth;
      varying float vA;
      varying float vSide;
      void main() {
        // visible window: a sharp head and a tapering tail sweeping along the ribbon
        float tail = uHead - 0.42;
        float vis = smoothstep(tail, tail + 0.2, aS) * (1.0 - smoothstep(uHead - 0.03, uHead, aS));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 tv = normalize((modelViewMatrix * vec4(aTan, 0.0)).xyz);
        vec3 side = normalize(cross(tv, vec3(0.0, 0.0, 1.0)) + 1e-5);
        mv.xyz += side * aSide * uWidth * (0.25 + 0.75 * vis);
        gl_Position = projectionMatrix * mv;
        vA = vis;
        vSide = aSide;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vA;
      varying float vSide;
      void main() {
        float a = vA * uOpacity * (1.0 - smoothstep(0.4, 1.0, abs(vSide)));
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0), a);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

interface Swirl {
  mesh: Mesh;
  mat: ShaderMaterial;
  age: number;
  active: boolean;
  n: Vector3;
  dir: Vector3;
  base: number;
  alt: number;
}

export function WindSwirls({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const next = useRef(2.5);
  const pool = useMemo<Swirl[]>(
    () =>
      Array.from({ length: SWIRL_POOL }, (_, i) => {
        const mat = swirlMaterial();
        const mesh = new Mesh(swirlGeometry(31 + i * 7), mat);
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.renderOrder = 3;
        return { mesh, mat, age: 0, active: false, n: new Vector3(0, 1, 0), dir: new Vector3(1, 0, 0), base: 0, alt: 1 };
      }),
    [],
  );
  const rand = useMemo(() => mulberry32(5), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    if (paused) {
      for (const s of pool) s.mesh.visible = s.active = false;
      controller.wind.swirls = 0;
      return;
    }
    const { gust, strength } = controller.wind;
    next.current -= dt * (0.6 + 1.6 * gust);
    if (next.current <= 0) {
      next.current = 3.5 + rand() * 4.5;
      const free = pool.find((s) => !s.active);
      if (free) {
        const p = controller.sim.pLocal;
        const w = windAt(p).normalize();
        const side = new Vector3().crossVectors(p, w).normalize();
        free.n = moveAlong(moveAlong(p, w, -(0.8 + rand() * 2.2) / R), side, ((rand() - 0.5) * 5) / R).normalize();
        free.dir = windAt(free.n).normalize();
        free.base = Math.max(0, controller.terrain.walkHeight(free.n));
        free.alt = 0.55 + rand() * 0.8;
        free.age = 0;
        free.active = true;
      }
    }
    let active = 0;
    for (const s of pool) {
      if (!s.active) {
        s.mesh.visible = false;
        continue;
      }
      s.age += dt;
      const f = s.age / SWIRL_LIFE;
      if (f >= 1) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      active++;
      // the whole streak drifts downwind while its head sweeps along the curve
      const drift = (0.6 + 1.4 * strength) * s.age;
      const n = moveAlong(s.n, s.dir, (drift - 1.5) / R).normalize();
      const x = windAt(n).normalize();
      const z = new Vector3().crossVectors(x, n).normalize();
      s.mesh.position.copy(n).multiplyScalar(R + s.base + s.alt);
      s.mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, n, z));
      s.mat.uniforms.uHead.value = f * 1.45;
      s.mat.uniforms.uOpacity.value = 0.85 * Math.min(1, f / 0.15, (1 - f) / 0.25);
      s.mesh.visible = true;
    }
    controller.wind.swirls = active;
  });

  return (
    <group name="wind-swirls">
      {pool.map((s, i) => (
        <primitive key={i} object={s.mesh} />
      ))}
    </group>
  );
}
