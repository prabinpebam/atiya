import { DataTexture, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Int8BufferAttribute, MeshLambertMaterial, NearestFilter, RGBAFormat, RGBAIntegerFormat, ShaderChunk, Sphere, UnsignedByteType, UnsignedIntType, Uint16BufferAttribute, Vector3, Vector4, type Texture } from 'three';
import { BATCH, META, TEX_W, type Packed } from './field';

/** What the draws borrow from the main bundle (world/grassEnv.ts; zones.ts says why). */
export interface GrassDrawEnv {
  /** windField.ts: the props' wind (WIND_GLSL and its uniforms). */
  windGlsl: string;
  windUniforms: Record<string, { value: unknown }>;
  /** lampLights.ts withLampLights. */
  lamp<T extends MeshLambertMaterial>(m: T): T;
}

/**
 * The grass's draws (vegetation spec §4): each kind is ONE instanced draw whose instances are
 * batches of 256 items, built entirely in the vertex shader from packed per-item textures
 * (vertex pulling). Opaque blades and flowers; the knee-high tufts are alpha-tested cards that turn
 * to face the camera about their own up. Lambert lighting (sun, moon, fog, shadows received) plus
 * the lamps; the same wind field and gust waves as the props' sway; parted by the movers.
 */

export type GrassKind = 'blade' | 'flower' | 'tuft';

/** Vertices per item, and the item's triangles. */
const SHAPES: Record<GrassKind, { v: number; idx: number[] }> = {
  // two segments: base pair, mid pair, tip
  blade: { v: 5, idx: [0, 1, 3, 0, 3, 2, 2, 3, 4] },
  // a stem (base pair to the head's centre) and a hexagonal head round the centre
  flower: { v: 9, idx: [0, 1, 2, ...[0, 1, 2, 3, 4, 5].flatMap((j) => [2, 3 + j, 3 + ((j + 1) % 6)])] },
  // a camera-facing quad (x = vertex & 1, y = vertex >> 1)
  tuft: { v: 4, idx: [0, 1, 3, 0, 3, 2] },
};

export const MOVERS = 12;
/** Blade width at the root (u), before its per-blade factor. */
const BLADE_W = 0.06;

export interface GrassUniforms {
  movers: Vector4[];
  camLocal: Vector3;
}

export function templateGeometry(kind: GrassKind, items: number): InstancedBufferGeometry {
  const { v, idx } = SHAPES[kind];
  const g = new InstancedBufferGeometry();
  // the shader builds every vertex; `position` only sizes the draw
  g.setAttribute('position', new Int8BufferAttribute(new Int8Array(BATCH * v * 3), 3));
  g.setAttribute('color', new Int8BufferAttribute(new Int8Array(BATCH * v * 3), 3));
  const index = new Uint16Array(BATCH * idx.length);
  for (let k = 0; k < BATCH; k++) for (let j = 0; j < idx.length; j++) index[k * idx.length + j] = k * v + idx[j];
  g.setIndex(new Uint16BufferAttribute(index, 1));
  const batches = Math.max(1, Math.ceil(items / BATCH));
  const ids = new Float32Array(batches);
  for (let i = 0; i < batches; i++) ids[i] = i;
  g.setAttribute('aBatch', new InstancedBufferAttribute(ids, 1));
  g.instanceCount = batches;
  g.boundingSphere = new Sphere(new Vector3(), 12);
  return g;
}

