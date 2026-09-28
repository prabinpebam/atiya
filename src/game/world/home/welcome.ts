/**
 * What Prabin says as the game starts (prabin-npc.md §8): hello, how to get about (`touch`: the touch
 * chunk's own words, else the keys) and where the rest is written down; a returning visitor gets the
 * short version. Pure and dependency-free: the /play page renders it at build time, so the welcome
 * shows from the first paint, before the game has loaded (progressive-loading.md §5.3).
 */
export function welcomeLines(touch: readonly string[] | null, back: boolean): string[] {
  const board = 'The notice board by the path to the Lighthouse has all the controls and tips. Have fun!';
  if (back) return ['Welcome back to my little planet! Have a look round.', board];
  return [
    'Hi, I’m Prabin. Welcome to my little planet! Every building here holds part of my work, so feel free to explore.',
    ...(touch ?? ['Walk with W A S D or the arrow keys, and hold Shift to run. Drag the planet to turn the view.', 'Press E to open a building, or to use what a gold ring glows round, and Space to close it again.']),
    'There’s a lantern in your backpack for the evenings: pick it in your hotbar and it lights the way.',
    board,
  ];
}
