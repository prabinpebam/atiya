export const PBKDF2_ITERATIONS = 600000;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
const B64_VALUES = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_VALUES[B64.charCodeAt(i)] = i;

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error('Web Crypto is not available.');
  }
  return globalThis.crypto;
}

function bytesForCrypto(bytes: Uint8Array): ArrayBuffer {
  const copy: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function fromBuffer(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

function join(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

async function aesKey(key: Uint8Array): Promise<CryptoKey> {
  return cryptoApi().subtle.importKey('raw', bytesForCrypto(key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export const utf8 = {
  encode(s: string): Uint8Array {
    return new TextEncoder().encode(s);
  },
  decode(b: Uint8Array): string {
    return new TextDecoder().decode(b);
  },
};

export const b64 = {
  encode(bytes: Uint8Array): string {
    let out = '';
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = bytes[i] * 65536 + bytes[i + 1] * 256 + bytes[i + 2];
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + B64[(n >>> 6) & 63] + B64[n & 63];
    }
    if (i < bytes.length) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const n = a * 65536 + b * 256;
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
      if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
    }
    return out;
  },
  decode(text: string): Uint8Array {
    if (text.length % 4 === 1 || /[=]/.test(text)) throw new Error('Invalid base64url.');
    const out: number[] = [];
    let value = 0;
    let bits = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      const n = code < B64_VALUES.length ? B64_VALUES[code] : -1;
      if (n < 0) throw new Error('Invalid base64url.');
      value = (value << 6) | n;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 255);
      }
    }
    if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) throw new Error('Invalid base64url.');
    return new Uint8Array(out);
  },
};

export function randomBytes(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0) throw new Error('Byte length must be a non-negative integer.');
  const out = new Uint8Array(n);
  const crypto = cryptoApi();
  for (let i = 0; i < out.length; i += 65536) {
    crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, out.length)));
  }
  return out;
}

export function newKey(): Uint8Array {
  return randomBytes(32);
}

export function buildId(): string {
  return b64.encode(randomBytes(16));
}

export function token(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (const byte of bytes) out += B32[byte & 31];
  return out;
}

export function grantId(): string {
  return `g${token().slice(0, 8)}`;
}

export const SEALED_MAGIC = new Uint8Array([65, 84, 83, 49]);

export class SealError extends Error {
  code: 'format' | 'damaged';

  constructor(code: 'format' | 'damaged', message: string) {
    super(message);
    this.name = 'SealError';
    this.code = code;
  }
}

export async function aesGcm(key: Uint8Array, iv: Uint8Array, plain: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await aesKey(key);
  const params: AesGcmParams = { name: 'AES-GCM', iv: bytesForCrypto(iv), tagLength: 128 };
  if (aad) params.additionalData = bytesForCrypto(aad);
  return fromBuffer(await cryptoApi().subtle.encrypt(params, cryptoKey, bytesForCrypto(plain)));
}

export async function aesGcmOpen(key: Uint8Array, iv: Uint8Array, sealed: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await aesKey(key);
  const params: AesGcmParams = { name: 'AES-GCM', iv: bytesForCrypto(iv), tagLength: 128 };
  if (aad) params.additionalData = bytesForCrypto(aad);
  return fromBuffer(await cryptoApi().subtle.decrypt(params, cryptoKey, bytesForCrypto(sealed)));
}

export async function seal(key: Uint8Array, plain: Uint8Array, aad: string): Promise<Uint8Array> {
  const iv = randomBytes(12);
  const data = await aesGcm(key, iv, plain, utf8.encode(aad));
  return join(join(SEALED_MAGIC, iv), data);
}

export async function open(key: Uint8Array, sealed: Uint8Array, aad: string, maxBytes?: number): Promise<Uint8Array> {
  if (sealed.length < SEALED_MAGIC.length + 12 + 16) throw new SealError('format', 'The sealed file is too short.');
  if (maxBytes !== undefined && sealed.length > maxBytes) throw new SealError('format', 'The sealed file is too large.');
  for (let i = 0; i < SEALED_MAGIC.length; i++) {
    if (sealed[i] !== SEALED_MAGIC[i]) throw new SealError('format', 'The sealed file has the wrong magic.');
  }
  const iv = sealed.slice(4, 16);
  const data = sealed.slice(16);
  try {
    return await aesGcmOpen(key, iv, data, utf8.encode(aad));
  } catch {
    throw new SealError('damaged', 'The sealed file could not be opened.');
  }
}

export async function pbkdf2(password: string, salt: Uint8Array, iterations: number, bytes = 32): Promise<Uint8Array> {
  const key = await cryptoApi().subtle.importKey('raw', bytesForCrypto(utf8.encode(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytesForCrypto(salt), iterations },
    key,
    bytes * 8,
  );
  return fromBuffer(bits);
}

export async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string | Uint8Array, bytes = 32): Promise<Uint8Array> {
  const key = await cryptoApi().subtle.importKey('raw', bytesForCrypto(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: bytesForCrypto(salt),
      info: bytesForCrypto(typeof info === 'string' ? utf8.encode(info) : info),
    },
    key,
    bytes * 8,
  );
  return fromBuffer(bits);
}

export async function deriveCodeKey(secretWords: string, salt: Uint8Array): Promise<Uint8Array> {
  const normalized = secretWords
    .trim()
    .toLowerCase()
    .split(/[-\s]+/)
    .filter(Boolean)
    .join('-');
  return pbkdf2(normalized, salt, PBKDF2_ITERATIONS, 32);
}

export async function deriveLinkKey(secret: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  return hkdf(secret, salt, 'atiya/grant/v1', 32);
}
