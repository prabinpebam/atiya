import {
  archiveRevision, createRevision, newId, normalizeText, reopenRevision,
  revise, safeContentPath, safeHostPath, sha256, validateRevision, verifyRevision, MAX_REVISION_BYTES,
} from './revisions-core.js';

const COMPONENTS = '.slate-card,.slate-callout,.slate-metric,.slate-step,.slate-tldr';
const BLOCKS = `h1,h2,h3,h4,h5,h6,p,li,table,dl,figure,img,svg,pre,blockquote,${COMPONENTS}`;
const ATOMIC = `li,table,dl,figure,pre,blockquote,svg,p,h1,h2,h3,h4,h5,h6,${COMPONENTS}`;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, action, className) {
  const element = node('button', text, className);
  element.type = 'button';
  if (action) element.addEventListener('click', action);
  return element;
}

function icon(name) {
  const element = node('span', name, 'material-symbols-outlined');
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function actionButton(label, symbol, action, className = '') {
  const element = button('', action, className);
  element.append(icon(symbol), node('span', label, 'revision-button-label'));
  return element;
}

function iconButton(label, symbol, action, className = '') {
  const element = button('', action, `revision-icon-button ${className}`.trim());
  element.append(icon(symbol));
  element.setAttribute('aria-label', label);
  element.title = label;
  return element;
}

function selectorFor(element, root) {
  const parts = [];
  for (let current = element; current !== root; current = current.parentElement) {
    const tag = current.localName;
    const siblings = Array.from(current.parentElement.children).filter(sibling => sibling.localName === tag);
    parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
  }
  return parts.join(' > ');
}

export function captureBlocks(root, page) {
  const all = Array.from(root.querySelectorAll(BLOCKS)).filter(element =>
    !element.closest('.slate-history,.slate-xref,script,style')
    && !element.parentElement.closest(ATOMIC));
  const headings = [];
  const records = all.map((element, ordinal) => {
    if (/^h[1-6]$/.test(element.localName)) {
      const level = Number(element.localName[1]);
      while (headings.length && headings.at(-1).level >= level) headings.pop();
      headings.push({ level, text: normalizeText(element.textContent), id: element.id });
    }
    return {
      element, page,
      target: {
        selector: selectorFor(element, root), ordinal, tag: element.localName, elementId: element.id,
        text: normalizeText(element.textContent), html: element.outerHTML,
        headings: structuredClone(headings),
      },
    };
  });
  const duplicates = new Map();
  for (const record of records) {
    const group = duplicates.get(record.target.html) || [];
    group.push(record);
    duplicates.set(record.target.html, group);
  }
  records.forEach((record, index) => {
    const matches = duplicates.get(record.target.html);
    Object.assign(record.target, {
      occurrence: matches.indexOf(record) + 1, matches: matches.length,
      before: records[index - 1]?.target.text.slice(-1000) || '',
      after: records[index + 1]?.target.text.slice(0, 1000) || '',
    });
  });
  return records;
}

export function attach({ navigate, reveal, hasPage }) {
  const app = document.querySelector('.app');
  const header = document.querySelector('.header');
  const cacheKey = `slate-revisions-v1:${location.pathname.replace(/index\.html$/, '')}`;
  const endpoint = new URL('__slate/revisions', document.baseURI);
  const revisions = new Map();
  const selection = new Map();
  let records = [];
  let selectedId = null;
  let pending = {};
  let drafts = {};
  let mode = 'unknown';
  let serverHost = null;
  let open = false;
  let selecting = false;
  let busy = false;
  let preparing = false;
  let lastSelected = null;
  let jump = null;
  let errorText = '';
  let storageError = '';
  let notice = '';
  let removeId = null;
  let refreshing;
  let externalConflict = false;
  let cacheBlocked = false;
  let menuId = 0;
  let cancelTargetScroll = () => {};

  const toggle = button('', () => setOpen(!open), 'revision-toggle');
  toggle.append(node('span', 'rate_review', 'material-symbols-outlined'));
  toggle.firstChild.setAttribute('aria-hidden', 'true');
  toggle.setAttribute('aria-label', 'Open revisions');
  toggle.title = 'Revision';
  toggle.setAttribute('aria-controls', 'slate-revision-panel');
  toggle.setAttribute('aria-expanded', 'false');
  header.insertBefore(toggle, header.querySelector('.theme-toggle'));

  const panel = node('aside', undefined, 'revision-panel');
  panel.id = 'slate-revision-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'slate-revision-heading');
  panel.innerHTML = `
    <div class="revision-panel-header">
      <h2 id="slate-revision-heading"><span class="material-symbols-outlined" aria-hidden="true">rate_review</span>Revision</h2>
      <div class="revision-header-actions"></div>
    </div>
    <div class="revision-list"></div>
    <div class="revision-panel-scroll">
      <p class="revision-error" role="alert" hidden></p>
      <div class="revision-recovery"></div>
      <div class="revision-editor"></div>
    </div>
    <div class="revision-storage" role="status" aria-live="polite"></div>`;
  const close = iconButton('Close revisions', 'close', () => setOpen(false));
  panel.querySelector('.revision-panel-header').append(close);
  app.append(panel);
  const status = panel.querySelector('.revision-storage');
  const error = panel.querySelector('.revision-error');
  const actions = panel.querySelector('.revision-header-actions');
  const recovery = panel.querySelector('.revision-recovery');
  const list = panel.querySelector('.revision-list');
  const editor = panel.querySelector('.revision-editor');
  const dialog = node('dialog', undefined, 'revision-dialog');
  dialog.setAttribute('aria-labelledby', 'revision-dialog-heading');
  dialog.addEventListener('close', () => { if (open) panel.querySelector('.revision-options')?.focus(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
  panel.append(dialog);
  const importInput = node('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.hidden = true;
  panel.append(importInput);

  function report(problem) {
    errorText = problem instanceof Error ? problem.message : String(problem);
    renderStatus();
  }
  function current() { return revisions.get(selectedId); }
  function hasPending() { return Object.keys(pending).length > 0; }
  function draft() { return drafts[selectedId] ||= { text: '', editId: null }; }
  function persist() {
    if (cacheBlocked) return false;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ revisions: [...revisions.values()], pending, selectedId, drafts }));
      storageError = '';
      return true;
    } catch (problem) {
      storageError = `Browser recovery could not be saved (${problem.message}). Workspace saves report their own result; if a save fails, keep this tab open and retry.`;
      renderStatus();
      return false;
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (saved) {
      if (!Array.isArray(saved.revisions) || !saved.pending || !saved.drafts) throw new Error('Invalid browser revision cache; export or clear this site data deliberately.');
      saved.revisions.forEach(revision => { validateRevision(revision); revisions.set(revision.id, revision); });
      for (const [id, version] of Object.entries(saved.pending)) {
        if (!revisions.has(id) || !Number.isSafeInteger(version) || version < 0) throw new Error('Invalid pending revision cache.');
      }
      pending = saved.pending;
      drafts = saved.drafts;
      selectedId = revisions.get(saved.selectedId)?.status === 'active' ? saved.selectedId : null;
    }
  } catch (problem) {
    cacheBlocked = true;
    storageError = 'Existing browser data was not overwritten. Back it up before deliberately clearing this site data.';
    report(problem);
  }

  function renderStatus() {
    const state = busy || preparing ? 'saving' : hasPending() ? 'pending'
      : mode === 'workspace' ? 'saved' : mode === 'static' ? 'static' : 'unknown';
    const messages = {
      saving: ['sync', 'Saving changes...'],
      pending: ['cloud_off', 'Changes not saved. Retry saving.'],
      saved: ['check_circle', 'All changes saved'],
      static: ['info', 'Read-only. Start the Slate local server to add revisions.'],
      unknown: ['sync', 'Checking revision storage...'],
    };
    status.dataset.state = state;
    status.replaceChildren(icon(notice ? 'check_circle' : messages[state][0]), node('span', notice || messages[state][1]));
    status.title = state === 'saved' ? 'Automatically saved to the parent project at .slate/revisions/.'
      : state === 'static' ? 'Run serve-revisions.mjs for this project. No manual JSON saving is needed.'
      : state === 'pending' ? 'Unsynced edits remain in browser recovery. Retry saving or reload the workspace version.' : '';
    error.textContent = [errorText, storageError].filter(Boolean).join(' ');
    error.hidden = !error.textContent;
  }

  async function request(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    if (!response.ok) {
      let message = `Revision storage returned HTTP ${response.status}.`;
      if (response.headers.get('content-type')?.includes('application/json')) message = (await response.json()).error || message;
      throw new Error(message);
    }
    return response.json();
  }

  async function refresh() {
    if (busy || preparing || refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (response.status === 404 || response.status === 405 || response.status === 501) {
          mode = 'static';
          setSelecting(false);
          render();
          return;
        }
        if (!response.ok) throw new Error(`Cannot load workspace revisions: HTTP ${response.status}.`);
        const data = await response.json();
        if (data.kind !== 'slate-revision-store' || !Array.isArray(data.revisions)) throw new Error('This address is not a Slate revision store.');
        if (!safeHostPath(data.host) || data.storagePath !== '.slate/revisions') throw new Error('The revision server did not declare the fixed parent-project store.');
        for (const revision of data.revisions) await verifyRevision(revision);
        mode = 'workspace';
        serverHost = data.host;
        if (!hasPending()) {
          const previous = current();
          revisions.clear();
          data.revisions.forEach(revision => revisions.set(revision.id, revision));
          if (!revisions.has(selectedId) || (previous?.status === 'active' && current()?.status === 'archived')) {
            selectedId = data.revisions.find(revision => revision.status === 'active')?.id || null;
            selection.clear();
            setSelecting(false);
          }
          errorText = '';
          persist();
        }
      } catch (problem) { report(problem); }
      finally { refreshing = null; render(); }
    })();
    return refreshing;
  }

  async function sendPending() {
    for (const [id, version] of Object.entries(pending)) {
      const revision = revisions.get(id);
      await request(new URL(`${endpoint.pathname}/${id}`, endpoint), {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': String(version) },
        body: JSON.stringify(revision),
      });
      delete pending[id];
      persist();
    }
  }

  async function commit(revision, expectedVersion) {
    if (busy || hasPending()) throw new Error('Resolve unsynced workspace edits before making further changes.');
    if (externalConflict || cacheBlocked) throw new Error('Reload this page after preserving local data before editing.');
    if (mode !== 'workspace') throw new Error('Start the Slate local server to save revisions automatically in the parent project.');
    if (revision.host !== serverHost) throw new Error('This revision belongs to a different documentation host.');
    busy = true;
    try {
      await verifyRevision(revision);
      revisions.set(revision.id, revision);
      selectedId = revision.status === 'archived'
        ? [...revisions.values()].find(item => item.status === 'active')?.id || null : revision.id;
      errorText = '';
      notice = '';
      if (mode === 'workspace') pending[revision.id] = expectedVersion;
      persist();
      render();
      if (mode === 'workspace') await sendPending();
    } catch (problem) { report(problem); }
    finally { busy = false; persist(); render(); }
  }

  function run(action) {
    return async (...args) => {
      try { await action(...args); }
      catch (problem) { report(problem); }
    };
  }

  function setOpen(value) {
    const mobile = matchMedia('(max-width: 768px)').matches;
    const content = document.querySelector('#content');
    const scrollTop = value ? window.scrollY : content.scrollTop;
    open = value;
    panel.hidden = !value;
    app.classList.toggle('revision-open', value);
    if (mobile) {
      window.scrollTo({ top: value ? 0 : scrollTop, behavior: 'instant' });
      content.scrollTop = value ? scrollTop : 0;
    }
    toggle.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-label', value ? 'Close revisions' : 'Open revisions');
    if (!value) {
      cancelTargetScroll();
      panel.querySelectorAll('.revision-menu-popover:popover-open').forEach(menu => menu.hidePopover());
      if (dialog.open) dialog.close();
      setSelecting(false);
      document.querySelectorAll('.revision-target-focus').forEach(element => element.classList.remove('revision-target-focus'));
      toggle.focus();
    } else {
      render();
      refresh();
      close.focus();
    }
  }

  function setSelecting(value) {
    selecting = value && open && mode === 'workspace' && current()?.status === 'active' && !busy && !preparing && !hasPending() && !externalConflict && !cacheBlocked;
    document.querySelector('#document').classList.toggle('revision-selecting', selecting);
    for (const record of records) {
      if (record.control) record.control.hidden = !selecting;
    }
    renderSelection();
  }
  function keyFor(record) { return `${record.page.path}:${record.target.selector}:${record.target.html}`; }
  function renderSelection() {
    records.forEach(record => {
      const selected = selection.has(keyFor(record));
      record.element.toggleAttribute('data-revision-selected', selected && open);
      record.control?.setAttribute('aria-pressed', String(selected));
      if (record.control) record.control.firstChild.textContent = selected ? 'check_box' : 'check_box_outline_blank';
    });
    const count = editor.querySelector('.revision-selection-count');
    if (count) {
      const pages = new Set([...selection.values()].map(item => item.page.path)).size;
      count.textContent = selection.size ? `${selection.size} block${selection.size === 1 ? '' : 's'} selected${pages > 1 ? ` across ${pages} pages` : ''}` : 'No blocks selected';
    }
    const select = editor.querySelector('.revision-select-action');
    if (select) {
      select.querySelector('.revision-button-label').textContent = selecting ? 'Stop selecting' : 'Select blocks';
      select.setAttribute('aria-pressed', String(selecting));
    }
    const clear = editor.querySelector('.revision-clear-selection');
    if (clear) clear.hidden = !selection.size;
    const help = editor.querySelector('.revision-help');
    if (help) help.hidden = !selecting;
    const submit = editor.querySelector('.revision-add-comment');
    if (submit) submit.disabled = busy || preparing || hasPending() || mode !== 'workspace' || externalConflict || cacheBlocked
      || !editor.querySelector('#revision-comment-text').value.trim() || (!draft().editId && !selection.size);
  }

  function selectBlock(record, range = false) {
    if (!selecting || busy || preparing || hasPending() || externalConflict) return;
    const from = range && lastSelected !== null ? Math.min(lastSelected, record.target.ordinal) : record.target.ordinal;
    const through = range && lastSelected !== null ? Math.max(lastSelected, record.target.ordinal) : record.target.ordinal;
    if (range && lastSelected !== null) {
      const additions = records.slice(from, through + 1);
      const size = selection.size + additions.filter(item => !selection.has(keyFor(item))).length;
      if (size > 100) { report('A comment supports up to 100 blocks. Add the current comment before selecting more.'); return; }
      additions.forEach(item => selection.set(keyFor(item), { page: item.page, target: item.target }));
    } else {
      const key = keyFor(record);
      if (selection.has(key)) selection.delete(key);
      else {
        if (selection.size >= 100) { report('A comment supports up to 100 blocks. Add the current comment before selecting more.'); return; }
        selection.set(key, { page: record.page, target: record.target });
      }
    }
    lastSelected = record.target.ordinal;
    renderSelection();
  }

  function targetButton(revision, target, index) {
    const source = revision.sources.find(item => item.id === target.sourceId);
    const wrapper = node('div', undefined, 'revision-target');
    const link = actionButton(`${source.title} / block ${target.ordinal + 1}`, 'arrow_outward', run(async () => {
      if (!hasPage(source.route)) throw new Error('This target page is no longer registered. Compare the saved source before retargeting.');
      const response = await fetch(new URL(source.path, document.baseURI), { cache: 'no-store' });
      if (!response.ok || await response.text() !== source.content) {
        throw new Error('This target is stale or missing. Compare its saved source and block snapshots before retargeting; Slate will not guess.');
      }
      jump = { source, target };
      navigate(source.route);
    }), 'revision-target-link');
    link.setAttribute('aria-label', `View target ${index + 1}: ${source.title} / block ${target.ordinal + 1}`);
    link.title = `Go to the anchored block: ${target.text.slice(0, 240) || `[${target.tag}]`}`;
    wrapper.append(link);
    return wrapper;
  }

  function focusTarget(element) {
    cancelTargetScroll();
    reveal(element);
    element.setAttribute('tabindex', '-1');
    element.classList.add('revision-target-focus');
    // Unsized lazy images above the target can change its position after the first scroll.
    const images = new Set([...document.querySelectorAll('.page-body img')].filter(image =>
      !image.complete && !image.closest('details:not([open]),.doc-section.collapsed')
      && (element.contains(image) || (image.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))));
    const content = document.querySelector('#content');
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
    let frame;
    let startedAt = null;
    let startTop;
    const interactions = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    function stop() {
      cancelAnimationFrame(frame);
      images.forEach(image => {
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', loaded);
      });
      interactions.forEach(type => document.removeEventListener(type, stop, true));
      cancelTargetScroll = () => {};
    }
    function position(timestamp) {
      frame = null;
      if (!element.isConnected) { stop(); return; }
      if (startedAt === null) {
        startedAt = timestamp;
        startTop = content.scrollTop;
      }
      const bounds = element.getBoundingClientRect();
      const viewport = content.getBoundingClientRect();
      const destination = Math.max(0, Math.min(content.scrollHeight - content.clientHeight,
        content.scrollTop + bounds.top - viewport.top - (content.clientHeight - bounds.height) / 2));
      const progress = duration ? Math.min((timestamp - startedAt) / duration, 1) : 1;
      const eased = 1 - (1 - progress) ** 3;
      content.scrollTo({ top: startTop + (destination - startTop) * eased, behavior: 'instant' });
      if (progress < 1) frame = requestAnimationFrame(position);
      else {
        startedAt = null;
        element.focus({ preventScroll: true });
        if (!images.size) stop();
      }
    }
    function loaded(event) {
      const image = event.currentTarget;
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', loaded);
      images.delete(image);
      if (!frame) frame = requestAnimationFrame(position);
    }
    images.forEach(image => {
      image.addEventListener('load', loaded);
      image.addEventListener('error', loaded);
    });
    interactions.forEach(type => document.addEventListener(type, stop, { capture: true, passive: true }));
    cancelTargetScroll = stop;
    frame = requestAnimationFrame(position);
  }

  function actionMenu(label, groups, className = '') {
    const container = node('div', undefined, 'revision-menu');
    const trigger = iconButton(label, 'more_horiz', undefined, className);
    const menu = node('div', undefined, 'revision-menu-popover');
    menu.id = `revision-menu-${++menuId}`;
    menu.popover = 'auto';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', label);
    trigger.popoverTargetElement = menu;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');
    groups.filter(group => group.length).forEach((group, index) => {
      if (index) {
        const separator = node('hr');
        separator.setAttribute('role', 'separator');
        menu.append(separator);
      }
      group.forEach(item => {
        const entry = actionButton(item.label, item.icon, run(async event => {
          menu.hidePopover();
          trigger.focus();
          await item.action(event);
        }), `revision-menu-item${item.danger ? ' revision-danger' : ''}`);
        entry.setAttribute('role', 'menuitem');
        entry.disabled = Boolean(item.disabled);
        menu.append(entry);
      });
    });
    menu.addEventListener('toggle', event => {
      const expanded = event.newState === 'open';
      trigger.setAttribute('aria-expanded', String(expanded));
      if (!expanded) return;
      const bounds = trigger.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, bounds.right - menu.offsetWidth))}px`;
      menu.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, innerHeight - menu.offsetHeight - 8))}px`;
      menu.querySelector('button:not(:disabled)')?.focus();
    });
    menu.addEventListener('keydown', event => {
      const entries = [...menu.querySelectorAll('button:not(:disabled)')];
      const index = entries.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
        entries[next]?.focus();
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        event.stopPropagation();
        if (event.key === 'Escape') event.preventDefault();
        menu.hidePopover();
        trigger.focus();
      }
    });
    container.append(trigger, menu);
    return container;
  }

  async function startRevision() {
    selection.clear();
    await commit(createRevision(new Date(), serverHost), 0);
    setSelecting(true);
    editor.querySelector('#revision-comment-text')?.focus();
  }

  function revisionDialog(kind, revision) {
    if (kind === 'archive' && (draft().text.trim() || selection.size)) {
      throw new Error('Save or clear the current comment and block selection before archiving.');
    }
    const renaming = kind === 'rename';
    const form = node('form');
    const heading = node('h2', renaming ? 'Rename revision' : 'Archive revision');
    heading.id = 'revision-dialog-heading';
    const help = node('p', renaming ? 'Give this round of feedback a recognizable name.'
      : 'Record what changed. Archived feedback stays available and can be reopened.');
    const label = node('label', renaming ? 'Revision name' : 'Completion summary');
    const input = node(renaming ? 'input' : 'textarea');
    input.id = renaming ? 'revision-name' : 'revision-completion-summary';
    input.maxLength = renaming ? 200 : 20000;
    input.required = true;
    input.value = renaming ? revision.name : '';
    if (!renaming) input.rows = 4;
    label.htmlFor = input.id;
    const footer = node('div', undefined, 'revision-dialog-actions');
    const cancel = button('Cancel', () => dialog.close());
    const submit = actionButton(renaming ? 'Save name' : 'Archive revision', renaming ? 'check' : 'archive', undefined, 'revision-primary');
    submit.type = 'submit';
    footer.append(cancel, submit);
    form.append(heading, help, label, input, footer);
    form.addEventListener('submit', run(async event => {
      event.preventDefault();
      if (!input.value.trim()) {
        input.setCustomValidity('Enter a value before continuing.');
        input.reportValidity();
        return;
      }
      const next = renaming ? revise(revision, item => { item.name = input.value.trim(); }) : archiveRevision(revision, input.value);
      dialog.close();
      await commit(next, revision.version);
      if (!renaming) setSelecting(false);
      panel.querySelector('.revision-options')?.focus();
    }));
    input.addEventListener('input', () => input.setCustomValidity(''));
    dialog.replaceChildren(form);
    dialog.showModal();
    input.focus();
    if (renaming) input.select();
  }

  function render() {
    renderStatus();
    if (!open) return;
    const disabled = busy || preparing || hasPending() || mode !== 'workspace' || externalConflict || cacheBlocked;
    const revision = current();
    const create = iconButton('New revision', 'add', run(startRevision));
    create.disabled = disabled;
    create.hidden = !revision;
    const management = revision?.status === 'active' ? [
      { label: 'Rename revision', icon: 'edit', action: () => revisionDialog('rename', revision), disabled },
      { label: 'Archive revision', icon: 'archive', action: () => revisionDialog('archive', revision), disabled },
    ] : [];
    const sharing = revision ? [
      { label: 'Copy agent handoff', icon: 'content_copy', action: async () => {
        await navigator.clipboard.writeText(`Act on Slate revision ${revision.id} (${revision.name}), version ${revision.version}. Read .slate/revisions/${revision.id}.json in the parent project; its host is ${revision.host}. Follow the Slate revision agent procedure: read every comment, act on open comments and use addressed comments as context, inspect exact source snapshots, resolve stale targets without guessing, change canonical sources, verify the requested outcome, then archive with the version read before acting and a completion summary. Leave unresolved work active.`);
        notice = 'Agent handoff copied';
        renderStatus();
      } },
      { label: 'Export JSON', icon: 'download', action: async () => {
        await verifyRevision(revision);
        const url = URL.createObjectURL(new Blob([`${JSON.stringify(revision, null, 2)}\n`], { type: 'application/json' }));
        const link = node('a');
        link.href = url;
        link.download = `${revision.id}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } },
    ] : [];
    const tools = [
      { label: 'Refresh', icon: 'refresh', action: refresh, disabled: busy || preparing },
      { label: 'Import JSON', icon: 'upload_file', action: () => importInput.click(), disabled },
    ];
    actions.replaceChildren(create, actionMenu('Revision actions', [management, sharing, tools], 'revision-options'));
    recovery.replaceChildren();
    if (hasPending()) {
      recovery.append(actionButton('Retry save', 'sync', run(async () => {
        if (mode !== 'workspace') throw new Error('Reconnect to the workspace revision server before retrying.');
        busy = true;
        render();
        try { await sendPending(); errorText = ''; }
        finally { busy = false; render(); }
      }), 'revision-primary'));
      recovery.append(button('Reload workspace', () => {
        if (!confirm('Discard unsynced revision edits and reload workspace files? Export JSON first if you need to keep them.')) return;
        pending = {};
        revisions.clear();
        selectedId = null;
        persist();
        refresh();
      }));
    }
    list.replaceChildren();
    const ordered = [...revisions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    function revisionChoice(revision, parent) {
      const choice = button(`${revision.name} (${revision.comments.length})`, () => {
        selectedId = revision.id;
        selection.clear();
        setSelecting(false);
        removeId = null;
        persist();
        render();
      }, 'revision-choice');
      choice.setAttribute('aria-pressed', String(revision.id === selectedId));
      choice.disabled = disabled;
      parent.append(choice);
    }
    const active = ordered.filter(item => item.status === 'active');
    if (active.length || revision) {
      const pickerLabel = node('label', 'Current revision', 'revision-picker-label');
      pickerLabel.htmlFor = 'revision-picker';
      const picker = node('select');
      picker.id = 'revision-picker';
      picker.disabled = disabled;
      if (!revision || revision.status === 'archived') {
        const placeholder = node('option', revision ? `${revision.name} (archived)` : 'Choose a revision');
        placeholder.value = revision?.id || '';
        picker.append(placeholder);
      }
      active.forEach(item => {
        const option = node('option', item.name);
        option.value = item.id;
        picker.append(option);
      });
      picker.value = selectedId || '';
      picker.addEventListener('change', () => {
        selectedId = picker.value;
        selection.clear();
        setSelecting(false);
        removeId = null;
        persist();
        render();
      });
      list.append(pickerLabel, picker);
    }
    const archived = ordered.filter(item => item.status === 'archived');
    if (archived.length) {
      const group = node('details', undefined, 'revision-archived');
      group.open = current()?.status === 'archived';
      group.append(node('summary', `Archived (${archived.length})`));
      archived.forEach(item => revisionChoice(item, group));
      list.append(group);
    }
    editor.replaceChildren();
    if (!revision) {
      setSelecting(false);
      const empty = node('div', undefined, 'revision-empty');
      empty.append(icon('rate_review'), node('h3', 'A place for your next changes'),
        node('p', 'Select passages as you read and collect feedback across pages in one revision.'));
      const start = actionButton('New revision', 'add', run(startRevision), 'revision-primary');
      start.disabled = disabled;
      empty.append(start);
      editor.append(empty);
      return;
    }
    const meta = node('p', revision.status === 'archived' ? 'Archived' : 'Active', 'revision-meta');
    meta.title = `Version ${revision.version}`;
    editor.append(meta);
    if (revision.status === 'archived') {
      editor.append(node('p', revision.resolution, 'revision-resolution'));
      const reopen = actionButton('Reopen revision', 'undo', run(async () => {
        await commit(reopenRevision(revision), revision.version);
      }), 'revision-primary');
      reopen.disabled = disabled;
      editor.append(reopen);
    }
    const comments = node('div', undefined, 'revision-comments');
    comments.append(node('h3', `Comments (${revision.comments.length})`));
    revision.comments.forEach((comment, index) => {
      const card = node('section', undefined, 'revision-comment');
      const head = node('div', undefined, 'revision-comment-header');
      head.append(node('h4', `Comment ${index + 1}`));
      if (comment.status === 'addressed') head.append(node('span', 'Addressed', 'revision-comment-status'));
      card.append(head, node('p', comment.text, 'revision-comment-text'));
      const targets = node('div', undefined, 'revision-targets');
      const targetSummary = node('p', undefined, 'revision-target-count');
      const pageCount = new Set(comment.targets.map(target => revision.sources.find(source => source.id === target.sourceId).path)).size;
      targetSummary.append(icon('link'), node('span', `${comment.targets.length} block${comment.targets.length === 1 ? '' : 's'} on ${pageCount} page${pageCount === 1 ? '' : 's'}`));
      targets.append(targetSummary);
      comment.targets.forEach((target, targetIndex) => targets.append(targetButton(revision, target, targetIndex)));
      const previews = node('details', undefined, 'revision-target-previews');
      previews.append(node('summary', 'Show excerpts'));
      comment.targets.forEach(target => {
        const source = revision.sources.find(item => item.id === target.sourceId);
        const excerpt = node('div', undefined, 'revision-target');
        excerpt.append(node('p', `${source.title} / block ${target.ordinal + 1}`, 'revision-quote-label'),
          node('p', target.text.slice(0, 240) || `[${target.tag}] ${target.html.slice(0, 240)}`, 'revision-quote'));
        previews.append(excerpt);
      });
      targets.append(previews);
      card.append(targets);
      if (revision.status === 'active') {
        const edit = () => {
          drafts[selectedId] = { text: comment.text, editId: comment.id };
          persist();
          render();
          editor.querySelector('#revision-comment-text').focus();
        };
        head.append(actionMenu(`Comment ${index + 1} actions`, [[
          { label: 'Edit comment', icon: 'edit', action: edit, disabled },
          { label: 'Remove comment', icon: 'delete', danger: true, disabled, action: () => {
            removeId = comment.id;
            render();
            editor.querySelector('.revision-confirm-removal')?.focus();
          } },
        ]]));
        if (removeId === comment.id) {
          const confirmation = node('div', undefined, 'revision-remove-confirmation');
          const remove = button('Confirm removal', run(async () => {
            await commit(revise(revision, next => {
              next.comments = next.comments.filter(item => item.id !== comment.id);
              const referenced = new Set(next.comments.flatMap(item => item.targets.map(target => target.sourceId)));
              next.sources = next.sources.filter(source => referenced.has(source.id));
            }), revision.version);
            removeId = null;
          }), 'revision-confirm-removal revision-danger');
          remove.disabled = disabled;
          confirmation.append(node('p', 'Remove this comment?'), remove,
            button('Cancel removal', () => { removeId = null; render(); }));
          card.append(confirmation);
        }
      }
      comments.append(card);
    });
    if (revision.status === 'archived') {
      editor.append(comments);
      setSelecting(false);
      return;
    }
    const composer = node('section', undefined, 'revision-composer');
    const composerHead = node('div', undefined, 'revision-composer-heading');
    composerHead.append(node('h3', draft().editId ? 'Edit feedback' : 'Add feedback'));
    composer.append(composerHead);
    const toolbar = node('div', undefined, 'revision-selection-toolbar');
    const select = actionButton('Select blocks', 'select_all', () => setSelecting(!selecting), 'revision-select-action');
    select.disabled = disabled;
    const clear = iconButton('Clear selection', 'close', () => { selection.clear(); renderSelection(); }, 'revision-clear-selection');
    clear.disabled = disabled;
    const count = node('p', '', 'revision-selection-count');
    count.setAttribute('aria-live', 'polite');
    toolbar.append(select, clear);
    if (!draft().editId) composer.append(toolbar, count, node('p', 'Click blocks to select. Shift-click for a range.', 'revision-help'));
    const form = node('form');
    const label = node('label', draft().editId ? 'Edit comment text' : 'Comment on selected blocks', 'sr-only');
    const textarea = node('textarea');
    textarea.id = 'revision-comment-text';
    textarea.value = draft().text;
    textarea.rows = 3;
    textarea.placeholder = "Describe the change you'd like...";
    textarea.maxLength = 20000;
    textarea.required = true;
    textarea.disabled = disabled;
    label.htmlFor = textarea.id;
    textarea.addEventListener('input', () => { draft().text = textarea.value; persist(); renderSelection(); });
    const submit = actionButton(draft().editId ? 'Save comment' : 'Add comment', 'send', undefined, 'revision-add-comment revision-primary');
    submit.type = 'submit';
    const formActions = node('div', undefined, 'revision-composer-actions');
    formActions.append(submit);
    form.append(label, textarea, formActions);
    form.addEventListener('submit', run(async event => {
      event.preventDefault();
      if (preparing || busy || hasPending()) throw new Error('Wait for the current revision save to finish.');
      const text = textarea.value.trim();
      if (!text) throw new Error('Enter a comment before saving.');
      const editId = draft().editId;
      const owner = selectedId;
      const selected = [...selection.values()];
      const now = new Date().toISOString();
      const next = revise(revision, () => {});
      preparing = true;
      render();
      try {
        if (editId) {
          const comment = next.comments.find(item => item.id === editId);
          if (!comment) throw new Error('This comment no longer exists. Reload the revision.');
          comment.text = text;
          comment.status = 'open';
          comment.updatedAt = now;
        } else {
          if (!selected.length) throw new Error('Select at least one block.');
          const targets = [];
          for (const { page, target } of selected) {
            const hash = await sha256(page.content);
            let source = next.sources.find(item => item.path === page.path && item.sha256 === hash);
            if (!source) {
              source = { id: newId('source'), ...page, sha256: hash };
              next.sources.push(source);
            }
            targets.push({ sourceId: source.id, ...target, sha256: await sha256(target.html) });
          }
          next.comments.push({ id: newId('comment'), text, status: 'open', createdAt: now, updatedAt: now, targets });
        }
        await verifyRevision(next);
        drafts[owner] = { text: '', editId: null };
        selection.clear();
        await commit(next, revision.version);
      } finally {
        preparing = false;
        render();
      }
    }));
    if (draft().editId) {
      const cancel = button('Cancel edit', () => {
        drafts[selectedId] = { text: '', editId: null };
        persist();
        render();
      });
      cancel.disabled = disabled;
      formActions.prepend(cancel);
    }
    composer.append(form);
    editor.append(composer, comments);
    if (!revision.comments.length) comments.append(node('p', 'No feedback yet. Your comments will appear here, with links to the selected passages.', 'revision-comments-empty'));
    renderSelection();
  }

  importInput.addEventListener('change', run(async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    if (file.size > MAX_REVISION_BYTES) throw new Error('Revision file exceeds 8 MiB.');
    const revision = await verifyRevision(JSON.parse(await file.text()));
    if (revisions.has(revision.id)) throw new Error('A revision with this ID already exists. Import cannot overwrite it.');
    await commit(revision, 0);
  }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !open) return;
    if (dialog.open) return;
    const menu = panel.querySelector('.revision-menu-popover:popover-open');
    if (menu) {
      event.preventDefault();
      menu.hidePopover();
      panel.querySelector(`[aria-controls="${menu.id}"]`)?.focus();
      return;
    }
    if (selecting) setSelecting(false);
    else setOpen(false);
  });
  window.addEventListener('focus', () => { if (open && !hasPending() && !dialog.open) refresh(); });
  window.addEventListener('storage', event => {
    if (event.key === cacheKey) {
      externalConflict = true;
      setSelecting(false);
      report('Revisions changed in another tab. Export any local edits and reload before editing.');
      render();
    }
  });

  return {
    replaceElement(previous, replacement) {
      const record = records.find(item => item.element === previous);
      if (record) record.element = replacement;
    },
    capture(root, page) {
      cancelTargetScroll();
      if (!safeContentPath(page.path) || !safeContentPath(page.route)) {
        records = [];
        report('This content root is not a local host-relative path. Revision selection is unavailable for this page.');
        return;
      }
      records = captureBlocks(root, page);
      lastSelected = null;
    },
    mount() {
      records.forEach(record => {
        const control = button('', event => {
          event.preventDefault();
          event.stopPropagation();
          selectBlock(record, event.shiftKey);
        }, 'revision-block-toggle');
        control.append(node('span', 'check_box_outline_blank', 'material-symbols-outlined'));
        control.firstChild.setAttribute('aria-hidden', 'true');
        control.setAttribute('aria-label', `Select block ${record.target.ordinal + 1}: ${(record.target.text || record.target.tag).slice(0, 100)}`);
        control.setAttribute('aria-pressed', 'false');
        control.hidden = !selecting;
        const anchor = record.element.parentElement.classList.contains('slate-table-scroll') ? record.element.parentElement : record.element;
        if (anchor.matches(`li,figure,${COMPONENTS}`)) {
          anchor.classList.add('revision-block-anchor');
          anchor.prepend(control);
        } else anchor.before(control);
        record.control = control;
        record.element.addEventListener('click', event => {
          if (!selecting || event.target.closest('a,button,input,select,textarea,summary')) return;
          event.preventDefault();
          event.stopPropagation();
          selectBlock(record, event.shiftKey);
        }, true);
      });
      renderSelection();
      if (jump) {
        const { source, target } = jump;
        jump = null;
        const match = records.find(record => record.page.route === source.route
          && record.page.path === source.path && record.page.content === source.content
          && record.target.selector === target.selector && record.target.html === target.html);
        if (!match) report('This target is stale or missing. Compare its saved source and block snapshots before retargeting; Slate will not guess.');
        else focusTarget(match.element);
      }
    },
  };
}
