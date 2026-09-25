import { withBase } from '../../platform/base';

/**
 * Chopper's profile card text (docs: chopper.md §5). This is a tribute, so it holds only what his
 * owner has said about him. The optional fields are for the owner to fill in; empty ones are hidden.
 */
export interface ChopperProfile {
  name: string;
  breed: string;
  coat: string;
  /** A line in his memory. */
  memorial: string;
  /** What he's up to on the planet (the behaviours his owner described). */
  onThePlanet: readonly string[];
  photos: ReadonlyArray<{ src: string; alt: string; width: number; height: number }>;
  /** Owner to fill in (optional): e.g. "2012 – 2026", a nickname, favourite things, a short story. */
  years?: string;
  nickname?: string;
  favourites?: readonly string[];
  story?: string;
}

export const CHOPPER: ChopperProfile = {
  name: 'Chopper',
  breed: 'Lhasa Apso',
  coat: 'Fluffy white, with black patches and black ears',
  memorial: 'This little planet is his to run free on.',
  onThePlanet: [
    'Runs about by himself, never far from you',
    'Sniffs every tree and rock he passes',
    'Chases the rabbits and barks after them',
    'Picks up a scent and follows the trail',
    'Play-bows at the bushes, barking',
    'Runs on ahead, then sits and waits for you to catch up',
    'Comes running when you whistle (F)',
  ],
  photos: [
    { src: withBase('/chopper/chopper-1.webp'), alt: 'Chopper, a fluffy white Lhasa Apso with long black ears and a blue collar with a red bone tag, lying on a wooden table', width: 900, height: 738 },
    { src: withBase('/chopper/chopper-2.webp'), alt: 'Chopper stretched out on his side on a brown leather couch, his plumed tail behind him', width: 900, height: 622 },
  ],
};
