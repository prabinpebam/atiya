import { BoxGeometry, CylinderGeometry, type BufferGeometry, type ColorRepresentation } from 'three';
import { Kit, type KitGeometry, type Xf } from './kit';
import { ARCH, shade, WALL_T } from './parts';

/**
 * Simple furnished rooms seen through an open door. Each is its own kit (drawn only while the door
 * is open) with a warm lining, a floor, a few pieces of furniture and a pendant lamp whose bulb
 * uses the shared `glow` layer. Plain (unbevelled) boxes keep the triangle count low.
 */

const BOOKS = ['#c9493f', '#e0a33a', '#3f6fb5', '#3d9a6a', '#7b4fa8', '#e7dcc4', '#b5563a', '#2f5d7c'];

/** Flip a closed or open surface so it is seen from inside (winding and normals reversed). */
export function inward(g: BufferGeometry): BufferGeometry {
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

function slab(k: Kit, size: [number, number, number], color: ColorRepresentation, xf: Xf = {}): void {
  k.add(new BoxGeometry(size[0], size[1], size[2]), color, xf);
}

export interface RoomBounds {
  /** Inner half-width and half-depth, floor and ceiling heights. */
  xi: number;
  zi: number;
  y0: number;
  y1: number;
}

/** Lining for a hollow `walls()` body: floorboards, papered walls over a panelled dado, and a ceiling. */
export function room(
  k: Kit,
  o: { w: number; d: number; h: number; plinth?: number; wall: ColorRepresentation; dado: ColorRepresentation; floor: ColorRepresentation },
): RoomBounds {
  const xi = o.w / 2 - WALL_T;
  const zi = o.d / 2 - WALL_T;
  const y0 = o.plinth ?? 0.28;
  const y1 = o.h - 0.05;
  const hh = y1 - y0;
  k.surface('wood', () => {
    slab(k, [2 * xi, 0.012, 2 * zi], o.floor, { p: [0, y0 + 0.001, 0] });
    // board joints
    const n = Math.round((2 * xi) / 0.16);
    for (let i = 1; i < n; i++) slab(k, [0.008, 0.004, 2 * zi], shade(o.floor, -0.22), { p: [-xi + (2 * xi * i) / n, y0 + 0.008, 0] });
  });
  k.surface('plaster', () => {
    slab(k, [2 * xi, hh, 0.012], o.wall, { p: [0, y0 + hh / 2, -zi + 0.006] });
    for (const s of [-1, 1]) slab(k, [0.012, hh, 2 * zi], o.wall, { p: [s * (xi - 0.006), y0 + hh / 2, 0] });
    slab(k, [2 * xi, 0.012, 2 * zi], shade(o.wall, 0.1), { p: [0, y1 - 0.006, 0] });
  });
  k.surface('wood', () => {
    const dh = 0.3;
    slab(k, [2 * xi, dh, 0.02], o.dado, { p: [0, y0 + dh / 2, -zi + 0.01] });
    slab(k, [2 * xi, 0.03, 0.035], shade(o.dado, -0.15), { p: [0, y0 + dh, -zi + 0.018] });
    for (const s of [-1, 1]) {
      slab(k, [0.02, dh, 2 * zi], o.dado, { p: [s * (xi - 0.01), y0 + dh / 2, 0] });
      slab(k, [0.035, 0.03, 2 * zi], shade(o.dado, -0.15), { p: [s * (xi - 0.018), y0 + dh, 0] });
    }
  });
  return { xi, zi, y0, y1 };
}

/** Pendant lamp hanging from the ceiling at `(x, y1, z)`; the bulb is on the glow layer. */
export function pendant(k: Kit, x: number, y1: number, z: number, drop = 0.3, shadeColor: ColorRepresentation = '#2f5d4f'): void {
  k.surface('metal', () => {
    k.cyl(0.006, 0.006, drop, ARCH.iron, { p: [x, y1 - drop / 2, z] }, 4);
    k.add(new CylinderGeometry(0.03, 0.11, 0.09, 12, 1, true), shadeColor, { p: [x, y1 - drop - 0.02, z] });
  });
  k.sphere(0.045, ARCH.lit, { p: [x, y1 - drop - 0.06, z] }, [10, 8], 'glow');
}

export function rug(k: Kit, xf: Xf, w: number, d: number, color: ColorRepresentation, border: ColorRepresentation): void {
  k.group(xf, () =>
    k.surface('canvas', () => {
      slab(k, [w, 0.01, d], border, { p: [0, 0.005, 0] });
      slab(k, [w - 0.08, 0.012, d - 0.08], color, { p: [0, 0.007, 0] });
    }),
  );
}

export function table(k: Kit, xf: Xf, w: number, d: number, h: number, color: ColorRepresentation = ARCH.wood): void {
  k.group(xf, () =>
    k.surface('wood', () => {
      slab(k, [w, 0.04, d], color, { p: [0, h - 0.02, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(k, [0.04, h - 0.04, 0.04], shade(color, -0.2), { p: [sx * (w / 2 - 0.04), (h - 0.04) / 2, sz * (d / 2 - 0.04)] });
    }),
  );
}

export function chair(k: Kit, xf: Xf, color: ColorRepresentation = ARCH.woodDark): void {
  k.group(xf, () =>
    k.surface('wood', () => {
      slab(k, [0.2, 0.03, 0.2], color, { p: [0, 0.22, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(k, [0.03, 0.22, 0.03], shade(color, -0.15), { p: [sx * 0.08, 0.11, sz * 0.08] });
      slab(k, [0.2, 0.22, 0.03], color, { p: [0, 0.35, -0.085] });
    }),
  );
}

/** Bookcase against a wall (its back at local z = 0, facing +z), shelves full of books. */
export function bookcase(k: Kit, xf: Xf, w: number, h: number, seed = 0, color: ColorRepresentation = '#8a5a3c'): void {
  const d = 0.2;
  k.group(xf, () => {
    k.surface('wood', () => {
      slab(k, [w, h, 0.02], shade(color, -0.25), { p: [0, h / 2, 0.01] });
      for (const s of [-1, 1]) slab(k, [0.03, h, d], color, { p: [s * (w / 2 - 0.015), h / 2, d / 2] });
      slab(k, [w, 0.03, d], color, { p: [0, h - 0.015, d / 2] });
    });
    const shelves = Math.max(2, Math.round(h / 0.24));
    const gap = h / shelves;
    for (let r = 0; r < shelves; r++) {
      const y = r * gap;
      k.surface('wood', () => slab(k, [w - 0.04, 0.025, d], color, { p: [0, y + 0.0125, d / 2] }));
      let x = -w / 2 + 0.04;
      let i = 0;
      while (x < w / 2 - 0.07) {
        const u = Math.sin((seed + 1) * 12.9898 + r * 78.233 + i * 37.719) * 43758.5453;
        const f = u - Math.floor(u);
        const bw = 0.035 + f * 0.03;
        const bh = gap * (0.6 + f * 0.25);
        if (f > 0.9 && x > -w / 2 + 0.1) {
          x += 0.05; // a gap
        } else {
          slab(k, [bw - 0.004, bh, d * 0.8], BOOKS[(i + r * 3 + seed) % BOOKS.length], { p: [x + bw / 2, y + 0.025 + bh / 2, d * 0.5] });
          x += bw;
        }
        i++;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Per-landmark rooms (dimensions match the walls in models.ts)
// ---------------------------------------------------------------------------

export function workshopInterior(W: number, D: number, H: number): KitGeometry {
  const k = new Kit();
  const r = room(k, { w: W, d: D, h: H, wall: '#e9d2b0', dado: '#a86f45', floor: '#b98556' });
  const back = -r.zi;
  // a workbench in the middle of the room (in view through the doors), pegboard with tools on the back wall
  rug(k, { p: [0, r.y0, 0.36] }, 0.5, 0.3, '#5b7f5a', '#d9b25a');
  k.group({ p: [0, r.y0, -0.08] }, () => {
    table(k, {}, 0.9, 0.36, 0.44, '#c08a58');
    k.surface('wood', () => slab(k, [0.9, 0.03, 0.28], ARCH.woodDark, { p: [0, 0.12, 0] }));
    k.surface('metal', () => slab(k, [0.12, 0.08, 0.1], '#5b6b7a', { p: [0.36, 0.48, 0] })); // vice
    slab(k, [0.2, 0.05, 0.12], '#d94c4c', { p: [-0.25, 0.465, 0.02] }); // toolbox
    k.surface('wood', () => slab(k, [0.3, 0.03, 0.08], '#e8c79a', { p: [0.05, 0.455, 0.04], r: [0, 0.3, 0] }));
  });
  k.group({ p: [-0.15, r.y0 + 0.6, back + 0.02] }, () => {
    k.surface('wood', () => slab(k, [0.95, 0.4, 0.02], '#d8b58a', { p: [0, 0.2, 0] }));
    k.surface('metal', () => {
      slab(k, [0.03, 0.2, 0.02], ARCH.iron, { p: [-0.32, 0.2, 0.02] });
      slab(k, [0.1, 0.04, 0.03], ARCH.iron, { p: [-0.32, 0.3, 0.025] });
      slab(k, [0.24, 0.07, 0.01], '#c9ccd2', { p: [-0.05, 0.25, 0.02] });
      slab(k, [0.03, 0.16, 0.02], '#d94c4c', { p: [0.18, 0.2, 0.02], r: [0, 0, 0.3] });
      k.torus(0.05, 0.01, '#5b6b7a', { p: [0.34, 0.24, 0.02] }, Math.PI * 2, [4, 12]);
    });
  });
  // shelf of paint tins on the left wall
  k.group({ p: [-r.xi + 0.02, r.y0 + 0.62, -0.05], r: [0, Math.PI / 2, 0] }, () => {
    k.surface('wood', () => slab(k, [0.7, 0.025, 0.16], '#c08a58', { p: [0, 0, 0.08] }));
    ['#4f7cff', '#ffd24d', '#3fb67a', '#ff6f7d'].forEach((c, i) => k.surface('metal', () => k.cyl(0.045, 0.045, 0.1, c, { p: [-0.24 + i * 0.16, 0.06, 0.08] }, 10)));
  });
  // sawhorse with a plank, a stool and a crate
  k.group({ p: [0.55, r.y0, -0.42], r: [0, 0.35, 0] }, () =>
    k.surface('wood', () => {
      slab(k, [0.5, 0.05, 0.07], ARCH.wood, { p: [0, 0.3, 0] });
      for (const x of [-0.18, 0.18]) for (const s of [-1, 1]) slab(k, [0.035, 0.32, 0.035], ARCH.woodDark, { p: [x, 0.15, s * 0.06], r: [s * 0.35, 0, 0] });
      slab(k, [0.62, 0.03, 0.16], '#e0b584', { p: [0.04, 0.34, 0], r: [0, 0.1, 0] });
    }),
  );
  chair(k, { p: [0.12, r.y0, 0.24], r: [0, Math.PI + 0.3, 0] });
  k.surface('wood', () => slab(k, [0.26, 0.26, 0.26], ARCH.wood, { p: [r.xi - 0.2, r.y0 + 0.13, back + 0.2], r: [0, 0.3, 0] }));
  pendant(k, 0, r.y1, -0.05, 0.32, '#3d6b5a');
  return k.build();
}

export function townHallInterior(W: number, D: number, H: number, accent: ColorRepresentation): KitGeometry {
  const k = new Kit();
  const r = room(k, { w: W, d: D, h: H, wall: '#f4e2c6', dado: '#8c5a3c', floor: '#c7a27a' });
  const back = -r.zi;
  // red carpet from the door to the lectern
  rug(k, { p: [0, r.y0, 0.05] }, 0.46, 2 * r.zi - 0.1, '#b8323f', ARCH.brass);
  // lectern on a low dais
  k.surface('wood', () => {
    slab(k, [0.9, 0.06, 0.5], '#8c5a3c', { p: [0, r.y0 + 0.03, back + 0.25] });
    slab(k, [0.24, 0.42, 0.16], '#a8704a', { p: [0, r.y0 + 0.27, back + 0.4] });
    slab(k, [0.3, 0.03, 0.22], '#8c5a3c', { p: [0, r.y0 + 0.5, back + 0.43], r: [0.3, 0, 0] });
  });
  // banners either side of the lectern
  for (const s of [-1, 1]) {
    k.surface('canvas', () => slab(k, [0.24, 0.5, 0.012], accent, { p: [s * 0.5, r.y0 + 0.62, back + 0.02] }));
    k.surface('metal', () => slab(k, [0.28, 0.025, 0.025], ARCH.brass, { p: [s * 0.5, r.y0 + 0.88, back + 0.025] }));
    slab(k, [0.1, 0.1, 0.008], '#fff4dc', { p: [s * 0.5, r.y0 + 0.66, back + 0.03], r: [0, 0, Math.PI / 4] });
  }
  // two rows of benches each side of the aisle
  for (const s of [-1, 1])
    for (const z of [-0.06, 0.2])
      k.group({ p: [s * 0.58, r.y0, z] }, () =>
        k.surface('wood', () => {
          slab(k, [0.7, 0.03, 0.16], '#a8704a', { p: [0, 0.2, 0] });
          slab(k, [0.7, 0.18, 0.03], '#8c5a3c', { p: [0, 0.32, -0.08] });
          for (const x of [-0.3, 0.3]) slab(k, [0.03, 0.2, 0.14], '#6d4430', { p: [x, 0.1, 0] });
        }),
      );
  // portrait frame on the back wall
  k.surface('wood', () => slab(k, [0.3, 0.24, 0.02], ARCH.brass, { p: [0, r.y0 + 0.84, back + 0.015] }));
  slab(k, [0.24, 0.18, 0.01], '#7fa7c9', { p: [0, r.y0 + 0.84, back + 0.027] });
  // chandelier
  k.surface('metal', () => {
    k.cyl(0.006, 0.006, 0.18, ARCH.brass, { p: [0, r.y1 - 0.09, 0] }, 4);
    k.torus(0.14, 0.012, ARCH.brass, { p: [0, r.y1 - 0.2, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 16]);
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.sphere(0.03, ARCH.lit, { p: [Math.cos(a) * 0.14, r.y1 - 0.17, Math.sin(a) * 0.14] }, [8, 6], 'glow');
  }
  return k.build();
}

export function libraryInterior(W: number, D: number, H: number): KitGeometry {
  const k = new Kit();
  const r = room(k, { w: W, d: D, h: H, wall: '#e9dcc0', dado: '#6d4a3a', floor: '#a9774f' });
  const back = -r.zi;
  const bh = r.y1 - r.y0 - 0.12;
  // bookcases along the back and side walls
  for (let i = 0; i < 3; i++) bookcase(k, { p: [-0.62 + i * 0.62, r.y0, back] }, 0.6, bh, i);
  for (const s of [-1, 1]) bookcase(k, { p: [s * r.xi, r.y0, -0.1], r: [0, (-s * Math.PI) / 2, 0] }, 0.8, bh, 5 + s);
  // reading table with a green lamp, two chairs and a rug
  rug(k, { p: [0.15, r.y0, 0.05] }, 1.0, 0.7, '#8a3b4a', '#e0a33a');
  table(k, { p: [0.2, r.y0, 0.0] }, 0.6, 0.36, 0.34, '#8a5a3c');
  k.surface('metal', () => {
    k.cyl(0.035, 0.045, 0.02, ARCH.brass, { p: [0.36, r.y0 + 0.35, -0.05] }, 10);
    k.cyl(0.008, 0.008, 0.14, ARCH.brass, { p: [0.36, r.y0 + 0.42, -0.05] }, 4);
    k.add(new CylinderGeometry(0.04, 0.07, 0.05, 12, 1, true), '#2f7a4f', { p: [0.36, r.y0 + 0.5, -0.05] });
  });
  k.sphere(0.03, ARCH.lit, { p: [0.36, r.y0 + 0.48, -0.05] }, [8, 6], 'glow');
  for (const s of [-1, 1]) chair(k, { p: [0.2 + s * 0.2, r.y0, s * 0.3], r: [0, s > 0 ? Math.PI : 0, 0] }, '#6d4a3a');
  // an open book on the table and a small stack
  for (const s of [-1, 1]) slab(k, [0.09, 0.008, 0.12], '#fffaf0', { p: [0.1 + s * 0.045, r.y0 + 0.345, 0.02], r: [0, 0, -s * 0.12] });
  slab(k, [0.14, 0.05, 0.1], '#3f6fb5', { p: [0.02, r.y0 + 0.365, -0.1] });
  pendant(k, 0.2, r.y1, 0.0, 0.26, '#6d4a3a');
  return k.build();
}

export function postOfficeInterior(W: number, D: number, H: number, accent: ColorRepresentation): KitGeometry {
  const k = new Kit();
  const r = room(k, { w: W, d: D, h: H, wall: '#e3f1ec', dado: shade(accent, -0.2), floor: '#c39a6b' });
  const back = -r.zi;
  // counter across the room
  k.surface('wood', () => {
    slab(k, [1.1, 0.4, 0.2], '#c9a27a', { p: [-0.1, r.y0 + 0.2, back + 0.42] });
    slab(k, [1.16, 0.035, 0.26], shade(accent, -0.1), { p: [-0.1, r.y0 + 0.42, back + 0.42] });
  });
  // scale and a letter tray on the counter
  k.surface('metal', () => {
    slab(k, [0.14, 0.02, 0.1], ARCH.brass, { p: [-0.42, r.y0 + 0.45, back + 0.42] });
    k.cyl(0.05, 0.05, 0.012, ARCH.brass, { p: [-0.42, r.y0 + 0.5, back + 0.42] }, 12);
    k.cyl(0.008, 0.008, 0.04, ARCH.brass, { p: [-0.42, r.y0 + 0.47, back + 0.42] }, 4);
  });
  slab(k, [0.16, 0.02, 0.1], '#fffaf0', { p: [0.1, r.y0 + 0.445, back + 0.44], r: [0, 0.2, 0] });
  // pigeonholes with letters on the back wall
  const cols = 6;
  const rows = 3;
  const cw = 0.14;
  k.group({ p: [-0.1, r.y0 + 0.52, back + 0.01] }, () => {
    k.surface('wood', () => slab(k, [cols * cw + 0.03, rows * cw + 0.03, 0.02], '#8a5a3c', { p: [0, (rows * cw) / 2, 0.01] }));
    for (let c = 0; c <= cols; c++) k.surface('wood', () => slab(k, [0.015, rows * cw, 0.12], '#a8704a', { p: [-(cols * cw) / 2 + c * cw, (rows * cw) / 2, 0.06] }));
    for (let rr = 0; rr <= rows; rr++) k.surface('wood', () => slab(k, [cols * cw, 0.015, 0.12], '#a8704a', { p: [0, rr * cw, 0.06] }));
    for (let c = 0; c < cols; c++)
      for (let rr = 0; rr < rows; rr++) {
        if ((c * 7 + rr * 3) % 4 === 0) continue;
        const col = ['#fffaf0', '#fff3b0', '#d8ecff', '#ffe0ea'][(c + rr) % 4];
        slab(k, [cw * 0.7, 0.05, 0.09], col, { p: [-(cols * cw) / 2 + (c + 0.5) * cw, rr * cw + 0.04, 0.07], r: [0.15, 0, 0] });
      }
  });
  // parcels and a sack of mail by the side wall
  k.surface('wood', () => {
    slab(k, [0.2, 0.16, 0.18], '#c9955f', { p: [r.xi - 0.16, r.y0 + 0.08, back + 0.18] });
    slab(k, [0.14, 0.12, 0.14], '#d9a86f', { p: [r.xi - 0.16, r.y0 + 0.22, back + 0.18], r: [0, 0.4, 0] });
  });
  k.surface('canvas', () => k.blob(0.13, '#d8c9a3', { p: [r.xi - 0.18, r.y0 + 0.1, 0.12], s: [1, 0.8, 1] }, 1));
  rug(k, { p: [0.1, r.y0, 0.2] }, 0.5, 0.4, accent, ARCH.white);
  pendant(k, -0.1, r.y1, -0.05, 0.24, shade(accent, -0.2));
  return k.build();
}

/** Round room inside the lighthouse: an inward-facing wall, a spiral stair round a newel post, barrels and a lamp. */
export function lighthouseInterior(ri: number, y0: number, h: number, accent: ColorRepresentation): KitGeometry {
  const k = new Kit();
  k.surface('plaster', () => k.add(inward(new CylinderGeometry(ri, ri, h, 20, 1, true)), '#efe4cf', { p: [0, y0 + h / 2, 0] }));
  k.surface('stone', () => k.cyl(ri, ri, 0.012, '#b9ad98', { p: [0, y0 + 0.004, 0] }, 20));
  k.surface('wood', () => {
    k.cyl(0.05, 0.05, h, ARCH.woodDark, { p: [0, y0 + h / 2, -0.05] }, 8);
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.95 + i * 0.5;
      const y = y0 + 0.08 + i * 0.12;
      k.group({ p: [0, y, -0.05], r: [0, -a, 0] }, () => slab(k, [ri - 0.06, 0.04, 0.16], i % 2 ? '#b67a4b' : '#a86f45', { p: [(ri - 0.06) / 2, 0, 0] }));
    }
  });
  k.group({ p: [-0.38, y0, 0.22] }, () => {
    k.surface('wood', () => k.cyl(0.1, 0.1, 0.24, ARCH.wood, { p: [0, 0.12, 0] }, 10));
    k.surface('metal', () => k.torus(0.1, 0.01, ARCH.iron, { p: [0, 0.18, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [4, 12]));
  });
  k.surface('canvas', () => k.torus(0.08, 0.03, '#d8c49a', { p: [0.34, y0 + 0.03, 0.12], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [5, 12]));
  rug(k, { p: [0, y0, 0.3] }, 0.36, 0.22, accent, ARCH.white);
  // wall lamp
  k.surface('metal', () => slab(k, [0.05, 0.05, 0.08], ARCH.iron, { p: [0.4, y0 + 0.7, -0.4] }));
  k.sphere(0.04, ARCH.lit, { p: [0.37, y0 + 0.66, -0.37] }, [8, 6], 'glow');
  return k.build();
}
