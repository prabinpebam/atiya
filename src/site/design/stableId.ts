/**
 * Element IDs a component makes for itself (a field's label, a header's menu), the same in every build of
 * the same page: from the component's own props and its place among identical ones on the page, never a
 * random number. Two builds of one site from one commit are then byte for byte the same, which the parity
 * check (documentation/desktop/spec.md §6.4) needs and caching likes.
 *
 * Two components with the same props render the same markup but for the ID, so which one is counted first
 * doesn't change the page.
 */

/** What a component has: its props and the page's request (one per page render). */
type Caller = { props: unknown; request: object };

const seen = new WeakMap<object, Map<string, number>>();

/** FNV-1a, 32-bit, as six base-36 characters. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0').slice(-6);
}

/**
 * A short ID part for a component on this page: six characters, with `-2`, `-3`… for a second, third
 * component of the same kind and props.
 * @param astro the component's `Astro`
 * @param kind the component's name, so two kinds with the same props differ
 */
export function stableId(astro: Caller, kind: string): string {
  let seed: string;
  try {
    seed = `${kind}\u0000${JSON.stringify(astro.props) ?? ''}`;
  } catch {
    seed = kind;
  }
  const h = hash(seed);
  let page = seen.get(astro.request);
  if (!page) seen.set(astro.request, (page = new Map()));
  const n = (page.get(h) ?? 0) + 1;
  page.set(h, n);
  return n === 1 ? h : `${h}-${n}`;
}
