// @ts-check
/**
 * Atiya Studio's main process (documentation/desktop/spec.md §7). It alone holds secrets, starts and
 * stops the site's dev server, runs setup, and drives the window: a frame across the top (the app's own
 * page) and a body (the app's pages, or edit mode from the dev server). Views are sandboxed, with no Node.
 */
import { app, BaseWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, net, protocol, session, shell, Tray, WebContentsView } from 'electron';
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
import { GitHub, GitHubError } from '../core/setup/github.mjs';
import { runPrivateSetup } from '../core/setup/private.mjs';
import { sync } from '../core/setup/sync.mjs';
import { bundledGit } from '../core/setup/bundled-git.mjs';
import { Supervisor } from '../core/supervisor.mjs';
import { SetupFlow } from './setup-flow.mjs';
import { tokenStore } from './token-store.mjs';
import { utilitySpawn } from './utility-spawn.mjs';
import { AppWindowFrame, frameKindFor } from './window-frame.mjs';
import { isEditMode, sanitizeCommand, sanitizeHeader } from '../core/studio-header.mjs';
import { parseRemote, siteAddress, sitesFor } from '../core/account.mjs';
import { parseTheme, siteThemeScript } from '../core/theme.mjs';
import { addressFor, checkTarget, recentFor, rememberFor } from '../core/finder.mjs';
import { ACTION_IDS, checkAppSetting } from '../ui/find-catalogue.mjs';
import { execFile } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..', '..');
const UI_ROOT = join(APP_ROOT, 'src', 'ui');
const PRELOAD = join(HERE, 'preload.cjs');
// the title bar's one row: the site's compact chrome height (--size-chrome-block-compact, 3.5rem)
const FRAME_HEIGHT = 56;
// the body sits in the window as a card: inset by --space-2, its corners --radius-lg less that inset, so they
// follow the window's (a view can only round all four corners alike, so it can't meet the window's edges)
const BODY_INSET = 8;
const BODY_RADIUS = 12;

// tests and a second copy of the app keep their own data folder
if (process.env.ATIYA_USER_DATA) app.setPath('userData', process.env.ATIYA_USER_DATA);
const settings = new SettingsStore(app.getPath('userData'));
/** The owner's checkout keeps 4321; a managed site gets its own port, so the two never collide. */
const DEV_PORT = Number(process.env.ATIYA_DEV_PORT || 4321);
const SITE_PORT = Number(process.env.ATIYA_SITE_PORT || process.env.ATIYA_DEV_PORT || 4325);
const HOME = process.env.ATIYA_HOME || homedir();
const FAKE = process.argv.includes('--fake-github') || process.env.ATIYA_FAKE_GITHUB === '1';
/** Launched by a test or a script (ATIYA_BACKGROUND=1): the window never takes focus from the person at the computer. */
const BACKGROUND = process.env.ATIYA_BACKGROUND === '1';

/** The launch token: new every launch, given to a managed site's server and sent by the app's views alone (spec §7.3). */
const LAUNCH_TOKEN = randomBytes(24).toString('base64url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

/** @type {BaseWindow | null} */
let win = null;
/** @type {AppWindowFrame} */
let windowFrame;
/** Edit mode's header, as the row draws it (plan stage 7B); null away from edit mode. @type {import('../core/studio-header.mjs').StudioHeader | null} */
let studioHeader = null;
/** @type {WebContentsView} */
let frame;
/** @type {WebContentsView} */
let body;
/** @type {Supervisor | null} */
let server = null;
/** @type {(import('../core/settings.mjs').Workspace & { repository?: string, url?: string }) | null} */
let workspace = null;
/** @typedef {'welcome' | 'source' | 'setup' | 'server' | 'editor' | 'site' | 'publish' | 'check' | 'sync' | 'private'} View */
/** @type {View} */
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
  // the frame's page draws the whole window (its margin, corners, shadow and title bar); the body is a card inside
  const m = windowFrame.margin();
  frame.setBounds({ x: 0, y: 0, width, height });
  body.setBounds({
    x: m + BODY_INSET,
    y: m + FRAME_HEIGHT,
    width: Math.max(0, width - 2 * m - 2 * BODY_INSET),
    height: Math.max(0, height - 2 * m - FRAME_HEIGHT - BODY_INSET),
  });
}

