/**
 * The sign-in runtime's decisions (src/site/access/session.ts; documentation/access/spec.md §4.3, §5.3,
 * §7; benchmark QB4, QB9): the magic link's fragment, the way back after signing in, the picture size to
 * decrypt, what a signed-in browser keeps, the reload on a missing keyring, and every message.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { afterSignOut, deviceSession, messageFor, onMissingKeyring, parseFragment, pickFromSrcset, readSession, remembered, REMEMBER_DAYS, safeReturn, sessionExpired, untilNote, withoutSecret } from '../../src/site/access/session';

const SECRET = 'A'.repeat(43);

describe('a magic link', () => {
  it("reads the grant and its 32-byte secret from the fragment, and nothing that isn't one", () => {
    expect(parseFragment(`#a=gfixlink2.${SECRET}`)).toEqual({ grant: 'gfixlink2', secret: SECRET });
    expect(parseFragment(`#top&a=gfixlink2.${SECRET}`)).toEqual({ grant: 'gfixlink2', secret: SECRET });
    expect(parseFragment('#a=gfixlink2.short')).toBeNull();
    expect(parseFragment(`#a=GFIXLINK2.${SECRET}`)).toBeNull();
    expect(parseFragment('#section-2')).toBeNull();
  });

  it('takes the secret out of the fragment and keeps the rest', () => {
    expect(withoutSecret(`#a=gfixlink2.${SECRET}`)).toBe('');
    expect(withoutSecret(`#top&a=gfixlink2.${SECRET}`)).toBe('#top');
  });
});

describe('the way back after signing in', () => {
  it('is a path on this site under its base, never elsewhere or back to Sign in', () => {
    expect(safeReturn('/atiya/side-projects/', '/atiya/')).toBe('/atiya/side-projects/');
    expect(safeReturn('/work/', '/')).toBe('/work/');
    for (const bad of ['//evil.example/', '/\\evil', 'https://evil.example/', '/other/', '/atiya/sign-in/?return=x', '/atiya/a b/', null, '']) expect(safeReturn(bad, '/atiya/')).toBeNull();
  });
});

describe('a picture size', () => {
  const set = '/a-480.bin 480w, /a-960.bin 960w, /a-1440.bin 1440w';
  it('is the smallest that covers the device pixels needed, else the largest', () => {
    expect(pickFromSrcset(set, 300)).toBe('/a-480.bin');
    expect(pickFromSrcset(set, 961)).toBe('/a-1440.bin');
    expect(pickFromSrcset(set, 5000)).toBe('/a-1440.bin');
    expect(pickFromSrcset('', 100)).toBeNull();
    expect(pickFromSrcset('/only.bin', 100)).toBe('/only.bin');
  });
});

describe('what a signed-in browser keeps', () => {
  const s = { v: 1, grant: 'gfixall22', lookup: 'c/harbor', kek: SECRET, via: 'code', expiresAt: '2026-11-05T00:00:00+05:30' };
  it('reads only a well-formed session (never a code or a secret)', () => {
    expect(readSession(JSON.stringify(s))).toEqual(s);
    expect(readSession(JSON.stringify({ ...s, lookup: '../x' }))).toBeNull();
    expect(readSession('not json')).toBeNull();
    expect(readSession(null)).toBeNull();
  });
  it('knows when its grant has ended', () => {
    expect(sessionExpired(s as never, new Date('2026-11-04T00:00:00+05:30'))).toBe(false);
    expect(sessionExpired(s as never, new Date('2026-11-05T00:00:00+05:30'))).toBe(true);
    expect(sessionExpired({ ...s, expiresAt: undefined } as never)).toBe(false);
  });
});

describe('a remembered session (Keep me signed in, security review P2)', () => {
  const s = { v: 1, grant: 'gfixall22', lookup: 'c/harbor', kek: SECRET, via: 'code' } as const;
  const now = new Date('2026-10-20T00:00:00Z');
  const day = 86_400_000;
  const at = (ms: number) => new Date(now.getTime() + ms);
  it(`lasts ${REMEMBER_DAYS} days from signing in`, () => {
    expect(REMEMBER_DAYS).toBe(30);
    expect(remembered(s, now).rememberedUntil).toBe('2026-11-19T00:00:00.000Z');
  });
  it('is kept until then, and gone (removed, quietly ended) from that moment', () => {
    const r = JSON.stringify(remembered(s, now));
    for (const kind of [true, false]) {
      expect(deviceSession(r, kind, at(29 * day)).session?.grant).toBe('gfixall22');
      expect(deviceSession(r, kind, at(29 * day)).write).toBeUndefined();
      expect(deviceSession(r, kind, at(30 * day))).toEqual({ session: null, ended: true, write: 'remove' });
      expect(deviceSession(r, kind, at(400 * day))).toEqual({ session: null, ended: true, write: 'remove' });
    }
  });
  it('one kept on the device before the limit gets it from now (stamped); a tab-only one has none', () => {
    const old = JSON.stringify(s);
    const r = deviceSession(old, true, now);
    expect(r.session?.rememberedUntil).toBe('2026-11-19T00:00:00.000Z');
    expect(r.write).toEqual(r.session);
    expect(deviceSession(old, false, now)).toEqual({ session: s });
  });
  it("one claiming longer than the limit, or a date that isn't one, isn't believed", () => {
    const long = deviceSession(JSON.stringify({ ...s, rememberedUntil: '2099-01-01T00:00:00Z' }), true, now);
    expect(long.session?.rememberedUntil).toBe('2026-11-19T00:00:00.000Z');
    expect(long.write).toEqual(long.session);
    expect(deviceSession(JSON.stringify({ ...s, rememberedUntil: 'soon' }), true, now)).toEqual({ session: null, ended: true, write: 'remove' });
    expect(deviceSession(JSON.stringify({ ...s, rememberedUntil: 5 }), true, now)).toEqual({ session: null, write: 'remove' });
  });
  it('anything else in the store is removed, and nothing is nothing', () => {
    expect(deviceSession('not json', true, now)).toEqual({ session: null, write: 'remove' });
    expect(deviceSession(null, true, now)).toEqual({ session: null });
  });
  it('the reader sees when it ends: the earlier of its day and the access’s', () => {
    expect(untilNote(remembered(s, now))).toBe('You’re signed in on this device until 19 November 2026.');
    expect(untilNote({ ...remembered(s, now), expiresAt: '2026-11-05T00:00:00Z' })).toBe('You’re signed in on this device until 5 November 2026.');
    expect(untilNote(s)).toBe('You’re signed in until you close this tab.');
  });
  it('the Sign in page offers it for the same number of days', () => {
    expect(readFileSync('src/site/components/compounds/UnlockPanel.astro', 'utf8')).toContain(`label="Keep me signed in on this device for ${REMEMBER_DAYS} days"`);
  });
  it('ending is said gently: what happened and what to do', () => {
    expect(messageFor('ended')).toBe("You were signed out after 30 days on this device. Sign in again to see what's shared with you.");
  });
});

describe('a missing keyring (QB4)', () => {
  it('reloads once for a build, then says the access no longer works', () => {
    expect(onMissingKeyring(null, 'b1')).toBe('reload');
    expect(onMissingKeyring('b0', 'b1')).toBe('reload');
    expect(onMissingKeyring('b1', 'b1')).toBe('withdrawn');
  });
});

describe('the messages (QB9)', () => {
  it('says what happened and what to do, in the copy rules', () => {
    expect(messageFor('wrong')).toBe("That access code doesn't work. Check it and try again, or get in touch for a new one.");
    expect(messageFor('expired', { expiresAt: '2026-11-05T00:00:00Z' })).toBe('This access expired on 5 November 2026. Get in touch for a new one.');
    expect(messageFor('withdrawn')).toBe('This access code no longer works. Get in touch for a new one.');
    expect(messageFor('not-shared')).toMatch(/^This page isn't shared with your access/);
    expect(messageFor('link-not-cover')).toBe("Your link doesn't open this page.");
    expect(messageFor('unsupported')).toMatch(/^This browser can't open shared pages/);
    expect(messageFor('stale')).toBe('The site was just updated. Reload the page in a minute.');
    expect(messageFor('offline')).toMatch(/^Couldn't reach the site/);
    expect(messageFor('cards', { cards: 1 })).toBe('1 shared page added to the list.');
    expect(messageFor('cards', { cards: 3 })).toBe('3 shared pages added to the list.');
    for (const o of ['wrong', 'expired', 'withdrawn', 'not-shared', 'offline'] as const) expect(messageFor(o)).not.toMatch(/click here|OK|Submit|password/i);
  });
  it("the bar's end date, and where Sign out goes", () => {
    expect(afterSignOut('private', '/atiya/work/deltaddd55/')).toBe('/atiya/work/');
    expect(afterSignOut(undefined, '/atiya/work/')).toBe('/atiya/work/');
  });
});
