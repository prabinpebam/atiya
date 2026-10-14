/**
 * The modes the engine carries (documentation/desktop/modes.md §8.1). Today that's the planet, whose
 * structure is still content/structures/planet.json (each building's words and the section it shows);
 * phase M1 moves it to content/structures/modes/<id>.json.
 */
import { PLACE_IDS, planetStructure } from '../content/schema';
import { modeManifest, type BuiltinMode } from './contract';

const littlePlanet: BuiltinMode = {
  manifest: modeManifest.parse({
    api: 1,
    id: 'little-planet',
    name: 'Little planet',
    version: '1.0.0',
    summary: 'Walk around a small planet. Each building holds one of your sections.',
    author: { name: 'Atiya' },
    licence: 'MIT',
    entry: 'src/game/game-mount.tsx',
    mount: 'play',
    label: 'Explore the planet',
    poster: { image: 'poster/planet.webp', alt: 'A small green planet with seven buildings round a plaza' },
    requires: { webgl: 2, pointer: 'any' },
    readyTimeoutS: 20,
    budgets: { criticalKB: 450, laterChunkKB: 150, beforeLiveKB: 1600 },
    slots: { kind: 'fixed', ids: [...PLACE_IDS] },
    frame: { otherSlot: 'note' },
    network: [],
  }),
  structureFile: 'structures/planet.json',
  readStructure: (raw) => {
    const planet = planetStructure.parse(raw);
    return {
      slots: planet.places.map((p) => ({ id: p.id, section: p.site, words: { title: p.title, kicker: p.kicker, summary: p.summary } })),
    };
  },
};

/** Every built-in mode, by ID. */
export const BUILTIN_MODES: ReadonlyMap<string, BuiltinMode> = new Map([[littlePlanet.manifest.id, littlePlanet]]);
