/**
 * The home's models (docs: family.md §3), built with the geometry kit so each part carries its
 * painted surface (plaster, shingles, stone, brick, wood, canvas, metal). Every model's local frame:
 * +z is its front, +y up, the base on y = 0.
 */
import { PlaneGeometry, type BufferGeometry, type ColorRepresentation } from 'three';
import { Kit, type KitGeometry, type V3 } from '../kit';
import { ARCH, flowerBox, gableRoof, potPlant, shade, steps, wallLantern, walls, windowUnit } from '../parts';

export const HOUSE = { w: 2.1, d: 1.7, h: 1.35 } as const;
const WOOD = '#b98356';
const WOOD_DARK = '#86573a';

/** The owner's cottage: plaster over a stone plinth, a shingled gable roof, a green door, lit windows. */
export function houseModel(): { geo: KitGeometry; lantern: V3; chimney: V3; lightsCorner: V3 } {
  const k = new Kit();
  const { w: W, d: D, h: H } = HOUSE;
  // a fieldstone foundation reaching into the ground (the lawn slopes a little here)
  k.surface('stone', () => k.box([W + 0.2, 0.5, D + 0.2], ARCH.stoneDark, { p: [0, -0.2, 0] }, 0.05));
  walls(k, { w: W, d: D, h: H, color: '#f5e6cc', plinth: 0.34, opening: { x: 0, w: 0.6, h: 0.98 } });
  gableRoof(k, { w: W, d: D, rise: 1.0, wallTop: H + 0.05, color: '#bf5b43', wall: '#f5e6cc', rows: 5 });
  // brick chimney through the left slope
  k.surface('brick', () => {
    k.box([0.32, 1.0, 0.32], '#a4604a', { p: [-0.58, H + 0.8, -0.35] }, 0.04);
    k.box([0.4, 0.08, 0.4], '#6f4234', { p: [-0.58, H + 1.32, -0.35] }, 0.03);
  });
  // the front door: planked green, with a little window and a brass knob
  k.surface('wood', () => {
    k.box([0.58, 0.94, 0.06], '#4f8a5e', { p: [0, 0.34 + 0.47, D / 2 + 0.01] }, 0.02);
    for (const x of [-0.14, 0.14]) k.box([0.02, 0.8, 0.012], shade('#4f8a5e', -0.25), { p: [x, 0.8, D / 2 + 0.045] }, 0.004);
    k.box([0.7, 0.07, 0.1], ARCH.cream, { p: [0, 1.36, D / 2 + 0.02] }, 0.02);
    for (const x of [-0.33, 0.33]) k.box([0.06, 1.02, 0.1], ARCH.cream, { p: [x, 0.84, D / 2 + 0.02] }, 0.02);
  });
  k.box([0.2, 0.14, 0.02], ARCH.lit, { p: [0, 1.08, D / 2 + 0.05] }, 0.005, 'glow');
  k.surface('metal', () => k.sphere(0.03, ARCH.brass, { p: [0.2, 0.78, D / 2 + 0.07] }, [8, 6]));
  // a little porch roof on two posts
  k.surface('roof', () => k.box([1.1, 0.06, 0.6], shade('#bf5b43', -0.1), { p: [0, 1.52, D / 2 + 0.28], r: [0.22, 0, 0] }, 0.02));
  k.surface('wood', () => {
    for (const x of [-0.48, 0.48]) k.cyl(0.035, 0.035, 1.24, ARCH.cream, { p: [x, 0.62 + 0.28, D / 2 + 0.52] }, 8);
  });
  wallLantern(k, { p: [0.46, 1.22, D / 2 + 0.02] });
  steps(k, { p: [0, 0, D / 2 + 0.06] }, { w: 0.9, n: 2 });
  k.surface('canvas', () => k.box([0.5, 0.012, 0.3], '#9b6b45', { p: [0, 0.2, D / 2 + 0.52] }, 0.005));
  // windows: two at the front with flower boxes, one on each side, one in the gable; all lit at night
  for (const s of [-1, 1]) {
    windowUnit(k, { p: [s * 0.66, 0.9, D / 2 + 0.03] }, { w: 0.36, h: 0.4, lit: true, shutters: '#6f9fc8' });
    flowerBox(k, { p: [s * 0.66, 0.62, D / 2 + 0.12] }, 0.46, s > 0 ? ['#ff6f7d', '#ffd24d', '#ffffff'] : ['#b98cff', '#ff9a4d', '#ff6f7d']);
    windowUnit(k, { p: [s * (W / 2 + 0.03), 0.9, 0], r: [0, (s * Math.PI) / 2, 0] }, { w: 0.36, h: 0.4, lit: true });
  }
  windowUnit(k, { p: [0, H + 0.42, D / 2 + 0.24] }, { w: 0.26, h: 0.26, arch: true, lit: true });
  potPlant(k, { p: [-0.6, 0, D / 2 + 0.36] }, '#ff6f7d');
  potPlant(k, { p: [0.62, 0, D / 2 + 0.4] });
  // a mailbox by the path
  k.group({ p: [0.95, 0, D / 2 + 0.95] }, () => {
    k.surface('wood', () => k.box([0.06, 0.7, 0.06], WOOD_DARK, { p: [0, 0.35, 0] }, 0.015));
    k.surface('metal', () => {
      k.box([0.18, 0.16, 0.3], '#5a86c8', { p: [0, 0.76, 0] }, 0.05);
      k.box([0.015, 0.14, 0.05], '#e24a44', { p: [0.1, 0.84, -0.08] }, 0.005);
    });
  });
  return { geo: k.build(), lantern: [0.46, 1.2, D / 2 + 0.2], chimney: [-0.58, H + 1.4, -0.35], lightsCorner: [W / 2 + 0.05, H + 0.02, D / 2 + 0.05] };
}

