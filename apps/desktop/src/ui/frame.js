// The window the app draws itself and its one title bar row (documentation/desktop/spec.md §7.2, plan stage 7A):
// the logo (the app's menu), the title, Edit mode | Site, Open in browser, the dev server's dot and its popover;
// going live and its actions; the window's controls. It moves and resizes the window by reporting the pointer
// to the main process, which does the rest (core/window/custom-window.mjs). Ported in part from focus-notes.
import { ICONS } from './site/icons.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const win = window.atiya.window;

for (const svg of document.querySelectorAll('svg[data-icon]')) {
  const icon = ICONS[svg.dataset.icon];
  if (!icon) continue;
  svg.setAttribute('viewBox', icon.viewBox);
  svg.innerHTML = icon.body;
}

// ---------- the app's state ----------

const SERVER = {
  idle: ['Edit mode is starting', 'busy'],
  checking: ['Starting edit mode…', 'busy'],
  starting: ['Starting edit mode…', 'busy'],
  ready: ['Edit mode ready', 'good'],
  external: ['Using the server already running', 'good'],
  restarting: ['Restarting edit mode…', 'busy'],
  failed: ['Edit mode stopped', 'bad'],
  'port-busy': ['Port in use', 'bad'],
  stopped: ['Edit mode stopped', 'bad'],
};
const LIVE = { going: ['Going live: about 3 minutes', 'busy'], live: ['Live', 'good'], failed: ["Didn't publish", 'bad'] };
let up = false;

function draw(s) {
  const name = s.workspace?.name ?? 'No site open';
  if ($('site-name').textContent !== name) $('site-name').textContent = name;
  const state = s.server?.state ?? 'idle';
  up = state === 'ready' || state === 'external';
  const [words, tone] = SERVER[state] ?? ['', 'idle'];

  // the dev server: a dot in the bar, its words for screen readers and in the popover
  $('server').hidden = !s.server;
  $('server').setAttribute('aria-label', words);
  $('server').title = words;
  for (const dot of [$('server-dot'), $('server-panel-dot')]) dot.dataset.tone = tone;
  if ($('server-title').textContent !== words) $('server-title').textContent = words;
  $('server-address').textContent = s.devUrl ? s.devUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
  const message = state === 'failed' || state === 'port-busy' ? (s.server?.message ?? '') : state === 'stopped' ? 'Choose Restart to start it again.' : '';
  $('server-message').hidden = !message;
  $('server-message').textContent = message;
  const log = state === 'failed' || state === 'port-busy' || state === 'stopped' ? (s.server?.log ?? []).slice(-8).join('\n') : '';
  $('server-log').hidden = !log;
  if ($('server-log').textContent !== log) $('server-log').textContent = log;
  $('restart').hidden = !s.server || state === 'external';
  $('use').hidden = state !== 'port-busy';

  // what the body shows, and opening it outside
  $('views').setAttribute('aria-disabled', String(!up));
  for (const [id, v] of [['show-editor', 'editor'], ['show-site', 'site']]) {
    const on = up && s.view === v;
    $(id).setAttribute('aria-checked', String(on));
    $(id).disabled = !up;
  }
  const checked = up && s.view === 'site' ? 'show-site' : 'show-editor';
  $('show-editor').tabIndex = checked === 'show-editor' ? 0 : -1;
  $('show-site').tabIndex = checked === 'show-site' ? 0 : -1;
  $('open-browser').disabled = !up;

  // going live, and what to do next
  const [liveWords, liveTone] = up && s.live ? LIVE[s.live.state] : ['', ''];
  const el = $('state');
  if (el.textContent !== liveWords) el.textContent = liveWords;
  if (liveTone) el.dataset.tone = liveTone;
  else delete el.dataset.tone;
  $('open-live').hidden = !(up && s.live?.state === 'live');
  $('see-why').hidden = !(up && s.live?.state === 'failed');
  $('check').hidden = !(up && s.workspace?.kind === 'managed');
}

