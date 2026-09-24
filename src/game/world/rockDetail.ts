import { Vector3, type MeshStandardMaterial } from 'three';
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
