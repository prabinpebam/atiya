import type { Vector3 } from 'three';
import { CONFIG } from '../config';
import type { GameController } from '../controller';
import { arcDistance, pointArcDistance } from '../math/sphere';
import { mesaPolar, mesaRadius } from './features';
import type { GrassEnv } from './grass';
import { withLampLights } from './lampLights';
import { PLAZA_RADIUS_U } from './layout';
import { boxDistance, padLocal } from './pads';
import { valueNoise } from './terrain';
import { TEXTURES } from './textureManifest';
import { gameTexture } from './textures';
import { WIND_GLSL, windUniforms } from './windField';
import { WAVE } from './summon';

/**
 * What the grass chunk borrows from the main bundle, handed over when it's attached (game-mount.tsx).
 * The chunk imports nothing here but types: every module it shared with the main bundle would
 * re-split the bundle's chunks, which costs the initial JS more than the code itself.
 */
export function grassEnv(controller: GameController): GrassEnv {
  const R = CONFIG.planetRadius;
  const mesas = controller.props.mesas;
  return {
    R,
    plazaU: PLAZA_RADIUS_U,
    noise: valueNoise,
    padDistance: (p, u) => {
      const l = padLocal(p, u, R);
      return l ? boxDistance(p, l.x, l.z) : null;
    },
    segmentDistance: (u, a, b) => pointArcDistance(u, a, b, R),
    underMesa: (n: Vector3) => mesas.some((m) => arcDistance(n, m.n, R) < mesaRadius(m.radiusU, m.seed, mesaPolar(m, n).angle) + 0.15),
    tuftAtlas: () => {
      const map = gameTexture('tuft-atlas');
      return map ? { map, rects: TEXTURES['tuft-atlas'].rects } : null;
    },
    windGlsl: WIND_GLSL,
    windUniforms,
    lamp: withLampLights,
    waveSpeed: WAVE.speed,
  };
}
