import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { Kit, indexExact } from '../../src/game/world/kit';
import { hardwood } from '../../src/game/world/foliage';

/** Every attribute of a geometry, expanded to plain triangles. */
function expanded(g: BufferGeometry): Record<string, number[]> {
  const flat = g.index ? g.toNonIndexed() : g;
  return Object.fromEntries(Object.keys(flat.attributes).map((n) => [n, Array.from(flat.getAttribute(n).array)]));
}

describe('exact indexing', () => {
  it('is lossless: the same triangles with bit-identical attributes', () => {
    const k = new Kit();
    k.box([1, 2, 0.5], '#c9493f');
    k.surface('wood', () => k.cyl(0.3, 0.3, 1.2, '#8a5a3c', { p: [1, 0, 0] }));
    k.blob(0.6, (p) => (p.y > 0 ? '#ffffff' : '#223344'), { p: [0, 2, 0] }, 2);
    k.surface('roof', () => k.cone(0.8, 0.6, '#3f6fb5', { p: [0, 3, 0], r: [0.2, 0, 0.1] }));
    const built = k.build().solid!;
    expect(built.index).not.toBeNull();
    // round trip: plain triangles → exact index → plain triangles again, bit for bit
    const plain = built.toNonIndexed();
    const again = indexExact(plain);
    expect(again.getAttribute('position').count).toBeLessThan(plain.getAttribute('position').count * 0.6);
    expect(expanded(again)).toEqual(expanded(plain));
  });

  it('shares vertices that are identical in every attribute, and only those', () => {
    const g = new BufferGeometry();
    // two triangles sharing an edge (a–c), plus a third whose shared corner differs in colour
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -1, 0, 0], 3));
    g.setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], 3));
    const out = indexExact(g);
    expect(out.getAttribute('position').count).toBe(6); // 9 → 6: a and c shared once, the black copy of a kept
    expect(out.index!.count).toBe(9);
    expect(expanded(out)).toEqual(expanded(g));
  });

  it('cuts the vertex count of a smooth part (a box keeps its hard edges)', () => {
    const box = indexExact(new BoxGeometry(1, 1, 1).toNonIndexed());
    expect(box.getAttribute('position').count).toBe(24); // 36 → 24: faces share nothing across the edges
    const tree = hardwood();
    const verts = tree.solid.getAttribute('position').count;
    const tris = tree.solid.index!.count / 3;
    expect(verts / (tris * 3)).toBeLessThan(0.6);
    expect(tree.leaves.index).not.toBeNull();
    expect(tree.leaves.getAttribute('position').count / (tree.leaves.index!.count / 3)).toBeCloseTo(2, 5); // 4 corners per 2-triangle card
  });
});
