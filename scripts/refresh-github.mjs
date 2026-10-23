#!/usr/bin/env node
/**
 * Node 24, no credentials or dependencies:
 * node scripts/refresh-github.mjs [--login <username>] [--date YYYY-MM-DD] [--out content/github.json]
 * The first snapshot needs --login; later refreshes reuse the validated snapshot's login.
 * Fetches only the anonymous public-profile calendar, including publicly displayed anonymised counts.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contributionStats, parsePublicCalendar, validateGitHubSnapshot } from '../src/site/content/github.ts';

const DAY = 86_400_000;
const MAX_BYTES = 2_000_000;

function options(args) {
  const result = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    const value = args[i + 1];
    if (!['--login', '--date', '--out'].includes(name) || !value || value.startsWith('--') || result.has(name)) {
      throw new Error('Use [--login <username>] [--date YYYY-MM-DD] [--out content/github.json], with each option once.');
    }
    result.set(name, value);
  }
  return result;
}

async function calendar(login, from, to) {
  const url = new URL(`https://github.com/users/${encodeURIComponent(login)}/contributions`);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'accept-language': 'en-US', 'user-agent': 'Atiya-public-contribution-refresh' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Public calendar request failed (HTTP ${response.status}).`);
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/html')) throw new Error('Public calendar response is not HTML.');
  if (!response.body) throw new Error('Public calendar response has no body.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Public calendar response exceeds 2 MB.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

/** Refreshes one snapshot; importing the CLI does not fetch or write anything. */
export async function refreshGitHub(argv = process.argv.slice(2)) {
  const args = options(argv);
  const output = resolve(args.get('--out') ?? 'content/github.json');
  let login = args.get('--login');
  if (!login) {
    let existing;
    try {
      existing = await readFile(output, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error('--login is required when creating the first snapshot.');
      throw error;
    }
    login = validateGitHubSnapshot(JSON.parse(existing)).login;
  }
  const through = args.get('--date') ?? new Date().toISOString().slice(0, 10);
  const end = Date.parse(`${through}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through) || !Number.isFinite(end) || new Date(end).toISOString().slice(0, 10) !== through) {
    throw new Error('--date must be a real UTC date, YYYY-MM-DD.');
  }
  const expected = Array.from({ length: 365 }, (_, i) => ({
    date: new Date(end - (364 - i) * DAY).toISOString().slice(0, 10), count: 0, level: 0,
  }));
  // Validate arguments and window before any network request or filesystem write.
  validateGitHubSnapshot({ login, through, fetchedAt: new Date().toISOString(), days: expected });
  const start = expected[0].date;
  const days = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(through.slice(0, 4)); year++) {
    const prefix = String(year).padStart(4, '0');
    const first = `${prefix}-01-01`;
    const last = `${prefix}-12-31`;
    const html = await calendar(login, start > first ? start : first, through < last ? through : last);
    // GitHub returns a whole calendar year for from/to. In a leap year, keep Jan 1 rather than Dec 31
    // only when this window needs Jan 1 (a 365-day window can never need both).
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const anchor = leap && start <= first && through < last ? `${prefix}-12-30` : last;
    days.push(...parsePublicCalendar(html, anchor).filter((day) => day.date >= start && day.date <= through));
  }
  const snapshot = validateGitHubSnapshot({ login, through, fetchedAt: new Date().toISOString(), days });
  const stats = contributionStats(snapshot);
  await mkdir(dirname(output), { recursive: true });
  const staging = `${output}.${randomUUID()}.pending`;
  try {
    const file = await open(staging, 'wx');
    try {
      await file.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(staging, output);
  } finally {
    await rm(staging, { force: true });
  }
  console.log(`Refreshed ${snapshot.days.length} public-profile days: ${stats.total} contributions, ${stats.activeDays} active days.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  refreshGitHub().catch((error) => {
    console.error(`GitHub refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
