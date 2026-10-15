/**
 * The welcome on a site without the owner's residents (desktop plan M3a): the site's own person says hello, in
 * their words if Little planet's structure has some (`welcome`), else a generic hello; then how to get about and
 * where the rest is written down, as Prabin's welcome does (world/home/welcome.ts). Pure: /play renders it at
 * build time, so it shows from the first paint.
 */
export function siteWelcomeLines(o: { name: string; lines?: readonly string[]; touch: readonly string[] | null; back: boolean }): string[] {
  const board = 'The notice board by the path to the Lighthouse has all the controls and tips. Have fun!';
  if (o.back) return ['Welcome back to my little planet! Have a look round.', board];
  const hello = o.lines?.length ? [...o.lines] : [`Hi, I’m ${o.name}. Welcome to my little planet! Each building holds part of my site: walk up to one to see what’s inside.`];
  return [
    ...hello,
    ...(o.touch ?? ['Walk with W A S D or the arrow keys, and hold Shift to run. Drag the planet to turn the view.', 'Press E to open a building, or to use what a gold ring glows round, and Space to close it again.']),
    'There’s a lantern in your backpack for the evenings: pick it in your hotbar and it lights the way.',
    board,
  ];
}

/** A name's initials, for a talk box without a picture: at most two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)!] : words;
  return letters.map((w) => [...w][0]?.toUpperCase() ?? '').join('') || '?';
}
