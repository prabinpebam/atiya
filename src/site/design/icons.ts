/**
 * The site's icons (tier 0, with the tokens): Font Awesome Pro *Duotone*, licensed to the site's owner,
 * as data. Only the icons the site uses are imported (`src/site/design/icon-set.json`, by
 * `node scripts/import-site-icons.mjs <name>=<font-awesome-name>`, into the generated `iconData.ts`).
 * Components draw them as inline SVG (`svgOf`): two layers, the primary in the text colour and the
 * secondary in the marigold spot colour (base.css; `data-tone="tonal"` for both in the text colour).
 * No icon font, CDN or package. The design library shows them all (/design/tokens/icons/).
 * Docs: documentation/site-ui/design-system.md §2.
 */
import { ICON_DATA, type IconPaths } from './iconData';

export const ICONS = ICON_DATA;

export type IconName = keyof typeof ICON_DATA;

export interface SvgData {
  /** The box to draw it in. */
  viewBox: string;
  /** Its Font Awesome name (data-icon). */
  name: string;
  /** The <svg>'s content: the secondary layer (if it has one) under the primary. */
  body: string;
  /** Whether it has a second layer. */
  duo: boolean;
}

/** An icon as the parts of an inline <svg>. */
export function svgOf(name: IconName): SvgData {
  const i = ICON_DATA[name] as IconPaths;
  const secondary = i.secondary ? `<path class="icon-secondary" d="${i.secondary}"/>` : '';
  return {
    viewBox: `0 0 ${i.width} 512`,
    name: i.fa.split('/').pop()!,
    body: `${secondary}<path class="icon-primary" d="${i.primary}"/>`,
    duo: i.secondary.length > 0,
  };
}
