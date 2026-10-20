import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addService,
  ago,
  cardState,
  disclaimerOf,
  failureWords,
  idFor,
  keyMissingLine,
  offerLine,
  offers,
  removeService,
  setWriter,
  testLine,
  updateService,
  type Runner,
} from '../../src/site/editor/model/aiServices';
import { EMPTY_SETTINGS, keyVariable, readSettings, settingsFile, type AiService } from '../../src/site/editor/server/aiSettings';
import { aiServicesRoute, testService } from '../../src/site/editor/server/aiServices';
import { propose, writerLine, type AiEvent } from '../../src/site/editor/server/aiConnector';
import { guard } from '../../src/site/editor/model/guard';

const service = (id: string, more: Partial<AiService> = {}): AiService => ({ id, kind: 'openai-compatible', provider: 'other', name: id, base: `https://${id}.test/v1`, model: 'm', local: false, privatePages: true, ...more });
const NOW = Date.parse('2026-10-20T12:00:00Z');
const before = (s: number) => new Date(NOW - s * 1000).toISOString();

describe('the AI screen: services and the writer (ai-services.md §7)', () => {
  it('makes the first service the writer, and keeps the writer after that', () => {
    const one = addService(EMPTY_SETTINGS, service('a'));
    expect(one.writer).toBe('a');
    const two = addService(one, service('b'));
    expect(two.services.map((s) => s.id)).toEqual(['a', 'b']);
    expect(two.writer).toBe('a');
  });

  it('moves the writer to the next service when the writer is removed, or to none', () => {
    const s = addService(addService(EMPTY_SETTINGS, service('a')), service('b'));
    expect(removeService(s, 'a').writer).toBe('b');
    expect(removeService(s, 'b').writer).toBe('a');
    expect(removeService(removeService(s, 'a'), 'b')).toMatchObject({ services: [], writer: null });
  });

  it('sets the writer only to a service that is there', () => {
    const s = addService(addService(EMPTY_SETTINGS, service('a')), service('b'));
    expect(setWriter(s, 'b').writer).toBe('b');
    expect(setWriter(s, 'gone')).toBe(s);
  });

  it('changes one service and keeps every other field', () => {
    const s = addService(addService(EMPTY_SETTINGS, service('a')), service('b'));
    const changed = updateService(s, 'b', { privatePages: false });
    expect(changed.services[1]).toEqual({ ...service('b'), privatePages: false });
    expect(changed.services[0]).toBe(s.services[0]);
    expect(changed.decider).toEqual(s.decider);
  });

  it('makes a short, unique ID from a name', () => {
    expect(idFor('OpenAI', [])).toBe('openai');
    expect(idFor('Stand-in cloud', [])).toBe('stand-in-cloud');
    expect(idFor('OpenAI', ['openai', 'openai-2'])).toBe('openai-3');
    expect(idFor('  !!  ', [])).toBe('service');
    expect(idFor('a'.repeat(40), []).length).toBeLessThanOrEqual(30);
  });
});