/** A popover in the title bar (the server's, Snap Layouts) drops over the body: the frame comes on top while it's open. @param {boolean} up */
function raiseFrame(up) {
  if (!win) return;
  win.contentView.addChildView(up ? frame : body);
}

function icon(name = 'icon.png') {
  return nativeImage.createFromPath(join(APP_ROOT, 'assets', name));
}

/**
 * The site's pages (and edit mode) follow the app's theme (plan stage 7D): its choice goes into the dev server's
 * own theme storage, which they read before their first paint, so they never choose a theme of their own here.
 */
function followAppTheme() {
  if (!body || body.webContents.isDestroyed() || !body.webContents.getURL().startsWith(`${devOrigin()}/`)) return;
  body.webContents.executeJavaScript(siteThemeScript(settings.read().theme)).catch(() => {});
  // the site's own theme switches have nothing to choose here: the title bar chooses for the whole app
  body.webContents.insertCSS('[data-theme-switch], [data-editor-theme-switch] { display: none !important; }').catch(() => {});
}

function createWindow() {
  windowFrame = new AppWindowFrame(frameKindFor(process.platform, process.argv, process.env), join(app.getPath('userData'), 'window.json'));
  win = new BaseWindow({ ...windowFrame.options(), title: 'Atiya Studio', icon: icon(), show: !BACKGROUND });
  // a test's window shows without taking focus from whoever is at the computer
  if (BACKGROUND) win.showInactive();
  frame = new WebContentsView({ webPreferences: viewPreferences({ preload: PRELOAD }) });
  body = new WebContentsView({ webPreferences: viewPreferences({ preload: PRELOAD }) });
  // the frame's page is transparent where the body is and in the margin
  frame.setBackgroundColor('#00000000');
  body.setBorderRadius(BODY_RADIUS);
  win.contentView.addChildView(frame);
  win.contentView.addChildView(body);
  // every page the site's dev server loads in the body follows the app's theme (a page loaded before a change, or a
  // choice made on the site's own switch outside the app, is put right)
  body.webContents.on('dom-ready', followAppTheme);
  // the action center's Zoom (action-center.md §8.6): every page the body loads takes it; the frame never zooms
  body.webContents.on('dom-ready', applyZoom);
  lockNavigation(frame);
  lockNavigation(body);
  windowFrame.attach(win, {
    notify: (s) => {
      layout();
      if (!frame.webContents.isDestroyed()) frame.webContents.send('window:state', s);
    },
    views: () => [frame.webContents, body.webContents],
  });
  // Alt+Space opens the app's menu at the bar's start: the system's can't maximize a window the app draws; Ctrl+/
  // opens the action center (action-center.md §8.1), and neither reaches the page
  for (const wc of [frame.webContents, body.webContents])
    wc.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.alt && !input.control && !input.meta && !input.shift && (input.code === 'Space' || input.key === ' ')) {
        e.preventDefault();
        const m = windowFrame.margin();
        popupMenu(m + BODY_INSET, m + FRAME_HEIGHT);
      }
      if (input.type === 'keyDown' && (input.control || input.meta) && !input.alt && (input.code === 'Slash' || input.key === '/')) {
        e.preventDefault();
        if (!input.isAutoRepeat) toggleFinder(wc === body.webContents ? 'body' : 'frame');
      }
    });
  // the window's own channels answer the frame's page alone
  const fromFrame = (/** @type {Electron.IpcMainEvent | Electron.IpcMainInvokeEvent} */ e) => e.sender === frame.webContents;
  windowFrame.registerIpc(fromFrame, () => win);
  ipcMain.handle('window:state', (e) => (fromFrame(e) ? windowFrame.state() : null));
  ipcMain.on('frame:raise', (e, up) => fromFrame(e) && raiseFrame(up === true));
  ipcMain.on('app:menu', (e, x, y) => fromFrame(e) && Number.isFinite(x) && Number.isFinite(y) && popupMenu(x, y));
  // edit mode's header, drawn by the row (plan stage 7B): described by edit mode, pressed from the row; both checked
  const inEditMode = () => isEditMode(body.webContents.getURL(), devOrigin());
  const sendHeader = () => !frame.webContents.isDestroyed() && frame.webContents.send('studio:header', studioHeader);
  ipcMain.on('studio:header', (e, h) => {
    if (e.sender !== body.webContents || !inEditMode()) return;
    studioHeader = sanitizeHeader(h);
    sendHeader();
  });
  ipcMain.handle('studio:header', (e) => (fromFrame(e) ? studioHeader : null));
  ipcMain.on('studio:command', (e, c) => {
    const cmd = sanitizeCommand(c);
    if (fromFrame(e) && cmd && studioHeader && inEditMode()) body.webContents.send('studio:command', cmd);
  });
  finderIpc(fromFrame, inEditMode);
  // leaving edit mode (the site, the app's own pages) takes its controls out of the row; another screen of it
  // replaces them as soon as it has described its own
  body.webContents.on('did-start-navigation', (/** @type {any} */ d, /** @type {any} */ url, /** @type {any} */ inPlace, /** @type {any} */ mainFrame) => {
    const main = d?.isMainFrame ?? mainFrame;
    const same = d?.isSameDocument ?? inPlace;
    if (!main || same || isEditMode(d?.url ?? url ?? '', devOrigin()) || !studioHeader) return;
    studioHeader = null;
    sendHeader();
  });
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
  const saved = /** @type {any} */ (settings.read());
  return {
    workspace: workspace ? { ...workspace, name: workspace.name ?? siteName(workspace.path) } : null,
    server: server?.status() ?? null,
    view,
    suggested: suggestedCheckout(),
    devUrl: `${devOrigin()}/`,
    live,
    conflicts,
    privatePages: privatePagesState(),
    setup: flow?.state() ?? null,
    githubWeb: github.web,
    theme: parseTheme(settings.read().theme),
    // the title bar's account menu (plan stage 7C): who's signed in, the sites the app remembers, and who pushes
    account: account ? { ...account, state: accountState } : { login: null, name: null, avatar: null, state: accountState },
    sites: sitesFor(/** @type {any} */ (settings.read().workspaces), workspace?.path),
    // a source checkout saves to remote with this computer's own git sign-in; a managed site, with the app's account
    pushesWith: workspace?.kind === 'developer' ? 'computer' : workspace ? 'account' : null,
    // the action center's (action-center.md §4.3, §8.5): the app's own settings, and the open site's Recent
    prefs: { zoom: saved.zoom ?? 1, keepInTray: saved.keepInTray !== false },
    recent: recentFor(saved.recent, workspace?.path),
  };
}

