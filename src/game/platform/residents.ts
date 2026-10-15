/**
 * Whether the planet has the owner's residents (desktop plan M3a; spec O5, O6): Chopper, the family and Prabin,
 * and his music. On for the engine's own repository, off for a site made by Atiya Studio (integrations/features.mjs).
 * A plain constant (`__GAME_RESIDENTS__`, defined by integrations/editor.mjs), so a build without them drops their
 * chunks: never branch on it at runtime from anything but a constant.
 */
declare const __GAME_RESIDENTS__: boolean | undefined;

export const RESIDENTS: boolean = typeof __GAME_RESIDENTS__ === 'boolean' ? __GAME_RESIDENTS__ : true;
