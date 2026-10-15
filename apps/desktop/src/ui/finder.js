// The action center (documentation/desktop/action-center.md): Ctrl+/ anywhere opens one panel to find anything and
// do anything. The results come from the app's state, the row's header (the screen's own controls) and edit
// mode's index; finding and ordering are find-rank.mjs's, what's found is find-catalogue.mjs's. The main process
// does what's chosen: the panel names a result, never an address.
import { group, prepare, search } from './find-rank.mjs';
import { appActions, appSettings, contentResults, screenControls, SUGGESTED } from './find-catalogue.mjs';

const LABELS = { top: 'Top hit', recent: 'Recent', suggested: 'Suggested', actions: 'Actions', screen: 'This screen', settings: 'Settings', pages: 'Pages', sections: 'Sections', media: 'Pictures and videos', go: 'Go to' };
const NOUNS = { actions: 'actions', screen: 'controls', settings: 'settings', pages: 'pages', sections: 'sections', media: 'pictures and videos', go: 'screens' };
const NAVIGATES = new Set(['page', 'section', 'media', 'go', 'switch', 'command']);
const NAVIGATING_ACTIONS = new Set(['show-editor', 'show-site', 'new-page', 'check', 'new-site', 'sign-in']);
const READY = new Set(['ready', 'external']);

/**
 * @param {{ glyph: (name: string) => SVGElement | null, closePopovers: () => void, signOut: () => void }} o
 */
