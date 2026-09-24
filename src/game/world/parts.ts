import { CylinderGeometry, type ColorRepresentation } from 'three';
import { Kit, mix, type Surface, type V3, type Xf } from './kit';

/** Shared palette for architecture (warm, pastel, "toy" materials). */
export const ARCH = {
  cream: '#f6ead2',
  creamShade: '#e8d8b8',
  stone: '#cbc2b0',
  stoneDark: '#a99f8c',
  wood: '#b67a4b',
  woodDark: '#8a5534',
  door: '#a4553a',
  brass: '#e4b24c',
  glass: '#4f7682',
  glassLight: '#8fb9c2',
  lit: '#ffe2a0',
  iron: '#3a3f4b',
  white: '#fbfaf6',
  leaf: '#4f9e4a',
  soil: '#7a5236',
} as const;

export function shade(c: ColorRepresentation, t: number) {
  return t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#1a1410', -t);
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

/**
 * Gable roof with the ridge running front-to-back (z), so the gable triangle faces the
 * viewer like a cottage. Built from overlapping shingle rows with trim boards.
 */
export function gableRoof(
  k: Kit,
  o: { w: number; d: number; rise: number; wallTop: number; overhang?: number; color: ColorRepresentation; trim?: ColorRepresentation; wall?: ColorRepresentation; wallSurface?: Surface; rows?: number },
) {
  const oh = o.overhang ?? 0.22;
  const run = o.w / 2 + oh;
  const a = Math.atan2(o.rise, run);
  const L = Math.hypot(run, o.rise);
  const depth = o.d + oh * 2;
  const rows = o.rows ?? 4;
  const trim = o.trim ?? ARCH.cream;

  k.surface('roof', () => {
    for (const s of [-1, 1]) {
      // underlay slab
      k.box([L, 0.1, depth], shade(o.color, -0.25), { p: [(s * run) / 2, o.wallTop + o.rise / 2 - 0.02, 0], r: [0, 0, -s * a] }, 0.04);
      // shingle rows: each row tilted a touch steeper so its lower edge laps over the next
      for (let i = 0; i < rows; i++) {
        const t = (i + 0.5) / rows;
        const x = s * run * t;
        const y = o.wallTop + o.rise * (1 - t) + 0.07;
        const c = shade(o.color, i % 2 ? -0.06 : 0.04);
        k.box([L / rows + 0.08, 0.09, depth + 0.04], c, { p: [x, y, 0], r: [0, 0, -s * (a + 0.07)] }, 0.035);
      }
    }
    // ridge cap
    k.cyl(0.09, 0.09, depth + 0.06, shade(o.color, -0.12), { p: [0, o.wallTop + o.rise + 0.08, 0], r: [Math.PI / 2, 0, 0] }, 10);
  });
  // gable walls (front/back) and trim boards along the gable edge
  const e = (o.rise * oh) / run;
  const tri: [number, number][] = [
    [-o.w / 2, 0],
    [o.w / 2, 0],
    [o.w / 2, e],
    [0, o.rise],
    [-o.w / 2, e],
  ];
  for (const z of [o.d / 2 - 0.06, -o.d / 2 + 0.06]) {
    k.surface(o.wallSurface ?? 'plaster', () => k.extrude(tri, 0.1, o.wall ?? ARCH.cream, { p: [0, o.wallTop, z] }, 0.01));
    // painted barge boards
    k.surface('wood', () => {
      for (const s of [-1, 1]) {
        k.box([L + 0.05, 0.12, 0.12], trim, { p: [(s * run) / 2, o.wallTop + o.rise / 2 + 0.12, Math.sign(z) * (depth / 2 + 0.02)], r: [0, 0, -s * a] }, 0.04);
      }
    });
  }
}

/** Stepped hip / pyramid roof (square-ish), a few bands that lap over each other. */
export function hipRoof(k: Kit, o: { w: number; d: number; h: number; y: number; overhang?: number; color: ColorRepresentation; bands?: number; top?: number }) {
  k.surface('roof', () => hipRoofBands(k, o));
}

function hipRoofBands(k: Kit, o: { w: number; d: number; h: number; y: number; overhang?: number; color: ColorRepresentation; bands?: number; top?: number }) {
  const bands = o.bands ?? 3;
  const oh = o.overhang ?? 0.2;
  const topFrac = o.top ?? 0.12;
  const R2 = Math.SQRT1_2;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands;
    const t1 = (i + 1) / bands;
    const sb = 1 - t0 * (1 - topFrac);
    const st = 1 - t1 * (1 - topFrac);
    const h = o.h / bands;
    const c = shade(o.color, i % 2 ? -0.05 : 0.05);
    // Pre-rotate so the 4-sided frustum is square before the non-uniform scale is applied.
    const g = new CylinderGeometry(R2 * (st / sb) * 0.98, R2 * 1.04, h, 4).rotateY(Math.PI / 4);
    k.add(g, c, { p: [0, o.y + h * (i + 0.5), 0], s: [(o.w + oh * 2) * sb, 1, (o.d + oh * 2) * sb] });
  }
  // cap
  k.box([(o.w + oh * 2) * topFrac + 0.05, 0.1, (o.d + oh * 2) * topFrac + 0.05], shade(o.color, -0.15), { p: [0, o.y + o.h + 0.04, 0] }, 0.04);
}

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

