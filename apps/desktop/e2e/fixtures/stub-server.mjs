#!/usr/bin/env node
/**
 * A stand-in for the site's dev server in the app's E2E tests: answers /_edit/ and / on the port it's
 * given (its last argument). STUB_MODE=exit-after-ready stops it 1.5 s after it starts listening, every
 * time; STUB_MODE=never-listen exits without listening.
 */
import { createServer } from 'node:http';

const port = Number(process.argv.at(-1));
const mode = process.env.STUB_MODE ?? 'ok';
if (mode === 'never-listen') {
  console.log('stand-in: exiting without listening');
  process.exit(3);
}
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (req.url?.startsWith('/_edit/')) res.end(page('Edit mode (stand-in)', '<p><a id="out" href="https://example.com/">An outside link</a></p><p><a id="in" href="/">The site</a></p>'));
  else res.end(page('Site (stand-in)', '<p>Home</p>'));
}).listen(port, 'localhost', () => {
  console.log(`stand-in: listening on http://localhost:${port}/`);
  if (mode === 'exit-after-ready') setTimeout(() => process.exit(1), 1500);
});