const choose = (v) => up && window.atiya.show(v);
$('show-editor').addEventListener('click', () => choose('editor'));
$('show-site').addEventListener('click', () => choose('site'));
// a radio group: the arrows move the choice
$('views').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const next = ['ArrowLeft', 'ArrowUp', 'Home'].includes(e.key) ? $('show-editor') : $('show-site');
  next.focus();
  next.click();
});
$('open-browser').addEventListener('click', () => window.atiya.openInBrowser());
$('restart').addEventListener('click', () => {
  closePopover(true);
  window.atiya.restart();
});
$('use').addEventListener('click', () => {
  closePopover(true);
  window.atiya.useExisting();
});
$('open-live').addEventListener('click', () => window.atiya.openLive());
$('see-why').addEventListener('click', () => window.atiya.show('publish'));
$('check').addEventListener('click', () => window.atiya.show('check'));
$('menu').addEventListener('click', () => {
  const r = $('menu').getBoundingClientRect();
  win.menu(r.left, r.bottom);
});

window.atiya.onState(draw);
window.atiya.state().then(draw);

// ---------- popovers: the server's and Snap Layouts, over the body ----------

/** @type {{ panel: HTMLElement, trigger: HTMLElement } | null} */
let open = null;
const GAP = 4;

/** @param {HTMLElement} panel @param {HTMLElement} trigger @param {'start' | 'end'} align */
function openPopover(panel, trigger, align) {
  if (open?.panel === panel) return;
  closePopover(false);
  win.raise(true);
  panel.hidden = false;
  const r = trigger.getBoundingClientRect();
  panel.style.top = `${Math.round(r.bottom + GAP)}px`;
  const width = panel.offsetWidth;
  const left = align === 'end' ? r.right - width : r.left;
  panel.style.left = `${Math.round(Math.max(GAP, Math.min(left, innerWidth - width - GAP)))}px`;
  trigger.setAttribute('aria-expanded', 'true');
  open = { panel, trigger };
}

/** @param {boolean} refocus */
function closePopover(refocus) {
  if (!open) return;
  const { panel, trigger } = open;
  open = null;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  win.raise(false);
  if (refocus) trigger.focus();
}

$('server').addEventListener('click', () => {
  if (open?.panel === $('server-panel')) return closePopover(true);
  openPopover($('server-panel'), $('server'), 'start');
  $('server-panel').focus();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !open) return;
  e.preventDefault();
  closePopover(true);
});
// a press anywhere else closes it (the frame is on top while it's open, so it sees every press)
document.addEventListener('pointerdown', (e) => {
  if (open && !open.panel.contains(e.target) && !open.trigger.contains(e.target)) closePopover(false);
});
document.addEventListener('focusin', (e) => {
  if (open && !open.panel.contains(e.target) && !open.trigger.contains(e.target)) closePopover(false);
});

// ---------- the window ----------

let ws = null;
const LABELS = {
  maximize: 'Maximize',
  left: 'Left half',
  right: 'Right half',
  topLeft: 'Top left quarter',
  topRight: 'Top right quarter',
  bottomLeft: 'Bottom left quarter',
  bottomRight: 'Bottom right quarter',
  leftThird: 'Left third',
  centerThird: 'Middle third',
  rightThird: 'Right third',
};
const LAYOUTS = {
  halves: ['left', 'right'],
  thirds: ['leftThird', 'centerThird', 'rightThird'],
  quarters: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
  maximize: ['maximize'],
};
const LAYOUT_NAMES = { halves: 'Halves', thirds: 'Thirds', quarters: 'Quarters', maximize: 'Whole screen' };

