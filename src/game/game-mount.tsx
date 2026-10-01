import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameController } from './controller';
import { GameApp } from './GameApp';
import type { LandmarkData } from './types';
import { grassEnv } from './world/grassEnv';
import { prepareGround } from './world/Planet';
import { preloadTextures, textureStatus, tierTextures } from './world/textures';

/** The page's loading scene (platform/greeting.ts), if the gate started it. */
const loadScreen = () => (window as unknown as { __loadScreen?: { progress(f: number): void; live(): void } }).__loadScreen;

/**
 * Dynamically imported by the /play capability gate only after the device passes.
 * Everything React/three-related lives behind this module boundary.
 *
 * Progressive loading (docs: poc-3d-navigation/progressive-loading.md): only what the planet needs to
 * go live is waited for here (the tier-1 textures, and the home and crafting chunks, which level the
 * ground under their buildings). The rest is summoned once it's live (world/summoner.ts).
 */
export async function mountGame(container: HTMLElement, landmarks: LandmarkData[], opts: { quality?: 'high' | 'low' } = {}): Promise<GameController> {
  const screen = loadScreen();
  screen?.progress(0.3);
  // the props (trees, rocks, flowers) are summoned, so their code isn't waited for: it comes meanwhile
  const propsChunk = import('./world/Props').catch(() => null);
  // textures first: they're the biggest download, and the world's generation runs while they come
  const textures = preloadTextures(1);
  const t1 = tierTextures(1).length;
  const poll = window.setInterval(() => {
    const s = textureStatus();
    screen?.progress(0.3 + 0.45 * Math.min(1, (s.loaded + s.failed) / Math.max(1, t1)));
  }, 100);
  const controller = new GameController(
    landmarks,
    {
      classicLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-classic-link]')),
      hudActions: document.getElementById('hud-actions'),
    },
    opts,
  );
  performance.mark('game:world');
  if (import.meta.env.MODE !== 'production') {
    const { installTestHook } = await import('./debug/testHook');
    installTestHook(controller);
  }
  // the wildlife and the blade grass (vegetation/), one chunk, aren't waited for either: they're summoned
  const natureChunk = import('./world/nature').catch(() => null);
  let grass: ReturnType<typeof grassEnv> | null = null;
  const env = () => (grass ??= grassEnv(controller));
  controller.natureLoaded = natureChunk.then((nature) => {
    if (!nature) return;
    controller.wildlifeView = nature.Wildlife;
    controller.cuesView = nature.ActivationCues;
    controller.summonFxView = nature.SummonFx;
    controller.grassView = nature.grassView(env());
  });
  controller.summoner.prepare.set('grass', async () => {
    const nature = await natureChunk;
    if (nature) await nature.prepareGrass(controller, env());
  });
  controller.summoner.prepare.set('wildlife', async () => (await natureChunk)?.prepareWildlife(controller.summoner.instant ? Infinity : 8));
  // Chopper's body, the home and family by the pond (family.md), the crafting table and Chopper's house
  // (crafting.md) come in their own chunks meanwhile. They're attached before the scene mounts (the home
  // and the crafting level the ground under what they build), and drawn once summoned.
  const [, chopper, home, craft, touch] = await Promise.all([
    textures,
    import('./world/Chopper').catch(() => null),
    import('./world/home').catch(() => null),
    import('./world/craft').catch(() => null),
    // touch controls (game-ui/touch.md): only where there's a touchscreen
    matchMedia('(any-pointer: coarse)').matches ? import('./input/touch').catch(() => null) : null,
  ]);
  window.clearInterval(poll);
  screen?.progress(0.8);
  // the summoned groups' textures (tier 2) come next, while the planet goes live; the rest when idle
  const later = preloadTextures(2);
  controller.summoner.prepare.set('prabin', () => later);
  controller.summoner.prepare.set('props', async () => {
    const props = await propsChunk;
    if (!props) return;
    controller.propsView = props.Props;
    await props.prepareProps();
  });
  void controller.summoner.done.then(() => {
    // (when the browser is idle, or after a few seconds on a page that never is)
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o: { timeout: number }) => void }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
    idle(() => void preloadTextures(3), { timeout: 3000 });
    // full planet, its header button with it, once the planet is whole (it rides in the nature chunk)
    void natureChunk.then((nature) => nature?.attachOverview(controller));
  });
  controller.touch = touch?.attachTouch(controller) ?? null;
  controller.chopperView = chopper?.Chopper ?? null;
  // his mind (sharing the position the targets already use)
  if (chopper) controller.attachChopper(new chopper.ChopperBrain(Math.random, controller.chopper.n, controller.chopper.dir));
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
  screen?.progress(0.85);
  // the ground (levelled under the buildings the chunks brought), built in slices so the welcome stays responsive
  await prepareGround(controller);
  screen?.progress(0.9);
  // the loading scene and Prabin's welcome stay over the game's root until the planet is live
  const root = document.createElement('div');
  root.className = 'game-root';
  container.prepend(root);
  createRoot(root).render(
    <StrictMode>
      <GameApp controller={controller} />
    </StrictMode>,
  );
  return controller;
}
