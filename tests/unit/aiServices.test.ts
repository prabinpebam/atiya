import { describe, expect, it } from 'vitest';
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
import { EMPTY_SETTINGS, type AiService } from '../../src/site/editor/server/aiSettings';
import { testService } from '../../src/site/editor/server/aiServices';

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
