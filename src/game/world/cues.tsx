import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Matrix4, Quaternion, RingGeometry, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import type { Target } from '../systems/interactables';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';

/**
 * What E would use, marked in the world (docs: game-ui/design-system.md §6.5): a glowing ring on
 * the ground with sparkles rising from it. The landmark whose card is up gets a wide ring in its
 * accent colour; the target whose prompt is up (a tree, a flower, the chest, someone to talk to…)
 * gets a small gold one that follows it if it moves. Only one of them at a time (a target near a
 * landmark takes E, and its card hides), so the one thing that glows is the one E will use.
 *
 * Cheap by design: two rings and two sparkle clouds, 4 draws in all, hidden when unused; everything
 * moves in the shaders (no per-frame buffer uploads). Loaded with the wildlife (world/nature.ts).
 */

const R = CONFIG.planetRadius;
const TARGET_GOLD = '#ffb02e';
const UP = new Vector3(0, 1, 0);

// a small hue turn about the grey axis (Rodrigues): the colour varies, the hue family stays
const HUE = /* glsl */ `vec3 hueTurn(vec3 c, float h) {
const vec3 k = vec3(0.57735);
float ca = cos(h);
return max(c * ca + cross(k, c) * sin(h) + k * dot(k, c) * (1.0 - ca), 0.0);
}`;

const ringMaterial = (color: string, inner: number, outer: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new Color(color) }, uTime: { value: 0 }, uOpacity: { value: 0 }, uInner: { value: inner }, uOuter: { value: outer } },
    vertexShader: /* glsl */ `varying vec2 vLocal;
void main() {
vLocal = position.xz;
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `uniform vec3 uColor;
uniform float uTime, uOpacity, uInner, uOuter;
varying vec2 vLocal;
${HUE}
void main() {
float r = length(vLocal);
float t = clamp((r - uInner) / max(uOuter - uInner, 1e-4), 0.0, 1.0);
float a = atan(vLocal.y, vLocal.x);
float edge = smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(0.55, 1.0, t));
float x = (t - 0.33) * 4.5;
float core = exp(-x * x);
float s1 = 0.5 + 0.5 * sin(a * 5.0 - uTime * 1.4);
float s2 = 0.5 + 0.5 * sin(a * 11.0 + uTime * 2.3 + t * 3.0);
float shimmer = s1 * s1 * 0.65 + s2 * s2 * s2 * 0.35;
vec3 col = hueTurn(uColor, 0.14 * sin(a * 3.0 + uTime * 0.6) + 0.12 * (t - 0.4));
col = mix(col, vec3(1.0), 0.08 * core);
float alpha = clamp(uOpacity * edge * (0.6 + 0.35 * core + 0.35 * shimmer), 0.0, 1.0);
gl_FragColor = vec4(col * (0.85 + 0.65 * core + 0.6 * shimmer * core), alpha);
}`,
  });

const sparkMaterial = (color: string, rise: number, size: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color(color) }, uTime: { value: 0 }, uOpacity: { value: 0 }, uScale: { value: 400 }, uSize: { value: size }, uRise: { value: rise }, uRadius: { value: 1 } },
    vertexShader: /* glsl */ `attribute vec4 aSeed;
uniform float uTime, uOpacity, uScale, uSize, uRise, uRadius;
varying float vAlpha;
varying float vHue;
void main() {
float life = fract(uTime * aSeed.y + aSeed.x);
vec3 p = position * vec3(uRadius, 1.0, uRadius);
p.y += life * uRise;
p.x += sin(life * 6.2832 + aSeed.w * 6.2832) * 0.03;
p.z += cos(life * 6.2832 + aSeed.w * 6.2832) * 0.03;
float tw = 0.55 + 0.45 * sin(uTime * (5.0 + 6.0 * aSeed.z) + aSeed.x * 37.0);
vAlpha = uOpacity * sin(life * 3.14159) * tw;
vHue = aSeed.w;
vec4 mv = modelViewMatrix * vec4(p, 1.0);
gl_Position = projectionMatrix * mv;
gl_PointSize = uSize * (0.6 + 0.8 * aSeed.z) * uScale / max(-mv.z, 0.1);
}`,
    fragmentShader: /* glsl */ `uniform vec3 uColor;
