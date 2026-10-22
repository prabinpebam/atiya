/**
 * The OpenAI-compatible writer (documentation/editor/ai-services.md §9.2): OpenAI, Ollama, LM Studio and the
 * other services that speak its chat API. Structured output with a strict schema, streamed; local models are
 * asked not to think first (`reasoning_effort: none`: about a third faster). Time limits: an answer starts
 * within 30 s (120 s on this computer, where the model may be loading) and never stalls for 30 s.
 */
import type { ChatMessage } from '../model/aiPrompt';
import type { PictureMessage } from '../model/altText';

/** What went wrong, named for the prompt's note (ai-editing.md §10.4) and the AI screen's card state. */
export type AiFailure = 'key-refused' | 'no-credit' | 'busy' | 'unreachable' | 'not-running' | 'stalled' | 'stopped' | 'rejected';

export class AiError extends Error {
  constructor(
    readonly code: AiFailure,
    /** What the writer had sent before it failed. */
    readonly partial = '',
    detail = '',
  ) {
    super(detail || code);
  }
}

export interface WriteCall {
  base: string;
  key?: string;
  model: string;
  /** The messages; a picture goes as a part of one (suggested alt text, the Test's picture). */
  messages: (ChatMessage | PictureMessage)[];
  schema: Record<string, unknown>;
  local: boolean;
  signal?: AbortSignal;
  /** Every piece as it streams, with the whole text so far. */
  onText?: (sofar: string) => void;
  fetch?: typeof fetch;
  startMs?: number;
  stallMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface Written {
  text: string;
  /** Cut off at the model's limit. */
  cut: boolean;
  ms: number;
  /** When the first piece arrived. */
  firstMs: number | null;
}

/** Complete server-sent events split off a buffer: each event's data, and what's left. */
export function splitSse(buffer: string): { data: string[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  const data = parts
    .map((p) =>
      p
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n'),
    )
    .filter(Boolean);
  return { data, rest };
}

/** A failed response's failure. */
export function failureOf(status: number, body: string): AiFailure {
  if (status === 401 || status === 403) return 'key-refused';
  if (status === 402 || /insufficient_quota|quota|credit|billing/i.test(body)) return 'no-credit';
  if (status === 429) return 'busy';
  if (status >= 500) return 'unreachable';
  return 'rejected';
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Writes one answer, streaming. Throws an AiError, carrying what had arrived. */
export async function writeOpenAI(c: WriteCall): Promise<Written> {
  const f = c.fetch ?? fetch;
  const t0 = Date.now();
  const ctl = new AbortController();
  let why: 'stopped' | 'stalled' | null = null;
  const stop = () => {
    why ??= 'stopped';
    ctl.abort();
  };
  if (c.signal?.aborted) stop();
  c.signal?.addEventListener('abort', stop);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      why ??= 'stalled';
      ctl.abort();
    }, ms);
  };
  const body = JSON.stringify({
    model: c.model,
    messages: c.messages,
    stream: true,
    response_format: { type: 'json_schema', json_schema: { name: 'edit_answer', strict: true, schema: c.schema } },
    ...(c.local ? { reasoning_effort: 'none' } : {}),
  });
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'text/event-stream' };
  if (c.key) headers.authorization = `Bearer ${c.key}`;
  let text = '';
  let cut = false;
  let firstMs: number | null = null;
  try {
    arm(c.startMs ?? (c.local ? 120_000 : 30_000));
    let res!: Response;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await f(`${c.base.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers, body, signal: ctl.signal });
      } catch (e) {
        if (why) throw e;
        const code = (e as { cause?: { code?: string } }).cause?.code;
        throw new AiError(code === 'ECONNREFUSED' && c.local ? 'not-running' : 'unreachable', '', code ?? '');
      }
      if (res.ok) break;
      const said = await res.text().catch(() => '');
      const failure = failureOf(res.status, said);
      const after = Number(res.headers.get('retry-after'));
      if (failure === 'busy' && attempt === 0 && after > 0 && after <= 10) {
        await (c.sleep ?? wait)(after * 1000);
        continue;
      }
      throw new AiError(failure, '', said.slice(0, 300));
    }
    if (!res.body) throw new AiError('unreachable', '', 'no body');
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    arm(c.stallMs ?? 30_000);
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const { data, rest } = splitSse(buffer);
      buffer = rest;
      for (const d of data) {
        if (d === '[DONE]') continue;
        let j: { choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[]; error?: { message?: string } };
        try {
          j = JSON.parse(d);
        } catch {
          continue;
        }
        if (j.error) throw new AiError('rejected', text, j.error.message ?? '');
        const choice = j.choices?.[0];
        const piece = choice?.delta?.content ?? '';
        if (choice?.finish_reason === 'length') cut = true;
        if (!piece) continue;
        firstMs ??= Date.now() - t0;
        text += piece;
        arm(c.stallMs ?? 30_000);
        c.onText?.(text);
      }
    }
    return { text, cut, ms: Date.now() - t0, firstMs };
  } catch (e) {
    if (why) throw new AiError(why, text);
    if (e instanceof AiError) throw e.partial || !text ? e : new AiError(e.code, text, e.message);
    throw new AiError('unreachable', text, e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
    c.signal?.removeEventListener('abort', stop);
  }
}
