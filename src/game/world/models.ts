import { Shape, ExtrudeGeometry, Vector2, LatheGeometry, type ColorRepresentation } from 'three';
import { Kit, type KitGeometry } from './kit';
import {
  ARCH,
  awning,
  barrel,
  bench,
  bunting,
  crate,
  door,
  flowerBox,
  gableRoof,
  hipRoof,
  lampPost,
  potPlant,
  shade,
  signBoard,
  steps,
  wallLantern,
  walls,
  windowUnit,
} from './parts';

export interface LandmarkModel {
  geo: KitGeometry;
  /** Height of the silhouette (label placement). */
  height: number;
  /** Local anchor points for animated extras. */
  anchors: Record<string, [number, number, number]>;
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
  walls(k, { w: W, d: D, h: H, color: '#d69a62', siding: true, trim: ARCH.cream });
  gableRoof(k, { w: W, d: D, rise: 0.85, wallTop: H + 0.05, color: accent, wall: '#e6ae76', wallSurface: 'wood', rows: 5 });
  // chimney (brick) through the right roof slope
  k.surface('brick', () => {
    k.box([0.34, 1.0, 0.34], '#9c5a45', { p: [0.55, H + 0.75, -0.3] }, 0.04);
    for (let i = 0; i < 4; i++) k.box([0.36, 0.03, 0.36], '#7d4636', { p: [0.55, H + 0.4 + i * 0.2, -0.3] }, 0.01);
    k.box([0.42, 0.08, 0.42], '#6b3d30', { p: [0.55, H + 1.27, -0.3] }, 0.03);
  });
  // big double barn doors
  door(k, { p: [0, 0.28, D / 2 + 0.02] }, { w: 0.76, h: 0.98, color: '#9a5234', double: true });
  k.surface('wood', () => {
    for (const s of [-1, 1]) k.box([0.04, 0.9, 0.03], shade('#9a5234', -0.2), { p: [s * 0.19, 0.75, D / 2 + 0.08], r: [0, 0, s * 0.62] }, 0.01);
  });
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
  // workbench (front right) with tools
  k.group({ p: [1.2, 0, 0.95], r: [0, -0.5, 0] }, () => {
    k.surface('wood', () => {
      k.box([0.78, 0.07, 0.4], ARCH.wood, { p: [0, 0.5, 0] }, 0.02);
      for (const x of [-0.33, 0.33]) for (const z of [-0.15, 0.15]) k.box([0.06, 0.48, 0.06], ARCH.woodDark, { p: [x, 0.24, z] }, 0.015);
      k.box([0.7, 0.04, 0.34], ARCH.woodDark, { p: [0, 0.14, 0] }, 0.01);
    });
    k.surface('metal', () => k.box([0.05, 0.05, 0.2], ARCH.iron, { p: [0.12, 0.56, 0.02], r: [0, 0.6, 0] }, 0.01)); // hammer head
    k.surface('wood', () => k.cyl(0.018, 0.018, 0.24, ARCH.woodDark, { p: [0.05, 0.55, -0.02], r: [0, 0, Math.PI / 2] }, 6));
    k.surface('metal', () => k.box([0.26, 0.012, 0.1], '#c9ccd2', { p: [-0.18, 0.545, 0.05] }, 0.004)); // saw blade
    k.box([0.08, 0.04, 0.05], '#d94c4c', { p: [-0.33, 0.56, 0.05] }, 0.01);
  });
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
  return { geo: k.build(), height: H + 2.15, anchors: { smoke: [0.55, H + 1.35, -0.3] } };
}

