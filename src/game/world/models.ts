import { Shape, ExtrudeGeometry, Vector2, LatheGeometry, SphereGeometry, type ColorRepresentation } from 'three';
import { Kit, type KitGeometry, type V3 } from './kit';
import { lighthouseInterior, libraryInterior, pendant, postOfficeInterior, room, townHallInterior, workshopInterior } from './interiors';
import {
  ARCH,
  awning,
  barrel,
  bench,
  bunting,
  courses,
  crate,
  door,
  type DoorLeaf,
  gableRoof,
  hipRoof,
  lampPost,
  shade,
  signBoard,
  steps,
  wallLantern,
  walls,
  windowUnit,
} from './parts';
import { flowerBox, potPlant, shrub } from './planters';

export interface LandmarkModel {
  geo: KitGeometry;
  /** Height of the silhouette (label placement). */
  height: number;
  /** Local anchor points for animated extras. */
  anchors: Record<string, [number, number, number]>;
  /** Door leaves that swing open (inward) while the player is near. */
  doors?: DoorLeaf[];
  /** The furnished room behind the door, drawn only while the door is open. */
  interior?: KitGeometry;
  /** Lamplight spilling out of the open door after dusk: start of the pool on the ground (centre), door width, length along +z. */
  spill?: { p: V3; w: number; len: number };
  /** Where the shared warm door light sits while this landmark is open (just inside the doorway). */
  light?: V3;
  /** Amphitheater: a festoon curtain across the band shell's arch (centre of the arch at its base, radius), and stage spotlights. */
  curtain?: { p: V3; r: number };
  spots?: { from: V3[]; to: V3; pool: number };
}

const FLOWERS = ['#ff6f7d', '#ffd24d', '#ffffff', '#b98cff', '#ff9a4d'];

function annularSector(ri: number, ro: number, a0: number, a1: number, height: number): ExtrudeGeometry {
  const s = new Shape();
  s.absarc(0, 0, ro, a0, a1, false);
  s.absarc(0, 0, ri, a1, a0, true);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); // extrude upward; shape y → −z
  return g;
}

// ---------------------------------------------------------------------------

function workshop(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 2.0;
  const D = 1.5;
  const H = 1.35;
  walls(k, { w: W, d: D, h: H, color: '#d69a62', siding: true, trim: ARCH.cream, opening: { x: 0, w: 0.76, h: 0.98 } });
  gableRoof(k, { w: W, d: D, rise: 0.85, wallTop: H + 0.05, color: accent, wall: '#e6ae76', wallSurface: 'wood', rows: 5 });
  // chimney (brick) through the right roof slope
  k.surface('brick', () => {
    k.box([0.34, 1.0, 0.34], '#9c5a45', { p: [0.55, H + 0.75, -0.3] }, 0.04);
    for (let i = 0; i < 4; i++) k.box([0.36, 0.03, 0.36], '#7d4636', { p: [0.55, H + 0.4 + i * 0.2, -0.3] }, 0.01);
    k.box([0.42, 0.08, 0.42], '#6b3d30', { p: [0.55, H + 1.27, -0.3] }, 0.03);
  });
  // big double barn doors
  const doors = door(k, { p: [0, 0.28, D / 2 + 0.02] }, { w: 0.76, h: 0.98, color: '#9a5234', double: true, braces: shade('#9a5234', -0.2) });
  // windows + flower boxes
  for (const s of [-1, 1]) {
    windowUnit(k, { p: [s * 0.75, 0.86, D / 2 + 0.03] }, { w: 0.32, h: 0.34, lit: s > 0 });
    flowerBox(k, { p: [s * 0.75, 0.6, D / 2 + 0.12] }, 0.44, FLOWERS.slice(s > 0 ? 0 : 2));
  }
  // side windows
  for (const s of [-1, 1]) windowUnit(k, { p: [s * (W / 2 + 0.03), 0.86, 0], r: [0, (s * Math.PI) / 2, 0] }, { w: 0.34, h: 0.34 });
  // sign over the door: pencil icon
  signBoard(k, { p: [0, 1.5, D / 2 + 0.1] }, {
    w: 0.62,
    h: 0.24,
    color: accent,
    icon: (kk) => {
      kk.cyl(0.035, 0.035, 0.34, '#ffd24d', { p: [-0.02, 0, 0.02], r: [0, 0, Math.PI / 2] }, 6);
      kk.cone(0.035, 0.08, '#f3d2a2', { p: [0.19, 0, 0.02], r: [0, 0, -Math.PI / 2] }, 6);
      kk.box([0.05, 0.075, 0.075], '#ff8fa3', { p: [-0.21, 0, 0.02] }, 0.015);
    },
  });
  wallLantern(k, { p: [0.75, 1.24, D / 2 + 0.02] });
  steps(k, { p: [0, 0, D / 2 + 0.06] }, { w: 1.0, n: 2 });
  // (the workbench that stood here is now the crafting table, a prop of its own: world/craft/)
  // log pile (front left)
  k.group({ p: [-1.22, 0, 0.45], r: [0, 0.35, 0] }, () =>
    k.surface('wood', () => {
      const logs: [number, number][] = [
        [-0.14, 0.1],
        [0.14, 0.1],
        [0, 0.28],
      ];
      for (const [x, y] of logs) {
        k.cyl(0.11, 0.11, 0.62, '#9a6a44', { p: [x, y, 0], r: [Math.PI / 2, 0, 0] }, 10);
        for (const z of [-0.312, 0.312]) k.cyl(0.085, 0.085, 0.01, '#e8c79a', { p: [x, y, z], r: [Math.PI / 2, 0, 0] }, 10);
      }
    }),
  );
  barrel(k, { p: [-1.05, 0, -0.55] });
  crate(k, { p: [-1.1, 0, -0.05], r: [0, 0.4, 0] }, 0.3);
  return {
    geo: k.build(),
    height: H + 2.15,
    anchors: { smoke: [0.55, H + 1.35, -0.3] },
    doors,
    interior: workshopInterior(W, D, H),
    spill: { p: [0, 0, D / 2 + 0.06], w: 0.76, len: 1.7 },
    light: [0, 0.8, D / 2 - 0.3],
  };
}

