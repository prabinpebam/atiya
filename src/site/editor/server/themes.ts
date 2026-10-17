/**
 * Saving themes (documentation/site-ui/theming.md §8): a person's own theme, a new one, deleting one, and choosing
 * the site's theme, all through the store. A preset is never written: its ID is refused, and the content check
 * refuses a theme file that takes one.
 */
import type { SiteSettings, ThemeFile } from '../../content/schema';
import { DEFAULT_THEME, isPreset } from '../../theme/model';
import { commit, jsonBytes, readDoc, type Result } from './store';

export const SITE_KEY = '/content/site.json';
export const themeKey = (id: string) => `/content/themes/${id}.json`;

const refuse = (message: string, path?: string): Result => ({ ok: false, status: 422, issues: [{ file: 'content/themes', message, ...(path ? { path } : {}) }] });

/** Saves a person's own theme at the version it was read at (null: a new theme, whose ID must be free). */
export async function saveTheme(theme: ThemeFile, version: string | null): Promise<Result> {
  if (isPreset(theme.id)) return refuse(`"${theme.name}" is a preset: save it as a new theme to change it`, 'id');
  const key = themeKey(theme.id);
  return commit({ changes: [{ key, bytes: jsonBytes(theme) }], ifMatch: { [key]: version } });
}

/** The site's settings with this theme in use (the site's own, Atiya, is the default and leaves no field). */
const withTheme = (site: SiteSettings, id: string): SiteSettings => {
  const { theme: _, ...rest } = site;
  return id === DEFAULT_THEME ? rest : { ...rest, theme: id };
};

/** Uses a theme on the site: a preset, or one of the person's own that's saved. */
export async function applyTheme(id: string, siteVersion: string | null): Promise<Result> {
  const site = readDoc<SiteSettings>(SITE_KEY);
  if (!site) return refuse('content/site.json is missing');
  if (!isPreset(id) && !readDoc(themeKey(id))) return refuse(`there's no theme "${id}": save it first`);
  return commit({ changes: [{ key: SITE_KEY, bytes: jsonBytes(withTheme(site.value, id)) }], ifMatch: { [SITE_KEY]: siteVersion ?? site.version } });
}

/** Deletes a person's own theme; if the site uses it, the site goes back to its own (Atiya) in the same save. */
export async function deleteTheme(id: string, version: string | null): Promise<Result> {
  if (isPreset(id)) return refuse("a preset can't be deleted");
  const key = themeKey(id);
  const site = readDoc<SiteSettings>(SITE_KEY);
  const changes: { key: string; bytes: Buffer | null }[] = [{ key, bytes: null }];
  const ifMatch: Record<string, string | null> = { [key]: version ?? readDoc(key)?.version ?? null };
  if (site && site.value.theme === id) {
    changes.push({ key: SITE_KEY, bytes: jsonBytes(withTheme(site.value, DEFAULT_THEME)) });
    ifMatch[SITE_KEY] = site.version;
  }
  return commit({ changes, ifMatch });
}
