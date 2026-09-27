import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { Kit, type V3 } from './kit';
import { KitModel } from './KitModel';
import { bench, lampPost, noticeBoard } from './parts';
import { stoneUrn } from './planters';
import { lampsOn } from './DayNight';
import { addLamp, type Lamp } from './lampLights';

const R = CONFIG.planetRadius;
/** Height of the lamp glass above the ground (`lampPost(k, {}, 1.5)`: h + 0.2). */
const LAMP_HEAD = 1.7;
/** Warm lamplight: colour, peak intensity (candela, three.js units) and reach (u). */
export const PLAZA_LAMP = { color: '#ffcf99', intensity: 5.2, range: 3.4 } as const;

/** After dusk each plaza lamp lights the bricks, grass, benches and the character around it. */
function PlazaLamps({ controller, at }: { controller: GameController; at: Vector3[] }) {
  const lamps = useMemo<Lamp[]>(
    () =>
      at.map((n) => ({
        pos: n.clone().multiplyScalar(R - 0.01 + LAMP_HEAD),
        dir: null,
        color: new Color(PLAZA_LAMP.color),
        intensity: 0,
        range: PLAZA_LAMP.range,
      })),
    [at],
  );
  useEffect(() => {
    const off = lamps.map(addLamp);
    return () => off.forEach((f) => f());
  }, [lamps]);
  useFrame(() => {
    const on = lampsOn(controller.sky.night);
    for (const l of lamps) l.intensity = PLAZA_LAMP.intensity * on;
  });
  return null;
}

function frame(n: Vector3, forward: Vector3, h = 0): { p: V3; q: Quaternion } {
  const x = new Vector3().crossVectors(n, forward).normalize();
  const z = new Vector3().crossVectors(x, n).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, n, z));
  const p = n.clone().multiplyScalar(R + h - 0.01);
  return { p: [p.x, p.y, p.z], q };
}

/** Spawn plaza: lamps and planters (and the bench out by the bridge, the notice board by the path to the Lighthouse). */
export function Plaza({ controller }: { controller: GameController }) {
  const geo = useMemo(() => {
    const k = new Kit();
    for (const f of controller.props.furniture) {
      // (the bench stands out by the bridge, on the terrain)
      k.group(frame(f.n, f.facing, controller.terrain.height(f.n)), () => {
        if (f.kind === 'lamp') lampPost(k, {}, 1.5);
        else if (f.kind === 'bench') bench(k, {});
        else if (f.kind === 'notice') noticeBoard(k, {});
        else if (f.kind === 'planter') stoneUrn(k, {}, ['#ff6f7d', '#ffd24d', '#ffffff', '#b98cff']);
      });
    }
    return k.build();
  }, [controller]);

  const lamps = useMemo(() => controller.props.furniture.filter((f) => f.kind === 'lamp').map((f) => f.n), [controller]);

  return (
    <group name="plaza">
      <KitModel geo={geo} />
      <PlazaLamps controller={controller} at={lamps} />
    </group>
  );
}
