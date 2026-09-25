/**
 * Occlusion outline ("x-ray" silhouette): where something in the foreground hides the character,
 * its outline still shows through.
 *
 * Each mesh of the character gets a twin sharing its geometry (and skeleton, so it follows every
 * pose) with a material that passes the depth test only where the depth buffer already holds
 * something nearer (`GreaterDepth`). The twin draws a bright rim (a Fresnel term, strongest at the
 * silhouette) over a faint dark fill, so it reads as an outline on light and dark scenery alike.
 *
 * Draw order keeps it from outlining the character through itself: the scenery (opaque,
 * renderOrder 0) is drawn first, then the twins (still in the opaque pass: blended through
 * CustomBlending, not `transparent`), then the character itself (renderOrder 2). So the twins
 * only ever test against scenery. Transparent things (water, glass, beams) are drawn later and
 * never trigger it. The twins are pulled a little toward the camera, so grass at the feet or a
 * slope the feet dip into doesn't set it off.
 */
import {
  Color,
  CustomBlending,
  FrontSide,
  GreaterDepth,
  Mesh,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SkinnedMesh,
  SrcAlphaFactor,
  type Object3D,
} from 'three';

export const OUTLINE = {
  rim: '#fff3d1',
  fill: '#1d1830',
  fillAlpha: 0.32,
  /** How far (u) the outline is pulled toward the camera: occluders nearer than this don't count. */
  pull: 0.25,
  /** renderOrder of the outline twins and of the character (the scenery is 0). */
  order: 1,
  characterOrder: 2,
} as const;

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float uPull;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vN = normalize(transformedNormal);
  vV = -mv.xyz;
  // slide along the view ray: same place on screen, a little nearer in depth
  float d = length(mv.xyz);
  mv.xyz *= max(0.0, 1.0 - uPull / max(d, 1e-4));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uRim;
uniform vec3 uFill;
uniform float uFillAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  gl_FragColor = vec4(mix(uFill, uRim, rim), mix(uFillAlpha, 0.95, rim));
}`;

let shared: ShaderMaterial | null = null;

/** The shared outline material (one program for every character mesh, skinned or not). */
export function outlineMaterial(): ShaderMaterial {
  if (shared) return shared;
  shared = new ShaderMaterial({
    name: 'occlusion-outline',
    uniforms: {
      uRim: { value: new Color(OUTLINE.rim) },
      uFill: { value: new Color(OUTLINE.fill) },
      uFillAlpha: { value: OUTLINE.fillAlpha },
      uPull: { value: OUTLINE.pull },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthFunc: GreaterDepth,
    depthWrite: false,
    depthTest: true,
    transparent: false,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    side: FrontSide,
    fog: false,
  });
  return shared;
}

/**
 * Give every mesh under `root` an occlusion-outline twin (as its child, so it follows the mesh).
 * Returns a function that removes them again.
 */
export function addOcclusionOutline(root: Object3D): () => void {
  const mat = outlineMaterial();
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && !m.userData.outline && !m.userData.isOutline) meshes.push(m);
  });
  const added: Array<{ parent: Mesh; twin: Mesh; order: number }> = [];
  for (const m of meshes) {
    let twin: Mesh;
    if ((m as SkinnedMesh).isSkinnedMesh) {
      const s = m as SkinnedMesh;
      const t = new SkinnedMesh(s.geometry, mat);
      t.bind(s.skeleton, s.bindMatrix);
      t.bindMode = s.bindMode;
      twin = t;
    } else {
      twin = new Mesh(m.geometry, mat);
    }
    twin.name = `${m.name || 'mesh'}-outline`;
    twin.userData.isOutline = true;
    twin.renderOrder = OUTLINE.order;
    twin.frustumCulled = false;
    twin.castShadow = false;
    twin.receiveShadow = false;
    twin.raycast = () => {};
    added.push({ parent: m, twin, order: m.renderOrder });
    m.renderOrder = OUTLINE.characterOrder;
    m.userData.outline = twin;
    m.add(twin);
  }
  return () => {
    for (const { parent, twin, order } of added) {
      parent.remove(twin);
      parent.renderOrder = order;
      delete parent.userData.outline;
    }
  };
}

/** How many outline twins are under `root` (diagnostics). */
export function countOutlines(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.userData.isOutline) n++;
  });
  return n;
}
