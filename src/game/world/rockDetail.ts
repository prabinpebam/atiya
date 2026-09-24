import { Vector3, type MeshStandardMaterial } from 'three';
import { SURFACES } from './kit';
import { TRIPLANAR_GLSL, gameTexture, textureMean } from './textures';

/**
 * Hand-painted rock detail from the generated `rock` tile, layered over vertex colours.
 * - `uv` mode (cliff walls): samples `aRockUV.xy` (arc length, height), weight `aRockUV.z`,
 *   so the strata run horizontally around each mesa; the painted colour mostly replaces the
 *   vertex colour, which only adds a little per-band variation.
 * - `object` mode (boulders, rocks, pebbles): object-space triplanar, luminance only, so moss
 *   caps and per-instance tints keep their colour.
 * Returns the material unchanged when the texture isn't available.
 */
export function withRockDetail(m: MeshStandardMaterial, mode: 'uv' | 'object', strength: number, scale: number): MeshStandardMaterial {
  const tex = gameTexture('rock');
  if (!tex) return m;
  const mean = new Vector3(...textureMean('rock'));
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uRockTex = { value: tex };
    shader.uniforms.uRockMean = { value: mean };
    const vDecl = mode === 'uv' ? 'attribute vec3 aRockUV;\nvarying vec3 vRockUV;' : 'varying vec3 vRkP;\nvarying vec3 vRkN;';
    const vBody = mode === 'uv' ? 'vRockUV = aRockUV;' : 'vRkP = position; vRkN = normal;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vDecl}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vBody}`);
    const fDecl = `uniform sampler2D uRockTex;\nuniform vec3 uRockMean;\n${
      mode === 'uv' ? 'varying vec3 vRockUV;' : `varying vec3 vRkP;\nvarying vec3 vRkN;\n${TRIPLANAR_GLSL}`
    }`;
    const fBody =
      mode === 'uv'
        ? `{
  vec3 rk = texture2D(uRockTex, vRockUV.xy * ${scale.toFixed(3)}).rgb;
  // mostly the painted strata colour; vertex bands add a little per-layer variation
  vec3 banded = rk * (diffuseColor.rgb / max(uRockMean, vec3(0.02))) * 0.5 + rk * 0.5;
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(rk, banded, 0.3), ${strength.toFixed(3)} * vRockUV.z);
}`
        : `{
  vec3 rk = tri(uRockTex, vRkP, triW(normalize(vRkN)), ${scale.toFixed(3)});
  float l = dot(rk, vec3(0.2126, 0.7152, 0.0722)) / dot(uRockMean, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb *= mix(1.0, l, ${strength.toFixed(3)});
}`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fDecl}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fBody}`);
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|rock-${mode}-${strength}-${scale}`;
  return m;
}

/**
 * The cliffs' grassy lip gets the same painted `grass` tile as the lawn (planet-local triplanar
 * at the ground's scale, normalised by the tile's mean), so the rim reads as the mesa's turf
 * rather than a flat green band. Weighted per vertex by `aLip` (1 on the lip, 0 on rock).
 */
export function withLipGrass(m: MeshStandardMaterial): MeshStandardMaterial {
  const tex = gameTexture('grass');
  if (!tex) return m;
  const mean = new Vector3(...textureMean('grass'));
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uLipTex = { value: tex };
    shader.uniforms.uLipMean = { value: mean };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLip;\nvarying float vLipW;\nvarying vec3 vLipP;\nvarying vec3 vLipN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLipW = aLip; vLipP = position; vLipN = normal;');
    // include the triplanar helpers unless an earlier layer already did
    const triGlsl = shader.fragmentShader.includes('vec3 triW(') ? '' : TRIPLANAR_GLSL;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform sampler2D uLipTex;\nuniform vec3 uLipMean;\nvarying float vLipW;\nvarying vec3 vLipP;\nvarying vec3 vLipN;\n${triGlsl}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (vLipW > 0.001) {
  vec3 gd = tri(uLipTex, vLipP, triW(normalize(vLipN)), 0.3) / max(uLipMean, vec3(0.02));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * max(vec3(0.3), 1.0 + (gd - 1.0) * 1.5), vLipW);
}`,
      );
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|lip-grass`;
  return m;
}

