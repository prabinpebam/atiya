/**
 * The site's top navigation, from the site structure's `menus.primary` (documentation/sections/spec.md
 * §4): each entry's label and address, and which one is current. And the header's one action, "Explore
 * in 3D", which follows the page. Pure: the structure and the routes come in, so the rules are unit-tested.
 */
import { withBase } from '../design/meta';
import type { Route } from './routes';
import type { Redirect, SiteStructure } from './schema';

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
 * Where "Explore in 3D" goes from a page of the site: to the building its section came from (the one whose
 * old classic address redirects to it), else the plaza. The planet structure's own links replace this
 * (documentation/sections/plan.md, S4).
 */
export function exploreHref(route?: Route, redirects: Redirect[] = []): string {
  const section = route && (route.ancestors.length > 1 ? route.ancestors[1].path : route.ancestors.length === 1 ? route.path : undefined);
  const from = section && redirects.find((r) => r.to === section)?.from;
  const building = from && /^\/classic\/([a-z0-9-]+)\/$/.exec(from)?.[1];
  return withBase(building ? `/play/?at=${building}` : '/play/');
}

/** The header's action: into the planet, from this page. */
export function exploreAction(route?: Route, redirects: Redirect[] = []) {
  return {
    label: 'Explore in 3D',
    href: exploreHref(route, redirects),
    icon: 'planet' as const,
    data: { 'data-site-mode': 'play' } as Record<`data-${string}`, string>,
  };
}
