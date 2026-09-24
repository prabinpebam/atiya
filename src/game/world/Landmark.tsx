import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useStore } from 'zustand';
import { AdditiveBlending, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import type { LandmarkData } from '../types';
import { landmarkObjectQuaternion, type LandmarkGeometry } from '../math/landmarks';
import { damp } from '../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { KitModel } from './KitModel';
import { landmarkModel } from './models';

const R = CONFIG.planetRadius;

function Beam({ at, paused, controller }: { at: [number, number, number]; paused: boolean; controller: GameController }) {
  const ref = useRef<Group>(null);
  const { geo, mat } = useMemo(() => {
    const g = new ConeGeometry(0.55, 3.4, 20, 1, true);
    g.rotateZ(Math.PI / 2);
    g.translate(1.75, 0, 0);
    return { geo: g, mat: new MeshBasicMaterial({ color: '#fff3a6', transparent: true, opacity: 0.28, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }) };
  }, []);
  useFrame((_, dt) => {
    if (ref.current && !paused) ref.current.rotation.y += dt * 0.7;
    mat.opacity = 0.2 + 0.35 * controller.sky.night;
  });
  return (
    <group ref={ref} position={at}>
      <mesh geometry={geo} material={mat} />
    </group>
  );
}

function Smoke({ at, paused }: { at: [number, number, number]; paused: boolean }) {
  const puffs = useRef<Mesh[]>([]);
  const t = useRef(0);
  const { geo, mats } = useMemo(
    () => ({
      geo: new SphereGeometry(0.14, 12, 8),
      mats: [0, 1, 2].map(() => new MeshStandardMaterial({ color: '#f4f1ec', roughness: 1, transparent: true, opacity: 0.85, depthWrite: false })),
    }),
    [],
  );
  useFrame((_, dt) => {
    if (!paused) t.current += dt;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t.current * 0.35 + i / 3) % 1;
      m.position.set(Math.sin((p + i) * 3) * 0.08 + p * 0.25, p * 1.1, 0);
      m.scale.setScalar(0.6 + p * 1.1);
      mats[i].opacity = 0.8 * (1 - p);
      m.visible = !paused;
    });
  });
  return (
    <group position={at}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) puffs.current[i] = el;
          }}
          geometry={geo}
          material={mats[i]}
        />
      ))}
    </group>
  );
}

function Flag({ at, color, paused, pole = 2.2 }: { at: [number, number, number]; color: string; paused: boolean; pole?: number }) {
  const cloth = useRef<Mesh>(null);
  const t = useRef(0);
  const { geo, mat, poleMat } = useMemo(() => {
    const g = new PlaneGeometry(0.55, 0.36, 8, 1);
    g.translate(0.275, 0, 0);
    return {
      geo: g,
      mat: new MeshStandardMaterial({ color, side: DoubleSide, roughness: 0.8 }),
      poleMat: new MeshStandardMaterial({ color: '#d8d8dc', roughness: 0.5, metalness: 0.3 }),
    };
  }, [color]);
  useFrame((_, dt) => {
    if (!cloth.current) return;
    if (!paused) t.current += dt;
    const pos = cloth.current.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(t.current * 3 + x * 7) * 0.05 * x);
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={at}>
      <mesh position={[0, pole / 2, 0]} material={poleMat} castShadow>
        <cylinderGeometry args={[0.025, 0.03, pole, 8]} />
      </mesh>
      <mesh position={[0, pole + 0.03, 0]} material={poleMat}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      <mesh ref={cloth} geometry={geo} material={mat} position={[0.02, pole - 0.22, 0]} castShadow />
    </group>
  );
}

function MailFlag({ at, active }: { at: [number, number, number]; active: boolean }) {
  const ref = useRef<Group>(null);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#f2b544', roughness: 0.6 }), []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.x = damp(ref.current.rotation.x, active ? 0 : Math.PI / 2, 10, dt);
  });
  return (
    <group ref={ref} position={at}>
      <mesh position={[0, 0.2, 0]} material={mat}>
        <boxGeometry args={[0.04, 0.4, 0.04]} />
      </mesh>
      <mesh position={[0, 0.34, -0.1]} material={mat}>
        <boxGeometry args={[0.03, 0.14, 0.2]} />
      </mesh>
    </group>
  );
}

export function Landmark({ controller, geo, data }: { controller: GameController; geo: LandmarkGeometry; data: LandmarkData }) {
  const active = useStore(controller.store, (s) => s.nearbyId === geo.id && !s.traveling);
  const reduced = useStore(controller.store, selectReducedMotion);
  const paused = useStore(controller.store, selectAmbientPaused);
  const body = useRef<Group>(null);
  const model = useMemo(() => landmarkModel(data.variant, data.accent), [data.variant, data.accent]);
  const ring = useMemo(() => new MeshBasicMaterial({ color: data.accent, transparent: true, opacity: 0.0, depthWrite: false }), [data.accent]);

  const { position, quaternion } = useMemo(
    () => ({ position: geo.n.clone().multiplyScalar(R - 0.01), quaternion: landmarkObjectQuaternion(geo) }),
    [geo],
  );

  useFrame((_, dt) => {
    const target = active ? 1.035 : 1;
    const g = body.current;
    if (g) {
      const s = reduced ? target : damp(g.scale.x, target, 12, dt);
      g.scale.setScalar(s);
    }
    ring.opacity = reduced ? (active ? 0.65 : 0) : damp(ring.opacity, active ? 0.65 : 0, 8, dt);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    controller.travelTo(geo.id);
  };

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
        <ringGeometry args={[geo.footprintU + 0.2, geo.footprintU + 0.42, 48]} />
      </mesh>
      <group ref={body}>
        <KitModel geo={model.geo} />
        {model.anchors.beam && <Beam at={model.anchors.beam} paused={paused} controller={controller} />}
        {model.anchors.smoke && <Smoke at={model.anchors.smoke} paused={paused} />}
        {data.variant === 'town-hall' && model.anchors.flag && <Flag at={model.anchors.flag} color={data.accent} paused={paused} />}
        {data.variant === 'post-office' && model.anchors.flag && <MailFlag at={model.anchors.flag} active={active} />}
      </group>
      {active && (
        <Html position={[0, model.height + 0.45, 0]} center zIndexRange={[20, 0]} className="world-label-wrap">
          <div className="world-label" aria-hidden="true" style={{ ['--accent' as string]: data.accent }}>
            {data.title}
          </div>
        </Html>
      )}
    </group>
  );
}