/** Window facing +z at the origin (centre of the opening). */
export function windowUnit(k: Kit, xf: Xf, o: { w: number; h: number; arch?: boolean; lit?: boolean; frame?: ColorRepresentation; sill?: boolean; shutters?: ColorRepresentation }) {
  const frame = o.frame ?? ARCH.cream;
  const f = 0.07;
  k.group(xf, () => {
    const glassLayer = o.lit ? 'glow' : 'solid';
    const glassColor = o.lit ? ARCH.lit : ARCH.glass;
    k.box([o.w, o.h, 0.04], glassColor, { p: [0, 0, -0.01] }, 0.01, glassLayer);
    if (!o.lit) k.box([o.w * 0.18, o.h * 0.7, 0.02], ARCH.glassLight, { p: [-o.w * 0.22, o.h * 0.05, 0.015], r: [0, 0, -0.35] }, 0.005);
    // frame
    k.box([o.w + f * 2, f, 0.1], frame, { p: [0, -o.h / 2 - f / 2, 0.02] }, 0.025);
    k.box([f, o.h, 0.1], frame, { p: [-o.w / 2 - f / 2, 0, 0.02] }, 0.025);
    k.box([f, o.h, 0.1], frame, { p: [o.w / 2 + f / 2, 0, 0.02] }, 0.025);
    // mullions
    k.box([0.035, o.h, 0.05], frame, { p: [0, 0, 0.02] }, 0.01);
    k.box([o.w, 0.035, 0.05], frame, { p: [0, o.h * 0.08, 0.02] }, 0.01);
    if (o.arch) {
      k.cyl(o.w / 2, o.w / 2, 0.04, glassColor, { p: [0, o.h / 2, -0.01], r: [Math.PI / 2, 0, 0] }, 20, glassLayer);
      k.torus(o.w / 2 + f / 2, f / 2 + 0.01, frame, { p: [0, o.h / 2, 0.02] }, Math.PI, [6, 20]);
    } else {
      k.box([o.w + f * 2, f, 0.1], frame, { p: [0, o.h / 2 + f / 2, 0.02] }, 0.025);
    }
    if (o.sill !== false) k.box([o.w + f * 3, 0.06, 0.18], frame, { p: [0, -o.h / 2 - f - 0.02, 0.06] }, 0.025);
    if (o.shutters) k.surface('wood', () => {
      for (const s of [-1, 1]) {
        k.box([o.w * 0.42, o.h + 0.06, 0.05], o.shutters!, { p: [s * (o.w / 2 + f + o.w * 0.21 + 0.02), 0, 0.02] }, 0.02);
        for (let i = 0; i < 4; i++) k.box([o.w * 0.34, 0.025, 0.02], shade(o.shutters!, -0.15), { p: [s * (o.w / 2 + f + o.w * 0.21 + 0.02), -o.h / 2 + 0.12 + i * (o.h / 4), 0.05] }, 0.005);
      }
    });
  });
}

