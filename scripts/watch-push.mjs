#!/usr/bin/env node
// @ts-check
/**
 * Watches every GitHub Actions run a push started, until all have finished, and fails if any did (AGENTS.md: merge,
 * push, then watch). Not just the deploy: the parity check, the installer, anything the commit triggered. A push is
 * reported done only when this passes.
 *
 *   node scripts/watch-push.mjs [<commit>] [--timeout-min 40]
 *
 * <commit> defaults to origin/main's. Runs that haven't appeared yet are waited for (GitHub queues them a few seconds
 * after the push); a network error is retried. Uses the GitHub CLI's sign-in.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const ti = args.indexOf('--timeout-min');
const timeoutMs = (ti >= 0 ? Number(args[ti + 1]) : 40) * 60_000;
const given = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--timeout-min') ?? 'origin/main';
// GitHub matches the full commit ID only
const sha = execFileSync('git', ['rev-parse', `${given}^{commit}`], { encoding: 'utf8' }).trim();
const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** @returns {{ name: string, status: string, conclusion: string | null, url: string }[] | null} */
function runs() {
  try {
    const out = execFileSync('gh', ['api', `repos/{owner}/{repo}/actions/runs?head_sha=${sha}&per_page=50`, '--jq', '[.workflow_runs[] | {name, status, conclusion, url: .html_url}]'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

const start = Date.now();
let seen = 0;
let quietSince = Date.now();
for (;;) {
  const list = runs();
  if (list) {
    if (list.length !== seen) {
      seen = list.length;
      quietSince = Date.now();
    }
    const pending = list.filter((r) => r.status !== 'completed');
    // every run finished, and no new one has appeared for 30 s (the push's workflows are all queued by then)
    if (list.length && !pending.length && Date.now() - quietSince > 30_000) {
      for (const r of list) console.log(`${r.conclusion === 'success' || r.conclusion === 'skipped' ? 'ok    ' : 'FAILED'} ${r.name}: ${r.conclusion} ${r.url}`);
      const failed = list.filter((r) => !['success', 'skipped', 'neutral'].includes(r.conclusion ?? ''));
      if (failed.length) {
        console.error(`${failed.length} of ${list.length} runs for ${sha.slice(0, 7)} failed: fix before reporting the push done`);
        process.exit(1);
      }
      console.log(`every run for ${sha.slice(0, 7)} passed (${list.length})`);
      process.exit(0);
    }
  }
  if (Date.now() - start > timeoutMs) {
    console.error(`timed out after ${Math.round(timeoutMs / 60000)} min waiting for the runs of ${sha.slice(0, 7)}`);
    process.exit(1);
  }
  await sleep(20_000);
}
