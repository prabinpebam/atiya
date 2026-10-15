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
const studio = (asked) => `<p id="studio-asked">${asked ? 'asked' : 'not asked'}</p><p><button type="button" data-theme-switch id="site-switch">The site's own theme switch</button></p><ol id="commands"></ol><script>
  const b = window.atiyaStudio;
  if (b) {
    let theme = 'everything';
    const header = () => ({
      context: [{ kind: 'link', id: 's1', label: 'Pages', text: 'Pages' }, { kind: 'text', text: 'A stand-in page', strong: true }, { kind: 'tag', text: 'Published', tone: 'positive' }],
      controls: [
        { kind: 'status', state: 'saved', text: 'All changes saved' },
        { kind: 'button', id: 's2', label: 'Undo', icon: 'undo' },
        { kind: 'button', id: 's3', label: 'Desktop width', icon: 'desktop', pressed: true },
        { kind: 'select', id: 's4', label: 'Show', value: theme, options: [{ value: 'everything', label: 'Everything', icon: 'collection' }, { value: 'drafts', label: 'Drafts', icon: 'edit' }, { value: 'published', label: 'Published', icon: 'success' }] },
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
// the action center's side of edit mode (documentation/desktop/action-center.md §8.2, §8.3): a small index, a
// thumbnail, the start mark, and the site's settings, written as edit mode's store would (a version, refusals)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let started = `start-${Date.now()}`;
const site = { name: 'Ada Lovelace', version: 1 };
const ways = { 'little-planet': false, version: 1 };
const settings = () => [
  { id: 'site-name', title: 'Site name', about: "The site's name, in its header and its pages' titles.", control: 'text', value: site.name, version: `v${site.version}`, max: 80, screen: 'settings', screenLabel: 'Settings', words: ['title', 'name'] },
  { id: 'way:little-planet', title: 'Little planet', about: 'Visitors can explore the site as a little planet.', control: 'switch', value: ways['little-planet'], version: `v${ways.version}`, restarts: true, screen: 'ways', screenLabel: 'Ways to explore', words: ['game', 'mode', 'planet'] },
];
const findIndex = () => ({
  ok: true,
  pages: [
    { id: 'designup', title: 'My journey with DesignUp', kind: 'note', kindLabel: 'Article', status: 'published', statusLabel: 'Published', published: true, private: false, section: { id: 'writing', title: 'Writing' }, path: '/writing/designup/', summary: 'What a conference taught me.', text: 'We ship weekly and learn from every release.', picture: 'articles/designup/stage', updatedAt: '2026-10-01' },
    { id: 'secret-plan', title: 'A private plan', kind: 'page', kindLabel: 'Page', status: 'draft', statusLabel: 'Draft', published: false, private: true, section: { id: 'writing', title: 'Writing' }, path: null, summary: 'Only for some.', text: '', picture: null, updatedAt: '2026-10-02' },
  ],
  sections: [{ id: 'writing', title: 'Writing', path: '/writing/', pages: 2 }],
  media: [{ id: 'articles/designup/stage', kind: 'image', title: 'Speaking on stage at DesignUp', caption: 'Bengaluru', decorative: false, owner: 'articles/designup', ownerLabel: 'My journey with DesignUp', private: false, width: 1600, height: 900 }],
  screens: [
    { id: 'dashboard', label: 'Dashboard', href: '/_edit/', words: ['home', 'overview'] },
    { id: 'articles', label: 'Pages', href: '/_edit/articles/', words: ['articles', 'posts', 'writing'] },
    { id: 'media', label: 'Media', href: '/_edit/media/', words: ['pictures', 'images', 'photos', 'videos'] },
    { id: 'settings', label: 'Settings', href: '/_edit/settings/', words: ['site name', 'profile'] },
    { id: 'ways', label: 'Ways to explore', href: '/_edit/ways/', words: ['game mode', 'planet'] },
    { id: 'publish', label: 'Save to remote', href: '/_edit/publish/', words: ['publish', 'push', 'deploy', 'git'] },
  ],
  settings: settings(),
});
/** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} body */
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};
/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
async function find(req, res) {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname === '/_edit/__warm') return json(res, 200, { started, running: false });
  if (req.method === 'GET' && url.pathname === '/_edit/api/find') return json(res, 200, findIndex());
  if (req.method === 'GET' && url.pathname === '/_edit/api/find/thumb') return json(res, 200, { ok: true, thumb: `/_thumbs/${encodeURIComponent(url.searchParams.get('id') ?? '')}.png` });
  if (url.pathname.startsWith('/_thumbs/')) {
    res.setHeader('content-type', 'image/png');
    return res.end(PNG);
  }
  const m = /^\/_edit\/api\/find\/settings\/(.+)$/.exec(url.pathname);
  if (req.method === 'PUT' && m) {
    // what edit mode's guard asks of a write
    if (req.headers['x-editor'] !== '1' || req.headers.origin !== `http://localhost:${port}` || !String(req.headers['content-type']).startsWith('application/json')) return json(res, 403, { ok: false });
    let raw = '';
    for await (const c of req) raw += c;
    const { value, version } = JSON.parse(raw);
    const id = decodeURIComponent(m[1]);
    const now = settings().find((s) => s.id === id);
    if (!now) return json(res, 404, { ok: false, issues: [{ message: 'no such setting' }] });
    if (version !== now.version) return json(res, 409, { ok: false, setting: now, issues: [{ message: 'changed elsewhere' }] });
    if (id === 'site-name') {
      if (typeof value !== 'string' || !value.trim()) return json(res, 422, { ok: false, setting: now, issues: [{ message: 'The site needs a name.' }] });
      site.name = value.trim();
      site.version++;
      console.log(`stand-in: site name ${site.name}`);
      return json(res, 200, { ok: true, setting: settings()[0], restarts: false });
    }
    ways['little-planet'] = value === true;
    ways.version++;
    console.log(`stand-in: little planet ${ways['little-planet'] ? 'on' : 'off'}`);
    // the server starts again to build what's on now, as edit mode's does
    setTimeout(() => (started = `start-${Date.now()}`), 800);
    return json(res, 200, { ok: true, setting: settings()[1], restarts: true });
  }
  return false;
}
createServer(async (req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // as the engine's dev server does for a managed site (integrations/launch.mjs)
  if (process.env.ATIYA_LAUNCH_TOKEN && req.headers['x-atiya-launch'] !== process.env.ATIYA_LAUNCH_TOKEN) {
    res.statusCode = 403;
    return res.end('This site is open in Atiya Studio. Open it there.');
  }
  if ((await find(req, res)) !== false) return;
  if (req.url?.startsWith('/_edit/')) res.end(page(`Edit mode (stand-in)${owner}`, `<p><a id="out" href="https://example.com/">An outside link</a></p><p><a id="in" href="/">The site</a></p>${studio(req.headers['x-atiya-studio'] === '1')}`));
  else res.end(page('Site (stand-in)', '<p>Home</p>'));
}).listen(port, 'localhost', () => {
  console.log(`stand-in: listening on http://localhost:${port}/`);
  if (mode === 'exit-after-ready') setTimeout(() => process.exit(1), 1500);
});
