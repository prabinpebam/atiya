/** Home highlights, saved as one checked, versioned transaction through edit mode's content store. */
import { HIGHLIGHTS_FILE, highlightsFile } from '../../content/highlights';
import { commit, jsonBytes, type Result } from './store';

/** The public configuration's store key; sources remain in their own resources. */
export const HIGHLIGHTS_KEY = `/content/${HIGHLIGHTS_FILE}`;

/** Refuses malformed settings before writing, then lets the content check verify every public reference. */
export function saveHighlights(value: unknown, version: string | null): Promise<Result> {
  const parsed = highlightsFile.safeParse(value);
  if (!parsed.success) {
    return Promise.resolve({
      ok: false,
      status: 422,
      issues: parsed.error.issues.map((i) => ({ file: HIGHLIGHTS_KEY.slice(1), path: i.path.join('.'), message: i.message })),
    });
  }
  return commit({ changes: [{ key: HIGHLIGHTS_KEY, bytes: jsonBytes(parsed.data) }], ifMatch: { [HIGHLIGHTS_KEY]: version } });
}