function townHall(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 2.4;
  const D = 1.55;
  const H = 1.45;
  const opening = { x: 0, w: 0.74, h: 1.0 };
  walls(k, { w: W, d: D, h: H, color: '#f7efe2', surface: 'brick', opening });
  // painted brick: band courses in the same white paint, a shade deeper
  k.surface('brick', () => courses(k, { w: W, d: D, ys: [1, 2, 3, 4, 5].map((i) => 0.28 + i * 0.2), color: '#ece2d0', th: 0.025, out: 0.005, opening }));
  hipRoof(k, { w: W, d: D, h: 0.8, y: H + 0.08, color: accent, bands: 3, top: 0.3 });
  // clock tower cupola
  const ty = H + 0.85;
  k.surface('plaster', () => k.box([0.74, 0.62, 0.74], ARCH.cream, { p: [0, ty + 0.31, 0] }, 0.05));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box([0.1, 0.62, 0.1], ARCH.creamShade, { p: [sx * 0.34, ty + 0.31, sz * 0.34] }, 0.03);
  k.cyl(0.24, 0.24, 0.05, ARCH.white, { p: [0, ty + 0.34, 0.38], r: [Math.PI / 2, 0, 0] }, 24);
  k.torus(0.245, 0.03, shade(accent, -0.2), { p: [0, ty + 0.34, 0.405] }, Math.PI * 2, [6, 24]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.box([0.02, 0.04, 0.01], ARCH.iron, { p: [Math.sin(a) * 0.19, ty + 0.34 + Math.cos(a) * 0.19, 0.41], r: [0, 0, -a] }, 0.004);
  }
  // the hands are live meshes showing the visitor's local time (ClockHands in Landmark.tsx)
  hipRoof(k, { w: 0.74, d: 0.74, h: 0.55, y: ty + 0.62, color: shade(accent, -0.05), bands: 2, overhang: 0.1, top: 0.05 });
  k.cyl(0.02, 0.02, 0.35, ARCH.iron, { p: [0, ty + 1.35, 0] }, 6);
  k.sphere(0.05, ARCH.brass, { p: [0, ty + 1.25, 0] }, [10, 8]);
  // portico: a solid stone platform level with the floor (the door's sill, 0.28), clean painted white
  // columns (no masonry) and a pediment; three steps climb to it from the ground
  const pz = D / 2 + 0.34;
  const floor = 0.28;
  k.surface('stone', () => k.box([1.3, floor, 0.72], ARCH.stone, { p: [0, floor / 2, D / 2 + 0.3] }, 0.03));
  for (const s of [-1, 1]) {
    k.box([0.2, 0.08, 0.2], ARCH.creamShade, { p: [s * 0.5, floor + 0.04, pz] }, 0.02);
    k.cyl(0.075, 0.085, 1.48 - floor - 0.08, ARCH.white, { p: [s * 0.5, (floor + 0.08 + 1.48) / 2, pz] }, 12);
    k.box([0.22, 0.08, 0.22], ARCH.creamShade, { p: [s * 0.5, 1.52, pz] }, 0.02);
  }
  k.surface('plaster', () => {
    k.box([1.36, 0.14, 0.78], ARCH.cream, { p: [0, 1.62, D / 2 + 0.3] }, 0.04);
    k.extrude(
      [
        [-0.72, 0],
        [0.72, 0],
        [0, 0.42],
      ],
      0.7,
      ARCH.cream,
      { p: [0, 1.68, D / 2 + 0.3] },
      0.03,
    );
  });
  k.cyl(0.12, 0.12, 0.04, accent, { p: [0, 1.86, D / 2 + 0.72], r: [Math.PI / 2, 0, 0] }, 20);
  k.sphere(0.045, ARCH.brass, { p: [0, 1.86, D / 2 + 0.75] }, [8, 6]);
  const doors = door(k, { p: [0, 0.28, D / 2 + 0.02] }, { w: 0.74, h: 1.0, double: true, color: '#8c5236' });
  steps(k, { p: [0, 0, D / 2 + 0.66] }, { w: 1.2, n: 3, rise: floor / 3, tread: 0.13 });
  for (const s of [-1, 1]) windowUnit(k, { p: [s * 0.86, 0.95, D / 2 + 0.03] }, { w: 0.36, h: 0.46, arch: true, lit: s < 0 });
  for (const s of [-1, 1]) windowUnit(k, { p: [s * (W / 2 + 0.03), 0.95, 0], r: [0, (s * Math.PI) / 2, 0] }, { w: 0.36, h: 0.46, arch: true });
  // (the notice board stands by the path to the Lighthouse now: Plaza.tsx)
  // bushes flanking the platform
  for (const s of [-1, 1]) shrub(k, { p: [s * 0.92, 0, D / 2 + 0.5], r: [0, s, 0], s: 0.45 });
  return {
    geo: k.build(),
    height: ty + 1.55,
    anchors: { flag: [1.3, 0, 0.6], clock: [0, ty + 0.34, 0.405] },
    doors,
    interior: townHallInterior(W, D, H, accent),
    spill: { p: [0, 0, D / 2 + 0.06], w: 0.74, len: 1.9 },
    light: [0, 0.85, D / 2 - 0.3],
  };
}

