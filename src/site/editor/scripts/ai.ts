/**
 * Ask AI in the article editor (documentation/editor/ai-editing.md §4): holds the request for the canvas's
 * prompt. It sends the article as it is now (every block keyed) to the dev server's connector, reads the answer
 * as it streams, tells the canvas what to draw (scripts/aiPrompt.ts), and on Keep makes the change through the
 * editor's own `change`, so it saves, undoes and redraws like any edit.
 */
import { TAB, announce, editorUrl } from './client';
import { failureNote, keptLine, needsNote, readyLine, serviceLine, statusLine, STOPPED, type AiFailureCode, type AiNeeds, type AiOutside, type AiStep } from '../model/aiCopy';
import { plainText } from '../../content/markdown';
import type { AiDo, AiView } from './aiPrompt';
import type { Article, Block } from '../../content/schema';

type Writer = { name: string; model: string; local: boolean; privatePages: boolean } | null;
type Proposal = { summary: string; body: Block[]; touched: string[] };

export interface AiHost {
  id: string;
  /** Whether the page is private (the service line says so). */
  isPrivate: boolean;
  /** The article now, every block keyed. */
  doc: () => Article;
  toCanvas: (m: Record<string, unknown>) => void;
  /** Makes the change, as an edit, with the block at this index selected. */
  keep: (next: Block[], select: number) => void;
}

const keyOf = (b: Block | undefined) => (b as { key?: string } | undefined)?.key;
const wordsOf = (b: Block | undefined): string => {
  if (!b) return '';
  const o = b as { markdown?: string; text?: string };
  return o.markdown !== undefined ? plainText(o.markdown) : (o.text ?? '');
};

/** Reads server-sent events from a response, one {type, data} at a time. */
async function* events(res: Response): AsyncGenerator<{ type: string; data: Record<string, unknown> }> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += value;
    let cut: number;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const type = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (type && data) yield { type, data: JSON.parse(data) };
    }
  }
}

export function initAi(host: AiHost, signal: AbortSignal) {
  let writer: Writer = null;
  let index = -1;
  let key: string | undefined;
  let view: AiView = { index: -1, phase: 'closed' };
  let request: AbortController | null = null;
  let proposal: Proposal | null = null;
  let last: { instruction: string; action?: string } | null = null;
  let ticker = 0;

  const draw = (v: Partial<AiView>) => {
    view = { ...view, ...v, index, service: serviceLine(writer, host.isPrivate) };
    host.toCanvas({ type: 'ai', view });
  };
  const stopTicker = () => {
    clearInterval(ticker);
    ticker = 0;
  };
  const cancel = () => {
    stopTicker();
    request?.abort();
    request = null;
  };
  const close = () => {
    cancel();
    proposal = null;
    draw({ phase: 'closed' });
    index = -1;
  };
  signal.addEventListener('abort', cancel);

  const ask = async (instruction: string, action?: string) => {
    cancel();
    last = { instruction, action };
    proposal = null;
    const doc = host.doc();
    key = keyOf(doc.body[index]);
    if (!key) return draw({ phase: 'note', note: failureNote('refused').title, retry: false });
    const started = Date.now();
    let step: AiStep = 'deciding';
    const status = () => statusLine(step, writer?.name, (Date.now() - started) / 1000);
    draw({ phase: 'working', status: status(), words: '' });
    ticker = window.setInterval(() => draw({ status: status() }), 1000);
    const ac = (request = new AbortController());
    try {
      const res = await fetch(editorUrl('api/ai/propose'), {
        method: 'POST',
        headers: { 'X-Editor': '1', 'X-Editor-Tab': TAB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: host.id, article: doc, target: { scope: 'block', key }, instruction, ...(action ? { action } : {}) }),
        credentials: 'same-origin',
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      for await (const e of events(res)) {
        if (e.type === 'status') {
          step = e.data.step as AiStep;
          draw({ status: status() });
        } else if (e.type === 'words') draw({ words: plainText(String(e.data.text ?? '')) });
        else if (e.type === 'proposal') {
          proposal = e.data.proposal as Proposal;
          const after = proposal.body.find((b) => keyOf(b) === key);
          stopTicker();
          draw({ phase: 'proposed', after: wordsOf(after), summary: proposal.summary });
          announce(readyLine(proposal.summary));
        } else if (e.type === 'note') {
          stopTicker();
          const n = needsNote(e.data.needs as AiNeeds, e.data.outside as AiOutside | undefined, e.data.reason as string | undefined);
          draw({ phase: 'note', note: [n.title, n.detail].filter(Boolean).join(' '), retry: false });
          announce(n.title);
        } else if (e.type === 'error') {
          stopTicker();
          const n = failureNote(e.data.code as AiFailureCode, String(e.data.service ?? writer?.name ?? 'The service'), e.data.reason as string | undefined);
          draw({ phase: 'note', note: [n.title, n.detail].filter(Boolean).join(' '), retry: n.choices.includes('retry') });
          announce(n.title, 'negative');
        }
      }
    } catch {
      if (ac.signal.aborted) return;
      stopTicker();
      const n = failureNote('unreachable', 'the dev server');
      draw({ phase: 'note', note: `${n.title} ${n.detail}`, retry: true });
    } finally {
      if (request === ac) request = null;
      stopTicker();
    }
  };

  const keep = () => {
    if (!proposal || !key) return;
    const doc = host.doc();
    const at = doc.body.findIndex((b) => keyOf(b) === key);
    const block = proposal.body.find((b) => keyOf(b) === key);
    const summary = proposal.summary;
    close();
    if (at < 0 || !block) return announce("The block has gone: nothing changed.", 'negative');
    const next = doc.body.slice();
    next[at] = block;
    host.keep(next, at);
    announce(keptLine(summary));
  };

  return {
    /** Opens the prompt on the block at this index. */
    async open(at: number) {
      if (index !== at) close();
      index = at;
      draw({ phase: 'ready', words: undefined, after: undefined });
      const r = await fetch(editorUrl('api/ai/status'), { headers: { 'X-Editor': '1', 'X-Editor-Tab': TAB }, credentials: 'same-origin', signal }).catch(() => null);
      const s = r?.ok ? ((await r.json()) as { writer: Writer }) : null;
      writer = s?.writer ?? null;
      if (index === at && view.phase === 'ready') draw({});
    },
    /** What the prompt asked for. */
    message(m: AiDo) {
      if (m.do === 'send') void ask(m.instruction, m.action);
      else if (m.do === 'retry' && last) void ask(last.instruction, last.action);
      else if (m.do === 'keep') keep();
      else if (m.do === 'stop') {
        cancel();
        draw({ phase: 'note', note: STOPPED, retry: true });
        announce(STOPPED);
      } else if (m.do === 'discard') {
        proposal = null;
        draw({ phase: 'ready', after: undefined, words: undefined });
      } else close();
    },
    /** Draws the prompt again in a canvas just drawn again (a save's redraw). */
    again() {
      if (view.phase !== 'closed') host.toCanvas({ type: 'ai', view });
    },
  };
}