function broadcast() {
  const s = appState();
  for (const v of [frame, body]) if (v && !v.webContents.isDestroyed()) v.webContents.send('app:state', s);
  tray?.setToolTip(`Atiya Studio: ${s.workspace?.name ?? 'no site open'}`);
  // the taskbar names the site, as the title bar no longer does
  win?.setTitle(s.workspace?.name ? `${s.workspace.name} · Atiya Studio` : 'Atiya Studio');
}

/** @param {View} next @param {string} [path] where in edit mode or the site (the action center's results) */
function show(next, path) {
  view = next;
  /** @type {Record<Exclude<View, 'editor' | 'site'>, string>} */
  const pages = { welcome: 'welcome.html', source: 'source.html', setup: 'setup.html', server: 'server.html', publish: 'publish.html', check: 'check.html', sync: 'sync.html', private: 'private.html' };
  if (next === 'editor') body.webContents.loadURL(`${devOrigin()}${path ?? '/_edit/'}`);
  else if (next === 'site') body.webContents.loadURL(`${devOrigin()}${path ?? '/'}`);
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
  /** @type {NodeJS.ProcessEnv} */
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
  // where it lives on GitHub, for the account menu: read after the start, never in its way
  remoteRepository(dir).then((repository) => {
    if (!repository || workspace?.path !== dir) return;
    workspace = { ...workspace, repository, url: siteAddress(repository) ?? undefined };
    settings.remember(/** @type {any} */ (workspace));
    broadcast();
  });
  return { ok: true };
}