/** The fire ring: stones round crossed logs over the embers (the flames are `flamesModel()`). */
export function fireRingModel(): KitGeometry {
  const k = new Kit();
  k.surface('stone', () => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      k.blob(0.1 + (i % 3) * 0.015, i % 2 ? ARCH.stone : ARCH.stoneDark, { p: [Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36], s: [1.2, 0.75, 1] }, 1, 'solid', 0.25, i);
    }
  });
  k.cyl(0.3, 0.32, 0.03, '#3a2c26', { p: [0, 0.015, 0] }, 14);
  k.surface('wood', () => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      k.cyl(0.045, 0.05, 0.5, i % 2 ? '#7a5236' : '#5e3f2a', { p: [0, 0.1, 0], r: [0.35, a, Math.PI / 2] }, 7);
    }
  });
  k.sphere(0.12, '#ff7a2a', { p: [0, 0.05, 0], s: [1.4, 0.35, 1.4] }, [10, 6], 'glow');
  return k.build();
}

/** Three nested flame tongues (glow layer; flickered in the component). */
export function flamesModel(): BufferGeometry {
  const k = new Kit();
  k.cone(0.16, 0.5, '#ff7b28', { p: [0, 0.25, 0] }, 9, 'glow');
  k.cone(0.1, 0.36, '#ffc34a', { p: [0.04, 0.2, 0.02] }, 8, 'glow');
  k.cone(0.07, 0.3, '#ffe9a0', { p: [-0.05, 0.17, -0.03], r: [0, 0, 0.15] }, 7, 'glow');
  return k.build().glow!;
}

/** A folding camp chair: metal legs, a canvas seat and back, armrests. */
export function campChairModel(color: ColorRepresentation): KitGeometry {
  const k = new Kit();
  k.surface('metal', () => {
    for (const x of [-0.2, 0.2]) {
      k.cyl(0.015, 0.015, 0.52, ARCH.iron, { p: [x, 0.22, 0.02], r: [0.55, 0, 0] }, 6);
      k.cyl(0.015, 0.015, 0.52, ARCH.iron, { p: [x, 0.22, 0.02], r: [-0.55, 0, 0] }, 6);
      k.box([0.04, 0.03, 0.4], ARCH.iron, { p: [x, 0.5, 0.02] }, 0.01);
    }
  });
  k.surface('canvas', () => {
    k.box([0.42, 0.04, 0.38], color, { p: [0, 0.38, 0.02], r: [-0.08, 0, 0] }, 0.02);
    k.box([0.42, 0.42, 0.04], color, { p: [0, 0.62, -0.19], r: [-0.18, 0, 0] }, 0.02);
    for (const x of [-0.22, 0.22]) k.box([0.06, 0.03, 0.34], shade(color, -0.2), { p: [x, 0.52, 0.02] }, 0.01);
  });
  return k.build();
}

