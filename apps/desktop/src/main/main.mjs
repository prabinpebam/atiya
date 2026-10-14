// @ts-check
/**
 * Atiya Studio's main process (documentation/desktop/spec.md §7). It alone holds secrets, starts and
 * stops the site's dev server, runs setup, and drives the window: a frame across the top (the app's own
 * page) and a body (the app's pages, or edit mode from the dev server). Views are sandboxed, with no Node.
 */
import { app, BaseWindow, clipboard, dialog, ipcMain, Menu, nativeImage, net, protocol, session, shell, Tray, WebContentsView } from 'electron';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { delimiter, dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { astroEntry, checkCheckout, findCheckoutAbove, siteName } from '../core/checkout.mjs';
import { APP_ORIGIN, isBridgeCaller, isExternalSafe, staysInWindow, viewPreferences } from '../core/security.mjs';
import { SettingsStore } from '../core/settings.mjs';
import { engineInfo, engineRoot } from '../core/setup/engine.mjs';
import { startFakeGitHub } from '../core/setup/fake-github.mjs';
import { checkSite } from '../core/setup/doctor.mjs';
import { Git } from '../core/setup/git.mjs';
import { GitHub } from '../core/setup/github.mjs';
import { sync } from '../core/setup/sync.mjs';
import { bundledGit } from '../core/setup/bundled-git.mjs';
import { Supervisor } from '../core/supervisor.mjs';
import { SetupFlow } from './setup-flow.mjs';
import { tokenStore } from './token-store.mjs';
import { utilitySpawn } from './utility-spawn.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..', '..');
const UI_ROOT = join(APP_ROOT, 'src', 'ui');
const PRELOAD = join(HERE, 'preload.cjs');
// the site's compact chrome height (--size-chrome-block-compact, 3.5rem)
const FRAME_HEIGHT = 56;

// tests and a second copy of the app keep their own data folder
if (process.env.ATIYA_USER_DATA) app.setPath('userData', process.env.ATIYA_USER_DATA);
const settings = new SettingsStore(app.getPath('userData'));
/** The owner's checkout keeps 4321; a managed site gets its own port, so the two never collide. */
const DEV_PORT = Number(process.env.ATIYA_DEV_PORT || 4321);
const SITE_PORT = Number(process.env.ATIYA_SITE_PORT || process.env.ATIYA_DEV_PORT || 4325);
const HOME = process.env.ATIYA_HOME || homedir();
const FAKE = process.argv.includes('--fake-github') || process.env.ATIYA_FAKE_GITHUB === '1';

