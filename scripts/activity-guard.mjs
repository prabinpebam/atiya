#!/usr/bin/env node
// @ts-check
/**
 * The nightly deploy's activity guard (documentation/access/spec.md §4.5): GitHub turns off a public
 * repository's scheduled workflows after 60 days without activity, and with them the nightly deploy that
 * makes grants expire. At 50 days this fails on purpose, so GitHub emails the owner about a failed run while
 * there's time; any commit resets the clock.
 *
 *   node scripts/activity-guard.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const WARN_DAYS = 50;

/** Whole days between the last commit and now. */
export const daysSince = (/** @type {string} */ iso, now = new Date()) => Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);

/** @returns {{ ok: boolean; days: number; message: string }} */
export function guard(/** @type {string} */ lastCommit, now = new Date()) {
  const days = daysSince(lastCommit, now);
  return days >= WARN_DAYS
    ? { ok: false, days, message: `The last commit was ${days} days ago. GitHub turns off this repository's nightly deploy at 60 days without activity, and grants would stop expiring: make any commit to keep it running.` }
    : { ok: true, days, message: `The last commit was ${days} day${days === 1 ? '' : 's'} ago: the nightly deploy keeps running.` };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const last = execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim();
  const r = guard(last);
  (r.ok ? console.log : console.error)(r.message);
  if (!r.ok) process.exit(1);
}