/** A split-log bench on two stumps. */
export function logBenchModel(): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    for (const x of [-0.35, 0.35]) k.cyl(0.11, 0.12, 0.24, WOOD_DARK, { p: [x, 0.12, 0] }, 9);
    k.cyl(0.13, 0.13, 1.0, '#9a6a44', { p: [0, 0.3, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.7] }, 10);
    for (const x of [-0.5, 0.5]) k.cyl(0.1, 0.1, 0.01, '#e8c79a', { p: [x, 0.3, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.7] }, 10);
  });
  return k.build();
}

/** An acoustic guitar (standing on its end; lean it with the group's rotation). */
export function guitarModel(): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    k.cyl(0.15, 0.15, 0.08, '#d9a15a', { p: [0, 0.17, 0], r: [Math.PI / 2, 0, 0] }, 16);
    k.cyl(0.115, 0.115, 0.08, '#d9a15a', { p: [0, 0.38, 0], r: [Math.PI / 2, 0, 0] }, 16);
    k.box([0.05, 0.42, 0.03], '#5e3a24', { p: [0, 0.7, 0] }, 0.01);
    k.box([0.08, 0.12, 0.03], '#4a2e1c', { p: [0, 0.96, 0] }, 0.015);
    k.box([0.08, 0.02, 0.012], '#3a2518', { p: [0, 0.1, 0.045] }, 0.004);
  });
  k.cyl(0.045, 0.045, 0.01, '#2a1a12', { p: [0, 0.32, 0.042], r: [Math.PI / 2, 0, 0] }, 12);
  for (const x of [-0.012, 0, 0.012]) k.box([0.003, 0.8, 0.003], '#e8e0cc', { p: [x, 0.52, 0.045] });
  return k.build();
}

/** A wooden picnic table (the long side along x). */
export function tableModel(): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    for (let i = 0; i < 4; i++) k.box([1.3, 0.05, 0.17], i % 2 ? WOOD : shade(WOOD, 0.08), { p: [0, 0.7, -0.27 + i * 0.18] }, 0.015);
    for (const x of [-0.52, 0.52]) {
      for (const z of [-0.22, 0.22]) k.box([0.07, 0.68, 0.07], WOOD_DARK, { p: [x, 0.34, z] }, 0.015);
      k.box([0.07, 0.06, 0.5], WOOD_DARK, { p: [x, 0.2, 0] }, 0.015);
    }
    k.box([1.1, 0.05, 0.06], WOOD_DARK, { p: [0, 0.2, 0] }, 0.015);
  });
  return k.build();
}

/** A wooden dining chair (its front is +z). */
export function chairModel(cushion?: ColorRepresentation): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    k.box([0.44, 0.05, 0.42], WOOD, { p: [0, 0.44, 0] }, 0.015);
    for (const x of [-0.19, 0.19]) for (const z of [-0.18, 0.18]) k.box([0.05, 0.44, 0.05], WOOD_DARK, { p: [x, 0.22, z] }, 0.012);
    for (const x of [-0.19, 0.19]) k.box([0.05, 0.5, 0.05], WOOD_DARK, { p: [x, 0.72, -0.19] }, 0.012);
    for (const y of [0.68, 0.84]) k.box([0.42, 0.07, 0.03], WOOD, { p: [0, y, -0.19] }, 0.012);
  });
  if (cushion) k.surface('canvas', () => k.box([0.4, 0.06, 0.38], cushion, { p: [0, 0.49, 0.01] }, 0.03));
  return k.build();
}

