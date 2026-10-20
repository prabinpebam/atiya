// @ts-check
/**
 * AI services' keys in Atiya Studio (documentation/editor/ai-services.md §6.1): kept per site in the app's data
 * folder, each encrypted by the system (Electron's safeStorage, passed in), and handed to the site's server as
 * environment variables when it starts. A key never goes in the site's folder, a log or a page.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** A service's ID, as edit mode makes it. */
export const KEY_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** What a key can be: printable, no spaces (the site's route checks the same). */
export const KEY = /^[\x21-\x7e]{8,512}$/;

/** The variable the site's server reads a service's key from (src/site/editor/server/aiSettings.ts keyVariable). @param {string} id */
export const keyVariable = (id) => `ATIYA_AI_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_KEY`;

/**
 * @typedef {{ encrypt: (text: string) => Buffer, decrypt: (data: Buffer) => string }} Cipher
 * @typedef {{ sites: Record<string, Record<string, string>> }} KeyFile
 */

export class AiKeys {
  /** @param {string} dir the app's data folder @param {Cipher} cipher */
  constructor(dir, cipher) {
    this.file = join(dir, 'ai-keys.json');
    this.cipher = cipher;
  }

  /** @returns {KeyFile} */
  read() {
    if (!existsSync(this.file)) return { sites: {} };
    try {
      const f = JSON.parse(readFileSync(this.file, 'utf8'));
      return f && typeof f.sites === 'object' && f.sites ? f : { sites: {} };
    } catch {
      return { sites: {} };
    }
  }

  /** @param {KeyFile} f */
  write(f) {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(f, null, 2) + '\n');
    renameSync(tmp, this.file);
  }

  /** Keeps a service's key for a site, encrypted; false when the ID or the key isn't one. @param {string} site @param {string} id @param {string} key */
  save(site, id, key) {
    if (!KEY_ID.test(id) || typeof key !== 'string' || !KEY.test(key)) return false;
    const f = this.read();
    const at = site.toLowerCase();
    f.sites[at] = { ...f.sites[at], [id]: this.cipher.encrypt(key).toString('base64') };
    this.write(f);
    return true;
  }

  /** Deletes a service's key for a site. @param {string} site @param {string} id */
  remove(site, id) {
    const f = this.read();
    const at = site.toLowerCase();
    if (!f.sites[at] || !(id in f.sites[at])) return;
    delete f.sites[at][id];
    if (!Object.keys(f.sites[at]).length) delete f.sites[at];
    this.write(f);
  }

  /** The site's keys as its server's environment; a key that can't be decrypted (another computer's) is left out. @param {string} site */
  envFor(site) {
    /** @type {Record<string, string>} */
    const env = {};
    for (const [id, data] of Object.entries(this.read().sites[site.toLowerCase()] ?? {})) {
      if (!KEY_ID.test(id) || typeof data !== 'string') continue;
      try {
        env[keyVariable(id)] = this.cipher.decrypt(Buffer.from(data, 'base64'));
      } catch {
        // left out: the card says its key is missing, and Enter key replaces it
      }
    }
    return env;
  }
}
