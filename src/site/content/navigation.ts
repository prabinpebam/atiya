/**
 * The site's top navigation, from the site structure's `menus.primary` (documentation/sections/spec.md
 * §4): each entry's label and address, and which one is current. And the header's one action, "Explore
 * in 3D", which follows the page. Pure: the structure and the routes come in, so the rules are unit-tested.
 */
import { withBase } from '../design/meta';
import type { Route } from './routes';
import type { PlanetStructure, SiteStructure } from './schema';

export interface NavLink {
  label: string;
  href: string;
  current?: boolean;
}

/**
 * The navigation's entries, in order. A node's entry takes its own label, else the node's (its navLabel,
 * else its title); it's current on its own page and, for a section, on every page in it. A node that isn't
 * built (a draft page) is left out until it's published; a custom link is never current.
 * @param routes the built (published) routes
 * @param current the page being shown, if it's one of the tree's
 */
export function siteNav(structure: SiteStructure, routes: Route[], current?: Route): NavLink[] {
  return (structure.menus?.primary ?? []).flatMap((e): NavLink[] => {
    if (!('node' in e)) return [{ label: e.label, href: e.href.startsWith('/') ? withBase(e.href) : e.href }];
    const r = routes.find((x) => x.node.id === e.node);
    if (!r) return [];
    const here = !!current && (current.path === r.path || (r.path !== '/' && current.path.startsWith(r.path)));
    return [{ label: e.label ?? r.label, href: withBase(r.path), ...(here ? { current: true } : {}) }];
  });
}

/**
 * Where "Explore in 3D" goes from a page of the site (documentation/sections/spec.md §6.6): a page that's
 * on the planet, to its building, open at that page; a section, to the building that points to it (its
 * `site`); anything else, the plaza.
 */
export function exploreHref(route?: Route, planet?: PlanetStructure | null): string {
  const places = planet?.places ?? [];
  const node = route?.node;
  if (node?.kind === 'item') {
    const place = places.find((p) => p.pages.some((r) => r.id === node.item.id));
    if (place) return withBase(`/play/?at=${place.id}&open=1&page=${node.item.id}`);
  }
  const place = node?.kind === 'hub' ? places.find((p) => p.site === node.id) : undefined;
  return withBase(place ? `/play/?at=${place.id}` : '/play/');
}

/** The header's action: into the planet, from this page. */
export function exploreAction(route?: Route, planet?: PlanetStructure | null) {
  return {
    label: 'Explore in 3D',
    href: exploreHref(route, planet),
    icon: 'planet' as const,
    data: { 'data-site-mode': 'play' } as Record<`data-${string}`, string>,
  };
}
