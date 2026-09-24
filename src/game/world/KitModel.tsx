import type { KitGeometry } from './kit';
import { kitMaterials } from './materials';

/** Renders a kit-built model: one mesh per material layer. */
export function KitModel({ geo, shadows = true }: { geo: KitGeometry; shadows?: boolean }) {
  const m = kitMaterials();
  return (
    <>
      {geo.solid && <mesh geometry={geo.solid} material={m.solid} castShadow={shadows} receiveShadow={shadows} />}
      {geo.glow && <mesh geometry={geo.glow} material={m.glow} />}
      {geo.glass && <mesh geometry={geo.glass} material={m.glass} renderOrder={2} />}
    </>
  );
}
