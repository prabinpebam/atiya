// @ts-check
/**
 * Atiya Studio's main process (documentation/desktop/spec.md §7). It alone holds secrets, starts and
 * stops the site's dev server, and drives the window: a frame across the top (the app's own page) and a
 * body (the app's pages, or edit mode from the dev server). Views are sandboxed and get no Node.
 */
import { app, BaseWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, session, shell, Tray, WebContentsView } from 'electron';
import { appendFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { astroEntry, checkCheckout, findCheckoutAbove, siteName } from '../core/checkout.mjs';
import { APP_ORIGIN, isBridgeCaller, isExternalSafe, staysInWindow, viewPreferences } from '../core/security.mjs';
import { SettingsStore } from '../core/settings.mjs';
import { Supervisor } from '../core/supervisor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..', '..');
const UI_ROOT = join(APP_ROOT, 'src', 'ui');
const PRELOAD = join(HERE, 'preload.cjs');
// the site's compact chrome height (--size-chrome-block-compact, 3.5rem)
const FRAME_HEIGHT = 56;

// tests and a second copy of the app keep their own data folder
if (process.env.ATIYA_USER_DATA) app.setPath('userData', process.env.ATIYA_USER_DATA);
const settings = new SettingsStore(app.getPath('userData'));
const DEV_PORT = Number(process.env.ATIYA_DEV_PORT || 4321);

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
/** @type {import('../core/settings.mjs').Workspace | null} */
let workspace = null;
/** @type {'welcome' | 'server' | 'editor' | 'site'} */
let view = 'welcome';
let quitting = false;
/** @type {Tray | null} */
let tray = null;

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

const devOrigin = () => `http://localhost:${DEV_PORT}`;

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
  };
}

function broadcast() {
  const s = appState();
  for (const v of [frame, body]) if (v && !v.webContents.isDestroyed()) v.webContents.send('app:state', s);
  tray?.setToolTip(`Atiya Studio: ${s.workspace?.name ?? 'no site open'}`);
}

/** @param {'welcome' | 'server' | 'editor' | 'site'} next */
function show(next) {
  view = next;
  if (next === 'welcome') body.webContents.loadURL(`${APP_ORIGIN}/welcome.html`);
  else if (next === 'server') body.webContents.loadURL(`${APP_ORIGIN}/server.html`);
  else if (next === 'editor') body.webContents.loadURL(`${devOrigin()}/_edit/`);
  else body.webContents.loadURL(`${devOrigin()}/`);
  broadcast();
}

/** The checkout the app was started from, if any (offered on the welcome). */
function suggestedCheckout() {
  const dir = process.env.ATIYA_SUGGEST_DIR || findCheckoutAbove(APP_ROOT);
  if (!dir) return null;
  const check = checkCheckout(dir);
  return { path: dir, ok: check.ok, reason: check.ok ? undefined : check.reason };
}

/** The dev server's command: a stand-in for the tests, else the checkout's own astro dev under the system's Node. @param {string} dir */
function serverCommand(dir) {
  if (process.env.ATIYA_DEV_SERVER) {
    const { command, args } = JSON.parse(process.env.ATIYA_DEV_SERVER);
    return { command, args: [...args, String(DEV_PORT)] };
  }
  return { command: 'node', args: [/** @type {string} */ (astroEntry(dir)), 'dev', '--port', String(DEV_PORT)] };
}

/** Opens a developer workspace: remembers it and starts its dev server. @param {string} dir */
async function openWorkspace(dir) {
  const check = checkCheckout(dir);
  if (!check.ok) return { ok: false, reason: check.reason };
  await server?.stop();
  server?.removeAllListeners();
  workspace = { kind: 'developer', path: dir, name: check.name };
  settings.remember(workspace);
  const { command, args } = serverCommand(dir);
  const env = { ...process.env, FORCE_COLOR: '0' };
  delete env.ELECTRON_RUN_AS_NODE;
  server = new Supervisor({ command, args, cwd: dir, env, port: DEV_PORT });
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
  return { ok: true };
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
    if ((v === 'editor' || v === 'site') && (server?.status().state === 'ready' || server?.status().state === 'external')) show(v);
  });
  handle('open:external', (/** @type {string} */ url) => openExternal(String(url)));
  handle('open:browser', () => openExternal(`${devOrigin()}/`));
}

function menus() {
  const restart = { label: 'Restart the dev server', click: () => server?.restart(), enabled: true };
  const template = /** @type {Electron.MenuItemConstructorOptions[]} */ ([
    {
      label: 'File',
      submenu: [
        { label: 'Open a source folder…', accelerator: 'CmdOrCtrl+O', click: () => show('welcome') },
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

async function quit() {
  if (quitting) return;
  quitting = true;
  await server?.stop();
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

app.whenReady().then(() => {
  serveApp();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'fullscreen'));
  bridge();
  createWindow();
  menus();
  const remembered = settings.current();
  if (remembered?.kind === 'developer' && checkCheckout(remembered.path).ok) openWorkspace(remembered.path);
  else show('welcome');
});
