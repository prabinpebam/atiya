import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, Color, IcosahedronGeometry, MeshToonMaterial, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { UP, arcDistance, pointArcDistance } from '../math/sphere';
import { mulberry32 } from './layout';
import { PALETTE, toonGradient } from './materials';

const R = CONFIG.planetRadius;

export function Planet({ controller }: { controller: GameController }) {
  const { geometry, material } = useMemo(() => {
    const g = new IcosahedronGeometry(R, 14);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const rand = mulberry32(3);
    const grass = [new Color(PALETTE.grass), new Color(PALETTE.grassDark), new Color(PALETTE.grassLight)];
    const path = new Color(PALETTE.path);
    const plaza = new Color(PALETTE.plaza);
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const center = new Vector3();
    const spawn = UP as Vector3;

    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      center.copy(a).add(b).add(c).normalize();
      let col: Color;
      if (arcDistance(center, spawn, R) < 2.9) col = plaza;
      else if (controller.geos.some((l) => arcDistance(center, l.n, R) < l.footprintU + 0.5)) col = plaza;
      else if (controller.geos.some((l) => pointArcDistance(center, spawn, l.approach, R) < 0.5)) col = path;
      else col = grass[Math.floor(rand() * grass.length)];
      for (let j = 0; j < 3; j++) colors.set([col.r, col.g, col.b], (i + j) * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    return { geometry: g, material: m };
  }, [controller]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    controller.walkToWorldPoint(e.point.clone());
  };

  return <mesh geometry={geometry} material={material} receiveShadow onPointerDown={onPointerDown} name="planet" />;
}
