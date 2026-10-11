/** The content contract's length limits (schema.ts), on their own so the editor's browser code can read them without the schema. */

/** The longest a page's summary may be: the standfirst under its title, and the line on its cards. */
export const SUMMARY_MAX = 240;

/** The longest a search description may be: what search results and link previews show before they cut it. */
export const SEARCH_DESCRIPTION_MAX = 160;

/**
 * A page's text as a search description: as it is when it fits, otherwise cut at the last word that fits,
 * with an ellipsis, so search results never cut it mid-word themselves.
 */
export function searchCopy(text: string, max = SEARCH_DESCRIPTION_MAX): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const room = t.slice(0, max - 1);
  const at = room.lastIndexOf(' ');
  return `${(at > max / 2 ? room.slice(0, at) : room).replace(/[\s,;:.–—-]+$/, '')}…`;
}
