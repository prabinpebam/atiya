/**
 * AI settings (documentation/editor/ai-services.md §11): `.atiya/ai.json` beside the content folder, written
 * to a temporary file and renamed, never holding a key. Keys come from the environment
 * (`ATIYA_AI_<ID>_KEY`: Atiya Studio sets them, `scripts/serve.ps1` fills them from Credential Manager).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { contentRoot } from '../../content/source';

/** A service you've added on the AI screen. */
export interface AiService {
  /** Short and stable: names its key's variable and Credential Manager entry. */
  id: string;
  /** Which adapter speaks to it (ai-services.md §9.2). */
  kind: 'openai-compatible' | 'anthropic' | 'gemini';
  /** Which service it is, for its name and its card. */
  provider: 'ollama' | 'lmstudio' | 'openai' | 'azure' | 'openrouter' | 'mistral' | 'groq' | 'claude' | 'gemini' | 'other';
  name: string;
  /** The API's base URL, up to `/v1`. */
  base: string;
  model: string;
  /** A model on this computer: no key, longer to start (it may be loading). */
  local: boolean;
  /** Whether private pages may be sent to it. */
  privatePages: boolean;
  /** When its disclaimer was accepted (ISO). Local services have none. */
  acceptedAt?: string;
  /** Its last test. */
  lastTest?: { at: string; ok: boolean; state?: string; ms?: number };
}

export interface AiSettings {
  version: 1;
  services: AiService[];
  /** The writer's ID, or null. */
  writer: string | null;
  decider: { kind: 'rules' } | { kind: 'jev'; model: string };
  agents: { propose: boolean };
}

export const EMPTY_SETTINGS: AiSettings = { version: 1, services: [], writer: null, decider: { kind: 'rules' }, agents: { propose: false } };

/** The settings file: `.atiya/ai.json` in the site's folder (the content folder's parent). */
export const settingsFile = (root = contentRoot()) => join(dirname(root), '.atiya', 'ai.json');

export function readSettings(file = settingsFile()): AiSettings {
  if (!existsSync(file)) return structuredClone(EMPTY_SETTINGS);
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<AiSettings>;
    return { ...structuredClone(EMPTY_SETTINGS), ...raw, services: (raw.services ?? []).map(({ ...s }) => s) };
  } catch {
    return structuredClone(EMPTY_SETTINGS);
  }
}

/** Writes the settings atomically. Anything key-shaped never reaches the file: only the fields a service has. */
export function writeSettings(s: AiSettings, file = settingsFile()): void {
  const pick = ({ id, kind, provider, name, base, model, local, privatePages, acceptedAt, lastTest }: AiService): AiService => ({ id, kind, provider, name, base, model, local, privatePages, acceptedAt, lastTest });
  const clean: AiSettings = { version: 1, services: s.services.map(pick), writer: s.writer, decider: s.decider, agents: s.agents };
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

/** A service's key's environment variable: `ATIYA_AI_<ID>_KEY`. */
export const keyVariable = (id: string) => `ATIYA_AI_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_KEY`;
/** Its Credential Manager entry, for plain dev. */
export const credentialName = (id: string) => `atiya-ai-${id}`;
/** A service's key, from the environment; never written anywhere. */
export const keyFor = (id: string, env: NodeJS.ProcessEnv = process.env): string | undefined => env[keyVariable(id)] || undefined;

/** The writer, or null when there isn't one. */
export const writerOf = (s: AiSettings): AiService | null => s.services.find((x) => x.id === s.writer) ?? null;
