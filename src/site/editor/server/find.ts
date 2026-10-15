/**
 * The action center's index and its settings writes (documentation/desktop/action-center.md §8.2, §8.3): what
 * edit mode holds, read from the content index alone (no picture drawn on its path), and the site's settings a
 * card changes, written through the store exactly as their screens write them.
 */
import type { ContentIndex } from '../../content/load';
import type { SiteSettings } from '../../content/schema';
import { picture, video } from '../../content/pictures';
import { timed } from '../../content/timing';
import { SITE_FEATURES, withBase } from '../../design/meta';
import { BUILTIN_MODES } from '../../modes/builtin';
import type { Ways } from '../../modes/contract';
import { effectiveWays } from '../../modes/ways';
import { bodyText, checkSiteText, editScreens, findSettings, SCREEN_PLACES, isSiteText, modeOf, waysWith, withSiteText, type FindSetting } from '../model/find';
import { hubs } from '../model/structure';
import { ownerLabel, ownerOf } from '../model/references';
import { planetKey } from './articles';
import { articleRows, KIND_LABEL, STATUS_LABEL } from './screens';
import { commit, jsonBytes, readDoc, type Result } from './store';
import { saveWays, WAYS_KEY } from './ways';

const SITE_KEY = '/content/site.json';

/** The site's settings as the cards show them, read now. */
function settingsNow(): FindSetting[] {
  const site = readDoc<SiteSettings>(SITE_KEY);
  const doc = readDoc<Ways>(WAYS_KEY);
  if (!site) return [];
  const ways = effectiveWays({ ways: doc?.value ?? null, hasPlanet: !!readDoc(planetKey()) });
  const modes = [...BUILTIN_MODES.values()].map(({ manifest }) => ({ id: manifest.id, name: manifest.name, summary: manifest.summary }));
  return findSettings({ site: site.value, siteVersion: site.version, ways, waysVersion: doc?.version ?? null, modes });
}

/** Everything the action center finds in edit mode (§8.2). */
export function findIndex(index: ContentIndex) {
  return timed('find.index', () => {
    const pages = articleRows(index).map((row) => {
      const a = index.articles.get(row.id)!;
      return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        kindLabel: KIND_LABEL[row.kind],
        status: row.status,
        statusLabel: STATUS_LABEL[row.status],
        published: row.published,
        private: row.access === 'private',
        section: row.section,
        path: row.path,
        summary: a.summary,
        text: bodyText(a),
        picture: a.thumbnail ?? a.hero?.media ?? null,
        updatedAt: row.updatedAt,
      };
    });
    const sections = hubs(index.structure)
      .filter((h) => h.depth === 1)
      .map((h) => {
        const route = index.routes.find((r) => r.node.kind === 'hub' && r.node.id === h.id);
        return { id: h.id, title: h.title, path: route?.published === false ? null : h.path, pages: pages.filter((p) => p.section?.id === h.id).length };
      });
    const media = [
      ...[...index.media.values()].map((m) => ({ id: m.id, kind: 'image' as const, title: m.alt ?? '', caption: m.caption ?? '', decorative: !!m.decorative, owner: ownerOf(m.id), ownerLabel: ownerLabel(index, ownerOf(m.id)), private: m.origin === 'private' })),
      ...[...index.videos.values()].map((v) => ({ id: v.id, kind: 'video' as const, title: v.title, caption: v.caption ?? '', decorative: false, owner: ownerOf(v.id), ownerLabel: ownerLabel(index, ownerOf(v.id)), private: v.origin === 'private', width: v.width, height: v.height, ...(v.duration ? { duration: v.duration } : {}) })),
    ];
    const screens = [...editScreens(SITE_FEATURES), ...SCREEN_PLACES].map((s) => ({ id: s.id, label: s.label, href: withBase(`/_edit/${s.path}`), words: s.words, about: s.about, icon: s.icon }));
    return { ok: true as const, pages, sections, media, screens, settings: settingsNow() };
  });
}

/** A picture's or video's card thumbnail, for the action center's row and card (drawn when asked, one at a time). */
export async function findThumb(index: ContentIndex, id: string): Promise<string | null> {
  if (index.media.has(id)) return (await picture(id, 'card')).thumb ?? null;
  if (index.videos.has(id)) return (await video(id, 'card')).poster?.thumb ?? null;
  return null;
}

/**
 * Changes one of the site's settings from its card (§8.3), at the version the card was read at: the site's words
 * in site.json, or a way to explore in ways.json (saveWays, the same rule as the Ways to explore screen's).
 */
export async function setFindSetting(id: string, value: unknown, version: string | null): Promise<(Result & { setting?: FindSetting; restarts?: boolean }) | null> {
  const answer = (r: Result, restarts = false) => ({ ...r, setting: settingsNow().find((s) => s.id === id), restarts: r.ok && restarts });
  if (isSiteText(id)) {
    const site = readDoc<SiteSettings>(SITE_KEY);
    if (!site) return null;
    const checked = checkSiteText(id, value);
    if (!checked.ok) return answer({ ok: false, status: 422, issues: [{ file: SITE_KEY.slice(1), message: checked.message }] });
    return answer(await commit({ changes: [{ key: SITE_KEY, bytes: jsonBytes(withSiteText(site.value, id, checked.value)) }], ifMatch: { [SITE_KEY]: version } }));
  }
  const mode = modeOf(id);
  const builtin = mode ? BUILTIN_MODES.get(mode) : undefined;
  if (!mode || !builtin || typeof value !== 'boolean') return null;
  const doc = readDoc<Ways>(WAYS_KEY);
  const ways = effectiveWays({ ways: doc?.value ?? null, hasPlanet: !!readDoc(planetKey()) });
  return answer(await saveWays(waysWith(ways, mode, value, builtin.manifest.mount), version), true);
}
