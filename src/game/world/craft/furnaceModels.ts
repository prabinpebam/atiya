/**
 * The furnace behind the workyard and the clay beds on the banks (docs: furnace.md §4.3, §4.4),
 * built with the geometry kit: vertex-coloured parts merged into one mesh per layer, with the
 * surfaces' painted detail (masonry, clay daub, brick, iron, wood).
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry, EdgesGeometry, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, smoothBlob, type KitGeometry } from '../kit';
import type { Box } from '../groundPads';
import { shade } from '../parts';
import type { ClayBed } from './clay';

/** Its proportions (u): the plinth, the clay drum and dome, the mouth, the chimney. */
export const FURNACE = { plinthW: 1.12, plinthD: 1.0, plinthH: 0.2, r: 0.44, drumH: 0.42, domeK: 0.78, mouthW: 0.34, mouthH: 0.36, chimney: { z: -0.24, w: 0.24, top: 1.52 } } as const;
/** The pad under it (in its frame: x0, x1, z0, z1), with the firewood at its side. */
export const FURNACE_BASE: Box = [-0.62, 0.78, -0.56, 0.66];

const CLAY_DAUB = '#c99a6b';
const BLOCK = '#b8b2a6';
const BRICK = '#b5654a';
const IRON = '#3f434b';
const SOOT = '#1b120c';

/** The mouth's arched outline (x, y from its sill), counter-clockwise, `inset` smaller all round. */
function archOutline(inset = 0): [number, number][] {
  const w = FURNACE.mouthW / 2 - inset;
  const h = FURNACE.mouthH - inset;
  const pts: [number, number][] = [
    [-w, 0],
    [w, 0],
  ];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    pts.push([Math.cos(a) * w, h - w + Math.sin(a) * w]);
  }
  return pts;
}

/** Where the mouth's sill is (y), and how far forward its face stands (z). */
export const MOUTH = { y: FURNACE.plinthH + 0.02, z: FURNACE.r + 0.045 } as const;

/**
 * The furnace: a plinth of cut stone blocks with a hearth step, a clay-daubed drum and dome with an
 * arched mouth in a stone surround, iron doors hinged open, a brick chimney at the back, split
 * firewood stacked at its side and a stone block with an iron ingot on the plinth.
 */
