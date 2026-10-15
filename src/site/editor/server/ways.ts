/**
 * Saving which ways to explore are on (desktop plan stage 8A), for the Ways to explore screen and the action
 * center's switches (documentation/desktop/action-center.md §8.3): the little planet turned on for a site that's
 * never had it gets its starting map in the same transaction, or is refused when there aren't enough sections.
 */
import type { SiteStructure } from '../../content/schema';
import { WAYS_FILE, type Ways } from '../../modes/contract';
import { isOn } from '../../modes/ways';
import { LITTLE_PLANET, PLANET_NEEDS, startingPlanet } from '../model/ways';
import { PLANET, STRUCTURE, planetKey } from './articles';
import { commit, jsonBytes, readDoc, type Result } from './store';

/** Where the ways are kept. */
export const WAYS_KEY = `/content/${WAYS_FILE}`;

/** Saves the ways, at the version they were read at (null: never saved). */
export async function saveWays(ways: Ways, version: string | null): Promise<Result> {
  const changes = [{ key: WAYS_KEY, bytes: jsonBytes(ways) }];
  const ifMatch: Record<string, string | null> = { [WAYS_KEY]: version };
  if (isOn(ways, LITTLE_PLANET) && !readDoc(planetKey())) {
    const tree = readDoc<SiteStructure>(STRUCTURE)?.value;
    const sections = (tree?.home.children ?? []).flatMap((n) => (n.kind === 'hub' ? [{ id: n.id, title: n.title, summary: n.summary }] : []));
    const start = startingPlanet(sections);
    if (!start) return { ok: false, status: 422, issues: [{ file: PLANET.slice(1), message: PLANET_NEEDS }] };
    changes.push({ key: PLANET, bytes: jsonBytes(start) });
    ifMatch[PLANET] = null;
  }
  return commit({ changes, ifMatch });
}
