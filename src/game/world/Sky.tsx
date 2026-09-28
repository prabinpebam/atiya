import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector2, Vector3, type BufferGeometry } from 'three';
import type { GameController } from '../controller';
import { selectAmbientPaused } from '../state/store';
import { cloud } from './propModels';
import { CLOUD_COUNT, CLOUD_VARIANTS, cloudBillboard, cloudLayout, cloudOrientation, cloudPosition, driftClouds, ringFrame, type Cloud } from './clouds';
import { TEXTURES } from './textureManifest';
import { gameTexture } from './textures';
import { popPose } from './summon';

let cloudMat: MeshStandardMaterial | null = null;
let spriteMode = false;

/** Opaque rectangle (u0, v0, u1, v1) of each painted cloud in the atlas. */
const RECTS = (TEXTURES['cloud-atlas'] as unknown as { rects: [number, number, number, number][] }).rects;
/** Atlas size (px), for the rectangles' aspect ratios. */
const ATLAS_W = 1024;
const ATLAS_H = 512;
/** A cloud's height (u) per unit of its layout scale, and the widest a flat one may get. */
const CLOUD_HEIGHT = 2.6;
const CLOUD_MAX_WIDTH = 7.2;

/**
 * Shared cloud material, tinted by the day–night cycle (DayNight sets colour and emissive).
 *
 * With the painted sprites (art direction): the painted clouds (cream tops, lavender bases) are
 * mostly self-lit through `emissiveMap`, and a tangent-space normal map (a puffy dome per cloud,
 * derived at build time) lets the sun and moon light them from their real direction, so dusk
 * rims them in gold. Alpha-blended, no depth write, no fog. Falls back to the 3D puffs.
 */
export function cloudMaterial(): MeshStandardMaterial {
  if (cloudMat) return cloudMat;
  const map = gameTexture('cloud-atlas');
  const normalMap = gameTexture('cloud-normal');
  spriteMode = Boolean(map && normalMap);
  if (spriteMode) {
    cloudMat = new MeshStandardMaterial({
      map,
      emissiveMap: map,
      normalMap,
      normalScale: new Vector2(1, 1),
      emissive: '#ffffff',
      emissiveIntensity: 0.5,
      roughness: 1,
      metalness: 0,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      fog: false,
    });
    // each instance picks its cloud's rectangle of the atlas
    cloudMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
{
  vec2 cloudUv = mix(aRect.xy, aRect.zw, uv);
  vMapUv = cloudUv;
  vEmissiveMapUv = cloudUv;
  vNormalMapUv = cloudUv;
}`,
        );
    };
    cloudMat.customProgramCacheKey = () => 'cloud-sprite-v1';
  } else {
    cloudMat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.3, fog: false });
  }
  return cloudMat;
}

/** The cloud material if the clouds have been summoned (it's made with them, after their textures), else null. */
export function cloudMaterialMade(): MeshStandardMaterial | null {
  return cloudMat;
}

/** Whether the clouds are the painted sprites (true) or the 3D fallback. */
export function cloudSprites(): boolean {
  cloudMaterial();
  return spriteMode;
}

/** Quad size (u) of a painted cloud: its height from the layout scale, its width from the sprite's shape. */
export function spriteSize(c: Cloud, variant: number, out = new Vector3()): Vector3 {
  const [u0, v0, u1, v1] = RECTS[variant];
  const aspect = ((u1 - u0) * ATLAS_W) / ((v1 - v0) * ATLAS_H);
  let h = CLOUD_HEIGHT * c.scale;
  let w = h * aspect;
  if (w > CLOUD_MAX_WIDTH * c.scale) {
    w = CLOUD_MAX_WIDTH * c.scale;
    h = w / aspect;
  }
  return out.set(w, h, 1);
}

/**
 * Clouds orbiting the planet on a ring concentric with it on screen (`world/clouds.ts`): they drift
 * clockwise round the planet's outline, over the top from left to right. The rings follow the
 * camera every frame, so they stay concentric at any tilt and during fly-overs. Painted sprites
 * face the camera and are drawn far to near (each cloud keeps its distance, so the order is fixed).
 */
export function Clouds({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, selectAmbientPaused);
  const camera = useThree((st) => st.camera);
  const ref = useRef<InstancedMesh>(null);
  const { geo, mat, items, sprites } = useMemo(() => {
    const m = cloudMaterial();
    const sprite = cloudSprites();
    // far to near, so the alpha blending layers correctly within the one draw
    const layout = cloudLayout().sort((a, b) => b.dist - a.dist);
    let g: BufferGeometry;
    if (sprite) {
      g = new PlaneGeometry(1, 1);
      const rect = new Float32Array(layout.length * 4);
      layout.forEach((_, i) => rect.set(RECTS[CLOUD_VARIANTS[i % CLOUD_VARIANTS.length]], i * 4));
      g.setAttribute('aRect', new InstancedBufferAttribute(rect, 4));
    } else {
      g = cloud();
    }
    return { geo: g, mat: m, items: layout, sprites: sprite };
  }, []);

  const frame = useMemo(() => ringFrame(new Vector3(0, 1, 1)), []);
  const m = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const p = useMemo(() => new Vector3(), []);
  const sc = useMemo(() => new Vector3(), []);
  const write = () => {
    const mesh = ref.current;
    if (!mesh) return;
    ringFrame(camera.position, frame);
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      cloudPosition(frame, c.theta, c.alpha, c.dist, p);
      if (sprites) {
        cloudBillboard(frame, c.theta, p, q);
        spriteSize(c, CLOUD_VARIANTS[i % CLOUD_VARIANTS.length], sc);
      } else {
        cloudOrientation(frame, c.theta, q);
        sc.setScalar(c.scale);
      }
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(write);
  // follows the camera every frame (tilt, fly-overs); only the drift stops when ambient motion is paused
  const faded = useRef(!sprites);
  useFrame((_, dt) => {
    if (!paused) driftClouds(items, dt);
    write();
    // summoned: the painted clouds fade in, and the sky is clear until then (progressive-loading.md §5.5)
    if (!faded.current) {
      const at = controller.summoner.revealed.get('clouds');
      const s = controller.store.getState();
      const t = at === undefined ? -1 : (performance.now() - at) / 1000;
      const pose = popPose('fade', t, 0, controller.summoner.instant || s.reducedMotionSystem || s.reducedMotionUser);
      mat.opacity = pose.alpha;
      if (pose.done) faded.current = true;
    }
  });

  return <instancedMesh ref={ref} args={[geo, mat, CLOUD_COUNT]} frustumCulled={false} renderOrder={-1} name="clouds" />;
}
