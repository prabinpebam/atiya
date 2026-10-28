/**
 * What a picture's file said about itself (gallery spec §9.8.2): the day it was taken and where, read from its
 * metadata at upload, before its master is written without any. Kept only on this computer, in
 * `.atiya/picture-meta.json` beside the AI settings (never committed, never in a sidecar, never published), keyed by
 * the media ID, which never changes. Read by the suggestions: "Use the file's date" when the sidecar's date was
 * cleared, and the place, whose coordinates go to the AI writer rounded to about a kilometre and only when a place is
 * asked for. A picture uploaded before this was kept has no record.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { contentRoot } from '../../content/source';
import { writeJsonAtomic } from './aiSettings';
import type { PictureLocation } from '../model/exif';

/** One picture's record: its file's date (YYYY-MM-DD) and where it was taken. */
export interface PictureMeta {
  taken?: string;
  location?: PictureLocation;
}

/** The record's file: `.atiya/picture-meta.json` in the site's folder (the content folder's parent). */
export const pictureMetaFile = (root = contentRoot()) => join(dirname(root), '.atiya', 'picture-meta.json');

function readAll(file: string): Record<string, PictureMeta> {
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, PictureMeta>) : {};
  } catch {
    return {};
  }
}

/** A picture's record, or null when nothing was kept for it. */
export function pictureMeta(id: string, file = pictureMetaFile()): PictureMeta | null {
  const m = readAll(file)[id];
  return m && (m.taken || m.location) ? m : null;
}

/** Keeps what a picture's file said, replacing its record (nothing to keep: forgets it). Never throws: a record is a help, not a save. */
export function keepPictureMeta(id: string, meta: PictureMeta, file = pictureMetaFile()): void {
  try {
    const all = readAll(file);
    const next: PictureMeta = { ...(meta.taken ? { taken: meta.taken } : {}), ...(meta.location ? { location: meta.location } : {}) };
    if (next.taken || next.location) all[id] = next;
    else if (id in all) delete all[id];
    else return;
    writeJsonAtomic(file, all);
  } catch {
    // the suggestions just won't have it
  }
}

/** Forgets a picture's record (it was deleted). */
export const forgetPictureMeta = (id: string, file = pictureMetaFile()): void => keepPictureMeta(id, {}, file);
