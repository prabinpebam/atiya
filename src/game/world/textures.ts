import { LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { TEXTURES, type TextureName } from './textureManifest';

/**
 * Generated textures (see scripts/build-textures.py). They're preloaded before the scene mounts,
 * so materials can pick them up synchronously. Any texture that fails to load (or times out)
 * returns null and its material falls back to the procedural look.
 */

const loaded = new Map<TextureName, Texture>();
const status = { loaded: 0, failed: 0, pending: Object.keys(TEXTURES).length };
let preload: Promise<void> | null = null;

function configure(name: TextureName, t: Texture): Texture {
  const e = TEXTURES[name];
  const tiled = e.kind === 'tile' || e.kind === 'mask';
  t.colorSpace = e.kind === 'mask' ? NoColorSpace : SRGBColorSpace;
  if (tiled) t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = tiled ? 8 : 4;
  t.name = name;
  t.needsUpdate = true;
  return t;
}

/** Starts (once) and awaits loading every texture; never rejects. Resolves early after `timeoutMs`. */
export function preloadTextures(timeoutMs = 10_000): Promise<void> {
  if (!preload) {
    const loader = new TextureLoader();
    const all = (Object.keys(TEXTURES) as TextureName[]).map((name) =>
      loader
        .loadAsync(TEXTURES[name].url)
        .then((t) => {
          loaded.set(name, configure(name, t));
          status.loaded++;
        })
        .catch(() => {
          status.failed++;
        })
        .finally(() => {
          status.pending--;
        }),
    );
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    preload = Promise.race([Promise.all(all).then(() => undefined), timeout]);
  }
  return preload;
}

/** A preloaded texture, or null (not loaded) so callers can fall back. */
export function gameTexture(name: TextureName): Texture | null {
  return loaded.get(name) ?? null;
}

/** Mean linear colour of a tile (the shader divides by it to keep the scene's palette). */
export function textureMean(name: TextureName): [number, number, number] {
  const e = TEXTURES[name] as { mean?: readonly number[] };
  const m = e.mean ?? [0.5, 0.5, 0.5];
  return [m[0], m[1], m[2]];
}

export function textureStatus(): { loaded: number; failed: number; pending: number } {
  return { ...status };
}

/**
 * GLSL helper: triplanar sampling in planet- or object-local space (the procedural geometry has no
 * UVs). `p` is the local position, `n` the local normal, `s` tiles per unit.
 */
export const TRIPLANAR_GLSL = /* glsl */ `
vec3 triW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z + 1e-5); }
vec3 tri(sampler2D t, vec3 p, vec3 w, float s) {
  vec3 c = vec3(0.0);
  if (w.x > 0.02) c += texture2D(t, p.zy * s).rgb * w.x;
  if (w.y > 0.02) c += texture2D(t, p.xz * s).rgb * w.y;
  if (w.z > 0.02) c += texture2D(t, p.xy * s).rgb * w.z;
  return c / max(w.x * step(0.02, w.x) + w.y * step(0.02, w.y) + w.z * step(0.02, w.z), 1e-4);
}
`;
