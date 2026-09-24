import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import type { Group } from 'three';
import type { GameController } from './controller';
import { DioramaCamera } from './camera/DioramaCamera';
import { Character } from './player/Character';
import { Landmark } from './world/Landmark';
import { Planet } from './world/Planet';
import { Plaza } from './world/Plaza';
import { Props } from './world/Props';

/** Drives the simulation first each frame, then applies the planet rotation. */
function SimDriver({ controller, planet }: { controller: GameController; planet: React.RefObject<Group | null> }) {
  const frames = useRef(0);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    // Compile shaders up front so the first movement doesn't hitch.
    void gl.compileAsync?.(scene, camera);
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    controller.tick(delta);
    planet.current?.quaternion.copy(controller.sim.planetQ);
    if (frames.current < 3 && ++frames.current === 3) controller.markReady();
  });
  return null;
}

function Adaptive({ controller }: { controller: GameController }) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const max = coarse ? 1.5 : Math.min(2, window.devicePixelRatio || 1);
  const lastChange = useRef(0);
  const set = (dpr: number) => {
    const s = controller.store.getState();
    if (!s.adaptiveQuality) return;
    const now = performance.now();
    if (now - lastChange.current < 10_000 || s.dpr === dpr) return;
    lastChange.current = now;
    controller.store.setState({ dpr });
  };
  useEffect(() => {
    controller.store.setState({ dpr: Math.min(1.5, max) });
  }, [controller, max]);
  return <PerformanceMonitor flipflops={3} onDecline={() => set(1)} onIncline={() => set(Math.min(1.5, max))} onFallback={() => set(1)} />;
}

export function Scene({ controller }: { controller: GameController }) {
  const planet = useRef<Group>(null);
  return (
    <>
      <SimDriver controller={controller} planet={planet} />
      <Adaptive controller={controller} />
      <DioramaCamera controller={controller} />
      <fog attach="fog" args={['#cfeaff', 18, 32]} />
      <hemisphereLight args={['#eaf6ff', '#6f9a5a', 1.25]} />
      <directionalLight
        position={[7, 24, 12]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.0005}
      />
      <group ref={planet} name="planet-root">
        <Planet controller={controller} />
        <Plaza controller={controller} />
        <Props trees={controller.props.trees} rocks={controller.props.rocks} flowers={controller.props.flowers} />
        {controller.geos.map((g) => (
          <Landmark key={g.id} controller={controller} geo={g} data={controller.dataById.get(g.id)!} />
        ))}
      </group>
      <Character controller={controller} />
    </>
  );
}