/** Opens a remembered site: the account menu's list (plan stage 7C). @param {string} path */
async function switchSite(path) {
  if (workspace && workspace.path.toLowerCase() === path.toLowerCase()) return { ok: true };
  const w = /** @type {any} */ (settings.read().workspaces.find((x) => x.path.toLowerCase() === path.toLowerCase()));
  if (!w) return { ok: false, reason: "That site isn't one the app remembers." };
  if (w.kind === 'developer') return openWorkspace(w.path);
  if (!existsSync(join(w.path, 'atiya.json'))) return { ok: false, reason: `${w.name ?? 'That site'} isn't where it was on this computer.` };
  live = w.live ? { state: 'live', url: liveUrl(w.repository, w.url) } : null;
  await openManaged({ path: w.path, name: w.name, repository: w.repository, url: w.url });
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

/** Setting up private pages, while it runs and after (spec F8). @type {{ state: 'running' | 'done' | 'failed', steps: Record<string, { state: string, message: string }>, message?: string } | null} */
let privateRun = null;
/**
 * Who's signed in to GitHub in the app (plan stage 7C): read from the stored token at start and after a sign-in;
 * null when signed out. `checking` until the first answer; `offline` when GitHub couldn't be reached.
 * @type {{ login: string, name: string | null, avatar: string | null } | null}
 */
let account = null;
let accountState = /** @type {'checking' | 'signed-in' | 'signed-out' | 'offline'} */ ('checking');
/** The view to go back to after signing in from the account menu. @type {View} */
let beforeSignIn = 'editor';

/** Reads who the stored token belongs to. */
async function loadAccount() {
  const token = tokens().load();
  if (!token) {
    account = null;
    accountState = 'signed-out';
    return broadcast();
  }
  try {
    const u = await new GitHub({ token, api: github.api, web: github.web }).user();
    account = { login: u.login, name: u.name, avatar: u.avatar };
    accountState = 'signed-in';
  } catch (e) {
    // a token GitHub refuses is forgotten; without a connection the account is unknown for now, and kept
    if (e instanceof GitHubError && e.kind === 'auth') {
      tokens().clear();
      account = null;
      accountState = 'signed-out';
    } else accountState = 'offline';
  }
  broadcast();
}

/** The GitHub repository a checkout's remote names, if it's on GitHub. @param {string} dir @returns {Promise<string | null>} */
function remoteRepository(dir) {
  return new Promise((done) =>
    execFile('git', ['-C', dir, 'remote', 'get-url', 'origin'], { windowsHide: true, timeout: 10_000 }, (err, out) => {
      const r = err ? null : parseRemote(String(out));
      done(r ? `${r.owner}/${r.repo}` : null);
    }),
  );
}

/** Private pages for the open site: not offered, set up already, being set up, or not yet. */
function privatePagesState() {
  if (workspace?.kind !== 'managed') return { state: 'unavailable', steps: {} };
  if (privateRun) return privateRun;
  const ready = existsSync(join(workspace.path, 'private-pages', 'access.json'));
  return { state: ready ? 'ready' : 'idle', steps: {} };
}

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
  flow.on('change', () => {
    // a sign-in during setup is the account's too: the row shows it at once
    const u = flow.s.user;
    if (u && (accountState !== 'signed-in' || account?.login !== u.login)) {
      account = { login: u.login, name: u.name, avatar: u.avatar };
      accountState = 'signed-in';
    }
    broadcast();
  });
  // signed in from the account menu: who it is, and back where it was
  flow.on('signed-in', (/** @type {{ login: string, name: string | null, avatar: string | null }} */ u) => {
    account = u;
    accountState = 'signed-in';
    flow.reset();
    flow.s.mode = 'new';
    if (view === 'setup') show(beforeSignIn);
    broadcast();
  });
}

// ---------- the action center (documentation/desktop/action-center.md §8) ----------

