// @ts-check
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiKeys, keyVariable } from '../src/core/ai-keys.mjs';
import { keyVariable as siteKeyVariable } from '../../../src/site/editor/server/aiSettings';

/** AI services' keys in Atiya Studio (documentation/editor/ai-plan.md S6, ai-services.md §6.1). */
const KEY = 'sk-proj-a-key-that-must-never-show';
// a stand-in for safeStorage: reversible, and never the key's own bytes
const cipher = {
  encrypt: (/** @type {string} */ t) => Buffer.from([...Buffer.from(t)].map((b) => b ^ 0x5a)),
  decrypt: (/** @type {Buffer} */ d) => Buffer.from([...d].map((b) => b ^ 0x5a)).toString(),
};
const store = () => new AiKeys(mkdtempSync(join(tmpdir(), 'atiya-ai-keys-')), cipher);

describe("Atiya Studio's AI keys", () => {
  it('names the variable the way the site reads it', () => {
    for (const id of ['openai', 'my-ollama', 'azure-openai-2']) expect(keyVariable(id)).toBe(siteKeyVariable(id));
  });

  it('keeps a key per site, encrypted, and gives it back as the server environment', () => {
    const k = store();
    expect(k.save('C:\\Sites\\Ada', 'openai', KEY)).toBe(true);
    expect(readFileSync(k.file, 'utf8')).not.toContain(KEY);
    expect(readFileSync(k.file, 'utf8')).not.toContain(Buffer.from(KEY).toString('base64'));
    expect(k.envFor('c:\\sites\\ada')).toEqual({ ATIYA_AI_OPENAI_KEY: KEY });
    expect(k.envFor('C:\\Sites\\Other')).toEqual({});
  });

  it('refuses what is not an ID or a key', () => {
    const k = store();
    for (const [id, key] of [['Open AI', KEY], ['../x', KEY], ['openai', 'short'], ['openai', 'has a space']]) expect(k.save('C:\\S', id, key)).toBe(false);
    expect(k.envFor('C:\\S')).toEqual({});
  });

  it('deletes a removed service key, and leaves out one that cannot be decrypted', () => {
    const k = store();
    k.save('C:\\S', 'openai', KEY);
    k.save('C:\\S', 'anthropic', `${KEY}-2`);
    k.remove('C:\\S', 'openai');
    expect(Object.keys(k.read().sites['c:\\s'])).toEqual(['anthropic']);
    const other = new AiKeys(join(k.file, '..'), { ...cipher, decrypt: () => { throw new Error('not this computer'); } });
    expect(other.envFor('C:\\S')).toEqual({});
    k.remove('C:\\S', 'anthropic');
    expect(k.read().sites).toEqual({});
  });
});
