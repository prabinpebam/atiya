import { PBKDF2_ITERATIONS, aesGcm, aesGcmOpen, b64, randomBytes, utf8 } from './crypto.ts';
import type { KeyringBody, KeyringEnvelope } from './types.ts';
import { isReader } from './agreement.ts';

export const KEYRING_MAX_BYTES = 64 * 1024;

type RecordValue = Record<string, unknown>;

export class KeyringError extends Error {
  code: 'damaged' | 'expired';
  expiresAt?: string;

  constructor(code: 'damaged' | 'expired', message: string) {
    super(message);
    this.name = 'KeyringError';
    this.code = code;
  }
}

function damaged(message: string): never {
  throw new KeyringError('damaged', message);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) damaged('The keyring envelope is malformed.');
}

function decodedLength(text: unknown, length: number, label: string): void {
  if (typeof text !== 'string') damaged(`${label} is malformed.`);
  try {
    if (b64.decode(text).length !== length) damaged(`${label} is malformed.`);
  } catch {
    damaged(`${label} is malformed.`);
  }
}

function decodeAtLeast(text: unknown, length: number, label: string): void {
  if (typeof text !== 'string') damaged(`${label} is malformed.`);
  try {
    if (b64.decode(text).length < length) damaged(`${label} is malformed.`);
  } catch {
    damaged(`${label} is malformed.`);
  }
}

export function keyringAad(lookup: string, env: Pick<KeyringEnvelope, 'build' | 'kdf' | 'iterations' | 'salt'>): string {
  return `atiya/keyring/v1|${lookup}|${env.build}|${env.kdf}|${env.iterations ?? ''}|${env.salt}`;
}

export async function sealKeyring(
  kek: Uint8Array,
  lookup: string,
  header: { build: string; kdf: KeyringEnvelope['kdf']; salt: string },
  body: KeyringBody,
): Promise<KeyringEnvelope> {
  const iv = randomBytes(12);
  const env: KeyringEnvelope = {
    v: 1,
    build: header.build,
    kdf: header.kdf,
    salt: header.salt,
    iv: b64.encode(iv),
    data: '',
  };
  if (header.kdf === 'pbkdf2-sha256') env.iterations = PBKDF2_ITERATIONS;
  const aad = keyringAad(lookup, env);
  env.data = b64.encode(await aesGcm(kek, iv, utf8.encode(JSON.stringify(body)), utf8.encode(aad)));
  return env;
}

export function checkEnvelope(value: unknown, rawLength?: number): KeyringEnvelope {
  if (rawLength !== undefined && rawLength > KEYRING_MAX_BYTES) damaged('The keyring envelope is too large.');
  if (!isRecord(value)) damaged('The keyring envelope is malformed.');
  if (value.v !== 1) damaged('The keyring envelope version is unsupported.');
  if (value.kdf !== 'pbkdf2-sha256' && value.kdf !== 'hkdf-sha256') damaged('The keyring KDF is unsupported.');
  if (value.kdf === 'pbkdf2-sha256') {
    exactKeys(value, ['v', 'build', 'kdf', 'iterations', 'salt', 'iv', 'data']);
    if (value.iterations !== PBKDF2_ITERATIONS) damaged('The keyring PBKDF2 count is unsupported.');
  } else {
    exactKeys(value, ['v', 'build', 'kdf', 'salt', 'iv', 'data']);
  }
  decodedLength(value.build, 16, 'Build ID');
  decodedLength(value.salt, 16, 'Salt');
  decodedLength(value.iv, 12, 'IV');
  decodeAtLeast(value.data, 16, 'Ciphertext');
  return value as unknown as KeyringEnvelope;
}

function validateBody(value: unknown): KeyringBody {
  if (!isRecord(value)) damaged('The keyring body is malformed.');
  const keys = ['v', 'grant', 'keys', ...(value.expiresAt === undefined ? [] : ['expiresAt']), ...(value.reader === undefined ? [] : ['reader'])];
  exactKeys(value, keys);
  if (value.reader !== undefined && !isReader(value.reader)) damaged('The keyring reader is malformed.');
  if (value.v !== 1 || typeof value.grant !== 'string' || value.grant.length === 0) damaged('The keyring body is malformed.');
  if (value.expiresAt !== undefined && (typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt)))) {
    damaged('The keyring expiry is malformed.');
  }
  if (!isRecord(value.keys)) damaged('The keyring keys are malformed.');
  for (const [kid, key] of Object.entries(value.keys)) {
    if (!kid || typeof key !== 'string') damaged('The keyring keys are malformed.');
    decodedLength(key, 32, 'Page key');
  }
  return value as unknown as KeyringBody;
}

export async function openKeyring(kek: Uint8Array, lookup: string, env: KeyringEnvelope, now = new Date()): Promise<KeyringBody> {
  try {
    const iv = b64.decode(env.iv);
    const data = b64.decode(env.data);
    const plain = await aesGcmOpen(kek, iv, data, utf8.encode(keyringAad(lookup, env)));
    const body = validateBody(JSON.parse(utf8.decode(plain)));
    if (body.expiresAt && now.getTime() >= Date.parse(body.expiresAt)) {
      const error = new KeyringError('expired', 'The keyring has expired.');
      error.expiresAt = body.expiresAt;
      throw error;
    }
    return body;
  } catch (error) {
    if (error instanceof KeyringError && error.code === 'expired') throw error;
    throw new KeyringError('damaged', 'The keyring could not be opened.');
  }
}

export function pageAad(build: string, kid: string): string {
  return `atiya/page/v1|${build}|${kid}`;
}

export function cardAad(build: string, kid: string): string {
  return `atiya/card/v1|${build}|${kid}`;
}

export function mediaAad(build: string, name: string): string {
  return `atiya/media/v1|${build}|${name}`;
}