/** Edit mode's last index, for the open site: kept when edit mode can't answer (§5.6). @type {{ site: string, data: any } | null} */
let finderIndex = null;
/** Thumbnails as data: URLs, the last 200 (§8.2). @type {Map<string, string | null>} */
const thumbs = new Map();

/** Opens or closes the panel, giving the frame the keys. @param {'body' | 'frame' | 'menu'} from where the keys were */
function toggleFinder(from) {
  if (!frame || frame.webContents.isDestroyed()) return;
  frame.webContents.focus();
  frame.webContents.send('finder:toggle', from);
}

function applyZoom() {
  if (!body || body.webContents.isDestroyed()) return;
  const z = checkAppSetting('zoom', /** @type {any} */ (settings.read()).zoom ?? 1) ?? 1;
  body.webContents.setZoomFactor(/** @type {number} */ (z));
}

/** @param {unknown} t */
function setTheme(t) {
  const theme = parseTheme(t);
  settings.update((s) => {
    s.theme = theme;
  });
  nativeTheme.themeSource = theme;
  followAppTheme();
  broadcast();
}

async function signIn() {
  if (view !== 'setup') beforeSignIn = view;
  // the device flow shows its code in setup's page; the GitHub CLI's token needs no page unless it fails
  if (flow.d.clientId) show('setup');
  await flow.signInOnly();
  // not signed in (the GitHub CLI isn't, say): setup's page says why and offers it again
  if (accountState !== 'signed-in' && view !== 'setup') show('setup');
}

const serverUp = () => server?.status().state === 'ready' || server?.status().state === 'external';

/**
 * A request to edit mode from the main process: the launch token for a managed site, and what edit mode's guard
 * asks of a write (an X-Editor header, this origin).
 * @param {string} path @param {{ method?: string, body?: unknown, timeout?: number }} [o]
 */
function editFetch(path, o = {}) {
  /** @type {Record<string, string>} */
  const headers = { 'x-editor': '1' };
  if (workspace?.kind === 'managed') headers['x-atiya-launch'] = LAUNCH_TOKEN;
  if (o.body !== undefined) Object.assign(headers, { 'content-type': 'application/json', origin: devOrigin() });
  return fetch(`${devOrigin()}${path}`, { method: o.method ?? 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body), signal: AbortSignal.timeout(o.timeout ?? 8000) });
}

/** Edit mode's index for the open site, fresh; the last one, marked, when edit mode can't answer. */
async function findIndex() {
  const site = workspace?.path ?? '';
  const kept = finderIndex?.site === site ? finderIndex.data : null;
  if (!serverUp()) return { state: 'unavailable', server: server?.status().state ?? null, index: kept };
  try {
    const res = await editFetch('/_edit/api/find');
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    finderIndex = { site, data };
    return { state: 'ready', index: data };
  } catch {
    return { state: 'unavailable', server: server?.status().state ?? null, index: kept };
  }
}

/** A picture's or video's thumbnail, as a data: URL (the frame loads nothing from the dev server). @param {unknown} id */
async function findThumb(id) {
  if (typeof id !== 'string' || !serverUp() || !(finderIndex?.data?.media ?? []).some((/** @type {any} */ m) => m.id === id)) return null;
  const key = `${workspace?.path}|${id}`;
  if (thumbs.has(key)) return thumbs.get(key) ?? null;
  let url = null;
  try {
    const r = await editFetch(`/_edit/api/find/thumb?id=${encodeURIComponent(id)}`);
    const { thumb } = r.ok ? await r.json() : {};
    if (typeof thumb === 'string' && thumb.startsWith('/') && !thumb.startsWith('//')) {
      const img = await editFetch(thumb);
      const type = img.headers.get('content-type') ?? '';
      const bytes = Buffer.from(await img.arrayBuffer());
      if (img.ok && /^image\/(webp|png|jpeg|avif|gif)/.test(type) && bytes.length < 2_000_000) url = `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`;
    }
  } catch {
    // not drawn: the row keeps its icon
  }
  thumbs.set(key, url);
  if (thumbs.size > 200) thumbs.delete(/** @type {string} */ (thumbs.keys().next().value));
  return url;
}

