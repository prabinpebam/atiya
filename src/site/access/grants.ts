import { b64 } from './crypto.ts';
import type { Grant, GrantState } from './types.ts';

type PageAccess = { id: string; section?: string; access: 'locked' | 'private' };

function time(text: string | undefined): number | null {
  if (!text) return null;
  const value = Date.parse(text);
  return Number.isNaN(value) ? null : value;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function grantState(g: Grant, now = new Date(), soonDays = 3): GrantState {
  const nowMs = now.getTime();
  const revoked = time(g.revokedAt);
  if (revoked !== null && revoked <= nowMs) return 'withdrawn';
  const expires = time(g.expiresAt);
  if (expires !== null && expires <= nowMs) return 'expired';
  if (expires !== null && expires <= nowMs + soonDays * 24 * 60 * 60 * 1000) return 'expiring';
  return 'active';
}

export const isValid = (g: Grant, now = new Date()): boolean => {
  const state = grantState(g, now);
  return state === 'active' || state === 'expiring';
};

export function lookupOf(g: Grant): string {
  return g.kind === 'code' ? `c/${g.name ?? ''}` : `l/${g.id}`;
}

export function covers(g: Grant, pages: PageAccess[]): string[] {
  const pageScope = new Set(g.scope.pages ?? []);
  const sectionScope = new Set(g.scope.sections ?? []);
  const out: string[] = [];
  for (const page of pages) {
    if (g.kind === 'code' && page.access === 'private') continue;
    const byPage = pageScope.has(page.id);
    const bySection = page.access === 'locked' && page.section !== undefined && sectionScope.has(page.section);
    if (byPage || bySection) out.push(page.id);
  }
  return out;
}

export function checkTransitions(prev: Grant[], next: Grant[], now = new Date()): string[] {
  const problems: string[] = [];
  const prevById = new Map(prev.map((grant) => [grant.id, grant]));
  const nextById = new Map<string, Grant>();
  const seenIds = new Set<string>();

  for (const grant of next) {
    if (seenIds.has(grant.id)) problems.push(`Grant ${grant.id} is duplicated.`);
    seenIds.add(grant.id);
    nextById.set(grant.id, grant);
  }

  for (const grant of prev) {
    const changed = nextById.get(grant.id);
    if (!changed) {
      problems.push(`Grant ${grant.id} was deleted.`);
      continue;
    }
    if (grant.kind !== changed.kind) problems.push(`Grant ${grant.id} changed kind.`);
    if (!sameJson(grant.secret, changed.secret)) problems.push(`Grant ${grant.id} changed secret.`);
    if (grant.createdAt !== changed.createdAt) problems.push(`Grant ${grant.id} changed creation date.`);
    if (grantState(grant, now) === 'withdrawn') {
      for (const field of ['scope', 'secret', 'kind', 'recipient', 'revokedAt'] as const) {
        if (!sameJson(grant[field], changed[field])) problems.push(`Withdrawn grant ${grant.id} changed ${field}.`);
      }
    }
  }

  const activeNames = new Map<string, string>();
  for (const grant of next) {
    if (grant.kind !== 'code' || !grant.name || !isValid(grant, now)) continue;
    const other = activeNames.get(grant.name);
    if (other && other !== grant.id) problems.push(`Code name ${grant.name} is reused by ${other} and ${grant.id}.`);
    else activeNames.set(grant.name, grant.id);
  }

  return problems;
}

function checkDate(label: string, value: string | undefined, required: boolean, problems: string[]): number | null {
  if (!value) {
    if (required) problems.push(`${label} is missing.`);
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    problems.push(`${label} is not a date.`);
    return null;
  }
  return parsed;
}

function hasKey(secret: Grant['secret'], key: 'key' | 'words'): boolean {
  return secret[key] !== undefined;
}

export function checkGrant(g: Grant): string[] {
  const problems: string[] = [];
  if (!/^g[a-z2-7]{8}$/.test(g.id)) problems.push('The grant id is not valid.');
  try {
    if (b64.decode(g.secret.salt).length !== 16) problems.push('The salt must be 16 bytes.');
  } catch {
    problems.push('The salt must be base64url.');
  }

  if (g.kind === 'code') {
    if (!g.name || !/^[a-z]+$/.test(g.name)) problems.push('A code grant needs a word name.');
    if (!g.secret.words || !/^[a-z]+(-[a-z]+){3,}$/.test(g.secret.words)) problems.push('A code grant needs at least four secret words.');
    if (hasKey(g.secret, 'key')) problems.push('A code grant must not have a link key.');
  } else if (g.kind === 'link') {
    if (g.name) problems.push('A link grant must not have a code name.');
    if (hasKey(g.secret, 'words')) problems.push('A link grant must not have code words.');
    try {
      if (!g.secret.key || b64.decode(g.secret.key).length !== 32) problems.push('A link grant needs a 32-byte key.');
    } catch {
      problems.push('A link grant key must be base64url.');
    }
  } else {
    problems.push('The grant kind is not valid.');
  }

  const createdAt = checkDate('createdAt', g.createdAt, true, problems);
  const expiresAt = checkDate('expiresAt', g.expiresAt, false, problems);
  const revokedAt = checkDate('revokedAt', g.revokedAt, false, problems);
  if (createdAt !== null && expiresAt !== null && expiresAt <= createdAt) problems.push('expiresAt must be after createdAt.');
  if (createdAt !== null && revokedAt !== null && revokedAt < createdAt) problems.push('revokedAt must not be before createdAt.');
  return problems;
}
