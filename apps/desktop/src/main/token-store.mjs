// @ts-check
/** The GitHub token, kept only through the system keychain (Electron's safeStorage: DPAPI on Windows). */
import { safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** @param {string} file the encrypted token's file, in the app's data folder */
export function tokenStore(file) {
  return {
    /** @returns {string | null} */
    load() {
      if (!existsSync(file) || !safeStorage.isEncryptionAvailable()) return null;
      try {
        return safeStorage.decryptString(readFileSync(file));
      } catch {
        return null;
      }
    },
    /** @param {string} token */
    save(token) {
      // never written in the clear: without the keychain, the token lives only in memory for this run
      if (!safeStorage.isEncryptionAvailable()) return;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, safeStorage.encryptString(token));
    },
    clear() {
      rmSync(file, { force: true });
    },
  };
}