/** One of the app's own actions (§4.2): what its button or menu item does. @param {string} id */
function runAction(id) {
  if (!ACTION_IDS.has(id)) return;
  const up = serverUp();
  if (id === 'show-editor' && up) show('editor');
  else if (id === 'show-site' && up) show('site');
  else if (id === 'open-browser' && up) openExternal(`${devOrigin()}/`);
  else if (id === 'restart') server?.restart();
  else if (id === 'open-live' && live?.url) openExternal(live.url);
  else if (id === 'check' && workspace?.kind === 'managed') show('check');
  else if (id === 'new-page' && up) show('editor', '/_edit/articles/?new=article');
  else if (id === 'new-site') show('welcome');
  else if (id === 'sign-in') signIn();
  else if (id === 'reload') body.webContents.reload();
  else if (id === 'quit') quit();
}

/**
 * Changes a setting from its card (§4.3): the app's own here, the site's through edit mode's store (§8.3).
 * @param {unknown} id @param {unknown} value
 * @returns {Promise<{ ok: true, value: unknown, restarts?: boolean } | { ok: false, message: string, value?: unknown }>}
 */
async function findSet(id, value) {
  if (id === 'theme' || id === 'zoom' || id === 'tray') {
    const v = checkAppSetting(id, value);
    if (v === undefined) return { ok: false, message: "That isn't a value this setting takes." };
    if (id === 'theme') setTheme(v);
    else {
      settings.update((s) => {
        if (id === 'zoom') /** @type {any} */ (s).zoom = v;
        else s.keepInTray = /** @type {boolean} */ (v);
      });
      if (id === 'zoom') applyZoom();
      broadcast();
    }
    return { ok: true, value: v };
  }
  const known = (finderIndex?.data?.settings ?? []).find((/** @type {any} */ s) => s.id === id);
  if (typeof id !== 'string' || !known) return { ok: false, message: 'That setting is no longer there. Search again.' };
  if (!serverUp()) return { ok: false, message: 'Edit mode is starting. Try again when it’s ready.' };
  const before = known.restarts ? await warmMark() : null;
  try {
    const res = await editFetch(`/_edit/api/find/settings/${encodeURIComponent(id)}`, { method: 'PUT', body: { value, version: known.version ?? null }, timeout: 30_000 });
    const r = await res.json().catch(() => ({}));
    if (r.setting) Object.assign(known, r.setting);
    if (!res.ok || !r.ok) {
      const message = res.status === 409 ? 'Changed elsewhere: this is the saved one now.' : (r.issues ?? []).map((/** @type {any} */ i) => i.message).filter(Boolean).join(' ') || "It wasn't saved.";
      return { ok: false, message, value: r.setting?.value ?? known.value };
    }
    if (r.restarts) await waitForRestart(before);
    return { ok: true, value: r.setting?.value ?? value, restarts: !!r.restarts };
  } catch {
    return { ok: false, message: "Edit mode didn't answer. Try again in a moment." };
  }
}

/** The dev server's start mark (`/_edit/__warm`), which a restart changes. */
async function warmMark() {
  try {
    const r = await editFetch('/_edit/__warm', { timeout: 3000 });
    return r.ok ? ((await r.json()).started ?? null) : null;
  } catch {
    return null;
  }
}

/** Waits for edit mode's server to start again after a way to explore changed (up to 90 s). @param {string | null} before */
async function waitForRestart(before) {
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    const now = await warmMark();
    if (now && now !== before) return;
  }
}

/**
 * The panel's channels: the frame's page alone may call them (§8.4).
 * @param {(e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => boolean} fromFrame
 * @param {() => boolean} inEditMode
 */
