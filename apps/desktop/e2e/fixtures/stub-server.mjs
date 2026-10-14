#!/usr/bin/env node
/**
 * A stand-in for the site's dev server in the app's E2E tests: answers /_edit/ and / on the port it's
 * given (its last argument). STUB_MODE=exit-after-ready stops it 1.5 s after it starts listening, every
 * time; STUB_MODE=never-listen exits without listening.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.argv.at(-1));
const mode = process.env.STUB_MODE ?? 'ok';
// a managed site's server is given its content folder: show whose it is, so a test can tell
let owner = '';
try {
  if (process.env.CONTENT_ROOT) owner = ` for ${JSON.parse(readFileSync(join(process.env.CONTENT_ROOT, 'site.json'), 'utf8')).name}`;
} catch {
  owner = ' for an unreadable site';
}
if (mode === 'never-listen') {
  console.log('stand-in: exiting without listening');
  process.exit(3);
}
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // as the engine's dev server does for a managed site (integrations/launch.mjs)
  if (process.env.ATIYA_LAUNCH_TOKEN && req.headers['x-atiya-launch'] !== process.env.ATIYA_LAUNCH_TOKEN) {
    res.statusCode = 403;
    return res.end('This site is open in Atiya Studio. Open it there.');
  }
  if (req.url?.startsWith('/_edit/')) res.end(page(`Edit mode (stand-in)${owner}`, '<p><a id="out" href="https://example.com/">An outside link</a></p><p><a id="in" href="/">The site</a></p>'));
  else res.end(page('Site (stand-in)', '<p>Home</p>'));
}).listen(port, 'localhost', () => {
  console.log(`stand-in: listening on http://localhost:${port}/`);
  if (mode === 'exit-after-ready') setTimeout(() => process.exit(1), 1500);
});
