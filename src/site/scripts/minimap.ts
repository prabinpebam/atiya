/**
 * The article minimap's rules (tier 0; docs: documentation/site-ui/minimap.md). Pure and unit-tested;
 * ArticleMinimap's script does the DOM: it finds the landmarks, draws the strip and wires the input.
 */

/** A landmark on the strip: a heading, a standalone picture, or a gallery or carousel (one, whatever it holds). */
export type Kind = 'heading' | 'image' | 'gallery';

export interface Landmark {
  kind: Kind;
  /** A heading's level (1 to 6). */
  level?: number;
  /** What the tooltip says first: the heading's text, the picture's alt text or caption, the gallery's name. */
  label: string;
  /** How many pictures a gallery holds. */
  count?: number;
}

/** The reading line, as a share of the scrolling area's height from its top. */
export const READING_LINE = 0.25;
/** Where a landmark lands after a jump, as a share of the area's height below its top. */
export const JUMP_RATIO = 0.18;
/** The dock-like wave: how much of the magnification the active indicator and its three neighbours each side take. */
export const WAVE = [1, 0.6, 0.32, 0.12] as const;
/** The least a picture must measure (px, rendered) to be a landmark: icons and emoji aren't. */
export const MIN_IMAGE = 96;

/**
 * The landmark being read: the last one whose top has passed the reading line. Before the first reaches
 * it, the first. `tops` are measured from the top of the scrolling area, in document order.
 */
export function currentIndex(tops: readonly number[], line: number): number {
  let current = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= line) current = i;
  return current;
}

/**
 * The reading line, px from the top of the scrolling area: a quarter of the way down what's left under
 * any sticky header. So a landmark a jump brings in (18% below the header) is always past it: the
 * indicator just chosen is the current one.
 */
export function readingLine(viewHeight: number, sticky = 0): number {
  return sticky + READING_LINE * Math.max(0, viewHeight - sticky);
}

/** How much of the magnification the indicator at `index` takes while `active` is hovered or focused (0 to 1). */
export function waveAt(index: number, active: number | null): number {
  if (active === null) return 0;
  return WAVE[Math.abs(index - active)] ?? 0;
}

/**
 * Edge auto-scroll: how many px per frame to scroll the strip for a pointer at `y` px from its top, in a
 * strip `height` px tall. Negative scrolls up, positive down, 0 outside the edge zones; faster nearer the edge.
 */
export function edgeSpeed(y: number, height: number, zone: number, max: number): number {
  if (height <= 0 || zone <= 0) return 0;
  const zoneAt = Math.min(zone, height / 2);
  if (y < zoneAt) return -max * Math.min(1, (zoneAt - Math.max(y, 0)) / zoneAt);
  if (y > height - zoneAt) return max * Math.min(1, (y - (height - zoneAt)) / zoneAt);
  return 0;
}

/**
 * Where to scroll so a landmark lands a comfortable way below the top: `top` is its position within the
 * scrolled content; it lands 18% of the area's height below the top (never less than `minGap`), plus
 * any sticky header (`sticky`). Never above the start.
 */
export function jumpTarget(top: number, viewHeight: number, sticky: number, minGap: number): number {
  return Math.max(0, top - (Math.max(JUMP_RATIO * viewHeight, minGap) + sticky));
}

/** The list's identity: a new list is drawn only when this changes (count, kinds, levels, labels). */
export function signature(list: readonly Landmark[]): string {
  return list.map((l) => `${l.kind}:${l.level ?? ''}:${l.count ?? ''}:${l.label}`).join('\n');
}

/** The tooltip's second line: "Heading 2", "Image", "Gallery · 6 images". */
export function kindText(l: Landmark): string {
  if (l.kind === 'heading') return `Heading ${l.level ?? 2}`;
  if (l.kind === 'image') return 'Image';
  const n = l.count ?? 0;
  return n > 0 ? `Gallery · ${n} ${n === 1 ? 'image' : 'images'}` : 'Gallery';
}

/** An indicator's accessible name: the kind and the label, "Jump to heading: Pictures, given room". */
export function accessibleName(l: Landmark): string {
  const kind = l.kind === 'heading' ? 'heading' : l.kind === 'image' ? 'image' : 'gallery';
  return `Jump to ${kind}: ${l.label}`;
}

/** Collapse whitespace and keep a label to a readable length. */
export function tidy(text: string | null | undefined, max = 140): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Whether a picture is a landmark: it has something to say (alt text or a caption, and isn't hidden or
 * decorative) and it's big enough to be a picture rather than an icon or an emoji.
 */
export function isMeaningfulImage(img: { alt: string | null; caption?: string | null; hidden: boolean; width: number; height: number }): boolean {
  if (img.hidden) return false;
  if (!tidy(img.alt) && !tidy(img.caption)) return false;
  return img.width >= MIN_IMAGE && img.height >= MIN_IMAGE / 2;
}

/** Whether a heading only repeats the page's own title (the article's title is left out then). */
export function repeatsTitle(heading: string, pageTitle: string): boolean {
  const norm = (s: string) => tidy(s).toLowerCase();
  const h = norm(heading);
  return h.length > 0 && norm(pageTitle).includes(h);
}