function lighthouse(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  // rocky base
  k.surface('rock', () => {
    k.lathe(
      [
        [0.001, 0],
        [0.98, 0],
        [0.95, 0.18],
        [0.82, 0.26],
        [0.001, 0.26],
      ],
      ARCH.stone,
      {},
      20,
    );
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      if (Math.abs(a - Math.PI / 2) < 0.4) continue; // keep the door clear (front = +z → a≈π/2 in sin/cos below)
      k.blob(0.18 + (i % 3) * 0.05, i % 2 ? '#a9a9b3' : '#b9b7c0', { p: [Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95], s: [1.2, 0.8, 1] }, 1, 'solid', 0.3, i);
    }
  });
  // striped tapered tower (painted plaster)
  const H = 3.5;
  const r0 = 0.74;
  const r1 = 0.5;
  const bands = 5;
  const dw = 0.4;
  const dh = 0.62;
  k.surface('plaster', () => {
    for (let i = 0; i < bands; i++) {
      const y0 = 0.26 + (H / bands) * i;
      const y1 = y0 + H / bands;
      const ra = r0 + (r1 - r0) * (i / bands);
      const rb = r0 + (r1 - r0) * ((i + 1) / bands);
      if (i === 0) {
        // the doorway: the lowest band leaves a gap round +z up to the top of the opening
        const yc = y0 + dh;
        const rc = ra + (rb - ra) * (dh / (y1 - y0));
        const gap = Math.asin(dw / 2 / ((ra + rc) / 2));
        k.add(new LatheGeometry([new Vector2(ra, y0), new Vector2(rc, yc)], 22, gap, Math.PI * 2 - 2 * gap), ARCH.white);
        k.lathe(
          [
            [rc, yc],
            [rb, y1],
          ],
          ARCH.white,
          {},
          24,
        );
        continue;
      }
      k.lathe(
        [
          [ra, y0],
          [rb, y1],
        ],
        i % 2 ? accent : ARCH.white,
        {},
        24,
      );
    }
    // jambs and lintel close the wall's thickness round the opening
    for (const s of [-1, 1]) k.box([0.05, dh, 0.18], ARCH.white, { p: [s * (dw / 2 + 0.025), 0.26 + dh / 2, r0 - 0.12] }, 0.01);
    k.box([dw + 0.1, 0.05, 0.18], ARCH.white, { p: [0, 0.26 + dh + 0.025, r0 - 0.12] }, 0.01);
  });
  const doors = door(k, { p: [0, 0.26, r0 - 0.02] }, { w: dw, h: dh, arch: true, color: '#7a4a33' });
  // portholes
  for (const [y, r] of [
    [1.7, 0.63],
    [2.7, 0.56],
  ] as const) {
    k.cyl(0.1, 0.1, 0.05, ARCH.glass, { p: [0, y, r], r: [Math.PI / 2, 0, 0] }, 16);
    k.surface('metal', () => k.torus(0.11, 0.025, ARCH.iron, { p: [0, y, r + 0.02] }, Math.PI * 2, [6, 16]));
  }
  // gallery + railing, lantern room frame and cap (painted iron)
  const gy = 0.26 + H;
  k.surface('metal', () => {
    k.cyl(0.74, 0.62, 0.12, ARCH.iron, { p: [0, gy + 0.02, 0] }, 24);
    k.torus(0.7, 0.02, ARCH.iron, { p: [0, gy + 0.34, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [5, 32]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      k.cyl(0.015, 0.015, 0.3, ARCH.iron, { p: [Math.cos(a) * 0.7, gy + 0.2, Math.sin(a) * 0.7] }, 4);
    }
  });
  // lantern room
  k.cyl(0.42, 0.42, 0.6, ARCH.glassLight, { p: [0, gy + 0.4, 0] }, 16, 'glass');
  k.sphere(0.22, ARCH.lit, { p: [0, gy + 0.4, 0] }, [12, 10], 'glow');
  k.surface('metal', () => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.box([0.035, 0.6, 0.035], ARCH.iron, { p: [Math.cos(a) * 0.42, gy + 0.4, Math.sin(a) * 0.42] }, 0.01);
    }
    k.cyl(0.46, 0.46, 0.06, ARCH.iron, { p: [0, gy + 0.72, 0] }, 16);
    k.sphere(0.46, accent, { p: [0, gy + 0.74, 0] }, [18, 8], 'solid', [0, Math.PI * 2, 0, Math.PI / 2]);
    k.sphere(0.07, ARCH.brass, { p: [0, gy + 1.24, 0] }, [10, 8]);
    k.cyl(0.012, 0.012, 0.3, ARCH.iron, { p: [0, gy + 1.42, 0] }, 4);
  });
  return {
    geo: k.build(),
    height: gy + 1.6,
    anchors: { beam: [0, gy + 0.4, 0] },
    doors,
    interior: lighthouseInterior(0.6, 0.26, 1.5, accent),
    spill: { p: [0, 0, r0], w: dw, len: 1.6 },
    light: [0, 0.6, r0 - 0.3],
  };
}

