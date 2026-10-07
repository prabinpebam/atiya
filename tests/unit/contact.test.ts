/**
 * The contact form's rules and service (documentation/contact/spec.md; plan CD1, CD4): the field rules both
 * sides share, the proof of work round trip (the browser's solver, the service's check), and every path
 * through the service's request handling, with what it remembers and sends faked.
 */
import { describe, expect, it } from 'vitest';
import { accessRequest, checkField, checkFields, cleanFields, countLinks, errorText, firstName, LIMITS } from '../../contact-api/src/rules.mjs';
import { DIFFICULTY, issue, leadingZeroBits, TTL_MS, verify } from '../../contact-api/src/challenge.mjs';
import { challenge, clientIp, contact, DAILY, HOURLY } from '../../contact-api/src/handle.mjs';
import { compose, gmailMessage, transport } from '../../contact-api/src/send.mjs';
import { saltOf, solve, zeroBits } from '../../src/site/scripts/contactWork';

const SECRET = 'test-secret-0123456789';
const ORIGIN = 'https://prabinpebam.github.io';

describe('the fields', () => {
  it('cleans what was typed: trimmed, \\n line endings, no control characters', () => {
    expect(cleanFields({ name: '  Ada \u0007', email: ' ada@example.com ', message: 'Hi\r\nthere\r' })).toEqual({ name: 'Ada', email: 'ada@example.com', message: 'Hi\nthere' });
    expect(cleanFields({})).toEqual({ name: '', email: '', message: '' });
  });

  it('a name: required, one line, at most 100 characters', () => {
    expect(checkField('name', '')).toBe('required');
    expect(checkField('name', 'Ada\nLovelace')).toBe('lines');
    expect(checkField('name', 'x'.repeat(LIMITS.name))).toBeNull();
    expect(checkField('name', 'x'.repeat(LIMITS.name + 1))).toBe('long');
  });

  it('an email: required, one @, a dot in the domain, no spaces or line breaks', () => {
    expect(checkField('email', '')).toBe('required');
    for (const ok of ['ada@example.com', 'a.b+c@sub.example.co.in']) expect(checkField('email', ok), ok).toBeNull();
    for (const bad of ['ada', 'ada@example', 'ada @example.com', 'a@b@example.com', '@example.com']) expect(checkField('email', bad), bad).toBe('format');
    expect(checkField('email', 'ada@example.com\nBcc: x@y.z')).toBe('lines');
    expect(checkField('email', `${'x'.repeat(250)}@a.co`)).toBe('long');
  });

  it('a message: 10 to 5,000 characters, at most 3 links', () => {
    expect(checkField('message', '')).toBe('required');
    expect(checkField('message', 'too short')).toBe('short');
    expect(checkField('message', 'Long enough.')).toBeNull();
    expect(checkField('message', 'x'.repeat(LIMITS.messageMax + 1))).toBe('long');
    expect(countLinks('see https://a.b, http://c.d and www.e.f')).toBe(3);
    expect(checkField('message', 'https://a.b http://c.d www.e.f')).toBeNull();
    expect(checkField('message', 'https://a.b http://c.d www.e.f https://g.h')).toBe('links');
    expect(checkFields({ name: '', email: 'x', message: 'Long enough.' })).toEqual({ name: 'required', email: 'format' });
  });

  it('says what happened and how to fix it', () => {
    expect(errorText('name', 'required')).toBe('Enter your name.');
    expect(errorText('email', 'required')).toBe('Enter your email so I can reply.');
    expect(errorText('email', 'format')).toBe('Enter an email address like name@example.com.');
    expect(errorText('message', 'short')).toBe('Write a little more: at least 10 characters.');
    expect(errorText('message', 'long', 'x'.repeat(5123))).toBe("Keep it under 5,000 characters: it's 5,123 now.");
    expect(errorText('message', 'links')).toBe('Take out some links: up to 3 are allowed.');
  });

  it('starts an access request, and thanks by first name', () => {
    expect(accessRequest('Work')).toBe("Hello Prabin, I'd like an access code to read the work in Work.");
    expect(accessRequest('')).toBe("Hello Prabin, I'd like an access code to read your shared work.");
    expect(firstName('  Ada Lovelace ')).toBe('Ada');
  });
});

