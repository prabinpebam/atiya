import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html, Outlines } from '@react-three/drei';
import { useStore } from 'zustand';
import { AdditiveBlending, Group, MeshBasicMaterial } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import type { LandmarkData } from '../types';
import { landmarkObjectQuaternion, type LandmarkGeometry } from '../math/landmarks';
import { damp } from '../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { PALETTE, toon } from './materials';

const R = CONFIG.planetRadius;
const OUTLINE = <Outlines thickness={0.035} color={PALETTE.outline} />;

interface Part {
  accent: string;
}

function Box({ size, position, color, outline = true, rotation }: { size: [number, number, number]; position: [number, number, number]; color: string; outline?: boolean; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation} material={toon(color)} castShadow receiveShadow>
      <boxGeometry args={size} />
      {outline && OUTLINE}
    </mesh>
  );
}

function Roof({ radius, height, y, color }: { radius: number; height: number; y: number; color: string }) {
  return (
    <mesh position={[0, y + height / 2, 0]} rotation={[0, Math.PI / 4, 0]} material={toon(color)} castShadow>
      <coneGeometry args={[radius, height, 4]} />
      {OUTLINE}
    </mesh>
  );
}

function Workshop({ accent }: Part) {
  return (
    <>
      <Box size={[2.2, 1.4, 1.8]} position={[0, 0.7, 0]} color={PALETTE.wall} />
      <Roof radius={1.75} height={1.0} y={1.4} color={accent} />
      <Box size={[0.32, 0.9, 0.32]} position={[0.62, 2.1, -0.35]} color="#6b5b55" />
      <Box size={[0.6, 0.9, 0.06]} position={[0, 0.45, 0.91]} color={PALETTE.wood} outline={false} />
      <Box size={[0.45, 0.4, 0.06]} position={[-0.7, 0.85, 0.91]} color={PALETTE.glass} outline={false} />
      <Box size={[0.45, 0.4, 0.06]} position={[0.7, 0.85, 0.91]} color={PALETTE.glass} outline={false} />
    </>
  );
}

function TownHall({ accent }: Part) {
  return (
    <>
      <Box size={[2.6, 1.3, 2.0]} position={[0, 0.65, 0]} color={PALETTE.wall} />
      <Roof radius={1.95} height={0.8} y={1.3} color={PALETTE.roof} />
      <Box size={[0.8, 1.7, 0.8]} position={[0, 2.0, 0]} color={PALETTE.wall} />
      <mesh position={[0, 2.35, 0.41]} rotation={[Math.PI / 2, 0, 0]} material={toon('#ffffff')}>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 16]} />
        <Outlines thickness={0.03} color={accent} />
      </mesh>
      <Roof radius={0.7} height={0.9} y={2.85} color={accent} />
      <Box size={[0.7, 0.8, 0.06]} position={[0, 0.4, 1.01]} color={accent} outline={false} />
    </>
  );
}

