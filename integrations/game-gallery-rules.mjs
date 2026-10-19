/**
 * When the game's gallery is built (integrations/game-gallery.mjs), pure so a unit test holds it: in
 * development (`astro dev`, unless run with `--mode production`) and in a build with a mode other than
 * production (`astro build --mode test`); never in a plain `astro build`, which is production.
 */

/** Where the gallery's page is. */
export const GALLERY_ROUTE = '/play/gallery';

/** The `--mode` a command was run with, if any. */
export function modeOf(/** @type {readonly string[]} */ argv) {
  const i = argv.findIndex((a) => a === '--mode' || a.startsWith('--mode='));
  if (i < 0) return undefined;
  return argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
}

/** Whether a command (`dev`, `build`, `preview`, `sync`) with these arguments gets the gallery. */
export function galleryWanted(/** @type {string} */ command, /** @type {readonly string[]} */ argv) {
  const mode = modeOf(argv) ?? (command === 'dev' ? 'development' : 'production');
  return (command === 'dev' || command === 'build') && mode !== 'production';
}
