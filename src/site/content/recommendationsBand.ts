/**
 * A section's recommendations as its page shows them (documentation/sections/recommendations.md §3): the pure band,
 * with each person's photo turned into a picture of the card's size.
 */
import { picture } from './pictures';
import { recommendationBand } from './recommendations';

type Band = NonNullable<ReturnType<typeof recommendationBand>>;

export async function withPhotos(band: Band | null) {
  if (!band) return undefined;
  const items = await Promise.all(
    band.items.map(async ({ photo, ...card }) => {
      const p = photo ? await picture(photo, 'card') : undefined;
      return { ...card, ...(p ? { photo: { src: p.thumb, ...(p.dark ? { srcDark: p.dark.thumb } : {}) } } : {}) };
    }),
  );
  return { ...band, items };
}
