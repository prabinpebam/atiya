/**
 * The length limits a page's own fields have in the content contract (src/site/content/schema.ts), checked
 * as they're typed, so an over-long field is caught with a plain message before a save is tried, and the
 * words stay where they were typed (documentation/editor/spec.md §2.1).
 */
import { SUMMARY_MAX } from '../../content/limits';

const LIMITS: Record<string, { max: number; what: string }> = {
  summary: { max: SUMMARY_MAX, what: 'The summary' },
  'seo.description': { max: SUMMARY_MAX, what: 'The search description' },
};

/** What to say when a field's value (as it would be saved) is over its limit, or null when it fits (or the field has none). */
export function tooLong(field: string, value: string): string | null {
  const limit = LIMITS[field];
  if (!limit) return null;
  // the length the content check counts (a string's length)
  const n = value.length;
  return n > limit.max ? `${limit.what} is ${n} characters: keep it to ${limit.max}.` : null;
}
