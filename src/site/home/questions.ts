/**
 * The Questions view's answers (documentation/home-views/questions.md §4, §5): the person's own answers to the
 * questions their goal's visitors ask, in their order, each with the strengths it draws on (its tags) and its
 * evidence (L3): its own pins first, then its strengths' details in turn, three to five in all. Question 1 always
 * maps every strength shown (A4), so no strength goes unseen; the catalogue's fills add the strengths deepest first
 * (depth), every résumé item to ask about (ask) or the two ways to get in touch (contact). The words a visitor's
 * question is matched against are built here, so nothing typed leaves the browser. Pure.
 */
import { CATALOGUE, type QuestionFill } from './catalogue';
import { humanise, pinPick, type HomePicks, type Pick as Placed, type StrengthPicks } from './curate';
import type { EvidenceIndex } from './evidence';
import { evidenceItem, strengthsInOrder, type EvidenceItem, type PresentEnv } from './present';
import type { Showcase, Topic } from './schema';

export interface QuestionsSettings {
  /** The strengths' order in question 1's map and the tags: the person's, or by the depth of their proof (a lens overrides both). */
  order: 'yours' | 'strongest';
  /** Ask something else: shown, or left out. */
  ask: 'on' | 'off';
}

const SPEC = CATALOGUE.views.questions.settings;
export const QUESTIONS_DEFAULTS: QuestionsSettings = { order: SPEC.order.default === 'strongest' ? 'strongest' : 'yours', ask: SPEC.ask.default === 'off' ? 'off' : 'on' };

const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);

/** The view's settings as Questions reads them, anything unknown taken as its default. */
export function questionsSettings(s: Record<string, unknown> = {}): QuestionsSettings {
  return { order: oneOf(s.order, ['yours', 'strongest'], QUESTIONS_DEFAULTS.order), ask: oneOf(s.ask, ['on', 'off'], QUESTIONS_DEFAULTS.ask) };
}

/** A proof item with its line: its page's summary, or the colleague's words. */
export interface QuestionItem extends EvidenceItem {
  line?: string;
}

/** A strength an answer draws on. */
export interface QuestionTag {
  id: string;
  name: string;
  short: string;
}

/** A strength in question 1's map: its proof as a fact, how much proof, its headline and its details. */
export interface MappedStrength extends QuestionTag {
  line: string;
  total: number;
  headline?: QuestionItem;
  evidence: QuestionItem[];
}

export type AnswerFill =
  | { kind: 'map'; strengths: MappedStrength[] }
  | { kind: 'depth'; strengths: (QuestionTag & { line: string; total: number })[]; grid?: string }
  | { kind: 'ask'; groups: (QuestionTag & { items: QuestionItem[] })[] }
  | { kind: 'contact'; resume?: string; contact?: string };

export interface Answer {
  id: string;
  /** Its number, from 1. */
  n: number;
  question: string;
  full?: string;
  answer: string;
  tags: QuestionTag[];
  evidence: QuestionItem[];
  fill?: AnswerFill;
  next?: { n: number; question: string };
  /** What a typed question is matched against, strongest first: its own words, its strengths', its evidence's titles. */
  words: { question: string[]; strengths: string[]; evidence: string[] };
}

export interface QuestionsModel {
  answers: Answer[];
  /** Ask something else is shown. */
  ask: boolean;
}

/** At most this many evidence items to an answer (questions.md §4.1: three to five). */
export const MAX_EVIDENCE = 5;

const firstSentence = (s: string) => {
  const t = s.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  return t.length <= 240 ? t : '';
};

