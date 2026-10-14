/**
 * The modes the engine carries (documentation/desktop/modes.md §8.1). Today that's the planet, whose structure
 * (each building's words and the section it shows) is content/structures/modes/little-planet.json; its old place,
 * content/structures/planet.json, is still read during the move (M1.1).
 */
import { PLACE_IDS, planetStructure } from '../content/schema';
import { LEGACY_PLANET_FILE, PLANET_FILE, modeManifest, type BuiltinMode } from './contract';

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
  structureFile: PLANET_FILE,
  legacyStructureFile: LEGACY_PLANET_FILE,
  readStructure: (raw) => {
    const planet = planetStructure.parse(raw);
    return {
      slots: planet.places.map((p) => ({ id: p.id, section: p.site, words: { title: p.title, kicker: p.kicker, summary: p.summary } })),
    };
  },
};

/** Every built-in mode, by ID. */
export const BUILTIN_MODES: ReadonlyMap<string, BuiltinMode> = new Map([[littlePlanet.manifest.id, littlePlanet]]);
