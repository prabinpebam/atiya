/**
 * The home page catalogue, typed (catalogue.json: the engine's, never content): each goal's defaults, the starting
 * strengths, and each view's minimum and settings (documentation/home-views/for-every-site.md §2, §5; controls.md §3).
 */
import catalogue from './catalogue.json' with { type: 'json' };
import type { Goal, ViewId } from './ids';
import type { ProofKind } from './schema';

/** One of a view's settings: a choice, a number in a range, a picture, a highlight or the proof grid's kinds. */
export interface SettingSpec {
  label: string;
  type: 'choice' | 'number' | 'picture' | 'highlight' | 'kinds';
  values?: string[];
  labels?: string[];
  default?: string | number;
  min?: number;
  max?: number;
}

/** What a view needs before it can be offered (for-every-site.md §5). */
export interface Minimum {
  /** Strengths shown (each with proof). */
  strengths?: number;
  /** Pictures among the strengths and highlights. */
  pictures?: number;
  /** Highlights with a picture. */
  highlights?: number;
  /** Every strength shown has a picture. */
  everyPicture?: boolean;
  /** Keywords across the strengths. */
  keywords?: number;
  /** Proof items across the strengths, each once. */
  proof?: number;
  /** Kinds of proof in use. */
  kinds?: number;
  /** Questions answered. */
  answers?: number;
}

export interface ViewSpec {
  label: string;
  line: string;
  /** Built in this engine: only a built view can be offered. */
  built: boolean;
  minimum: Minimum;
  settings: Record<string, SettingSpec>;
}

export interface GoalSpec {
  label: string;
  actions: { primary: string; secondary: string };
  /** The kinds of proof that count most (the score's first term). */
  counts: ProofKind[];
  view: ViewId;
  lenses: string;
  questions: { id: string; question: string; full?: string }[];
}

export interface Catalogue {
  goals: Record<Goal, GoalSpec>;
  strengths: Record<string, string[]>;
  views: Record<ViewId, ViewSpec>;
}

export const CATALOGUE = catalogue as unknown as Catalogue;

/** A view's settings with every default filled in, the person's own over them. */
export function viewSettings(view: ViewId, own: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(CATALOGUE.views[view].settings)) if (spec.default !== undefined) out[key] = spec.default;
  return { ...out, ...own };
}
