import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, TiltShift, ToneMapping, Vignette } from '@react-three/postprocessing';
import { KernelSize, ToneMappingMode } from 'postprocessing';
import { useStore } from 'zustand';
import type { Group } from 'three';
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

/** Drives the simulation first each frame, then applies the planet rotation. */
function SimDriver({ controller, planet }: { controller: GameController; planet: React.RefObject<Group | null> }) {
  const frames = useRef(0);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    // Compile shaders up front so the first movement doesn't hitch.
    void gl.compileAsync?.(scene, camera);
    gl.info.autoReset = false;
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    controller.lastRenderInfo = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
    gl.info.reset();
    controller.tick(delta);
    planet.current?.quaternion.copy(controller.sim.planetQ);
    if (frames.current < 3 && ++frames.current === 3) controller.markReady();
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
 * bloom/vignette. It never removes the tilt-shift or switches tiers. A warm-up after mount
 * ignores the shader-compile hitches of the first seconds.
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
function PostFX({ controller }: { controller: GameController }) {
  const quality = useStore(controller.store, (s) => s.quality);
  const full = useStore(controller.store, (s) => s.quality === 'high' && s.postLevel === 2);
  useEffect(() => {
    controller.postFx = full ? 'tilt-shift+bloom+vignette' : 'tilt-shift';
  }, [controller, full]);
  const tilt = (
    <TiltShift
      offset={-0.06}
      focusArea={0.46}
      feather={0.32}
      kernelSize={quality === 'high' ? KernelSize.MEDIUM : KernelSize.SMALL}
      resolutionScale={quality === 'high' ? 0.5 : 0.35}
    />
  );
  // Separate keyed composers: switching rebuilds the pass chain cleanly (no conditional children).
  if (full) {
    return (
      <EffectComposer key="full" multisampling={4}>
        {tilt}
        <Bloom luminanceThreshold={1.15} luminanceSmoothing={0.15} intensity={0.55} mipmapBlur />
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