export function initFinder(o) {
  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const panel = $('finder');
  const input = /** @type {HTMLInputElement} */ ($('finder-input'));
  const list = $('finder-results');
  const card = $('finder-card');
  const note = $('finder-note');
  const hints = $('finder-hints');
  const live = $('finder-live');
  const clear = $('finder-clear');
  const findButton = $('find');
  const f = window.atiya.finder;
  const node = (tag, cls) => Object.assign(document.createElement(tag), cls ? { className: cls } : {});

  /** @type {any} */
  let state = null;
  let header = null;
  /** @type {{ state: string, server?: string | null, index: any }} */
  let content = { state: 'unavailable', index: null };
  /** @type {ReturnType<typeof prepare>} */
  let prepared = [];
  let byKey = new Map();
  let stale = true;
  let stateSig = '';
  /** @type {{ r: any, found?: any }[]} */
  let rows = [];
  let active = -1;
  let opener = 'frame';
  /** @type {HTMLElement | null} */
  let returnTo = null;
  let lastQuery = '';
  let announceTimer = 0;
  /** What the card's status line last said, and for which result. */
  let said = { key: /** @type {string | null} */ (null), text: '', tone: '' };
  /** @type {Map<string, Promise<string | null>>} */
  const thumbs = new Map();

  function rebuild() {
    const all = [...appActions(state ?? {}), ...screenControls(header), ...appSettings(state ?? {}), ...contentResults(content.index)];
    byKey = new Map(all.map((r) => [r.key, r]));
    prepared = prepare(all);
    stale = false;
  }
  const refresh = () => {
    stale = true;
    if (!panel.hidden) {
      rebuild();
      render(true);
    }
  };

  /** Only what the results show: the server's log lines change the state often, and mean nothing here. */
  const signature = (s) => JSON.stringify([s?.server?.state, s?.theme, s?.prefs, s?.recent, s?.sites, s?.account?.state, s?.account?.login, s?.live?.state, s?.workspace?.kind, s?.workspace?.path]);
  const onState = (s) => {
    const sig = signature(s);
    const site = state?.workspace?.path;
    state = s;
    if (sig === stateSig) return;
    stateSig = sig;
    // another site: its index isn't this one's
    if (site !== s?.workspace?.path) {
      content = { state: 'unavailable', index: null };
      thumbs.clear();
    }
    refresh();
  };
  window.atiya.onState(onState);
  window.atiya.state().then(onState);
  const onHeader = (h) => {
    header = h;
    refresh();
  };
  window.atiya.onHeader(onHeader);
  window.atiya.header().then(onHeader);

  async function loadIndex() {
    const r = await f.index();
    if (!r) return;
    content = r;
    refresh();
  }

  // ---------- opening and closing ----------

  function openPanel(from) {
    performance.mark('finder:open:start');
    opener = from;
    returnTo = from === 'button' ? findButton : from === 'frame' && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    o.closePopovers();
    window.atiya.window.raise(true);
    panel.hidden = false;
    findButton.setAttribute('aria-expanded', 'true');
    if (stale) rebuild();
    input.value = lastQuery;
    render(false);
    input.focus();
    input.select();
    // drawn with its results: the spec's 50 ms (§8.7), measured by the tests
    performance.measure('finder:open', 'finder:open:start');
    loadIndex();
  }

  /** @param {boolean} refocus give the keys back where they were (not when a result opens something) */
  function closePanel(refocus) {
    if (panel.hidden) return;
    lastQuery = input.value;
    panel.hidden = true;
    findButton.setAttribute('aria-expanded', 'false');
    window.atiya.window.raise(false);
    if (!refocus) return;
    if (opener === 'body' || opener === 'menu' || !returnTo?.isConnected) {
      if (opener === 'button' || opener === 'frame') findButton.focus();
      else f.closed();
    } else returnTo.focus();
  }

  f.onToggle((from) => (panel.hidden ? openPanel(from ?? 'body') : closePanel(true)));
  // the main process catches Ctrl+/ before any page sees it; this is for keys that reach the frame's page without
  // passing it (an automation's)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'Slash' || e.key === '/')) {
      e.preventDefault();
      if (panel.hidden) openPanel('frame');
      else closePanel(true);
    }
  });
  findButton.addEventListener('click', () => (panel.hidden ? openPanel('button') : closePanel(true)));
  // a press outside closes it (the frame is on top while it's open, so it sees every press); the press decides
  // where focus goes, as for the bar's popovers, except that keys taken from the body go back to it
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (panel.hidden || panel.contains(/** @type {Node} */ (e.target)) || findButton.contains(/** @type {Node} */ (e.target))) return;
      const fromBody = opener === 'body' || opener === 'menu';
      closePanel(false);
      if (fromBody) f.closed();
    },
    true,
  );

  // ---------- the results ----------

  /** The title with what matched in bold. @param {string} title @param {[number, number][]} [marks] */
  function titleWith(title, marks = []) {
    const s = node('span', 'finder-title');
    let at = 0;
    for (const [a, b] of marks) {
      if (a > at) s.append(title.slice(at, a));
      s.append(Object.assign(node('b'), { textContent: title.slice(a, b) }));
      at = b;
    }
    if (at < title.length) s.append(title.slice(at));
    return s;
  }

  /** A picture's thumbnail, asked for once, as it's drawn. @param {string} id */
  function thumb(id) {
    if (!thumbs.has(id)) thumbs.set(id, f.thumb(id).catch(() => null));
    return /** @type {Promise<string | null>} */ (thumbs.get(id));
  }
  /** @param {HTMLElement} box @param {string} id */
  function fillThumb(box, id) {
    thumb(id).then((url) => {
      if (!url || !box.isConnected) return;
      const img = document.createElement('img');
      img.alt = '';
      img.src = url;
      box.replaceChildren(img);
    });
  }

  function iconBox(r, cls) {
    const box = node('span', cls);
    box.setAttribute('aria-hidden', 'true');
    const g = o.glyph(r.icon) ?? o.glyph('focus');
    if (g) box.append(g);
    if (r.picture) fillThumb(box, r.picture);
    return box;
  }

  function rowEl(r, found, i) {
    const el = node('div', 'finder-row');
    el.id = `finder-option-${i}`;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.append(iconBox(r, 'finder-icon'));
    const text = node('span', 'finder-text');
    text.append(titleWith(r.title, found?.marks));
    if (r.detail) text.append(Object.assign(node('span', 'finder-detail'), { textContent: r.detail }));
    el.append(text);
    // the field keeps the keys while the pointer chooses
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('pointermove', () => active !== i && choose(i));
    el.addEventListener('click', () => {
      choose(i);
      // a setting is chosen and its control focused: a stray click never changes it (D5)
      if (r.setting) focusControl();
      else activate(r, false);
    });
    return el;
  }

  /** @param {boolean} keep keep the chosen result if it's still there */
  function render(keep) {
    const q = input.value;
    clear.hidden = !q;
    const keepKey = keep ? rows[active]?.r.key : undefined;
    /** @type {{ id: string, more?: number, items: { r: any, found?: any }[] }[]} */
    let sections = [];
    let total = 0;
    if (!q.trim()) {
      const recent = (state?.recent ?? []).map((k) => byKey.get(k)).filter(Boolean).slice(0, 5);
      const suggested = SUGGESTED.map((k) => byKey.get(k)).filter((r) => r && !recent.includes(r));
      if (recent.length) sections.push({ id: 'recent', items: recent.map((r) => ({ r })) });
      if (suggested.length) sections.push({ id: 'suggested', items: suggested.map((r) => ({ r })) });
    } else {
      const found = search(prepared, q, { recent: state?.recent ?? [] });
      total = found.length;
      const g = group(found);
      if (g.top) sections.push({ id: 'top', items: [{ r: g.top.item, found: g.top }] });
      for (const x of g.groups) sections.push({ id: x.id, more: x.more, items: x.items.map((f) => ({ r: f.item, found: f })) });
    }
    rows = sections.flatMap((s) => s.items);
    let i = 0;
    list.replaceChildren(
      ...sections.map((s) => {
        const g = node('div', 'finder-group');
        g.setAttribute('role', 'group');
        const h = node('div', 'finder-heading');
        h.id = `finder-group-${s.id}`;
        h.setAttribute('role', 'presentation');
        h.textContent = LABELS[s.id] ?? s.id;
        if (s.more) {
          h.append(' ', Object.assign(node('span', 'finder-more'), { textContent: `· ${s.more} more` }));
          g.setAttribute('aria-label', `${LABELS[s.id]}, ${s.more} more ${NOUNS[s.id] ?? ''}: type more to narrow them`);
        } else g.setAttribute('aria-labelledby', h.id);
        g.append(h, ...s.items.map((it) => rowEl(it.r, it.found, i++)));
        return g;
      }),
    );
    drawNote(q);
    const at = keepKey ? rows.findIndex((x) => x.r.key === keepKey) : -1;
    choose(at >= 0 ? at : rows.length ? 0 : -1, { keepCard: at >= 0 && card.contains(document.activeElement) });
    clearTimeout(announceTimer);
    if (q.trim()) announceTimer = window.setTimeout(() => (live.textContent = total ? `${total} ${total === 1 ? 'result' : 'results'}` : 'No results'), 500);
  }

  function drawNote(q) {
    const parts = [];
    if (q.trim() && !rows.length) parts.push(Object.assign(node('p'), { textContent: `Nothing matches “${q.trim()}”. Try fewer letters or another word.` }));
    if (!q.trim() && !rows.length) parts.push(Object.assign(node('p'), { textContent: 'Type to find pages, pictures, settings and actions.' }));
    if (state?.workspace && content.state !== 'ready') {
      const p = node('p');
      p.textContent = content.index ? 'From before edit mode stopped: pages and pictures may have changed.' : 'Pages, pictures and site settings appear when edit mode is ready.';
      parts.push(p);
      const s = state?.server?.state;
      if (s === 'failed' || s === 'stopped' || s === 'port-busy') {
        const b = node('button');
        b.type = 'button';
        b.textContent = 'Restart edit mode';
        b.addEventListener('click', () => {
          f.run({ kind: 'action', id: 'restart' });
          closePanel(true);
        });
        parts.push(b);
      }
    }
    note.replaceChildren(...parts);
    note.hidden = !parts.length;
  }

  /** @param {number} i @param {{ keepCard?: boolean }} [opt] */
  function choose(i, opt = {}) {
    if (rows[i]?.r.key !== said.key) said = { key: null, text: '', tone: '' };
    active = i;
    for (const el of list.querySelectorAll('[role="option"]')) el.setAttribute('aria-selected', String(el.id === `finder-option-${i}`));
    const el = i >= 0 ? document.getElementById(`finder-option-${i}`) : null;
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
    if (!opt.keepCard) drawCard(rows[i]?.r, rows[i]?.found);
    drawHints(rows[i]?.r);
  }

  function move(by) {
    if (!rows.length) return;
    choose((active + by + rows.length) % rows.length);
  }

  /** The first result of the next or previous group. @param {1 | -1} dir */
  function jumpGroup(dir) {
    const firsts = [...list.querySelectorAll('[role="group"]')].map((g) => Number(g.querySelector('[role="option"]')?.id.split('-').pop()));
    if (!firsts.length) return;
    const now = firsts.filter((n) => n <= active).length - 1;
    const next = Math.max(0, Math.min(firsts.length - 1, now + dir));
    choose(firsts[next]);
  }

  // ---------- the card ----------

  function drawCard(r, found) {
    if (!r) {
      card.replaceChildren();
      card.removeAttribute('role');
      card.removeAttribute('aria-labelledby');
      return;
    }
    const parts = [];
    if (r.picture) {
      const pic = iconBox(r, 'finder-picture');
      parts.push(pic);
    } else parts.push(iconBox(r, 'finder-card-icon'));
    const h = Object.assign(node('h2'), { id: 'finder-card-title', textContent: r.title });
    parts.push(h);
    if (r.facts?.length) {
      const ul = node('ul', 'finder-facts');
      ul.append(...r.facts.map((t) => Object.assign(node('li'), { textContent: t })));
      parts.push(ul);
    }
    const about = node('p', 'finder-about');
    if (found?.snippet) about.append(...marked(found.snippet, input.value));
    else about.textContent = r.about ?? '';
    if (about.textContent) parts.push(about);
    if (r.setting) parts.push(controlFor(r));
    const status = node('p', 'finder-status');
    status.id = 'finder-status';
    if (r.needsEdit) status.textContent = 'Waits for edit mode to be ready.';
    else if (said.key === r.key) {
      status.textContent = said.text;
      if (said.tone) status.dataset.tone = said.tone;
    }
    parts.push(status);
    const actions = node('div', 'finder-actions');
    if (!r.setting) {
      const b = keyButton(r.open ?? 'Open', 'Enter', true);
      b.disabled = !!r.needsEdit;
      b.addEventListener('click', () => activate(r, false));
      actions.append(b);
    }
    if (r.second) {
      const b = keyButton(r.second.label, 'Ctrl+Enter', false);
      b.addEventListener('click', () => activate(r, true));
      actions.append(b);
    }
    if (actions.childElementCount) parts.push(actions);
    card.replaceChildren(...parts);
    card.setAttribute('role', 'region');
    card.setAttribute('aria-labelledby', h.id);
  }

  /** The words typed, marked in a line of the body. @param {string} text @param {string} q */
  function marked(text, q) {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!words.length) return [text];
    const out = [];
    let at = 0;
    for (const m of text.matchAll(new RegExp(words.join('|'), 'gi'))) {
      if (m.index > at) out.push(text.slice(at, m.index));
      out.push(Object.assign(node('mark'), { textContent: m[0] }));
      at = m.index + m[0].length;
    }
    out.push(text.slice(at));
    return out;
  }

  function keyButton(label, keys, primary) {
    const b = node('button', primary ? 'primary' : '');
    b.type = 'button';
    b.append(label, Object.assign(node('kbd'), { textContent: keys }));
    b.setAttribute('aria-keyshortcuts', keys === 'Enter' ? 'Enter' : 'Control+Enter');
    return b;
  }

  function status(text, tone) {
    // kept for the chosen result, so a card drawn again (the setting's new value arriving) still says it
    said = { key: rows[active]?.r.key ?? null, text, tone };
    const s = document.getElementById('finder-status');
    if (!s) return;
    s.textContent = text;
    if (tone) s.dataset.tone = tone;
    else delete s.dataset.tone;
  }

  const valueWords = (r, v) => (r.setting.control === 'switch' ? (v ? 'On' : 'Off') : r.setting.control === 'choice' ? (r.setting.options.find((x) => x.value === v)?.label ?? String(v)) : r.setting.control === 'slider' ? `${Math.round(Number(v) * 100)}%` : String(v));

  /**
   * Changes a setting from its card (§4.3), saying so; on a refusal the control goes back to what's saved.
   * @param {any} r @param {unknown} value what the main process takes (zoom as a factor) @param {{ quiet?: boolean }} [opt]
   */
  async function change(r, value, opt = {}) {
    const before = r.setting.value;
    const slow = window.setTimeout(() => status(r.setting.restarts ? 'Starting the site again…' : 'Saving…'), r.setting.restarts ? 0 : 300);
    const res = await f.set(r.target.id, value);
    clearTimeout(slow);
    if (res?.ok) {
      r.setting.value = r.setting.control === 'slider' ? Math.round(Number(res.value) * 100) : res.value;
      if (opt.quiet) return;
      f.remember(r.key, false);
      status('Saved', 'good');
      live.textContent = `${r.title}: ${valueWords(r, res.value)}. Saved.`;
      if (r.setting.version !== undefined) loadIndex();
    } else {
      r.setting.value = res?.value ?? before;
      syncControl(r);
      status(res?.message ?? "It wasn't saved.", 'bad');
      live.textContent = res?.message ?? "It wasn't saved.";
    }
  }

  /** Puts a card's control back to the setting's value. @param {any} r */
  function syncControl(r) {
    const c = card.querySelector('[data-control]');
    if (!c) return;
    const v = r.setting.value;
    if (r.setting.control === 'switch') {
      c.setAttribute('aria-checked', String(!!v));
      c.querySelector('.finder-switch-words').textContent = v ? 'On' : 'Off';
    } else if (r.setting.control === 'choice') for (const b of c.querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.value === v));
    else if (r.setting.control === 'text') {
      const t = /** @type {HTMLInputElement} */ (c);
      t.value = t.dataset.saved = String(v ?? '');
    }
  }

  function controlFor(r) {
    const s = r.setting;
    const box = node('div', 'finder-control');
    if (s.control === 'switch') {
      const b = node('button', 'finder-switch');
      b.type = 'button';
      b.dataset.control = '';
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', String(!!s.value));
      b.setAttribute('aria-labelledby', 'finder-card-title');
      b.append(Object.assign(node('span', 'track'), { ariaHidden: 'true' }), Object.assign(node('span', 'finder-switch-words'), { textContent: s.value ? 'On' : 'Off' }));
      b.addEventListener('click', () => {
        const next = !s.value;
        b.setAttribute('aria-checked', String(next));
        b.querySelector('.finder-switch-words').textContent = next ? 'On' : 'Off';
        change(r, next);
      });
      box.append(b);
    } else if (s.control === 'choice') {
      const g = node('div', 'segmented');
      g.dataset.control = '';
      g.setAttribute('role', 'radiogroup');
      g.setAttribute('aria-labelledby', 'finder-card-title');
      const pick = (v) => {
        for (const x of g.querySelectorAll('[role="radio"]')) {
          x.setAttribute('aria-checked', String(x.dataset.value === v));
          x.tabIndex = x.dataset.value === v ? 0 : -1;
        }
        change(r, v);
      };
      for (const opt of s.options) {
        const b = node('button');
        b.type = 'button';
        b.dataset.value = opt.value;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(opt.value === s.value));
        b.tabIndex = opt.value === s.value ? 0 : -1;
        b.textContent = opt.label;
        b.addEventListener('click', () => pick(opt.value));
        g.append(b);
      }
      g.addEventListener('keydown', (e) => {
        const all = [...g.querySelectorAll('[role="radio"]')];
        const i = all.indexOf(/** @type {Element} */ (document.activeElement));
        const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : null;
        if (to === null) return;
        e.preventDefault();
        e.stopPropagation();
        const b = /** @type {HTMLElement} */ (all[(to + all.length) % all.length]);
        b.focus();
        pick(b.dataset.value);
      });
      box.append(g);
    } else if (s.control === 'slider') {
      const range = /** @type {HTMLInputElement} */ (node('input', 'finder-slider'));
      range.type = 'range';
      range.dataset.control = '';
      Object.assign(range, { min: String(s.min), max: String(s.max), step: String(s.step), value: String(s.value) });
      range.setAttribute('aria-labelledby', 'finder-card-title');
      const out = node('output', 'finder-value');
      const show = () => {
        out.textContent = `${range.value}${s.unit}`;
        range.setAttribute('aria-valuetext', `${range.value}${s.unit}`);
      };
      show();
      let last = 0;
      range.addEventListener('input', () => {
        show();
        // applied as it moves, at most every 100 ms; saved when it stops (change)
        if (Date.now() - last < 100) return;
        last = Date.now();
        change(r, Number(range.value) / 100, { quiet: true });
      });
      range.addEventListener('change', () => change(r, Number(range.value) / 100));
      range.addEventListener('keydown', (e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') && e.stopPropagation());
      const reset = node('button', 'quiet');
      reset.type = 'button';
      reset.textContent = 'Reset to 100%';
      reset.addEventListener('click', () => {
        range.value = '100';
        show();
        change(r, 1);
      });
      box.append(range, out, reset);
    } else if (s.control === 'text') {
      const t = /** @type {HTMLInputElement} */ (node('input', 'finder-text-field'));
      t.type = 'text';
      t.dataset.control = '';
      t.value = t.dataset.saved = String(s.value ?? '');
      t.maxLength = s.max ?? 200;
      t.setAttribute('aria-labelledby', 'finder-card-title');
      const save = node('button', 'primary');
      save.type = 'button';
      save.textContent = 'Save';
      const go = () => {
        if (t.value === t.dataset.saved) return status('Nothing to save: it’s already that.');
        t.dataset.saved = t.value;
        change(r, t.value);
      };
      save.addEventListener('click', go);
      t.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          go();
        }
      });
      box.append(t, save);
    }
    return box;
  }

  function focusControl() {
    const c = card.querySelector('[data-control]');
    const target = c?.matches('[role="radiogroup"]') ? c.querySelector('[tabindex="0"]') : c;
    /** @type {HTMLElement | null} */ (target)?.focus();
  }

  function drawHints(r) {
    /** @type {[string, string][]} */
    const h = [['↑ ↓', 'Choose']];
    if (r) {
      if (r.setting) h.push(['Enter', r.setting.control === 'switch' ? 'Turn on or off' : 'Change it']);
      else if (!r.needsEdit) h.push(['Enter', r.open ?? 'Open']);
      if (r.second) h.push(['Ctrl+Enter', r.second.label]);
      if (r.setting) h.push(['Tab', 'To its control']);
    }
    h.push(['Esc', input.value ? 'Clear' : 'Close']);
    hints.replaceChildren(
      ...h.map(([keys, words]) => {
        const s = node('span');
        s.append(Object.assign(node('kbd'), { textContent: keys }), words);
        return s;
      }),
    );
  }

  // ---------- doing what's chosen ----------

  /** @param {any} r @param {boolean} alt Ctrl+Enter: the second action */
  function activate(r, alt) {
    if (!r) return;
    if (r.needsEdit) {
      live.textContent = 'That waits for edit mode to be ready.';
      return;
    }
    if (r.setting) {
      if (alt && r.second) {
        f.remember(r.key, false);
        closePanel(false);
        f.run({ ...r.target, alt: true });
      } else if (!alt && r.setting.control === 'switch') {
        const b = card.querySelector('[role="switch"]');
        if (b) /** @type {HTMLElement} */ (b).click();
      } else if (!alt) focusControl();
      return;
    }
    if (alt && !r.second) return;
    if (r.target.kind === 'sign-out') {
      closePanel(false);
      o.signOut();
      return;
    }
    f.remember(r.key, !!r.private);
    const goes = NAVIGATES.has(r.target.kind) || (r.target.kind === 'action' && NAVIGATING_ACTIONS.has(r.target.id));
    closePanel(!goes);
    f.run({ ...r.target, alt });
  }

  // ---------- keys ----------

  input.addEventListener('input', () => render(false));
  clear.addEventListener('click', () => {
    input.value = '';
    render(false);
    input.focus();
  });

  panel.addEventListener('keydown', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (e.key === 'Escape') {
      e.preventDefault();
      if (t === input) {
        if (input.value) {
          input.value = '';
          render(false);
        } else closePanel(true);
      } else if (t instanceof HTMLInputElement && t.classList.contains('finder-text-field') && t.value !== t.dataset.saved) t.value = t.dataset.saved ?? '';
      else input.focus();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      activate(rows[active]?.r, true);
      return;
    }
    if (e.key === 'Tab') {
      // the panel keeps the keys: the field, then the card's controls, and round again (the clear button is the
      // pointer's: Esc clears)
      const stops = [input, ...card.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')].filter((x, i, a) => a.indexOf(x) === i && !(x instanceof HTMLButtonElement && x.getAttribute('role') === 'radio' && x.tabIndex !== 0));
      const i = stops.indexOf(t);
      const next = stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
      e.preventDefault();
      /** @type {HTMLElement} */ (next).focus();
      return;
    }
    if (t !== input) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      jumpGroup(e.key === 'PageDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(rows[active]?.r, false);
    }
  });

  return { open: () => openPanel('frame'), close: () => closePanel(true), isOpen: () => !panel.hidden };
}