export function furnaceModel(): KitGeometry {
  const k = new Kit();
  const F = FURNACE;
  const y0 = F.plinthH;
  k.surface('stone', () => {
    k.box([F.plinthW, F.plinthH, F.plinthD], BLOCK, { p: [0, F.plinthH / 2, 0] }, 0.03);
    // the hearth step in front of the mouth
    k.box([0.6, 0.09, 0.2], shade(BLOCK, -0.06), { p: [0, 0.045, F.plinthD / 2 + 0.09] }, 0.02);
  });
  // the clay drum and dome (a hemisphere, squashed a little)
  k.surface('plaster', () => {
    k.cyl(F.r, F.r + 0.045, F.drumH, CLAY_DAUB, { p: [0, y0 + F.drumH / 2, 0] }, 22);
    k.sphere(F.r, shade(CLAY_DAUB, 0.05), { p: [0, y0 + F.drumH, 0], s: [1, F.domeK, 1] }, [22, 8], 'solid', [0, Math.PI * 2, 0, Math.PI / 2]);
    // a daubed ring where the dome meets the drum
    k.torus(F.r + 0.005, 0.03, shade(CLAY_DAUB, -0.08), { p: [0, y0 + F.drumH, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [5, 24]);
  });
  // the mouth: sooty inside, in a stone surround with a keystone
  const mw = F.mouthW / 2;
  const springY = MOUTH.y + F.mouthH - mw;
  k.extrude(archOutline(), 0.03, SOOT, { p: [0, MOUTH.y, MOUTH.z - 0.015] }, 0.004);
  // two charred logs on the sill, crossed, in front of the fire (FIRE_Z), so it burns behind them
  k.surface('wood', () => {
    for (const s of [-1, 1]) k.cyl(0.024, 0.026, 0.21, s < 0 ? '#3a2418' : '#2e1d14', { p: [s * 0.025, MOUTH.y + 0.03 + (s > 0 ? 0.02 : 0), MOUTH.z + 0.045], r: [0, s * 0.25, Math.PI / 2] }, 7);
  });
  k.surface('stone', () => {
    k.torus(mw + 0.045, 0.05, shade(BLOCK, -0.1), { p: [0, springY, MOUTH.z] }, Math.PI, [5, 12]);
    for (const s of [-1, 1]) k.box([0.1, springY - MOUTH.y + 0.02, 0.1], shade(BLOCK, -0.1), { p: [s * (mw + 0.045), MOUTH.y + (springY - MOUTH.y) / 2 - 0.01, MOUTH.z] }, 0.015);
    k.box([0.1, 0.1, 0.11], shade(BLOCK, -0.16), { p: [0, springY + mw + 0.05, MOUTH.z + 0.005] }, 0.015);
  });
  // the iron doors, swung open on their hinges at the jambs
  k.surface('metal', () => {
    for (const s of [-1, 1]) {
      const hinge = new Vector3(s * (mw + 0.1), 0, MOUTH.z + 0.04);
      const a = s * 1.15;
      const cx = hinge.x + s * Math.cos(a) * 0.09;
      const cz = hinge.z + Math.abs(Math.sin(a)) * 0.09;
      k.box([0.18, F.mouthH * 0.78, 0.02], IRON, { p: [cx, MOUTH.y + F.mouthH * 0.4, cz], r: [0, -a, 0] }, 0.006);
      k.cyl(0.012, 0.012, F.mouthH * 0.8, shade(IRON, -0.2), { p: [hinge.x, MOUTH.y + F.mouthH * 0.4, hinge.z] }, 6);
    }
  });
  // the chimney: brick, from the dome's back to above it, with a cap
  const c = F.chimney;
  const cy0 = y0 + F.drumH + 0.05;
  k.surface('brick', () => {
    k.box([c.w, c.top - cy0, c.w], BRICK, { p: [0, (c.top + cy0) / 2, c.z] }, 0.02);
  });
  k.surface('stone', () => k.box([c.w + 0.07, 0.05, c.w + 0.07], shade(BLOCK, -0.12), { p: [0, c.top + 0.02, c.z] }, 0.015));
  k.box([c.w - 0.08, 0.02, c.w - 0.08], SOOT, { p: [0, c.top + 0.045, c.z] }, 0.004);
  // split firewood stacked against its side, on the ground
  k.surface('wood', () => {
    const logs: [number, number, number][] = [
      [0.62, 0.06, -0.14],
      [0.62, 0.06, 0.02],
      [0.62, 0.06, 0.18],
      [0.62, 0.17, -0.06],
      [0.62, 0.17, 0.1],
      [0.61, 0.27, 0.02],
    ];
    logs.forEach(([x, y, z], i) => k.cyl(0.055, 0.06, 0.46, i % 2 ? '#a0713f' : '#b3824d', { p: [x, y, z], r: [Math.PI / 2, 0, 0.04 * (i - 2)] }, 7));
  });
  // a stone block on the plinth's corner, an ingot on it
  k.surface('stone', () => k.box([0.16, 0.14, 0.16], shade(BLOCK, 0.04), { p: [-0.43, y0 + 0.07, 0.34] }, 0.02));
  k.surface('metal', () => k.box([0.11, 0.035, 0.06], '#95a1ad', { p: [-0.43, y0 + 0.158, 0.34], r: [0, 0.4, 0] }, 0.008));
  return k.build();
}

/**
 * How far in front of the mouth's face the fire is drawn: clear of the soot's bevel (0.004), which it
 * used to share a plane with (the two flickered through each other), and behind the logs.
 */
export const FIRE_Z = MOUTH.z + 0.012;

/** The fire in its mouth: an arch in front of the soot (drawn with its own glowing material). */
export function fireGeometry(): BufferGeometry {
  // a fan from a hot core low in the mouth out to its arched rim: yellow-orange in the middle, deep red at the edge
  const w = FURNACE.mouthW / 2 - 0.03;
  const rim = archOutline(0.03);
  const bottom: [number, number][] = [-0.5, 0, 0.5].map((f) => [f * w, 0]);
  const pts = [rim[0], ...bottom, ...rim.slice(1)];
  const core: [number, number] = [0, (FURNACE.mouthH - 0.03) * 0.3];
  const pos = [core[0], core[1], 0, ...pts.flatMap(([x, y]) => [x, y, 0])];
  const col = [1, 0.7, 0.2, ...pts.flatMap(([, y]) => (y < 0.01 ? [1, 0.4, 0.06] : [0.8, 0.13, 0.02]))];
  const idx: number[] = [];
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g.translate(0, MOUTH.y + 0.01, FIRE_Z);
}

/** The ghost: the furnace's silhouette as a solid (the faint fill) and its edges (the outline). */
export function furnaceGhost(): { fill: BufferGeometry; edges: BufferGeometry } {
  const F = FURNACE;
  const y0 = F.plinthH;
  const parts = [
    new BoxGeometry(F.plinthW, F.plinthH, F.plinthD).translate(0, F.plinthH / 2, 0),
    new CylinderGeometry(F.r, F.r + 0.045, F.drumH, 16, 1).translate(0, y0 + F.drumH / 2, 0),
    new SphereGeometry(F.r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, F.domeK, 1).translate(0, y0 + F.drumH, 0),
    new BoxGeometry(F.chimney.w, F.chimney.top - y0 - F.drumH, F.chimney.w).translate(0, (F.chimney.top + y0 + F.drumH) / 2, F.chimney.z),
  ].map((g) => g.toNonIndexed());
  for (const g of parts) g.deleteAttribute('uv');
  const fill = mergeGeometries(parts, false);
  return { fill, edges: new EdgesGeometry(fill, 30) };
}

/** The clay's colours: a soft warm grey, darker where it's wet, and the lumps' paler, glossy grey (the item's icon). */
export const CLAY_COLOURS = { bed: '#a39c92', wet: '#827b72', lump: '#b5aa9c' } as const;

/**
 * The clay beds, all in one mesh (planet-local): each a flattened, lobed patch of grey clay on
 * the bank, tilted to the ground, with a darker wet middle, scoop marks and a little wooden paddle
 * pushed into its back edge. `tilt` gives each bed's up (the ground's normal there).
 */
export function clayBedsModel(beds: readonly ClayBed[], place: (b: ClayBed) => { p: Vector3; q: Quaternion }): KitGeometry {
  const k = new Kit();
  beds.forEach((b, i) => {
    const { p, q } = place(b);
    k.group({ p: [p.x, p.y, p.z], q }, () => {
      k.blob(0.28, CLAY_COLOURS.bed, { p: [0, 0, 0], s: [1.15, 0.1, 0.92] }, 2, 'solid', 0.2, 11 + i * 7);
      k.blob(0.19, CLAY_COLOURS.wet, { p: [0.03, 0.012, 0.05], s: [1, 0.08, 0.85] }, 2, 'solid', 0.25, 12 + i * 7);
      for (let s = 0; s < 3; s++) k.sphere(0.045, shade(CLAY_COLOURS.wet, -0.12), { p: [-0.12 + s * 0.11, 0.016, 0.13 - (s % 2) * 0.05], s: [1.3, 0.18, 0.7], r: [0, 0.3 * s, 0] }, [8, 4]);
      k.surface('wood', () => {
        k.box([0.035, 0.26, 0.012], '#a8743f', { p: [-0.18, 0.1, -0.2], r: [0.25, 0.4, -0.2] }, 0.004);
        k.box([0.08, 0.1, 0.012], '#b8844d', { p: [-0.2, -0.02, -0.19], r: [0.25, 0.4, -0.2] }, 0.004);
      });
    });
  });
  return k.build();
}

/** A clay lump (instanced: three to a bed, swelling back as it refills). */
export function clayLumpGeometry(): BufferGeometry {
  const g = smoothBlob(0.06, 2, 0.12, 5).scale(1, 0.7, 1);
  g.computeVertexNormals();
  return g;
}

/** Where a bed's three lumps sit, in its frame. */
export const LUMPS: ReadonlyArray<[number, number, number, number]> = [
  [0.02, 0.025, -0.02, 1],
  [0.13, 0.02, 0.04, 0.8],
  [-0.08, 0.02, 0.08, 0.7],
];

const _m = new Matrix4();
/** A bed's frame: on the ground at `n` (its up the ground's normal), its front toward the water. */
export function bedFrame(n: Vector3, up: Vector3, facing: Vector3, radius: number): { p: Vector3; q: Quaternion } {
  const z = facing.clone().addScaledVector(up, -facing.dot(up)).normalize();
  const x = new Vector3().crossVectors(up, z).normalize();
  return { p: n.clone().multiplyScalar(radius), q: new Quaternion().setFromRotationMatrix(_m.makeBasis(x, up, z)) };
}