function applyWindow(s) {
  if (!s) return;
  ws = s;
  root.dataset.frame = s.frame;
  root.dataset.margin = s.margin > 0 ? 'rest' : '0';
  root.dataset.maximized = String(s.maximized);
  root.dataset.resizable = String(!s.maximized && !s.fullScreen);
  root.dataset.active = String(s.active);
  $('maximize').setAttribute('aria-label', s.maximized ? 'Restore' : 'Maximize');
  $('maximize').title = s.maximized ? 'Restore' : 'Maximize';
  $('minimize').title = 'Minimize';
  $('close').title = 'Close';
  drawLayouts(s.layouts ?? []);
}

function drawLayouts(layouts) {
  const box = $('layouts');
  const key = layouts.join(',');
  if (box.dataset.for === key) return;
  box.dataset.for = key;
  box.replaceChildren(
    ...layouts.map((l) => {
      const g = document.createElement('div');
      g.className = 'layout';
      g.dataset.layout = l;
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', LAYOUT_NAMES[l] ?? l);
      for (const zone of LAYOUTS[l] ?? []) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'zone';
        b.dataset.zone = zone;
        b.setAttribute('aria-label', LABELS[zone] ?? zone);
        b.title = LABELS[zone] ?? zone;
        g.append(b);
      }
      return g;
    }),
  );
}

$('minimize').addEventListener('click', () => win.minimize());
$('maximize').addEventListener('click', () => {
  closePopover(false);
  if (ws?.maximized) win.restore();
  else win.maximize();
});
$('close').addEventListener('click', () => win.close());

// Snap Layouts: a moment's rest on Maximize, or ↓ on it
let hoverTimer = 0;
const SNAP_DELAY = 400;
const layoutsOpen = () => open?.panel === $('layouts');
const openLayouts = (byKey) => {
  if (!ws?.layouts?.length || ws.fullScreen) return;
  openPopover($('layouts'), $('maximize'), 'end');
  if (byKey) $('layouts').querySelector('button')?.focus();
};
const later = (fn) => {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(fn, SNAP_DELAY);
};
$('maximize').addEventListener('pointerenter', () => (layoutsOpen() ? clearTimeout(hoverTimer) : later(() => openLayouts(false))));
$('maximize').addEventListener('pointerleave', () => (layoutsOpen() ? later(() => layoutsOpen() && closePopover(false)) : clearTimeout(hoverTimer)));
$('layouts').addEventListener('pointerenter', () => clearTimeout(hoverTimer));
$('layouts').addEventListener('pointerleave', () => later(() => layoutsOpen() && closePopover(false)));
$('maximize').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown') return;
  e.preventDefault();
  openLayouts(true);
});
$('layouts').addEventListener('click', (e) => {
  const zone = e.target.closest?.('[data-zone]')?.dataset.zone;
  if (!zone) return;
  closePopover(false);
  win.snap(zone);
});
$('layouts').addEventListener('keydown', (e) => {
  const zones = [...$('layouts').querySelectorAll('button')];
  const i = zones.indexOf(document.activeElement);
  const to = (n) => zones[(n + zones.length) % zones.length]?.focus();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to(i + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to(i - 1);
  else if (e.key === 'Home') to(0);
  else if (e.key === 'End') to(zones.length - 1);
  else return;
  e.preventDefault();
});

// moving by the bar and resizing by the handles: the main process moves the window as the pointer reports
const INTERACTIVE = 'button, a, input, select, textarea, [role="radio"], .popover';
const onBand = (t) => t instanceof Element && Boolean(t.closest('[data-drag-band]')) && !t.closest(INTERACTIVE);
let drag = null;
let frameId = 0;
const send = (phase) => drag && win.drag(phase, drag.kind, drag.x, drag.y, drag.shift);
document.addEventListener('pointerdown', (e) => {
  if (ws?.frame !== 'custom') return;
  const t = e.target instanceof Element ? e.target : null;
  const handle = t?.closest('[data-window-handle]')?.getAttribute('data-window-handle');
  if (!handle && !onBand(t)) return;
  e.preventDefault();
  if (e.button !== 0 || drag) return;
  drag = { id: e.pointerId, kind: handle ?? 'move', x: e.screenX, y: e.screenY, shift: e.shiftKey };
  try {
    t?.setPointerCapture(e.pointerId);
  } catch {
    // not a real pointer (a test's own event): the document still sees its moves
  }
  send('start');
});
document.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.screenX;
  drag.y = e.screenY;
  drag.shift = e.shiftKey;
  // at most one move a frame reaches the main process
  if (!frameId) frameId = requestAnimationFrame(() => ((frameId = 0), send('move')));
});
const end = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  cancelAnimationFrame(frameId);
  frameId = 0;
  send('end');
  drag = null;
};
document.addEventListener('pointerup', end);
document.addEventListener('pointercancel', end);
document.addEventListener('dblclick', (e) => {
  if (ws?.frame === 'custom' && onBand(e.target)) win.toggleMaximize();
});
document.addEventListener('contextmenu', (e) => {
  if (!onBand(e.target)) return;
  e.preventDefault();
  win.menu(e.clientX, e.clientY);
});

