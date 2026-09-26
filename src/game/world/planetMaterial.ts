import { MeshStandardMaterial, Vector3 } from 'three';
import { TRIPLANAR_GLSL, gameTexture, textureMean } from './textures';
import { withLampLights } from './lampLights';

const GROUND_TEX = ['grass', 'dirt', 'cobble', 'sand', 'riverbed'] as const;
/** Strength of the grass relief (the normal map's tilt, scaled by how much of the ground is grass). */
export const GROUND_BUMP = 0.7;
/** The cobbles' relief (their normal map's tilt), and their tile size: ≈ 8 stones per tile (u). */
export const COBBLE_BUMP = 1.0;
export const COBBLE_TILE_U = 2.2;

/**
 * Stylised ground material. Vertex colour = base grass tint; `aSurf` (vec4) blends in
 * procedural surfaces: x = dirt path, y = plaza bricks (+ compass rose), z = cobbles, w = sand;
 * `aSurf2` (vec4): x = riverbed, y = wet bank, z = steepness, w = terrain height (u);
 * `aCob` (vec2): the cobbles' coordinates (u) in the plane of the building they surround, so the
 * painted stones lie flat and unbroken on its levelled pad, with their own relief (a normal map).
 * Patterns are evaluated in planet-local space so they stay glued to the rotating planet.
 * With the generated tiles loaded (USE_GROUND_TEX), each surface samples its hand-painted tile
 * (triplanar, planet-local), normalised by the tile's mean colour so the palette is unchanged;
 * without them the procedural patterns are used.
 */
