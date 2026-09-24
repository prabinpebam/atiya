import { useMemo } from 'react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { PALETTE, toon } from './materials';

const R = CONFIG.planetRadius;

/** Spawn plaza signposts: one per landmark, beside its path, arrow coloured and pointing toward it. */
export function Plaza({ controller }: { controller: GameController }) {
  const posts = useMemo(
    () =>
      controller.props.posts.map((p) => {
        const x = new Vector3().crossVectors(p.n, p.dir);
        const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, p.n, p.dir));
        return { id: p.id, pos: p.n.clone().multiplyScalar(R - 0.01), q, accent: controller.dataById.get(p.id)!.accent };
      }),
    [controller],
  );

  return (
    <group name="plaza">
      {posts.map((p) => (
        <group key={p.id} position={p.pos} quaternion={p.q}>
          <mesh position={[0, 0.45, 0]} material={toon(PALETTE.wood)} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 0.9, 6]} />
          </mesh>
          <mesh position={[0, 0.82, 0.12]} material={toon(p.accent)} castShadow>
            <boxGeometry args={[0.1, 0.18, 0.45]} />
          </mesh>
          <mesh position={[0, 0.82, 0.4]} rotation={[Math.PI / 2, 0, 0]} material={toon(p.accent)}>
            <coneGeometry args={[0.13, 0.14, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
