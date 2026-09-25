import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { DEG } from '../math/sphere';

const R = CONFIG.planetRadius;
const C = CONFIG.camera;

/**
 * "Diorama" camera (spec §4.6): the default fixed-pitch view, which the player can tilt
 * (`controller.view.pitch`). Rotation is done by spinning the planet (ADR-4), so the camera
 * keeps a fixed yaw. Pitch = elevation above the player's tangent plane; distance = camera →
 * player's feet at (0, R, 0); the look-at target sits a little ahead of and above the feet.
 * Eases out to a higher vantage during fast-travel fly-overs.
 */
export function DioramaCamera({ controller }: { controller: GameController }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    controller.camera = camera;
  }, [camera, controller]);

  useFrame(() => {
    const t = controller.sim.travelState;
    const w = t && t.mode === 'flyover' ? Math.sin(Math.PI * t.progress) : 0;
    const base = controller.view.pitch;
    const pitch = (base + (C.flyoverPitchDeg - base) * w) * DEG;
    const dist = C.distance + (C.flyoverDistance - C.distance) * w;
    // the rig rides with the ground under the player (hills, the bridge), and follows half of a
    // fly-over's height, so the character is seen rising and dropping but stays in frame
    const y = R + controller.lift + 0.5 * controller.sim.hover;
    camera.position.set(0, y + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    camera.lookAt(0, y + C.lookUp, -C.lookAhead * (1 - w));
  });

  return null;
}