function townHall(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 2.4;
  const D = 1.55;
  const H = 1.45;
  walls(k, { w: W, d: D, h: H, color: '#f2c9a0', surface: 'brick' });
  // brick band texture on the walls
  k.surface('brick', () => {
    for (let i = 1; i < 6; i++) k.box([W + 0.01, 0.025, D + 0.01], '#e7b68a', { p: [0, 0.28 + i * 0.2, 0] }, 0.01);
  });
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
  // portico with columns and pediment
  const pz = D / 2 + 0.34;
  k.surface('stone', () => {
    k.box([1.3, 0.12, 0.72], ARCH.stone, { p: [0, 0.34, D / 2 + 0.3] }, 0.03);
    for (const s of [-1, 1]) {
      k.box([0.2, 0.08, 0.2], ARCH.creamShade, { p: [s * 0.5, 0.44, pz] }, 0.02);
      k.cyl(0.075, 0.085, 1.0, ARCH.cream, { p: [s * 0.5, 0.98, pz] }, 12);
      k.box([0.22, 0.08, 0.22], ARCH.creamShade, { p: [s * 0.5, 1.52, pz] }, 0.02);
    }
  });
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
  door(k, { p: [0, 0.28, D / 2 + 0.02] }, { w: 0.74, h: 1.0, double: true, color: '#8c5236' });
  steps(k, { p: [0, 0, D / 2 + 0.66] }, { w: 1.2, n: 2, tread: 0.14 });
  for (const s of [-1, 1]) windowUnit(k, { p: [s * 0.86, 0.95, D / 2 + 0.03] }, { w: 0.36, h: 0.46, arch: true, lit: s < 0 });
  for (const s of [-1, 1]) windowUnit(k, { p: [s * (W / 2 + 0.03), 0.95, 0], r: [0, (s * Math.PI) / 2, 0] }, { w: 0.36, h: 0.46, arch: true });
  // noticeboard (front left)
  k.group({ p: [-1.3, 0, 0.75], r: [0, 0.35, 0] }, () => {
    k.surface('wood', () => {
      for (const x of [-0.3, 0.3]) k.box([0.06, 0.95, 0.06], '#5c7b4f', { p: [x, 0.47, 0] }, 0.02);
      k.box([0.66, 0.46, 0.06], '#5c7b4f', { p: [0, 0.72, 0] }, 0.02);
      k.box([0.56, 0.36, 0.03], '#d6a877', { p: [0, 0.72, 0.03] }, 0.01);
    });
    const notes: [number, number, string][] = [
      [-0.15, 0.78, '#ffffff'],
      [0.1, 0.8, '#fff3b0'],
      [0.02, 0.64, '#d8ecff'],
      [-0.18, 0.62, '#ffe0ea'],
    ];
    for (const [x, y, c] of notes) k.box([0.13, 0.14, 0.01], c, { p: [x, y, 0.05], r: [0, 0, (x * 3) % 0.3] }, 0.003);
    k.surface('wood', () => k.box([0.72, 0.06, 0.12], '#4c6a41', { p: [0, 0.98, 0] }, 0.02));
  });
  // bushes flanking the steps
  for (const s of [-1, 1]) k.blob(0.22, '#4f9e4a', { p: [s * 0.82, 0.18, D / 2 + 0.5], s: [1.1, 0.8, 1] }, 2, 'solid', 0.25, s);
  return { geo: k.build(), height: ty + 1.55, anchors: { flag: [1.3, 0, 0.6], clock: [0, ty + 0.34, 0.405] } };
}

