import { describe, expect, it } from 'vitest';
import { generateCode, parseCode, WORDS_BITS } from '../../src/site/access/codes.ts';
import {
  PBKDF2_ITERATIONS,
  SealError,
  aesGcm,
  b64,
  buildId,
  grantId,
  hkdf,
  newKey,
  open,
  pbkdf2,
  randomBytes,
  seal,
  token,
  utf8,
} from '../../src/site/access/crypto.ts';
import { checkGrant, checkTransitions, covers, grantState, isValid, lookupOf } from '../../src/site/access/grants.ts';
import {
  KEYRING_MAX_BYTES,
  KeyringError,
  checkEnvelope,
  openKeyring,
  pageAad,
  sealKeyring,
} from '../../src/site/access/keyring.ts';
import type { Grant } from '../../src/site/access/types.ts';
import { WORDS } from '../../src/site/access/wordlist.ts';

function hex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function expectSealError(run: () => Promise<unknown>, code: SealError['code']): Promise<void> {
  await expect(run()).rejects.toMatchObject({ name: 'SealError', code });
}

async function expectKeyringError(run: () => Promise<unknown>, code: KeyringError['code']): Promise<void> {
  await expect(run()).rejects.toMatchObject({ name: 'KeyringError', code });
}

function expectDamaged(value: unknown, rawLength?: number): void {
  expect(() => checkEnvelope(value, rawLength)).toThrow(KeyringError);
  try {
    checkEnvelope(value, rawLength);
  } catch (error) {
    expect(error).toMatchObject({ code: 'damaged' });
  }
}

function bytes(n: number, value: number): Uint8Array {
  return new Uint8Array(n).fill(value);
}

function keyText(value: number): string {
  return b64.encode(bytes(32, value));
}

function saltText(value: number): string {
  return b64.encode(bytes(16, value));
}

function buildText(value: number): string {
  return b64.encode(bytes(16, value));
}

function grant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'gaaaaaaaa',
    kind: 'code',
    name: 'harbor',
    recipient: { name: 'Asha Rai', organisation: 'Northwind' },
    purpose: 'Portfolio review',
    scope: { sections: ['work'], pages: ['page-private'] },
    createdAt: '2026-10-05T09:00:00+05:30',
    expiresAt: '2026-10-12T09:00:00+05:30',
    secret: { words: 'maple-river-cloud-seven', salt: saltText(1) },
    ...overrides,
  };
}

function fixedRandom(indices: number[]): (n: number) => Uint8Array {
  let i = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    const value = indices[i++] ?? 0;
    out[0] = (value >>> 24) & 255;
    out[1] = (value >>> 16) & 255;
    out[2] = (value >>> 8) & 255;
    out[3] = value & 255;
    return out;
  };
}

