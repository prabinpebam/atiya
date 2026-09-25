/**
 * Chopper's shell fur (docs: chopper.md §2). One MeshStandardMaterial (lit like everything else,
 * lamplight included) whose shader pushes each shell copy of the coat out along its skinned normal
 * by `aFur × aShell`, droops the outer shells under gravity, and alpha-tests every shell against a
 * strand mask: the generated curly-fur tile (triplanar, in bind-pose space so the locks stay put as
 * he moves) mixed with fine 3D value noise for the strands. Roots are darkened, tips catch the light.
 *
 * Shadows come from a base-only stand-in (`build.ts`), not the shells.
 */
import { MeshStandardMaterial, type Texture } from 'three';
import { TRIPLANAR_GLSL, gameTexture } from '../textures';
import { withLampLights } from '../lampLights';

export interface FurUniforms {
  uTime: { value: number };
  /** Fur length multiplier (1 = as modelled). */
  uFurScale: { value: number };
  /** Rim sheen strength (lower at night). */
  uSheen: { value: number };
  uFurTex: { value: Texture | null };
  uHasTex: { value: number };
}

const VERT_DECL = /* glsl */ `
attribute float aFur;
attribute float aShell;
attribute float aGloss;
attribute vec3 aBind;
attribute vec3 aComb;
uniform float uTime;
uniform float uFurScale;
varying float vShell;
varying float vFur;
varying float vGloss;
varying vec3 vBind;
varying vec3 vBindN;`;

// after skinning: `transformed` and `objectNormal` are the posed position and normal (dog-local)
const VERT_MAIN = /* glsl */ `
{
  float furLen = aFur * uFurScale;
  float h = furLen * aShell;
  vec3 furN = normalize(objectNormal);
  // a breath of breeze in the outer shells, and gravity pulling the long coat down
  // each strand leaves the skin along the normal and bends the way the coat lies (combed, then
  // gravity), more toward its tip; a breath of breeze stirs the outer shells
  vec3 comb = aComb;
  #ifdef USE_SKINNING
  comb = (skinMatrix * vec4(aComb, 0.0)).xyz;
  #endif
  float sway = sin(uTime * 1.7 + aBind.x * 31.0 + aBind.z * 23.0) * 0.1;
  vec3 bend = (comb * 0.9 + vec3(sway, -0.25, sway * 0.6)) * (furLen * aShell * aShell);
  transformed += furN * h * (1.0 - 0.35 * aShell) + bend;
  vShell = aShell;
  vFur = aFur;
  vGloss = aGloss;
  vBind = aBind;
  vBindN = normal;
}`;

const FRAG_DECL = /* glsl */ `
uniform sampler2D uFurTex;
uniform float uHasTex;
uniform float uSheen;
varying float vShell;
varying float vFur;
varying float vGloss;
varying vec3 vBind;
varying vec3 vBindN;
${TRIPLANAR_GLSL}
float furHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float furNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(furHash(i), furHash(i + vec3(1, 0, 0)), f.x), mix(furHash(i + vec3(0, 1, 0)), furHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(furHash(i + vec3(0, 0, 1)), furHash(i + vec3(1, 0, 1)), f.x), mix(furHash(i + vec3(0, 1, 1)), furHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

// after the vertex colour is applied: the strand test and the root-to-tip shading
const FRAG_MAIN = /* glsl */ `
float furLock = 0.6;
if (vFur > 0.0) {
  vec3 fw = triW(normalize(vBindN));
  furLock = uHasTex > 0.5 ? tri(uFurTex, vBind, fw, 2.2).r : 0.6;
  float fine = furNoise(vBind * 260.0);
  float clump = furNoise(vBind * 55.0 + 7.1);
  float strand = furLock * 0.5 + fine * 0.38 + clump * 0.3;
  // strands thin toward their tips: each shell keeps less of the mask
  if (vShell > 0.0 && strand < 0.1 + vShell * 0.92) discard;
  // roots in shadow under the coat, tips catching the light; the locks show as soft light and shade
  diffuseColor.rgb *= mix(0.72, 1.03, sqrt(clamp(vShell, 1e-3, 1.0))) * (0.88 + 0.24 * furLock);
}`;

const ROUGH_MAIN = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.22, vGloss);`;

// a soft sheen at grazing angles: light scattering through the tips of a white coat
const SHEEN_MAIN = /* glsl */ `
if (vFur > 0.0) {
  float furRim = pow(clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5);
  totalEmissiveRadiance += diffuseColor.rgb * furRim * uSheen * (0.4 + 0.6 * vShell);
}`;

/** The fur material (one per canvas: the world's and the profile card's each make their own). */
export function chopperMaterial(lamps = true): { material: MeshStandardMaterial; uniforms: FurUniforms } {
  const tex = gameTexture('chopper-fur');
  const uniforms: FurUniforms = {
    uTime: { value: 0 },
    uFurScale: { value: 1 },
    uSheen: { value: 0.22 },
    uFurTex: { value: tex },
    uHasTex: { value: tex ? 1 : 0 },
  };
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.name = 'chopper-fur';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERT_DECL}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${FRAG_MAIN}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>${ROUGH_MAIN}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${SHEEN_MAIN}`);
  };
  m.customProgramCacheKey = () => 'chopper-fur-v1';
  return { material: lamps ? withLampLights(m) : m, uniforms };
}

export { VERT_MAIN as FUR_VERT_MAIN, FRAG_MAIN as FUR_FRAG_MAIN };
