import { Color, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import { withSurfaceDetail } from './rockDetail';
import { withLampLights } from './lampLights';

/** Shared materials for kit-built models (vertex-coloured, soft "toy" lighting). */
let solid: MeshStandardMaterial | null = null;
let glow: MeshBasicMaterial | null = null;
let glass: MeshStandardMaterial | null = null;

const GLOW_BASE = new Color(2.2, 2.0, 1.7);

export function kitMaterials(): { solid: Material; glow: Material; glass: Material } {
  if (!solid) {
    // per-surface painted detail (wood, roof, plaster, stone, brick, iron, canvas) plus a brush
    // grain on plain painted parts; a no-op when the textures didn't load
    // …and it receives the lamplight (lampLights.ts)
    solid = withLampLights(withSurfaceDetail(new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }), 0.36, 1.1));
    // HDR multiplier so only lamps/windows exceed the bloom threshold.
    glow = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: GLOW_BASE.clone() });
    glass = new MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false });
  }
  return { solid: solid!, glow: glow!, glass: glass! };
}

/**
 * Emissive "daylight lift" (foliage, water, clouds) must fade at night or those surfaces would
 * appear to glow in the dark. Materials register their daytime emissive intensity here.
 */
const daylit = new Map<MeshStandardMaterial, number>();

export function registerDaylit<T extends MeshStandardMaterial>(m: T): T {
  daylit.set(m, m.emissiveIntensity);
  return m;
}

export function unregisterDaylit(m: MeshStandardMaterial): void {
  daylit.delete(m);
}

/** Applies the time of day to shared materials: `glow` scales lamps/windows, `night` dims daylight lift. */
export function applyTimeOfDay(glowMul: number, night: number): void {
  const g = kitMaterials().glow as MeshBasicMaterial;
  g.color.copy(GLOW_BASE).multiplyScalar(glowMul);
  const lift = 1 - 0.8 * night;
  for (const [m, base] of daylit) m.emissiveIntensity = base * lift;
}

export const PALETTE = {
  outline: '#2d2a32',
} as const;
