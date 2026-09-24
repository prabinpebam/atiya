import { Vector3, type MeshStandardMaterial } from 'three';
import { SURFACES } from './kit';
import { TRIPLANAR_GLSL, gameTexture, textureMean } from './textures';

/**
 * Hand-painted cliff strata from the generated `rock` tile, layered over vertex colours. Samples
 * `aRockUV.xy` (arc length, height), weight `aRockUV.z`, so the strata run horizontally around
 * each mesa; the painted colour mostly replaces the vertex colour, which only adds a little
 * per-band variation. Returns the material unchanged when the texture isn't available.
 */
export function withRockDetail(m: MeshStandardMaterial, strength: number, scale: number): MeshStandardMaterial {
  const tex = gameTexture('rock');
  if (!tex) return m;
  const mean = new Vector3(...textureMean('rock'));
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uRockTex = { value: tex };
    shader.uniforms.uRockMean = { value: mean };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRockUV;\nvarying vec3 vRockUV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockUV = aRockUV;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uRockTex;\nuniform vec3 uRockMean;\nvarying vec3 vRockUV;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 rk = texture2D(uRockTex, vRockUV.xy * ${scale.toFixed(3)}).rgb;
  // mostly the painted strata colour; vertex bands add a little per-layer variation
  vec3 banded = rk * (diffuseColor.rgb / max(uRockMean, vec3(0.02))) * 0.5 + rk * 0.5;
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(rk, banded, 0.3), ${strength.toFixed(3)} * vRockUV.z);
}`,
      );
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|rock-uv-${strength}-${scale}`;
  return m;
}

/**
 * Boulders, rocks and pebbles. The stones are non-directional, so they use their own painted
 * `boulder` tile (granite grain, soft facets, hairline cracks; no strata) instead of the cliff's:
 * object-space triplanar, luminance only, so per-instance tints keep their colour. On top:
 * - moss grown on upward faces, scaled by the geometry's `aMoss` (boulder 1, rock 0.55, pebble 0)
 *   and broken up by a second, larger sample of the same tile, so its edge is ragged, not a line;
 * - a soft contact darkening near the ground, so stones sit in the lawn instead of floating.
 * Without the tile, the moss and contact shading still apply (the break-up noise is flat).
 */
export function withStoneDetail(m: MeshStandardMaterial, strength: number, scale: number): MeshStandardMaterial {
  const tex = gameTexture('boulder');
  const mean = tex ? textureMean('boulder')[0] : 0.5;
  m.onBeforeCompile = (shader) => {
    if (tex) {
      shader.uniforms.uStoneTex = { value: tex };
      shader.uniforms.uStoneMean = { value: mean };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMoss;\nvarying float vMoss;\nvarying vec3 vRkP;\nvarying vec3 vRkN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMoss = aMoss; vRkP = position; vRkN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${tex ? 'uniform sampler2D uStoneTex;\nuniform float uStoneMean;\n' : ''}varying float vMoss;\nvarying vec3 vRkP;\nvarying vec3 vRkN;\n${TRIPLANAR_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 sn = normalize(vRkN);
  vec3 sw = triW(sn);
${
  tex
    ? `  float st = tri(uStoneTex, vRkP, sw, ${scale.toFixed(3)}).r / uStoneMean;
  float brk = tri(uStoneTex, vRkP + 1.7, sw, ${(scale * 0.35).toFixed(3)}).r - uStoneMean;
  diffuseColor.rgb *= clamp(mix(1.0, st, ${strength.toFixed(3)}), 0.55, 1.35);`
    : '  float st = 1.0; float brk = 0.0;'
}
  // moss on the upward faces, thicker towards the top, with a ragged edge
  float moss = smoothstep(0.7, 0.86, sn.y + brk * 1.2 + (vRkP.y - 0.45) * 0.3) * vMoss;
  vec3 mossCol = mix(vec3(0.09, 0.17, 0.045), vec3(0.17, 0.28, 0.07), clamp(0.5 + brk * 2.0, 0.0, 1.0)) * (0.85 + 0.3 * st);
  diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, moss * 0.85);
  // soft contact darkening where the stone meets the ground
  diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(0.0, 0.16, vRkP.y));
}`,
      );
  };
  m.customProgramCacheKey = () => `stone-v1-${tex ? 1 : 0}-${strength}-${scale}`;
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
