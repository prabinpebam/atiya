/**
 * The navigation modes' contract (documentation/desktop/modes.md §5): a mode's manifest (`mode.json`),
 * which modes a site turns on (`atiya.json`'s `modes` and `primary`), and the data the host gives a mode.
 * Pure: the site's build and its checks read it; a mode reads only `ModeData`.
 */
import { z } from 'astro/zod';
import type { Article, SectionView } from '../content/schema';

/** The contract versions this engine hosts (modes.md §11). */
export const HOSTED_API = { min: 1, max: 1 } as const;

const modeId = z.string().regex(/^(?:[a-z][a-z0-9-]{1,40}|local:[a-z0-9][a-z0-9-]{0,40}|github:[A-Za-z0-9-]+\/[A-Za-z0-9._-]+)$/, 'a mode ID: a built-in name, local:<folder> or github:<owner>/<repo>');
/** A mode's address under the site's base: one path segment. */
export const mountName = z.string().regex(/^[a-z][a-z0-9-]{0,30}$/, 'one path segment: lower-case letters, digits and dashes');
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'a version: major.minor.patch');
const slotId = z.string().regex(/^[a-z][a-z0-9-]{0,40}$/, 'a slot ID: lower-case letters, digits and dashes');

/** `mode.json` (modes.md §5.1). */
export const modeManifest = z.strictObject({
  api: z.number().int().positive(),
  id: modeId,
  name: z.string().min(1).max(40),
  version: semver,
  summary: z.string().min(1).max(160),
  author: z.strictObject({ name: z.string().min(1), url: z.url().optional() }),
  licence: z.string().min(1).optional(),
  entry: z.string().min(1),
  mount: mountName,
  label: z.string().min(1).max(30),
  poster: z.strictObject({ image: z.string().min(1), dark: z.string().min(1).optional(), alt: z.string().min(1) }),
  requires: z.strictObject({ webgl: z.union([z.literal(1), z.literal(2)]).optional(), deviceMemoryGB: z.number().positive().optional(), pointer: z.enum(['any', 'fine', 'coarse']).optional() }).default({}),
  readyTimeoutS: z.number().int().positive().max(120).default(20),
  budgets: z.strictObject({ criticalKB: z.number().positive(), laterChunkKB: z.number().positive(), beforeLiveKB: z.number().positive() }),
  slots: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('fixed'), ids: z.array(slotId).min(1).max(40) }),
    z.strictObject({ kind: z.literal('per-section'), max: z.number().int().positive().max(40) }),
  ]),
  structure: z.string().min(1).optional(),
  settings: z.string().min(1).optional(),
  frame: z.strictObject({ otherSlot: z.enum(['note', 'open']) }).default({ otherSlot: 'note' }),
  pictures: z.strictObject({ thumbnail: z.array(z.number().int().positive()).max(4) }).optional(),
  network: z.array(z.url()).default([]),
  credits: z.string().min(1).optional(),
});
export type ModeManifest = z.infer<typeof modeManifest>;

/** One mode in `atiya.json` (modes.md §2). */
export const siteMode = z.strictObject({
  id: modeId,
  version: semver.optional(),
  on: z.boolean(),
  mount: mountName.optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type SiteMode = z.infer<typeof siteMode>;

/** `atiya.json`'s ways in: the modes and the home page's first offer (its other fields are the desktop spec's). */
export const siteModes = z.object({
  modes: z.array(siteMode).default([]),
  primary: z.string().default('site'),
});
export type SiteModes = z.infer<typeof siteModes>;

/**
 * The site's ways in (`content/structures/ways.json`; plan stage 8A, D-W1): which modes are on, and the
 * home page's first offer, `site` or a mode that's on. Content: edit mode's Ways to explore screen writes it.
 */
export const waysFile = z.strictObject({
  modes: z.array(siteMode),
  primary: z.string().min(1),
});
export type Ways = z.infer<typeof waysFile>;
/** Where the ways file lives in the content folder. */
export const WAYS_FILE = 'structures/ways.json';
/** Little planet's structure (its buildings' words and the section each shows), in the modes' folder (M1.1). */
export const PLANET_FILE = 'structures/modes/little-planet.json';
/** Where Little planet's structure was before M1.1: still read, with a warning, until a site moves it. */
export const LEGACY_PLANET_FILE = 'structures/planet.json';

/** A picture a mode may show (made by the site's picture pipeline). */
export interface ModePicture {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
  bg?: string;
  dark?: string;
}

/** A page as a mode sees it: published and open, never a draft or a private page. */
export interface ModePage {
  id: string;
  title: string;
  summary: string;
  kind: Article['kind'];
  url: string;
  thumbnail?: ModePicture;
}

/** What the host gives a mode (modes.md §5.2): built once per build, plain JSON. Nothing private, nothing draft. */
export interface ModeData {
  api: 1;
  mode: { id: string; mount: string; settings: unknown };
  site: { name: string; description: string; locale: string; base: string; owner: { name: string; role?: string; avatar?: ModePicture } };
  sections: Array<{
    id: string;
    title: string;
    summary: string;
    view: SectionView;
    url: string;
    /** That the section has private pages: never which, or how many. */
    hasPrivate: boolean;
    pages: ModePage[];
  }>;
  slots: Array<{ id: string; section: string | null; words: Record<string, string> }>;
  entry: { slot?: string; page?: string };
  links: { home: string; signIn: string; contact?: string };
}

/** A mode's structure, read generically: its slots, each naming a section (or none) with the mode's words for it. */
export interface ModeStructure {
  slots: Array<{ id: string; section: string | null; words: Record<string, string> }>;
  settings?: unknown;
}

/** A built-in mode: its manifest, and how its structure file is read (validated, then as slots). */
export interface BuiltinMode {
  manifest: ModeManifest;
  /** Where its structure lives in the content folder (modes.md §6). */
  structureFile: string;
  /** Where it lived before, still read during a move (Little planet's `structures/planet.json`, M1.1). */
  legacyStructureFile?: string;
  /** Validates the structure file and reads it as slots; throws a ZodError when it doesn't fit. */
  readStructure: (raw: unknown) => ModeStructure;
}
