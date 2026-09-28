import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from 'zustand';
import { Matrix4, Quaternion, Vector3, type Group } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { tangentToward } from '../math/sphere';
import { selectAmbientPaused, selectReducedMotion } from '../state/store';
import { buildChopper } from './chopper/build';
import type { Clip } from './chopper/anim';

// his mind comes in this chunk too (game-mount.tsx attaches it)
import { ChopperBrain } from './chopper/brain';
export { ChopperBrain };

const R = CONFIG.planetRadius;
/** How high the character's face is above the ground (u), for Chopper to look up at. */
const FACE_H = 0.95;
const DOG_EYE_H = 0.5;
/** A little larger than life, like the wildlife, so he reads at the diorama's distance. */
const SCALE = 1.25;

const _x = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _to = new Vector3();

/**
 * Chopper in the world (docs: chopper.md): the controller runs his mind (`chopper/brain.ts`); this
 * places him on the planet and animates him (`chopper/anim.ts`) every frame.
 */
export function Chopper({ controller }: { controller: GameController }) {
  const quality = useStore(controller.store, (s) => s.quality);
  const reduced = useStore(controller.store, selectReducedMotion);
  const paused = useStore(controller.store, selectAmbientPaused);
  const shells = quality === 'high' ? 12 : 8;
  const body = useMemo(() => buildChopper(shells), [shells]);
  const live = useRef<typeof body | null>(null);
  useEffect(() => {
    live.current = body;
    return () => {
      live.current = null;
      // (deferred: dev StrictMode's rehearsal unmount remounts at once, and disposing then drops his programs mid-compile)
      setTimeout(() => live.current !== body && body.dispose(), 0);
    };
  }, [body]);
  const group = useRef<Group>(null);
  const first = useRef(true);
  const wasStill = useRef(false);
  const liftNow = useRef(0);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    // (this chunk brought his mind: game-mount.tsx attached it before the scene mounted)
    const b = controller.chopper as ChopperBrain;
    const n = b.n;
    // (on his house's floor when he's inside, eased as he steps up)
    liftNow.current += (b.lift - liftNow.current) * Math.min(1, dt * 10);
    const h = controller.terrain.walkHeight(n) + liftNow.current;
    g.position.copy(n).multiplyScalar(R + h);
    _x.crossVectors(n, b.dir).normalize();
    _m.makeBasis(_x, n, b.dir);
    _q.setFromRotationMatrix(_m);
    if (first.current || reduced) g.quaternion.copy(_q);
    else g.quaternion.slerp(_q, 1 - Math.exp(-dt * 18));
    first.current = false;

    // what he's looking at, as a turn and a tilt of the head relative to his body
    let look: { yaw: number; pitch: number } | null = null;
    if (b.look) {
      const to = tangentToward(n, b.look, _to);
      if (to) {
        const d = n.angleTo(b.look) * R;
        const atPlayer = b.look === controller.sim.pLocal;
        look = { yaw: Math.atan2(to.dot(_x), to.dot(b.dir)), pitch: atPlayer ? -Math.min(0.5, Math.atan2(FACE_H - DOG_EYE_H, Math.max(d, 0.3))) : 0.15 };
      }
    }
    const still = paused || controller.sim.travel !== null;
    const clip: Clip = still ? 'sit' : b.clip;
    // while ambient motion is paused he sits perfectly still (no wag, no blinks)
    if (paused && !wasStill.current) body.anim.snap('sit');
    wasStill.current = paused;
    body.anim.update(paused ? 0 : dt, {
      speed: still ? 0 : b.speed,
      turn: still ? 0 : b.turn,
      clip,
      clipTime: b.clipTime,
      wag: still ? 0.15 : b.wag,
      look: still ? null : look,
      barkAge: b.barkAge,
      pant: still ? 0 : b.pant,
      reduced,
    });
    const U = body.uniforms;
    if (!paused) U.uTime.value += dt;
    U.uSheen.value = 0.22 * (1 - 0.65 * controller.sky.night);
  });

  return (
    <group ref={group} name="chopper" scale={SCALE}>
      <primitive object={body.mesh} />
    </group>
  );
}
