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
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
  /* plain, and theme-aware: a test window someone sees should read as a placeholder, not a broken page */
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 2.5rem 3rem; background: Canvas; color: CanvasText; line-height: 1.5; }
  h1 { margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 600; }
  .note { margin: 0 0 1.5rem; color: GrayText; font-size: 0.875rem; }
  a { color: LinkText; }
</style></head><body><main><h1>${title}</h1><p class="note">A stand-in for the site's dev server, used by Atiya Studio's tests.</p>${body}</main></body></html>`;
// edit mode in the app describes its header to the title bar and takes its commands (plan stage 7B): the stand-in
// does the same with a fixed header, records the commands it's given, and applies a theme as edit mode would
const studio = (asked) => `<p id="studio-asked">${asked ? 'asked' : 'not asked'}</p><ol id="commands"></ol><script>
  const b = window.atiyaStudio;
  if (b) {
    let theme = 'system';
    const header = () => ({
      context: [{ kind: 'link', id: 's1', label: 'Pages', text: 'Pages' }, { kind: 'text', text: 'A stand-in page', strong: true }, { kind: 'tag', text: 'Published', tone: 'positive' }],
      controls: [
        { kind: 'status', state: 'saved', text: 'All changes saved' },
        { kind: 'button', id: 's2', label: 'Undo', icon: 'undo' },
        { kind: 'button', id: 's3', label: 'Desktop width', icon: 'desktop', pressed: true },
        { kind: 'select', id: 's4', label: 'Colour theme', value: theme, options: [{ value: 'system', label: 'System', icon: 'theme-system' }, { value: 'light', label: 'Light', icon: 'theme-light' }, { value: 'dark', label: 'Dark', icon: 'theme-dark' }] },
        { kind: 'button', id: 's5', label: 'Save to remote', text: 'Save to remote', icon: 'upload', variant: 'primary' },
        { kind: 'html', id: 's6', label: '<b>not drawn</b>' },
      ],
      theme,
      busy: false,
    });
    b.onCommand((c) => {
      const li = document.createElement('li');
      li.textContent = c.action + ' ' + c.id + (c.value ? ' ' + c.value : '');
      document.getElementById('commands').append(li);
      if (c.action === 'select' && c.id === 's4') { theme = c.value; b.publish(header()); }
    });
    b.publish(header());
  }
</script>`;
createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // as the engine's dev server does for a managed site (integrations/launch.mjs)
  if (process.env.ATIYA_LAUNCH_TOKEN && req.headers['x-atiya-launch'] !== process.env.ATIYA_LAUNCH_TOKEN) {
    res.statusCode = 403;
    return res.end('This site is open in Atiya Studio. Open it there.');
  }
  if (req.url?.startsWith('/_edit/')) res.end(page(`Edit mode (stand-in)${owner}`, `<p><a id="out" href="https://example.com/">An outside link</a></p><p><a id="in" href="/">The site</a></p>${studio(req.headers['x-atiya-studio'] === '1')}`));
  else res.end(page('Site (stand-in)', '<p>Home</p>'));
}).listen(port, 'localhost', () => {
  console.log(`stand-in: listening on http://localhost:${port}/`);
  if (mode === 'exit-after-ready') setTimeout(() => process.exit(1), 1500);
});
