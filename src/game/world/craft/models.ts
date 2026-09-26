/**
 * The crafting chunk's models (docs: crafting.md §4.2, §4.3), built with the geometry kit so each
 * part carries its painted surface. Local frames: +z is the front, +y up, the base on y = 0.
 */
import { BufferGeometry, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, type KitGeometry } from '../kit';
import { ARCH, shade } from '../parts';

const WOOD = '#c08a55';
const WOOD_LIGHT = '#d8ab74';
const WOOD_DARK = '#8a5a36';
const STEEL = '#aeb4bc';
const IRON = '#4a4f5a';

/** Crafting table proportions (u). */
export const TABLE = { w: 1.04, d: 0.54, h: 0.52, top: 0.08 } as const;

/** A sturdy workbench with its tools laid out: vise, saw, hammer, chisel, square, pencil, clamps, toolbox and shavings. */
export function craftingTableModel(): KitGeometry {
  const k = new Kit();
  const { w: W, d: D, h: H, top: T } = TABLE;
  const y0 = H - T / 2;
  k.surface('wood', () => {
    // a butcher-block top: five boards, alternating tones
    for (let i = 0; i < 5; i++) {
      const z = -D / 2 + (D / 5) * (i + 0.5);
      k.box([W, T, D / 5 - 0.006], i % 2 ? WOOD : WOOD_LIGHT, { p: [0, y0, z] }, 0.012);
    }
    // legs, splayed a touch, with an apron and stretchers
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) k.box([0.08, H - T, 0.08], WOOD_DARK, { p: [sx * (W / 2 - 0.08), (H - T) / 2, sz * (D / 2 - 0.07)], r: [sz * 0.03, 0, -sx * 0.03] }, 0.015);
    for (const sz of [-1, 1]) k.box([W - 0.16, 0.07, 0.03], shade(WOOD_DARK, 0.08), { p: [0, H - T - 0.05, sz * (D / 2 - 0.06)] }, 0.01);
    for (const sx of [-1, 1]) k.box([0.03, 0.05, D - 0.16], shade(WOOD_DARK, 0.05), { p: [sx * (W / 2 - 0.08), 0.12, 0] }, 0.01);
    // the lower shelf, with spare planks and a log on it
    k.box([W - 0.2, 0.025, D - 0.2], WOOD, { p: [0, 0.15, 0] }, 0.006);
    for (let i = 0; i < 3; i++) k.box([0.62, 0.025, 0.1], i % 2 ? WOOD_LIGHT : '#e3bd88', { p: [-0.06 + i * 0.02, 0.177 + i * 0.026, -0.06 + i * 0.012], r: [0, 0.04 * (i - 1), 0] }, 0.006);
    k.cyl(0.065, 0.065, 0.38, '#9a6a44', { p: [0.2, 0.235, 0.1], r: [0, 0.3, Math.PI / 2] }, 9);
    k.cyl(0.058, 0.058, 0.005, '#e8c79a', { p: [0.2 + Math.cos(0.3) * 0.19, 0.235, 0.1 - Math.sin(0.3) * 0.19], r: [0, 0.3, Math.PI / 2] }, 9);
    // a back rail with pegs, a mallet and a hand drill hanging from it
    for (const sx of [-1, 1]) k.box([0.05, 0.36, 0.05], WOOD_DARK, { p: [sx * (W / 2 - 0.1), H + 0.18, -D / 2 + 0.04] }, 0.012);
    k.box([W - 0.14, 0.05, 0.04], WOOD_DARK, { p: [0, H + 0.33, -D / 2 + 0.04] }, 0.012);
    for (const x of [-0.24, 0.02, 0.26]) k.cyl(0.012, 0.012, 0.06, WOOD_LIGHT, { p: [x, H + 0.3, -D / 2 + 0.08], r: [Math.PI / 2, 0, 0] }, 6);
    // the mallet
    k.cyl(0.013, 0.013, 0.2, WOOD_LIGHT, { p: [-0.24, H + 0.2, -D / 2 + 0.1] }, 6);
    k.box([0.12, 0.07, 0.07], shade(WOOD, -0.1), { p: [-0.24, H + 0.1, -D / 2 + 0.1] }, 0.015);
  });
  // the hand drill (brace): an iron crank on a wooden head and knob
  k.surface('metal', () => {
    k.cyl(0.008, 0.008, 0.16, IRON, { p: [0.02, H + 0.2, -D / 2 + 0.1] }, 6);
    k.box([0.07, 0.008, 0.008], IRON, { p: [0.055, H + 0.2, -D / 2 + 0.1] }, 0.002);
    k.cyl(0.004, 0.004, 0.06, STEEL, { p: [0.02, H + 0.09, -D / 2 + 0.1] }, 5);
  });
  k.surface('wood', () => {
    k.sphere(0.022, '#7a4a2c', { p: [0.02, H + 0.285, -D / 2 + 0.1] }, [8, 6]);
    k.cyl(0.014, 0.014, 0.03, '#e2b267', { p: [0.09, H + 0.2, -D / 2 + 0.1] }, 6);
  });
  // a coil of rope on the third peg
  k.surface('canvas', () => k.torus(0.07, 0.014, '#cdb489', { p: [0.26, H + 0.24, -D / 2 + 0.09] }, Math.PI * 2, [6, 16]));

  // the front vise: a wooden jaw on an iron screw with a sliding handle
  const vx = -W / 2 + 0.2;
  k.surface('wood', () => k.box([0.2, 0.12, 0.05], WOOD_DARK, { p: [vx, y0 - 0.03, D / 2 + 0.05] }, 0.012));
  k.surface('metal', () => {
    k.cyl(0.014, 0.014, 0.12, IRON, { p: [vx, y0 - 0.03, D / 2 + 0.1], r: [Math.PI / 2, 0, 0] }, 8);
    k.cyl(0.008, 0.008, 0.2, STEEL, { p: [vx, y0 - 0.03, D / 2 + 0.15], r: [0, 0, Math.PI / 2] }, 6);
    for (const s of [-1, 1]) k.sphere(0.014, IRON, { p: [vx + s * 0.1, y0 - 0.03, D / 2 + 0.15] }, [6, 5]);
    for (const s of [-1, 1]) k.cyl(0.008, 0.008, 0.12, IRON, { p: [vx + s * 0.075, y0 - 0.03, D / 2 + 0.0], r: [Math.PI / 2, 0, 0] }, 6);
  });
  // a plank held in the vise
  k.surface('wood', () => k.box([0.03, 0.1, 0.34], '#e3bd88', { p: [vx - 0.02, y0 + 0.06, D / 2 - 0.1] }, 0.006));

  const ty = H + 0.002;
  // the saw: a steel blade with teeth down one edge and a wooden grip
  k.surface('metal', () => {
    k.extrude(
      [
        [0, 0],
        [0.4, 0.02],
        [0.4, 0.08],
        [0, 0.12],
      ],
      0.004,
      STEEL,
      { p: [0.02, ty + 0.004, -0.08], r: [-Math.PI / 2, 0, 0.12] },
      0,
    );
  });
  k.surface('wood', () => k.box([0.1, 0.02, 0.1], '#a24f32', { p: [0.46, ty + 0.012, -0.1], r: [0, 0.12, 0] }, 0.012));
  // the hammer: an iron head on an ash handle
  k.surface('wood', () => k.cyl(0.013, 0.015, 0.26, '#e2b267', { p: [0.3, ty + 0.015, 0.14], r: [0, 0.5, Math.PI / 2] }, 7));
  k.surface('metal', () => {
    k.box([0.05, 0.035, 0.12], IRON, { p: [0.19, ty + 0.02, 0.2], r: [0, 0.5, 0] }, 0.006);
    k.box([0.03, 0.03, 0.03], shade(IRON, 0.1), { p: [0.16, ty + 0.02, 0.25], r: [0, 0.5, 0] }, 0.004);
  });
  // the chisel
  k.surface('wood', () => k.cyl(0.013, 0.011, 0.09, '#b0512f', { p: [-0.06, ty + 0.014, 0.17], r: [0, -0.3, Math.PI / 2] }, 7));
  k.surface('metal', () => k.box([0.1, 0.006, 0.022], STEEL, { p: [-0.155, ty + 0.006, 0.2], r: [0, -0.3, 0] }, 0.002));
  // the try-square: a rosewood stock and a steel blade
  k.surface('wood', () => k.box([0.03, 0.02, 0.14], '#6e3b24', { p: [-0.1, ty + 0.01, -0.12] }, 0.005));
  k.surface('metal', () => k.box([0.2, 0.004, 0.028], STEEL, { p: [-0.2, ty + 0.004, -0.18] }, 0.001));
  // a pencil
  k.cyl(0.007, 0.007, 0.1, '#f2c14e', { p: [0.02, ty + 0.007, 0.06], r: [0, 1.1, Math.PI / 2] }, 6);
  k.cone(0.007, 0.02, '#e6c9a0', { p: [0.066, ty + 0.007, 0.036], r: [0, 1.1, -Math.PI / 2] }, 6);
  // two C-clamps on the right edge
  k.surface('metal', () => {
    for (const z of [-0.14, 0.1]) {
      k.torus(0.05, 0.011, '#d9483f', { p: [W / 2 - 0.02, y0, z], r: [0, Math.PI / 2, 0] }, Math.PI * 1.25, [5, 12]);
      k.cyl(0.006, 0.006, 0.1, STEEL, { p: [W / 2 - 0.02, y0 - 0.05, z] }, 5);
      k.box([0.07, 0.01, 0.01], STEEL, { p: [W / 2 - 0.02, y0 - 0.1, z] }, 0.002);
    }
  });
  // the toolbox at the back, a screwdriver and a folding rule sticking out
  k.surface('wood', () => {
    k.box([0.3, 0.1, 0.14], '#3f7fb8', { p: [-0.3, ty + 0.05, -D / 2 + 0.16] }, 0.012);
    for (const s of [-1, 1]) k.box([0.015, 0.1, 0.015], '#2f5f8a', { p: [-0.3 + s * 0.12, ty + 0.14, -D / 2 + 0.16] }, 0.004);
    k.cyl(0.008, 0.008, 0.26, WOOD_LIGHT, { p: [-0.3, ty + 0.19, -D / 2 + 0.16], r: [0, 0, Math.PI / 2] }, 6);
    k.cyl(0.012, 0.01, 0.06, '#f2c14e', { p: [-0.36, ty + 0.13, -D / 2 + 0.14], r: [0.3, 0, 0.2] }, 6);
    k.box([0.02, 0.1, 0.012], '#f6e2a8', { p: [-0.22, ty + 0.12, -D / 2 + 0.18], r: [0, 0, -0.25] }, 0.003);
  });
  // shavings: pale curls on the top and on the ground
  const curl = (p: [number, number, number], a: number) => k.torus(0.022, 0.006, '#f0d3a4', { p, r: [Math.PI / 2 + 0.3, a, 0] }, Math.PI * 1.5, [4, 9]);
  k.surface('wood', () => {
    curl([-0.28, ty + 0.01, 0.08], 0.4);
    curl([-0.33, ty + 0.01, 0.12], 1.9);
    curl([-0.24, ty + 0.01, 0.15], 3.1);
    curl([-0.3, 0.01, D / 2 + 0.12], 0.8);
    curl([-0.18, 0.01, D / 2 + 0.2], 2.4);
    curl([0.1, 0.01, D / 2 + 0.16], 4.2);
    curl([-0.42, 0.01, D / 2 + 0.05], 5.3);
  });
  return k.build();
}

