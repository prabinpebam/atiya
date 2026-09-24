import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { useStore } from 'zustand';
import { CircleGeometry, Group, MeshBasicMaterial } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { selectReducedMotion } from '../state/store';
import { PALETTE, toon } from '../world/materials';

const R = CONFIG.planetRadius;

/** Placeholder "bean" character (spec §4.4 fallback) with procedural walk. */
export function Character({ controller }: { controller: GameController }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const footL = useRef<Group>(null);
  const footR = useRef<Group>(null);
  const phase = useRef(0);
  const reduced = useStore(controller.store, selectReducedMotion);
  const shadow = useMemo(
    () => ({
      geo: new CircleGeometry(0.42, 20),
      mat: new MeshBasicMaterial({ color: '#1d2a1a', transparent: true, opacity: 0.22, depthWrite: false }),
    }),
    [],
  );

  useFrame((_, dt) => {
    const sim = controller.sim;
    const speed = sim.speed;
    if (root.current) root.current.rotation.y = sim.heading;
    phase.current += speed * Math.min(dt, 0.1) * 3.4;
    const amt = Math.min(1, speed / CONFIG.walkSpeed);
    const swing = Math.sin(phase.current) * 0.14 * amt;
    if (footL.current) footL.current.position.z = swing;
    if (footR.current) footR.current.position.z = -swing;
    if (body.current) {
      body.current.position.y = reduced ? 0 : Math.abs(Math.sin(phase.current)) * 0.06 * amt;
      body.current.rotation.x = reduced ? 0 : (speed / CONFIG.runSpeed) * 0.16;
    }
  });

  return (
    <group position={[0, R, 0]} name="character">
      <mesh geometry={shadow.geo} material={shadow.mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1} />
      <group ref={root}>
        <group ref={footL} position={[0.13, 0, 0]}>
          <mesh position={[0, 0.07, 0.03]} material={toon(PALETTE.pants)} castShadow>
            <boxGeometry args={[0.14, 0.14, 0.24]} />
          </mesh>
        </group>
        <group ref={footR} position={[-0.13, 0, 0]}>
          <mesh position={[0, 0.07, 0.03]} material={toon(PALETTE.pants)} castShadow>
            <boxGeometry args={[0.14, 0.14, 0.24]} />
          </mesh>
        </group>
        <group ref={body}>
          <mesh position={[0, 0.42, 0]} material={toon(PALETTE.shirt)} castShadow>
            <capsuleGeometry args={[0.24, 0.26, 4, 12]} />
            <Outlines thickness={0.03} color={PALETTE.outline} />
          </mesh>
          <mesh position={[0, 0.86, 0]} material={toon(PALETTE.skin)} castShadow>
            <sphereGeometry args={[0.24, 16, 12]} />
            <Outlines thickness={0.03} color={PALETTE.outline} />
          </mesh>
          <mesh position={[0, 0.98, -0.02]} material={toon('#4a3326')}>
            <sphereGeometry args={[0.245, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
          </mesh>
          <mesh position={[0.08, 0.88, 0.21]} material={toon('#2d2a32')}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
          <mesh position={[-0.08, 0.88, 0.21]} material={toon('#2d2a32')}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
