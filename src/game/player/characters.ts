import { withBase } from '../platform/base';

/** The two player characters (both built by scripts/build-character.mjs from the CC0 Kenney rig). */
export const CHARACTERS = [
  {
    id: 'skater',
    url: withBase('/models/character.glb'),
    portrait: withBase('/avatars/skater.webp'),
    label: 'Skater in a red T-shirt and jeans',
  },
  {
    id: 'sunny',
    url: withBase('/models/character-female.glb'),
    portrait: withBase('/avatars/sunny.webp'),
    label: 'Girl in a yellow T-shirt with a ponytail',
  },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]['id'];

export const DEFAULT_CHARACTER: CharacterId = 'skater';

export const isCharacterId = (v: unknown): v is CharacterId => CHARACTERS.some((c) => c.id === v);

export function characterById(id: CharacterId) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