function finderIpc(fromFrame, inEditMode) {
  ipcMain.handle('finder:index', (e) => (fromFrame(e) ? findIndex() : null));
  ipcMain.handle('finder:thumb', (e, id) => (fromFrame(e) ? findThumb(id) : null));
  ipcMain.handle('finder:set', (e, id, value) => (fromFrame(e) ? findSet(id, value) : null));
  ipcMain.on('finder:remember', (e, key, isPrivate) => {
    if (!fromFrame(e) || !workspace) return;
    const site = workspace.path;
    settings.update((s) => {
      /** @type {any} */ (s).recent = rememberFor(/** @type {any} */ (s).recent ?? {}, site, String(key), isPrivate === true);
    });
    broadcast();
  });
  ipcMain.on('finder:run', (e, raw) => {
    const t = fromFrame(e) ? checkTarget(raw) : null;
    if (!t) return;
    if (t.kind === 'action') return runAction(t.id);
    if (t.kind === 'switch') return void switchSite(t.id);
    if (t.kind === 'command') {
      const cmd = sanitizeCommand({ id: t.id, action: t.value === undefined ? 'click' : 'select', value: t.value });
      if (cmd && studioHeader && inEditMode()) body.webContents.send('studio:command', cmd);
      return body.webContents.focus();
    }
    const to = serverUp() ? addressFor(t, finderIndex?.data) : null;
    if (!to) return;
    show(to.view, to.path);
    body.webContents.focus();
  });
  // the panel closed: the keys go back to the page
  ipcMain.on('finder:closed', (e) => fromFrame(e) && body.webContents.focus());
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
    if (v === 'source' || v === 'welcome' || v === 'publish' || v === 'check' || v === 'private') show(v);
  });
  handle('open:external', (/** @type {string} */ url) => openExternal(String(url)));
  handle('open:browser', () => openExternal(`${devOrigin()}/`));
  handle('open:live', () => live?.url && openExternal(live.url));
  handle('site:check', async () => {
    if (workspace?.kind !== 'managed') return null;
    const token = tokens().load();
    return checkSite(workspace.path, { github: new GitHub({ token, api: github.api, web: github.web }), gitConfigFile: join(app.getPath('userData'), 'gitconfig') });
  });
  handle('private:state', () => privatePagesState());
  handle('private:setup', async () => {
    if (workspace?.kind !== 'managed' || privateRun?.state === 'running') return privatePagesState();
    const dir = workspace.path;
    privateRun = { state: 'running', steps: {} };
    broadcast();
    const r = await runPrivateSetup({
      github: new GitHub({ token: tokens().load(), api: github.api, web: github.web }),
      dir,
      apply: true,
      gitConfigFile: join(app.getPath('userData'), 'gitconfig'),
      emit: (e) => {
        if (e.type !== 'step' || !privateRun) return;
        privateRun.steps[e.step] = { state: e.state, message: e.message };
        broadcast();
      },
    });
    privateRun = { ...privateRun, state: r.ok ? 'done' : 'failed', message: r.message };
    broadcast();
    return privatePagesState();
  });
  // the server reads private-pages/ from its start: it starts again to bring them in
  handle('private:finish', async () => {
    privateRun = null;
    if (server) {
      show('server');
      await server.restart();
    }
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
    // signing in from the account menu goes back where it came from
    const account = flow.s.mode === 'account';
    flow.reset();
    if (account) {
      flow.s.mode = 'new';
      return show(beforeSignIn);
    }
    show('welcome');
  });
  // the title bar's account menu (plan stage 7C)
  handle('account:sign-in', () => signIn());
  handle('account:sign-out', async () => {
    tokens().clear();
    account = null;
    accountState = 'signed-out';
    // forget the user before the reset, whose change would otherwise show it signed in again
    flow.s.user = null;
    flow.gh = null;
    flow.reset();
    broadcast();
    // a managed site's server was given the token for its pushes: it starts again without it
    if (workspace?.kind === 'managed') await openManaged({ path: workspace.path, name: workspace.name, repository: workspace.repository, url: workspace.url });
  });
  handle('site:switch', (/** @type {string} */ path) => switchSite(String(path)));
  // one theme for the whole app (plan stage 7D): every view follows nativeTheme; the site's own pages follow it too
  handle('app:theme', (/** @type {unknown} */ t) => setTheme(t));
  handle('publish:retry', async () => {
    const w = /** @type {any} */ (settings.read().workspaces.find((x) => x.path === workspace?.path));
    if (!w?.repository) return;
    live = { state: 'going' };
    broadcast();
    flow.create({ name: w.name, repo: String(w.repository).split('/')[1], url: w.url, dir: w.path, explore: 'little-planet', samples: true });
  });
}

