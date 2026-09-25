import { MeshBasicMaterial, SkinnedMesh } from 'three';
import { ChopperAnim } from './anim';
import { chopperMaterial, type FurUniforms } from './fur';
import { baseOnly, chopperGeometry, chopperRig, releaseChopperGeometry, type ChopperRig } from './model';

export interface ChopperBody {
  mesh: SkinnedMesh;
  rig: ChopperRig;
  anim: ChopperAnim;
  uniforms: FurUniforms;
  shells: number;
  dispose(): void;
}

/**
 * A ready-to-draw Chopper: the skinned fur mesh (one draw call, plus its shadow), a fresh skeleton
 * and its animator. `lamps`: receive the planet's lamplight (off for the profile card's own canvas).
 */
export function buildChopper(shells: number, opts: { lamps?: boolean; shadows?: boolean; ownGeometry?: boolean } = {}): ChopperBody {
  const geometry = chopperGeometry(shells);
  const { material, uniforms } = chopperMaterial(opts.lamps !== false);
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = 'chopper';
  const rig = chopperRig();
  mesh.add(rig.root);
  mesh.bind(rig.skeleton);
  mesh.receiveShadow = opts.shadows !== false;
  // shadows come from a stand-in drawing just the base (the fur shells would multiply the shadow
  // pass for nothing); in the main pass it writes nothing
  let caster: SkinnedMesh | null = null;
  if (opts.shadows !== false) {
    caster = new SkinnedMesh(baseOnly(geometry), new MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    caster.name = 'chopper-shadow';
    caster.castShadow = true;
    caster.frustumCulled = false;
    mesh.add(caster);
    caster.bind(rig.skeleton, mesh.bindMatrix);
  }
  // he's always near the character (on screen); skinned bounds would need re-skinning every vertex
  mesh.frustumCulled = false;
  const anim = new ChopperAnim(rig);
  anim.snap('sit');
  anim.update(0, { speed: 0, turn: 0, clip: 'sit', clipTime: 0, wag: 0.3, look: null, barkAge: 99, pant: 0, reduced: false });
  return {
    mesh,
    rig,
    anim,
    uniforms,
    shells,
    dispose() {
      material.dispose();
      (caster?.material as MeshBasicMaterial | undefined)?.dispose();
      rig.skeleton.dispose();
      if (opts.ownGeometry) releaseChopperGeometry(shells);
    },
  };
}
