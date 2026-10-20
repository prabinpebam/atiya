/**
 * The AI screen's routes (documentation/editor/ai-services.md §7, §8): add, change and remove a service, choose
 * the writer, and test a service with a tiny request that needs a JSON answer. Everything is written through
 * `writeSettings` (never a key: keys come only from the environment).
 */
import { readSettings, writeSettings, keyFor, type AiService } from './aiSettings';
import { findLocal } from './aiLocal';
import { AiError, writeOpenAI } from './aiOpenAI';
import { addService, CLOUD_KINDS, idFor, removeService, setWriter, updateService, type TestState } from '../model/aiServices';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refuse = (message: string, status = 422) => json({ ok: false, issues: [{ file: '.atiya/ai.json', message }] }, status);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

/** The test's request: it needs a JSON answer of one shape, as every real request does. */
const TEST_SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
const TEST_MESSAGES = [
  { role: 'system' as const, content: 'This is a connection test. Answer with JSON only: {"ok": true}.' },
  { role: 'user' as const, content: 'Is this working?' },
];

/** Tests a service: a tiny request that needs a JSON answer. */
export async function testService(s: AiService, f?: typeof fetch): Promise<{ state: TestState; ms: number }> {
  const t0 = Date.now();
  const key = await keyFor(s.id);
  if (!s.local && !key) return { state: 'key-missing', ms: 0 };
  try {
    const w = await writeOpenAI({ base: s.base, key, model: s.model, messages: TEST_MESSAGES, schema: TEST_SCHEMA, local: s.local, fetch: f, startMs: s.local ? 120_000 : 30_000 });
    let answer: unknown;
    try {
      answer = JSON.parse(w.text);
    } catch {
      answer = null;
    }
    const ok = !!answer && typeof answer === 'object' && typeof (answer as { ok?: unknown }).ok === 'boolean';
    return { state: ok ? 'ok' : 'shape', ms: w.ms };
  } catch (e) {
    return { state: e instanceof AiError ? (e.code === 'stopped' ? 'stalled' : e.code) : 'unreachable', ms: Date.now() - t0 };
  }
}

interface NewService {
  /** A runner found on this computer (Found on this computer's Add), or a cloud kind. */
  runner?: 'ollama' | 'lmstudio';
  provider?: string;
  name?: string;
  base?: string;
  model?: string;
  privatePages?: boolean;
  /** The disclaimer was accepted (a cloud service needs it). */
  accepted?: boolean;
}

async function add(b: NewService): Promise<Response> {
  const s = readSettings();
  const model = text(b.model, 200);
  let service: AiService;
  if (b.runner) {
    const runner = (await findLocal()).find((r) => r.id === b.runner);
    if (!runner) return refuse(`${b.runner === 'ollama' ? 'Ollama' : 'LM Studio'} isn't running. Start it, then look again.`);
    const m = model && runner.models.includes(model) ? model : runner.models[0];
    if (!m) return refuse(`${runner.name} has no models yet.`);
    service = { id: idFor(runner.id, s.services.map((x) => x.id)), kind: 'openai-compatible', provider: runner.id, name: runner.name, base: runner.base, model: m, local: true, privatePages: b.privatePages !== false };
  } else {
    const kind = CLOUD_KINDS.find((k) => k.provider === b.provider);
    const name = text(b.name, 60);
    const base = text(b.base, 300);
    if (!kind) return refuse('Choose its kind.');
    if (!name) return refuse('Give it a name.');
    if (!base || !/^https?:\/\/[^\s]+$/.test(base)) return refuse('Its base URL must be a web address, like https://api.example.com/v1.');
    if (!model) return refuse('Name its model.');
    if (b.accepted !== true) return refuse('Accept where your words go to add it.');
    service = { id: idFor(name, s.services.map((x) => x.id)), kind: 'openai-compatible', provider: kind.provider, name, base: base.replace(/\/$/, ''), model, local: false, privatePages: b.privatePages !== false, acceptedAt: new Date().toISOString() };
  }
  writeSettings(addService(s, service));
  return json({ ok: true, id: service.id });
}

/** Routes under `ai/` for the AI screen; null when the request isn't one of them. */
export async function aiServicesRoute(parts: string[], method: string, request: Request): Promise<Response | null> {
  if (parts[1] === 'writer' && method === 'PUT') {
    const { id } = (await request.json()) as { id?: string };
    const s = readSettings();
    if (!s.services.some((x) => x.id === id)) return refuse('No such service.', 404);
    writeSettings(setWriter(s, id!));
    return json({ ok: true });
  }
  if (parts[1] !== 'services') return null;
  if (!parts[2] && method === 'POST') return add((await request.json()) as NewService);
  const id = parts[2] ?? '';
  if (!ID.test(id)) return null;
  const s = readSettings();
  const service = s.services.find((x) => x.id === id);
  if (!service) return refuse('No such service.', 404);
  if (!parts[3] && method === 'PUT') {
    const b = (await request.json()) as { model?: unknown; privatePages?: unknown };
    const model = b.model === undefined ? undefined : text(b.model, 200);
    if (model === null) return refuse('Name its model.');
    // a new model hasn't been tested
    writeSettings(updateService(s, id, { ...(model !== undefined && model !== service.model ? { model, lastTest: undefined } : {}), ...(typeof b.privatePages === 'boolean' ? { privatePages: b.privatePages } : {}) }));
    return json({ ok: true });
  }
  if (!parts[3] && method === 'DELETE') {
    writeSettings(removeService(s, id));
    return json({ ok: true });
  }
  if (parts[3] === 'test' && method === 'POST') {
    const { state, ms } = await testService(service);
    const lastTest = { at: new Date().toISOString(), ok: state === 'ok', state, ms };
    // read again: the settings may have changed while the test ran
    writeSettings(updateService(readSettings(), id, { lastTest }));
    return json({ ok: true, lastTest });
  }
  return null;
}