/** The launch token: new every launch, given to a managed site's server and sent by the app's views alone (spec §7.3). */
const LAUNCH_TOKEN = randomBytes(24).toString('base64url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

/** @type {BaseWindow | null} */
let win = null;
/** @type {WebContentsView} */
let frame;
/** @type {WebContentsView} */
let body;
/** @type {Supervisor | null} */
let server = null;
/** @type {(import('../core/settings.mjs').Workspace & { repository?: string, url?: string }) | null} */
let workspace = null;
/** @type {'welcome' | 'source' | 'setup' | 'server' | 'editor' | 'site' | 'publish' | 'check' | 'sync'} */
let view = 'welcome';
let port = DEV_PORT;
let quitting = false;
/** @type {Tray | null} */
let tray = null;
/** @type {{ state: 'going' | 'live' | 'failed', message?: string, url?: string } | null} */
let live = null;
/** @type {SetupFlow} */
let flow;
/** The GitHub the app talks to: github.com, or a fake for trying it and for the tests. */
let github = { api: 'https://api.github.com', web: 'https://github.com', fake: false };

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** Serves the app's own pages from src/ui, and nothing outside it. */
function serveApp() {
  protocol.handle('app', async (req) => {
    const url = new URL(req.url);
    if (url.host !== 'ui') return new Response('Not found', { status: 404 });
    const file = normalize(join(UI_ROOT, decodeURIComponent(url.pathname)));
    const inside = relative(UI_ROOT, file);
    if (inside.startsWith('..') || inside.includes(`..${sep}`) || !existsSync(file)) return new Response('Not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const type = TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? 'application/octet-stream';
    return new Response(res.body, { status: 200, headers: { 'content-type': type, 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' } });
  });
}

/** Opens an address in the system browser (tests record it instead). @param {string} url */
function openExternal(url) {
  if (!isExternalSafe(url)) return;
  if (process.env.ATIYA_EXTERNAL_LOG) {
    appendFileSync(process.env.ATIYA_EXTERNAL_LOG, url + '\n');
    return;
  }
  shell.openExternal(url);
}

const devOrigin = () => `http://localhost:${port}`;

/** Keeps a view in its origin; anything else opens outside. @param {WebContentsView} v */
function lockNavigation(v) {
  v.webContents.on('will-navigate', (e, url) => {
    if (staysInWindow(v.webContents.getURL(), url, [devOrigin(), APP_ORIGIN])) return;
    e.preventDefault();
    openExternal(url);
  });
  v.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
}

function layout() {
  if (!win) return;
  const { width, height } = win.getContentBounds();
  frame.setBounds({ x: 0, y: 0, width, height: FRAME_HEIGHT });
  body.setBounds({ x: 0, y: FRAME_HEIGHT, width, height: Math.max(0, height - FRAME_HEIGHT) });
}

function icon(name = 'icon.png') {
  return nativeImage.createFromPath(join(APP_ROOT, 'assets', name));
}

function createWindow() {
  win = new BaseWindow({ width: 1440, height: 920, minWidth: 720, minHeight: 480, title: 'Atiya Studio', icon: icon(), show: true });
  frame = new WebContentsView({ webPreferences: viewPreferences({ preload: PRELOAD }) });
  body = new WebContentsView({ webPreferences: viewPreferences({ preload: PRELOAD }) });
  win.contentView.addChildView(frame);
  win.contentView.addChildView(body);
  lockNavigation(frame);
  lockNavigation(body);
  layout();
  win.on('resize', layout);
  win.on('close', (e) => {
    if (quitting || !settings.read().keepInTray || process.env.ATIYA_NO_TRAY) return;
    e.preventDefault();
    win?.hide();
  });
  win.on('closed', () => {
    win = null;
  });
  frame.webContents.loadURL(`${APP_ORIGIN}/frame.html`);
}

/** What the app's pages need to draw themselves. */
function appState() {
  return {
    workspace: workspace ? { ...workspace, name: workspace.name ?? siteName(workspace.path) } : null,
    server: server?.status() ?? null,
    view,
    suggested: suggestedCheckout(),
    devUrl: `${devOrigin()}/`,
    live,
    conflicts,
    setup: flow?.state() ?? null,
    githubWeb: github.web,
  };
}

function broadcast() {
  const s = appState();
  for (const v of [frame, body]) if (v && !v.webContents.isDestroyed()) v.webContents.send('app:state', s);
  tray?.setToolTip(`Atiya Studio: ${s.workspace?.name ?? 'no site open'}`);
}

/** @param {typeof view} next */
function show(next) {
  view = next;
  const pages = { welcome: 'welcome.html', source: 'source.html', setup: 'setup.html', server: 'server.html', publish: 'publish.html', check: 'check.html', sync: 'sync.html' };
  if (next === 'editor') body.webContents.loadURL(`${devOrigin()}/_edit/`);
  else if (next === 'site') body.webContents.loadURL(`${devOrigin()}/`);
  else body.webContents.loadURL(`${APP_ORIGIN}/${pages[next]}`);
  broadcast();
}

/** The checkout the app was started from, if any (offered to developers). */
function suggestedCheckout() {
  const dir = process.env.ATIYA_SUGGEST_DIR ?? findCheckoutAbove(APP_ROOT);
  if (!dir) return null;
  const check = checkCheckout(dir);
  return { path: dir, ok: check.ok, reason: check.ok ? undefined : check.reason };
}

/**
 * The dev server's command: a stand-in for the tests, else astro dev under the system's Node: the
 * checkout's own (a developer workspace) or the engine's with the site's content (a managed site).
 * @param {string} engineDir
 */
function serverCommand(engineDir) {
  if (process.env.ATIYA_DEV_SERVER) {
    const { command, args } = JSON.parse(process.env.ATIYA_DEV_SERVER);
    return { command, args: [...args, String(port)] };
  }
  return { command: 'node', args: [/** @type {string} */ (astroEntry(engineDir)), 'dev', '--port', String(port)] };
}

/**
 * Starts a dev server and shows edit mode when it's up.
 * @param {string} engineDir the checkout whose code runs
 * @param {NodeJS.ProcessEnv} extraEnv
 * @param {{ utility?: boolean }} [o] run it under Electron's own Node (a managed site), not the system's
 */
async function startServer(engineDir, extraEnv, o = {}) {
  await server?.stop();
  server?.removeAllListeners();
  const { command, args } = serverCommand(engineDir);
  const env = { ...process.env, FORCE_COLOR: '0', ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  server = new Supervisor({ command, args, cwd: engineDir, env, port, ...(o.utility ? { spawn: /** @type {any} */ (utilitySpawn) } : {}) });
  let wasUp = false;
  server.on('status', (s) => {
    const up = s.state === 'ready' || s.state === 'external';
    if (up && !wasUp) show('editor');
    else if (!up && wasUp) show('server');
    wasUp = up;
    broadcast();
  });
  server.on('log', () => broadcast());
  show('server');
  server.start();
}

/** Opens a developer workspace: the checkout's own code and content. @param {string} dir */
async function openWorkspace(dir) {
  const check = checkCheckout(dir);
  if (!check.ok) return { ok: false, reason: check.reason };
  port = DEV_PORT;
  live = null;
  workspace = { kind: 'developer', path: dir, name: check.name };
  settings.remember(workspace);
  await startServer(dir, {});
  return { ok: true };
}

/**
 * Opens a managed site: the engine's code with the site's own content. Until stage 7 bundles a release,
 * the engine is the checkout the app lives in. First it brings in what another computer saved (§4.7):
 * a page changed on both asks which to keep before edit mode starts.
 * @param {{ path: string, name?: string, repository?: string, url?: string }} site
 * @param {import('../core/setup/sync.mjs').Choices} [choices]
 */
async function openManaged(site, choices) {
  port = SITE_PORT;
  workspace = { kind: 'managed', path: site.path, name: site.name ?? siteName(site.path), repository: site.repository, url: site.url };
  const remembered = { ...workspace };
  settings.update((s) => {
    const before = /** @type {any} */ (s.workspaces.find((w) => w.path.toLowerCase() === site.path.toLowerCase()));
    s.workspaces = [{ ...remembered, live: before?.live }, ...s.workspaces.filter((w) => w.path.toLowerCase() !== site.path.toLowerCase())].slice(0, 10);
    s.current = site.path;
  });
  conflicts = null;
  try {
    const r = await sync(siteGit(site.path), site.path, { choices });
    if (r.state === 'conflict') {
      conflicts = r.conflicts;
      show('sync');
      return;
    }
  } catch {
    // offline, or GitHub unreachable: edit what's here; Save to remote brings the two together later
  }
  await startServer(
    engineRoot(),
    {
      CONTENT_ROOT: join(site.path, 'content'),
      PRIVATE_ROOT: join(site.path, 'private-pages'),
      ATIYA_LAUNCH_TOKEN: LAUNCH_TOKEN,
      ATIYA_CACHE_DIR: join(app.getPath('userData'), 'cache', createHash('sha1').update(site.path.toLowerCase()).digest('hex').slice(0, 12)),
      ...editGitEnv(site.path),
    },
    { utility: true },
  );
}

/**
 * What edit mode's own git needs in a managed site's server (Save to remote): the git the app carries,
 * first on the PATH; the app's git settings, never the person's; who commits (their no-reply address);
 * and, for github.com, the token as an HTTP header in git's environment. That's this process's memory,
 * never a file, an argument or a URL (spec §7.5 hands it over per push; this is the stage 7 step there).
 * @param {string} dir the site's workspace
 */
function editGitEnv(dir) {
  const { dir: gitDir } = bundledGit();
  /** @type {any} */
  let owner = {};
  try {
    owner = JSON.parse(readFileSync(join(dir, 'atiya.json'), 'utf8')).owner ?? {};
  } catch {
    // an older site: git's own fallback names it
  }
  const name = workspace?.name ?? 'Atiya Studio';
  const email = owner.login ? `${owner.id}+${owner.login}@users.noreply.github.com` : 'noreply@users.noreply.github.com';
  const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  /** @type {NodeJS.ProcessEnv} */
  const env = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(app.getPath('userData'), 'gitconfig'),
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
    ...(gitDir ? { [pathKey]: `${gitDir}${delimiter}${process.env[pathKey] ?? ''}` } : {}),
  };
  const token = github.fake ? null : tokens().load();
  if (token) Object.assign(env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}` });
  return env;
}

/** @type {import('../core/setup/sync.mjs').Conflict[] | null} */
let conflicts = null;

/** git for a site's workspace: the app's own settings, the token only for github.com. @param {string} dir */
function siteGit(dir) {
  return new Git({ token: github.fake ? null : tokens().load(), identity: { name: workspace?.name ?? 'Atiya Studio', email: 'noreply@users.noreply.github.com' }, configFile: join(app.getPath('userData'), 'gitconfig') });
}

/** Where a live site is opened: its address, or the fake's copy of it. @param {string | undefined} repository @param {string | undefined} url */
const liveUrl = (repository, url) => (github.fake && repository ? `${github.web}/sites/${repository}/` : url ?? '');

/** The GitHub token's store (a fake GitHub's token is kept apart from a real one). */
const tokens = () => tokenStore(join(app.getPath('userData'), github.fake ? 'github-token.fake.bin' : 'github-token.bin'));

function makeFlow() {
  flow = new SetupFlow({
    api: github.api,
    web: github.web,
    clientId: github.fake ? 'fake-client' : process.env.ATIYA_GITHUB_CLIENT_ID ?? null,
    home: HOME,
    gitConfigFile: join(app.getPath('userData'), 'gitconfig'),
    engine: engineInfo(),
    tokens: tokens(),
    copy: (t) => {
      clipboard.writeText(t);
      // the tests' sessions may have no clipboard: they read what was copied from a log
      if (process.env.ATIYA_CLIPBOARD_LOG) appendFileSync(process.env.ATIYA_CLIPBOARD_LOG, t + '\n');
    },
    openExternal,
    onReadyToEdit: (site) => {
      openManaged({ path: site.dir, name: site.name, repository: site.repository, url: site.url });
    },
    onLive: (s) => {
      live = s.state === 'live' ? { state: 'live', url: liveUrl(workspace?.repository, s.url) } : s;
      if (s.state === 'live')
        settings.update((st) => {
          const w = st.workspaces.find((x) => x.path === workspace?.path);
          if (w) /** @type {any} */ (w).live = true;
        });
      broadcast();
    },
    saveSetup: (s) =>
      settings.update((st) => {
        /** @type {any} */ (st).setup = s;
      }),
    pollMs: Number(process.env.ATIYA_POLL_MS ?? 5000),
    emailPollMs: Number(process.env.ATIYA_EMAIL_POLL_MS ?? 5000),
    firstRunWaitMs: Number(process.env.ATIYA_FIRST_RUN_WAIT_MS ?? 30_000),
  });
  flow.on('change', () => broadcast());
}

/** The bridge: answers only the app's own pages. */
function bridge() {
  /** @param {string} channel @param {(...args: any[]) => any} fn */
  const handle = (channel, fn) =>
    ipcMain.handle(channel, (e, ...args) => {
      if (!isBridgeCaller(e.senderFrame?.url)) throw new Error('Not allowed');
      return fn(...args);
    });
  handle('app:state', () => appState());
  handle('workspace:open', (/** @type {string} */ dir) => openWorkspace(String(dir)));
  handle('workspace:choose', async () => {
    const r = await dialog.showOpenDialog({ title: "Open your site's source", properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    return openWorkspace(r.filePaths[0]);
  });
  handle('server:restart', () => server?.restart());
  handle('server:use-existing', () => server?.useExisting());
  handle('view:show', (/** @type {string} */ v) => {
    const up = server?.status().state === 'ready' || server?.status().state === 'external';
    if ((v === 'editor' || v === 'site') && up) show(v);
    if (v === 'source' || v === 'welcome' || v === 'publish' || v === 'check') show(v);
  });
  handle('open:external', (/** @type {string} */ url) => openExternal(String(url)));
  handle('open:browser', () => openExternal(`${devOrigin()}/`));
  handle('open:live', () => live?.url && openExternal(live.url));
  handle('site:check', async () => {
    if (workspace?.kind !== 'managed') return null;
    const token = tokens().load();
    return checkSite(workspace.path, { github: new GitHub({ token, api: github.api, web: github.web }), gitConfigFile: join(app.getPath('userData'), 'gitconfig') });
  });
  handle('sync:resolve', async (/** @type {Record<string, string>} */ choices) => {
    if (workspace?.kind !== 'managed' || !conflicts) return;
    /** @type {import('../core/setup/sync.mjs').Choices} */
    const clean = {};
    for (const c of conflicts) if (choices?.[c.file] === 'mine' || choices?.[c.file] === 'theirs') clean[c.file] = choices[c.file] === 'mine' ? 'mine' : 'theirs';
    await openManaged({ path: workspace.path, name: workspace.name, repository: workspace.repository, url: workspace.url }, clean);
  });
  handle('setup:start', (/** @type {'new' | 'existing'} */ mode) => {
    show('setup');
    flow.start(mode === 'existing' ? 'existing' : 'new');
  });
  handle('setup:sign-in', () => flow.signIn());
  handle('setup:copy-code', () => flow.copyCode());
  handle('setup:open-github', () => flow.openGitHubAgain());
  handle('setup:check-email', () => flow.checkEmail());
  handle('setup:edit', (/** @type {any} */ patch) => flow.edit(patch ?? {}));
  handle('setup:choose-folder', async () => {
    const r = await dialog.showOpenDialog({ title: 'Where to keep your site', properties: ['openDirectory', 'createDirectory'] });
    const p = flow.state().proposal;
    if (!r.canceled && r.filePaths[0] && p) flow.edit({ dir: join(r.filePaths[0], p.repo) });
  });
  handle('setup:create', () => flow.create());
  handle('setup:choose-site', (/** @type {string} */ name) => flow.chooseSite(String(name)));
  handle('setup:retry', () => (flow.state().error?.retry === 'sign-in' ? flow.signIn() : flow.create()));
  handle('setup:back', () => {
    flow.reset();
    show('welcome');
  });
  handle('publish:retry', async () => {
    const w = /** @type {any} */ (settings.read().workspaces.find((x) => x.path === workspace?.path));
    if (!w?.repository) return;
    live = { state: 'going' };
    broadcast();
    flow.create({ name: w.name, repo: String(w.repository).split('/')[1], url: w.url, dir: w.path, explore: 'little-planet', samples: true });
  });
}

function menus() {
  const restart = { label: 'Restart the dev server', click: () => server?.restart(), enabled: true };
  const template = /** @type {Electron.MenuItemConstructorOptions[]} */ ([
    {
      label: 'File',
      submenu: [
        { label: 'Make a new site', click: () => show('welcome') },
        { label: 'Open a source folder…', accelerator: 'CmdOrCtrl+O', click: () => show('source') },
        { label: 'Open in browser', click: () => openExternal(`${devOrigin()}/`) },
        restart,
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Edit mode', accelerator: 'CmdOrCtrl+1', click: () => server && show('editor') },
        { label: 'Site', accelerator: 'CmdOrCtrl+2', click: () => server && show('site') },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => body.webContents.reload() },
        { label: 'Developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => body.webContents.toggleDevTools() },
      ],
    },
  ]);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  tray = new Tray(icon('tray.png'));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Atiya Studio', click: () => win?.show() },
      restart,
      { type: 'separator' },
      { label: 'Quit', click: () => quit() },
    ]),
  );
  tray.on('click', () => win?.show());
}

/** @type {(() => Promise<unknown>) | null} */
let closeFake = null;

async function quit() {
  if (quitting) return;
  quitting = true;
  flow?.stop();
  await server?.stop();
  await closeFake?.();
  tray?.destroy();
  app.exit(0);
}

app.on('second-instance', () => {
  win?.show();
  win?.focus();
});

app.on('before-quit', (e) => {
  if (quitting) return;
  e.preventDefault();
  quit();
});

app.on('window-all-closed', () => {
  // the tray keeps the app (and its dev server) running; Quit stops it
  if (process.env.ATIYA_NO_TRAY) quit();
});

app.whenReady().then(async () => {
  if (process.env.ATIYA_GITHUB_URL) github = { api: process.env.ATIYA_GITHUB_URL, web: process.env.ATIYA_GITHUB_URL, fake: true };
  else if (FAKE) {
    const fake = await startFakeGitHub({ root: join(app.getPath('userData'), 'fake-github'), port: Number(process.env.ATIYA_FAKE_PORT || 0), deviceApproveAfterMs: Number(process.env.ATIYA_FAKE_APPROVE_MS ?? 2000), buildMs: Number(process.env.ATIYA_FAKE_BUILD_MS ?? 8000) });
    closeFake = fake.close;
    github = { api: fake.url, web: fake.url, fake: true };
  }
  serveApp();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'fullscreen'));
  // the launch token goes on every request the views make to a managed site's server, and nowhere else
  session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const managed = workspace?.kind === 'managed' && details.url.startsWith(`http://localhost:${SITE_PORT}/`);
    cb({ requestHeaders: managed ? { ...details.requestHeaders, 'X-Atiya-Launch': LAUNCH_TOKEN } : details.requestHeaders });
  });
  makeFlow();
  bridge();
  createWindow();
  menus();
  const saved = /** @type {any} */ (settings.read());
  const remembered = /** @type {any} */ (settings.current());
  if (saved.setup?.inputs) {
    // setup was stopped while creating: carry on where it stopped (spec §4.4)
    show('setup');
    flow.s.mode = saved.setup.mode ?? 'new';
    flow.create(saved.setup.inputs);
  } else if (remembered?.kind === 'developer' && checkCheckout(remembered.path).ok) openWorkspace(remembered.path);
  else if (remembered?.kind === 'managed' && existsSync(join(remembered.path, 'atiya.json'))) {
    live = remembered.live ? { state: 'live', url: liveUrl(remembered.repository, remembered.url) } : null;
    await openManaged({ path: remembered.path, name: remembered.name, repository: remembered.repository, url: remembered.url });
  } else show('welcome');
});