function library(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 2.2;
  const D = 1.6;
  const H = 1.45;
  const opening = { x: 0, w: 0.62, h: 0.98 };
  walls(k, { w: W, d: D, h: H, color: '#efe3c8', trim: '#f8efdc', surface: 'stone', opening });
  // stone course lines
  k.surface('stone', () => courses(k, { w: W, d: D, ys: [1, 2, 3, 4, 5].map((i) => 0.28 + i * 0.2), color: '#dcceb0', th: 0.02, out: 0.005, opening }));
  gableRoof(k, { w: W, d: D, rise: 0.72, wallTop: H + 0.06, color: accent, wall: '#f4ead3', wallSurface: 'stone', rows: 4 });
  // emblem on the pediment: open book
  k.cyl(0.22, 0.22, 0.05, '#fff4dc', { p: [0, H + 0.4, D / 2 + 0.02], r: [Math.PI / 2, 0, 0] }, 24);
  k.torus(0.22, 0.03, ARCH.brass, { p: [0, H + 0.4, D / 2 + 0.05] }, Math.PI * 2, [6, 24]);
  for (const s of [-1, 1]) k.box([0.14, 0.18, 0.02], shade(accent, -0.1), { p: [s * 0.075, H + 0.4, D / 2 + 0.06], r: [0, s * 0.35, 0] }, 0.01);
  // columns (clean painted white, no masonry) + door
  for (const s of [-1, 1]) {
    k.box([0.22, 0.1, 0.22], ARCH.creamShade, { p: [s * 0.52, 0.33, D / 2 + 0.16] }, 0.02);
    k.cyl(0.08, 0.09, 1.02, ARCH.white, { p: [s * 0.52, 0.89, D / 2 + 0.16] }, 12);
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2;
      k.box([0.012, 0.96, 0.012], '#ece6da', { p: [s * 0.52 + Math.cos(a) * 0.082, 0.89, D / 2 + 0.16 + Math.sin(a) * 0.082] }, 0.004);
    }
    k.box([0.24, 0.1, 0.24], ARCH.creamShade, { p: [s * 0.52, 1.44, D / 2 + 0.16] }, 0.02);
    // banners
    k.surface('canvas', () => k.box([0.3, 0.72, 0.03], accent, { p: [s * 0.86, 0.95, D / 2 + 0.04] }, 0.015));
    k.surface('metal', () => k.box([0.32, 0.05, 0.05], ARCH.brass, { p: [s * 0.86, 1.33, D / 2 + 0.05] }, 0.015));
    k.box([0.18, 0.18, 0.02], '#fff4dc', { p: [s * 0.86, 1.02, D / 2 + 0.06], r: [0, 0, Math.PI / 4] }, 0.01);
  }
  const doors = door(k, { p: [0, 0.28, D / 2 + 0.02] }, { w: 0.62, h: 0.98, arch: true, color: '#6d4a3a', glassTop: true });
  steps(k, { p: [0, 0, D / 2 + 0.06] }, { w: 1.4, n: 3 });
  for (const s of [-1, 1]) windowUnit(k, { p: [s * (W / 2 + 0.03), 0.95, 0], r: [0, (s * Math.PI) / 2, 0] }, { w: 0.36, h: 0.46, arch: true, lit: s > 0 });
  // stacked-book sculpture (silhouette cue)
  k.group({ p: [1.36, 0, 0.62], r: [0, -0.3, 0] }, () => {
    const books: [string, number, number][] = [
      ['#e05d5d', 0.52, 0.0],
      ['#f2b544', 0.46, 0.18],
      ['#4f7cff', 0.5, -0.12],
      ['#3fb67a', 0.42, 0.3],
    ];
    let y = 0;
    books.forEach(([c, w, rot], i) => {
      const h = 0.2;
      k.group({ p: [0, y + h / 2, 0], r: [0, rot, 0] }, () => {
        k.box([w, h, 0.42], c, {}, 0.05);
        k.box([w - 0.06, h - 0.06, 0.02], '#fffaf0', { p: [0, 0, 0.21] }, 0.01);
        k.box([0.06, h - 0.02, 0.43], shade(c, -0.2), { p: [-w / 2 + 0.03, 0, 0] }, 0.02);
      });
      y += h + (i === 3 ? 0 : 0.005);
    });
    // open book on top
    k.group({ p: [0, y + 0.06, 0] }, () => {
      for (const s of [-1, 1]) k.box([0.26, 0.03, 0.34], '#fffaf0', { p: [s * 0.13, 0.03, 0], r: [0, 0, -s * 0.18] }, 0.01);
      k.box([0.56, 0.025, 0.38], '#8a5cf6', { p: [0, 0, 0] }, 0.01);
    });
  });
  lampPost(k, { p: [-1.2, 0, 0.62] }, 1.3);
  return {
    geo: k.build(),
    height: H + 1.3,
    anchors: {},
    doors,
    interior: libraryInterior(W, D, H),
    spill: { p: [0, 0, D / 2 + 0.06], w: 0.62, len: 1.8 },
    light: [0, 0.8, D / 2 - 0.3],
  };
}

