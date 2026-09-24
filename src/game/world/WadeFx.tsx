import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { selectAmbientPaused } from '../state/store';
import { registerDaylit } from './materials';
import { RIVER_WATER_U } from './terrain';

/**
 * Wading feedback (spec §4.14): a foam collar hugs the character's legs at the waterline, and
 * expanding wake rings spread from where they step — briskly while moving, a slow ripple when
 * standing still. The rings stay put on the planet, so walking leaves a trail behind.
 * One instanced draw call while wading, none on land. Under Reduce motion or Pause ambient
 * motion the rings are hidden and the collar holds still.
 */

const R = CONFIG.planetRadius;
const RINGS = 14;
/** Instance 0 is the collar; the rest are wake rings. */
const COUNT = RINGS + 1;
const SURFACE = R + RIVER_WATER_U + 0.012;
const Y = new Vector3(0, 1, 0);

interface Ring {
  n: Vector3;
  age: number;
  life: number;
  size: number;
  strength: number;
  alive: boolean;
}

function wakeMaterial(time: { value: number }): MeshStandardMaterial {
  const m = registerDaylit(
    new MeshStandardMaterial({ color: '#f4fbff', emissive: '#bfe6f5', emissiveIntensity: 0.35, roughness: 0.6, transparent: true, depthWrite: false }),
  );
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWakeTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aWake;\nvarying vec2 vWake;\nvarying vec2 vRing;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWake = aWake;\nvRing = uv * 2.0 - 1.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWakeTime;
varying vec2 vWake;
varying vec2 vRing;
float kh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float kn(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(kh(vec2(i, 1.0)), kh(vec2(i + 1.0, 1.0)), f); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float r = length(vRing);
  float ang = atan(vRing.y, vRing.x);
  float a;
  if (vWake.x < 0.0) {
    // collar: a broken, bubbling foam band around the legs
    float wob = (kn(ang * 2.6 + uWakeTime * 1.7) - 0.5) * 0.14 + (kn(ang * 6.0 - uWakeTime * 2.3) - 0.5) * 0.08;
    float band = smoothstep(0.2, 0.06, abs(r - 0.6 - wob));
    float gaps = smoothstep(0.25, 0.55, kn(ang * 4.0 + uWakeTime * 0.9 + 7.0));
    a = band * (0.45 + 0.4 * gaps) * vWake.y;
  } else {
    // wake ring: thins and fades as it spreads
    float age = vWake.x;
    float w = mix(0.13, 0.035, age);
    float broken = 0.65 + 0.35 * kn(ang * 5.0 + vWake.y * 13.0);
    a = smoothstep(w, 0.0, abs(r - 0.82)) * pow(1.0 - age, 1.6) * smoothstep(0.0, 0.08, age) * broken * vWake.y;
  }
  diffuseColor.a *= a;
}`,
      );
  };
  m.customProgramCacheKey = () => 'wake-v1';
  return m;
}

export function WadeFx({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const ref = useRef<InstancedMesh>(null);
  const { geo, mat, wake, rings, time } = useMemo(() => {
    const t = { value: 0 };
    const g = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const attr = new InstancedBufferAttribute(new Float32Array(COUNT * 2), 2);
    g.setAttribute('aWake', attr);
    const list: Ring[] = Array.from({ length: RINGS }, () => ({ n: new Vector3(0, 1, 0), age: 0, life: 1, size: 1, strength: 1, alive: false }));
    return { geo: g, mat: wakeMaterial(t), wake: attr, rings: list, time: t };
  }, []);
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), spin: new Quaternion(), p: new Vector3(), s: new Vector3() }), []);
  const spawnIn = useRef(0);
  const seed = useRef(0);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.1);
    const depth = controller.wadeDepth;
    const wading = depth > 0.025 && !controller.sim.travel;
    const speed = controller.sim.speed;
    if (!paused) time.value += dt;

    // spawn: brisk rings while moving, a slow ripple while standing
    spawnIn.current -= dt;
    if (wading && !paused && spawnIn.current <= 0) {
      const ring = rings.find((r) => !r.alive);
      if (ring) {
        const moving = Math.min(1, speed / CONFIG.walkSpeed);
        ring.n.copy(controller.sim.pLocal);
        ring.age = 0;
        ring.life = moving > 0.15 ? 1.5 : 2.4;
        ring.size = 1.6 + moving * 1.3;
        ring.strength = Math.min(1, depth / 0.12) * (moving > 0.15 ? 0.9 : 0.55);
        ring.alive = true;
        seed.current = (seed.current + 1) % 97;
        spawnIn.current = moving > 0.15 ? 0.34 - 0.14 * moving : 1.1;
      }
    }

    let live = 0;
    const put = (i: number, n: Vector3, scale: number, age: number, strength: number, yaw: number) => {
      tmp.p.copy(n).multiplyScalar(SURFACE);
      tmp.q.setFromUnitVectors(Y, n).multiply(tmp.spin.setFromAxisAngle(Y, yaw));
      tmp.s.setScalar(scale);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      wake.setXY(i, age, strength);
    };
    // collar follows the player, fading in with depth
    const collar = wading ? Math.min(1, depth / 0.08) : 0;
    put(0, controller.sim.pLocal, collar > 0 ? 0.95 : 0, -1, collar, 0);
    rings.forEach((r, k) => {
      if (r.alive && !paused) {
        r.age += dt / r.life;
        if (r.age >= 1) r.alive = false;
      }
      if (r.alive && paused) r.alive = false;
      if (r.alive) {
        live++;
        const grow = 1 - Math.pow(1 - r.age, 2.2);
        put(k + 1, r.n, 0.45 + r.size * grow, r.age, r.strength, k * 1.7 + seed.current);
      } else put(k + 1, r.n, 0, 1, 0, 0);
    });
    mesh.instanceMatrix.needsUpdate = true;
    wake.needsUpdate = true;
    mesh.visible = collar > 0 || live > 0;
    controller.wake.ripples = live;
    controller.wake.collar = collar > 0;
  });

  return <instancedMesh ref={ref} args={[geo, mat, COUNT]} frustumCulled={false} renderOrder={3} visible={false} name="wade-fx" />;
}