export function createPlanetMaterial(radius: number, plazaRadius: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const tex = GROUND_TEX.map((n) => gameTexture(n));
  const textured = tex.every(Boolean);
  const plazaTex = gameTexture('plaza');
  // the grass tile's relief (a normal map derived from its painted luminance) so the meadow catches the light
  const grassN = textured ? gameTexture('grass-normal') : null;
  const cobbleN = textured ? gameTexture('cobble-normal') : null;
  m.defines = {
    ...(textured ? { USE_GROUND_TEX: '' } : {}),
    ...(plazaTex ? { USE_PLAZA_TEX: '' } : {}),
    ...(grassN ? { USE_GROUND_NORMAL: '' } : {}),
    ...(cobbleN ? { USE_COBBLE_NORMAL: '' } : {}),
  };
  // The cobbled aprons (GLSL below, kept free of comments to save bytes): where an apron thins
  // out, its stones give way one by one (the joints first) to grass; the stones' relief comes from
  // their normal map in the apron's own plane, through a cotangent frame built from the screen-space
  // derivatives of `vCob` (no tangent attribute needed).
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRadius = { value: radius };
    shader.uniforms.uCobbleScale = { value: 1 / COBBLE_TILE_U };
    if (cobbleN) {
      shader.uniforms.uCobbleN = { value: cobbleN };
      shader.uniforms.uCobbleBump = { value: COBBLE_BUMP };
    }
    if (grassN) {
      shader.uniforms.uGrassN = { value: grassN };
      shader.uniforms.uGroundBump = { value: GROUND_BUMP };
    }
    if (plazaTex) {
      shader.uniforms.uTexPlaza = { value: plazaTex };
      shader.uniforms.uPlazaRadius = { value: plazaRadius };
    }
    if (textured) {
      GROUND_TEX.forEach((n, i) => {
        const key = n[0].toUpperCase() + n.slice(1);
        shader.uniforms[`uTex${key}`] = { value: tex[i] };
        shader.uniforms[`uMean${key}`] = { value: new Vector3(...textureMean(n)) };
      });
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aSurf;
attribute vec4 aSurf2;
attribute vec2 aCob;
varying vec4 vSurf;
varying vec4 vSurf2;
varying vec3 vLocal;
varying vec2 vCob;
#ifdef USE_GROUND_NORMAL
varying vec3 vLocalN;
varying vec3 vAxX;
varying vec3 vAxY;
varying vec3 vAxZ;
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSurf = aSurf;
vSurf2 = aSurf2;
vLocal = position;
vCob = aCob;
#ifdef USE_GROUND_NORMAL
vLocalN = objectNormal;
// the planet's local axes in view space (for the triplanar normal perturbation)
vAxX = normalMatrix * vec3(1.0, 0.0, 0.0);
vAxY = normalMatrix * vec3(0.0, 1.0, 0.0);
vAxZ = normalMatrix * vec3(0.0, 0.0, 1.0);
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uRadius;
uniform float uCobbleScale;
varying vec4 vSurf;
varying vec4 vSurf2;
varying vec3 vLocal;
varying vec2 vCob;
float gGrassW = 0.0;
float gCobW = 0.0;
#ifdef USE_COBBLE_NORMAL
uniform sampler2D uCobbleN;
uniform float uCobbleBump;
#endif
#ifdef USE_GROUND_NORMAL
uniform sampler2D uGrassN;
uniform float uGroundBump;
varying vec3 vLocalN;
varying vec3 vAxX;
varying vec3 vAxY;
varying vec3 vAxZ;
#endif
#ifdef USE_PLAZA_TEX
uniform sampler2D uTexPlaza;
uniform float uPlazaRadius;
#endif
#ifdef USE_GROUND_TEX
uniform sampler2D uTexGrass; uniform sampler2D uTexDirt; uniform sampler2D uTexCobble;
uniform sampler2D uTexSand; uniform sampler2D uTexRiverbed;
uniform vec3 uMeanGrass; uniform vec3 uMeanDirt; uniform vec3 uMeanCobble;
uniform vec3 uMeanSand; uniform vec3 uMeanRiverbed;
${TRIPLANAR_GLSL}
#endif
float h13(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h33(vec3 p) { return vec3(h13(p), h13(p + 17.13), h13(p + 31.71)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 3.1) + 0.15 * vnoise(p * 4.3 + 7.7); }
vec3 worley(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); float d1 = 8.0; float d2 = 8.0; float id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 o = h33(i + g); vec3 r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h13(i + g + 5.3); } else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
vec3 lin(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 col = diffuseColor.rgb;
  vec3 nrm = normalize(vLocal);
  float hgt = vSurf2.w;
  float steep = vSurf2.z;

  // organic, noisy path edges (the vertex band gives the rough shape, noise the wear)
  float pathN = vnoise(vLocal * 3.4) - 0.5 + (vnoise(vLocal * 9.0) - 0.5) * 0.4;
  float pathW = smoothstep(0.32, 0.62, vSurf.x + pathN * 0.42);
  float cobW = 0.0;
  vec3 cobT = vec3(0.0);
  if (vSurf.z > 0.001) {
#ifdef USE_GROUND_TEX
    cobT = texture2D(uTexCobble, vCob * uCobbleScale).rgb;
    float stoneH = dot(cobT, vec3(0.2126, 0.7152, 0.0722)) / max(dot(uMeanCobble, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
    cobW = smoothstep(0.34, 0.6, vSurf.z + (stoneH - 1.0) * 0.55 + (vnoise(vLocal * 3.0) - 0.5) * 0.3);
#else
    cobW = vSurf.z;
#endif
  }
  gCobW = cobW;
  float wGrass = clamp(1.0 - pathW - vSurf.y - cobW - vSurf.w - vSurf2.x - vSurf2.y * 0.6, 0.0, 1.0);
  gGrassW = wGrass;

  // ---- grass: top-down painterly colour noise (no blades), clover and a few tiny flowers ----
  float mottle = fbm(vLocal * 0.55);
  col *= 0.86 + 0.28 * mottle;
  col *= 1.0 + clamp(hgt, -0.3, 0.4) * 0.35;
#ifdef USE_GROUND_TEX
  vec3 tw = triW(nrm);
  // two scales, swapped by a slow noise, so the tile never visibly repeats
  float tSwap = smoothstep(0.35, 0.65, vnoise(vLocal * 0.42 + 5.0));
  vec3 gA = tri(uTexGrass, vLocal, tw, 0.3);
  vec3 gB = tri(uTexGrass, vLocal.zxy + 3.7, tw.zxy, 0.19);
  vec3 gd = mix(gA, gB, tSwap) / uMeanGrass;
  vec3 g = col * max(vec3(0.3), 1.0 + (gd - 1.0) * 1.5);
#else
  // soft isotropic dabs at two scales, warmer where lighter
  float dab = (vnoise(vLocal * 2.6) - 0.5) + (vnoise(vLocal * 7.0 + 2.3) - 0.5) * 0.8 + (vnoise(vLocal * 18.0 + 5.1) - 0.5) * 0.5;
  vec3 g = col * (1.0 + dab * vec3(0.5, 0.42, 0.24));
#endif
  // clover specks (three-leaf, darker) in lush patches
  vec3 cs = vLocal * 2.4; vec3 cc = floor(cs); vec3 cf = fract(cs) - (0.25 + 0.5 * h33(cc + 2.0));
  cf -= nrm * dot(cf, nrm);
  float ang = atan(dot(cf, cross(nrm, vec3(0.0, 1.0, 0.0001))), dot(cf, normalize(cross(nrm, vec3(1.0, 0.0, 0.0)) + 1e-4)));
  float petal = length(cf) - 0.07 * (0.6 + 0.4 * abs(cos(1.5 * ang)));
  float clover = (1.0 - smoothstep(-0.005, 0.01, petal)) * step(0.62, h13(cc + 8.0)) * smoothstep(0.35, 0.6, mottle);
  g = mix(g, g * vec3(0.72, 0.86, 0.7), clover * 0.8);
  // small white, yellow and pink flowers dotted through the meadow in little pairs, big enough to
  // read from the camera (a few pixels each), denser in the lusher patches
  vec3 fs = vLocal * 3.6; vec3 fc = floor(fs); vec3 fo = 0.2 + 0.6 * h33(fc + 11.0);
  vec3 fp = fract(fs); fp -= nrm * dot(fp - fo, nrm);
  float fd = min(length(fp - fo), length(fp - fo - 0.09 * normalize(h33(fc + 4.0) - 0.5 + 1e-3)));
  float fOn = step(0.8 - 0.08 * mottle, h13(fc + 13.0));
  float flower = (1.0 - smoothstep(0.12, 0.15, fd)) * fOn;
  // each sits on a small, darker clump of leaves, so it reads as a little plant, not a dot
  g = mix(g, g * vec3(0.62, 0.8, 0.55), (1.0 - smoothstep(0.16, 0.27, fd)) * fOn * 0.85);
  float fk = h13(fc + 21.0);
  vec3 fcol = fk < 0.5 ? lin(vec3(1.0, 0.98, 0.92)) : fk < 0.82 ? lin(vec3(1.0, 0.85, 0.3)) : lin(vec3(1.0, 0.7, 0.82));
  // daisies get a yellow eye
  fcol = mix(fcol, lin(vec3(1.0, 0.8, 0.25)), (1.0 - smoothstep(0.035, 0.06, fd)) * step(fk, 0.5));
  g = mix(g, fcol, flower);
  // worn, slightly yellow grass right beside the paths
  g = mix(g, g * vec3(1.08, 1.02, 0.78), smoothstep(0.02, 0.3, vSurf.x) * (1.0 - pathW) * 0.8);
  col = mix(col, g, wGrass);

  // ---- dirt path: two-tone packed earth, pebbles and a darker worn edge ----
  if (pathW > 0.001) {
#ifdef USE_GROUND_TEX
    vec3 dirt = tri(uTexDirt, vLocal, tw, 0.4) * (lin(vec3(0.885, 0.775, 0.58)) / uMeanDirt);
    dirt *= 0.93 + 0.14 * fbm(vLocal * 1.3);
#else
    float dn = fbm(vLocal * 2.2);
    vec3 dirt = mix(lin(vec3(0.84, 0.72, 0.52)), lin(vec3(0.93, 0.83, 0.64)), dn);
    dirt *= 0.94 + 0.1 * vnoise(vLocal * 11.0);
    vec3 w = worley(vLocal * 6.5);
    float pebble = 1.0 - smoothstep(0.14, 0.2, w.x);
    vec3 pc = mix(lin(vec3(0.72, 0.68, 0.62)), lin(vec3(0.96, 0.93, 0.87)), w.z);
    dirt = mix(dirt, pc * (0.9 + 0.2 * (1.0 - w.x * 5.0)), pebble * step(0.45, w.z) * 0.8);
#endif
    float edgeLine = 1.0 - smoothstep(0.0, 0.22, abs(pathW - 0.45));
    dirt *= 1.0 - 0.14 * edgeLine;
    col = mix(col, dirt, pathW);
  }

  if (cobW > 0.001) {
#ifdef USE_GROUND_TEX
    col = mix(col, cobT * 0.96, cobW);
#else
    vec3 w = worley(vLocal * 3.6);
    float edge = w.y - w.x;
    float mortar = 1.0 - smoothstep(0.05, 0.12, edge);
    vec3 stone = mix(lin(vec3(0.78, 0.75, 0.69)), lin(vec3(0.95, 0.92, 0.86)), w.z);
    stone *= 0.84 + 0.26 * smoothstep(0.0, 0.3, edge);
    vec3 joint = mix(lin(vec3(0.58, 0.56, 0.5)), lin(vec3(0.46, 0.6, 0.34)), step(0.6, vnoise(vLocal * 5.0)));
    col = mix(col, mix(stone, joint, mortar), cobW);
#endif
  }

  // ---- sand (pond beach) ----
  if (vSurf.w > 0.001) {
#ifdef USE_GROUND_TEX
    vec3 sand = tri(uTexSand, vLocal, tw, 0.5) * (lin(vec3(0.95, 0.88, 0.68)) / uMeanSand);
#else
    vec3 sand = lin(vec3(0.95, 0.88, 0.68)) * (0.94 + 0.1 * vnoise(vLocal * 5.0));
    float grain = step(0.8, h13(floor(vLocal * 22.0)));
    sand = mix(sand, sand * 0.88, grain);
#endif
    col = mix(col, sand, vSurf.w);
  }

  // ---- river: dark mossy bank, then a pebbly bed under the water ----
  if (vSurf2.y > 0.001) {
    vec3 moss = mix(col * vec3(0.72, 0.84, 0.66), lin(vec3(0.43, 0.39, 0.3)), smoothstep(0.45, 0.95, vSurf2.y));
    col = mix(col, moss, vSurf2.y);
  }
  if (vSurf2.x > 0.001) {
#ifdef USE_GROUND_TEX
    vec3 bed = tri(uTexRiverbed, vLocal, tw, 0.7) * (lin(vec3(0.7, 0.65, 0.54)) / uMeanRiverbed);
#else
    vec3 w = worley(vLocal * 5.5);
    vec3 bed = mix(lin(vec3(0.62, 0.56, 0.44)), lin(vec3(0.78, 0.74, 0.64)), w.z);
    bed *= 0.8 + 0.25 * smoothstep(0.0, 0.25, w.y - w.x);
#endif
    col = mix(col, bed, vSurf2.x);
  }

  // ---- steep ground (cliff feet, banks): layered earth and rock ----
  if (steep > 0.001) {
    float layer = fract((length(vLocal) - uRadius) * 5.5 + vnoise(vLocal * 2.0) * 0.6);
    vec3 rockA = lin(vec3(0.72, 0.62, 0.5));
    vec3 rockB = lin(vec3(0.62, 0.6, 0.58));
    vec3 rock = mix(rockA, rockB, smoothstep(0.35, 0.65, layer)) * (0.88 + 0.2 * vnoise(vLocal * 7.0));
#ifdef USE_GROUND_TEX
    // non-directional painted grit (strata tiles would criss-cross under triplanar projection)
    vec3 grit = tri(uTexDirt, vLocal, tw, 0.9);
    const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
    rock *= mix(1.0, dot(grit, LW) / dot(uMeanDirt, LW), 0.7);
#endif
    col = mix(col, rock, steep * (1.0 - vSurf.y));
  }

  // plaza: concentric brick rings with a compass rose at the centre (spawn pole)
  if (vSurf.y > 0.001) {
    vec3 u = normalize(vLocal);
    float r = acos(clamp(u.y, -1.0, 1.0)) * uRadius;
    float th = atan(u.x, -u.z);
#ifdef USE_PLAZA_TEX
    // the painted plaza, mapped once across the disc: image top = north (−z), right = east (+x)
    vec2 puv = vec2(0.5) + vec2(sin(th), cos(th)) * r / (2.0 * uPlazaRadius);
    vec3 plaza = texture2D(uTexPlaza, puv).rgb;
#else
    float ringW = 0.34;
    float ring = floor(r / ringW);
    float fr = fract(r / ringW);
    float circ = max(r, 0.3) * 6.28318;
    float nB = max(6.0, floor(circ / 0.5));
    float uu = (th / 6.28318 + 0.5) * nB + mod(ring, 2.0) * 0.5;
    float bi = floor(uu); float bu = fract(uu);
    float mort = min(min(fr, 1.0 - fr) * ringW, min(bu, 1.0 - bu) * (circ / nB));
    float m = smoothstep(0.012, 0.03, mort);
    float bh = h13(vec3(ring, bi, 7.0));
    vec3 brick = mix(lin(vec3(0.84, 0.58, 0.45)), lin(vec3(0.94, 0.75, 0.58)), bh);
    brick *= 0.93 + 0.12 * vnoise(vLocal * 9.0);
    vec3 plaza = mix(lin(vec3(0.91, 0.87, 0.79)), brick, m);
    if (r < 1.1) {
      float mainP = pow(abs(cos(2.0 * th)), 10.0);
      float minorP = pow(abs(sin(2.0 * th)), 10.0) * 0.55;
      float reach = 0.18 + 0.82 * max(mainP, minorP);
      float inside = step(r, reach * 0.95);
      float halfSide = step(0.0, sin(8.0 * th));
      vec3 rose = mix(lin(vec3(0.98, 0.95, 0.87)), lin(vec3(0.36, 0.48, 0.84)), halfSide);
      rose = mix(rose, lin(vec3(0.95, 0.75, 0.3)), step(max(mainP, minorP), 0.5) * step(r, 0.2));
      plaza = mix(plaza, lin(vec3(0.95, 0.92, 0.84)), step(r, 1.0));
      plaza = mix(plaza, rose, inside);
      plaza = mix(plaza, lin(vec3(0.55, 0.46, 0.36)), 1.0 - smoothstep(0.012, 0.028, abs(r - 1.02)));
    }
#endif
    col = mix(col, plaza, vSurf.y);
  }
  diffuseColor.rgb = col;
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
#ifdef USE_GROUND_NORMAL
if (gGrassW > 0.01) {
  // triplanar grass relief, in planet-local space (same projections as the colour), then to view space
  vec3 nL = vLocalN * inversesqrt(max(dot(vLocalN, vLocalN), 1e-12));
  vec3 tw2 = triW(nL);
  vec3 pert = vec3(0.0);
  if (tw2.x > 0.02) { vec2 t = texture2D(uGrassN, vLocal.zy * 0.3).xy * 2.0 - 1.0; pert += vec3(0.0, t.y, t.x) * tw2.x; }
  if (tw2.y > 0.02) { vec2 t = texture2D(uGrassN, vLocal.xz * 0.3).xy * 2.0 - 1.0; pert += vec3(t.x, 0.0, t.y) * tw2.y; }
  if (tw2.z > 0.02) { vec2 t = texture2D(uGrassN, vLocal.xy * 0.3).xy * 2.0 - 1.0; pert += vec3(t.x, t.y, 0.0) * tw2.z; }
  pert -= nL * dot(pert, nL);
  vec3 nb = nL + pert * (uGroundBump * gGrassW);
  vec3 nv = vAxX * nb.x + vAxY * nb.y + vAxZ * nb.z;
  normal = nv * inversesqrt(max(dot(nv, nv), 1e-12));
}
#endif
#ifdef USE_COBBLE_NORMAL
if (gCobW > 0.01) {
  vec2 cuv = vCob * uCobbleScale;
  vec3 q0 = dFdx(-vViewPosition);
  vec3 q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(cuv);
  vec2 st1 = dFdy(cuv);
  vec3 q1p = cross(q1, normal);
  vec3 q0p = cross(normal, q0);
  vec3 T = q1p * st0.x + q0p * st1.x;
  vec3 B = q1p * st0.y + q0p * st1.y;
  float tb = max(dot(T, T), dot(B, B));
  if (tb > 1e-20) {
    float s = inversesqrt(tb);
    vec3 mapN = texture2D(uCobbleN, cuv).xyz * 2.0 - 1.0;
    vec3 cn = T * (mapN.x * s * uCobbleBump) + B * (mapN.y * s * uCobbleBump) + normal * mapN.z;
    cn = cn * inversesqrt(max(dot(cn, cn), 1e-12));
    vec3 mixed = mix(normal, cn, gCobW);
    normal = mixed * inversesqrt(max(dot(mixed, mixed), 1e-12));
  }
}
#endif`,
      );
  };
  m.customProgramCacheKey = () => `planet-ground-v6${textured ? '-tex' : ''}${plazaTex ? '-plaza' : ''}${grassN ? '-bump' : ''}${cobbleN ? '-cob' : ''}`;
  return withLampLights(m);
}
