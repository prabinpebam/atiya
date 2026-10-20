/**
 * A stand-in AI service for edit mode's tests (documentation/editor/ai-plan.md, S3, S4): it answers like Ollama
 * (`/api/tags`, and the OpenAI-compatible `/v1/chat/completions`, streamed), so tests never reach a real model.
 * Its answer is canned: the block the request names, cut to its first sentence (or, asked for "longer", with a
 * sentence added); the AI screen's connection test gets `{"ok": true}`. A request that says "slowly" streams
 * slowly enough to stop. A model named after a failure fails that way (`FAILURES`), so a test can choose it on a card.
 */
import { createServer } from 'node:http';

/** Models that fail, by name: an HTTP status and its body, or (`text`) an answer that isn't JSON. */
export const FAILURES = {
  'key-refused': { status: 401, body: '{"error":{"message":"invalid api key"}}' },
  'no-credit': { status: 402, body: '{"error":{"message":"insufficient_quota"}}' },
  busy: { status: 429, body: '{"error":{"message":"rate limited"}}' },
  'no-shape': { text: 'Sure! It works.' },
};
const MODELS = ['stand-in', ...Object.keys(FAILURES)];

/** The words a text block is cut to: its first sentence, or the whole of a short one. */
const shorter = (s) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(s)?.[0] ?? s).trim();
/** The sentence a "longer" answer adds. */
export const MORE = 'It says a little more.';
/** The paragraph a section's answer adds at its end. */
export const ADDED = 'A closing line the stand-in added.';

/** A section's answer: every paragraph after the heading changed as a block would be, and one paragraph added at its end. */
function sectionAnswer(body, key, change) {
  const at = body.findIndex((b) => b.key === key);
  let end = at + 1;
  while (end < body.length && !(body[end].type === 'heading' && body[end].level <= body[at].level)) end++;
  const changes = body
    .slice(at + 1, end)
    .filter((b) => b.type === 'text' && change(b.markdown) !== b.markdown)
    .map(({ key: k, ...rest }) => ({ op: 'replace', key: k, after: null, block: { ...rest, markdown: change(rest.markdown) } }));
  changes.push({ op: 'insert', key: null, after: body[end - 1].key, block: { type: 'text', markdown: ADDED } });
  return { changes, header: null, summary: 'Tightened the section', needs: { kind: 'none', reason: null } };
}

/** The answer to one request, from its messages. */
export function answerFor(messages) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  if (/connection test/i.test(system)) return { ok: true };
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  const key = /\(key ([a-z0-9]{6})\)/.exec(system)?.[1];
  const material = /<material>\n([\s\S]*)\n<\/material>/.exec(user)?.[1];
  const block = key && material ? JSON.parse(material).body.find((b) => b.key === key) : null;
  if (!block) return { changes: [], header: null, summary: 'Changed nothing', needs: { kind: 'unclear', reason: 'Which block?' } };
  const longer = /longer/i.test(/^Request: (.*)$/m.exec(user)?.[1] ?? '');
  const change = (s) => (longer ? `${s.trim()} ${MORE}` : shorter(s));
  if (/scope is one section/.test(system)) return sectionAnswer(JSON.parse(material).body, key, change);
  const { key: _key, ...rest } = block;
  const next = block.type === 'text' ? { ...rest, markdown: change(block.markdown) } : 'text' in block ? { ...rest, text: change(block.text) } : rest;
  return { changes: [{ op: 'replace', key, after: null, block: next }], header: null, summary: longer ? 'Lengthened the paragraph' : 'Shortened the paragraph', needs: { kind: 'none', reason: null } };
}

/** Starts the stand-in on `port`; resolves to its server. */
export function startStandIn(port) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ models: MODELS.map((name) => ({ name })) }));
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404);
      return res.end();
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const { messages = [], model } = JSON.parse(raw || '{}');
      const failure = FAILURES[model];
      if (failure?.status) {
        res.writeHead(failure.status, { 'Content-Type': 'application/json' });
        return res.end(failure.body);
      }
      const slow = /slowly/i.test(messages.find((m) => m.role === 'user')?.content ?? '');
      const text = failure?.text ?? JSON.stringify(answerFor(messages));
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      for (let i = 0; i < text.length && !res.destroyed; i += 12) {
        send({ choices: [{ delta: { content: text.slice(i, i + 12) }, finish_reason: null }] });
        await new Promise((r) => setTimeout(r, slow ? 400 : 10));
      }
      send({ choices: [{ delta: {}, finish_reason: 'stop' }] });
      res.end('data: [DONE]\n\n');
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
