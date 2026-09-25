import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, TiltShift, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize, ToneMappingMode, type TiltShiftEffect } from 'postprocessing';
import { useStore } from 'zustand';
import { WebGLRenderTarget, type Group, type Material, type Mesh, type Object3D, type ShaderMaterial, type Texture, type WebGLRenderer } from 'three';
import type { GameController } from './controller';
import { DioramaCamera } from './camera/DioramaCamera';
import { Player } from './player/Player';
import { DoorLight, Landmark } from './world/Landmark';
import { Planet } from './world/Planet';
import { Plaza } from './world/Plaza';
import { Props } from './world/Props';
import { Clouds } from './world/Sky';
import { DayNight } from './world/DayNight';
import { Bridges, Cliffs, Water } from './world/Landforms';
import { FlyingLeaves, WindDriver, WindSwirls } from './world/WindFx';
import { WadeFx } from './world/WadeFx';
import { updateLampUniforms } from './world/lampLights';

/** Upload every texture the scene's materials use (`initTexture`), so none waits for its first draw. */
function uploadTextures(gl: WebGLRenderer, scene: Object3D): void {
  const seen = new Set<Texture>();
  scene.traverse((o) => {
    const mat = (o as Mesh).material as Material | Material[] | undefined;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      for (const v of Object.values(m)) if ((v as Texture | null)?.isTexture) seen.add(v as Texture);
      const uniforms = (m as ShaderMaterial).uniforms;
      if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as Texture | null)?.isTexture) seen.add(u.value as Texture);
    }
  });
  for (const t of seen) if (!(t as { isRenderTargetTexture?: boolean }).isRenderTargetTexture) gl.initTexture(t);
}

/** A camera layer nothing is on: the view draws nothing while the shaders compile. */
const WARMUP_LAYER = 31;

/**
 * Drives the simulation first each frame, then applies the planet rotation.
 *
 * Shader warm-up: every material's program is compiled with `compileAsync` (parallel, off the
 * main thread where KHR_parallel_shader_compile exists) *before* the scene is first drawn. Until
 * then the camera looks at an empty layer, so no draw forces a blocking compile-and-link (which
 * froze the main thread for ~2 s on load). The loading screen stays up throughout.
 */
function SimDriver({ controller, planet }: { controller: GameController; planet: React.RefObject<Group | null> }) {
  const frames = useRef(0);
  const warm = useRef<{ start: (() => void) | null; done: boolean }>({ start: null, done: false });
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  // layout effect: the camera is switched to the empty layer before anything can be drawn
  useLayoutEffect(() => {
    gl.info.autoReset = false;
    // shader error checks query link status synchronously; keep them for dev and test builds
    gl.debug.checkShaderErrors = import.meta.env.MODE !== 'production';
    controller.gfx = { gl, scene };
    const mask = camera.layers.mask;
    // compile against a twin with the real layers, so the lights (and so the programs) match
    const probe = camera.clone();
    camera.layers.set(WARMUP_LAYER);
    const w = warm.current;
    w.done = false;
    let safety = 0;
    const finish = () => {
      if (w.done) return;
      w.done = true;
      w.start = null;
      window.clearTimeout(safety);
      camera.layers.mask = mask;
      performance.mark('game:shaders-ready');
    };
    // started from the first frame, once every component's effects have added their objects and lights
    w.start = () => {
      w.start = null;
      performance.mark('game:shaders-compile');
      safety = window.setTimeout(finish, 10_000);
      // the scene is drawn into the composer's (linear) buffer, not the canvas: compile for a render
      // target too, or every program would be built again, blocking, for the other output encoding
      const prev = gl.getRenderTarget();
      const target = new WebGLRenderTarget(1, 1);
      gl.setRenderTarget(target);
      const compiling = gl.compileAsync ? gl.compileAsync(scene, probe) : Promise.resolve();
      gl.setRenderTarget(prev);
      // upload the textures while the driver compiles (they'd otherwise all upload in the first frame)
      uploadTextures(gl, scene);
      compiling.then(finish, finish).finally(() => target.dispose());
    };
    return finish;
  }, [gl, scene, camera, controller]);

  useFrame((_, delta) => {
    controller.lastRenderInfo = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
    gl.info.reset();
    warm.current.start?.();
    controller.tick(delta);
    planet.current?.quaternion.copy(controller.sim.planetQ);
    if (warm.current.done && frames.current < 3 && ++frames.current === 3) controller.markReady();
  });
  return null;
}

/**
 * Packs the lit lamps into the shared lamp uniforms once per frame, right before drawing (after
 * three.js has updated the planet's world matrix for this frame), so the lamplight never lags.
 */
function LampDriver({ planet }: { planet: React.RefObject<Group | null> }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      prev.apply(scene, args);
      if (planet.current) updateLampUniforms(planet.current.matrixWorld);
    };
    return () => {
      scene.onBeforeRender = prev;
    };
  }, [scene, planet]);
  return null;
}

const DPR_STEPS = [1, 1.25, 1.5, 2] as const;

/**
 * Adaptive quality: on sustained low FPS step the resolution down (… → 1.25 → 1), then drop
 * bloom/vignette. It never removes the tilt-shift or switches tiers. It only watches once the
 * planet is playable, and then waits 10 s more, so loading never counts against the device.
 */
