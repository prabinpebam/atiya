/**
 * The design library's side navigation: the overview, the token pages, then every fundamental,
 * compound and layout (from the registry, so a new component appears without editing this).
 */
import { TIERS, byTier, routeOf } from './registry';
import { withBase } from '../design/meta';

export const TOKEN_PAGES = [
  { slug: 'color', label: 'Colour', summary: 'Paper, ink, the indigo spot and the marigold highlighter, in light and dark.' },
  { slug: 'typography', label: 'Typography', summary: 'Three faces, one ramp, and the axes that make the display type soft.' },
  { slug: 'space', label: 'Space and size', summary: 'The spacing scale, the fluid whitespace and the page widths.' },
  { slug: 'shape', label: 'Shape', summary: 'Radii, borders and the few shadows.' },
  { slug: 'motion', label: 'Motion', summary: 'Durations and easings, and what moves.' },
  { slug: 'layers', label: 'Layers and breakpoints', summary: 'The z-index scale, the breakpoints and the component tokens.' },
  { slug: 'icons', label: 'Icons', summary: 'The Font Awesome Duotone icons the site uses, in both tones.' },
] as const;

export type NavGroup = { title: string; items: { label: string; href: string; current?: boolean; note?: string }[] };

/** The groups, with the page at `path` (without the base) marked current. */
export function libraryNav(path: string): NavGroup[] {
  const at = (href: string) => ({ href: withBase(href), current: path === href });
  return [
    { title: 'Start', items: [{ label: 'Overview', ...at('/design/') }] },
    { title: 'Tokens', items: TOKEN_PAGES.map((p) => ({ label: p.label, ...at(`/design/tokens/${p.slug}/`) })) },
    ...TIERS.map((t) => ({
      title: t.title,
      items: byTier(t.tier).map((e) => ({ label: e.name, ...at(routeOf(e)) })),
    })),
  ];
}