// clicks in the shadow margin pass through: the page says when the pointer is near the edges, the main process checks where
let reported = 0;
document.addEventListener('pointermove', (e) => {
  if (ws?.frame !== 'custom' || drag) return;
  const edge = ws.pointerEdge ?? 46;
  const near = e.clientX < edge || e.clientY < edge || e.clientX > innerWidth - edge || e.clientY > innerHeight - edge;
  if (!near || reported) return;
  reported = requestAnimationFrame(() => {
    reported = 0;
    win.pointer();
  });
});
root.addEventListener('pointerleave', () => ws?.frame === 'custom' && win.pointer());

// the snap preview takes the site's accent, light or dark
const probe = document.createElement('span');
probe.className = 'accent-probe';
probe.setAttribute('aria-hidden', 'true');
document.body.append(probe);
const accent = () => win.accent(getComputedStyle(probe).color);
accent();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', accent);

win.onState(applyWindow);
win.state().then(applyWindow);

// ---------- the screen's header, drawn here (plan stage 7B) ----------
// Edit mode describes its header (its title, tools, save status, theme, Save to remote) and keeps it hidden; the
// row draws it with its own controls, and each one asks edit mode to press the original, so they work as they did.

/** @param {string} name */
function glyph(name) {
  const icon = ICONS[name];
  if (!icon) return null;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', icon.viewBox);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.classList.add('glyph');
  s.innerHTML = icon.body;
  return s;
}
const node = (tag, cls) => Object.assign(document.createElement(tag), cls ? { className: cls } : {});
const spinner = () => Object.assign(node('span', 'spin'), { ariaHidden: 'true' });
const STATUS_ICON = { saved: 'success', idle: 'success', dirty: 'edit', failed: 'error', offline: 'error' };
const command = (c) => window.atiya.command(c);

