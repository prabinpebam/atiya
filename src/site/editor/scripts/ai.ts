/**
 * Ask AI in the article editor (documentation/editor/ai-editing.md §4): holds the request for the canvas's
 * prompt. It sends the article as it is now (every block keyed) to the dev server's connector, reads the answer
 * as it streams, tells the canvas what to draw (scripts/aiPrompt.ts), and on Keep makes the change through the
 * editor's own `change`, so it saves, undoes and redraws like any edit.
 */
import { TAB, announce, editorUrl } from './client';
import { agentPrompt, COPIED, failureNote, keptLine, needsNote, readyLine, serviceLine, statusLine, UNRESEARCHED, type AiFailureCode, type AiNeeds, type AiNote, type AiOutside, type AiStep } from '../model/aiCopy';
import { STOPPED_KEPT, stepTo, stoppedTry, tryLine, type AiTry } from '../model/aiTries';
import { plainText } from '../../content/markdown';
import type { AiDo, AiView } from './aiPrompt';
import type { Article, Block } from '../../content/schema';

type Writer = { name: string; model: string; local: boolean; privatePages: boolean } | null;
type Proposal = { summary: string; body: Block[]; touched: string[]; anyway?: boolean };
type Asked = { instruction: string; action?: string; base?: Block; anyway?: boolean };

export interface AiHost {
  id: string;
  /** Whether the page is private (the service line says so). */
  isPrivate: boolean;
  /** The article now, every block keyed. */
  doc: () => Article;
  toCanvas: (m: Record<string, unknown>) => void;
  /** Makes the change, as an edit, with the block at this index selected. */
  keep: (next: Block[], select: number) => void;
  /** A section's proposal is kept on the server: shows it in the inspector's Review tab (§8). */
  review: () => void;
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
  // every answer, and what Stop kept, until one is kept or they're all discarded (§4.2)
  let tries: AiTry[] = [];
  let shown = 0;
  let last: Asked | null = null;
  // the block the running request started from, and its words as they stream
  let from: Block | undefined;
  let streamed = '';
  let ticker = 0;

