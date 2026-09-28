import { ImageBitmapLoader, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { TEXTURES, type TextureName } from './textureManifest';
import { withBase } from '../platform/base';

/**
 * Generated textures (see scripts/build-textures.py), fetched in tiers (progressive-loading.md §5.7):
 * tier 1 before the planet is live, tier 2 before the summoned groups mount, tier 3 when idle. A
 * material reads its textures synchronously when it's made, so it's made after its tier has loaded.
 * Any texture that fails to load (or times out) returns null and its material falls back to the
 * procedural look.
 */

export type TextureTier = 1 | 2 | 3;
const loaded = new Map<TextureName, Texture>();
const status = { loaded: 0, failed: 0, pending: Object.keys(TEXTURES).length };
const preloads = new Map<TextureTier, Promise<void>>();

/** The textures of a loading tier. */
export function tierTextures(tier: TextureTier): TextureName[] {
  return (Object.keys(TEXTURES) as TextureName[]).filter((n) => ((TEXTURES[n] as { tier?: number }).tier ?? 1) === tier);
}

function configure(name: TextureName, t: Texture): Texture {
  const e = TEXTURES[name];
  const tiled = e.kind === 'tile' || e.kind === 'mask';
  // masks and normal maps are data, not colour
  t.colorSpace = e.kind === 'mask' || e.kind === 'normal' ? NoColorSpace : SRGBColorSpace;
  if (tiled) t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  // decals (the plaza) are seen at grazing angles too, so they get the higher anisotropy
  t.anisotropy = tiled || e.kind === 'decal' ? 8 : 4;
  t.name = name;
  t.needsUpdate = true;
  return t;
}

/**
 * Decode off the main thread where the browser can (`createImageBitmap`), so the WebPs are decoded
 * while the game loads rather than, one by one, inside the first frame's texture uploads. The
 * bitmap is flipped at decode (the same orientation as `flipY` gives an image) and keeps straight
 * alpha, so it uploads exactly like the image did.
 */
async function loadTexture(name: TextureName): Promise<Texture> {
  const url = withBase(TEXTURES[name].url);
  if (typeof createImageBitmap !== 'function') return new TextureLoader().loadAsync(url);
  const loader = new ImageBitmapLoader();
  loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: TEXTURES[name].kind === 'mask' || TEXTURES[name].kind === 'normal' ? 'none' : 'default' });
  const t = new Texture(await loader.loadAsync(url));
  t.flipY = false; // already flipped (WebGL ignores flipY for bitmaps)
  return t;
}

/** Starts (once) and awaits loading a tier's textures; never rejects. Resolves early after `timeoutMs`. */
export function preloadTextures(tier: TextureTier = 1, timeoutMs = 10_000): Promise<void> {
  let preload = preloads.get(tier);
  if (!preload) {
    const all = tierTextures(tier).map((name) =>
      loadTexture(name)
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
    preloads.set(tier, preload);
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
