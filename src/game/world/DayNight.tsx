import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  Vector3,
} from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { DAY_HOURS, advanceHours, localHours, sampleSky, sceneExposure, wrapHours, type SkyState } from './timeOfDay';
import { mulberry32 } from './layout';
import { applyTimeOfDay } from './materials';
import { cloudMaterial } from './Sky';
import { gameTexture } from './textures';

const R = CONFIG.planetRadius;
/** Sky objects live on a plane behind the planet (camera frame), like the clouds. */
const SKY_Z = -50;
const STAR_Z = -62;
/** Hours per second when fast-forwarding to a newly chosen time mode. */
const FAST_FORWARD = 9;

// ---------------------------------------------------------------------------
// Glowing points (stars, fireflies): soft round sprites with a gentle twinkle.
// ---------------------------------------------------------------------------

function glowPointsMaterial(color: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: color }, uDrift: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPixelRatio;
      uniform float uDrift;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p += uDrift * vec3(sin(uTime * 0.7 + aPhase), sin(uTime * 1.1 + aPhase * 2.0) * 0.6, cos(uTime * 0.6 + aPhase * 1.3));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.6 + 0.4 * sin(uTime * 1.9 + aPhase * 6.0);
        vAlpha = uOpacity * tw;
        gl_PointSize = aSize * uPixelRatio * (0.8 + 0.2 * tw);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, r);
        a = a * a * vAlpha;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
}

function pointsGeometry(positions: number[], sizes: number[], phases: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  g.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
  return g;
}

function radialTexture(inner: string, outer: string, mid?: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  if (mid) grad.addColorStop(0.45, mid);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function moonTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf6e4';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  const craters: [number, number, number][] = [
    [44, 46, 14],
    [82, 70, 10],
    [58, 88, 8],
    [86, 38, 6],
    [36, 78, 5],
  ];
  g.fillStyle = 'rgba(196, 190, 170, 0.55)';
  for (const [x, y, r] of craters) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Position on the sky plane for a body at `arc` (0 rise … 1 set): rises bottom-left, sets bottom-right. */
function skyPosition(arc: number, out: Vector3): Vector3 {
  const a = arc * Math.PI;
  return out.set(-Math.cos(a) * 30, -29.5 + Math.sin(a) * 19.5, SKY_Z);
}

function arcVisibility(arc: number): number {
  const s = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return s(-0.04, 0.04, arc) * (1 - s(0.96, 1.04, arc));
}

