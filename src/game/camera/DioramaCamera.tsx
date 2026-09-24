import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { DEG } from '../math/sphere';

const R = CONFIG.planetRadius;
const C = CONFIG.camera;

/**
 * Fixed-yaw, fixed-pitch "diorama" camera (spec §4.6). Pitch = elevation above the player's
 * tangent plane; distance = camera → player's feet at (0, R, 0); the look-at target sits a
 * little ahead of and above the feet. Eases out to a higher vantage during fast-travel fly-overs.
 */
export function DioramaCamera({ controller }: { controller: GameController }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    controller.camera = camera;
  }, [camera, controller]);

  useFrame(() => {
    const t = controller.sim.travelState;
    const w = t && t.mode === 'flyover' ? Math.sin(Math.PI * t.progress) : 0;
    const pitch = (C.pitchDeg + (C.flyoverPitchDeg - C.pitchDeg) * w) * DEG;
    const dist = C.distance + (C.flyoverDistance - C.distance) * w;
    camera.position.set(0, R + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    camera.lookAt(0, R + C.lookUp, -C.lookAhead * (1 - w));
  });

  return null;
}
