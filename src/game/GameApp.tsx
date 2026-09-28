import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';
import { useStore } from 'zustand';
import { CONFIG } from './config';
import type { GameController } from './controller';
import { Scene } from './Scene';
import { Hud } from './ui/Hud';
import { EXPOSURE } from './world/timeOfDay';

const C = CONFIG.camera;
const R = CONFIG.planetRadius;
const pitch = (C.pitchDeg * Math.PI) / 180;

export function GameApp({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, (s) => Boolean(s.openId || s.menuOpen || s.chopperOpen));
  const dpr = useStore(controller.store, (s) => s.dpr);

  return (
    <>
      <div
        ref={(el) => {
          controller.region = el;
        }}
        className="game-region"
        tabIndex={0}
        role="region"
        aria-label="Planet explorer — use arrow keys or W A S D to move, Shift to run, E to open a place or use what you stand at (shake a tree, mine a boulder, pick a flower, open the chest, meet Chopper), Space to close it, stand up or stop talking, F to whistle for Chopper, I for the backpack, 1 to 9 for the hotbar, Q to drop, M for the menu. Comma and period rotate the view, Page Up and Page Down tilt it, N faces north, H returns to the plaza."
        aria-describedby="planet-help"
        onKeyDown={controller.onKeyDown}
        onKeyUp={controller.onKeyUp}
        onBlur={controller.onBlur}
        onPointerDown={(e) => controller.onRegionPointerDown(e)}
        onWheel={(e) => controller.onWheel(e)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Canvas
          shadows="percentage"
          dpr={dpr}
          frameloop={paused ? 'demand' : 'always'}
          // no canvas MSAA or stencil: the composer renders the scene into its own multisampled buffer
          gl={{ antialias: false, stencil: false, alpha: false, powerPreference: 'high-performance' }}
          camera={{ fov: C.fov, near: 0.1, far: 130, position: [0, R + Math.sin(pitch) * C.distance, Math.cos(pitch) * C.distance] }}
          onCreated={({ gl }) => {
            gl.toneMapping = NeutralToneMapping;
            gl.toneMappingExposure = EXPOSURE.day;
            const canvas = gl.domElement;
            canvas.setAttribute('aria-hidden', 'true');
            canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              controller.store.setState({ contextLost: true });
            });
            canvas.addEventListener('webglcontextrestored', () => controller.store.setState({ contextLost: false }));
          }}
        >
          <Scene controller={controller} />
        </Canvas>
      </div>
      <p id="planet-help" className="sr-only">
        A small planet with seven places to visit. Walk close to a building to preview it and press E to open it. Use the landmark list or the
        menu to travel directly. Drag the planet, or use the View buttons in the menu, to rotate and tilt the view; the compass button faces north
        again and Reset returns to the plaza. The classic website is always available from the header.
      </p>
      <Hud controller={controller} />
    </>
  );
}