/**
 * Chopper's house (u), at his scale (he's 1.25× life size, about 0.6 u to the top of his head): the
 * body's width, depth and wall height, the roof's rise, the stone base, and the arched doorway he
 * walks through upright (prabin-npc.md §4.5).
 */
export const DOGHOUSE = { w: 0.96, d: 1.08, h: 0.62, rise: 0.42, base: 0.1, door: { w: 0.42, h: 0.56 } } as const;

/** 3 × 5 pixel letters for the name plaque. */
const GLYPHS: Record<string, string[]> = {
  C: ['###', '#..', '#..', '#..', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  E: ['###', '#..', '###', '#..', '###'],
  R: ['###', '#.#', '##.', '#.#', '#.#'],
};

/** Where the lantern hangs inside (house-local), for its lamp. */
export const DOGHOUSE_LANTERN: [number, number, number] = [0, DOGHOUSE.base + DOGHOUSE.h + DOGHOUSE.rise - 0.2, -0.12];

/**
 * Chopper's house: a stone-slab base, plank walls with beam corners, a painted gabled roof and trim,
 * an arched doorway, and inside a plank floor, a padded bed, a bone toy, a blanket and a lantern
 * hanging from the ridge; over the door a bone-shaped plaque with his name, and his bowl outside.
 */
export function dogHouseModel(roof: string): KitGeometry {
  const k = new Kit();
  const { w: W, d: D, h: H, rise, base: B, door } = DOGHOUSE;
  const y1 = B + H;
  const T = 0.04;
  // two stone slabs for a base
  k.surface('stone', () => {
    for (const s of [-1, 1]) k.box([W + 0.16, B, (D + 0.2) / 2 - 0.01], s > 0 ? ARCH.stone : shade(ARCH.stone, -0.06), { p: [0, B / 2, (s * (D + 0.2)) / 4] }, 0.02);
  });
  const archY = B + door.h - door.w / 2;
  k.surface('wood', () => {
    // plank walls: horizontal boards on the back and sides, the front round the doorway
    const boards = 7;
    const bh = H / boards;
    for (let i = 0; i < boards; i++) {
      const y = B + bh * (i + 0.5);
      const tone = i % 2 ? '#d7a86f' : '#cf9d63';
      k.box([W, bh - 0.008, T], tone, { p: [0, y, -D / 2 + T / 2] }, 0.008);
      for (const s of [-1, 1]) k.box([T, bh - 0.008, D - 0.04], shade(tone, -0.05), { p: [s * (W / 2 - T / 2), y, 0] }, 0.008);
      // the front wall's board seams (the wall itself is one piece with the arched doorway cut out, below)
      if (i > 0) {
        const sy = B + bh * i;
        const half = sy - B >= door.h ? 0 : sy <= archY ? door.w / 2 : Math.sqrt(Math.max(0, (door.w / 2) ** 2 - (sy - archY) ** 2));
        if (!half) k.box([W - 0.02, 0.008, 0.006], shade('#cf9d63', -0.3), { p: [0, sy, D / 2 + 0.001] }, 0.001);
        else {
          const len = W / 2 - half - 0.01;
          for (const s of [-1, 1]) k.box([len, 0.008, 0.006], shade('#cf9d63', -0.3), { p: [s * (half + len / 2), sy, D / 2 + 0.001] }, 0.001);
        }
      }
    }
    // the front wall: planks with an arched doorway (a hole in one extruded panel, so there are no gaps round the arch)
    const hw = door.w / 2;
    const panel = new Shape([new Vector2(-W / 2, 0), new Vector2(W / 2, 0), new Vector2(W / 2, H), new Vector2(-W / 2, H)]);
    const hole = new Path();
    hole.moveTo(-hw, 0);
    hole.lineTo(-hw, archY - B);
    hole.absarc(0, archY - B, hw, Math.PI, 0, true);
    hole.lineTo(hw, 0);
    hole.lineTo(-hw, 0);
    panel.holes.push(hole);
    k.add(new ExtrudeGeometry(panel, { depth: T, bevelEnabled: false, curveSegments: 16 }), '#d2a268', { p: [0, B, D / 2 - T] });
    // beam corner posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box([0.08, H + 0.02, 0.08], '#8f5f3a', { p: [sx * (W / 2 - 0.005), B + H / 2, sz * (D / 2 - 0.005)] }, 0.015);
    // the gable ends: plank triangles
    const tri: [number, number][] = [
      [-W / 2, 0],
      [W / 2, 0],
      [0, rise],
    ];
    for (const z of [D / 2 - 0.02, -D / 2 + 0.02]) k.extrude(tri, 0.035, '#d9ad76', { p: [0, y1, z] }, 0.004);
    // a ceiling under the roof, so the inside is a room (and the lantern's light stays in it)
    k.box([W - 2 * T, 0.02, D - 2 * T], '#b98356', { p: [0, y1 - 0.01, 0] }, 0.004);
    // inside: a plank floor
    for (let i = 0; i < 5; i++) k.box([(W - 2 * T) / 5 - 0.006, 0.016, D - 2 * T], i % 2 ? '#c8945c' : '#b9854f', { p: [-(W - 2 * T) / 2 + ((W - 2 * T) / 5) * (i + 0.5), B + 0.008, 0] }, 0.003);
  });
  // his bed: a padded ring with a soft cushion, a blanket over one side, and a bone toy
  k.surface('canvas', () => {
    k.torus(0.26, 0.07, '#6f9fc8', { p: [0, B + 0.07, -0.12], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.8] }, Math.PI * 2, [8, 20]);
    k.cyl(0.24, 0.24, 0.05, '#dfe8f2', { p: [0, B + 0.04, -0.12] }, 20);
    k.box([0.3, 0.02, 0.22], '#e7a34a', { p: [0.2, B + 0.1, -0.3], r: [0.1, 0.5, -0.2] }, 0.01);
  });
  k.cyl(0.013, 0.013, 0.1, ARCH.white, { p: [0.28, B + 0.03, 0.22], r: [0, 0.6, Math.PI / 2] }, 6);
  for (const s of [-1, 1]) for (const t of [-1, 1]) k.sphere(0.018, ARCH.white, { p: [0.28 + s * 0.05 * Math.cos(0.6), B + 0.03 + t * 0.012, 0.22 - s * 0.05 * Math.sin(0.6)] }, [7, 5]);
  // the lantern, hung from the ridge on a cord
  const [lx, ly, lz] = DOGHOUSE_LANTERN;
  k.cyl(0.004, 0.004, y1 + rise - 0.05 - (ly + 0.06), '#3a3530', { p: [lx, (y1 + rise - 0.05 + ly + 0.06) / 2, lz] }, 4);
  k.surface('metal', () => {
    k.cyl(0.035, 0.045, 0.02, '#3a3f4b', { p: [lx, ly + 0.05, lz] }, 8);
    k.cyl(0.04, 0.04, 0.015, '#3a3f4b', { p: [lx, ly - 0.05, lz] }, 8);
  });
  k.cyl(0.03, 0.03, 0.08, ARCH.lit, { p: [lx, ly, lz] }, 10, 'glow');
  // the painted parts: roof panels with shingle rows, a ridge cap, the barge boards and the door's arch
  const oh = 0.1;
  const run = W / 2 + oh;
  const a = Math.atan2(rise, W / 2);
  const L = Math.hypot(run, rise * (run / (W / 2)));
  const depth = D + oh * 2;
  k.surface('roof', () => {
    for (const s of [-1, 1]) {
      k.box([L, 0.05, depth], shade(roof, -0.22), { p: [(s * run) / 2, y1 + rise - (rise * run) / (W / 2) / 2 + 0.01, 0], r: [0, 0, -s * a] }, 0.015);
      const rows = 4;
      for (let i = 0; i < rows; i++) {
        const t = (i + 0.5) / rows;
        k.box([L / rows + 0.03, 0.04, depth + 0.02], shade(roof, i % 2 ? -0.06 : 0.05), { p: [s * run * t, y1 + rise - ((rise * run) / (W / 2)) * t + 0.045, 0], r: [0, 0, -s * (a + 0.06)] }, 0.012);
      }
    }
    k.cyl(0.04, 0.04, depth + 0.03, shade(roof, -0.12), { p: [0, y1 + rise + 0.045, 0], r: [Math.PI / 2, 0, 0] }, 8);
  });
  k.surface('wood', () => {
    for (const s of [-1, 1]) k.box([Math.hypot(W / 2, rise) + 0.05, 0.06, 0.045], shade(roof, 0.12), { p: [(s * W) / 4, y1 + rise / 2 + 0.035, D / 2 + 0.012], r: [0, 0, -s * a] }, 0.012);
    k.torus(door.w / 2 + 0.025, 0.02, shade(roof, 0.12), { p: [0, archY, D / 2 + 0.006] }, Math.PI, [5, 16]);
    for (const s of [-1, 1]) k.box([0.04, archY - B, 0.04], shade(roof, 0.12), { p: [s * (door.w / 2 + 0.025), B + (archY - B) / 2, D / 2 + 0.006] }, 0.008);
    // the name plaque over the door: a bone-shaped board, his name in pale pixels
    k.box([0.4, 0.1, 0.02], '#8f5f3a', { p: [0, y1 + 0.11, D / 2 + 0.012] }, 0.01);
    for (const s of [-1, 1]) for (const t of [-1, 1]) k.sphere(0.034, '#8f5f3a', { p: [s * 0.2, y1 + 0.11 + t * 0.028, D / 2 + 0.012] }, [8, 6]);
  });
  const px = 0.0115;
  const word = 'CHOPPER';
  const width = (word.length * 4 - 1) * px;
  [...word].forEach((ch, li) => {
    GLYPHS[ch].forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === '#') k.box([px * 0.9, px * 0.9, 0.008], '#f6ead2', { p: [-width / 2 + (li * 4 + rx + 0.5) * px, y1 + 0.11 + (2 - ry) * px, D / 2 + 0.024] }, 0.001);
      });
    });
  });
  // his bowl, with kibble
  k.surface('metal', () =>
    k.lathe(
      [
        [0, 0],
        [0.08, 0],
        [0.095, 0.05],
        [0.085, 0.055],
        [0.07, 0.014],
        [0, 0.014],
      ],
      '#d9483f',
      { p: [W / 2 + 0.02, B, D / 2 + 0.24] },
      16,
    ),
  );
  for (let i = 0; i < 6; i++) k.sphere(0.015, '#a0643a', { p: [W / 2 + 0.02 + Math.cos(i * 2.1) * 0.034, B + 0.034, D / 2 + 0.24 + Math.sin(i * 2.1) * 0.034] }, [5, 4]);
  return k.build();
}

