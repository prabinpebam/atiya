/**
 * The public overlay (gallery plan G1 item 9): made-up content a test build reads beside the real
 * content, so the E2E tests have an album of every kind without one ever going into content/. Only its
 * articles, their media and its structure's sections are used: a section the real structure has (by ID)
 * gets the overlay's pages after its own, and a new one joins the home's sections. Its own site settings
 * and people are for the tests that load it alone, and are never read.
 *
 * Read by the content source in a test build (`astro build --mode test`, integrations/roots.mjs) and by
 * the editor's test server, which copies it into its copy of the content. No imports: Node runs it as is.
 */

/** Where an overlay's files go, by their path under its folder: what's added, what's merged, what's left out. */
export function overlayRole(rel: string): 'add' | 'structure' | 'skip' {
  if (rel === 'structures/site.json') return 'structure';
  return /^(articles|media)\//.test(rel) ? 'add' : 'skip';
}

interface TreeNode {
  id: string;
  children?: TreeNode[];
  [k: string]: unknown;
}

/**
 * The real site structure with the overlay's sections merged in: a new structure, neither argument
 * changed (a snapshot's documents are shared). A page already in the section isn't added twice.
 */
export function mergeOverlayStructure(real: unknown, overlay: unknown): unknown {
  const r = real as { home?: TreeNode } | null;
  const o = overlay as { home?: TreeNode } | null;
  if (!r?.home || !o?.home?.children?.length) return real;
  const sections = [...(r.home.children ?? [])];
  for (const added of o.home.children) {
    const at = sections.findIndex((s) => s.id === added.id);
    if (at < 0) {
      sections.push(added);
      continue;
    }
    const own = sections[at].children ?? [];
    const ids = new Set(own.map((c) => c.id));
    sections[at] = { ...sections[at], children: [...own, ...(added.children ?? []).filter((c) => !ids.has(c.id))] };
  }
  return { ...r, home: { ...r.home, children: sections } };
}
