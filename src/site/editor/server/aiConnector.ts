/**
 * The connector (documentation/editor/ai-services.md §9): every request from the editor goes through Decide
 * (rules; Jev in phase 2), Write (the writer chosen on the AI screen, streamed) and Check (the answer's shape,
 * its scope and the content check, exactly as a save). A refused answer is sent back once with the reasons.
 * It writes nothing: Keep is the editor's own save.
 */
import type { Article, Block } from '../../content/schema';
import { answerSchema, applyAnswer, mayChangeHeader, parseAnswer, type Need, type Target } from '../model/aiContract';
import { decideRules, instructionOf, type Outside, type QuickAction } from '../model/aiDecide';
import { messages, retryMessages } from '../model/aiPrompt';
import { partialWords, wordsField } from '../model/aiText';
import { findKey } from '../model/keys';
import { articleKey } from './articles';
import { localContext } from './aiLocal';
import { AiError, writeOpenAI, type AiFailure, type WriteCall, type Written } from './aiOpenAI';
import { keyFor, readSettings, writerOf, type AiSettings } from './aiSettings';
import { checkOnly, jsonBytes } from './store';

export interface ProposeRequest {
  /** The article's ID. */
  id: string;
  /** The article as the editor has it now, unsaved edits included, every block with its key. */
  article: Article;
  target: Target;
  instruction: string;
  action?: QuickAction['kind'];
  /** "Ask anyway" after a research note. */
  anyway?: boolean;
}

export interface Proposal {
  summary: string;
  /** The article's body with the answer made. */
  body: Block[];
  header: { title?: string; summary?: string } | null;
  /** The keys of the blocks it changed or added. */
  touched: string[];
  retype: boolean;
  service: string;
  model: string;
  ms: number;
  /** Written after "Ask anyway": check every number. */
  anyway?: boolean;
}

export type AiEvent =
  | { type: 'status'; step: 'deciding' | 'writing' | 'checking'; service?: string; model?: string }
  | { type: 'words'; text: string }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'note'; needs: Exclude<Need, 'none'>; outside?: Outside; reason?: string }
  | { type: 'error'; code: AiFailure | 'no-service' | 'private' | 'refused'; service?: string; reason?: string };

export interface ConnectorDeps {
  settings: () => AiSettings;
  write: (c: WriteCall) => Promise<Written>;
  check: (id: string, before: Article, after: Article) => { message: string }[];
  isPrivate: (id: string) => boolean;
  context: (base: string, model: string) => Promise<number | null>;
}

const DEFAULTS: ConnectorDeps = {
  settings: () => readSettings(),
  write: writeOpenAI,
  check: (id, before, after) => {
    const key = articleKey(id);
    return checkOnly([{ key, bytes: jsonBytes(after) }], {}, [{ key, bytes: jsonBytes(before) }]);
  },
  isPrivate: (id) => articleKey(id).startsWith('/private/'),
  context: (base, model) => localContext(base, model),
};

/** Runs one request, telling `emit` each step. Never throws: every failure is an `error` event. */
export async function propose(req: ProposeRequest, emit: (e: AiEvent) => void, signal?: AbortSignal, deps: Partial<ConnectorDeps> = {}): Promise<void> {
  const d = { ...DEFAULTS, ...deps };
  const t0 = Date.now();
  const block = req.target.key ? findKey(req.article.body, req.target.key)?.block : undefined;
  if (req.target.scope === 'block' && !block) return emit({ type: 'error', code: 'refused', reason: 'the block is no longer in the article' });

  // 1. Decide
  emit({ type: 'status', step: 'deciding' });
  const pictures = req.article.body.filter((b) => b.type === 'figure').length;
  const decision = decideRules({ instruction: req.instruction, scope: req.target.scope, block, action: req.action, pictures, anyway: req.anyway });
  if (decision.needs !== 'none') return emit({ type: 'note', needs: decision.needs, outside: decision.outside });
  const target: Target = { ...req.target, retype: decision.retype };

  const settings = d.settings();
  const writer = writerOf(settings);
  if (!writer) return emit({ type: 'error', code: 'no-service' });
  if (!writer.privatePages && d.isPrivate(req.id)) return emit({ type: 'error', code: 'private', service: writer.name });

  // 2. Write, then 3. Check; once more with the reasons if refused
  const header = mayChangeHeader(target);
  const schema = answerSchema(decision.types, { header });
  const ctx = writer.local ? ((await d.context(writer.base, writer.model)) ?? 8192) : 64_000;
  let sent = messages({ instruction: instructionOf(req), target, article: req.article, types: decision.types, kind: decision.kind, header, anyway: req.anyway, budget: ctx * 2 });
  const field = target.scope === 'block' && !decision.retype && block ? wordsField(block.type) : null;
  let first: string[] | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    emit({ type: 'status', step: 'writing', service: writer.name, model: writer.model });
    let last = '';
    let lastAt = 0;
    let written: Written;
    try {
      written = await d.write({
        base: writer.base,
        key: keyFor(writer.id),
        model: writer.model,
        messages: sent,
        schema,
        local: writer.local,
        signal,
        onText: field
          ? (raw) => {
              const words = partialWords(raw, field);
              if (words === null || words === last || Date.now() - lastAt < 40) return;
              last = words;
              lastAt = Date.now();
              emit({ type: 'words', text: words });
            }
          : undefined,
      });
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'unreachable';
      return emit({ type: 'error', code, service: writer.name });
    }
    emit({ type: 'status', step: 'checking' });
    const reasons = checkAnswer(written);
    if (!reasons.length) return;
    if (!first) {
      first = reasons;
      sent = retryMessages(sent, written.text, reasons);
      continue;
    }
    return emit({ type: 'error', code: 'refused', service: writer.name, reason: first[0] });
  }

  function checkAnswer(written: Written): string[] {
    if (written.cut) return ['the answer was cut off at the model\'s limit: keep it shorter'];
    const parsed = parseAnswer(written.text);
    if (!parsed.ok) return parsed.reasons;
    const answer = parsed.answer;
    if (answer.needs.kind !== 'none') {
      emit({ type: 'note', needs: answer.needs.kind, reason: answer.needs.reason ?? undefined });
      return [];
    }
    const applied = applyAnswer(req.article, answer, target, decision.types);
    if (!applied.ok) return applied.reasons;
    const issues = d.check(req.id, req.article, applied.article);
    if (issues.length) return issues.slice(0, 3).map((i) => i.message);
    const h = answer.header;
    emit({
      type: 'proposal',
      proposal: {
        summary: answer.summary.trim() || 'Changed by AI',
        body: applied.article.body,
        header: h && (h.title !== null || h.summary !== null) ? { ...(h.title !== null ? { title: h.title } : {}), ...(h.summary !== null ? { summary: h.summary } : {}) } : null,
        touched: applied.touched,
        retype: decision.retype,
        service: writer!.name,
        model: writer!.model,
        ms: Date.now() - t0,
        ...(req.anyway ? { anyway: true } : {}),
      },
    });
    return [];
  }
}

/** What the prompt's service line names: the writer, or nothing set up. */
export function writerLine(settings = readSettings()): { name: string; model: string; local: boolean; privatePages: boolean } | null {
  const w = writerOf(settings);
  return w ? { name: w.name, model: w.model, local: w.local, privatePages: w.privatePages } : null;
}