describe('access crypto', () => {
  it('matches the published PBKDF2-HMAC-SHA256 vectors from RFC 7914 section 11', async () => {
    expect(toHex(await pbkdf2('passwd', utf8.encode('salt'), 1, 64))).toBe(
      '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
    );
    expect(toHex(await pbkdf2('Password', utf8.encode('NaCl'), 80000, 64))).toBe(
      '4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d',
    );
  });

  it('matches the published HKDF-SHA256 vector from RFC 5869 test case 1', async () => {
    const okm = await hkdf(
      hex('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b'),
      hex('000102030405060708090a0b0c'),
      hex('f0f1f2f3f4f5f6f7f8f9'),
      42,
    );
    expect(toHex(okm)).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  });

  it('matches the AES-256-GCM McGrew-Viega specification test case 16 vector', async () => {
    const encrypted = await aesGcm(
      hex('feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308'),
      hex('cafebabefacedbaddecaf888'),
      hex('d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39'),
      hex('feedfacedeadbeeffeedfacedeadbeefabaddad2'),
    );
    expect(toHex(encrypted)).toBe(
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f66276fc6ece0f4e1768cddf8853bb2d551b',
    );
  });

  it('round-trips sealed files and reports clean error codes for format and GCM failures', async () => {
    const key = newKey();
    const build = buildId();
    const kid = 'kid1';
    const aad = pageAad(build, kid);
    const sealed = await seal(key, utf8.encode('Private page'), aad);
    expect(utf8.decode(await open(key, sealed, aad))).toBe('Private page');

    await expectSealError(() => open(newKey(), sealed, aad), 'damaged');
    const changed = sealed.slice();
    changed[changed.length - 1] ^= 1;
    await expectSealError(() => open(key, changed, aad), 'damaged');
    await expectSealError(() => open(key, sealed, pageAad(buildId(), kid)), 'damaged');
    await expectSealError(() => open(key, sealed, pageAad(build, 'other')), 'damaged');
    await expectSealError(() => open(key, sealed.slice(0, sealed.length - 1), aad), 'damaged');
    await expectSealError(() => open(key, sealed.slice(0, 10), aad), 'format');
    const wrongMagic = sealed.slice();
    wrongMagic[0] = 0;
    await expectSealError(() => open(key, wrongMagic, aad), 'format');
    await expectSealError(() => open(key, sealed, aad, sealed.length - 1), 'format');
  });

  it('round-trips keyrings for both KDF headers and binds every clear header field into AAD', async () => {
    const kek = newKey();
    const body = { v: 1 as const, grant: 'gaaaaaaaa', keys: { kid1: keyText(7) } };
    for (const kdf of ['pbkdf2-sha256', 'hkdf-sha256'] as const) {
      const env = await sealKeyring(kek, kdf === 'pbkdf2-sha256' ? 'c/harbor' : 'l/gaaaaaaaa', { build: buildText(2), kdf, salt: saltText(3) }, body);
      expect(checkEnvelope(env)).toEqual(env);
      await expect(openKeyring(kek, kdf === 'pbkdf2-sha256' ? 'c/harbor' : 'l/gaaaaaaaa', env)).resolves.toEqual(body);
    }

    const env = await sealKeyring(kek, 'c/harbor', { build: buildText(4), kdf: 'pbkdf2-sha256', salt: saltText(5) }, body);
    const changedHeader = { ...env, build: buildText(6) };
    expect(checkEnvelope(changedHeader)).toEqual(changedHeader);
    await expectKeyringError(() => openKeyring(kek, 'c/harbor', changedHeader), 'damaged');
    await expectKeyringError(() => openKeyring(kek, 'c/other', env), 'damaged');
  });

  it('refuses malformed or weakened envelopes before opening them', async () => {
    const env = await sealKeyring(newKey(), 'c/harbor', { build: buildText(1), kdf: 'pbkdf2-sha256', salt: saltText(2) }, {
      v: 1,
      grant: 'gaaaaaaaa',
      keys: { kid1: keyText(3) },
    });
    const bad: Array<[string, unknown, number | undefined]> = [
      ['version', { ...env, v: 2 }, undefined],
      ['kdf', { ...env, kdf: 'argon2id' }, undefined],
      ['iterations low', { ...env, iterations: PBKDF2_ITERATIONS - 1 }, undefined],
      ['iterations high', { ...env, iterations: PBKDF2_ITERATIONS + 1 }, undefined],
      ['hkdf iterations', { ...env, kdf: 'hkdf-sha256', iterations: PBKDF2_ITERATIONS }, undefined],
      ['short salt', { ...env, salt: b64.encode(bytes(15, 1)) }, undefined],
      ['short iv', { ...env, iv: b64.encode(bytes(11, 1)) }, undefined],
      ['extra key', { ...env, extra: true }, undefined],
      ['oversized', env, KEYRING_MAX_BYTES + 1],
      ['truncated tag', { ...env, data: b64.encode(bytes(15, 1)) }, undefined],
    ];
    for (const [, value, rawLength] of bad) expectDamaged(value, rawLength);
  });

  it('reports expired keyrings with the expiry date on the error', async () => {
    const expiresAt = '2026-10-05T09:00:00+05:30';
    const kek = newKey();
    const env = await sealKeyring(kek, 'l/gaaaaaaaa', { build: buildText(1), kdf: 'hkdf-sha256', salt: saltText(2) }, {
      v: 1,
      grant: 'gaaaaaaaa',
      expiresAt,
      keys: { kid1: keyText(3) },
    });
    try {
      await openKeyring(kek, 'l/gaaaaaaaa', env, new Date('2026-10-05T09:00:01+05:30'));
      throw new Error('Expected expiry.');
    } catch (error) {
      expect(error).toMatchObject({ name: 'KeyringError', code: 'expired', expiresAt });
    }
  });

  it('generates 100,000 unique IV-sized values and constrained token strings', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100000; i++) {
      const iv = b64.encode(randomBytes(12));
      expect(seen.has(iv)).toBe(false);
      seen.add(iv);
    }
    expect(token()).toMatch(/^[a-z2-7]{10}$/);
    expect(grantId()).toMatch(/^g[a-z2-7]{8}$/);
  });
});

describe('access codes', () => {
  it('keeps the complete EFF list but generates only unambiguous words', () => {
    expect(WORDS).toHaveLength(7776);
    expect(WORDS.filter((word) => word.includes('-')).sort()).toEqual(['drop-down', 'felt-tip', 't-shirt', 'yo-yo']);
    expect(WORDS_BITS).toBeCloseTo(Math.log2(7772), 12);

    const usable = WORDS.filter((word) => !word.includes('-'));
    const made = generateCode(new Set([usable[0]]), 4, fixedRandom([0, 1, 2, 3, 4, 5]));
    expect(made).toEqual({
      name: usable[1],
      secret: [usable[2], usable[3], usable[4], usable[5]].join('-'),
      code: [usable[1], usable[2], usable[3], usable[4], usable[5]].join('-'),
    });
  });

  it('parses tolerant code separators and rejects too-short or non-word codes', () => {
    expect(parseCode('Harbor Maple-river_cloud.seven')).toEqual({ name: 'harbor', secret: 'maple-river-cloud-seven' });
    expect(parseCode('  Harbor   Maple-river_cloud.seven,extra  ')).toEqual({
      name: 'harbor',
      secret: 'maple-river-cloud-seven-extra',
    });
    expect(parseCode('harbor maple river cloud')).toBeNull();
    expect(parseCode('harbor maple river cloud seven7')).toBeNull();
  });
});