function amphitheater(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  // band shell: half dome lathe (closed profile = solid thickness), open toward +z
  const pts: Vector2[] = [];
  const R = 1.15;
  const t = 0.1;
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a) * R, Math.sin(a) * R));
  }
  for (let i = 10; i >= 0; i--) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(new Vector2(Math.max(0.001, Math.cos(a) * (R - t)), Math.sin(a) * (R - t)));
  }
  k.surface('plaster', () => {
    k.add(new LatheGeometry(pts, 20, Math.PI / 2, Math.PI), (p, n) => (n.dot(p) < 0 ? '#fff1d6' : accent), { p: [0, 0.2, -0.45] });
    // radial ribs on the inside of the shell
    for (let i = 1; i < 6; i++) {
      const phi = Math.PI / 2 + (i / 6) * Math.PI;
      k.torus(R - t - 0.005, 0.02, shade(accent, 0.1), { p: [0, 0.2, -0.45], r: [0, phi - Math.PI / 2, 0] }, Math.PI / 2, [4, 16]);
    }
  });
  // bulbs along the shell's front arch
  for (let i = 0; i <= 12; i++) {
    const b = (i / 12) * Math.PI;
    k.sphere(0.045, ARCH.lit, { p: [Math.cos(b) * (R - 0.05), 0.2 + Math.sin(b) * (R - 0.05), -0.45 + 0.03] }, [8, 6], 'glow');
  }
  // stage: a round wooden drum the shell stands on (its back half behind the curtain), a painted lip round the top, a dark plinth
  const SR = 1.25;
  k.surface('wood', () => {
    k.cyl(SR, SR, 0.17, ARCH.wood, { p: [0, 0.115, -0.45] }, 44);
    k.cyl(SR - 0.03, SR - 0.01, 0.03, ARCH.woodDark, { p: [0, 0.015, -0.45] }, 44);
  });
  k.cyl(SR + 0.015, SR + 0.015, 0.035, shade(accent, -0.15), { p: [0, 0.182, -0.45] }, 44);
  steps(k, { p: [0, 0, 0.8] }, { w: 0.5, n: 2, rise: 0.09, tread: 0.14 });
  // microphone
  k.surface('metal', () => {
    k.cyl(0.012, 0.03, 0.62, ARCH.iron, { p: [0, 0.52, -0.55] }, 6);
    k.sphere(0.04, '#3b3a40', { p: [0, 0.86, -0.53] }, [8, 6]);
  });
  // curved audience benches either side of the centre aisle (front half)
  for (const [a0, a1] of [
    [0.25, 1.15],
    [1.99, 2.89],
  ]) {
    for (const [ri, h] of [
      [1.25, 0.2],
      [1.52, 0.3],
    ] as const) {
      k.surface('stone', () => k.add(annularSector(ri, ri + 0.2, -a1, -a0, h), '#d8cdb8', { p: [0, 0, -0.1] }));
    }
  }
  // spotlight poles + bunting over the stage
  for (const s of [-1, 1]) {
    k.surface('metal', () => {
      k.cyl(0.05, 0.07, 2.2, '#5b5a63', { p: [s * 1.35, 1.1, -0.35] }, 8);
      k.box([0.28, 0.2, 0.26], accent, { p: [s * 1.35, 2.28, -0.35], r: [0.4, -s * 0.5, 0] }, 0.05);
    });
    k.sphere(0.085, ARCH.lit, { p: [s * 1.29, 2.22, -0.23] }, [10, 8], 'glow');
  }
  bunting(k, [-1.35, 2.05, -0.35], [1.35, 2.05, -0.35], ['#ff6f7d', '#ffd24d', '#4f7cff', '#3fb67a', '#ffffff'], 0.35);
  // no door: a festoon curtain fills the shell's arch and rises as you come near, and the spotlights come on
  return {
    geo: k.build(),
    height: 2.6,
    anchors: {},
    curtain: { p: [0, 0.2, -0.47], r: R - t - 0.04 },
    spots: {
      from: [
        [-1.29, 2.22, -0.23],
        [1.29, 2.22, -0.23],
      ],
      to: [0, 0.24, 0.2],
      pool: 0.85,
    },
    light: [0, 1.0, 0.35],
  };
}

