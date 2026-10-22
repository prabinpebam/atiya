// @ts-check
// What the action center finds (documentation/desktop/action-center.md §4): the app's actions and settings, the
// screen's own controls, and edit mode's content, as results. Pure: the frame's panel draws them, the main
// process checks what's asked of it against the same lists, and the tests read both.

/**
 * @typedef {{ value: string, label: string }} Choice
 * @typedef {{ control: 'switch' } | { control: 'choice', options: Choice[] } | { control: 'slider', min: number, max: number, step: number, unit: string } | { control: 'text', max: number }} Control
 * @typedef {{ kind: 'action', id: string } | { kind: 'command', id: string, value?: string } | { kind: 'setting', id: string } | { kind: 'page' | 'album' | 'section' | 'media' | 'go', id: string } | { kind: 'switch', id: string } | { kind: 'sign-out' }} Target
 * @typedef {import('./find-rank.mjs').FindItem & {
 *   icon: string, about?: string, target: Target, second?: { label: string, keys: string },
 *   setting?: { value: unknown, version?: string | null, screen?: string, restarts?: boolean } & Control,
 *   facts?: string[], picture?: string | null, private?: boolean, needsEdit?: boolean, open?: string,
 * }} Result
 */

/** A zoom between half and twice the size, in steps of a tenth (§4.3). */
export const ZOOM = { min: 0.5, max: 2, step: 0.1 };
const THEMES = /** @type {Choice[]} */ ([
  { value: 'system', label: 'Match the system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]);

/**
 * The app's actions (§4.2): each is what the app's own button does. `when` keeps one out while it can't run;
 * `needsEdit` keeps it in, saying it waits for edit mode.
 * @type {{ id: string, title: string, words: string[], about: string, icon: string, open: string, keys?: string, needsEdit?: boolean, when?: (s: any) => boolean }[]}
 */
export const ACTIONS = [
  { id: 'show-editor', title: 'Show edit mode', words: ['editor', 'write', 'edit'], about: 'Edit your pages, sections and pictures.', icon: 'edit', open: 'Show', keys: 'Ctrl+1', needsEdit: true },
  { id: 'show-site', title: 'Show the site', words: ['preview', 'view', 'website'], about: 'See the site as its visitors will.', icon: 'preview', open: 'Show', keys: 'Ctrl+2', needsEdit: true },
  { id: 'open-browser', title: 'Open in browser', words: ['browser', 'chrome', 'edge', 'external'], about: 'Open the site in your web browser.', icon: 'external', open: 'Open', needsEdit: true },
  { id: 'restart', title: 'Restart edit mode', words: ['server', 'restart', 'reload', 'stuck'], about: "Start edit mode's server again. Your pages are kept.", icon: 'redo', open: 'Restart', when: (s) => !!s.server && s.server.state !== 'external' },
  { id: 'open-live', title: 'Open my live site', words: ['live', 'public', 'github pages'], about: 'Open the site where its visitors see it.', icon: 'external', open: 'Open', when: (s) => s.live?.state === 'live' },
  { id: 'check', title: 'Check my site', words: ['check', 'health', 'problems'], about: 'See whether everything about the site is working.', icon: 'success', open: 'Check', when: (s) => s.workspace?.kind === 'managed' },
  { id: 'new-page', title: 'New page', words: ['create', 'add', 'write', 'article', 'new article'], about: 'Start a page: it opens in Pages, ready to name.', icon: 'plus', open: 'Start', needsEdit: true },
  { id: 'new-site', title: 'Make a new site', words: ['new site', 'setup', 'create site'], about: 'Set up another site of your own, from the start.', icon: 'plus', open: 'Start' },
  { id: 'sign-in', title: 'Sign in with GitHub', words: ['account', 'github', 'log in', 'login'], about: 'GitHub keeps your site and publishes it.', icon: 'sign-in', open: 'Sign in', when: (s) => s.account?.state === 'signed-out' },
  { id: 'reload', title: 'Reload', words: ['refresh'], about: 'Load what the window shows again.', icon: 'redo', open: 'Reload' },
  { id: 'quit', title: 'Quit Atiya Studio', words: ['exit', 'close'], about: 'Close the app. Edit mode stops too.', icon: 'sign-out', open: 'Quit' },
];
/** What the main process will run for an action. */
export const ACTION_IDS = new Set(ACTIONS.map((a) => a.id));

/**
 * The app's actions that apply now, and one to switch to each other remembered site.
 * @param {any} s the app's state
 * @returns {Result[]}
 */
export function appActions(s) {
  const up = s.server?.state === 'ready' || s.server?.state === 'external';
  /** @type {Result[]} */
  const out = ACTIONS.filter((a) => !a.when || a.when(s)).map((a) => ({
    key: `action:${a.id}`,
    group: 'actions',
    title: a.title,
    words: a.words,
    about: a.about,
    icon: a.icon,
    open: a.open,
    target: { kind: 'action', id: a.id },
    ...(a.keys ? { detail: a.keys, facts: [a.keys] } : {}),
    ...(a.needsEdit && !up ? { needsEdit: true } : {}),
  }));
  if (s.account?.state === 'signed-in')
    out.push({ key: 'action:sign-out', group: 'actions', title: 'Sign out of GitHub', words: ['account', 'github', 'log out', 'logout'], about: `Signed in as ${s.account.login}. You'll be asked first.`, icon: 'sign-out', open: 'Sign out', target: { kind: 'sign-out' } });
  for (const site of s.sites ?? [])
    if (!site.current)
      out.push({ key: `switch:${site.path}`, group: 'actions', title: `Switch to ${site.name}`, words: ['site', 'open', 'switch'], detail: site.address ?? '', about: 'Open this site instead. Edit mode starts again with its pages.', icon: 'home', open: 'Switch', target: { kind: 'switch', id: site.path } });
  return out;
}

/**
 * The app's own settings (§4.3), with their cards' controls and values.
 * @param {any} s the app's state
 * @returns {Result[]}
 */
export function appSettings(s) {
  const prefs = s.prefs ?? {};
  return [
    {
      key: 'setting:theme',
      group: 'settings',
      title: 'Colour theme',
      words: ['dark', 'light', 'mode', 'colour', 'color', 'appearance', 'night'],
      detail: THEMES.find((t) => t.value === s.theme)?.label ?? 'Match the system',
      about: "The whole app's colours: the title bar, edit mode and the site.",
      icon: s.theme === 'dark' ? 'theme-dark' : s.theme === 'light' ? 'theme-light' : 'theme-system',
      target: { kind: 'setting', id: 'theme' },
      setting: { control: 'choice', options: THEMES, value: s.theme ?? 'system' },
    },
    {
      key: 'setting:zoom',
      group: 'settings',
      title: 'Zoom',
      words: ['size', 'text size', 'larger', 'smaller', 'bigger', 'scale', 'magnify'],
      detail: `${Math.round((prefs.zoom ?? 1) * 100)}%`,
      about: "Makes edit mode, the site and the app's pages larger or smaller. The title bar keeps its size.",
      icon: 'expand',
      target: { kind: 'setting', id: 'zoom' },
      setting: { control: 'slider', min: ZOOM.min * 100, max: ZOOM.max * 100, step: ZOOM.step * 100, unit: '%', value: Math.round((prefs.zoom ?? 1) * 100) },
    },
    {
      key: 'setting:tray',
      group: 'settings',
      title: 'Keep running in the tray',
      words: ['tray', 'background', 'close', 'minimize', 'notification area'],
      detail: prefs.keepInTray === false ? 'Off' : 'On',
      about: 'Closing the window leaves Atiya Studio and edit mode running in the tray, ready to open again.',
      icon: 'settings',
      target: { kind: 'setting', id: 'tray' },
      setting: { control: 'switch', value: prefs.keepInTray !== false },
    },
  ];
}

/**
 * The current screen's own controls (§4.1, This screen): every button and link of the row, and each choice of
 * its menus, from edit mode's description of its header (desktop spec §7.2).
 * @param {import('../core/studio-header.mjs').StudioHeader | null} h
 * @returns {Result[]}
 */
export function screenControls(h) {
  /** @type {Result[]} */
  const out = [];
  for (const it of h?.controls ?? []) {
    if (!it.id || it.disabled) continue;
    if (it.kind === 'button' || it.kind === 'link')
      out.push({ key: `screen:${it.label}`, group: 'screen', title: it.label ?? '', icon: it.icon ?? 'focus', about: 'A control of the screen you are on.', open: 'Press', target: { kind: 'command', id: it.id } });
    if (it.kind === 'select')
      for (const o of it.options ?? [])
        out.push({ key: `screen:${it.label}:${o.value}`, group: 'screen', title: `${it.label}: ${o.label}`, detail: o.value === it.value ? 'Chosen now' : '', icon: o.icon ?? 'focus', about: 'A choice on the screen you are on.', open: 'Choose', target: { kind: 'command', id: it.id, value: o.value } });
  }
  return out;
}

/**
 * Edit mode's content (§4.1, §8.2) as results.
 * @param {any} index edit mode's answer to GET /_edit/api/find
 * @returns {Result[]}
 */
export function contentResults(index) {
  if (!index) return [];
  /** @type {Result[]} */
  const out = [];
  for (const p of index.pages ?? [])
    out.push({
      key: `page:${p.id}`,
      group: 'pages',
      title: p.title,
      words: [p.summary ?? '', p.kindLabel ?? '', p.statusLabel ?? ''],
      detail: [p.section?.title ?? 'Not in a section', p.statusLabel, p.private ? 'Private' : ''].filter(Boolean).join(' · '),
      text: p.text ?? '',
      about: p.summary ?? '',
      icon: 'page',
      facts: [p.kindLabel, p.statusLabel, p.private ? 'Private' : ''].filter(Boolean),
      picture: p.picture ?? null,
      private: !!p.private,
      open: 'Edit page',
      target: { kind: 'page', id: p.id },
      ...(p.path ? { second: { label: 'View on site', keys: 'Ctrl+Enter' } } : {}),
    });
  for (const a of index.albums ?? [])
    out.push({
      key: `album:${a.id}`,
      group: 'pages',
      title: a.title,
      words: [a.summary ?? '', 'album', 'gallery', 'photos', a.statusLabel ?? ''],
      detail: ['Album', `${a.items} ${a.items === 1 ? 'item' : 'items'}`, a.statusLabel, a.private ? 'Private' : ''].filter(Boolean).join(' · '),
      about: a.summary ?? '',
      icon: 'collection',
      facts: ['Album', a.statusLabel, a.private ? 'Private' : ''].filter(Boolean),
      picture: a.picture ?? null,
      private: !!a.private,
      open: 'Edit album',
      target: { kind: 'album', id: a.id },
      ...(a.path ? { second: { label: 'View on site', keys: 'Ctrl+Enter' } } : {}),
    });
  for (const s of index.sections ?? [])
    out.push({
      key: `section:${s.id}`,
      group: 'sections',
      title: s.title,
      words: ['section'],
      detail: `${s.pages} ${s.pages === 1 ? 'page' : 'pages'}`,
      about: s.path,
      icon: 'sections',
      open: 'Open in Sections',
      target: { kind: 'section', id: s.id },
      ...(s.path ? { second: { label: 'View on site', keys: 'Ctrl+Enter' } } : {}),
    });
  for (const m of index.media ?? [])
    out.push({
      key: `media:${m.id}`,
      group: 'media',
      title: m.title || m.caption || m.id.split('/').pop(),
      words: [m.caption ?? '', m.id, m.kind === 'video' ? 'video' : 'picture image photo'],
      detail: m.ownerLabel ?? '',
      about: m.caption ?? '',
      icon: m.kind === 'video' ? 'video' : 'image',
      facts: [m.kind === 'video' ? 'Video' : 'Picture', !m.title && !m.decorative && m.kind !== 'video' ? 'No alt text' : '', m.private ? 'Private' : '', m.width && m.height ? `${m.width} × ${m.height}` : ''].filter(Boolean),
      picture: m.id,
      private: !!m.private,
      open: 'Open in Media',
      target: { kind: 'media', id: m.id },
    });
  for (const g of index.screens ?? [])
    out.push({ key: `go:${g.id}`, group: 'go', title: g.label, words: g.words ?? [], about: g.about ?? '', icon: g.icon ?? 'focus', open: `Go to ${g.label}`, target: { kind: 'go', id: g.id } });
  for (const st of index.settings ?? [])
    out.push({
      key: `setting:${st.id}`,
      group: 'settings',
      title: st.title,
      words: st.words ?? [],
      detail: st.control === 'switch' ? (st.value ? 'On' : 'Off') : String(st.value ?? ''),
      about: st.about ?? '',
      icon: st.icon ?? 'settings',
      target: { kind: 'setting', id: st.id },
      setting: st.control === 'switch' ? { control: 'switch', value: !!st.value, version: st.version, screen: st.screen, restarts: !!st.restarts } : { control: 'text', max: st.max ?? 200, value: String(st.value ?? ''), version: st.version, screen: st.screen },
      ...(st.screen ? { second: { label: `Open in ${st.screenLabel ?? 'Settings'}`, keys: 'Ctrl+Enter' } } : {}),
    });
  return out;
}

/** What's suggested before anything's typed (§6.3), by key, when it's there. */
export const SUGGESTED = ['action:new-page', 'go:articles', 'go:media', 'setting:theme', 'go:publish'];

/**
 * An app setting's new value, checked; undefined when it isn't one.
 * @param {string} id @param {unknown} v
 */
export function checkAppSetting(id, v) {
  if (id === 'theme') return THEMES.some((t) => t.value === v) ? v : undefined;
  if (id === 'tray') return typeof v === 'boolean' ? v : undefined;
  if (id === 'zoom') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    const z = Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, v)) * 10) / 10;
    return z;
  }
  return undefined;
}