/** Where he stands to go in: this far in front of the house's centre (u, outside the doorway). */
export const DOORWAY_U = DOGHOUSE.d / 2 + 0.34;
/** Where he sits inside, on his bed (u from the centre, toward the back). */
export const BED_U = -0.12;

/** The ghost: the house's silhouette as a solid (for the faint fill) and its edges (the outline). */
export function ghostGeometry(): { fill: BufferGeometry; edges: BufferGeometry } {
  const { w: W, d: D, h: H, rise, base: B, door } = DOGHOUSE;
  const outline = new Shape(
    [
      [-W / 2, 0],
      [W / 2, 0],
      [W / 2, H],
      [0, H + rise],
      [-W / 2, H],
    ].map(([x, y]) => new Vector2(x, y)),
  );
  const body = new ExtrudeGeometry(outline, { depth: D, bevelEnabled: false });
  body.translate(0, B, -D / 2);
  const slab = new ExtrudeGeometry(
    new Shape(
      [
        [-W / 2 - 0.08, 0],
        [W / 2 + 0.08, 0],
        [W / 2 + 0.08, B],
        [-W / 2 - 0.08, B],
      ].map(([x, y]) => new Vector2(x, y)),
    ),
    { depth: D + 0.2, bevelEnabled: false },
  );
  slab.translate(0, 0, -(D + 0.2) / 2);
  const fill = mergeGeometries([body, slab], false);
  // the outline: the body's and base's edges, plus the doorway's arch
  const edges = mergeGeometries([new EdgesGeometry(body, 20), new EdgesGeometry(slab, 20)], false);
  const arch: number[] = [];
  const cy = B + door.h - door.w / 2;
  const r = door.w / 2;
  const z = D / 2 + 0.003;
  const pts: [number, number][] = [[-r, B]];
  for (let i = 0; i <= 12; i++) {
    const t = Math.PI - (i / 12) * Math.PI;
    pts.push([Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  pts.push([r, B]);
  for (let i = 0; i < pts.length - 1; i++) arch.push(pts[i][0], pts[i][1], z, pts[i + 1][0], pts[i + 1][1], z);
  const archGeo = new BufferGeometry();
  archGeo.setAttribute('position', new Float32BufferAttribute(arch, 3));
  const all = mergeGeometries([edges, archGeo], false);
  return { fill, edges: all };
}
