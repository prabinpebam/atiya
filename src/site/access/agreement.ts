/**
 * Agreeing before seeing shared work (documentation/access/spec.md §7.6), pure so it's unit-tested: the
 * words a reader agrees to, who and what the share was for (from the grant, carried in its keyring), when
 * this browser has to ask again, and the record the contact service keeps. No DOM, no storage.
 */

/** Who a share is for and why, as the grant says (spec §4.1): its notes, email and role never leave edit mode. */
export interface Reader {
  name: string;
  organisation?: string;
  purpose?: string;
}

/**
 * The words, as the reader sees them (UnlockPanel writes them out; a unit test holds the two the same).
 * Changing any of them needs a new AGREEMENT_VERSION (a unit test pins their digest to it), so every reader
 * agrees again to what's new, and each record says which words it was.
 */
export const AGREEMENT = {
  heading: 'Shared in confidence',
  intro: 'You’re about to see confidential work, shared only with the person or organisation below. If that isn’t you, sign out now.',
  /** The statement ticked: it reads right whether a purpose is shown or not. */
  statement: 'I’ll use what I see only for the reason it was shared with me, and keep it confidential.',
  /** What's recorded, said before agreeing (the privacy notice says more). */
  recorded: 'Your agreement is recorded with the time, your IP address and browser, and Prabin is told.',
} as const;

export const AGREEMENT_VERSION = '2026-10-08';

const clean = (s: unknown, max: number): string | undefined => {
  if (typeof s !== 'string') return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

/** What the sealer puts in a grant's keyring for the agreement: the name, the organisation and the purpose, each only if set. */
export function readerOf(grant: { recipient?: { name?: unknown; organisation?: unknown }; purpose?: unknown }): Reader | undefined {
  const name = clean(grant.recipient?.name, 120);
  if (!name) return undefined;
  const organisation = clean(grant.recipient?.organisation, 120);
  const purpose = clean(grant.purpose, 400);
  return { name, ...(organisation ? { organisation } : {}), ...(purpose ? { purpose } : {}) };
}

/** Whether a keyring's reader is well formed (the runtime trusts nothing it decrypts blindly). */
export function isReader(value: unknown): value is Reader {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.some((k) => !['name', 'organisation', 'purpose'].includes(k))) return false;
  if (typeof r.name !== 'string' || !r.name.trim()) return false;
  return (r.organisation === undefined || typeof r.organisation === 'string') && (r.purpose === undefined || typeof r.purpose === 'string');
}

/** The lines the agreement shows: who it's for ("Name, Organisation") and why; a part that isn't set isn't shown at all. */
export function shownFor(reader?: Reader): { who?: string; why?: string } {
  if (!reader) return {};
  const who = [reader.name, reader.organisation].filter(Boolean).join(', ');
  return { ...(who ? { who } : {}), ...(reader.purpose ? { why: reader.purpose } : {}) };
}

/** The statement the reader ticks. */
export const statementFor = (_reader?: Reader): string => AGREEMENT.statement;

/** A short, stable digest (FNV-1a, 32 bits, hex): enough to tell that what was shown has changed. */
export function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** What was agreed to, as one digest: the words' version, the statement and the lines shown. */
export const shownDigest = (reader?: Reader) => digest(JSON.stringify([AGREEMENT_VERSION, statementFor(reader), shownFor(reader)]));

/** What this browser remembers: for each grant, the digest of what was agreed to, and when. */
export type Agreed = Record<string, { d: string; at: string }>;

export function readAgreed(text: string | null): Agreed {
  if (!text) return {};
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Agreed = {};
    for (const [grant, a] of Object.entries(v as Record<string, unknown>)) {
      const r = a as { d?: unknown; at?: unknown };
      if (/^g[a-z2-7]{8}$/.test(grant) && typeof r?.d === 'string' && typeof r?.at === 'string') out[grant] = { d: r.d, at: r.at };
    }
    return out;
  } catch {
    return {};
  }
}

/** Whether to ask: never agreed here, or the words or what's shown have changed since. */
export const needsAgreement = (agreed: Agreed, grant: string, reader?: Reader) => agreed[grant]?.d !== shownDigest(reader);

/** This browser's memory once the reader agrees. */
export const withAgreement = (agreed: Agreed, grant: string, reader: Reader | undefined, at: string): Agreed => ({ ...agreed, [grant]: { d: shownDigest(reader), at } });

/** The record the contact service keeps and emails (documentation/contact/spec.md §4.5): the grant, never its secret. */
export interface AgreementRecord {
  /** Random, made in the browser: the same record sent twice is kept (and emailed) once. */
  id: string;
  grant: string;
  via: 'code' | 'link';
  version: string;
  statement: string;
  /** Who and why, as shown (a part left out wasn't shown). */
  shown: { who?: string; why?: string };
  digest: string;
  /** The page it was agreed on (a path on the site). */
  page: string;
  /** The browser's clock, for reference: the service keeps its own time. */
  agreedAt: string;
}

export function recordFor(o: { id: string; grant: string; via: 'code' | 'link'; reader?: Reader; page: string; at: string }): AgreementRecord {
  return { id: o.id, grant: o.grant, via: o.via, version: AGREEMENT_VERSION, statement: statementFor(o.reader), shown: shownFor(o.reader), digest: shownDigest(o.reader), page: o.page, agreedAt: o.at };
}

/** Records not yet taken by the service, kept to try again (at most 20, the newest kept). */
export function readOutbox(text: string | null): AgreementRecord[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text) as unknown;
    return Array.isArray(v) ? (v.filter((r) => r && typeof r === 'object' && typeof (r as AgreementRecord).id === 'string' && typeof (r as AgreementRecord).grant === 'string') as AgreementRecord[]).slice(-20) : [];
  } catch {
    return [];
  }
}