/**
 * Per-surface painted detail for the kit models (landmarks, plaza furniture, bridge). Each part
 * carries `aSurf` (index into SURFACES) and `aSurfUV` (tiles, in its own frame, see kit.ts):
 * wood grain, roof shingles, plaster, stone, brick, iron and canvas come from their own generated
 * greyscale tiles; plain painted parts keep the subtle brush grain (object-space triplanar).
 * Luminance only and normalised by each tile's mean, so every palette colour is kept.
 * Falls back to the brush grain alone if any surface tile is missing.
 */
const SURFACE_TEX = [
  ['wood', 'surf-wood', 0.55],
  ['roof', 'surf-shingle', 0.6],
  ['plaster', 'surf-plaster', 0.32],
  ['stone', 'surf-stone', 0.6],
  ['brick', 'surf-brick', 0.7],
  ['metal', 'surf-metal', 0.45],
  ['canvas', 'surf-canvas', 0.45],
] as const;

export function withSurfaceDetail(m: MeshStandardMaterial, grainStrength: number, grainScale: number): MeshStandardMaterial {
  const tex = SURFACE_TEX.map(([, name]) => gameTexture(name));
  const grain = gameTexture('paint-grain');
  if (!grain || tex.some((t) => !t)) return withPaintGrain(m, grainStrength, grainScale);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrainTex = { value: grain };
    SURFACE_TEX.forEach(([kind, name], i) => {
      shader.uniforms[`uSurf_${kind}`] = { value: tex[i] };
      shader.uniforms[`uSurfMean_${kind}`] = { value: textureMean(name)[0] };
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSurf;\nattribute vec2 aSurfUV;\nvarying float vSurfK;\nvarying vec2 vSurfUV;\nvarying vec3 vGrP;\nvarying vec3 vGrN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfK = aSurf; vSurfUV = aSurfUV; vGrP = position; vGrN = normal;');
    const decl = SURFACE_TEX.map(([kind]) => `uniform sampler2D uSurf_${kind};\nuniform float uSurfMean_${kind};`).join('\n');
    // the lookups sit in branches, so they take explicit gradients computed outside them
    const branches = SURFACE_TEX.map(
      ([kind, , s], i) =>
        `${i ? 'else ' : ''}if (abs(k - ${SURFACES.indexOf(kind).toFixed(1)}) < 0.5) d = mix(1.0, textureGrad(uSurf_${kind}, vSurfUV, gx, gy).r / uSurfMean_${kind}, ${s.toFixed(2)});`,
    ).join('\n  ');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform sampler2D uGrainTex;\n${decl}\nvarying float vSurfK;\nvarying vec2 vSurfUV;\nvarying vec3 vGrP;\nvarying vec3 vGrN;\n${TRIPLANAR_GLSL}`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
if (abs(floor(vSurfK + 0.5) - ${SURFACES.indexOf('metal').toFixed(1)}) < 0.5) { metalnessFactor = 0.35; roughnessFactor = 0.5; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float k = floor(vSurfK + 0.5);
  vec2 gx = dFdx(vSurfUV);
  vec2 gy = dFdy(vSurfUV);
  float d = 1.0;
  ${branches}
  if (k < 0.5) {
    float gr = tri(uGrainTex, vGrP, triW(normalize(vGrN)), ${grainScale.toFixed(3)}).r;
    d = 1.0 + (gr - 0.5) * ${grainStrength.toFixed(3)};
  }
  diffuseColor.rgb *= clamp(d, 0.5, 1.4);
}`,
      );
  };
  m.customProgramCacheKey = () => `kit-surfaces-v1-${grainStrength}-${grainScale}`;
  return m;
}

/**
 * Subtle hand-painted brush grain (generated `paint-grain` mask) over the vertex colours of kit
 * models: object-space triplanar, luminance only, so every palette colour is kept. The kit has
 * no per-part material identity (wood, stone, roof share one material), so the detail is generic.
 */
export function withPaintGrain(m: MeshStandardMaterial, strength: number, scale: number): MeshStandardMaterial {
  const tex = gameTexture('paint-grain');
  if (!tex) return m;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uGrainTex = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrP;\nvarying vec3 vGrN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrP = position; vGrN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uGrainTex;\nvarying vec3 vGrP;\nvarying vec3 vGrN;\n${TRIPLANAR_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float gr = tri(uGrainTex, vGrP, triW(normalize(vGrN)), ${scale.toFixed(3)}).r;
  diffuseColor.rgb *= 1.0 + (gr - 0.5) * ${strength.toFixed(3)};
}`,
      );
  };
  m.customProgramCacheKey = () => `kit-grain-${strength}-${scale}`;
  return m;
}
