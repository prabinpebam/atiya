/**
 * AI settings (documentation/editor/ai-services.md §11): `.atiya/ai.json` beside the content folder, written
 * to a temporary file and renamed, never holding a key. Keys come from the environment (`ATIYA_AI_<ID>_KEY`:
 * Atiya Studio sets them), else, in plain dev on Windows, from Credential Manager (`atiya-ai-<id>`).
 */
import { execFile } from 'node:child_process';
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

const HELD = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** Writes the settings atomically. Anything key-shaped never reaches the file: only the fields a service has. */
export function writeSettings(s: AiSettings, file = settingsFile()): void {
  const pick = ({ id, kind, provider, name, base, model, local, privatePages, acceptedAt, lastTest }: AiService): AiService => ({ id, kind, provider, name, base, model, local, privatePages, acceptedAt, lastTest });
  const clean: AiSettings = { version: 1, services: s.services.map(pick), writer: s.writer, decider: s.decider, agents: s.agents };
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (e) {
      // Windows refuses while something briefly holds the file (an indexer, an antivirus, a reader): wait and retry
      if (!HELD.has((e as NodeJS.ErrnoException).code ?? '') || attempt >= 6) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * 2 ** attempt);
    }
  }
}

/** A service's key's environment variable: `ATIYA_AI_<ID>_KEY`. */
export const keyVariable = (id: string) => `ATIYA_AI_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_KEY`;
/** Its Credential Manager entry, for plain dev. */
export const credentialName = (id: string) => `atiya-ai-${id}`;

// Every `atiya-ai-*` generic credential's secret, by name: CredEnumerate through PowerShell, printed as JSON to this process only.
const ENUMERATE = `$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class AtiyaCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct C { public int Flags; public int Type; public string Target; public string Comment; public long Written; public int Size; public IntPtr Blob; public int Persist; public int Count; public IntPtr Attributes; public string Alias; public string User; }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr list);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr p);
}
'@
$found = @{}; $n = 0; $list = [IntPtr]::Zero
if ([AtiyaCred]::CredEnumerate('atiya-ai-*', 0, [ref]$n, [ref]$list)) {
  for ($i = 0; $i -lt $n; $i++) {
    $c = [Runtime.InteropServices.Marshal]::PtrToStructure([Runtime.InteropServices.Marshal]::ReadIntPtr($list, $i * [IntPtr]::Size), [type][AtiyaCred+C])
    if ($c.Type -eq 1 -and $c.Size -gt 0) { $found[$c.Target] = [Runtime.InteropServices.Marshal]::PtrToStringUni($c.Blob, [int]($c.Size / 2)) }
  }
  [AtiyaCred]::CredFree($list)
}
$found | ConvertTo-Json -Compress`;

let stored: Promise<Record<string, string>> | null = null;
/** The `atiya-ai-*` entries in Windows Credential Manager, read once per server (ai-services.md §6.1: a restart picks up a new one). */
function storedKeys(env: NodeJS.ProcessEnv): Promise<Record<string, string>> {
  if (env.ATIYA_AI_CREDENTIALS === 'off' || process.platform !== 'win32') return Promise.resolve({});
  stored ??= new Promise((done) =>
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ENUMERATE], { encoding: 'utf8', windowsHide: true, timeout: 15_000 }, (error, out) => {
      try {
        const read = !error && out.trim() ? JSON.parse(out) : {};
        done(read && typeof read === 'object' ? read : {});
      } catch {
        done({});
      }
    }),
  );
  return stored;
}

/** A service's key: its environment variable, else (plain dev on Windows) its Credential Manager entry. Never written anywhere. */
export const keyFor = async (id: string, env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> =>
  env[keyVariable(id)] || (await storedKeys(env))[credentialName(id)] || undefined;

/** The writer, or null when there isn't one. */
export const writerOf = (s: AiSettings): AiService | null => s.services.find((x) => x.id === s.writer) ?? null;