/** Rojina's reading armchair: wide arms, a tall slatted back and a cushion. */
export function armchairModel(): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    k.box([0.56, 0.05, 0.5], '#e7d3b0', { p: [0, 0.4, 0] }, 0.015);
    for (const x of [-0.26, 0.26]) {
      for (const z of [-0.2, 0.2]) k.box([0.06, 0.4, 0.06], '#d6bf98', { p: [x, 0.2, z] }, 0.015);
      k.box([0.12, 0.04, 0.56], '#e7d3b0', { p: [x * 1.12, 0.62, 0.02] }, 0.015);
      k.box([0.05, 0.22, 0.05], '#d6bf98', { p: [x, 0.52, 0.2] }, 0.012);
    }
    for (let i = 0; i < 5; i++) k.box([0.09, 0.62, 0.035], '#e7d3b0', { p: [-0.2 + i * 0.1, 0.72, -0.26], r: [-0.22, 0, 0] }, 0.012);
  });
  k.surface('canvas', () => {
    k.box([0.5, 0.08, 0.44], '#e78a6e', { p: [0, 0.47, 0.02] }, 0.035);
    k.box([0.42, 0.34, 0.08], '#f2b8a0', { p: [0, 0.7, -0.2], r: [-0.22, 0, 0] }, 0.04);
  });
  return k.build();
}

/** A little round side table with a mug of tea and a book. */
export function sideTableModel(): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    k.cyl(0.17, 0.17, 0.04, WOOD, { p: [0, 0.5, 0] }, 14);
    k.cyl(0.03, 0.04, 0.48, WOOD_DARK, { p: [0, 0.25, 0] }, 8);
    k.cyl(0.12, 0.14, 0.03, WOOD_DARK, { p: [0, 0.015, 0] }, 12);
  });
  k.cyl(0.035, 0.03, 0.07, '#f4f1ea', { p: [0.05, 0.555, 0.03] }, 10);
  k.torus(0.02, 0.006, '#f4f1ea', { p: [0.09, 0.56, 0.03] }, Math.PI * 2, [5, 10]);
  k.box([0.14, 0.03, 0.1], '#6f9fc8', { p: [-0.05, 0.535, -0.04], r: [0, 0.4, 0] }, 0.008);
  return k.build();
}

/** The picnic Rojina lays out on the table (shown once she's put it there). */
export function picnicFoodModel(): KitGeometry {
  const k = new Kit();
  // a wicker basket with a gingham cloth
  k.surface('wood', () => {
    k.lathe(
      [
        [0.001, 0],
        [0.13, 0.005],
        [0.15, 0.12],
        [0.001, 0.12],
      ],
      '#c79a5b',
      { p: [-0.35, 0.725, 0], s: [1.2, 1, 0.85] },
      12,
    );
    k.torus(0.1, 0.012, '#a67a42', { p: [-0.35, 0.845, 0] }, Math.PI, [5, 12]);
  });
  k.surface('canvas', () => k.box([0.24, 0.02, 0.2], '#e2554c', { p: [-0.35, 0.85, 0] }, 0.008));
  // plates with bread, apples and a jug of lemonade
  for (const [x, z] of [
    [0.05, -0.12],
    [0.32, 0.12],
  ]) {
    k.cyl(0.1, 0.09, 0.015, '#fbfaf6', { p: [x, 0.735, z] }, 16);
    k.blob(0.05, '#e3b36c', { p: [x, 0.76, z], s: [1.4, 0.6, 1] }, 1);
  }
  for (const [x, z, c] of [
    [0.16, 0.08, '#d93c3c'],
    [0.2, 0.0, '#e9803a'],
    [0.12, -0.02, '#d93c3c'],
  ] as const)
    k.sphere(0.035, c, { p: [x, 0.76, z] }, [8, 6]);
  k.lathe(
    [
      [0.001, 0],
      [0.06, 0],
      [0.055, 0.14],
      [0.035, 0.18],
      [0.001, 0.18],
    ],
    '#ffe27a',
    { p: [0.45, 0.725, -0.12] },
    12,
  );
  return k.build();
}

/** A post for the string lights. */
export function lightPostModel(): KitGeometry {
  const k = new Kit();
  k.surface('wood', () => {
    k.box([0.08, 1.9, 0.08], WOOD_DARK, { p: [0, 0.95, 0] }, 0.02);
    k.box([0.2, 0.06, 0.06], WOOD_DARK, { p: [0.05, 1.8, 0] }, 0.015);
  });
  return k.build();
}