export function questionsOf(o: {
  questions: Showcase['questions'];
  picks: HomePicks;
  evidence: EvidenceIndex;
  topics?: readonly Topic[];
  settings: QuestionsSettings;
  env: PresentEnv;
  /** The Proof grid's address, when it's offered: question 4 links to it. */
  gridHref?: string;
}): QuestionsModel {
  const { picks, evidence, env } = o;
  const strengths = strengthsInOrder(picks, o.settings.order);
  const vocab = new Map((o.topics ?? []).map((t) => [t.id, t]));
  const goal = CATALOGUE.goals[picks.goal];
  const fills = new Map<string, QuestionFill | undefined>(goal?.questions.map((q) => [q.id, q.fill]) ?? []);
  const fulls = new Map(goal?.questions.map((q) => [q.id, q.full]) ?? []);

  const quoteOf = (id: string) =>
    picks.strengths.find((s) => s.voice?.recommendation === id)?.voice?.quote ?? firstSentence(evidence.recommendations.find((r) => r.id === id)?.text ?? '');
  const item = (p: Placed, s: { capability: { name: string } }): QuestionItem | undefined => {
    const e = evidenceItem(p, s, env);
    if (!e) return undefined;
    const line = p.source === 'page' && p.id ? evidence.byId.get(p.id)?.summary : p.source === 'recommendation' && p.recommendation ? quoteOf(p.recommendation) : undefined;
    return line?.trim() ? { ...e, line: line.trim() } : e;
  };
  const tagOf = (s: StrengthPicks): QuestionTag => ({ id: s.id, name: s.capability.name, short: s.capability.short });
  const wordsOf = (s: StrengthPicks) => [
    s.capability.name,
    s.capability.short,
    ...s.keywords,
    ...(s.capability.match?.topics ?? []).flatMap((t) => {
      const v = vocab.get(t);
      return [v?.label ?? humanise(t), ...(v?.synonyms ?? [])];
    }),
  ];

  const list = o.questions ?? [];
  const answers: Answer[] = list.map((q, i) => {
    const named = new Set(q.capabilities);
    const tagged = strengths.filter((s) => named.has(s.id));
    const topic = tagged[0] ?? { capability: { name: q.question } };
    const fill = i === 0 ? 'map' : fills.get(q.id);

    const seen = new Set<string>();
    const shown: QuestionItem[] = [];
    const push = (x?: QuestionItem) => {
      if (!x || seen.has(x.key) || shown.length >= MAX_EVIDENCE) return;
      seen.add(x.key);
      shown.push(x);
    };
    for (const p of q.proof ?? []) {
      const placed = pinPick(p, evidence);
      if (placed) push(item(placed, topic));
    }
    // an answer without a fill shows its strengths' details in turn: the first of each, then the second…
    if (!fill) {
      const lists = tagged.map((s) => s.details.flatMap((p) => item(p, s) ?? []));
      for (let r = 0; shown.length < MAX_EVIDENCE && lists.some((l) => r < l.length); r++) for (const l of lists) push(l[r]);
    }

    let filled: AnswerFill | undefined;
    if (fill === 'map') {
      filled = {
        kind: 'map',
        strengths: strengths.map((s) => {
          const headline = s.headline && item(s.headline, s);
          return { ...tagOf(s), line: s.capability.line, total: s.total, ...(headline ? { headline } : {}), evidence: s.details.flatMap((p) => item(p, s) ?? []) };
        }),
      };
    } else if (fill === 'depth') {
      const deepest = strengths.map((s, k) => ({ s, k })).sort((a, b) => b.s.weight - a.s.weight || a.k - b.k);
      filled = { kind: 'depth', strengths: deepest.map(({ s }) => ({ ...tagOf(s), line: s.capability.line, total: s.total })), ...(o.gridHref ? { grid: o.gridHref } : {}) };
    } else if (fill === 'ask') {
      const once = new Set<string>();
      const groups = strengths
        .map((s) => ({
          ...tagOf(s),
          items: s.all.flatMap((p) => {
            const x = p.source === 'resume' ? item(p, s) : undefined;
            if (!x?.ask || once.has(x.key)) return [];
            once.add(x.key);
            return [x];
          }),
        }))
        .filter((g) => g.items.length);
      filled = { kind: 'ask', groups };
    } else if (fill === 'contact') {
      filled = { kind: 'contact', ...(env.resumeHref ? { resume: env.resumeHref } : {}), ...(env.contactHref ? { contact: env.contactHref } : {}) };
    }

    const full = q.full ?? fulls.get(q.id);
    return {
      id: q.id,
      n: i + 1,
      question: q.question,
      ...(full ? { full } : {}),
      answer: q.answer,
      tags: tagged.map(tagOf),
      evidence: shown,
      ...(filled ? { fill: filled } : {}),
      words: { question: [q.question, ...(full ? [full] : [])], strengths: [...new Set(tagged.flatMap(wordsOf))], evidence: shown.map((x) => x.title) },
    };
  });
  answers.forEach((a, i) => {
    const b = answers[i + 1];
    if (b) a.next = { n: b.n, question: b.question };
  });
  return { answers, ask: o.settings.ask === 'on' };
}
