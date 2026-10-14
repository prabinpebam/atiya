#!/usr/bin/env node
// @ts-check
/**
 * Runs the fake GitHub on its own, for trying setup by hand (documentation/desktop/plan.md, stage 2):
 *
 *   node bin/fake-github.mjs [--port 4390] [--approve-after 2000]
 *
 * Its token is fake-ada (Ada Lovelace, login ada). Its repositories live in %TEMP%\atiya-fake-github.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeGitHub } from '../src/core/setup/fake-github.mjs';

const arg = (/** @type {string} */ k, /** @type {string} */ d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const fake = await startFakeGitHub({ root: join(tmpdir(), 'atiya-fake-github', String(Date.now())), port: Number(arg('port', '4390')), deviceApproveAfterMs: Number(arg('approve-after', '2000')), buildMs: Number(arg('build-ms', '6000')) });
console.log(`Fake GitHub at ${fake.url} (token: fake-ada). Stop it with Ctrl+C.`);