/** The packed items as two textures: RGBA32UI (root position bits + meta) and RGBA8 (√colour + extra). */
export function packTextures(p: Packed): { a: DataTexture; b: DataTexture } {
  const rows = Math.ceil(p.padded / TEX_W);
  const a = new Uint32Array(TEX_W * rows * 4);
  const fbits = new Uint32Array(p.root.buffer, p.root.byteOffset, p.root.length);
  for (let i = 0; i < p.padded; i++) {
    a[i * 4] = fbits[i * 3];
    a[i * 4 + 1] = fbits[i * 3 + 1];
    a[i * 4 + 2] = fbits[i * 3 + 2];
    a[i * 4 + 3] = p.meta[i];
  }
  const b = new Uint8Array(TEX_W * rows * 4);
  b.set(p.colour);
  const ta = new DataTexture(a, TEX_W, rows, RGBAIntegerFormat, UnsignedIntType);
  ta.internalFormat = 'RGBA32UI';
  const tb = new DataTexture(b, TEX_W, rows, RGBAFormat, UnsignedByteType);
  for (const t of [ta, tb]) {
    t.minFilter = NearestFilter;
    t.magFilter = NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
  return { a: ta, b: tb };
}

const commonDecl = (windGlsl: string) => `
uniform highp usampler2D uGrassA;
uniform sampler2D uGrassB;
uniform vec4 uMovers[${MOVERS}];
uniform vec3 uCamLocal;
attribute float aBatch;
${windGlsl}
vec3 gUp; vec3 gRoot; vec3 gSide; vec3 gFwd; vec3 gBend; vec4 gCol; float gH; float gW; float gL; float gYaw; float gFlat; int gV;`;

function commonMain(v: number, R: number, normal: string): string {
  return `
int gId = int(aBatch + 0.5) * ${BATCH} + gl_VertexID / ${v};
gV = gl_VertexID - (gl_VertexID / ${v}) * ${v};
ivec2 gUv = ivec2(gId % ${TEX_W}, gId / ${TEX_W});
uvec4 gA = texelFetch(uGrassA, gUv, 0);
gCol = texelFetch(uGrassB, gUv, 0);
gRoot = vec3(uintBitsToFloat(gA.x), uintBitsToFloat(gA.y), uintBitsToFloat(gA.z));
gYaw = float(gA.w & 1023u) * (6.2831853 / 1023.0);
gH = float((gA.w >> 10u) & 255u) * (${META.maxH.toFixed(3)} / 255.0);
gW = float((gA.w >> 18u) & 63u) / 63.0;
gL = float((gA.w >> 24u) & 255u) / 255.0;
gUp = gRoot * inversesqrt(max(dot(gRoot, gRoot), 1e-12));
vec3 gRef = abs(gUp.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
vec3 gT1 = cross(gUp, gRef);
gT1 *= inversesqrt(max(dot(gT1, gT1), 1e-12));
vec3 gT2 = cross(gUp, gT1);
gSide = cos(gYaw) * gT1 + sin(gYaw) * gT2;
gFwd = cross(gSide, gUp);
vec3 wWP = windAt(gRoot);
float wExp = 0.35 + 0.65 * length(wWP);
vec3 wDir = wWP * inversesqrt(max(dot(wWP, wWP), 1e-12));
float wPh = dot(gRoot, vec3(0.7, 0.5, 0.9));
float wWave = sin(uWindTime * 1.3 - dot(gRoot, wDir) * 0.45 + wPh * 0.25);
float wAmt = (uWindStrength * 0.9 + (0.35 + uWindStrength) * (0.65 * wWave + 0.35 * sin(uWindTime * 2.7 + wPh + gL * 3.0))) * wExp;
gFlat = 0.0;
vec3 gPush = vec3(0.0);
for (int i = 0; i < ${MOVERS}; i++) {
  vec4 gM = uMovers[i];
  if (gM.w <= 0.0) continue;
  vec3 gD = gUp - gM.xyz;
  float gF = 1.0 - smoothstep(gM.w * 0.45, gM.w, length(gD) * ${R.toFixed(1)});
  if (gF <= 0.0) continue;
  vec3 gDt = gD - gUp * dot(gD, gUp);
  gPush += gDt * inversesqrt(max(dot(gDt, gDt), 1e-12)) * gF;
  gFlat = max(gFlat, gF);
}
gBend = wDir * wAmt + gPush * 1.4;
vec3 objectNormal = ${normal};`;
}

const BLADE_MAIN = `
float gT = gV < 2 ? 0.0 : gV < 4 ? 0.55 : 1.0;
float gX = gV < 4 ? (float(gV - (gV / 2) * 2) - 0.5) * (1.0 - gT * 0.8) : 0.0;
float gHt = gH * (1.0 - 0.85 * gFlat);
vec3 gLean = gFwd * (0.12 + 0.55 * gL) + gBend * (0.3 + 0.25 * gL);
float gLk = min(1.0, dot(gLean, gLean));
vec3 transformed = gRoot + gUp * (gHt * gT * (1.0 - 0.35 * gLk * gT)) + gLean * (gHt * gT * gT) + gSide * (gX * ${BLADE_W} * (0.6 + 0.8 * gW));
vec3 gc = gCol.rgb * gCol.rgb;
vec3 gTip = mix(gc * 1.18 + vec3(0.03, 0.035, 0.0), gc * vec3(1.3, 1.16, 0.62), gCol.a * 0.45);
vColor = vec4(mix(gc * 0.72, gTip, gT * gT), 1.0);`;

const FLOWER_MAIN = `
float gHt = gH * (1.0 - 0.85 * gFlat);
vec3 gHead = gRoot + gUp * gHt + (gFwd * 0.12 + gBend * 0.18) * gHt;
float gR = 0.028 + 0.03 * gW;
vec3 transformed;
if (gV < 2) transformed = gRoot + gSide * ((float(gV) - 0.5) * 0.014);
else if (gV == 2) transformed = gHead + gUp * 0.012;
else {
  float gAng = float(gV - 3) * 1.0471976 + gYaw;
  transformed = gHead + (gSide * cos(gAng) + gFwd * sin(gAng)) * gR;
}
vec3 gPc = gCol.rgb * gCol.rgb;
vColor = vec4(gV < 2 ? vec3(0.2, 0.42, 0.14) : gV == 2 ? (gPc.b < 0.2 ? vec3(0.9, 0.5, 0.1) : vec3(1.0, 0.8, 0.22)) : gPc, 1.0);`;

const TUFT_MAIN = `
float gx = float(gV - (gV / 2) * 2);
float gy = float(gV / 2);
vec4 gRc = uRects[int(gW * 63.0 + 0.5)];
float gAsp = (gRc.z - gRc.x) / max(gRc.w - gRc.y, 1e-4);
float gHt = gH * (1.0 - 0.75 * gFlat);
vec3 gTc = uCamLocal - gRoot;
gTc -= gUp * dot(gTc, gUp);
float gTl = dot(gTc, gTc);
vec3 gFace = gTl > 1e-8 ? cross(gUp, gTc * inversesqrt(gTl)) : gSide;
vec3 transformed = gRoot + gFace * ((gx - 0.5) * gHt * gAsp) + gUp * (gy * gHt) + (gBend * 0.3 + gFwd * 0.05) * (gy * gHt);
vMapUv = vec2(mix(gRc.x, gRc.z, gYaw > 3.0 ? 1.0 - gx : gx), mix(gRc.y, gRc.w, gy));
vec3 gc = gCol.rgb * gCol.rgb;
vec3 gTip = mix(gc * 1.25 + vec3(0.03, 0.035, 0.0), gc * vec3(1.35, 1.18, 0.64), gCol.a * 0.45);
vColor = vec4(mix(gc * 0.8, gTip, gy), 1.0);`;

export function grassMaterial(kind: GrassKind, tex: { a: DataTexture; b: DataTexture }, shared: GrassUniforms, R: number, env: GrassDrawEnv, atlas?: { map: Texture; rects: ReadonlyArray<readonly number[]> }): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide, map: atlas?.map ?? null, alphaTest: atlas ? 0.5 : 0 });
  const main = kind === 'blade' ? BLADE_MAIN : kind === 'flower' ? FLOWER_MAIN : TUFT_MAIN;
  const rects = (atlas?.rects ?? []).map((r) => new Vector4(r[0], r[1], r[2], r[3]));
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, env.windUniforms, {
      uGrassA: { value: tex.a },
      uGrassB: { value: tex.b },
      uMovers: { value: shared.movers },
      uCamLocal: { value: shared.camLocal },
      ...(kind === 'tuft' ? { uRects: { value: rects } } : {}),
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${commonDecl(env.windGlsl)}${kind === 'tuft' ? `\nuniform vec4 uRects[${rects.length}];` : ''}`)
      .replace('#include <beginnormal_vertex>', commonMain(SHAPES[kind].v, R, kind === 'blade' ? 'normalize(gUp + gFwd * 0.3)' : 'gUp'))
      .replace('#include <begin_vertex>', main)
      .replace('#include <color_vertex>', '');
    // both faces shade with the soft, ground-like normal (no back-face flip)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', ShaderChunk.normal_fragment_begin.replaceAll('normal *= faceDirection;', ''));
  };
  m.customProgramCacheKey = () => `grass-${kind}-v1`;
  return env.lamp(m);
}
