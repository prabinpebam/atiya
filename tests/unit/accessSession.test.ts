/**
 * The sign-in runtime's decisions (src/site/access/session.ts; documentation/access/spec.md §4.3, §5.3,
 * §7; benchmark QB4, QB9): the magic link's fragment, the way back after signing in, the picture size to
 * decrypt, what a signed-in browser keeps, the reload on a missing keyring, and every message.
 */
import { describe, expect, it } from 'vitest';
import { afterSignOut, messageFor, onMissingKeyring, parseFragment, pickFromSrcset, readSession, safeReturn, sessionExpired, untilWords, withoutSecret } from '../../src/site/access/session';

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
    expect(untilWords('2026-11-05T00:00:00Z')).toBe(', until 5 November 2026');
    expect(untilWords()).toBe('');
    expect(afterSignOut('locked', '/atiya/work/deltaddd55/', '/atiya/')).toBe('/atiya/work/');
    expect(afterSignOut('private', '/atiya/p/privone222/', '/atiya/')).toBe('/atiya/');
    expect(afterSignOut(undefined, '/atiya/work/', '/atiya/')).toBe('/atiya/work/');
  });
});
