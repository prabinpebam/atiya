/**
 * Which picture a Bento tile draws at each of its layouts (four columns, two, one), and the width it takes
 * there: the pure half of the Bento compound (documentation/home-views/bento.md). A tile's role decides its
 * frame's shape at each layout; it draws the shape when the strength has it, else its 3:2 thumbnail.
 */
import type { CardPicture, ThumbnailShape } from './pictures';
import { sizes } from './responsive';

/** A tile's place at four columns: feature (2 by 2), tall (1 by 2), wide (2 by 1) or single. */
export type BentoRole = 'feature' | 'tall' | 'wide' | 'single';
/** The tray's layouts: its four (or two) columns, two, and one on a phone. */
export type BentoLayout = 'four' | 'two' | 'one';

// columns a role takes, and the shape of its frame, at each layout
const SPAN: Record<BentoRole, Record<BentoLayout, number>> = { feature: { four: 2, two: 2, one: 1 }, tall: { four: 1, two: 1, one: 1 }, wide: { four: 2, two: 2, one: 1 }, single: { four: 1, two: 1, one: 1 } };
const SHAPE: Record<BentoRole, Record<BentoLayout, ThumbnailShape>> = {
  feature: { four: 'thumbnail', two: 'wide', one: 'thumbnail' },
  tall: { four: 'square', two: 'square', one: 'thumbnail' },
  wide: { four: 'wide', two: 'wide', one: 'thumbnail' },
  single: { four: 'thumbnail', two: 'thumbnail', one: 'thumbnail' },
};
const RATIO = { thumbnail: '3/2', square: '1/1', wide: '21/9' } as const;
const LAYOUTS: BentoLayout[] = ['four', 'two', 'one'];

/** The pictures a tile draws: one per shape it shows, with the layouts it shows it at and the Image props (whole, in its frame's ratio, square-cornered unless asked). */
export function bentoPictures(role: BentoRole, pictures: Partial<Record<ThumbnailShape, CardPicture>> | undefined, columns: 2 | 4) {
  const cols: Record<BentoLayout, number> = { four: columns, two: 2, one: 1 };
  const share = (at: BentoLayout) => Math.round((Math.min(SPAN[role][at], cols[at]) / cols[at]) * 100);
  const out = new Map<ThumbnailShape, BentoLayout[]>();
  for (const at of LAYOUTS) {
    const want = SHAPE[role][at];
    const shape = pictures?.[want] ? want : pictures?.thumbnail ? 'thumbnail' : undefined;
    if (shape) out.set(shape, [...(out.get(shape) ?? []), at]);
  }
  return [...out].map(([shape, at]) => {
    const p = pictures![shape]!;
    const four = share('four');
    const widths = sizes(['sm', `${share('one')}vw`], ['lg', `${share('two')}vw`], ['max', `${four}vw`], four >= 100 ? 'max' : { share: 'max', of: Math.round(100 / four) });
    return { shape, at, image: { src: p.src, srcset: p.srcset, sizes: widths, alt: p.alt, width: p.width, height: p.height, display: 'fit' as const, ratio: RATIO[shape], rounded: p.rounded === true, dark: p.dark } };
  });
}
