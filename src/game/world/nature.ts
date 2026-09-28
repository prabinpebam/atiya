/**
 * The living ground cover: the wildlife and the blade grass, one on-demand chunk (game-mount.tsx).
 * They're loaded together because a new dynamically imported entry re-splits the main bundle's
 * shared chunks (each module is grouped by the set of entries that reach it), which costs the
 * initial JS more than either one's code.
 */
export { Wildlife, prepareWildlife } from './Wildlife';
export { grassView, prepareGrass } from './grass';
// the summoning's puffs of sparkles (progressive-loading.md §5.5)
export { SummonFx } from './summonFx';
// and what E would use, marked in the world (the rings and sparkles: design-system.md §6.5)
export { ActivationCues } from './cues';
