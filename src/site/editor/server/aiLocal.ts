/**
 * Models on this computer (documentation/editor/ai-services.md §6.2): Ollama and LM Studio are found by
 * asking them for their models. Their addresses can be moved with `ATIYA_AI_OLLAMA_URL` and
 * `ATIYA_AI_LMSTUDIO_URL` (the E2E fixture points them at its stand-in).
 */

export interface LocalRunner {
  id: 'ollama' | 'lmstudio';
  name: string;
  /** The OpenAI-compatible API's base, up to `/v1`. */
  base: string;
  models: string[];
}

const RUNNERS = [
  { id: 'ollama', name: 'Ollama', env: 'ATIYA_AI_OLLAMA_URL', origin: 'http://localhost:11434', list: '/api/tags', read: (j: { models?: { name: string }[] }) => (j.models ?? []).map((m) => m.name) },
  { id: 'lmstudio', name: 'LM Studio', env: 'ATIYA_AI_LMSTUDIO_URL', origin: 'http://localhost:1234', list: '/v1/models', read: (j: { data?: { id: string }[] }) => (j.data ?? []).map((m) => m.id) },
] as const;

/** A runner's origin: its own, or the environment's. */
export const originOf = (id: LocalRunner['id'], env: NodeJS.ProcessEnv = process.env): string => {
  const r = RUNNERS.find((x) => x.id === id)!;
  return (env[r.env] || r.origin).replace(/\/$/, '');
};

/** The runners that answer, with their models; one that doesn't answer within `ms` isn't running. */
export async function findLocal(f: typeof fetch = fetch, ms = 800, env: NodeJS.ProcessEnv = process.env): Promise<LocalRunner[]> {
  const found = await Promise.all(
    RUNNERS.map(async (r) => {
      const origin = originOf(r.id, env);
      try {
        const res = await f(origin + r.list, { signal: AbortSignal.timeout(ms) });
        if (!res.ok) return null;
        const models = r.read((await res.json()) as never);
        const runner: LocalRunner = { id: r.id, name: r.name, base: `${origin}/v1`, models };
        return runner;
      } catch {
        return null;
      }
    }),
  );
  return found.filter((r) => r !== null);
}

/** The context a loaded Ollama model runs with (its `/api/ps`), in tokens; null when unknown (not loaded, or not Ollama). */
export async function localContext(base: string, model: string, f: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await f(base.replace(/\/v1$/, '') + '/api/ps', { signal: AbortSignal.timeout(500) });
    if (!res.ok) return null;
    const j = (await res.json()) as { models?: { name: string; context_length?: number }[] };
    return j.models?.find((m) => m.name === model)?.context_length ?? null;
  } catch {
    return null;
  }
}
