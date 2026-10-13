/**
 * The shapes some pictures are shown in (documentation/content/media.md §9): where the design frames a
 * picture at a fixed ratio, that ratio, and the widest the picture is shown (px), so a picture at least that
 * wide stays sharp. The components frame to these; edit mode shows them as a tip beside the picture's field
 * and offers them in its crop, so a picture can be made the right shape rather than cropped blindly.
 */
export interface PictureSpec {
  /** The field's name in edit mode. */
  label: string;
  /** Its ratio, as the Image fundamental takes it. */
  ratio: '3/2' | '21/9';
  /** crop: by default the design crops a picture of another shape to it (around its focus point); whole: by default it shows it whole in a frame of it. A page can choose otherwise (its display). */
  fit: 'crop' | 'whole';
  /** The widest it's shown (px): a picture at least this wide stays sharp. */
  width: number;
  /** Where and how it shows, for the tip ("Shown …"). */
  shown: string;
}

export const PICTURE_SPECS = {
  lead: { label: 'Lead picture', ratio: '21/9', fit: 'crop', width: 2400, shown: 'across the top of its page in a 21:9 frame, filling it (cropped around its focus point) unless it’s set to fit, actual size or tile' },
  thumbnail: { label: 'Thumbnail', ratio: '3/2', fit: 'whole', width: 960, shown: 'on cards (a section’s list, the home page, the planet) in a 3:2 frame, whole unless it’s set to fill, actual size or tile' },
} as const satisfies Record<string, PictureSpec>;

export type PictureUse = keyof typeof PICTURE_SPECS;

/** A ratio such as "21/9" as a number (width over height). */
export const ratioValue = (ratio: string): number => {
  const [w, h] = ratio.split('/').map(Number);
  return w / h;
};

/** The width of a whole fitted image, as a percentage of its fixed-ratio frame. */
export const fittedWidth = (width: number, height: number, ratio: string): number => Math.min(1, width / height / ratioValue(ratio)) * 100;

/**
 * A picture's `sizes` when it's shown whole in a frame of another shape, so narrower than the frame its
 * `sizes` describes (a square thumbnail takes two thirds of a 3:2 card): each width times its share (0 to 1),
 * rounded up to a tenth, so the browser fetches the file for the width the picture really shows at.
 */
export function fittedSizes(sizes: string, share: number): string {
  if (!(share > 0 && share < 1)) return sizes;
  return sizes
    .split(',')
    .map((entry) => entry.replace(/(\d*\.?\d+)(vw|rem|px)(\s*)$/, (_, n: string, unit: string, end: string) => `${Math.ceil(Math.round(Number(n) * share * 1e7) / 1e6) / 10}${unit}${end}`))
    .join(',');
}

/** The smallest picture that stays sharp in a use: its spec's width, and the height its ratio gives. */
export const sharpSize = (spec: PictureSpec) => ({ width: spec.width, height: Math.round(spec.width / ratioValue(spec.ratio)) });

/** The tip beside a picture's field, and over its crop: where it shows, and the shape and size it's best at. */
export function specTip(spec: PictureSpec): string {
  const s = sharpSize(spec);
  return `Shown ${spec.shown}. Best at ${spec.ratio.replace('/', ':')}, at least ${s.width} × ${s.height} px.`;
}