describe('the proof of work', () => {
  it('counts leading zero bits the same on both sides', () => {
    for (const bytes of [[0, 0, 1], [0, 0x80], [0x0f], [0, 0, 0, 0], [0xff]]) expect(zeroBits(new Uint8Array(bytes))).toBe(leadingZeroBits(new Uint8Array(bytes)));
    expect(leadingZeroBits(new Uint8Array([0, 0x10]))).toBe(11);
  });

  it("a challenge the service issues, the browser's solver solves and the service accepts once, until it expires", async () => {
    const now = Date.now();
    const c = issue(SECRET, now, 10);
    expect(saltOf(c.challenge)).toMatch(/^[0-9a-f]{32}$/);
    const nonce = await solve(c.challenge, DIFFICULTY);
    expect(nonce).toMatch(/^\d+$/);
    const v = verify(SECRET, { ...c, nonce: nonce! }, now);
    expect(v).toMatchObject({ ok: true, id: saltOf(c.challenge), expires: now + TTL_MS });
    // the service never accepts less work than its own difficulty, whatever the challenge says
    expect(verify(SECRET, { ...c, nonce: nonce! }, now + TTL_MS + 1)).toEqual({ ok: false, why: 'expired' });
  }, 30_000);

  it('refuses a forged signature, a wrong nonce and anything malformed', async () => {
    const c = issue(SECRET);
    const nonce = (await solve(c.challenge, DIFFICULTY))!;
    expect(verify('another secret', { ...c, nonce })).toEqual({ ok: false, why: 'signature' });
    const wrong = String((Number(nonce) + 1) % 1e6);
    const w = verify(SECRET, { ...c, nonce: wrong });
    expect(w.ok === false && w.why).toBe('work');
    expect(verify(SECRET, { challenge: c.challenge, signature: c.signature, nonce: 12 })).toEqual({ ok: false, why: 'shape' });
    expect(verify(SECRET, { challenge: c.challenge, signature: c.signature, nonce: '1e9' })).toEqual({ ok: false, why: 'shape' });
    expect(verify(SECRET, {})).toEqual({ ok: false, why: 'shape' });
  }, 30_000);
});