function Adaptive({ controller }: { controller: GameController }) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const max = coarse ? 1.5 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const initial = Math.min(1.5, max);
  const lastChange = useRef(0);
  const change = (dir: -1 | 1, force = false) => {
    const s = controller.store.getState();
    if (!s.adaptiveQuality && !force) return;
    const now = performance.now();
    if (!force && now - lastChange.current < 10_000) return;
    const steps = DPR_STEPS.filter((d) => d <= max);
    const i = Math.max(0, steps.findIndex((d) => d >= s.dpr - 1e-3));
    if (dir < 0) {
      if (i > 0) controller.store.setState({ dpr: steps[i - 1] });
      else if (s.postLevel === 2) controller.store.setState({ postLevel: 1 });
      else return;
    } else {
      if (s.postLevel === 1) controller.store.setState({ postLevel: 2 });
      else if (i < steps.length - 1) controller.store.setState({ dpr: steps[i + 1] });
      else return;
    }
    lastChange.current = now;
  };
  useEffect(() => {
    lastChange.current = performance.now(); // warm-up: no changes for the first 10 s
    controller.store.setState({ dpr: initial });
    controller.adaptiveStep = change;
    return () => {
      controller.adaptiveStep = null;
    };
  }, [controller, initial]);
  // The monitor starts, and the warm-up counts, from when the planet is first really drawn: the
  // loading frames (empty warm-up frames, then a few slow first uploads) would otherwise read as
  // flip-flops and trip the fallback, switching adaptive quality off for the whole visit.
  const playable = useStore(controller.store, (s) => s.phase !== 'loading');
  useEffect(() => {
    if (playable) lastChange.current = performance.now();
  }, [playable]);
  if (!playable) return null;
  return (
    <PerformanceMonitor
      flipflops={4}
      onDecline={() => change(-1)}
      onIncline={() => change(1)}
      onFallback={() => controller.store.setState({ adaptiveQuality: false })}
    />
  );
}

/**
 * Post-processing. The tilt-shift (the diorama look) is always on; `high` adds bloom and a
 * vignette unless adaptive quality has fallen back to postLevel 1. `low` uses a cheaper blur.
 */
/**
 * Keeps a post-processing failure from taking the whole game UI down. Building the composer's passes
 * reads the context attributes, which are null once the WebGL context is lost; if the chain happens
 * to be (re)built just as the context goes, that throws. The boundary then draws no post-processing;
 * PostFX unmounts it while the context is lost and mounts a fresh one when it's restored.
 */
class PostFxBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PostFX({ controller }: { controller: GameController }) {
  const quality = useStore(controller.store, (s) => s.quality);
  const full = useStore(controller.store, (s) => s.quality === 'high' && s.postLevel === 2);
  const lost = useStore(controller.store, (s) => s.contextLost);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    controller.postFx = full ? 'tilt-shift+bloom+vignette' : 'tilt-shift';
  }, [controller, full]);
  const tiltRef = useCallback(
    (e: TiltShiftEffect | null) => {
      if (e) controller.grading.tiltBlend = Object.keys(BlendFunction).find((k) => BlendFunction[k as keyof typeof BlendFunction] === e.blendMode.blendFunction) ?? '';
    },
    [controller],
  );
  // The composer rebuilds its whole pass chain whenever its children change identity, so they're
  // memoised: only a tier / post-level change rebuilds it (not every re-render of the scene).
  const composer = useMemo(() => {
    // The wrapper defaults TiltShift to ADD, which sums the (already complete) tilt-shift image
    // onto the input: twice the radiance into the tone map and clipped highlights. NORMAL replaces it.
    const tilt = (
      <TiltShift
        ref={tiltRef}
        blendFunction={BlendFunction.NORMAL}
        offset={-0.06}
        // art direction: a subtle miniature softening at the very edges, the planet itself crisp
        focusArea={0.86}
        feather={0.3}
        kernelSize={KernelSize.VERY_SMALL}
        resolutionScale={quality === 'high' ? 0.5 : 0.35}
      />
    );
    // Separate keyed composers: switching rebuilds the pass chain cleanly (no conditional children).
    if (full) {
      return (
        <EffectComposer key="full" multisampling={4}>
          {tilt}
          <Bloom luminanceThreshold={1.15} luminanceSmoothing={0.15} intensity={0.45} mipmapBlur />
          <Vignette offset={0.3} darkness={0.32} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      );
    }
    return (
      <EffectComposer key="lite" multisampling={quality === 'high' ? 4 : 2}>
        {tilt}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    );
  }, [full, quality, tiltRef]);
  // No composer while the WebGL context is lost: building passes then reads the (null) context
  // attributes and throws, which took the whole game UI (and its Reload prompt) down with it.
  if (lost || gl.getContext().isContextLost()) return null;
  return <PostFxBoundary>{composer}</PostFxBoundary>;
}

export function Scene({ controller }: { controller: GameController }) {
  const planet = useRef<Group>(null);
  const quality = useStore(controller.store, (s) => s.quality);
  const shadowSize = quality === 'high' ? 2048 : 1024;
  return (
    <>
      <SimDriver controller={controller} planet={planet} />
      <LampDriver planet={planet} />
      <Adaptive controller={controller} />
      <DioramaCamera controller={controller} />
      <DayNight controller={controller} shadowSize={shadowSize} />
      <WindDriver controller={controller} />
      <Clouds controller={controller} />
      <group ref={planet} name="planet-root">
        <Planet controller={controller} />
        <Cliffs controller={controller} />
        <Water controller={controller} />
        <WadeFx controller={controller} />
        <Bridges controller={controller} />
        <FlyingLeaves controller={controller} />
        <WindSwirls controller={controller} />
        <Plaza controller={controller} />
        <Props controller={controller} />
        {controller.geos.map((g) => (
          <Landmark key={g.id} controller={controller} geo={g} data={controller.dataById.get(g.id)!} />
        ))}
        <DoorLight controller={controller} />
      </group>
      <Player controller={controller} />
      <PostFX controller={controller} />
    </>
  );
}
