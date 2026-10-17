/**
 * Edit mode's Recommendations screen (documentation/sections/recommendations.md §4), pure: the list's changes
 * (add or replace one, delete one) and a section's settings written into the site structure, keeping every
 * field it doesn't change.
 */
import type { SiteStructure } from '../../content/schema';
import { DEFAULT_SETTINGS, LIMITS, type Recommendation, type RecommendationSettings, RECOMMENDATION_LAYOUTS, RECOMMENDATION_OPENINGS, RECOMMENDATION_PLACES } from '../../content/recommendations';

// what the screen's part shows, from the content's own rules (a part reads the editor model, never content code)
export { DEFAULT_HEADING, DEFAULT_SETTINGS, LAYOUT_ABOUT, LIMITS, RECOMMENDATION_LAYOUTS, moveRecommendation, recommendationIdFor, wantsProfilePhoto } from '../../content/recommendations';
export type { Recommendation, RecommendationSettings } from '../../content/recommendations';

/** The list with `rec` in place of the one with its ID, or added at the end. */
export function upsertRecommendation(items: readonly Recommendation[], rec: Recommendation): Recommendation[] {
  const i = items.findIndex((r) => r.id === rec.id);
  return i < 0 ? [...items, rec] : items.map((r, k) => (k === i ? rec : r));
}

/** The list without the one with that ID. */
export const removeRecommendation = (items: readonly Recommendation[], id: string): Recommendation[] => items.filter((r) => r.id !== id);

/** A recommendation as the form gave it: trimmed, with empty optional fields left out. */
export function cleanRecommendation(r: Recommendation): Recommendation {
  const opt = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
  const out: Recommendation = { id: r.id, name: r.name.trim(), title: r.title.trim(), text: r.text.replace(/\r\n?/g, '\n').trim() };
  const link = opt(r.link);
  const relationship = opt(r.relationship);
  const date = opt(r.date);
  if (link) out.link = link;
  if (relationship) out.relationship = relationship;
  if (date) out.date = date;
  if (r.hidden) out.hidden = true;
  if (r.photo) out.photo = r.photo;
  if (r.noPhoto) {
    delete out.photo;
    out.noPhoto = true;
  }
  return out;
}

/** A section's settings as the form gave them: `after` only with `at: after`, no empty heading or intro. */
export function cleanSettings(s: Partial<RecommendationSettings>): RecommendationSettings {
  const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);
  const out: RecommendationSettings = {
    show: !!s.show,
    at: pick(s.at, RECOMMENDATION_PLACES, DEFAULT_SETTINGS.at),
    layout: pick(s.layout, RECOMMENDATION_LAYOUTS, DEFAULT_SETTINGS.layout),
    open: pick(s.open, RECOMMENDATION_OPENINGS, DEFAULT_SETTINGS.open),
  };
  if (out.at === 'after' && s.after) out.after = s.after;
  const heading = s.heading?.trim().slice(0, LIMITS.heading);
  const intro = s.intro?.trim().slice(0, LIMITS.intro);
  if (heading) out.heading = heading;
  if (intro) out.intro = intro;
  return out;
}

/** The structure with a section's settings replaced (null: no such section). Every other field is kept. */
export function withSectionSettings(tree: SiteStructure, sectionId: string, settings: RecommendationSettings): SiteStructure | null {
  let found = false;
  const children = (tree.home.children ?? []).map((n) => {
    if (n.kind !== 'hub' || n.id !== sectionId) return n;
    found = true;
    return { ...n, recommendations: settings };
  });
  return found ? { ...tree, home: { ...tree.home, children } } : null;
}

/** The section the screen opens on: the one asked for, else About, else the first. */
export function chosenSection(sections: readonly { id: string; title: string }[], asked: string | null): string | undefined {
  return (
    sections.find((s) => s.id === asked)?.id ??
    sections.find((s) => s.id === 'about' || s.title.trim().toLowerCase() === 'about')?.id ??
    sections[0]?.id
  );
}