/** Panelled door facing +z; origin at the bottom centre of the doorway. */
export function door(k: Kit, xf: Xf, o: { w: number; h: number; color?: ColorRepresentation; frame?: ColorRepresentation; double?: boolean; arch?: boolean; glassTop?: boolean }) {
  const color = o.color ?? ARCH.door;
  const frame = o.frame ?? ARCH.cream;
  k.group(xf, () => {
    const leaves = o.double ? 2 : 1;
    const lw = o.w / leaves;
    for (let i = 0; i < leaves; i++) {
      const cx = -o.w / 2 + lw * (i + 0.5);
      const pw = lw * 0.62;
      k.surface('wood', () => {
        k.box([lw - 0.02, o.h, 0.08], color, { p: [cx, o.h / 2, 0] }, 0.02);
        // raised panels
        k.box([pw, o.h * 0.34, 0.03], shade(color, 0.08), { p: [cx, o.h * 0.27, 0.05] }, 0.015);
        if (o.glassTop) k.box([pw, o.h * 0.3, 0.03], ARCH.glass, { p: [cx, o.h * 0.72, 0.05] }, 0.015);
        else k.box([pw, o.h * 0.3, 0.03], shade(color, 0.08), { p: [cx, o.h * 0.72, 0.05] }, 0.015);
      });
      // handle
      const hx = o.double ? cx + (i === 0 ? lw * 0.36 : -lw * 0.36) : cx + lw * 0.34;
      k.surface('metal', () => {
        if (o.double) k.box([0.035, 0.22, 0.05], ARCH.brass, { p: [hx, o.h * 0.5, 0.07] }, 0.015);
        else k.sphere(0.045, ARCH.brass, { p: [hx, o.h * 0.48, 0.08] }, [10, 8]);
      });
    }
    // frame
    const f = 0.1;
    k.box([f, o.h + f, 0.14], frame, { p: [-o.w / 2 - f / 2, (o.h + f) / 2, 0.02] }, 0.03);
    k.box([f, o.h + f, 0.14], frame, { p: [o.w / 2 + f / 2, (o.h + f) / 2, 0.02] }, 0.03);
    if (o.arch) {
      k.cyl(o.w / 2, o.w / 2, 0.06, shade(color, -0.1), { p: [0, o.h, -0.01], r: [Math.PI / 2, 0, 0] }, 20);
      k.torus(o.w / 2 + f / 2, f / 2 + 0.01, frame, { p: [0, o.h, 0.03] }, Math.PI, [6, 20]);
    } else {
      k.box([o.w + f * 2.4, f * 1.3, 0.16], frame, { p: [0, o.h + f * 0.6, 0.03] }, 0.03);
    }
  });
}

export function steps(k: Kit, xf: Xf, o: { w: number; n: number; rise?: number; tread?: number; color?: ColorRepresentation }) {
  const rise = o.rise ?? 0.08;
  const tread = o.tread ?? 0.18;
  const color = o.color ?? ARCH.stone;
  k.group(xf, () => k.surface('stone', () => {
    for (let i = 0; i < o.n; i++) {
      const depth = tread * (o.n - i);
      k.box([o.w - i * 0.06, rise, depth], shade(color, i % 2 ? -0.04 : 0.03), { p: [0, rise * (i + 0.5), depth / 2] }, 0.025);
    }
  }));
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

/**
 * Box body with a stone plinth, corner pilasters and a cornice band. Origin at ground centre.
 * The body is `surface` (default plaster, or wood when it has clapboard siding).
 */
export function walls(
  k: Kit,
  o: { w: number; d: number; h: number; color: ColorRepresentation; plinth?: number; trim?: ColorRepresentation; siding?: boolean; pilasters?: boolean; surface?: Surface },
) {
  const plinth = o.plinth ?? 0.28;
  const trim = o.trim ?? ARCH.cream;
  k.surface('stone', () => plinthBlocks(k, o, plinth));
  k.surface(o.surface ?? (o.siding ? 'wood' : 'plaster'), () => wallBody(k, o, plinth));
  if (o.pilasters !== false) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box([0.16, o.h - plinth, 0.16], trim, { p: [sx * (o.w / 2 - 0.02), plinth + (o.h - plinth) / 2, sz * (o.d / 2 - 0.02)] }, 0.04);
  }
  k.box([o.w + 0.18, 0.14, o.d + 0.18], trim, { p: [0, o.h + 0.02, 0] }, 0.05);
}

function plinthBlocks(k: Kit, o: { w: number; d: number }, plinth: number) {
  k.box([o.w + 0.12, plinth, o.d + 0.12], ARCH.stone, { p: [0, plinth / 2, 0] }, 0.05);
  // plinth stone blocks
  for (const [ax, len, other] of [
    ['x', o.w, o.d],
    ['z', o.d, o.w],
  ] as const) {
    const n = Math.max(2, Math.round(len / 0.45));
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (len / n) * (i + 0.5);
      for (const s of [-1, 1]) {
        const p: V3 = ax === 'x' ? [u, plinth / 2, s * (other / 2 + 0.065)] : [s * (other / 2 + 0.065), plinth / 2, u];
        const size: V3 = ax === 'x' ? [len / n - 0.05, plinth - 0.06, 0.03] : [0.03, plinth - 0.06, len / n - 0.05];
        k.box(size, shade(ARCH.stone, (i + (s > 0 ? 1 : 0)) % 2 ? -0.07 : 0.04), { p }, 0.01);
      }
    }
  }
}

