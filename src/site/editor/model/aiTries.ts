/**
 * The tries of one Ask AI request (documentation/editor/ai-editing.md §4.2): every answer, and what Stop kept,
 * is a try to step between until one is kept or they're all discarded. Pure: scripts/ai.ts holds the list.
 */
import { wordsField } from './aiText';
import type { Block } from '../../content/schema';

/** One try: the block as AI would make it, and what it says it did. */
export interface AiTry {
  summary: string;
  block: Block;
  /** Written after Ask anyway, without research. */
  anyway?: boolean;
}

/** A stopped try's summary. */
export const STOPPED_TRY = 'Stopped part way';
/** Announced when Stop keeps what was written. */
export const STOPPED_KEPT = 'Stopped. What was written is kept as a try.';

/** Where the result bar is: "2 of 3", or nothing while there's one try. */
export const triesLine = (shown: number, count: number): string => (count > 1 ? `${shown + 1} of ${count}` : '');

/** Announced on stepping to a try. */
export const tryLine = (shown: number, count: number, summary: string): string => `Try ${shown + 1} of ${count}: ${summary}`;

/**
 * What Stop keeps: the block with the words that arrived so far in place of its own. Nothing when no words came,
 * or for a block whose words don't stream (a retype arrives whole, so it can't be half-made).
 */
export function stoppedTry(block: Block | undefined, words: string): AiTry | null {
  const field = block ? wordsField(block.type) : null;
  if (!block || !field || !words.trim()) return null;
  return { summary: STOPPED_TRY, block: { ...block, [field]: words } as Block };
}

/** The try shown after a step, kept inside the list. */
export const stepTo = (shown: number, by: number, count: number): number => Math.min(Math.max(shown + by, 0), Math.max(count - 1, 0));
