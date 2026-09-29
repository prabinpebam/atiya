/**
 * The classic site's sections (the landmarks' content, the same as the planet's): in order, as the
 * header's navigation and as a contents list. Shared by the classic pages.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { withBase } from './design/meta';
import type { NavItem } from './components/compounds/SiteHeader.astro';

export type Section = CollectionEntry<'landmarks'>;

export async function classicSections(): Promise<Section[]> {
  return (await getCollection('landmarks')).sort((a, b) => a.data.order - b.data.order);
}

export const sectionHref = (id: string) => withBase(`/classic/${id}/`);

export function classicNav(sections: Section[], current?: string): NavItem[] {
  return sections.map((s) => ({ label: s.data.title, href: sectionHref(s.id), current: s.id === current }));
}

/** The header's way back into the planet, at this section's landmark if there is one. */
export function exploreAction(at?: string) {
  return {
    label: 'Explore in 3D',
    href: withBase(at ? `/play/?at=${at}` : '/play/'),
    icon: 'planet' as const,
    data: { 'data-site-mode': 'play' } as Record<`data-${string}`, string>,
  };
}