describe('the AI screen: a card in words (§8.2)', () => {
  it('says Key missing before anything else for a cloud service without its key', () => {
    expect(cardState(service('a', { lastTest: { at: before(5), ok: true } }), false)).toEqual({ label: 'Key missing', tone: 'negative' });
    expect(cardState(service('a', { local: true }), false).label).toBe('Untested');
  });

  it('follows the last test', () => {
    expect(cardState(service('a'), true)).toEqual({ label: 'Untested', tone: 'neutral' });
    expect(cardState(service('a', { lastTest: { at: before(5), ok: true } }), true)).toEqual({ label: 'Ready', tone: 'positive' });
    for (const [state, label] of [
      ['key-refused', 'Key refused'],
      ['no-credit', 'Out of credit'],
      ['busy', 'Busy'],
      ['not-running', 'Not running'],
      ['shape', "Can't follow the shape"],
    ])
      expect(cardState(service('a', { lastTest: { at: before(5), ok: false, state } }), true)).toEqual({ label, tone: 'negative' });
  });

  it('says how long ago', () => {
    expect(ago(before(10), NOW)).toBe('just now');
    expect(ago(before(60), NOW)).toBe('1 minute ago');
    expect(ago(before(60 * 5), NOW)).toBe('5 minutes ago');
    expect(ago(before(3600 * 3), NOW)).toBe('3 hours ago');
    expect(ago(before(86400), NOW)).toBe('yesterday');
    expect(ago(before(86400 * 4), NOW)).toBe('4 days ago');
  });

  it('says what the last test found, and what to do about a failure', () => {
    expect(testLine(service('a'), NOW)).toBe('Not tested yet.');
    expect(testLine(service('a', { lastTest: { at: before(120), ok: true, ms: 1234 } }), NOW)).toBe('Works: answered in 1.2 s, 2 minutes ago.');
    expect(testLine(service('Mine', { lastTest: { at: before(10), ok: false, state: 'shape' } }), NOW)).toMatch(/^This model didn't return the shape .*Tested just now\.$/);
    for (const state of ['key-refused', 'no-credit', 'busy', 'not-running', 'unreachable', 'stalled', 'rejected', 'key-missing'] as const) expect(failureWords(state, 'Mine').length).toBeGreaterThan(10);
  });
});

describe('the AI screen: where words go, and what is on this computer (§6.2, §7.1)', () => {
  it('has a disclaimer for every provider, and terms for the ones that publish them', () => {
    expect(disclaimerOf('ollama').words).toMatch(/nothing leaves/);
    expect(disclaimerOf('openai').link).toMatch(/^https:\/\/openai\.com\//);
    expect(disclaimerOf('other').words).toMatch(/its own terms/);
  });

  it('offers only the runners not added yet', () => {
    const runners: Runner[] = [
      { id: 'ollama', name: 'Ollama', base: 'http://localhost:11434/v1', models: ['a', 'b'] },
      { id: 'lmstudio', name: 'LM Studio', base: 'http://localhost:1234/v1', models: ['c'] },
    ];
    expect(offers(runners, [{ base: 'http://localhost:11434/v1/' }]).map((r) => r.id)).toEqual(['lmstudio']);
    expect(offerLine(runners[0])).toBe('Ollama is running on this computer, with 2 models.');
    expect(offerLine(runners[1])).toBe('LM Studio is running on this computer, with 1 model.');
  });

  it('names the Credential Manager entry a missing key goes in', () => {
    expect(keyMissingLine('atiya-ai-openai')).toBe('Add the key to Windows Credential Manager as atiya-ai-openai, then restart the site.');
  });
});

describe('the AI screen: Test (§7.4)', () => {
  const sse = (text: string) =>
    new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  process.env.ATIYA_AI_CREDENTIALS = 'off';
  process.env.ATIYA_AI_KEYED_KEY = 'not-a-real-key';

  it('says Key missing without sending anything', async () => {
    let sent = 0;
    const r = await testService(service('unkeyed'), async () => (sent++, sse('{"ok":true}')));
    expect(r.state).toBe('key-missing');
    expect(sent).toBe(0);
  });

  it('works when the model answers the shape, and says what went wrong when it does not', async () => {
    expect((await testService(service('keyed'), async () => sse('{"ok":true}'))).state).toBe('ok');
    expect((await testService(service('local', { local: true }), async () => sse('{"ok":true}'))).state).toBe('ok');
    expect((await testService(service('keyed'), async () => sse('Sure! It works.'))).state).toBe('shape');
    expect((await testService(service('keyed'), async () => sse('{"fine":1}'))).state).toBe('shape');
    expect((await testService(service('keyed'), async () => new Response('{}', { status: 401 }))).state).toBe('key-refused');
    expect((await testService(service('keyed'), async () => new Response('insufficient_quota', { status: 402 }))).state).toBe('no-credit');
  });
});

describe('the key scan: the AI routes never return or write a key (ai-plan.md S3.8, D4)', () => {
  const KEY = `sk-scan-${Math.random().toString(36).slice(2)}-never-shown`;
  let dir = '';
  let was: string | undefined;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'atiya-ai-scan-'));
    was = process.env.CONTENT_ROOT;
    process.env.CONTENT_ROOT = join(dir, 'content');
    process.env.ATIYA_AI_CREDENTIALS = 'off';
    process.env[keyVariable('scan')] = KEY;
  });
  afterAll(() => {
    if (was === undefined) delete process.env.CONTENT_ROOT;
    else process.env.CONTENT_ROOT = was;
    delete process.env[keyVariable('scan')];
    rmSync(dir, { recursive: true, force: true });
  });
  const call = async (path: string, method: string, body?: unknown) => {
    const res = await aiServicesRoute(['ai', ...path.split('/')], method, new Request('http://localhost/', { method: method === 'GET' ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) }));
    return res ? `${res.status} ${await res.text()}` : '';
  };
  const everyFile = (root: string): string => readdirSync(root, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => readFileSync(join(e.parentPath, e.name), 'utf8')).join('\n');

  it('adds, changes, chooses, tests and removes a keyed service without the key in any answer or in the settings', async () => {
    const answers = [
      await call('services', 'POST', { provider: 'other', name: 'Scan', base: 'http://127.0.0.1:9/v1', model: 'm', accepted: true }),
      await call('writer', 'PUT', { id: 'scan' }),
      await call('services/scan', 'PUT', { model: 'm2', privatePages: false }),
      await call('services/scan/test', 'POST'),
      JSON.stringify(writerLine()),
    ];
    expect(answers[0]).toContain('"id":"scan"');
    expect(answers[3]).toContain('"state":"unreachable"');
    expect(readSettings().writer).toBe('scan');
    expect(answers.join('\n')).not.toContain(KEY);
    expect(everyFile(dir)).not.toContain(KEY);
    expect(await call('services/scan', 'DELETE')).toContain('"ok":true');
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain(KEY);
  });

  it('hands the key only to the writer: no event of a request holds it, even when the service fails', async () => {
    const settings = { ...structuredClone(EMPTY_SETTINGS), services: [service('scan')], writer: 'scan' };
    const article = { id: 'a', title: 'A', summary: 'S', kind: 'note', body: [{ type: 'text', key: 'abc123', markdown: 'One. Two.' }] } as never;
    const req = { id: 'a', article, target: { scope: 'block' as const, key: 'abc123' }, instruction: 'Make it shorter' };
    const handed: (string | undefined)[] = [];
    const answer = JSON.stringify({ changes: [{ op: 'replace', key: 'abc123', after: null, block: { type: 'text', markdown: 'One.' } }], header: null, summary: 'Shortened it', needs: { kind: 'none', reason: null } });
    for (const fails of [false, true]) {
      const events: AiEvent[] = [];
      await propose(req, (e) => events.push(e), undefined, {
        settings: () => settings,
        isPrivate: () => false,
        check: () => [],
        context: async () => null,
        write: async (c) => {
          handed.push(c.key);
          if (fails) throw new Error(`refused key ${c.key}`);
          return { text: answer, cut: false, ms: 1, firstMs: 1 };
        },
      });
      expect(events.some((e) => e.type === (fails ? 'error' : 'proposal'))).toBe(true);
      expect(JSON.stringify(events)).not.toContain(KEY);
    }
    expect(handed).toEqual([KEY, KEY]);
  });

  it('answers only behind edit mode guard: a write needs the header, this origin and a loopback client', () => {
    for (const path of ['ai/propose', 'ai/services', 'ai/writer', 'ai/services/scan/test']) {
      const url = new URL(`http://localhost:4321/_edit/api/${path}`);
      const req = (headers: Record<string, string>, clientAddress = '127.0.0.1') => guard({ method: 'POST', url, clientAddress, header: (n) => headers[n.toLowerCase()] ?? null });
      const good = { host: 'localhost:4321', 'x-editor': '1', origin: 'http://localhost:4321', 'content-type': 'application/json' };
      expect(req(good).ok).toBe(true);
      expect(req({ ...good, 'x-editor': '' }).ok).toBe(false);
      expect(req({ ...good, origin: 'https://evil.test' }).ok).toBe(false);
      expect(req({ ...good, 'sec-fetch-site': 'cross-site' }).ok).toBe(false);
      expect(req(good, '192.168.1.5').ok).toBe(false);
    }
  });
});