function wallBody(k: Kit, o: { w: number; d: number; h: number; color: ColorRepresentation; siding?: boolean }, plinth: number) {
  k.box([o.w, o.h - plinth, o.d], o.color, { p: [0, plinth + (o.h - plinth) / 2, 0] }, 0.04);
  if (o.siding) {
    const rows = Math.round((o.h - plinth) / 0.2);
    for (let i = 1; i < rows; i++) {
      const y = plinth + i * ((o.h - plinth) / rows);
      k.box([o.w + 0.02, 0.03, o.d + 0.02], shade(o.color, -0.12), { p: [0, y, 0] }, 0.012);
    }
  }
}

// ---------------------------------------------------------------------------
// Fixtures & props
// ---------------------------------------------------------------------------

export function wallLantern(k: Kit, xf: Xf) {
  k.group(xf, () => k.surface('metal', () => {
    k.box([0.05, 0.05, 0.16], ARCH.iron, { p: [0, 0.1, 0.08] }, 0.015);
    k.cyl(0.07, 0.09, 0.2, ARCH.lit, { p: [0, -0.02, 0.16] }, 8, 'glow');
    k.cyl(0.02, 0.1, 0.08, ARCH.iron, { p: [0, 0.12, 0.16] }, 8);
    k.cyl(0.09, 0.07, 0.04, ARCH.iron, { p: [0, -0.14, 0.16] }, 8);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      k.box([0.015, 0.2, 0.015], ARCH.iron, { p: [Math.cos(a) * 0.085, -0.02, 0.16 + Math.sin(a) * 0.085] }, 0.005);
    }
  }));
}

export function lampPost(k: Kit, xf: Xf, h = 1.6) {
  k.group(xf, () => k.surface('metal', () => {
    k.cyl(0.1, 0.13, 0.12, ARCH.iron, { p: [0, 0.06, 0] }, 10);
    k.cyl(0.035, 0.045, h, ARCH.iron, { p: [0, h / 2, 0] }, 8);
    k.cyl(0.12, 0.08, 0.05, ARCH.iron, { p: [0, h + 0.02, 0] }, 8);
    k.cyl(0.11, 0.085, 0.3, ARCH.lit, { p: [0, h + 0.2, 0] }, 8, 'glow');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      k.box([0.018, 0.3, 0.018], ARCH.iron, { p: [Math.cos(a) * 0.105, h + 0.2, Math.sin(a) * 0.105] }, 0.006);
    }
    k.cone(0.13, 0.1, ARCH.iron, { p: [0, h + 0.4, 0] }, 8);
    k.sphere(0.028, ARCH.brass, { p: [0, h + 0.47, 0] }, [8, 6]);
  }));
}

/** Striped awning facing +z with a scalloped valance. Origin at top-back centre. */
export function awning(k: Kit, xf: Xf, o: { w: number; depth: number; drop: number; a: ColorRepresentation; b: ColorRepresentation }) {
  const stripes = Math.max(4, Math.round(o.w / 0.2));
  const sw = o.w / stripes;
  const slope = Math.atan2(o.drop, o.depth);
  const L = Math.hypot(o.depth, o.drop);
  k.group(xf, () => k.surface('canvas', () => {
    for (let i = 0; i < stripes; i++) {
      const x = -o.w / 2 + sw * (i + 0.5);
      const c = i % 2 ? o.a : o.b;
      k.box([sw + 0.005, 0.04, L], c, { p: [x, -o.drop / 2, o.depth / 2], r: [slope, 0, 0] }, 0.015);
      k.cyl(sw / 2, sw / 2, 0.035, c, { p: [x, -o.drop - 0.02, o.depth + 0.01], r: [Math.PI / 2, 0, 0] }, 10, 'solid');
    }
  }));
}

/** Garland of triangular flags between two points (same height). */
export function bunting(k: Kit, from: V3, to: V3, colors: ColorRepresentation[], sag = 0.18) {
  const n = Math.max(4, Math.round(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.22));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    const y = from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * sag;
    k.sphere(0.012, ARCH.iron, { p: [x, y, z] }, [4, 3]);
    if (i < n) {
      const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]) - Math.PI / 2;
      k.surface('canvas', () => k.extrude(
        [
          [-0.07, 0],
          [0.07, 0],
          [0, -0.15],
        ],
        0.01,
        colors[i % colors.length],
        { p: [x + (to[0] - from[0]) / n / 2, y - 0.01 - Math.sin(Math.PI * (t + 0.5 / n)) * 0.01, z + (to[2] - from[2]) / n / 2], r: [0, yaw, 0] },
        0.004,
      ));
    }
  }
}