function greenhouse(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const R = 1.2;
  // brick base ring
  k.surface('brick', () => {
    k.lathe(
      [
        [0.001, 0],
        [R + 0.12, 0],
        [R + 0.12, 0.32],
        [R + 0.16, 0.36],
        [R - 0.02, 0.4],
        [0.001, 0.4],
      ],
      '#c8734a',
      {},
      28,
    );
    for (let i = 1; i < 3; i++) k.torus(R + 0.125, 0.012, '#a85c3b', { p: [0, i * 0.11, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 40]);
  });
  // interior plants (visible through glass)
  k.box([1.8, 0.05, 1.8], ARCH.soil, { p: [0, 0.41, 0], s: [0.9, 1, 0.9] }, 0.02);
  k.surface('wood', () => k.cyl(0.05, 0.07, 0.6, ARCH.wood, { p: [-0.3, 0.7, -0.3] }, 8));
  k.blob(0.34, '#5cae4f', { p: [-0.3, 1.1, -0.3] }, 2, 'solid', 0.3, 2);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.4;
    potPlant(k, { p: [Math.cos(a) * 0.72, 0.43, Math.sin(a) * 0.72] }, ['#ff6f7d', '#ffd24d', '#b98cff'][i % 3], i);
  }
  // glass dome + frame (painted white iron)
  // the dome's lowest courses leave a gap for the doorway
  const ts = 0.98;
  const gp = 0.27;
  k.sphere(R, ARCH.glassLight, { p: [0, 0.4, 0] }, [24, 8], 'glass', [0, Math.PI * 2, 0, ts]);
  k.add(new SphereGeometry(R, 22, 5, Math.PI / 2 + gp, Math.PI * 2 - 2 * gp, ts, Math.PI / 2 - ts), ARCH.glassLight, { p: [0, 0.4, 0] }, 'glass');
  k.surface('metal', () => {
    // ribs sit either side of the doorway, not across it
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      k.torus(R + 0.005, 0.022, ARCH.white, { p: [0, 0.4, 0], r: [0, a, 0] }, Math.PI / 2, [4, 16]);
    }
    for (const phi of [0.45, 0.9]) {
      const y = Math.sin(phi) * R;
      const r = Math.cos(phi) * R;
      const g = 0.4 + y < 1.1 ? Math.asin(0.3 / r) : 0; // the low hoop breaks over the doorway
      k.torus(r + 0.005, 0.022, ARCH.white, { p: [0, 0.4 + y, 0], r: [Math.PI / 2, 0, Math.PI / 2 + g] }, Math.PI * 2 - 2 * g, [4, 32]);
    }
    k.torus(R + 0.01, 0.03, ARCH.white, { p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 32]);
  });
  k.sphere(0.1, accent, { p: [0, 0.4 + R + 0.06, 0] }, [10, 8]);
  // vestibule: an open porch frame round the doorway, with a glass door that swings in
  k.surface('wood', () => {
    for (const s of [-1, 1]) k.box([0.1, 0.8, 0.32], ARCH.white, { p: [s * 0.28, 0.8, R - 0.05] }, 0.03);
    k.box([0.66, 0.18, 0.32], ARCH.white, { p: [0, 1.13, R - 0.05] }, 0.04);
  });
  const leaf = new Kit();
  const lw = 0.45;
  const lh = 0.59;
  leaf.group({ p: [0, 0.005, 0.02] }, () => {
    leaf.surface('wood', () => {
      for (const x of [0.03, lw - 0.03]) leaf.box([0.05, lh, 0.04], ARCH.white, { p: [x, lh / 2, 0] }, 0.012);
      leaf.box([lw, 0.1, 0.04], ARCH.white, { p: [lw / 2, 0.05, 0] }, 0.012);
      leaf.box([lw, 0.05, 0.04], ARCH.white, { p: [lw / 2, lh - 0.025, 0] }, 0.012);
      leaf.box([lw, 0.03, 0.03], ARCH.white, { p: [lw / 2, lh * 0.58, 0] }, 0.01);
    });
    leaf.box([lw - 0.08, lh - 0.14, 0.012], ARCH.glass, { p: [lw / 2, lh / 2 + 0.03, 0] }, 0.004, 'glass');
    leaf.surface('metal', () => leaf.sphere(0.03, ARCH.brass, { p: [lw - 0.08, lh * 0.5, 0.035] }, [8, 6]));
  });
  const doors: DoorLeaf[] = [{ geo: leaf.build(), hinge: [-0.225, 0.44, R + 0.07], dir: 1 }];
  // doormat, and a hanging lantern under the dome
  k.surface('canvas', () => k.box([0.4, 0.012, 0.22], '#9a6a44', { p: [0, 0.41, R - 0.12] }, 0.004));
  k.surface('metal', () => {
    k.cyl(0.006, 0.006, 0.22, ARCH.iron, { p: [0.35, 1.42, 0.2] }, 4);
    k.cone(0.07, 0.06, ARCH.iron, { p: [0.35, 1.3, 0.2] }, 8);
  });
  k.sphere(0.05, ARCH.lit, { p: [0.35, 1.23, 0.2] }, [8, 6], 'glow');
  hipRoof(k, { w: 0.62, d: 0.3, h: 0.22, y: 1.2, color: accent, bands: 1, overhang: 0.06, top: 0.4 });
  steps(k, { p: [0, 0, R + 0.1] }, { w: 0.6, n: 2, rise: 0.12 });
  // outside: watering can + planter
  k.group({ p: [1.05, 0, 1.0], r: [0, -0.8, 0] }, () =>
    k.surface('metal', () => {
      k.cyl(0.1, 0.12, 0.2, accent, { p: [0, 0.1, 0] }, 12);
      k.cyl(0.015, 0.02, 0.26, accent, { p: [0.14, 0.18, 0], r: [0, 0, -0.9] }, 6);
      k.torus(0.08, 0.015, accent, { p: [-0.02, 0.22, 0], r: [0, 0, 0] }, Math.PI, [4, 10]);
    }),
  );
  flowerBox(k, { p: [-1.05, 0.135, 1.0], r: [0, 0.8, 0] }, 0.6, ['#ff9a4d', '#ffffff', '#ff6f7d'], true);
  return {
    geo: k.build(),
    height: 0.4 + R + 0.5,
    anchors: {},
    doors,
    spill: { p: [0, 0, R + 0.16], w: 0.46, len: 1.6 },
    light: [0, 0.8, R - 0.2],
  };
}