/** The app's commands: the logo's menu and Alt+Space (the window has no menu bar), and the shortcuts. */
function commands() {
  const custom = windowFrame?.kind === 'custom';
  const report = windowFrame?.state();
  return /** @type {Electron.MenuItemConstructorOptions[]} */ ([
    { label: 'Make a new site', click: () => show('welcome') },
    { label: 'Open a source folder…', accelerator: 'CmdOrCtrl+O', click: () => show('source') },
    // the keys are caught on the views themselves (before-input-event): shown here, never registered twice
    { label: 'Action center', accelerator: 'CmdOrCtrl+/', registerAccelerator: false, click: () => toggleFinder('menu') },
    { type: 'separator' },
    { label: 'Edit mode', accelerator: 'CmdOrCtrl+1', click: () => server && show('editor') },
    { label: 'Site', accelerator: 'CmdOrCtrl+2', click: () => server && show('site') },
    { label: 'Open in browser', click: () => openExternal(`${devOrigin()}/`) },
    { label: 'Restart the dev server', click: () => server?.restart() },
    { type: 'separator' },
    { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => body.webContents.reload() },
    { label: 'Developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => body.webContents.toggleDevTools() },
    ...(custom ? /** @type {Electron.MenuItemConstructorOptions[]} */ ([{ label: 'Full screen', accelerator: 'F11', click: () => windowFrame.toggleFullScreen() }]) : []),
    { type: 'separator' },
    { label: 'Minimize', click: () => win?.minimize() },
    report?.maximized ? { label: 'Restore', click: () => windowFrame.toggleMaximize() } : { label: 'Maximize', click: () => (custom ? windowFrame.toggleMaximize() : win?.maximize()) },
    ...(custom && !report?.maximized && !report?.fullScreen
      ? /** @type {Electron.MenuItemConstructorOptions[]} */ ([
          { label: 'Move with the keyboard', click: () => windowFrame.keyboard('move') },
          { label: 'Size with the keyboard', click: () => windowFrame.keyboard('size') },
        ])
      : []),
    { type: 'separator' },
    { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => quit() },
  ]);
}

/** The app's menu, at a point in the window (CSS px of the frame's page, which covers the window). @param {number} x @param {number} y */
function popupMenu(x, y) {
  if (!win) return;
  Menu.buildFromTemplate(commands()).popup({ window: win, x: Math.round(x), y: Math.round(y) });
}

function menus() {
  // the shortcuts; on Windows and Linux there's no menu bar to show them (the logo opens the same menu)
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Atiya Studio', submenu: commands() }]));
  tray = new Tray(icon('tray.png'));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Atiya Studio', click: () => win?.show() },
      { label: 'Restart the dev server', click: () => server?.restart() },
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
  // a graceful quit, never app.exit(): Chromium writes Local State on its way out, which holds the key
  // safeStorage encrypts the GitHub token with, so the token opens again next time
  app.quit();
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
  // one theme for the whole app, before any view paints (plan stage 7D)
  nativeTheme.themeSource = parseTheme(settings.read().theme);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'fullscreen'));
  // the launch token goes on every request the views make to a managed site's server, and nowhere else
  session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const managed = workspace?.kind === 'managed' && details.url.startsWith(`http://localhost:${SITE_PORT}/`);
    /** @type {Record<string, string>} */
    const headers = managed ? { ...details.requestHeaders, 'X-Atiya-Launch': LAUNCH_TOKEN } : { ...details.requestHeaders };
    // edit mode in the app's view comes without its own header row: the app's row draws it (plan stage 7B)
    if (body && details.webContentsId === body.webContents.id && details.url.startsWith(`${devOrigin()}/`)) headers['X-Atiya-Studio'] = '1';
    cb({ requestHeaders: headers });
  });
  makeFlow();
  bridge();
  createWindow();
  // who's signed in, for the account menu: asked of GitHub once the window is up, never in its way
  loadAccount();
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
