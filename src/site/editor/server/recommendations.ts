/**
 * Saving recommendations (documentation/sections/recommendations.md §4): the list file, and a section's settings in
 * the site structure, each at the version the screen read it at, through the store (checked before any byte is
 * written).
 */
import type { SiteStructure } from '../../content/schema';
import { isLinkedInProfile, type Recommendation, type RecommendationSettings } from '../../content/recommendations';
import { cleanRecommendation, cleanSettings, withSectionSettings } from '../model/recommendations';
import { extname } from 'node:path';
import { STRUCTURE } from './articles';
import { MAX_UPLOAD, upload } from './media';
import { commit, jsonBytes, readDoc, type Result } from './store';

/** Where the recommendations are kept. */
export const RECOMMENDATIONS_KEY = '/content/recommendations.json';

/** Saves the whole list, in its order (null version: the file doesn't exist yet). */
export function saveRecommendations(items: Recommendation[], version: string | null): Promise<Result> {
  const file = { items: items.map(cleanRecommendation) };
  return commit({ changes: [{ key: RECOMMENDATIONS_KEY, bytes: jsonBytes(file) }], ifMatch: { [RECOMMENDATIONS_KEY]: version } });
}

/** Saves one section's settings, keeping everything else in the structure. */
export async function saveSectionRecommendations(section: string, settings: Partial<RecommendationSettings>, version: string | null): Promise<Result> {
  const tree = readDoc<SiteStructure>(STRUCTURE)?.value;
  const next = tree && withSectionSettings(tree, section, cleanSettings(settings));
  if (!next) return { ok: false, status: 422, issues: [{ file: STRUCTURE.slice(1), message: 'That section is no longer on the site.' }] };
  return commit({ changes: [{ key: STRUCTURE, bytes: jsonBytes(next) }], ifMatch: { [STRUCTURE]: version } });
}

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const WAIT_MS = 10_000;
const refuse = (message: string): Result => ({ ok: false, status: 422, issues: [{ file: RECOMMENDATIONS_KEY.slice(1), path: 'photo', message }] });

/**
 * The photo a public LinkedIn profile shows to visitors who aren't signed in (its og:image), fetched once, as
 * bytes. Only a linkedin.com/in/… address, and only a picture from LinkedIn's own media host: a profile without a
 * photo of its own, or one that asks to sign in, gives nothing.
 */
export async function profilePhoto(link: string, get: typeof fetch = fetch): Promise<{ ok: true; bytes: Buffer } | { ok: false; why: string }> {
  // the editor's tests never reach LinkedIn (scripts/editor-test-server.mjs turns it off)
  if (get === fetch && process.env.SITE_EDITOR_PROFILE_PHOTOS === 'off') return { ok: false, why: 'taking photos from profiles is off on this server' };
  if (!isLinkedInProfile(link)) return { ok: false, why: "the link isn't a LinkedIn profile's address (linkedin.com/in/…)" };
  let html: string;
  try {
    const page = await get(link, { headers: { 'user-agent': BROWSER, 'accept-language': 'en' }, redirect: 'follow', signal: AbortSignal.timeout(WAIT_MS) });
    if (!page.ok) return { ok: false, why: `LinkedIn didn't show the profile (${page.status})` };
    if (page.url && !isLinkedInProfile(page.url.replace(/\?.*$/, ''))) return { ok: false, why: 'LinkedIn asked to sign in: the profile may not be public' };
    html = (await page.text()).slice(0, 3_000_000);
  } catch (e) {
    return { ok: false, why: `LinkedIn couldn't be reached (${(e as Error).message})` };
  }
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).find((tag) => /property=["']og:image["']/i.test(tag));
  const src = meta && /content=["']([^"']+)["']/i.exec(meta)?.[1]?.replace(/&amp;/g, '&');
  let url: URL | undefined;
  try {
    url = src ? new URL(src) : undefined;
  } catch {
    url = undefined;
  }
  if (!url || url.protocol !== 'https:' || url.hostname !== 'media.licdn.com') return { ok: false, why: "the profile shows no photo to visitors who aren't signed in" };
  try {
    const img = await get(url, { headers: { 'user-agent': BROWSER }, signal: AbortSignal.timeout(WAIT_MS) });
    const type = img.headers.get('content-type') ?? '';
    if (!img.ok || !type.startsWith('image/')) return { ok: false, why: `LinkedIn didn't give the photo (${img.status})` };
    const bytes = Buffer.from(await img.arrayBuffer());
    if (bytes.length > MAX_UPLOAD) return { ok: false, why: 'the photo is too big' };
    return { ok: true, bytes };
  } catch (e) {
    return { ok: false, why: `the photo couldn't be fetched (${(e as Error).message})` };
  }
}

/**
 * Gives a recommendation its photo: the picture uploaded, or (with none) the one its LinkedIn profile shows. The
 * picture is kept in content/media/shared/ like any other (described by the person's name), then named in the
 * list. A refusal says why in words; the recommendation keeps its initials.
 */
export async function setPhoto(id: string, file?: { name: string; bytes: Buffer }): Promise<Result & { photo?: string }> {
  const list = readDoc<{ items: Recommendation[] }>(RECOMMENDATIONS_KEY);
  const rec = list?.value.items.find((r) => r.id === id);
  if (!list || !rec) return refuse("That recommendation isn't saved yet.");
  let bytes = file?.bytes;
  if (!bytes) {
    const got = await profilePhoto(rec.link ?? '');
    if (!got.ok) return refuse(`Their LinkedIn photo couldn't be taken: ${got.why}.`);
    bytes = got.bytes;
  }
  const up = await upload({ file: { name: `${id}-photo${file ? extname(file.name) : '.jpg'}`, bytes }, owner: 'shared', alt: rec.name });
  if (!up.ok || !up.id) return up;
  const items = list.value.items.map((r) => (r.id === id ? cleanRecommendation({ ...r, photo: up.id, noPhoto: undefined }) : r));
  const r = await commit({ changes: [{ key: RECOMMENDATIONS_KEY, bytes: jsonBytes({ items }) }], ifMatch: { [RECOMMENDATIONS_KEY]: list.version } });
  return r.ok ? { ...r, photo: up.id } : r;
}
