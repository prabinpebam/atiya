import type { KitGeometry } from './kit';
import { kitMaterials } from './materials';
import { kitLeafMaterials } from './foliage';

/** Renders a kit-built model: one mesh per material layer. `shadows="receive"` receives but doesn't cast (no shadow-pass draw call). */
export function KitModel({ geo, shadows = true }: { geo: KitGeometry; shadows?: boolean | 'receive' }) {
  const m = kitMaterials();
  return (
    <>
      {geo.solid && <mesh geometry={geo.solid} material={m.solid} castShadow={shadows === true} receiveShadow={!!shadows} />}
      {geo.glow && <mesh geometry={geo.glow} material={m.glow} />}
      {geo.glass && <mesh geometry={geo.glass} material={m.glass} renderOrder={2} />}
      {geo.leaves && <mesh geometry={geo.leaves} material={kitLeafMaterials().material} customDepthMaterial={kitLeafMaterials().depth} castShadow={shadows === true} receiveShadow={!!shadows} />}
    </>
  );
}
