/**
 * A stand-in AI service for edit mode's tests (documentation/editor/ai-plan.md, S3): it answers like Ollama
 * (`/api/tags`, and the OpenAI-compatible `/v1/chat/completions`, streamed), so tests never reach a real model.
 * Its answer is canned: the block the request names, cut to its first sentence. A request that says "slowly"
 * streams slowly enough to stop.
 */
import { createServer } from 'node:http';

/** The words a text block is cut to: its first sentence, or the whole of a short one. */
const shorter = (s) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(s)?.[0] ?? s).trim();

/** The answer to one request, from its messages. */
export function answerFor(messages) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  const key = /\(key ([a-z0-9]{6})\)/.exec(system)?.[1];
  const material = /<material>\n([\s\S]*)\n<\/material>/.exec(user)?.[1];
  const block = key && material ? JSON.parse(material).body.find((b) => b.key === key) : null;
  if (!block) return { changes: [], header: null, summary: 'Changed nothing', needs: { kind: 'unclear', reason: 'Which block?' } };
  const { key: _key, ...rest } = block;
  const next = block.type === 'text' ? { ...rest, markdown: shorter(block.markdown) } : 'text' in block ? { ...rest, text: shorter(block.text) } : rest;
  return { changes: [{ op: 'replace', key, after: null, block: next }], header: null, summary: 'Shortened the paragraph', needs: { kind: 'none', reason: null } };
}

/** Starts the stand-in on `port`; resolves to its server. */
export function startStandIn(port) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ models: [{ name: 'stand-in' }] }));
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404);
      return res.end();
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const { messages = [] } = JSON.parse(raw || '{}');
      const slow = /slowly/i.test(messages.find((m) => m.role === 'user')?.content ?? '');
      const text = JSON.stringify(answerFor(messages));
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
