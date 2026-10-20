/**
 * Decide's rules (documentation/editor/ai-services.md §9.1), the quick actions (ai-editing.md §4.2) and the
 * block types a request is offered (§2.4, §4.3). Pure: the connector runs it before anything is sent to a
 * writer; Jev, when it's on, answers the same questions and only ranks what code allows.
 */
import type { Block } from '../../content/schema';
import type { BlockType, Need, Scope } from './aiContract';

/** What kind of change a request is: which instruction the writer gets. Typed requests are rewrites. */
export type Kind = 'rewrite' | 'shorten' | 'lengthen' | 'simplify' | 'fix' | 'list' | 'table';

/** A quick action: its button's label and the instruction it sends. */
export interface QuickAction {
  kind: Exclude<Kind, 'rewrite'>;
  label: string;
  instruction: string;
}

/** The prompt's quick actions, in order (§4.4). */
export const QUICK_ACTIONS: QuickAction[] = [
  { kind: 'shorten', label: 'Make shorter', instruction: 'Make this shorter. Keep its meaning and its most important details.' },
  { kind: 'lengthen', label: 'Make longer', instruction: 'Make this longer, with detail that follows from the article. Invent no facts.' },
  { kind: 'simplify', label: 'Simplify', instruction: 'Simplify the words and sentences. Keep the meaning.' },
  { kind: 'fix', label: 'Fix spelling', instruction: 'Fix spelling, grammar and punctuation only. Change nothing else.' },
  { kind: 'list', label: 'Make a list', instruction: 'Turn this into a list, adapting the words.' },
  { kind: 'table', label: 'Make a table', instruction: 'Turn this into a table: column headings, and a row for each thing it compares or lists, adapting the words.' },
];

/** Something AI can never change, named by a request (§2.4, §10.2). */
export type Outside = 'address' | 'access' | 'status' | 'picture';

const RESEARCH = /\b(research|latest|current|this year|statistics?|stats|numbers|sources?|cite|citations?|look(ing)? up)\b/i;
const OUTSIDE: [Outside, RegExp][] = [
  ['address', /\b(slug|url)\b|\b(page'?s?|its|the) (web )?address\b/i],
  ['access', /\b(page'?s?|its) access\b|\bmake (it|this( page)?|the page) (private|public)\b/i],
  ['status', /\b(un)?publish (it|this( page)?|the page)\b|\b(page'?s?|its) status\b/i],
  ['picture', /\b(picture|image|photo)'?s? file\b|\breplace the (picture|image|photo)\b/i],
];

/** Every block type, in its usual order (the order offered when Jev isn't ranking). */
export const TYPE_ORDER: BlockType[] = ['text', 'heading', 'subheading', 'quote', 'table', 'collection', 'marker', 'divider', 'figure', 'gallery', 'carousel', 'video'];
const PICTURE_TYPES: Partial<Record<BlockType, number>> = { figure: 1, gallery: 2, carousel: 2 };

/** Decide's answer: whether it goes to a writer, what kind of change it is, and the block types allowed. */
export interface Decision {
  needs: Need;
  /** For `outside`: what was asked for. */
  outside?: Outside;
  kind: Kind;
  /** A block request that asks for another type (§4.3). */
  retype: boolean;
  types: BlockType[];
}

export interface DecideInput {
  instruction: string;
  scope: Scope;
  /** The block, for a block request. */
  block?: Block;
  /** A quick action's kind, when one was pressed. */
  action?: QuickAction['kind'];
  /** Pictures already in the article (a figure needs one, a gallery or carousel two). */
  pictures?: number;
  /** "Ask anyway" after a research note: go to the writer regardless. */
  anyway?: boolean;
}

/** The types a request may use, by code (§2.4): a block keeps its type unless it asks for another; picture blocks only with pictures to reuse. */
export function typesFor(scope: Scope, opts: { block?: Block; kind: Kind; pictures?: number }): { retype: boolean; types: BlockType[] } {
  if (scope === 'block' && opts.block) {
    const own = opts.block.type;
    const to: BlockType | null = opts.kind === 'table' ? 'table' : opts.kind === 'list' ? 'text' : null;
    return to && to !== own ? { retype: true, types: [to] } : { retype: false, types: [own] };
  }
  const pictures = opts.pictures ?? 0;
  return { retype: false, types: TYPE_ORDER.filter((t) => pictures >= (PICTURE_TYPES[t] ?? 0)) };
}

/** Decide, by rules: research words stop it (unless asked anyway), a field AI can't change stops it, and the types come from code. */
export function decideRules(input: DecideInput): Decision {
  const kind: Kind = input.action ?? 'rewrite';
  const { retype, types } = typesFor(input.scope, { block: input.block, kind, pictures: input.pictures });
  const typed = input.action ? '' : input.instruction;
  const outside = OUTSIDE.find(([, re]) => re.test(typed))?.[0];
  if (outside) return { needs: 'outside', outside, kind, retype, types };
  if (!input.anyway && RESEARCH.test(typed)) return { needs: 'research', kind, retype, types };
  return { needs: 'none', kind, retype, types };
}

/** The instruction a request sends: a quick action's own wording, or your words. */
export const instructionOf = (input: Pick<DecideInput, 'instruction' | 'action'>): string =>
  (input.action && QUICK_ACTIONS.find((a) => a.kind === input.action)?.instruction) || input.instruction.trim();