function lighthouse(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  // rocky base
  k.surface('stone', () => {
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
  k.surface('plaster', () => {
    for (let i = 0; i < bands; i++) {
      const y0 = 0.26 + (H / bands) * i;
      const y1 = y0 + H / bands;
      const ra = r0 + (r1 - r0) * (i / bands);
      const rb = r0 + (r1 - r0) * ((i + 1) / bands);
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
  });
  // door
  door(k, { p: [0, 0.26, r0 - 0.02] }, { w: 0.4, h: 0.62, arch: true, color: '#7a4a33' });
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
  return { geo: k.build(), height: gy + 1.6, anchors: { beam: [0, gy + 0.4, 0] } };
}

function library(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 2.2;
  const D = 1.6;
  const H = 1.45;
  walls(k, { w: W, d: D, h: H, color: '#efe3c8', trim: '#f8efdc', surface: 'stone' });
  // stone course lines
  k.surface('stone', () => {
    for (let i = 1; i < 6; i++) k.box([W + 0.01, 0.02, D + 0.01], '#dcceb0', { p: [0, 0.28 + i * 0.2, 0] }, 0.008);
  });
  gableRoof(k, { w: W, d: D, rise: 0.72, wallTop: H + 0.06, color: accent, wall: '#f4ead3', wallSurface: 'stone', rows: 4 });
  // emblem on the pediment: open book
  k.cyl(0.22, 0.22, 0.05, '#fff4dc', { p: [0, H + 0.4, D / 2 + 0.02], r: [Math.PI / 2, 0, 0] }, 24);
  k.torus(0.22, 0.03, ARCH.brass, { p: [0, H + 0.4, D / 2 + 0.05] }, Math.PI * 2, [6, 24]);
  for (const s of [-1, 1]) k.box([0.14, 0.18, 0.02], shade(accent, -0.1), { p: [s * 0.075, H + 0.4, D / 2 + 0.06], r: [0, s * 0.35, 0] }, 0.01);
  // columns + door
  for (const s of [-1, 1]) {
    k.surface('stone', () => {
      k.box([0.22, 0.1, 0.22], ARCH.creamShade, { p: [s * 0.52, 0.33, D / 2 + 0.16] }, 0.02);
      k.cyl(0.08, 0.09, 1.02, '#fbf5e8', { p: [s * 0.52, 0.89, D / 2 + 0.16] }, 12);
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2;
        k.box([0.012, 0.96, 0.012], '#e6dcc6', { p: [s * 0.52 + Math.cos(a) * 0.082, 0.89, D / 2 + 0.16 + Math.sin(a) * 0.082] }, 0.004);
      }
      k.box([0.24, 0.1, 0.24], ARCH.creamShade, { p: [s * 0.52, 1.44, D / 2 + 0.16] }, 0.02);
    });
    // banners
    k.surface('canvas', () => k.box([0.3, 0.72, 0.03], accent, { p: [s * 0.86, 0.95, D / 2 + 0.04] }, 0.015));
    k.surface('metal', () => k.box([0.32, 0.05, 0.05], ARCH.brass, { p: [s * 0.86, 1.33, D / 2 + 0.05] }, 0.015));
    k.box([0.18, 0.18, 0.02], '#fff4dc', { p: [s * 0.86, 1.02, D / 2 + 0.06], r: [0, 0, Math.PI / 4] }, 0.01);
  }
  door(k, { p: [0, 0.28, D / 2 + 0.02] }, { w: 0.62, h: 0.98, arch: true, color: '#6d4a3a', glassTop: true });
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
  return { geo: k.build(), height: H + 1.3, anchors: {} };
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
  // stage
  k.surface('wood', () => {
    k.add(annularSector(0.01, 1.05, Math.PI, 2 * Math.PI, 0.18), ARCH.wood, { p: [0, 0.02, -0.25] });
    for (let i = 0; i < 6; i++) k.box([0.02, 0.19, 0.02], ARCH.woodDark, { p: [-0.9 + i * 0.36, 0.11, -0.25 + 0.01] }, 0.005);
    k.box([2.1, 0.06, 0.08], shade(accent, -0.15), { p: [0, 0.2, -0.22] }, 0.02);
  });
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
  return { geo: k.build(), height: 2.6, anchors: {} };
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
    potPlant(k, { p: [Math.cos(a) * 0.72, 0.43, Math.sin(a) * 0.72] }, ['#ff6f7d', '#ffd24d', '#b98cff'][i % 3]);
  }
  // glass dome + frame (painted white iron)
  k.sphere(R, ARCH.glassLight, { p: [0, 0.4, 0] }, [24, 12], 'glass', [0, Math.PI * 2, 0, Math.PI / 2]);
  k.surface('metal', () => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.torus(R + 0.005, 0.022, ARCH.white, { p: [0, 0.4, 0], r: [0, a, 0] }, Math.PI / 2, [4, 16]);
    }
    for (const phi of [0.45, 0.9]) {
      const y = Math.sin(phi) * R;
      const r = Math.cos(phi) * R;
      k.torus(r + 0.005, 0.022, ARCH.white, { p: [0, 0.4 + y, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 32]);
    }
    k.torus(R + 0.01, 0.03, ARCH.white, { p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 32]);
  });
  k.sphere(0.1, accent, { p: [0, 0.4 + R + 0.06, 0] }, [10, 8]);
  // vestibule + door
  k.surface('wood', () => k.box([0.62, 0.9, 0.3], ARCH.white, { p: [0, 0.75, R - 0.05] }, 0.04));
  k.box([0.46, 0.76, 0.02], ARCH.glass, { p: [0, 0.72, R + 0.11] }, 0.01);
  k.box([0.03, 0.76, 0.03], ARCH.white, { p: [0, 0.72, R + 0.12] }, 0.01);
  k.sphere(0.03, ARCH.brass, { p: [0.12, 0.7, R + 0.14] }, [8, 6]);
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
  k.group({ p: [-1.05, 0, 1.0], r: [0, 0.8, 0] }, () => {
    k.surface('wood', () => k.box([0.6, 0.2, 0.26], ARCH.wood, { p: [0, 0.1, 0] }, 0.03));
    for (let i = 0; i < 4; i++) k.blob(0.06, '#6cc35a', { p: [-0.21 + i * 0.14, 0.24, 0] }, 1);
  });
  return { geo: k.build(), height: 0.4 + R + 0.5, anchors: {} };
}

function postOffice(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  const W = 1.7;
  const D = 1.25;
  const H = 1.25;
  walls(k, { w: W, d: D, h: H, color: '#dff1ee', siding: true, trim: ARCH.cream });
  gableRoof(k, { w: W, d: D, rise: 0.7, wallTop: H + 0.05, color: accent, wall: '#e9f6f3', wallSurface: 'wood', rows: 4 });
  door(k, { p: [0.1, 0.28, D / 2 + 0.02] }, { w: 0.5, h: 0.85, arch: true, glassTop: true, color: '#e05d5d' });
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
  potPlant(k, { p: [0.62, 0, D / 2 + 0.2] }, '#ffd24d');
  return { geo: k.build(), height: H + 1.1, anchors: { flag: [1.05 + 0.19, 1.0, 0.78 + 0.14] } };
}

function generic(accent: ColorRepresentation): LandmarkModel {
  const k = new Kit();
  walls(k, { w: 1.4, d: 1.2, h: 1.3, color: '#f2e6d0' });
  hipRoof(k, { w: 1.4, d: 1.2, h: 0.7, y: 1.36, color: accent });
  door(k, { p: [0, 0.28, 0.62] }, { w: 0.5, h: 0.8 });
  return { geo: k.build(), height: 2.5, anchors: {} };
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
