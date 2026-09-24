import { DataTexture, MeshToonMaterial, NearestFilter, RedFormat, type ColorRepresentation } from 'three';

let gradient: DataTexture | null = null;

/** Shared 3-step toon ramp (spec §4.2). */
export function toonGradient(): DataTexture {
  if (!gradient) {
    gradient = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
    gradient.minFilter = NearestFilter;
    gradient.magFilter = NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const cache = new Map<string, MeshToonMaterial>();

export function toon(color: ColorRepresentation, key = String(color)): MeshToonMaterial {
  let m = cache.get(key);
  if (!m) {
    m = new MeshToonMaterial({ color, gradientMap: toonGradient() });
    cache.set(key, m);
  }
  return m;
}

export const PALETTE = {
  grass: '#8fcf6b',
  grassDark: '#88c864',
  grassLight: '#96d472',
  path: '#e9d9a6',
  plaza: '#e8e1d3',
  trunk: '#8a5a3b',
  leaf: '#4f9e4a',
  leafAlt: '#3f8a45',
  rock: '#a9a9b3',
  wall: '#fbf4e6',
  roof: '#c65a3a',
  wood: '#b07a4f',
  outline: '#2d2a32',
  skin: '#f1c7a5',
  shirt: '#4f7cff',
  pants: '#3a3f58',
  glass: '#bfe9ff',
} as const;