function postOffice(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 1.7;
  const D = 1.25;
  const H = 1.25;
  walls(k, { w: W, d: D, h: H, color: '#dff1ee', siding: true, trim: ARCH.cream, opening: { x: 0.1, w: 0.5, h: 0.85 } });
  gableRoof(k, { w: W, d: D, rise: 0.7, wallTop: H + 0.05, color: accent, wall: '#e9f6f3', wallSurface: 'wood', rows: 4 });
  const doors = door(k, { p: [0.1, 0.28, D / 2 + 0.02] }, { w: 0.5, h: 0.85, arch: true, glassTop: true, color: '#e05d5d' });
  steps(k, { p: [0.1, 0, D / 2 + 0.06] }, { w: 0.8, n: 2 });
  windowUnit(k, { p: [-0.56, 0.82, D / 2 + 0.03] }, { w: 0.32, h: 0.34, lit: true });
  awning(k, { p: [-0.56, 1.14, D / 2 + 0.04] }, { w: 0.52, depth: 0.26, drop: 0.14, a: accent, b: ARCH.white });
  for (const s of [-1, 1]) windowUnit(k, { p: [s * (W / 2 + 0.03), 0.82, 0], r: [0, (s * Math.PI) / 2, 0] }, { w: 0.3, h: 0.32, shutters: shade(accent, -0.1) });
  // envelope emblem
  k.group({ p: [0.1, 1.42, D / 2 + 0.1] }, () => {
    k.box([0.42, 0.28, 0.05], ARCH.white, {}, 0.03);
    for (const s of [-1, 1]) k.box([0.25, 0.025, 0.02], shade(accent, -0.2), { p: [s * 0.1, 0.05, 0.035], r: [0, 0, s * 0.55] }, 0.005);
    k.sphere(0.035, '#e05d5d', { p: [0, 0.0, 0.04] }, [8, 6]);
  });
  wallLantern(k, { p: [0.58, 1.05, D / 2 + 0.02] });
  // big mailbox on a post (flag is animated separately)
  k.group({ p: [1.05, 0, 0.78] }, () => {
    k.surface('wood', () => k.box([0.1, 0.8, 0.1], ARCH.woodDark, { p: [0, 0.4, 0] }, 0.02));
    k.surface('metal', () => {
      k.box([0.36, 0.26, 0.5], '#e05d5d', { p: [0, 0.92, 0] }, 0.05);
      k.cyl(0.18, 0.18, 0.5, '#e05d5d', { p: [0, 1.05, 0], r: [Math.PI / 2, 0, 0] }, 16);
      k.box([0.2, 0.03, 0.02], '#3b3a40', { p: [0, 1.0, 0.26] }, 0.005);
      k.cyl(0.02, 0.02, 0.04, ARCH.brass, { p: [0, 0.9, 0.26], r: [Math.PI / 2, 0, 0] }, 6);
    });
  });
  // parcels (front left)
  crate(k, { p: [-1.0, 0, 0.55], r: [0, 0.3, 0] }, 0.3);
  crate(k, { p: [-1.02, 0.3, 0.55], r: [0, -0.2, 0] }, 0.22);
  k.box([0.02, 0.23, 0.23], '#f2e2c2', { p: [-1.02, 0.41, 0.55], r: [0, -0.2, 0] }, 0.005);
  bench(k, { p: [-0.3, 0, -0.95], r: [0, Math.PI, 0] });
  potPlant(k, { p: [0.62, 0, D / 2 + 0.2] }, '#ffd24d', 1);
  return {
    geo: k.build(),
    height: H + 1.1,
    anchors: { flag: [1.05 + 0.19, 1.0, 0.78 + 0.14] },
    doors,
    interior: postOfficeInterior(W, D, H, accent),
    spill: { p: [0.1, 0, D / 2 + 0.06], w: 0.5, len: 1.6 },
    light: [0.1, 0.75, D / 2 - 0.25],
  };
}

