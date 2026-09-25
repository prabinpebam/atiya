import { describe, expect, it } from 'vitest';
import {
  Bone,
  BoxGeometry,
  CustomBlending,
  Group,
  GreaterDepth,
  Mesh,
  MeshBasicMaterial,
  Skeleton,
  SkinnedMesh,
} from 'three';
import { OUTLINE, addOcclusionOutline, countOutlines, outlineMaterial } from '../../src/game/player/outline';

function character() {
  const root = new Group();
  const head = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const bone = new Bone();
  const body = new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial());
  body.add(bone);
  body.bind(new Skeleton([bone]));
  root.add(head, body);
  return { root, head, body };
}

describe('occlusion outline', () => {
  it('draws only where scenery is nearer, without writing depth, in the opaque pass', () => {
    const m = outlineMaterial();
    expect(m.depthFunc).toBe(GreaterDepth);
    expect(m.depthTest).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(false);
    expect(m.blending).toBe(CustomBlending);
    expect(outlineMaterial()).toBe(m);
  });

  it('is skinning-aware and uses a Fresnel rim', () => {
    const m = outlineMaterial();
    expect(m.vertexShader).toContain('#include <skinning_vertex>');
    expect(m.vertexShader).toContain('uPull');
    expect(m.fragmentShader).toContain('pow(clamp(1.0 - abs(dot(');
  });

  it('adds a twin per mesh that shares geometry (and skeleton for skinned meshes)', () => {
    const { root, head, body } = character();
    addOcclusionOutline(root);
    expect(countOutlines(root)).toBe(2);
    const ht = head.userData.outline as Mesh;
    const bt = body.userData.outline as SkinnedMesh;
    expect(ht.parent).toBe(head);
    expect(ht.geometry).toBe(head.geometry);
    expect(bt.isSkinnedMesh).toBe(true);
    expect(bt.geometry).toBe(body.geometry);
    expect(bt.skeleton).toBe(body.skeleton);
    expect(bt.bindMode).toBe(body.bindMode);
  });

  it('draws twins after the scenery and before the character', () => {
    const { root, head, body } = character();
    addOcclusionOutline(root);
    expect(OUTLINE.order).toBeGreaterThan(0);
    expect(OUTLINE.characterOrder).toBeGreaterThan(OUTLINE.order);
    expect((head.userData.outline as Mesh).renderOrder).toBe(OUTLINE.order);
    expect(head.renderOrder).toBe(OUTLINE.characterOrder);
    expect(body.renderOrder).toBe(OUTLINE.characterOrder);
  });

  it('does not add twins twice, or outline the twins', () => {
    const { root } = character();
    addOcclusionOutline(root);
    addOcclusionOutline(root);
    expect(countOutlines(root)).toBe(2);
  });

  it('removes the twins and restores the render order', () => {
    const { root, head } = character();
    head.renderOrder = 5;
    const remove = addOcclusionOutline(root);
    remove();
    expect(countOutlines(root)).toBe(0);
    expect(head.renderOrder).toBe(5);
    expect(head.userData.outline).toBeUndefined();
  });
});
