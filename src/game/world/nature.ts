/**
 * The living ground cover: the wildlife and the blade grass, one on-demand chunk (game-mount.tsx).
 * They're loaded together because a new dynamically imported entry re-splits the main bundle's
 * shared chunks (each module is grouped by the set of entries that reach it), which costs the
 * initial JS more than either one's code.
 */
export { Wildlife } from './Wildlife';
export { grassView } from './grass';
