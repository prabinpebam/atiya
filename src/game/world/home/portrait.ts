/**
 * The family's talking heads (family.md §6): a head-and-shoulders portrait of one of them, rendered from
 * their model as it stands in the game (skin, hair, glasses), on a transparent background. Rendered by
 * `scripts/render-npc-portraits.mjs` into `public/avatars/npc/<id>.webp` (the talk box and the page's
 * welcome show those files); not at runtime.
 */
import { Box3, Color, DirectionalLight, FloatType, HemisphereLight, Object3D, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderTarget, type Mesh, type SkinnedMesh, type WebGLRenderer } from 'three';
import type { NpcId } from './family';

/**
 * Each one's figure (the root of their drawn model), head bone, the body's pivot (sunk to a seat or laid
 * down) and each bone with its pose as the clips left it (so the portrait is them standing, as in their
 * idle, whatever they're doing): FamilyView registers them while they're drawn.
 */
export const PORTRAIT_RIGS = new Map<NpcId, { root: Object3D; head: Object3D; pivot: Object3D; bones: ReadonlyArray<readonly [Object3D, Quaternion]> }>();

const isUnder = (o: Object3D, a: Object3D): boolean => {
  for (let p = o.parent; p; p = p.parent) if (p === a) return true;
  return false;
};

/** Khronos PBR Neutral, the game's tone mapping (one channel set at a time). */
function neutral(c: [number, number, number]): [number, number, number] {
  const x = Math.min(c[0], c[1], c[2]);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let [r, g, b] = [c[0] - offset, c[1] - offset, c[2] - offset];
  const peak = Math.max(r, g, b);
  const start = 0.76;
  if (peak < start) return [r, g, b];
  const d = 1 - start;
  const np = 1 - (d * d) / (peak + d - start);
  r *= np / peak;
  g *= np / peak;
  b *= np / peak;
  const k = 1 - 1 / (0.15 * (peak - np) + 1);
  return [r + (np - r) * k, g + (np - g) * k, b + (np - b) * k];
}
const srgb = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
};

/**
 * Renders `id`'s portrait (`size` px square, drawn at twice that and averaged down) and returns it as a
 * WebP data URL, or null if they aren't drawn. Their figure is lent to a little studio scene (a warm key
 * light, a cool fill, a sky-and-grass ambient) for the one render, turned three-quarters to the camera,
 * and put straight back.
 */
export function renderPortrait(gl: WebGLRenderer, id: NpcId, size = 192): string | null {
  const rig = PORTRAIT_RIGS.get(id);
  const parent = rig?.root.parent;
  if (!rig || !parent) return null;
  const { root, head, pivot, bones } = rig;
  const keep = { p: root.position.clone(), q: root.quaternion.clone(), visible: root.visible, index: parent.children.indexOf(root) };
  const posed = bones.map(([b]) => b.quaternion.clone());
  const pv = { p: pivot.position.clone(), q: pivot.quaternion.clone() };
  const hidden: Object3D[] = [];
  const studio = new Scene();
  studio.add(new HemisphereLight(0xfff4e6, 0x8a9c7a, 2.1));
  const key = new DirectionalLight(0xfff1dc, 2.6);
  key.position.set(1.5, 5, 6);
  const fill = new DirectionalLight(0xe8f0ff, 0.7);
  fill.position.set(-4, 2, 5);
  studio.add(key, fill);
  const px = size * 2;
  const target = new WebGLRenderTarget(px, px, { type: FloatType });
  const prev = { target: gl.getRenderTarget(), alpha: gl.getClearAlpha(), color: gl.getClearColor(new Color()) };
  try {
    // standing in their idle, upright at the origin, facing +z
    studio.add(root);
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.visible = true;
    for (const [b, q] of bones) b.quaternion.copy(q);
    pivot.position.set(0, 0, 0);
    pivot.quaternion.identity();
    // just them: what they hold (a book, the guitar, a toy car) is put down for the picture; hair and glasses stay
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || (m as unknown as SkinnedMesh).isSkinnedMesh || isUnder(m, head) || !m.visible) return;
      hidden.push(m);
      m.visible = false;
    });
    studio.updateMatrixWorld(true);
    // (the body alone: what they hold, a toy car in the air, doesn't count)
    const box = new Box3();
    root.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && box.expandByObject(o, true));
    const neck = head.getWorldPosition(new Vector3());
    const top = box.max.y;
    const headH = Math.max(0.05, top - neck.y);
    // head and shoulders: from a little under the neck to just over the crown
    const aim = new Vector3(neck.x, neck.y + headH * 0.3, neck.z);
    const span = headH * 1.95;
    const camera = new PerspectiveCamera(26, 1, 0.01, 50);
    const d = span / 2 / Math.tan((13 * Math.PI) / 180);
    camera.position.copy(aim).add(new Vector3(0, 0.06, 1).normalize().applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5)).multiplyScalar(d));
    camera.lookAt(aim);
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(studio, camera);
    const buf = new Float32Array(px * px * 4);
    gl.readRenderTargetPixels(target, 0, 0, px, px, buf);
    // tone-mapped and encoded as the game's frame is, averaged 2 × 2, top row first
    const out = new ImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const i = ((px - 1 - (y * 2 + dy)) * px + x * 2 + dx) * 4;
          const w = Math.min(1, Math.max(0, buf[i + 3]));
          r += buf[i] * w;
          g += buf[i + 1] * w;
          b += buf[i + 2] * w;
          a += w;
        }
        const o = (y * size + x) * 4;
        if (a <= 0) continue;
        const c = neutral([r / a, g / a, b / a]);
        out.data[o] = srgb(c[0]);
        out.data[o + 1] = srgb(c[1]);
        out.data[o + 2] = srgb(c[2]);
        out.data[o + 3] = Math.round((a / 4) * 255);
      }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d')!.putImageData(out, 0, 0);
    return canvas.toDataURL('image/webp', 0.92);
  } finally {
    for (const m of hidden) m.visible = true;
    bones.forEach(([b], i) => b.quaternion.copy(posed[i]));
    pivot.position.copy(pv.p);
    pivot.quaternion.copy(pv.q);
    root.position.copy(keep.p);
    root.quaternion.copy(keep.q);
    root.visible = keep.visible;
    parent.add(root);
    // (back in its place among its siblings)
    parent.children.splice(parent.children.indexOf(root), 1);
    parent.children.splice(keep.index, 0, root);
    gl.setRenderTarget(prev.target);
    gl.setClearColor(prev.color, prev.alpha);
    target.dispose();
  }
}