function useSkyBody(kind: 'sun' | 'moon') {
  return useMemo(() => {
    const size = kind === 'sun' ? 2.3 : 1.7;
    const disc = new Mesh(
      new CircleGeometry(size, 40),
      new MeshBasicMaterial({
        color: kind === 'sun' ? new Color(3.2, 2.6, 1.7) : new Color(1.35, 1.35, 1.3),
        map: kind === 'moon' ? (gameTexture('moon') ?? moonTexture()) : null,
        transparent: true,
        toneMapped: false,
        fog: false,
        depthWrite: false,
      }),
    );
    const halo = new Mesh(
      new PlaneGeometry(size * 6, size * 6),
      new MeshBasicMaterial({
        map: kind === 'sun' ? radialTexture('rgba(255,236,190,0.9)', 'rgba(255,200,140,0)') : radialTexture('rgba(190,210,255,0.55)', 'rgba(150,170,255,0)'),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    halo.position.z = -0.2;
    disc.renderOrder = -2;
    halo.renderOrder = -3;
    return { disc, halo };
  }, [kind]);
}

// ---------------------------------------------------------------------------
// Scene rig: lights, fog, sky gradient, sun, moon, stars. Advances the clock.
// ---------------------------------------------------------------------------

export function DayNight({ controller, shadowSize }: { controller: GameController; shadowSize: number }) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const mode = useStore(controller.store, (s) => s.timeMode);
  const paused = useStore(controller.store, selectAmbientPaused);
  const reduced = useStore(controller.store, selectReducedMotion);
  const hemi = useRef<HemisphereLight>(null);
  const light = useRef<DirectionalLight>(null);
  const sun = useSkyBody('sun');
  const moon = useSkyBody('moon');

  const sky = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { canvas, ctx: canvas.getContext('2d')!, texture, fog: new Fog('#d6eeff', 20, 34) };
  }, []);

  const stars = useMemo(() => {
    const rand = mulberry32(7);
    const pos: number[] = [];
    const size: number[] = [];
    const phase: number[] = [];
    for (let i = 0; i < 170; i++) {
      pos.push(-50 + rand() * 100, -42 + rand() * 30, STAR_Z - rand() * 6);
      size.push(rand() < 0.15 ? 13 + rand() * 5 : 7 + rand() * 4);
      phase.push(rand() * 10);
    }
    const mat = glowPointsMaterial(new Color(2.4, 2.4, 2.8));
    const pts = new Points(pointsGeometry(pos, size, phase), mat);
    pts.frustumCulled = false;
    pts.renderOrder = -4;
    return { pts, mat };
  }, []);

  useLayoutEffect(() => {
    const prevBg = scene.background;
    const prevFog = scene.fog;
    scene.background = sky.texture;
    scene.fog = sky.fog;
    return () => {
      scene.background = prevBg;
      scene.fog = prevFog;
      sky.texture.dispose();
    };
  }, [scene, sky]);

  // Changing the time mode fast-forwards to the new time (instant with reduced motion).
  const target = useRef<number | null>(null);
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    const goal = mode === 'local' ? localHours() : mode === 'day' ? DAY_HOURS : null;
    if (goal === null) {
      target.current = null;
      return;
    }
    if (reduced) {
      controller.timeOfDay = goal;
      target.current = null;
    } else target.current = goal;
  }, [mode, reduced, controller]);

  const last = useRef<{ h: number; s: SkyState | null }>({ h: -1, s: null });
  const elapsed = useRef(0);

  const apply = (s: SkyState) => {
    if (hemi.current) {
      hemi.current.color.copy(s.hemiSky);
      hemi.current.groundColor.copy(s.hemiGround);
      hemi.current.intensity = s.hemiIntensity;
    }
    if (light.current) {
      light.current.position.copy(s.lightDir).multiplyScalar(26);
      light.current.color.copy(s.lightColor);
      light.current.intensity = s.lightIntensity;
    }
    sky.fog.color.copy(s.fog);
    const grad = sky.ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${s.skyTop.getHexString()}`);
    grad.addColorStop(0.55, `#${s.skyMid.getHexString()}`);
    grad.addColorStop(1, `#${s.skyBottom.getHexString()}`);
    sky.ctx.fillStyle = grad;
    sky.ctx.fillRect(0, 0, 2, 256);
    sky.texture.needsUpdate = true;

    const clouds = cloudMaterial();
    clouds.color.copy(s.cloudTint);
    clouds.emissive.copy(s.cloudTint);
    clouds.emissiveIntensity = 0.35 - 0.2 * s.night;

    applyTimeOfDay(s.glow, s.night);

    const sv = arcVisibility(s.sunArc);
    sun.disc.visible = sun.halo.visible = sv > 0.001;
    skyPosition(Math.min(1.06, Math.max(-0.06, s.sunArc)), sun.disc.position);
    sun.halo.position.set(sun.disc.position.x, sun.disc.position.y, SKY_Z - 0.2);
    const warm = Math.min(1, Math.abs(s.sunArc - 0.5) * 2); // redder near the horizon
    (sun.disc.material as MeshBasicMaterial).color.setRGB(3.2, 2.6 - warm * 0.9, 1.7 - warm * 1.0);
    (sun.disc.material as MeshBasicMaterial).opacity = sv;
    (sun.halo.material as MeshBasicMaterial).opacity = sv * (0.55 + warm * 0.35);

    const mv = arcVisibility(s.moonArc) * Math.min(1, s.night * 1.3);
    moon.disc.visible = moon.halo.visible = mv > 0.001;
    skyPosition(Math.min(1.06, Math.max(-0.06, s.moonArc)), moon.disc.position);
    moon.halo.position.set(moon.disc.position.x, moon.disc.position.y, SKY_Z - 0.2);
    (moon.disc.material as MeshBasicMaterial).opacity = mv;
    (moon.halo.material as MeshBasicMaterial).opacity = mv * 0.8;

    stars.mat.uniforms.uOpacity.value = Math.max(0, Math.min(1, (s.night - 0.35) / 0.5));
    stars.pts.visible = s.night > 0.35;
    controller.sky.night = s.night;
    controller.sky.glow = s.glow;
    gl.toneMappingExposure = controller.grading.exposure = sceneExposure(s.night);
  };

  useFrame((_, dt) => {
    let h = controller.timeOfDay;
    // read the mode live: a hand-set time switches it before React re-renders this component
    const mode = controller.store.getState().timeMode;
    if (controller.timeHeld) {
      // the visitor is dragging the clock: it stays where they put it, and any fast-forward is dropped
      target.current = null;
    } else if (controller.timeFrozen) {
      // test hook: hold the requested time
    } else if (target.current !== null) {
      const remaining = wrapHours(target.current - h);
      const step = Math.min(remaining, dt * FAST_FORWARD);
      h = wrapHours(h + step);
      if (remaining - step < 1e-3) {
        h = target.current;
        target.current = null;
      }
    } else if (mode === 'cycle') {
      if (!paused) h = advanceHours(h, dt);
    } else if (mode === 'local') {
      h = localHours();
    } else {
      h = DAY_HOURS;
    }
    controller.timeOfDay = h;
    if (!paused) elapsed.current += dt;
    stars.mat.uniforms.uTime.value = elapsed.current;
    stars.mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    // sun and moon face the camera (no foreshortening under the tilted view)
    for (const m of [sun.disc, sun.halo, moon.disc, moon.halo]) m.quaternion.copy(camera.quaternion);
    // sampling is cheap, but skip it (and the sky texture upload) when the clock barely moved
    if (last.current.s && Math.abs(h - last.current.h) < 0.004) return;
    const s = sampleSky(h);
    last.current = { h, s };
    apply(s);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e3f3ff', '#86ad63', 1.45]} />
      <directionalLight
        ref={light}
        position={[7, 24, 12]}
        color="#fff1dc"
        intensity={2.3}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={52}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-intensity={0.72}
      />
      <primitive object={stars.pts} />
      <primitive object={sun.halo} />
      <primitive object={sun.disc} />
      <primitive object={moon.halo} />
      <primitive object={moon.disc} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Fireflies (planet space): drift over the pond and flower beds after dusk.
// ---------------------------------------------------------------------------

export function Fireflies({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const gl = useThree((s) => s.gl);
  const t = useRef(0);
  const { pts, mat } = useMemo(() => {
    const rand = mulberry32(23);
    const layout = controller.props;
    const anchors: Vector3[] = [];
    if (layout.pond) for (let i = 0; i < 8; i++) anchors.push(layout.pond.n);
    const beds = [...layout.flowers.cosmos, ...layout.flowers.tulip, ...layout.flowers.pansy];
    for (let i = 0; i < beds.length; i += 3) anchors.push(beds[i].n);
    for (let i = 0; i < layout.bushes.length; i += 2) anchors.push(layout.bushes[i].n);
    const pos: number[] = [];
    const size: number[] = [];
    const phase: number[] = [];
    const tangent = new Vector3();
    const bitangent = new Vector3();
    for (const n of anchors) {
      tangent.set(n.z, 0, -n.x);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.normalize();
      bitangent.crossVectors(n, tangent);
      const spread = layout.pond && n === layout.pond.n ? layout.pond.radiusU * 1.3 : 0.9;
      const a = (rand() - 0.5) * 2 * spread;
      const b = (rand() - 0.5) * 2 * spread;
      const p = n.clone().addScaledVector(tangent, a / R).addScaledVector(bitangent, b / R).normalize();
      p.multiplyScalar(R + Math.max(0, controller.terrain.height(p)) + 0.45 + rand() * 0.8);
      pos.push(p.x, p.y, p.z);
      size.push(7 + rand() * 4);
      phase.push(rand() * 10);
    }
    const m = glowPointsMaterial(new Color(2.4, 2.7, 1.1));
    m.uniforms.uDrift.value = 0.22;
    const points = new Points(pointsGeometry(pos, size, phase), m);
    points.frustumCulled = false;
    return { pts: points, mat: m };
  }, [controller]);

  useFrame((_, dt) => {
    if (!paused) t.current += dt;
    const n = controller.sky.night;
    const o = Math.max(0, Math.min(1, (n - 0.45) / 0.4));
    mat.uniforms.uOpacity.value = o;
    mat.uniforms.uTime.value = t.current;
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    pts.visible = o > 0.001;
  });

  return <primitive object={pts} />;
}

// ---------------------------------------------------------------------------
// Lamps: how lit they are through the day (the lamplight itself is in lampLights.ts).
// ---------------------------------------------------------------------------

/** How lit the lamps are (0 by day → 1 after dusk), from the sky's night factor. */
export function lampsOn(night: number): number {
  return Math.max(0, Math.min(1, (night - 0.2) / 0.6));
}

