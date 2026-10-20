/**
 * The home page's content contract (documentation/home-views/foundation.md §2, curation.md §2): the spine,
 * `content/showcase.json` (the person's strengths, what proves them and their decisions about the picks), and the
 * topic vocabulary, `content/topics.json` (curation §4.1). Pure: the content check (check.ts) holds what these
 * shapes can't (that every page is open, every quote word for word).
 */
import { z } from 'astro/zod';
import { CONTRIBUTIONS, mediaId } from '../content/schema';
import { GOALS } from './ids';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase kebab-case');
/** A page of the site, by its ID: `ref:article/<id>`. */
export const pageRef = z.string().regex(/^ref:article\/[a-z0-9]+(-[a-z0-9]+)*$/, 'a page: ref:article/<id>');
/** The page ID a `ref:article/<id>` names. */
export const refId = (ref: string) => ref.slice('ref:article/'.length);
/** The ref of a page ID. */
export const toRef = (pageId: string) => `ref:article/${pageId}`;

const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const atMostWords = (max: number, what: string) => z.string().trim().min(1).refine((s) => wordsIn(s) <= max, `${what} is ${max} words at most`);

/** Kinds of proof: the person's part in the work, and `said` (someone else's words, a recommendation). */
export const PROOF_KINDS = [...CONTRIBUTIONS, 'said'] as const;
export type ProofKind = (typeof PROOF_KINDS)[number];

/** How recent work is preferred (curation §5): off, or a half-life of 3 years (some) or 1 (strong). */
export const RECENT = ['off', 'some', 'strong'] as const;
/** How strict matching is (curation §4): a candidate's match of at least 0.3, 0.4 or 0.7. */
export const STRICT = ['loose', 'balanced', 'strict'] as const;

/** A proof item: a page, a résumé line or a recommendation, exactly one. In a strength's `proof`, it's a pin. */
export const proofItem = z
  .strictObject({
    kind: z.enum(PROOF_KINDS).optional(),
    ref: pageRef.optional(),
    /** A fragment of the résumé page, word for word. */
    resume: z.string().trim().min(3).max(240).optional(),
    /** A recommendation's ID (content/recommendations.json). */
    recommendation: id.optional(),
    /** Shown with Ask me about it: the rest isn't public. */
    ask: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    const sources = [p.ref, p.resume, p.recommendation].filter((s) => s !== undefined).length;
    if (sources !== 1) ctx.addIssue({ code: 'custom', message: 'a proof item points at one thing: a page (ref), a résumé line (resume) or a recommendation' });
    if (p.resume !== undefined && !p.kind) ctx.addIssue({ code: 'custom', path: ['kind'], message: 'a résumé line needs its kind: what you did (led, shipped, built…)' });
    if (p.recommendation !== undefined && p.kind && p.kind !== 'said') ctx.addIssue({ code: 'custom', path: ['kind'], message: "a recommendation's kind is said" });
    if (p.kind === 'said' && p.recommendation === undefined) ctx.addIssue({ code: 'custom', path: ['kind'], message: 'said is for a recommendation: a page or a résumé line is something you did' });
  });
export type ProofItem = z.infer<typeof proofItem>;

/** A strength (for-every-site.md §3.1), with what it matches, its pins and hides, and its voice. */
export const capability = z.strictObject({
  id,
  name: z.string().trim().min(1).max(48),
  /** For the tight places: chips, the phone's index tile, the chapter bar. */
  short: z.string().trim().min(1).max(12),
  /** Its proof as a fact. */
  line: atMostWords(6, 'a line'),
  /** What the Keywords view shows; they also match pages. */
  keywords: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  /** The topics and sections that prove it (curation §4). */
  match: z.strictObject({ topics: z.array(id).optional(), sections: z.array(id).optional() }).optional(),
  /** Pins, in order: shown first, whatever their score. */
  proof: z.array(proofItem).optional(),
  /** Pages never shown for this strength. */
  hide: z.array(pageRef).optional(),
  /** A colleague's or client's words, word for word from a recommendation. */
  voice: z.strictObject({ recommendation: id, quote: atMostWords(12, 'a quote') }).optional(),
  /** Its own picture (content/media/), else its best proof's. */
  media: mediaId.optional(),
  /** The lenses it leads for. */
  lens: z.array(id).optional(),
});
export type Capability = z.infer<typeof capability>;

