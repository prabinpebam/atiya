import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';
import { useStore } from 'zustand';
import { CONFIG } from './config';
import type { GameController } from './controller';
import { Scene } from './Scene';
import { Hud } from './ui/Hud';

const C = CONFIG.camera;
const R = CONFIG.planetRadius;
const pitch = (C.pitchDeg * Math.PI) / 180;

export function GameApp({ controller }: { controller: GameController }) {
  const paused = useStore(controller.store, (s) => Boolean(s.openId || s.menuOpen));
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
        aria-label="Planet explorer — use arrow keys or W A S D to move, Shift to run, E to open a place, M for the menu"
        aria-describedby="planet-help"
        onKeyDown={controller.onKeyDown}
        onKeyUp={controller.onKeyUp}
        onBlur={controller.onBlur}
        onPointerDown={() => {
          controller.focusRegion();
          if (controller.store.getState().phase === 'ready') controller.start();
        }}
      >
        <Canvas
          shadows="percentage"
          dpr={dpr}
          frameloop={paused ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          camera={{ fov: C.fov, near: 0.1, far: 130, position: [0, R + Math.sin(pitch) * C.distance, Math.cos(pitch) * C.distance] }}
          onCreated={({ gl }) => {
            gl.toneMapping = NeutralToneMapping;
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
        menu to travel directly. The classic website is always available from the header.
      </p>
      <Hud controller={controller} />
    </>
  );
}
