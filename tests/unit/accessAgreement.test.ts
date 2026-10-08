/**
 * Agreeing before seeing shared work (documentation/access/spec.md §7.6): who and why travel in the keyring
 * (never the notes), what's shown, when a browser asks again, the record sent, and the words held to their
 * version and to the panel that shows them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGREEMENT, AGREEMENT_VERSION, digest, isReader, needsAgreement, readAgreed, readerOf, readOutbox, recordFor, shownDigest, shownFor, withAgreement } from '../../src/site/access/agreement';
import { openKeyring, sealKeyring } from '../../src/site/access/keyring';
import { b64, randomBytes } from '../../src/site/access/crypto';

const ROOT = join(__dirname, '..', '..');
/** The words' digest for each version: change the words, and this fails until the version is new too. */
const PINNED: Record<string, string> = { '2026-10-08': 'e22ac4ae' };

const grant = {
  id: 'gabcdefgh',
  recipient: { name: '  Asha  Rao ', organisation: 'Contoso', role: 'Design director', email: 'asha@example.com' },
  purpose: 'Senior design manager role, first screen',
  notes: 'Met at the conference; follow up in May.',
};

describe('who and why, from the grant', () => {
  it('carries the name, the organisation and the purpose: never the notes, the email or the role', () => {
    const r = readerOf(grant);
    expect(r).toEqual({ name: 'Asha Rao', organisation: 'Contoso', purpose: 'Senior design manager role, first screen' });
    expect(JSON.stringify(r)).not.toMatch(/conference|example\.com|director/);
  });

  it('leaves out what is not set, and has no reader without a name', () => {
    expect(readerOf({ recipient: { name: 'Asha' }, purpose: '  ' })).toEqual({ name: 'Asha' });
    expect(readerOf({ recipient: { name: '' }, purpose: 'x' })).toBeUndefined();
  });

  it('shows "name, organisation" and the purpose, each line only if there is something for it', () => {
    expect(shownFor({ name: 'Asha Rao', organisation: 'Contoso', purpose: 'A role' })).toEqual({ who: 'Asha Rao, Contoso', why: 'A role' });
    expect(shownFor({ name: 'Asha Rao' })).toEqual({ who: 'Asha Rao' });
    expect(shownFor(undefined)).toEqual({});
  });

  it('trusts only a well-formed reader', () => {
    expect(isReader({ name: 'A', organisation: 'B', purpose: 'C' })).toBe(true);
    expect(isReader({ name: 'A', notes: 'x' })).toBe(false);
    expect(isReader({ name: '' })).toBe(false);
    expect(isReader('A')).toBe(false);
  });
});

describe('the keyring carries the reader, sealed with the rest', () => {
  it('round-trips it, and refuses a malformed one', async () => {
    const kek = randomBytes(32);
    const header = { build: b64.encode(randomBytes(16)), kdf: 'hkdf-sha256' as const, salt: b64.encode(randomBytes(16)) };
    const keys = { k1: b64.encode(randomBytes(32)) };
    const env = await sealKeyring(kek, 'l/gabcdefgh', header, { v: 1, grant: 'gabcdefgh', reader: readerOf(grant), keys });
    expect(env.data).not.toContain('Asha');
    expect((await openKeyring(kek, 'l/gabcdefgh', env)).reader).toEqual(readerOf(grant));
    const without = await sealKeyring(kek, 'l/gabcdefgh', header, { v: 1, grant: 'gabcdefgh', keys });
    expect((await openKeyring(kek, 'l/gabcdefgh', without)).reader).toBeUndefined();
    const bad = await sealKeyring(kek, 'l/gabcdefgh', header, { v: 1, grant: 'gabcdefgh', reader: { name: 'A', notes: 'x' } as never, keys });
    await expect(openKeyring(kek, 'l/gabcdefgh', bad)).rejects.toThrow();
  });
});

describe('when a browser asks', () => {
  const reader = readerOf(grant);

  it('asks until agreed, then not again for the same access and the same words', () => {
    expect(needsAgreement({}, 'gabcdefgh', reader)).toBe(true);
    const agreed = withAgreement({}, 'gabcdefgh', reader, '2026-10-08T10:00:00.000Z');
    expect(needsAgreement(agreed, 'gabcdefgh', reader)).toBe(false);
    expect(needsAgreement(agreed, 'gzzzzzzzz', reader)).toBe(true);
  });

  it('asks again when what is shown changes (a new purpose)', () => {
    const agreed = withAgreement({}, 'gabcdefgh', reader, '2026-10-08T10:00:00.000Z');
    expect(needsAgreement(agreed, 'gabcdefgh', { ...reader!, purpose: 'Another role' })).toBe(true);
    expect(shownDigest(reader)).not.toBe(shownDigest({ ...reader!, purpose: 'Another role' }));
  });

  it('reads back only well-formed memories', () => {
    const agreed = withAgreement({}, 'gabcdefgh', reader, '2026-10-08T10:00:00.000Z');
    expect(readAgreed(JSON.stringify(agreed))).toEqual(agreed);
    expect(readAgreed(JSON.stringify({ nota: { d: 'x', at: 'y' }, gabcdefgh: { d: 1 } }))).toEqual({});
    expect(readAgreed('{')).toEqual({});
    expect(readAgreed(null)).toEqual({});
  });
});

describe('the record', () => {
  it('names the access, the words and what was shown: never a secret', () => {
    const r = recordFor({ id: '5f0c1c3e-2b1a-4c8e-9d7a-0a1b2c3d4e5f', grant: 'gabcdefgh', via: 'link', reader: readerOf(grant), page: '/work/k3v9q2m7xw/', at: '2026-10-08T10:00:00.000Z' });
    expect(r).toMatchObject({ grant: 'gabcdefgh', via: 'link', version: AGREEMENT_VERSION, statement: AGREEMENT.statement, shown: { who: 'Asha Rao, Contoso', why: 'Senior design manager role, first screen' }, page: '/work/k3v9q2m7xw/' });
    expect(r.digest).toBe(shownDigest(readerOf(grant)));
    expect(Object.keys(r).sort()).toEqual(['agreedAt', 'digest', 'grant', 'id', 'page', 'shown', 'statement', 'version', 'via']);
  });

  it('keeps at most twenty waiting to be sent', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), grant: 'gabcdefgh' }));
    expect(readOutbox(JSON.stringify(many)).map((r) => r.id)).toEqual(many.slice(-20).map((r) => r.id));
    expect(readOutbox('nope')).toEqual([]);
  });
});

describe('the words', () => {
  it('are pinned to their version: new words need a new AGREEMENT_VERSION (so every reader agrees again)', () => {
    expect(PINNED[AGREEMENT_VERSION], `add the digest of the words for version ${AGREEMENT_VERSION}`).toBe(digest(JSON.stringify(AGREEMENT)));
  });

  it('are the ones the panel shows', () => {
    const panel = readFileSync(join(ROOT, 'src/site/components/compounds/UnlockPanel.astro'), 'utf8').replace(/\s+/g, ' ');
    for (const words of [AGREEMENT.heading, AGREEMENT.intro, AGREEMENT.statement, AGREEMENT.recorded]) expect(panel).toContain(words);
  });
});