export function flowerBox(k: Kit, xf: Xf, w: number, colors: ColorRepresentation[]) {
  k.group(xf, () => {
    k.surface('wood', () => k.box([w, 0.14, 0.16], ARCH.wood, { p: [0, 0, 0] }, 0.03));
    const n = Math.max(3, Math.round(w / 0.12));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      k.blob(0.06, ARCH.leaf, { p: [x, 0.09, 0], s: [1, 0.8, 1] }, 1);
      k.blob(0.045, colors[i % colors.length], { p: [x + 0.01, 0.15, 0.02] }, 1);
    }
  });
}

export function bench(k: Kit, xf: Xf) {
  k.group(xf, () => {
    k.surface('metal', () => {
      for (const s of [-1, 1]) {
        k.box([0.06, 0.26, 0.28], ARCH.iron, { p: [s * 0.42, 0.13, 0] }, 0.02);
        k.box([0.06, 0.3, 0.05], ARCH.iron, { p: [s * 0.42, 0.4, -0.13] }, 0.02);
      }
    });
    k.surface('wood', () => {
      for (let i = 0; i < 3; i++) k.box([1.0, 0.04, 0.08], ARCH.wood, { p: [0, 0.28, -0.1 + i * 0.1] }, 0.015);
      for (let i = 0; i < 2; i++) k.box([1.0, 0.07, 0.035], ARCH.wood, { p: [0, 0.42 + i * 0.1, -0.15] }, 0.015);
    });
  });
}

export function barrel(k: Kit, xf: Xf, color: ColorRepresentation = ARCH.wood) {
  k.group(xf, () => {
    k.surface('wood', () => k.lathe(
      [
        [0.001, 0],
        [0.17, 0],
        [0.2, 0.18],
        [0.17, 0.36],
        [0.001, 0.36],
      ],
      color,
      {},
      14,
    ));
    k.surface('metal', () => {
      for (const y of [0.07, 0.29]) k.torus(0.185, 0.015, ARCH.iron, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [5, 18]);
    });
  });
}

export function crate(k: Kit, xf: Xf, size = 0.34) {
  k.group(xf, () => k.surface('wood', () => {
    k.box([size, size, size], ARCH.wood, { p: [0, size / 2, 0] }, 0.03);
    for (const s of [-1, 1]) k.box([size + 0.02, 0.05, 0.04], ARCH.woodDark, { p: [0, size / 2 + s * size * 0.32, size / 2] }, 0.01);
    k.box([0.04, size * 0.9, 0.04], ARCH.woodDark, { p: [0, size / 2, size / 2 + 0.005], r: [0, 0, 0.78] }, 0.01);
  }));
}

export function potPlant(k: Kit, xf: Xf, bloom?: ColorRepresentation) {
  k.group(xf, () => {
    k.surface('plaster', () => k.lathe(
      [
        [0.001, 0],
        [0.1, 0],
        [0.13, 0.18],
        [0.14, 0.2],
        [0.001, 0.2],
      ],
      '#c8734a',
      {},
      12,
    ));
    k.blob(0.13, ARCH.leaf, { p: [0, 0.3, 0], s: [1, 0.9, 1] }, 1, 'solid', 0.25, 3);
    if (bloom) for (let i = 0; i < 4; i++) k.blob(0.045, bloom, { p: [Math.cos(i * 1.7) * 0.09, 0.36 + (i % 2) * 0.04, Math.sin(i * 1.7) * 0.09] }, 1);
  });
}

export function signBoard(k: Kit, xf: Xf, o: { w: number; h: number; color: ColorRepresentation; icon?: (k: Kit) => void }) {
  k.group(xf, () => {
    k.box([o.w + 0.1, o.h + 0.1, 0.08], ARCH.cream, {}, 0.04);
    k.box([o.w, o.h, 0.06], o.color, { p: [0, 0, 0.03] }, 0.03);
    if (o.icon) k.group({ p: [0, 0, 0.07] }, () => o.icon!(k));
  });
}

/** Freestanding post with a board; origin at ground. */
export function postSign(k: Kit, xf: Xf, color: ColorRepresentation) {
  k.group(xf, () => {
    k.surface('wood', () => {
      k.cyl(0.035, 0.04, 0.7, ARCH.woodDark, { p: [0, 0.35, 0] }, 8);
      k.box([0.5, 0.3, 0.05], ARCH.wood, { p: [0, 0.62, 0.04] }, 0.03);
    });
    k.box([0.4, 0.2, 0.02], color, { p: [0, 0.62, 0.075] }, 0.02);
  });
}
