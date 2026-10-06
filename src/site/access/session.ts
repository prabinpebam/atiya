/**
 * The sign-in runtime's decisions (documentation/access/spec.md §4.3, §5.3, §7), pure so they're unit-tested:
 * what a magic link's fragment holds, where it's safe to go back to, which picture size to decrypt, what's
 * kept on the device and when it's stale, and every message a visitor can see. No DOM, no storage.
 */

/** What a magic link carries after `#a=`: the grant's ID and its secret (base64url). */
export function parseFragment(hash: string): { grant: string; secret: string } | null {
  const m = /(?:^#|&)a=(g[a-z2-7]{8})\.([A-Za-z0-9_-]{43})(?:&|$)/.exec(hash.startsWith('#') ? hash : `#${hash}`);
  return m ? { grant: m[1], secret: m[2] } : null;
}

/** The fragment with the link's secret taken out (what the address bar keeps). */
export const withoutSecret = (hash: string) => {
  const rest = hash.replace(/^#/, '').split('&').filter((p) => !p.startsWith('a=')).join('&');
  return rest ? `#${rest}` : '';
};

/**
 * Where to go after signing in: a path on this site under its base, never another origin (`//x`, `/\x`),
 * a scheme, or the Sign in page itself.
 */
export function safeReturn(raw: string | null, base: string): string | null {
  if (!raw) return null;
  const b = base.replace(/\/$/, '');
  if (!raw.startsWith(`${b}/`) || raw.startsWith('//') || /^\/[\\/]/.test(raw) || /[\\\s]/.test(raw) || raw.includes('://')) return null;
  if (raw.startsWith(`${b}/sign-in/`)) return null;
  return raw;
}

/** The candidate of a srcset that covers `needed` device pixels (the smallest that does, else the largest). */
export function pickFromSrcset(srcset: string, needed: number): string | null {
  const candidates = srcset
    .split(',')
    .map((c) => c.trim().split(/\s+/))
    .filter((p) => p[0])
    .map(([url, d]) => ({ url, w: d && /^\d+w$/.test(d) ? Number(d.slice(0, -1)) : Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.w - b.w);
  if (!candidates.length) return null;
  return (candidates.find((c) => c.w >= needed) ?? candidates[candidates.length - 1]).url;
}

/** What a signed-in browser keeps (never the code or the link's secret): the grant key and how to find its keyring. */
export interface Session {
  v: 1;
  grant: string;
  lookup: string;
  /** The grant key, base64url. */
  kek: string;
  via: 'code' | 'link';
  expiresAt?: string;
}

export function readSession(text: string | null): Session | null {
  if (!text) return null;
  try {
    const s = JSON.parse(text) as Session;
    if (s?.v !== 1 || typeof s.grant !== 'string' || typeof s.lookup !== 'string' || typeof s.kek !== 'string' || !/^(c\/[a-z]+|l\/g[a-z2-7]{8})$/.test(s.lookup)) return null;
    return s;
  } catch {
    return null;
  }
}

export const sessionExpired = (s: Session, now = new Date()) => !!s.expiresAt && Date.parse(s.expiresAt) <= now.getTime();

/**
 * A keyring that's missing (404): the page may be from an earlier deploy (a cached page meets a new build),
 * so it reloads once with the cache bypassed; missing again, the grant has expired or been withdrawn.
 */
export const onMissingKeyring = (reloadedForBuild: string | null, build: string): 'reload' | 'withdrawn' => (reloadedForBuild === build ? 'withdrawn' : 'reload');

export type Outcome = 'wrong' | 'expired' | 'withdrawn' | 'not-shared' | 'link-not-cover' | 'unsupported' | 'stale' | 'offline' | 'opened' | 'cards' | 'signed-in' | 'signed-out';

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Every message a visitor can see (spec §7.2), in the site's copy rules. */
export function messageFor(outcome: Outcome, o: { expiresAt?: string; cards?: number } = {}): string {
  switch (outcome) {
    case 'wrong':
      return "That access code doesn't work. Check it and try again, or get in touch for a new one.";
    case 'expired':
      return o.expiresAt ? `This access expired on ${longDate(o.expiresAt)}. Get in touch for a new one.` : 'This access has expired. Get in touch for a new one.';
    case 'withdrawn':
      return 'This access code no longer works. Get in touch for a new one.';
    case 'not-shared':
      return "This page isn't shared with your access. Get in touch if you'd like to see it.";
    case 'link-not-cover':
      return "Your link doesn't open this page.";
    case 'unsupported':
      return "This browser can't open shared pages. Try a current version of Edge, Chrome, Firefox or Safari.";
    case 'stale':
      return 'The site was just updated. Reload the page in a minute.';
    case 'offline':
      return "Couldn't reach the site to sign in. Check your connection and try again.";
    case 'opened':
      return 'The page is open.';
    case 'cards':
      return o.cards === 1 ? '1 shared page added to the list.' : `${o.cards ?? 0} shared pages added to the list.`;
    case 'signed-in':
      return 'Signed in.';
    case 'signed-out':
      return 'Signed out.';
  }
}

/** Where Sign out goes: from a private page to its section, elsewhere the same page. */
export function afterSignOut(access: string | undefined, pathname: string): string {
  if (access === 'private') return pathname.replace(/[^/]+\/$/, '');
  return pathname;
}
