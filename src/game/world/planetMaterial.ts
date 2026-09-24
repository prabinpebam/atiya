import { MeshStandardMaterial, Vector3 } from 'three';
import { TRIPLANAR_GLSL, gameTexture, textureMean } from './textures';

const GROUND_TEX = ['grass', 'dirt', 'cobble', 'sand', 'riverbed'] as const;

/**
 * Stylised ground material. Vertex colour = base grass tint; `aSurf` (vec4) blends in
 * procedural surfaces: x = dirt path, y = plaza bricks (+ compass rose), z = cobbles, w = sand;
 * `aSurf2` (vec4): x = riverbed, y = wet bank, z = steepness, w = terrain height (u).
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
  m.defines = { ...(textured ? { USE_GROUND_TEX: '' } : {}), ...(plazaTex ? { USE_PLAZA_TEX: '' } : {}) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRadius = { value: radius };
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
varying vec4 vSurf;
varying vec4 vSurf2;
varying vec3 vLocal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSurf = aSurf;
vSurf2 = aSurf2;
vLocal = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uRadius;
varying vec4 vSurf;
varying vec4 vSurf2;
varying vec3 vLocal;
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
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }`,
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
  float wGrass = clamp(1.0 - pathW - vSurf.y - vSurf.z - vSurf.w - vSurf2.x - vSurf2.y * 0.6, 0.0, 1.0);

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
  // tiny white and yellow flowers, very sparse
  vec3 fs = vLocal * 4.5; vec3 fc = floor(fs); float fd = length(fract(fs) - (0.2 + 0.6 * h33(fc + 11.0)));
  float flower = (1.0 - smoothstep(0.035, 0.055, fd)) * step(0.93, h13(fc + 13.0));
  g = mix(g, mix(lin(vec3(1.0, 0.98, 0.9)), lin(vec3(1.0, 0.86, 0.35)), step(0.5, h13(fc + 21.0))), flower);
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

  // ---- cobblestone forecourts: domed stones with mossy joints ----
  if (vSurf.z > 0.001) {
#ifdef USE_GROUND_TEX
    vec3 cob = tri(uTexCobble, vLocal, tw, 0.42) * (lin(vec3(0.87, 0.84, 0.77)) / uMeanCobble);
    col = mix(col, cob, vSurf.z);
#else
    vec3 w = worley(vLocal * 3.6);
    float edge = w.y - w.x;
    float mortar = 1.0 - smoothstep(0.05, 0.12, edge);
    vec3 stone = mix(lin(vec3(0.78, 0.75, 0.69)), lin(vec3(0.95, 0.92, 0.86)), w.z);
    stone *= 0.84 + 0.26 * smoothstep(0.0, 0.3, edge);
    vec3 joint = mix(lin(vec3(0.58, 0.56, 0.5)), lin(vec3(0.46, 0.6, 0.34)), step(0.6, vnoise(vLocal * 5.0)));
    col = mix(col, mix(stone, joint, mortar), vSurf.z);
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
      );
  };
  m.customProgramCacheKey = () => `planet-ground-v4${textured ? '-tex' : ''}${plazaTex ? '-plaza' : ''}`;
  return m;
}