const label = z.string().trim().min(1).max(32);

export const showcaseFile = z.strictObject({
  /** What the site is for; left out, Get hired. */
  goal: z.enum(GOALS).optional(),
  /** Short verified facts (years, team size), each found word for word in its source page. */
  facts: z.array(z.strictObject({ id, text: z.string().trim().min(1).max(40), source: pageRef })).max(6).optional(),
  capabilities: z.array(capability).max(6, 'six strengths at most: merge two, or make one a topic'),
  /** Pinned highlights: the Spotlight's and the Showreel's first items. */
  highlights: z.array(z.strictObject({ id: id.optional(), ref: pageRef, capability: id })).max(8).optional(),
  hideHighlights: z.array(pageRef).optional(),
  /** The always-on actions' labels, where the goal's are renamed. */
  actions: z.strictObject({ primary: label.optional(), secondary: label.optional() }).optional(),
  curation: z
    .strictObject({
      recent: z.enum(RECENT).optional(),
      /** How many proof items a strength's details show before Show all. */
      detail: z.number().int().min(3).max(8).optional(),
      /** Hold automatic changes: the picks stay as `held` has them. */
      hold: z.boolean().optional(),
      strict: z.enum(STRICT).optional(),
      /** Never used as proof: sections, topics, kinds of proof. */
      leaveOut: z.strictObject({ sections: z.array(id).optional(), topics: z.array(id).optional(), kinds: z.array(z.enum(PROOF_KINDS)).optional() }).optional(),
    })
    .optional(),
  /** The automatic picks as they were when held (curation §7): each strength's pages, and the highlights. */
  held: z.strictObject({ proof: z.record(id, z.array(pageRef)), highlights: z.array(z.strictObject({ ref: pageRef, capability: id })) }).optional(),
  /** Ways to read the home for a role (foundation §6): an order of the strengths and a voice. Never hides one. */
  lenses: z
    .array(z.strictObject({ id, label, order: z.array(id).optional(), voice: id.optional(), keywords: z.array(z.string().trim().min(1).max(40)).max(6).optional() }))
    .max(6)
    .optional(),
  /** The Questions view's answers (questions.md), each citing the strengths it draws on. */
  questions: z
    .array(
      z.strictObject({
        id,
        question: z.string().trim().min(1).max(60),
        full: z.string().trim().max(200).optional(),
        answer: z.string().trim().min(1).max(400),
        capabilities: z.array(id),
        proof: z.array(proofItem).optional(),
      }),
    )
    .max(12)
    .optional(),
  /** The Showreel's chapters: a strength each, its highlight and a caption. */
  reel: z.strictObject({ chapters: z.array(z.strictObject({ capability: id, highlight: pageRef.optional(), caption: atMostWords(12, 'a caption').optional() })).max(8) }).optional(),
});
export type Showcase = z.infer<typeof showcaseFile>;

/** The topic vocabulary (curation §4.1): a label for each topic, and words that mean it. */
export const topicsFile = z.strictObject({
  topics: z.array(z.strictObject({ id, label: z.string().trim().min(1).max(40), synonyms: z.array(z.string().trim().min(1).max(40)).max(12).optional() })),
});
export type TopicsFile = z.infer<typeof topicsFile>;
export type Topic = TopicsFile['topics'][number];

/** The spine's and the vocabulary's files in the content folder. */
export const SHOWCASE_FILE = 'showcase.json';
export const TOPICS_FILE = 'topics.json';

/** The curation's settings when left out (curation §2). */
export const CURATION_DEFAULTS = { recent: 'some', detail: 5, hold: false, strict: 'balanced' } as const;