  const draw = (v: Partial<AiView>) => {
    view = { ...view, ...v, index, service: serviceLine(writer, host.isPrivate), section: index >= 0 && host.doc().body[index]?.type === 'heading' };
    host.toCanvas({ type: 'ai', view });
  };
  const showTry = () => {
    const t = tries[shown];
    draw({ phase: 'proposed', after: wordsOf(t.block), summary: t.anyway ? `${t.summary}. ${UNRESEARCHED}.` : t.summary, shown, count: tries.length });
  };
  const noteOf = (n: AiNote, text = [n.title, n.detail].filter(Boolean).join(' ')) =>
    draw({ phase: 'note', note: text, choices: n.choices, setup: n.setup, back: tries.length > 0 });
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
    tries = [];
    shown = 0;
    draw({ phase: 'closed' });
    index = -1;
  };
  signal.addEventListener('abort', cancel);

  const ask = async (asked: Asked) => {
    cancel();
    last = asked;
    const doc = host.doc();
    key = keyOf(doc.body[index]);
    if (!key) return noteOf({ ...failureNote('refused'), choices: [] });
    // on a heading, its section (§4.1): the answer goes to the Review tab, not the result bar
    const scope = doc.body[index].type === 'heading' ? 'section' : 'block';
    // asking for more starts from the try shown
    const body = asked.base ? doc.body.map((b) => (keyOf(b) === key ? asked.base! : b)) : doc.body;
    from = asked.base ?? doc.body[index];
    streamed = '';
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
        body: JSON.stringify({ id: host.id, article: { ...doc, body }, target: { scope, key }, instruction: asked.instruction, ...(asked.action ? { action: asked.action } : {}), ...(asked.anyway ? { anyway: true } : {}) }),
        credentials: 'same-origin',
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      for await (const e of events(res)) {
        if (e.type === 'status') {
          step = e.data.step as AiStep;
          draw({ status: status() });
        } else if (e.type === 'words') {
          streamed = String(e.data.text ?? '');
          draw({ words: plainText(streamed) });
        } else if (e.type === 'proposal') {
          const proposal = e.data.proposal as Proposal;
          stopTicker();
          if (scope === 'section') {
            // the server kept it: the request is done, and the review takes over
            request = null;
            close();
            host.review();
            announce(readyLine(proposal.summary));
            return;
          }
          const block = proposal.body.find((b) => keyOf(b) === key);
          if (!block) return noteOf(failureNote('refused'));
          tries.push({ summary: proposal.summary, block, ...(proposal.anyway ? { anyway: true } : {}) });
          shown = tries.length - 1;
          showTry();
          announce(readyLine(proposal.summary));
        } else if (e.type === 'note') {
          stopTicker();
          const n = needsNote(e.data.needs as AiNeeds, e.data.outside as AiOutside | undefined, e.data.reason as string | undefined);
          noteOf(n);
          announce(n.title);
        } else if (e.type === 'error') {
          stopTicker();
          const n = failureNote(e.data.code as AiFailureCode, String(e.data.service ?? writer?.name ?? 'The service'), e.data.reason as string | undefined);
          noteOf(n);
          announce(n.title, 'negative');
        }
      }
    } catch {
      if (ac.signal.aborted) return;
      stopTicker();
      noteOf(failureNote('unreachable', 'the dev server'));
    } finally {
      if (request === ac) request = null;
      stopTicker();
    }
  };

  // Stop keeps what was written as a try; with nothing written, the tries stay as they were (§4.2)
  const stop = () => {
    if (view.phase !== 'working') return;
    cancel();
    const t = stoppedTry(from, streamed);
    if (t) {
      tries.push(t);
      shown = tries.length - 1;
    }
    if (tries.length) showTry();
    else noteOf(failureNote('stopped'));
    announce(t ? STOPPED_KEPT : failureNote('stopped').title);
  };

  // Copy for your agent: the prompt goes to the clipboard, and the note says so (§10.1)
  const copy = async () => {
    if (!last || !key) return;
    const text = agentPrompt({ mcp: new URL(editorUrl('mcp'), location.href).href, id: host.id, article: host.doc() as Parameters<typeof agentPrompt>[0]['article'], key, instruction: last.instruction });
    const ok = await navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
    const n = needsNote('research');
    if (ok) noteOf(n, COPIED);
    announce(ok ? COPIED : "Couldn't copy the prompt. Try again.", ok ? undefined : 'negative');
  };

  const keep = () => {
    const t = tries[shown];
    if (!t || !key) return;
    const doc = host.doc();
    const at = doc.body.findIndex((b) => keyOf(b) === key);
    close();
    if (at < 0) return announce("The block has gone: nothing changed.", 'negative');
    const next = doc.body.slice();
    next[at] = t.block;
    host.keep(next, at);
    announce(keptLine(t.summary));
  };

  return {
    /** Opens the prompt on the block at this index; on the block it's already about, it shows where it was. */
    async open(at: number) {
      if (index !== at) close();
      index = at;
      if (view.phase === 'working') draw({});
      else if (tries.length) showTry();
      else draw({ phase: 'ready', words: undefined, after: undefined });
      const r = await fetch(editorUrl('api/ai/status'), { headers: { 'X-Editor': '1', 'X-Editor-Tab': TAB }, credentials: 'same-origin', signal }).catch(() => null);
      const s = r?.ok ? ((await r.json()) as { writer: Writer }) : null;
      writer = s?.writer ?? null;
      if (index !== at || view.phase === 'closed') return;
      // nothing would be sent: say so before anything is typed (§4.5, §10)
      if (view.phase === 'ready' && !writer) noteOf(failureNote('no-service'));
      else if (view.phase === 'ready' && host.isPrivate && !writer!.privatePages) noteOf(failureNote('private', writer!.name));
      else draw({});
    },
    /** What the prompt asked for. */
    message(m: AiDo) {
      if (m.do === 'send') void ask({ instruction: m.instruction, action: m.action });
      else if (m.do === 'more' && tries[shown]) void ask({ instruction: m.instruction, base: tries[shown].block });
      else if (m.do === 'retry' && last) void ask(last);
      else if (m.do === 'anyway' && last) void ask({ ...last, anyway: true });
      else if (m.do === 'copy') void copy();
      else if (m.do === 'setup') {
        close();
        location.assign(editorUrl('ai/'));
      } else if (m.do === 'keep') keep();
      else if (m.do === 'stop') stop();
      else if (m.do === 'step' && tries.length) {
        shown = stepTo(shown, m.by, tries.length);
        showTry();
        announce(tryLine(shown, tries.length, tries[shown].summary));
      } else if (m.do === 'back' && tries.length) showTry();
      else if (m.do === 'cancel') {
        if (tries.length) showTry();
        else draw({ phase: 'ready', after: undefined, words: undefined });
      } else if (m.do === 'discard') {
        tries = [];
        shown = 0;
        draw({ phase: 'ready', after: undefined, words: undefined });
      } else if (m.do === 'close') close();
    },
    /** Draws the prompt again in a canvas just drawn again (a save's redraw). */
    again() {
      if (view.phase !== 'closed') host.toCanvas({ type: 'ai', view });
    },
  };
}
