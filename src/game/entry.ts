/**
 * Little planet's entry (documentation/desktop/modes.md §5.3, plan M1.2): `mount(root, host)`, the one call the
 * host makes. It's light on purpose: it joins the world's buildings with the host's mode data, then loads the
 * game (game-mount, its own chunk) and hands back the instance. The gate imports it, so a device the gate turns
 * away fetches no game chunk.
 */
import type { ModeHost, ModeInstance } from '../../packages/mode-kit/types';
import { landmarksFrom } from './world/modeLandmarks';
import { PLACES } from './world/places';

export async function mount(root: HTMLElement, host: ModeHost): Promise<ModeInstance> {
  const landmarks = landmarksFrom(PLACES, host.data);
  // the gate has usually loaded this already (it times the chunk): then it's the module cache
  const { mountGame } = await import('./game-mount');
  const controller = await mountGame(root, landmarks, { quality: host.tier });
  return {
    goTo: (target) => {
      if (target.slot) controller.travelTo(target.slot);
    },
    // the section overlay pauses the mode (M1.3); until then the planet pauses itself while it reads
    pause: () => {},
    resume: () => {},
    unmount: async () => controller.dispose(),
  };
}
