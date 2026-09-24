import { useMemo } from 'react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { Kit, type V3 } from './kit';
import { KitModel } from './KitModel';
import { ARCH, bench, lampPost, shade } from './parts';
import { LampPools } from './DayNight';

const R = CONFIG.planetRadius;

function frame(n: Vector3, forward: Vector3): { p: V3; q: Quaternion } {
  const x = new Vector3().crossVectors(n, forward).normalize();
  const z = new Vector3().crossVectors(x, n).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, n, z));
  const p = n.clone().multiplyScalar(R - 0.01);
  return { p: [p.x, p.y, p.z], q };
}

/** Spawn plaza: signposts beside each path plus lamps, a bench, a noticeboard and planters. */
export function Plaza({ controller }: { controller: GameController }) {
  const geo = useMemo(() => {
    const k = new Kit();
    for (const post of controller.props.posts) {
      const accent = controller.dataById.get(post.id)!.accent;
      k.group(frame(post.n, post.dir), () => k.surface('wood', () => {
        k.cyl(0.055, 0.065, 1.1, ARCH.woodDark, { p: [0, 0.55, 0] }, 8);
        k.sphere(0.065, ARCH.wood, { p: [0, 1.12, 0] }, [8, 6]);
        k.group({ p: [0, 0.88, 0.14], s: 1.35 }, () => {
          k.extrude(
            [
              [-0.1, -0.09],
              [0.3, -0.09],
              [0.42, 0],
              [0.3, 0.09],
              [-0.1, 0.09],
            ],
            0.05,
            ARCH.wood,
            { r: [0, -Math.PI / 2, 0] },
            0.015,
          );
          // painted tip in the landmark's accent colour, on both faces
          for (const s of [-1, 1]) k.box([0.012, 0.12, 0.2], accent, { p: [s * 0.035, 0, 0.26] }, 0.005);
        });
      }));
    }
    for (const f of controller.props.furniture) {
      k.group(frame(f.n, f.facing), () => {
        if (f.kind === 'lamp') lampPost(k, {}, 1.5);
        else if (f.kind === 'bench') bench(k, {});
        else if (f.kind === 'planter') {
          k.surface('stone', () => {
          k.lathe(
            [
              [0.001, 0],
              [0.3, 0],
              [0.34, 0.26],
              [0.37, 0.3],
              [0.001, 0.3],
            ],
            ARCH.stone,
            {},
            16,
          );
          k.torus(0.35, 0.03, shade(ARCH.stone, -0.1), { p: [0, 0.29, 0], r: [Math.PI / 2, 0, 0] }, Math.PI * 2, [5, 20]);
          });
          k.blob(0.26, '#4f9e4a', { p: [0, 0.38, 0], s: [1, 0.55, 1] }, 2, 'solid', 0.25, 4);
          const colors = ['#ff6f7d', '#ffd24d', '#ffffff', '#b98cff'];
          for (let i = 0; i < 9; i++) {
            const a = i * 2.4;
            const r = 0.08 + (i % 3) * 0.07;
            k.blob(0.05, colors[i % colors.length], { p: [Math.cos(a) * r, 0.47 + (i % 2) * 0.03, Math.sin(a) * r] }, 1);
          }
        } else {
          k.surface('wood', () => {
            for (const x of [-0.32, 0.32]) k.box([0.07, 1.0, 0.07], '#5c7b4f', { p: [x, 0.5, 0] }, 0.02);
            k.box([0.72, 0.5, 0.07], '#5c7b4f', { p: [0, 0.76, 0] }, 0.02);
            k.box([0.62, 0.4, 0.03], '#d6a877', { p: [0, 0.76, 0.035] }, 0.01);
          });
          const notes: [number, number, string][] = [
            [-0.17, 0.83, '#ffffff'],
            [0.1, 0.85, '#fff3b0'],
            [0.04, 0.67, '#d8ecff'],
            [-0.2, 0.66, '#ffe0ea'],
            [0.22, 0.68, '#ffffff'],
          ];
          notes.forEach(([x, y, c], i) => {
            k.box([0.14, 0.15, 0.01], c, { p: [x, y, 0.055], r: [0, 0, (i % 3) * 0.08 - 0.08] }, 0.003);
            k.sphere(0.012, '#e05d5d', { p: [x, y + 0.06, 0.065] }, [6, 4]);
          });
          k.surface('wood', () => k.box([0.8, 0.07, 0.14], '#4c6a41', { p: [0, 1.05, 0] }, 0.02));
        }
      });
    }
    return k.build();
  }, [controller]);

  const lamps = useMemo(() => controller.props.furniture.filter((f) => f.kind === 'lamp').map((f) => f.n), [controller]);

  return (
    <group name="plaza">
      <KitModel geo={geo} />
      <LampPools controller={controller} at={lamps} />
    </group>
  );
}
