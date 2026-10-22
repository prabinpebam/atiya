/**
 * The AI screen's rules (documentation/editor/ai-services.md §7, §8): adding, changing and removing services,
 * the writer, a card's state and its last test in words, each service's disclaimer, and what Found on this
 * computer offers. Pure: the server's routes and the screen's parts read them from here.
 */
import type { AiService, AiSettings } from '../server/aiSettings';
import { failureNote } from './aiCopy';

export type { AiService };

/** A cloud service's kind, as Add a service offers it (phase 1: those the OpenAI-compatible adapter reaches). */
export interface CloudKind {
  provider: Extract<AiService['provider'], 'openai' | 'azure' | 'openrouter' | 'other'>;
  label: string;
  /** Its API's base URL, up to `/v1` (empty: you type it). */
  base: string;
}

export const CLOUD_KINDS: CloudKind[] = [
  { provider: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1' },
  { provider: 'azure', label: 'Azure OpenAI', base: '' },
  { provider: 'openrouter', label: 'OpenRouter', base: 'https://openrouter.ai/api/v1' },
  { provider: 'other', label: 'Other OpenAI-compatible', base: '' },
];

/** Where a service's words go (§6.2), in a line, with its terms when they're known. */
export interface Disclaimer {
  words: string;
  link?: string;
}

const DISCLAIMERS: Partial<Record<AiService['provider'], Disclaimer>> = {
  ollama: { words: 'Runs on this computer: nothing leaves it.', link: 'https://ollama.com/privacy' },
  lmstudio: { words: 'Runs on this computer: nothing leaves it.' },
  openai: { words: "Runs in OpenAI's cloud. Not used for training by default.", link: 'https://openai.com/policies/business-terms/' },
  azure: { words: "Runs in Microsoft's Azure cloud, under its own terms." },
  openrouter: { words: "Runs in OpenRouter's cloud, under its own terms and its providers'." },
};

/** A service's disclaimer. */
export const disclaimerOf = (provider: AiService['provider']): Disclaimer => DISCLAIMERS[provider] ?? { words: 'Runs wherever its address points, under its own terms.' };

/** The disclaimer's last line, shown when a service is added. */
export const PRIVATE_LINE = 'Private pages are sent too, unless you turn that off below.';

/** A short ID made from a name, unique among `taken`: it names the key's variable and its Credential Manager entry. */
export function idFor(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
      .replace(/-+$/, '') || 'service';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Adds a service; the first one becomes the writer. */
export const addService = (s: AiSettings, service: AiService): AiSettings => ({ ...s, services: [...s.services, service], writer: s.writer ?? service.id });

/** Changes a service's model or its private-pages switch, or keeps its last test (and whether its model sees pictures). */
export const updateService = (s: AiSettings, id: string, patch: Partial<Pick<AiService, 'model' | 'privatePages' | 'lastTest' | 'pictures'>>): AiSettings => ({
  ...s,
  services: s.services.map((x) => (x.id === id ? { ...x, ...patch } : x)),
});

/** Removes a service; removing the writer makes the next service the writer, or none. */
export function removeService(s: AiSettings, id: string): AiSettings {
  const services = s.services.filter((x) => x.id !== id);
  return { ...s, services, writer: s.writer === id || !services.some((x) => x.id === s.writer) ? (services[0]?.id ?? null) : s.writer };
}

/** Makes a service the writer (one that isn't there changes nothing). */
export const setWriter = (s: AiSettings, id: string): AiSettings => (s.services.some((x) => x.id === id) ? { ...s, writer: id } : s);

/** What a test found: ok, or what went wrong (the connector's failures, and a model that can't follow the shape). */
export type TestState = 'ok' | 'key-missing' | 'key-refused' | 'no-credit' | 'busy' | 'not-running' | 'unreachable' | 'stalled' | 'rejected' | 'shape';

/** A card's state tag (§8.2). */
export interface CardState {
  label: string;
  tone: 'positive' | 'neutral' | 'negative';
}

const STATE_LABELS: Record<Exclude<TestState, 'ok'>, string> = {
  'key-missing': 'Key missing',
  'key-refused': 'Key refused',
  'no-credit': 'Out of credit',
  busy: 'Busy',
  'not-running': 'Not running',
  unreachable: 'Unreachable',
  stalled: 'Unreachable',
  rejected: 'Turned down',
  shape: "Can't follow the shape",
};

/** A card's state: a cloud service without its key is Key missing; then its last test decides. */
export function cardState(service: Pick<AiService, 'local' | 'lastTest'>, keyFound: boolean): CardState {
  if (!service.local && !keyFound) return { label: STATE_LABELS['key-missing'], tone: 'negative' };
  const t = service.lastTest;
  if (!t) return { label: 'Untested', tone: 'neutral' };
  if (t.ok) return { label: 'Ready', tone: 'positive' };
  return { label: STATE_LABELS[(t.state as Exclude<TestState, 'ok'>) ?? 'unreachable'] ?? 'Unreachable', tone: 'negative' };
}

/** How long ago, in words. */
export function ago(at: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** What a failed test says: what happened, then what to do (ai-editing.md §10.4's words, for a card). */
export function failureWords(state: TestState, name: string): string {
  switch (state) {
    case 'key-missing':
      return 'Add its key, then restart the site.';
    case 'shape':
      return "This model didn't return the shape edit mode needs. Try a larger model.";
    case 'rejected':
      return `${name} turned the test down. Check the model's name.`;
    case 'stalled':
      return `${name} stopped answering.`;
    case 'ok':
      return '';
    default: {
      const n = failureNote(state, name);
      return [n.title, n.detail].filter(Boolean).join(' ');
    }
  }
}

/** The card's last test, in words: "Works: answered in 1.2 s, 2 minutes ago," or what went wrong. */
export function testLine(service: Pick<AiService, 'name' | 'lastTest'>, now = Date.now()): string {
  const t = service.lastTest;
  if (!t) return 'Not tested yet.';
  if (t.ok) return `Works: answered in ${((t.ms ?? 0) / 1000).toFixed(1)} s, ${ago(t.at, now)}.`;
  return `${failureWords((t.state as TestState) ?? 'unreachable', service.name)} Tested ${ago(t.at, now)}.`;
}

/** A model on this computer that answered, and its models. */
export interface Runner {
  id: 'ollama' | 'lmstudio';
  name: string;
  base: string;
  models: string[];
}

/** Found on this computer: the runners that answer and aren't added yet. */
export const offers = (runners: Runner[], services: Pick<AiService, 'base'>[]): Runner[] => runners.filter((r) => !services.some((s) => s.base.replace(/\/$/, '') === r.base.replace(/\/$/, '')));

/** The offer's line: "Ollama is running on this computer, with 3 models." */
export const offerLine = (r: Runner): string => `${r.name} is running on this computer, with ${r.models.length === 1 ? '1 model' : `${r.models.length} models`}.`;

/** What a cloud service's key needs, with plain dev (§7.3). */
export const keyMissingLine = (entry: string): string => `Add the key to Windows Credential Manager as ${entry}, then restart the site.`;

/** What a cloud service's key needs, in Atiya Studio (§7.2): the app's own dialog keeps it. */
export const STUDIO_KEY_LINE = 'Enter its key. Atiya Studio keeps it encrypted on this computer.';

/** Remove's question (§7.7): what happens to a key, where it's kept. */
export const removeQuestion = (name: string, where: 'local' | 'studio' | 'dev'): string =>
  `Remove ${name}? ${where === 'local' ? 'Its models stay on this computer.' : where === 'studio' ? 'Its key is deleted from this computer.' : 'Its key stays in Credential Manager until you delete it there.'}`;