describe("the service's request handling", () => {
  const fake = () => {
    const sent: unknown[] = [];
    const used = new Set<string>();
    const counts = new Map<string, number>();
    return {
      sent,
      counts,
      deps: {
        secret: SECRET,
        origins: [ORIGIN, 'http://localhost:4321'],
        claim: async (id: string) => (used.has(id) ? false : (used.add(id), true)),
        take: async (key: string, limit: number) => {
          const n = counts.get(key) ?? 0;
          if (n >= limit) return false;
          counts.set(key, n + 1);
          return true;
        },
        send: async (m: unknown) => void sent.push(m),
      },
    };
  };
  const solved = async () => {
    const c = issue(SECRET);
    return { challenge: c.challenge, signature: c.signature, nonce: (await solve(c.challenge, DIFFICULTY))! };
  };
  const message = async (more: Record<string, unknown> = {}) => ({ name: 'Ada Lovelace', email: 'ada@example.com', message: 'I would like to talk about your work.', website: '', elapsed: 9000, ...(await solved()), ...more });
  const post = (body: unknown, o: { origin?: string; type?: string; ip?: string } = {}) => ({
    origin: o.origin ?? ORIGIN,
    contentType: o.type ?? 'application/json',
    forwarded: o.ip ?? '203.0.113.7:51234',
    text: typeof body === 'string' ? body : JSON.stringify(body),
  });

  it('issues a challenge only to the site', () => {
    expect(challenge({ origin: ORIGIN }, { secret: SECRET, origins: [ORIGIN] })).toMatchObject({ status: 200, body: { difficulty: DIFFICULTY } });
    expect(challenge({ origin: 'https://evil.example' }, { secret: SECRET, origins: [ORIGIN] })).toEqual({ status: 403, body: { error: 'origin' } });
  });

  it('sends a good message, as clean fields, with the section an access request is about', async () => {
    const f = fake();
    expect(await contact(post(await message({ name: '  Ada Lovelace ', about: 'Work' })), f.deps)).toEqual({ status: 202, body: { ok: true } });
    expect(f.sent).toEqual([{ name: 'Ada Lovelace', email: 'ada@example.com', message: 'I would like to talk about your work.', about: 'Work' }]);
  }, 30_000);

  it('refuses another origin, another content type, a body too big, unknown fields and a bad about', async () => {
    const f = fake();
    const m = await message();
    expect(await contact(post(m, { origin: 'https://evil.example' }), f.deps)).toEqual({ status: 403, body: { error: 'origin' } });
    expect(await contact(post(m, { type: 'text/plain' }), f.deps)).toEqual({ status: 400, body: { error: 'shape' } });
    expect(await contact(post('x'.repeat(17_000)), f.deps)).toEqual({ status: 400, body: { error: 'shape' } });
    expect(await contact(post('{not json'), f.deps)).toEqual({ status: 400, body: { error: 'shape' } });
    expect(await contact(post({ ...m, cc: 'x@y.z' }), f.deps)).toEqual({ status: 400, body: { error: 'shape' } });
    expect(await contact(post({ ...m, about: 'Work\nBcc: x' }), f.deps)).toEqual({ status: 400, body: { error: 'shape' } });
    expect(f.sent).toEqual([]);
  }, 30_000);

  it('refuses a message without solved work, and a challenge used twice', async () => {
    const f = fake();
    const m = await message();
    expect(await contact(post({ ...m, nonce: '0' }), f.deps)).toMatchObject({ status: 403, body: { error: 'challenge' } });
    expect(await contact(post({ ...m, signature: 'forged' }), f.deps)).toMatchObject({ status: 403, body: { error: 'challenge' } });
    expect((await contact(post(m), f.deps)).status).toBe(202);
    expect(await contact(post(m), f.deps)).toEqual({ status: 403, body: { error: 'challenge' } });
    expect(f.sent).toHaveLength(1);
  }, 30_000);

  it('tells a bot it worked and sends nothing: the honeypot filled, too fast, or no time at all', async () => {
    const f = fake();
    for (const more of [{ website: 'https://spam.example' }, { elapsed: 1200 }, { elapsed: '9000' }, { website: undefined }]) expect(await contact(post(await message(more)), f.deps)).toEqual({ status: 202, body: { ok: true } });
    expect(f.sent).toEqual([]);
  }, 60_000);

  it("names each field's problem", async () => {
    const f = fake();
    expect(await contact(post(await message({ name: '', email: 'nope', message: 'hi' })), f.deps)).toEqual({ status: 400, body: { error: 'invalid', fields: { name: 'required', email: 'format', message: 'short' } } });
    expect(f.sent).toEqual([]);
  }, 30_000);

  it('limits a visitor to 5 an hour (whatever their port) and the site to 50 a day', async () => {
    const f = fake();
    for (let n = 0; n < HOURLY; n++) expect((await contact(post(await message(), { ip: `203.0.113.7:${40000 + n}` }), f.deps)).status).toBe(202);
    expect(await contact(post(await message(), { ip: '203.0.113.7:50000' }), f.deps)).toEqual({ status: 429, body: { error: 'rate' } });
    // the day's counter, nearly full: another visitor gets the daily answer
    const day = [...f.counts.keys()].find((k) => k.startsWith('day-'))!;
    f.counts.set(day, DAILY);
    expect(await contact(post(await message(), { ip: '198.51.100.9' }), f.deps)).toEqual({ status: 429, body: { error: 'daily' } });
    // no visitor's address is kept: only its salted hash
    expect([...f.counts.keys()].some((k) => k.includes('203.0.113.7'))).toBe(false);
  }, 60_000);

  it('says the email service failed', async () => {
    const f = fake();
    const r = await contact(post(await message()), { ...f.deps, send: async () => Promise.reject(new Error('down')) });
    expect(r).toEqual({ status: 502, body: { error: 'send' } });
  }, 30_000);

  it('reads the client IP without its port', () => {
    expect(clientIp('203.0.113.7:51234, 10.0.0.1')).toBe('203.0.113.7');
    expect(clientIp('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(clientIp('2001:db8::1')).toBe('2001:db8::1');
    expect(clientIp(null)).toBe('unknown');
  });
});

describe('the email', () => {
  it('is plain text: who, what about, when, the message, and how to answer', () => {
    const at = new Date('2026-10-06T17:05:00Z');
    expect(compose({ name: 'Ada', email: 'ada@example.com', message: 'Hello there.' }, at)).toEqual({
      subject: 'Message from Ada',
      plainText: 'From: Ada <ada@example.com>\nSent: 2026-10-06 17:05 UTC, from the contact form on your site\n\nHello there.\n\n--\nReply to this email to answer them.',
    });
    const access = compose({ name: 'Ada', email: 'ada@example.com', message: 'May I read it?', about: 'Work' }, at);
    expect(access.subject).toBe('Access request from Ada');
    expect(access.plainText).toContain('About: an access code for Work');
    expect(compose({ name: 'Ada', email: 'a@b.co', message: 'x'.repeat(10), about: '' }, at).plainText).toContain('About: an access code for the shared work');
  });

  it("goes by Prabin's own Gmail when both its settings are there, else by the Azure sender", () => {
    expect(transport({ GMAIL_USER: 'me@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' })).toEqual({ via: 'gmail', user: 'me@gmail.com', pass: 'abcdefghijklmnop' });
    expect(transport({ GMAIL_USER: ' me@gmail.com ', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' })).toMatchObject({ via: 'gmail', user: 'me@gmail.com' });
    expect(transport({ GMAIL_USER: 'me@gmail.com' })).toEqual({ via: 'acs' });
    expect(transport({ GMAIL_APP_PASSWORD: 'abcdefghijklmnop' })).toEqual({ via: 'acs' });
    expect(transport({ GMAIL_USER: 'me@gmail.com', GMAIL_APP_PASSWORD: '   ' })).toEqual({ via: 'acs' });
    expect(transport({})).toEqual({ via: 'acs' });
  });

  it('by Gmail, is from his own address under the site name, to CONTACT_TO, answering the visitor', () => {
    const at = new Date('2026-10-06T17:05:00Z');
    const m = { name: 'Ada', email: 'ada@example.com', message: 'Hello there.' };
    expect(gmailMessage(m, 'me@gmail.com', 'inbox@gmail.com', at)).toEqual({
      from: { name: "Prabin's site", address: 'me@gmail.com' },
      to: 'inbox@gmail.com',
      replyTo: { name: 'Ada', address: 'ada@example.com' },
      subject: 'Message from Ada',
      text: compose(m, at).plainText,
    });
  });
});
