/**
 * Local lamplight (plaza lamps, the lamplight out of an open door, the stage spotlight): real
 * lights evaluated in each receiving material's own lighting, not additive decals on top.
 *
 * Each lamp adds irradiance × the surface's diffuse albedo, the same Lambert term three.js uses
 * for its own lights: `directDiffuse += E · BRDF_Lambert(albedo)`, with the physically based
 * windowed inverse-square falloff (Karis 2013; three's `getDistanceAttenuation`), N·L, and an
 * optional spot cone (`getSpotAttenuation`). A painted texture therefore brightens in proportion
 * to itself: bricks stay bricks, just warmer and brighter, and dark grout stays dark.
 *
 * Performance: one short, fixed-size light list shared by every receiving material (a uniform
 * block updated once per frame), with a per-light range test that skips far fragments. By day
 * the list is empty, so the loop does no work. Only the materials that sit near lamps receive it
 * (ground, kit models, stones, grass and flowers, the player), and the shadow-map depth passes
 * never see it.
 */
import { Color, Matrix4, Vector3, type Material } from 'three';

export const LAMP_MAX = 11;

export interface Lamp {
  /** Position in planet-local space (the planet root's frame). */
  pos: Vector3;
  /** Spot direction in planet-local space (unit), or null for an omni lamp. */
  dir: Vector3 | null;
  /** Linear colour; `intensity` scales it (three.js point-light units: candela). */
  color: Color;
  intensity: number;
  /** Distance (u) where the light reaches zero (the falloff window). */
  range: number;
  /** Spot cone: outer and inner half-angles (radians). */
  cone?: [number, number];
  /** Packed before the others (the lantern the character carries: it's never the one left out). */
  first?: boolean;
}

const lamps = new Set<Lamp>();

/** Register a lamp; returns the function that removes it. Update `intensity` (etc.) in place. */
export function addLamp(l: Lamp): () => void {
  lamps.add(l);
  return () => lamps.delete(l);
}

export const lampUniforms = {
  uLampCount: { value: 0 },
  uLampPos: { value: Array.from({ length: LAMP_MAX }, () => new Vector3()) },
  uLampColor: { value: Array.from({ length: LAMP_MAX }, () => new Vector3()) },
  uLampDir: { value: Array.from({ length: LAMP_MAX }, () => new Vector3()) },
  /** x = range, y = cos(outer) (−2 for omni lamps), z = cos(inner). */
  uLampParams: { value: Array.from({ length: LAMP_MAX }, () => new Vector3()) },
};

/** Pack the lit lamps into the shared uniforms, in world space (call once per frame, before drawing). */
export function updateLampUniforms(planet: Matrix4): number {
  const U = lampUniforms;
  let n = 0;
  // (two passes: the lamps marked `first`, then the rest)
  for (let pass = 0; pass < 2; pass++)
    for (const l of lamps) {
      if (!l.first !== (pass === 1) || l.intensity <= 1e-4 || n >= LAMP_MAX) continue;
      U.uLampPos.value[n].copy(l.pos).applyMatrix4(planet);
      U.uLampColor.value[n].set(l.color.r, l.color.g, l.color.b).multiplyScalar(l.intensity);
      if (l.dir && l.cone) {
        U.uLampDir.value[n].copy(l.dir).transformDirection(planet);
        U.uLampParams.value[n].set(l.range, Math.cos(l.cone[0]), Math.cos(l.cone[1]));
      } else {
        U.uLampDir.value[n].set(0, 1, 0);
        U.uLampParams.value[n].set(l.range, -2, -1);
      }
      n++;
    }
  U.uLampCount.value = n;
  return n;
}

/** Current packed lamps (for tests and diagnostics). */
export function litLamps(): number {
  return lampUniforms.uLampCount.value;
}

const VERT_DECL = `
varying vec3 vLampWorld;`;

const VERT_MAIN = `
{
  vec4 lampWP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  lampWP = instanceMatrix * lampWP;
  #endif
  vLampWorld = ( modelMatrix * lampWP ).xyz;
}`;

const FRAG_DECL = `
#define LAMP_MAX ${LAMP_MAX}
uniform int uLampCount;
uniform vec3 uLampPos[ LAMP_MAX ];
uniform vec3 uLampColor[ LAMP_MAX ];
uniform vec3 uLampDir[ LAMP_MAX ];
uniform vec3 uLampParams[ LAMP_MAX ];
varying vec3 vLampWorld;`;

// Added to the physically based diffuse term, right where three.js accumulates its own lights.
// `geometryNormal` is in view space; the lamps are in world space, so the normal is brought
// into world space with the (orthonormal) view matrix.
const FRAG_MAIN = `
if ( uLampCount > 0 ) {
  vec3 lampN = normalize( ( vec4( geometryNormal, 0.0 ) * viewMatrix ).xyz );
  for ( int i = 0; i < LAMP_MAX; i ++ ) {
    if ( i >= uLampCount ) break;
    vec3 lampV = uLampPos[ i ] - vLampWorld;
    float lampD = length( lampV );
    vec3 lampP = uLampParams[ i ];
    if ( lampD >= lampP.x ) continue;
    vec3 lampL = lampV / max( lampD, 1e-4 );
    float lampNdl = saturate( dot( lampN, lampL ) );
    if ( lampNdl <= 0.0 ) continue;
    float lampAtt = getDistanceAttenuation( lampD, lampP.x, 2.0 );
    if ( lampP.y > -1.5 ) lampAtt *= getSpotAttenuation( lampP.y, lampP.z, dot( -lampL, uLampDir[ i ] ) );
    reflectedLight.directDiffuse += uLampColor[ i ] * ( lampAtt * lampNdl ) * BRDF_Lambert( material.diffuseColor );
  }
}`;

/**
 * Let a MeshStandardMaterial receive the lamps. Chains onto any shader patch it already has
 * (surface detail, wind sway, stone detail) and extends its program cache key.
 */
export function withLampLights<T extends Material>(m: T): T {
  const prev = m.onBeforeCompile.bind(m);
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    Object.assign(shader.uniforms, lampUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_DECL}`)
      .replace('#include <lights_fragment_end>', `${FRAG_MAIN}\n#include <lights_fragment_end>`);
  };
  m.customProgramCacheKey = () => `${prevKey()}|lamps-v1`;
  return m;
}
