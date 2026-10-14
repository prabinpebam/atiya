/**
 * The planet's buildings from mode data (documentation/desktop/modes.md §5.2, M1): the world's places
 * (fixed, in code) joined with what the host's data says each slot shows. Pure. It reads only the fields
 * below, declared here, so the game imports nothing from the site.
 */
import type { LandmarkData } from '../types';
import type { PlaceWorld } from './places';

/** What the planet reads of `ModeData`. */
export interface PlanetModeData {
  sections: Array<{ id: string; url: string; pages: Array<{ id: string; title: string; url: string }> }>;
  slots: Array<{ id: string; section: string | null; words: Record<string, string> }>;
  links: { home: string };
}

/**
 * @param places the world's buildings, in their order
 * @param data the host's data for this mode
 */
export function landmarksFrom(places: readonly PlaceWorld[], data: PlanetModeData): LandmarkData[] {
  return places.map((world) => {
    const slot = data.slots.find((s) => s.id === world.id);
    if (!slot) throw new Error(`the planet's structure has no ${world.id}`);
    const section = slot.section ? data.sections.find((s) => s.id === slot.section) : undefined;
    return {
      ...world,
      title: slot.words.title ?? '',
      kicker: slot.words.kicker ?? '',
      summary: slot.words.summary ?? '',
      pages: (section?.pages ?? []).map((p) => ({ id: p.id, title: p.title, href: p.url })),
      siteHref: section?.url ?? `${data.links.home}#sections`,
    };
  });
}