varying float vAlpha;
varying float vHue;
${HUE}
void main() {
vec2 c = gl_PointCoord * 2.0 - 1.0;
float d = dot(c, c);
if (d > 1.0) discard;
float g = (1.0 - d) * (1.0 - d);
float cx = max(0.0, 1.0 - abs(c.x) * 7.0) * (1.0 - abs(c.y));
float cy = max(0.0, 1.0 - abs(c.y) * 7.0) * (1.0 - abs(c.x));
float k = clamp(g + 0.7 * (cx + cy), 0.0, 1.5);
vec3 col = mix(hueTurn(uColor, 0.35 * (vHue - 0.5)), vec3(1.0), 0.25 * g);
gl_FragColor = vec4(col * 1.8 * k, clamp(k * vAlpha, 0.0, 1.0));
}`,
  });

/** Sparkle start points: round a ring of `r` (u) in the object's frame (`y` from `height`), with seeds. */
function sparkles(n: number, r: (a: number) => number, height: (x: number, z: number) => number, seed: number): BufferGeometry {
  const pos = new Float32Array(n * 3);
  const seeds = new Float32Array(n * 4);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < n; i++) {
    const a = ((i + rand() * 0.8) / n) * Math.PI * 2;
    const rr = r(a) * (0.92 + rand() * 0.16);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    pos.set([x, height(x, z), z], i * 3);
    seeds.set([rand(), 0.28 + rand() * 0.3, rand(), rand()], i * 4);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  // (the sparkles move in the shader: never cull them by their start points)
  g.boundingSphere = null;
  return g;
}

interface LandmarkCue {
  ring: BufferGeometry;
  spark: BufferGeometry;
  p: Vector3;
  q: Quaternion;
  color: Color;
}

/** A flat ring round a target of radius `r` (u): the band runs from just inside it to a little outside. */
const targetRing = (r: number) => new RingGeometry(Math.max(0.04, r - 0.12), r + 0.1, 48, 1).rotateX(-Math.PI / 2);

const damp = (a: number, b: number, k: number, dt: number) => b + (a - b) * Math.exp(-k * dt);

export function ActivationCues({ controller }: { controller: GameController }) {
  const reduced = useStore(controller.store, selectReducedMotion);
  const paused = useStore(controller.store, selectAmbientPaused);
  const parts = useMemo(() => {
    const cache = new Map<string, LandmarkCue>();
    const landmark = (id: string): LandmarkCue | null => {
      const hit = cache.get(id);
      if (hit) return hit;
      const geo = controller.geos.find((g) => g.id === id);
      if (!geo) return null;
      // placed as the landmark is (on its pad, door forward), and draped on the ground round it
      const p = geo.n.clone().multiplyScalar(R + controller.terrain.height(geo.n) - 0.01);
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(geo.n, geo.door), geo.n, geo.door));
      const v = new Vector3();
      const drape = (x: number, z: number) => {
        v.set(x, 0, z).applyQuaternion(q).add(p);
        return R + controller.terrain.height(v.clone().normalize()) + 0.03 - v.length();
      };
      const inner = geo.footprintU + 0.16;
      const outer = geo.footprintU + 0.5;
      const ring = new RingGeometry(inner, outer, 72, 2).rotateX(-Math.PI / 2);
      const pos = ring.getAttribute('position');
      for (let i = 0; i < pos.count; i++) pos.setY(i, drape(pos.getX(i), pos.getZ(i)));
      const spark = sparkles(44, () => geo.footprintU + 0.3, drape, 7 + cache.size * 13);
      const cue = { ring, spark, p, q, color: new Color(controller.dataById.get(id)?.accent ?? TARGET_GOLD) };
      cache.set(id, cue);
      return cue;
    };
    const first = controller.geos[0] ? landmark(controller.geos[0].id) : null;
    return {
      landmark,
      first,
      ringL: ringMaterial(TARGET_GOLD, 0, 1),
      sparkL: sparkMaterial(TARGET_GOLD, 0.9, 0.07),
      ringT: ringMaterial(TARGET_GOLD, 0.11, 0.26),
      sparkT: sparkMaterial(TARGET_GOLD, 0.9, 0.12),
      // the target's ring is made to fit each target (a band of the same width round anything); its sparkles start on a unit circle
      ringGeoT: targetRing(0.2),
      sparkGeoT: sparkles(24, () => 1, () => 0.02, 3),
    };
  }, [controller]);
  const lGroup = useRef<Group>(null);
  const tGroup = useRef<Group>(null);
  const shown = useRef<{ id: string | null; key: string | null; t: Target | null; time: number }>({ id: null, key: null, t: null, time: 0 });

  useFrame(({ gl, camera }, dt) => {
    const s = controller.store.getState();
    const st = shown.current;
    if (!paused && !reduced) st.time += dt;
    // sparkle size: pixels per unit at distance 1 (the drawing buffer and the camera's field of view)
    const fov = (camera as PerspectiveCamera).fov ?? 40;
    const scale = gl.domElement.height / (2 * Math.tan(((fov * Math.PI) / 180) * 0.5));
    const k = reduced ? 1000 : 8;

    // the landmark whose card is up (not when something right by you takes E instead)
    const id = s.nearbyId && !s.traveling && !s.target ? s.nearbyId : null;
    const lg = lGroup.current;
    if (lg) {
      if (id && id !== st.id) {
        const cue = parts.landmark(id);
        if (cue) {
          st.id = id;
          lg.position.copy(cue.p);
          lg.quaternion.copy(cue.q);
          (lg.children[0] as unknown as { geometry: BufferGeometry }).geometry = cue.ring;
          (lg.children[1] as unknown as { geometry: BufferGeometry }).geometry = cue.spark;
          const geo = controller.geos.find((g) => g.id === id)!;
          parts.ringL.uniforms.uInner.value = geo.footprintU + 0.16;
          parts.ringL.uniforms.uOuter.value = geo.footprintU + 0.5;
          parts.ringL.uniforms.uColor.value.copy(cue.color);
          parts.sparkL.uniforms.uColor.value.copy(cue.color);
        }
      }
      const o = damp(parts.ringL.uniforms.uOpacity.value, id ? 1 : 0, k, dt);
      parts.ringL.uniforms.uOpacity.value = o;
      parts.sparkL.uniforms.uOpacity.value = o;
      lg.visible = o > 0.004;
    }

    // the target whose prompt is up: follow it (someone walking, Chopper trotting)
    const key = s.traveling ? null : (s.target?.key ?? null);
    const tg = tGroup.current;
    if (tg && key !== st.key) {
      st.key = key;
      const t = key ? (controller.targets.find((x) => x.key === key) ?? null) : null;
      if (t) {
        st.t = t;
        const r = t.markU ?? Math.max(0.2, t.edgeU + 0.16);
        const ring = tg.children[0] as unknown as { geometry: BufferGeometry };
        if (ring.geometry !== parts.ringGeoT) ring.geometry.dispose();
        ring.geometry = targetRing(r);
        parts.ringT.uniforms.uInner.value = Math.max(0.04, r - 0.12);
        parts.ringT.uniforms.uOuter.value = r + 0.1;
        parts.sparkT.uniforms.uRadius.value = r;
      }
    }
    const t = st.t;
    if (tg && t) {
      tg.position.copy(t.n).multiplyScalar(R + controller.terrain.height(t.n) + 0.05 + (t.markLift ?? 0));
      tg.quaternion.setFromUnitVectors(UP, t.n);
      const o = damp(parts.ringT.uniforms.uOpacity.value, key ? 1 : 0, k, dt);
      parts.ringT.uniforms.uOpacity.value = o;
      parts.sparkT.uniforms.uOpacity.value = o;
      tg.visible = o > 0.004;
    } else if (tg) tg.visible = false;

    for (const m of [parts.ringL, parts.sparkL, parts.ringT, parts.sparkT]) m.uniforms.uTime.value = st.time;
    parts.sparkL.uniforms.uScale.value = scale;
    parts.sparkT.uniforms.uScale.value = scale;
  });

  // (mounted visible, so their programs compile with the scene before the first frame; hidden once running)
  return (
    <>
      <group ref={lGroup} name="landmark-cue">
        <mesh geometry={parts.first?.ring ?? parts.ringGeoT} material={parts.ringL} renderOrder={2} frustumCulled={false} />
        <points geometry={parts.first?.spark ?? parts.sparkGeoT} material={parts.sparkL} renderOrder={3} frustumCulled={false} />
      </group>
      <group ref={tGroup} name="target-cue">
        <mesh geometry={parts.ringGeoT} material={parts.ringT} renderOrder={2} frustumCulled={false} />
        <points geometry={parts.sparkGeoT} material={parts.sparkT} renderOrder={3} frustumCulled={false} />
      </group>
    </>
  );
}