/** Lingjel's Lego: a little tower and some loose bricks (on the mat). */
export function legoModel(): KitGeometry {
  const k = new Kit();
  const colours = ['#e33b3b', '#2f7fe0', '#f6c629', '#3fb45a', '#ffffff'];
  const brick = (x: number, y: number, z: number, c: string, r = 0) =>
    k.group({ p: [x, y, z], r: [0, r, 0] }, () => {
      k.box([0.1, 0.045, 0.05], c, { p: [0, 0.0225, 0] }, 0.006);
      for (const bx of [-0.025, 0.025]) k.cyl(0.011, 0.011, 0.014, c, { p: [bx, 0.051, 0] }, 8);
    });
  for (let i = 0; i < 5; i++) brick(0, i * 0.045, 0, colours[i % colours.length], i * 0.5);
  brick(0.16, 0, 0.06, colours[1], 0.8);
  brick(-0.14, 0, 0.1, colours[3], 2.2);
  brick(0.08, 0, -0.14, colours[2], 1.1);
  brick(-0.06, 0, -0.1, colours[0], 0.3);
  return k.build();
}

/** A toy car (its nose is +z), 0.16 u long. */
export function toyCarModel(color: ColorRepresentation): KitGeometry {
  const k = new Kit();
  k.box([0.08, 0.035, 0.16], color, { p: [0, 0.035, 0] }, 0.012);
  k.box([0.07, 0.03, 0.08], color, { p: [0, 0.065, -0.01] }, 0.012);
  k.box([0.062, 0.022, 0.03], '#bfe3ff', { p: [0, 0.066, 0.03] }, 0.004);
  for (const x of [-0.042, 0.042]) for (const z of [-0.05, 0.05]) k.cyl(0.018, 0.018, 0.014, '#2a2a30', { p: [x, 0.018, z], r: [0, 0, Math.PI / 2] }, 10);
  return k.build();
}

/** A book, held open (its spine along z).*/
export function bookModel(color: ColorRepresentation): KitGeometry {
  // held open: two covers in a shallow V, pages on each
  const k = new Kit();
  for (const s of [-1, 1]) {
    k.box([0.1, 0.008, 0.14], color, { p: [s * 0.05, 0, 0], r: [0, 0, s * -0.25] }, 0.003);
    k.box([0.092, 0.012, 0.13], '#fbf6ea', { p: [s * 0.048, 0.008, 0], r: [0, 0, s * -0.25] });
  }
  return k.build();
}

/** Laija's painting: a sheet of paper with a sun, some sky and grass, and crayons. */
export function paperModel(): KitGeometry {
  const k = new Kit();
  k.box([0.22, 0.004, 0.16], '#fbfaf4', { p: [0, 0.002, 0] });
  k.sphere(0.03, '#ffd24d', { p: [0.04, 0.005, 0.02], s: [1, 0.08, 1] }, [8, 4]);
  k.box([0.08, 0.004, 0.012], '#5aa2e6', { p: [-0.05, 0.006, -0.03], r: [0, 0.2, 0] });
  k.box([0.06, 0.004, 0.04], '#4fae55', { p: [-0.02, 0.006, 0.05] });
  for (const [x, c] of [
    [0.13, '#e33b3b'],
    [0.15, '#2f7fe0'],
    [0.17, '#3fb45a'],
  ] as const)
    k.cyl(0.006, 0.006, 0.07, c, { p: [x, 0.006, -0.02], r: [Math.PI / 2, 0.3, 0] }, 6);
  return k.build();
}

/** A speech bubble with three dots (billboarded over whoever is talking). */
export function bubbleModel(): KitGeometry {
  const k = new Kit();
  k.sphere(0.13, '#fffdf6', { s: [1.35, 0.9, 0.35] }, [14, 10]);
  k.cone(0.05, 0.08, '#fffdf6', { p: [-0.07, -0.12, 0], r: [0, 0, 0.5] }, 6);
  for (const x of [-0.08, 0, 0.08]) k.sphere(0.022, '#5a5361', { p: [x, 0, 0.05] }, [8, 6]);
  return k.build();
}

/** The picnic mat: a flat, finely divided sheet (the component drapes it on the ground). */
export function matGeometry(w = 1.5, d = 1.15): BufferGeometry {
  const g = new PlaneGeometry(w, d, 10, 8);
  g.rotateX(-Math.PI / 2);
  return g;
}
