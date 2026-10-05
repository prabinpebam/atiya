/**
 * The build's provenance record (documentation/access/spec.md §6.2): every file the build makes from a
 * private master, and every protected page, written as it's made, so the sealer knows each by where it
 * came from rather than by guessing from a page. One JSON line per entry, in a file the seal integration
 * empties when a build starts. Node only: the build's renderers and integrations write it; nothing in a
 * page reads it.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type ProvenanceEntry =
  /** A file in the build made from a private master: its URL path (with the base), and the master. */
  | { kind: 'asset'; url: string; master: string }
  /** A protected page: its route (without the base) and its access. */
  | { kind: 'page'; route: string; access: 'locked' | 'private'; id: string };

export const PROVENANCE_FILE = join(process.cwd(), 'node_modules', '.cache', 'site-protected', 'provenance.jsonl');

export function resetProvenance(file = PROVENANCE_FILE): void {
  rmSync(file, { force: true });
  mkdirSync(dirname(file), { recursive: true });
}

export function recordProvenance(entry: ProvenanceEntry, file = PROVENANCE_FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(entry) + '\n');
}

export function readProvenance(file = PROVENANCE_FILE): ProvenanceEntry[] {
  if (!existsSync(file)) return [];
  const seen = new Set<string>();
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l && !seen.has(l) && seen.add(l))
    .map((l) => JSON.parse(l) as ProvenanceEntry);
}