function drawItem(it) {
  if (it.kind === 'text') {
    const s = node('span', it.strong ? 'page-text strong' : 'page-text');
    if (it.busy) s.append(spinner());
    s.append(it.text);
    return s;
  }
  if (it.kind === 'tag') {
    const s = node('span', 'page-tag');
    if (it.tone) s.dataset.tone = it.tone;
    const g = it.icon && glyph(it.icon);
    if (g) s.append(g);
    s.append(it.text);
    return s;
  }
  if (it.kind === 'status') {
    // edit mode's own line is hidden with its header, so this one is heard instead
    const s = node('span', 'page-status');
    s.dataset.state = it.state ?? 'idle';
    const mark = it.state === 'saving' ? spinner() : glyph(STATUS_ICON[it.state] ?? 'success');
    if (mark) {
      mark.setAttribute?.('aria-hidden', 'true');
      s.append(mark);
    }
    const t = node('span');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.textContent = it.text ?? '';
    s.append(t);
    return s;
  }
  const b = node('button');
  b.type = 'button';
  b.dataset.id = it.id;
  if (it.kind === 'select') {
    const chosen = it.options.find((o) => o.value === it.value) ?? it.options[0];
    b.className = 'page-icon';
    b.setAttribute('aria-label', `${it.label}: ${chosen?.label ?? ''}`);
    b.title = it.label;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', 'choices');
    const g = chosen?.icon && glyph(chosen.icon);
    if (g) b.append(g);
    b.addEventListener('click', () => (open?.panel === $('choices') ? closePopover(true) : openChoices(it, b)));
    return b;
  }
  const inContext = it.kind === 'link' && !it.icon;
  b.className = inContext ? 'page-link' : it.text ? 'page-button' : 'page-icon';
  if (it.variant) b.dataset.variant = it.variant;
  if (it.tone) b.dataset.tone = it.tone;
  const g = it.icon && glyph(it.icon);
  if (g) b.append(g);
  if (it.text) b.append(Object.assign(node('span'), { textContent: it.text }));
  if (!it.text || it.text !== it.label) b.setAttribute('aria-label', it.label);
  b.title = it.label;
  if (typeof it.pressed === 'boolean') b.setAttribute('aria-pressed', String(it.pressed));
  b.disabled = Boolean(it.disabled);
  b.addEventListener('click', () => command({ id: it.id, action: 'click' }));
  return b;
}

function openChoices(it, trigger) {
  const box = $('choices');
  box.setAttribute('aria-label', it.label);
  box.replaceChildren(
    ...it.options.map((o) => {
      const b = node('button', 'choice');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(o.value === it.value));
      const g = o.icon && glyph(o.icon);
      if (g) b.append(g);
      b.append(Object.assign(node('span'), { textContent: o.label }));
      b.addEventListener('click', () => {
        closePopover(true);
        command({ id: it.id, action: 'select', value: o.value });
      });
      return b;
    }),
  );
  openPopover(box, trigger, 'end');
  (box.querySelector('[aria-checked="true"]') ?? box.querySelector('button'))?.focus();
}
$('choices').addEventListener('keydown', (e) => {
  const items = [...$('choices').querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  const to = (n) => items[(n + items.length) % items.length]?.focus();
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to(i + 1);
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to(i - 1);
  else if (e.key === 'Home') to(0);
  else if (e.key === 'End') to(items.length - 1);
  else return;
  e.preventDefault();
});

function drawHeader(h) {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.id : undefined;
  $('page-context').replaceChildren(...(h?.context ?? []).map(drawItem));
  $('page-controls').replaceChildren(...(h?.controls ?? []).map(drawItem));
  $('page-controls').hidden = !h?.controls?.length;
  // the row follows the theme chosen in edit mode
  root.style.colorScheme = h?.theme === 'light' || h?.theme === 'dark' ? h.theme : '';
  if (h?.busy) root.dataset.busy = 'on';
  else delete root.dataset.busy;
  if (focused) document.querySelector(`[data-id="${CSS.escape(focused)}"]`)?.focus();
  // a popover whose trigger was drawn again follows the new one
  if (open && !open.trigger.isConnected) open.trigger = document.querySelector(`[data-id="${CSS.escape(open.trigger.dataset.id ?? '')}"]`) ?? $('page-controls');
  accent();
}
window.atiya.onHeader(drawHeader);
window.atiya.header().then(drawHeader);

// a full row: squeeze until the screen's title has room (frame.css), one step at a time; the words of a squeezed
// status stay in its name
const ROOM = 256;
function squeeze() {
  delete root.dataset.squeeze;
  const ctx = $('page-context');
  for (const level of ['1', '2']) {
    if (!ctx.childElementCount || ctx.getBoundingClientRect().width >= ROOM) return;
    root.dataset.squeeze = level;
  }
}
new ResizeObserver(squeeze).observe($('window'));
window.atiya.onHeader(() => requestAnimationFrame(squeeze));