describe('grants', () => {
  it('computes grant state across offsets and validity windows', () => {
    expect(grantState(grant({ revokedAt: '2026-10-05T09:30:00+05:30' }), new Date('2026-10-05T09:30:00+05:30'))).toBe('withdrawn');
    expect(grantState(grant({ expiresAt: '2026-10-05T09:30:00+05:30' }), new Date('2026-10-05T09:30:00+05:30'))).toBe('expired');
    expect(grantState(grant({ expiresAt: '2026-10-07T09:29:00+05:30' }), new Date('2026-10-05T09:30:00+05:30'), 2)).toBe('expiring');
    expect(grantState(grant({ expiresAt: '2026-11-05T09:30:00+05:30' }), new Date('2026-10-05T09:30:00+05:30'))).toBe('active');
    expect(isValid(grant({ expiresAt: '2026-10-07T09:29:00+05:30' }), new Date('2026-10-05T09:30:00+05:30'))).toBe(true);
  });

  it('maps lookup IDs and covered page scopes: a code and a link open the same private pages', () => {
    const pages = [
      { id: 'work-a', section: 'work', access: 'private' as const },
      { id: 'work-b', section: 'work', access: 'private' as const },
      { id: 'other-a', section: 'other', access: 'private' as const },
      { id: 'other-b', section: 'other', access: 'private' as const },
    ];
    const code = grant({ scope: { sections: ['work'], pages: ['other-b', 'missing'] } });
    const link = grant({ kind: 'link', name: undefined, secret: { key: keyText(1), salt: saltText(1) }, scope: code.scope });
    expect(lookupOf(code)).toBe('c/harbor');
    expect(lookupOf(link)).toBe('l/gaaaaaaaa');
    expect(covers(code, pages)).toEqual(['work-a', 'work-b', 'other-b']);
    expect(covers(link, pages)).toEqual(covers(code, pages));
  });

  it('checks transition safety while allowing notes on withdrawn grants to change, and a grant to be deleted', () => {
    const now = new Date('2026-10-20T09:00:00+05:30');
    const original = grant({ id: 'gaaaaaaaa' });
    const withdrawn = grant({ id: 'gbbbbbbbb', name: 'forest', revokedAt: '2026-10-10T09:00:00+05:30' });
    expect(checkTransitions([withdrawn], [{ ...withdrawn, notes: 'Updated note' }], now)).toEqual([]);
    // deleted on purpose (the Access screen asks first): working or withdrawn, it simply goes
    expect(checkTransitions([original], [], now)).toEqual([]);
    expect(checkTransitions([original, withdrawn], [original], now)).toEqual([]);
    expect(checkTransitions([], [original, { ...original }], now).join('\n')).toContain('duplicated');
    expect(checkTransitions([withdrawn], [{ ...withdrawn, scope: { pages: ['other'] } }], now).join('\n')).toContain('Withdrawn grant gbbbbbbbb changed scope');
    expect(checkTransitions([original], [{ ...original, kind: 'link', name: undefined, secret: { key: keyText(2), salt: saltText(1) } }], now).join('\n')).toContain('changed kind');
    expect(checkTransitions([original], [{ ...original, createdAt: '2026-10-06T09:00:00+05:30' }], now).join('\n')).toContain('changed creation date');
    expect(checkTransitions([], [original, { ...grant({ id: 'gcccccccc' }), name: original.name }], new Date('2026-10-06T09:00:00+05:30')).join('\n')).toContain(
      'Code name harbor is reused',
    );
  });

  it('validates grant snapshots', () => {
    expect(checkGrant(grant())).toEqual([]);
    expect(checkGrant(grant({ id: 'bad' })).join('\n')).toContain('grant id');
    expect(checkGrant(grant({ secret: { words: 'one-two-three', salt: saltText(1) } })).join('\n')).toContain('at least four');
    expect(checkGrant(grant({ secret: { words: 'maple-river-cloud-seven', key: keyText(1), salt: saltText(1) } })).join('\n')).toContain('must not have a link key');
    expect(checkGrant(grant({ kind: 'link', name: undefined, secret: { key: keyText(1), salt: saltText(1) } }))).toEqual([]);
    expect(checkGrant(grant({ kind: 'link', name: 'harbor', secret: { words: 'maple-river-cloud-seven', key: b64.encode(bytes(31, 1)), salt: 'bad' } })).join('\n')).toContain(
      'link grant',
    );
    expect(checkGrant(grant({ expiresAt: '2026-10-04T09:00:00+05:30' })).join('\n')).toContain('expiresAt must be after createdAt');
    expect(checkGrant(grant({ revokedAt: '2026-10-04T09:00:00+05:30' })).join('\n')).toContain('revokedAt must not be before createdAt');
  });
});
