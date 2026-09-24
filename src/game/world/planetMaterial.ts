import { MeshStandardMaterial } from 'three';

/**
 * Stylised ground material. Vertex colour = base grass tint; `aSurf` (vec4) blends in
 * procedural surfaces: x = dirt path, y = plaza bricks (+ compass rose), z = cobbles, w = sand.
 * Patterns are evaluated in planet-local space so they stay glued to the rotating planet.
 */
export function createPlanetMaterial(radius: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRadius = { value: radius };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aSurf;
varying vec4 vSurf;
varying vec3 vLocal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSurf = aSurf;
vLocal = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uRadius;
varying vec4 vSurf;
varying vec3 vLocal;
float h13(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h33(vec3 p) { return vec3(h13(p), h13(p + 17.13), h13(p + 31.71)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
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
  float wGrass = clamp(1.0 - vSurf.x - vSurf.y - vSurf.z - vSurf.w, 0.0, 1.0);

  // grass: soft patches + little leaf-shaped speckles
  float big = vnoise(vLocal * 0.45);
  col *= mix(1.0, 0.84 + 0.3 * big, wGrass);
  vec3 sp = vLocal * 3.2; vec3 ci = floor(sp); vec3 cf = fract(sp); vec3 o = h33(ci) * 0.7 + 0.15;
  vec3 dd = abs(cf - o);
  float diamond = dd.x * 1.4 + dd.y + dd.z * 0.8;
  float speck = step(0.45, h13(ci + 3.3)) * (1.0 - smoothstep(0.1, 0.14, diamond));
  col = mix(col, col * vec3(1.22, 1.16, 0.74) + lin(vec3(0.06, 0.06, 0.0)), speck * wGrass * 0.9);
  float speck2 = step(0.55, h13(ci + 9.1)) * (1.0 - smoothstep(0.05, 0.08, length(cf - h33(ci + 5.0) * 0.8 - 0.1)));
  col = mix(col, col * 0.78, speck2 * wGrass * 0.7);

  // dirt path with pebbles
  if (vSurf.x > 0.001) {
    vec3 dirt = lin(vec3(0.9, 0.8, 0.6)) * (0.9 + 0.18 * vnoise(vLocal * 2.4));
    vec3 w = worley(vLocal * 6.5);
    float pebble = 1.0 - smoothstep(0.16, 0.22, w.x);
    vec3 pc = mix(lin(vec3(0.76, 0.71, 0.64)), lin(vec3(0.97, 0.94, 0.88)), w.z);
    dirt = mix(dirt, pc, pebble * step(0.4, w.z) * 0.7);
    col = mix(col, dirt, vSurf.x);
  }

  // cobblestone forecourts
  if (vSurf.z > 0.001) {
    vec3 w = worley(vLocal * 3.6);
    float edge = w.y - w.x;
    float mortar = 1.0 - smoothstep(0.05, 0.12, edge);
    vec3 stone = mix(lin(vec3(0.78, 0.75, 0.69)), lin(vec3(0.93, 0.9, 0.84)), w.z);
    stone *= 0.9 + 0.16 * (1.0 - w.x);
    col = mix(col, mix(stone, lin(vec3(0.6, 0.58, 0.53)), mortar), vSurf.z);
  }

  // sand
  if (vSurf.w > 0.001) {
    vec3 sand = lin(vec3(0.95, 0.88, 0.68)) * (0.94 + 0.1 * vnoise(vLocal * 5.0));
    float grain = step(0.8, h13(floor(vLocal * 22.0)));
    sand = mix(sand, sand * 0.88, grain);
    col = mix(col, sand, vSurf.w);
  }

  // plaza: concentric brick rings with a compass rose at the centre (spawn pole)
  if (vSurf.y > 0.001) {
    vec3 u = normalize(vLocal);
    float r = acos(clamp(u.y, -1.0, 1.0)) * uRadius;
    float th = atan(u.x, -u.z);
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
    col = mix(col, plaza, vSurf.y);
  }
  diffuseColor.rgb = col;
}`,
      );
  };
  m.customProgramCacheKey = () => 'planet-ground-v1';
  return m;
}