function Lighthouse({ accent, paused }: Part & { paused: boolean }) {
  const beam = useRef<Group>(null);
  useFrame((_, dt) => {
    if (beam.current && !paused) beam.current.rotation.y += dt * 0.8;
  });
  const beamMat = useMemo(() => new MeshBasicMaterial({ color: '#fff3a6', transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending }), []);
  const stripes = [0, 1, 2, 3];
  return (
    <>
      {stripes.map((i) => (
        <mesh key={i} position={[0, 0.55 + i * 1.05, 0]} material={toon(i % 2 ? accent : '#ffffff')} castShadow>
          <cylinderGeometry args={[0.78 - (i + 1) * 0.07, 0.78 - i * 0.07, 1.05, 12]} />
          {OUTLINE}
        </mesh>
      ))}
      <mesh position={[0, 4.55, 0]} material={toon('#fff7cf')}>
        <cylinderGeometry args={[0.42, 0.42, 0.55, 12]} />
        {OUTLINE}
      </mesh>
      <mesh position={[0, 5.1, 0]} material={toon(accent)} castShadow>
        <coneGeometry args={[0.55, 0.6, 12]} />
        {OUTLINE}
      </mesh>
      <group ref={beam} position={[0, 4.55, 0]}>
        <mesh position={[1.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={beamMat}>
          <coneGeometry args={[0.55, 3.6, 16, 1, true]} />
        </mesh>
      </group>
      <Box size={[0.5, 0.75, 0.06]} position={[0, 0.38, 0.76]} color={PALETTE.wood} outline={false} />
    </>
  );
}

function Library({ accent }: Part) {
  const books = ['#e05d5d', '#f2b544', '#4f7cff', '#3fb67a'];
  return (
    <>
      <Box size={[2.0, 1.5, 1.6]} position={[0, 0.75, 0]} color={PALETTE.wall} />
      <Box size={[2.2, 0.18, 1.8]} position={[0, 1.59, 0]} color={accent} />
      {books.map((c, i) => (
        <Box key={c} size={[1.3 - i * 0.2, 0.34, 0.9 - i * 0.1]} position={[0, 1.86 + i * 0.36, 0]} rotation={[0, (i % 2 ? 1 : -1) * 0.18, 0]} color={c} />
      ))}
      <Box size={[0.6, 0.85, 0.06]} position={[0, 0.43, 0.81]} color={accent} outline={false} />
    </>
  );
}

function Amphitheater({ accent }: Part) {
  const tiers = [1.0, 1.35, 1.7];
  return (
    <>
      {tiers.map((r, i) => (
        <mesh key={r} position={[0, 0.12 + i * 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} material={toon(i % 2 ? '#e8e1d3' : '#d8cdb8')} castShadow receiveShadow>
          <torusGeometry args={[r, 0.16, 6, 20, Math.PI]} />
        </mesh>
      ))}
      <Box size={[1.3, 0.22, 0.7]} position={[0, 0.11, 0.45]} color={PALETTE.wood} />
      <mesh position={[-1.35, 1.3, 0.6]} material={toon('#6b6b75')} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.6, 6]} />
      </mesh>
      <Box size={[0.4, 0.3, 0.3]} position={[-1.35, 2.65, 0.6]} color={accent} />
      <mesh position={[1.35, 1.3, 0.6]} material={toon('#6b6b75')} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.6, 6]} />
      </mesh>
      <Box size={[0.4, 0.3, 0.3]} position={[1.35, 2.65, 0.6]} color={accent} />
    </>
  );
}