function generic(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  walls(k, { w: 1.4, d: 1.2, h: 1.3, color: '#f2e6d0', opening: { x: 0, w: 0.5, h: 0.8 } });
  hipRoof(k, { w: 1.4, d: 1.2, h: 0.7, y: 1.36, color: accent });
  const doors = door(k, { p: [0, 0.28, 0.62] }, { w: 0.5, h: 0.8 });
  const ki = new Kit();
  const r = room(ki, { w: 1.4, d: 1.2, h: 1.3, wall: '#f4e6cc', dado: ARCH.woodDark, floor: ARCH.wood });
  pendant(ki, 0, r.y1, 0, 0.25);
  return { geo: k.build(), height: 2.5, anchors: {}, doors, interior: ki.build(), spill: { p: [0, 0, 0.66], w: 0.5, len: 1.5 }, light: [0, 0.75, 0.35] };
}

const BUILDERS: Record<string, (accent: ColorRepresentation) => LandmarkModel> = {
  workshop,
  'town-hall': townHall,
  lighthouse,
  library,
  amphitheater,
  greenhouse,
  'post-office': postOffice,
};

const cache = new Map<string, LandmarkModel>();

export function landmarkModel(variant: string, accent: string): LandmarkModel {
  const key = `${variant}:${accent}`;
  let m = cache.get(key);
  if (!m) {
    m = (BUILDERS[variant] ?? generic)(accent);
    cache.set(key, m);
  }
  return m;
}
