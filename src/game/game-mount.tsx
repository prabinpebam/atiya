import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameController } from './controller';
import { GameApp } from './GameApp';
import type { LandmarkData } from './types';
import { grassEnv } from './world/grassEnv';
import { preloadTextures } from './world/textures';

/**
 * Dynamically imported by the /play capability gate only after the device passes.
 * Everything React/three-related lives behind this module boundary.
 */
export async function mountGame(container: HTMLElement, landmarks: LandmarkData[], opts: { quality?: 'high' | 'low' } = {}): Promise<GameController> {
  const controller = new GameController(
    landmarks,
    {
      classicLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-classic-link]')),
      hudActions: document.getElementById('hud-actions'),
    },
    opts,
  );
  if (import.meta.env.MODE !== 'production') {
    const { installTestHook } = await import('./debug/testHook');
    installTestHook(controller);
  }
  // hand-painted textures are small; materials read them synchronously, so load them first
  // (never throws: anything missing falls back to the procedural look). Chopper's body comes in its
  // own chunk meanwhile, so his material compiles with the rest of the scene before the first frame.
  // The home and family by the pond come the same way (family.md), and so do the crafting table and Chopper's house
  // (crafting.md) and the wildlife.
  const [, chopper, home, craft, nature, touch] = await Promise.all([
    preloadTextures(),
    import('./world/Chopper').catch(() => null),
    import('./world/home').catch(() => null),
    import('./world/craft').catch(() => null),
    // the wildlife and the blade grass (vegetation/): one chunk
    import('./world/nature').catch(() => null),
    // touch controls (game-ui/touch.md): only where there's a touchscreen
    matchMedia('(any-pointer: coarse)').matches ? import('./input/touch').catch(() => null) : null,
  ]);
  controller.touch = touch?.attachTouch(controller) ?? null;
  controller.chopperView = chopper?.Chopper ?? null;
  // his mind (sharing the position the targets already use)
  if (chopper) controller.attachChopper(new chopper.ChopperBrain(Math.random, controller.chopper.n, controller.chopper.dir));
  controller.wildlifeView = nature?.Wildlife ?? null;
  controller.cuesView = nature?.ActivationCues ?? null;
  controller.grassView = nature ? nature.grassView(grassEnv(controller)) : null;
  try {
    controller.attachHome(home?.attachHome(controller) ?? null);
  } catch (err) {
    console.warn('The home by the pond failed to load.', err);
  }
  try {
    controller.attachCraft(craft?.attachCraft(controller) ?? null);
  } catch (err) {
    console.warn('The crafting table failed to load.', err);
  }
  container.replaceChildren();
  createRoot(container).render(
    <StrictMode>
      <GameApp controller={controller} />
    </StrictMode>,
  );
  return controller;
}