function Greenhouse({ accent }: Part) {
  const glass = useMemo(() => {
    const m = toon(PALETTE.glass, 'greenhouse-glass').clone();
    m.transparent = true;
    m.opacity = 0.55;
    m.depthWrite = false;
    return m;
  }, []);
  return (
    <>
      <mesh position={[0, 0.15, 0]} material={toon(PALETTE.wood)} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.4, 0.3, 16]} />
        {OUTLINE}
      </mesh>
      <mesh position={[-0.4, 0.55, -0.2]} material={toon(accent)}>
        <coneGeometry args={[0.35, 0.8, 6]} />
      </mesh>
      <mesh position={[0.45, 0.5, 0.1]} material={toon('#5cae4f')}>
        <coneGeometry args={[0.3, 0.65, 6]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={glass}>
        <sphereGeometry args={[1.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Outlines thickness={0.03} color={accent} />
      </mesh>
      <mesh position={[0, 1.7, 0]} material={toon(accent)}>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
    </>
  );
}

function PostOffice({ accent, active }: Part & { active: boolean }) {
  const flag = useRef<Group>(null);
  useFrame((_, dt) => {
    if (flag.current) flag.current.rotation.z = damp(flag.current.rotation.z, active ? 0 : -Math.PI / 2, 10, dt);
  });
  return (
    <>
      <Box size={[1.6, 1.2, 1.4]} position={[0, 0.6, -0.2]} color={PALETTE.wall} />
      <Roof radius={1.25} height={0.7} y={1.2} color={accent} />
      <Box size={[0.5, 0.7, 0.06]} position={[0, 0.35, 0.51]} color={accent} outline={false} />
      <mesh position={[1.05, 0.6, 0.55]} material={toon('#6b6b75')}>
        <cylinderGeometry args={[0.06, 0.06, 1.2, 6]} />
      </mesh>
      <Box size={[0.5, 0.4, 0.7]} position={[1.05, 1.3, 0.55]} color="#e05d5d" />
      <group ref={flag} position={[1.33, 1.3, 0.75]}>
        <Box size={[0.05, 0.5, 0.05]} position={[0, 0.25, 0]} color="#f2b544" outline={false} />
        <Box size={[0.05, 0.16, 0.24]} position={[0, 0.45, 0.12]} color="#f2b544" outline={false} />
      </group>
    </>
  );
}

function Generic({ accent }: Part) {
  return (
    <>
      <Box size={[1.2, 2.2, 1.2]} position={[0, 1.1, 0]} color={accent} />
      <Roof radius={1.0} height={0.8} y={2.2} color={PALETTE.roof} />
    </>
  );
}

const HEIGHTS: Record<string, number> = {
  workshop: 3.1,
  'town-hall': 3.9,
  lighthouse: 5.5,
  library: 3.4,
  amphitheater: 3.0,
  greenhouse: 2.0,
  'post-office': 2.2,
};

function Variant({ data, active, paused }: { data: LandmarkData; active: boolean; paused: boolean }): ReactNode {
  const accent = data.accent;
  switch (data.variant) {
    case 'workshop':
      return <Workshop accent={accent} />;
    case 'town-hall':
      return <TownHall accent={accent} />;
    case 'lighthouse':
      return <Lighthouse accent={accent} paused={paused} />;
    case 'library':
      return <Library accent={accent} />;
    case 'amphitheater':
      return <Amphitheater accent={accent} />;
    case 'greenhouse':
      return <Greenhouse accent={accent} />;
    case 'post-office':
      return <PostOffice accent={accent} active={active} />;
    default:
      return <Generic accent={accent} />;
  }
}

export function Landmark({ controller, geo, data }: { controller: GameController; geo: LandmarkGeometry; data: LandmarkData }) {
  const active = useStore(controller.store, (s) => s.nearbyId === geo.id && !s.traveling);
  const reduced = useStore(controller.store, selectReducedMotion);
  const paused = useStore(controller.store, selectAmbientPaused);
  const body = useRef<Group>(null);
  const ring = useMemo(() => new MeshBasicMaterial({ color: data.accent, transparent: true, opacity: 0.25, depthWrite: false }), [data.accent]);

  const { position, quaternion } = useMemo(
    () => ({ position: geo.n.clone().multiplyScalar(R - 0.01), quaternion: landmarkObjectQuaternion(geo) }),
    [geo],
  );

  useFrame((_, dt) => {
    const target = active ? 1.06 : 1;
    const g = body.current;
    if (g) {
      const s = reduced ? target : damp(g.scale.x, target, 12, dt);
      g.scale.setScalar(s);
    }
    ring.opacity = reduced ? (active ? 0.7 : 0.25) : damp(ring.opacity, active ? 0.7 : 0.25, 8, dt);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    controller.travelTo(geo.id);
  };

  const height = HEIGHTS[data.variant] ?? 3;

  return (
    <group
      position={position}
      quaternion={quaternion}
      name={`landmark-${geo.id}`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={ring}>
        <ringGeometry args={[geo.footprintU + 0.15, geo.footprintU + 0.4, 32]} />
      </mesh>
      <group ref={body}>
        <Variant data={data} active={active} paused={paused} />
      </group>
      {active && (
        <Html position={[0, height + 0.5, 0]} center zIndexRange={[20, 0]} className="world-label-wrap">
          <div className="world-label" aria-hidden="true" style={{ ['--accent' as string]: data.accent }}>
            {data.title}
          </div>
        </Html>
      )}
    </group>
  );
}

export const LANDMARK_HEIGHTS = HEIGHTS;
