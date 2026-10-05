/**
 * The article editor's controller (documentation/editor/spec.md §3, §8.6): the one owner of the article
 * while it's open. It applies every change with the shared document operations, saves through one
 * queue (never two saves at once), keeps the undo history, refreshes the outline and the inspector (by
 * fetching the page and swapping those regions) and the canvas (by reloading it) after changes that
 * re-render them, and talks to the canvas by postMessage (same origin only).
 */
import { api, announce, describeIssue, onContentChange, saveStatus, swapRegions, type Issue } from './client';
import * as ops from '../model/ops';
import * as paste from '../model/paste';
import { SaveQueue } from '../model/queue';
import { isVideoFile } from '../model/upload';
import { openCrop } from './crop';
import { PICTURE_SPECS } from '../../design/pictures';
import { plainText } from '../../content/markdown';
import type { Article, Block } from '../../content/schema';

interface State {
  id: string;
  key: string;
  version: string;
  structureVersion: string | null;
  section: string;
  /** Who can see it: open, or private (documentation/access/spec.md §8.2). */
  access: 'open' | 'private';
  planetVersion: string | null;
  place: string;
  published: boolean;
  article: Article;
  canvas: string;
  publicPath: string | null;
  media: Record<string, { alt: string; thumb: string }>;
}
type Refresh = { canvas?: boolean; outline?: boolean; inspector?: boolean };
type Pick = { mode: 'single' | 'multiple'; min: number; title: string; onChoose: (ids: string[]) => void; /** What it takes: pictures (the default) or videos. */ kind?: 'image' | 'video' };
const STRUCTURE = '/content/structures/site.json';
const PLANET = '/content/structures/planet.json';
const ALL: Refresh = { canvas: true, outline: true, inspector: true };

export function initEditor(root: HTMLElement, signal: AbortSignal) {
  const readState = (): State => JSON.parse(document.querySelector('[data-editor-state]')?.textContent ?? '{}');
  const state = readState();
  let doc: Article = state.article;
  let saved: Article = structuredClone(doc);
  let selected: number | null = null;
  // several blocks selected in the outline (Shift, Ctrl or Cmd): moved, dragged and deleted together
  let picked = new Set<number>();
  let anchor: number | null = null;
  const group = () => [...picked].sort((a, b) => a - b);
  const frame = root.querySelector<HTMLIFrameElement>('[data-editor-frame]')!;
  const canvasBox = root.querySelector<HTMLElement>('[data-editor-canvas]')!;
  const toCanvas = (m: Record<string, unknown>) => frame.contentWindow?.postMessage({ source: 'editor', ...m }, location.origin);
  const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement | null;
  type Events = DocumentEventMap & WindowEventMap;
  const on = <K extends keyof Events>(t: EventTarget, type: K, fn: (e: Events[K]) => void) => t.addEventListener(type, fn as EventListener, { signal });

  // ---------- history ----------
  const HKEY = `editor.history.${state.id}`;
  const hist: { past: string[]; future: string[] } = JSON.parse(sessionStorage.getItem(HKEY) ?? '{"past":[],"future":[]}');
  const persist = () => sessionStorage.setItem(HKEY, JSON.stringify({ past: hist.past.slice(-50), future: hist.future.slice(-50) }));
  const updateUndo = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-editor-undo]').forEach((b) => (b.disabled = !hist.past.length));
    document.querySelectorAll<HTMLButtonElement>('[data-editor-redo]').forEach((b) => (b.disabled = !hist.future.length));
  };
  const checkpoint = () => {
    hist.past.push(JSON.stringify(doc));
    hist.future = [];
    persist();
    updateUndo();
  };
  updateUndo();

  // ---------- saving: one queue, never two at once ----------
  type Job = { section?: string | null; place?: string | null; refresh: Refresh };
  const afterReady: (() => void)[] = [];
  const queue = new SaveQueue<Job>(
    (waiting, request) => ({
      ...(waiting ?? {}),
      ...(request.section !== undefined ? { section: request.section } : {}),
      ...(request.place !== undefined ? { place: request.place } : {}),
      refresh: { ...(waiting?.refresh ?? {}), ...request.refresh },
    }),
    async (job, more) => {
      saveStatus.saving();
      const r = await api<{ article: Article }>('PUT', `articles/${state.id}`, {
        article: doc,
        ...(job.section !== undefined ? { section: job.section } : {}),
        ...(job.place !== undefined ? { place: job.place } : {}),
        ifMatch: { [state.key]: state.version, ...(state.structureVersion ? { [STRUCTURE]: state.structureVersion } : {}), ...(state.planetVersion ? { [PLANET]: state.planetVersion } : {}) },
      });
      if (r.ok) {
        state.version = r.data.versions?.[state.key] ?? state.version;
        if (r.data.versions?.[STRUCTURE]) state.structureVersion = r.data.versions[STRUCTURE];
        if (r.data.versions?.[PLANET]) state.planetVersion = r.data.versions[PLANET];
        if (job.section !== undefined) state.section = job.section ?? '';
        if (job.place !== undefined) state.place = job.place ?? '';
        const server = r.data.article;
        // edits made while this save was in flight are newer than the server's copy: keep them
        doc = more() ? { ...doc, updatedAt: server.updatedAt, ...(server.publishedAt ? { publishedAt: server.publishedAt } : {}) } : server;
        saved = structuredClone(server);
        clearIssues();
        if (more()) saveStatus.saving();
        else saveStatus.saved();
        await refreshAll(job.refresh);
        return 'ok';
      }
      if (r.status === 409) {
        saveStatus.failed('Not saved: this article changed in another tab or on disk');
        dialog('editor-conflict')?.showModal();
        return 'stop';
      }
      doc = structuredClone(saved);
      showIssues(r.data.issues ?? []);
      saveStatus.failed(`Not saved: ${(r.data.issues ?? []).map(describeIssue).join('; ') || 'the change was refused'}`);
      return 'failed';
    },
  );
  const save = (opts: { section?: string | null; place?: string | null; refresh?: Refresh } = {}) =>
    queue.push({ ...(opts.section !== undefined ? { section: opts.section } : {}), ...(opts.place !== undefined ? { place: opts.place } : {}), refresh: opts.refresh ?? {} });

  // ---------- refreshing the outline, the inspector and the canvas ----------
  const reloadCanvas = () => frame.contentWindow?.location.reload();
  const swap = async (names: string[]) => {
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active?.id || (active?.dataset.editorSelect !== undefined ? `select:${active.dataset.editorSelect}` : '');
    const tab = root.querySelector<HTMLElement>('#inspector-tabs [role="tab"][aria-selected="true"]')?.dataset.tab;
    const scroll = root.querySelector<HTMLElement>('[data-editor-inspector]')?.scrollTop ?? 0;
    await swapRegions(names);
    Object.assign(state, { media: readState().media, ...(names.includes('state') ? { place: readState().place } : {}) });
    if (tab) root.querySelector('#inspector-tabs')?.dispatchEvent(new CustomEvent('tabs:select', { detail: { tab } }));
    const ins = root.querySelector<HTMLElement>('[data-editor-inspector]');
    if (ins) ins.scrollTop = scroll;
    showBlock(selected);
    if (focusKey) {
      const el = focusKey.startsWith('select:') ? root.querySelector<HTMLElement>(`[data-editor-select="${focusKey.slice(7)}"]`) : document.getElementById(focusKey);
      el?.focus({ preventScroll: true });
    }
  };
  const refreshAll = async (r: Refresh) => {
    const names = [...(r.outline ? ['outline'] : []), ...(r.inspector ? ['inspector', 'state'] : [])];
    if (names.length) await swap(names);
    if (r.canvas) reloadCanvas();
  };

  // ---------- changes made elsewhere: another tab, another screen, a file changed by hand ----------
  // This article, changed elsewhere, comes in at once when nothing here is unsaved (and stops everything
  // with the conflict dialog when something is). Anything else it shows (a picture's caption, a page it
  // links to, the sections) comes in once the typing stops, so the caret is never pulled away.
  let typingAt = 0;
  const typing = () => Date.now() - typingAt < 1500;
  const unsaved = () => queue.pending || typing() || JSON.stringify(doc) !== JSON.stringify(saved);
  let heard = new Set<string>();
  let fromTab = false;
  let soon = 0;
  const bringIn = async () => {
    const files = heard;
    const where = fromTab ? 'in another tab' : 'on disk';
    if (files.has(state.key) && unsaved()) {
      heard = new Set();
      saveStatus.failed(`Not saved: this article changed ${where}`);
      dialog('editor-conflict')?.showModal();
      return;
    }
    if (queue.pending || typing() || document.querySelector('dialog[open]')) {
      soon = window.setTimeout(() => void bringIn(), 600);
      return;
    }
    heard = new Set();
    fromTab = false;
    await swap(['outline', 'inspector', 'state']);
    const fresh = readState();
    if (files.has(state.key)) {
      doc = fresh.article;
      saved = structuredClone(fresh.article);
      state.version = fresh.version;
    }
    Object.assign(state, { structureVersion: fresh.structureVersion, planetVersion: fresh.planetVersion, section: fresh.section, place: fresh.place, published: fresh.published, publicPath: fresh.publicPath });
    reloadCanvas();
    announce(files.has(state.key) ? `Updated with changes made ${where}` : `Updated with a change made ${where}`);
  };
  onContentChange(({ files, origin }) => {
    files.forEach((f) => heard.add(f));
    if (origin) fromTab = true;
    clearTimeout(soon);
    soon = window.setTimeout(() => void bringIn(), 250);
  }, signal);

  // ---------- selection ----------
  const showBlock = (i: number | null) => {
    root.querySelectorAll<HTMLFormElement>('[data-block-form]').forEach((f) => (f.hidden = Number(f.dataset.blockForm) !== i));
    const none = root.querySelector<HTMLElement>('[data-editor-noblock]');
    if (none) none.hidden = i !== null && i < doc.body.length;
    const several = picked.size > 1;
    root.querySelectorAll<HTMLElement>('[data-editor-select]').forEach((b) => {
      const n = Number(b.dataset.editorSelect);
      const on = n === i;
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
      if (several && picked.has(n)) b.setAttribute('aria-pressed', 'true');
      else b.removeAttribute('aria-pressed');
      b.closest('[data-row]')?.toggleAttribute('data-current', on);
      b.closest('[data-row]')?.toggleAttribute('data-picked', several && picked.has(n));
    });
    const bar = root.querySelector<HTMLElement>('[data-editor-multibar]');
    if (bar) bar.hidden = !several;
    const count = root.querySelector<HTMLElement>('[data-editor-multicount]');
    if (count) count.textContent = several ? `${picked.size} blocks selected` : '';
  };
  const setSelected = (i: number | null, opts: { tab?: boolean; canvas?: boolean; scroll?: boolean; keep?: boolean } = {}) => {
    selected = i !== null && i >= 0 && i < doc.body.length ? i : null;
    // a plain selection ends a selection of several
    if (!opts.keep) {
      picked = new Set();
      anchor = selected;
    }
    showBlock(selected);
    if (opts.tab && selected !== null) root.querySelector('#inspector-tabs')?.dispatchEvent(new CustomEvent('tabs:select', { detail: { tab: 'block' } }));
    if (opts.canvas) toCanvas({ type: 'select', index: selected, scroll: !!opts.scroll });
    sessionStorage.setItem(`editor.selected.${state.id}`, String(selected ?? ''));
  };

  // ---------- issues on fields ----------
  const clearIssues = () => {
    root.querySelectorAll('[data-editor-issue]').forEach((p) => {
      (p as HTMLElement).hidden = true;
      p.textContent = '';
    });
    root.querySelectorAll('[data-editor-inspector] [aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  };
  const showIssues = (issues: Issue[]) => {
    for (const i of issues) {
      const field = i.path ? root.querySelector<HTMLElement>(`[data-editor-inspector] [name="${CSS.escape(i.path)}"]`) : null;
      field?.setAttribute('aria-invalid', 'true');
      const form = field?.closest('form') ?? (selected !== null ? root.querySelector(`[data-block-form="${selected}"]`) : root.querySelector('[data-page-form]'));
      const p = form?.querySelector<HTMLElement>('[data-editor-issue]');
      if (p) {
        p.textContent = describeIssue(i);
        p.hidden = false;
      }
    }
  };

  // ---------- changes ----------
  const change = (next: Article, refresh: Refresh, opts: { select?: number | null; section?: string | null; place?: string | null; history?: boolean; picked?: number[] } = {}) => {
    if (opts.history !== false) checkpoint();
    doc = next;
    if (opts.select !== undefined) selected = opts.select;
    picked = new Set(opts.picked ?? []);
    if (!opts.picked) anchor = selected;
    void save({ refresh, ...(opts.section !== undefined ? { section: opts.section } : {}), ...(opts.place !== undefined ? { place: opts.place } : {}) });
  };
  const body = (b: Block[]) => ({ ...doc, body: b });
  const blockOp = (i: number, op: 'up' | 'down' | 'duplicate' | 'delete') => {
    if (op === 'up' && i > 0) change(body(ops.move(doc.body, i, i - 1)), ALL, { select: i - 1 });
    else if (op === 'down' && i < doc.body.length - 1) change(body(ops.move(doc.body, i, i + 1)), ALL, { select: i + 1 });
    else if (op === 'duplicate') change(body(ops.duplicate(doc.body, i)), ALL, { select: i + 1 });
    else if (op === 'delete') {
      change(body(ops.remove(doc.body, i)), ALL, { select: doc.body.length > 1 ? Math.max(0, i - 1) : null });
      announce(`Deleted: Undo brings it back`);
    }
  };
  const insertBlock = (at: number, block: Block) => change(body(ops.insert(doc.body, at, block)), ALL, { select: at });

  // ---------- several blocks at once ----------
  const announcePicked = () => announce(picked.size > 1 ? `${picked.size} blocks selected` : '');
  const pickRange = (to: number) => {
    const from = anchor ?? selected ?? to;
    picked = new Set(ops.range(from, to));
    anchor = from;
    setSelected(to, { tab: true, canvas: true, scroll: true, keep: true });
    announcePicked();
  };
  const pickToggle = (n: number) => {
    if (!picked.size && selected !== null) picked.add(selected);
    if (picked.has(n)) picked.delete(n);
    else picked.add(n);
    anchor = n;
    const primary = picked.has(n) ? n : (group().at(-1) ?? null);
    setSelected(primary, { tab: true, canvas: true, scroll: picked.has(n), keep: true });
    announcePicked();
  };
  const pickAll = () => {
    picked = new Set(doc.body.map((_, k) => k));
    anchor = 0;
    setSelected(selected ?? 0, { keep: true });
    announcePicked();
  };
  const clearPicked = () => {
    if (picked.size < 2) return;
    picked = new Set();
    anchor = selected;
    showBlock(selected);
    announce('Selection cleared');
  };
  /** Where a block in the group went (the one the inspector shows, or the one with the focus). */
  const follow = (before: number[], after: number[], n: number | null) => (n !== null && before.includes(n) ? after[before.indexOf(n)] : (after[0] ?? null));
  const moveGroup = (dir: -1 | 1, focus?: number) => {
    const before = group();
    const r = ops.moveMany(doc.body, before, dir);
    if (r.body === doc.body) return announce(dir < 0 ? 'The selected blocks are already at the top' : 'The selected blocks are already at the end');
    change(body(r.body), ALL, { select: follow(before, r.indices, selected), picked: r.indices });
    anchor = follow(before, r.indices, anchor);
    announce(`Moved ${r.indices.length} blocks to positions ${r.indices[0] + 1} to ${r.indices[r.indices.length - 1] + 1} of ${doc.body.length}`);
    if (focus !== undefined) {
      const to = follow(before, r.indices, focus);
      afterReady.push(() => root.querySelector<HTMLElement>(`[data-editor-select="${to}"]`)?.focus());
    }
  };
  const deleteGroup = () => {
    const at = group();
    change(body(ops.removeMany(doc.body, at)), ALL, { select: doc.body.length > at.length ? Math.max(0, Math.min(at[0], doc.body.length - at.length - 1)) : null });
    announce(`Deleted ${at.length} blocks: Undo brings them back`);
  };
  const inGroup = (i: number) => picked.size > 1 && picked.has(i);

  // ---------- turning blocks into another kind ----------
  let turnTarget: number[] = [];
  const KIND_NAME = Object.fromEntries(ops.TEXT_KINDS.map((k) => [k.value, k.label.toLowerCase()])) as Record<ops.TextKind, string>;
  const isKind = (v: string): v is ops.TextKind => ops.TEXT_KINDS.some((k) => k.value === v);
  /** Opens the choices that fit the blocks (one, or a selection), each one's kind marked, a choice that can't be used disabled with why. */
  const openTurn = (indices: number[]) => {
    const d = dialog('editor-turn');
    turnTarget = indices.filter((k) => k >= 0 && k < doc.body.length).sort((a, b) => a - b);
    if (!d || !turnTarget.length) return;
    const blocks = turnTarget.map((k) => doc.body[k]);
    const one = blocks.length === 1 ? blocks[0] : null;
    const texts = blocks.filter((b) => ops.textKindOf(b) !== null).length;
    const choice = (v: string) => d.querySelector<HTMLButtonElement>(`[data-editor-turn-to="${v}"]`)!;
    const set = (v: string, shown: boolean, enabled = true) => {
      const c = choice(v);
      c.hidden = !shown;
      c.disabled = !enabled;
      c.removeAttribute('aria-current');
    };
    for (const k of ops.TEXT_KINDS) set(k.value, texts > 0);
    if (one && ops.textKindOf(one)) choice(ops.textKindOf(one)!).setAttribute('aria-current', 'true');
    const tiles = ops.asTiles(blocks);
    set('join-bulleted', blocks.length > 1, texts === blocks.length);
    set('join-numbered', blocks.length > 1, texts === blocks.length);
    set('tiles', blocks.length > 1, tiles.ok);
    set('split', !!one && !!ops.splitLines(one));
    set('untile', one?.type === 'tiles');
    d.querySelectorAll<HTMLElement>('[data-turn-group]').forEach((g) => (g.hidden = !g.querySelector('[data-editor-turn-to]:not([hidden])')));
    const why = d.querySelector<HTMLElement>('[data-editor-turn-why]')!;
    why.textContent = blocks.length > 1 && !tiles.ok ? `Tiles: ${tiles.why}` : blocks.length > 1 && texts < blocks.length ? 'Only text (headings, paragraphs, quotes and lists) becomes a different kind; the rest stays as it is.' : '';
    why.hidden = !why.textContent;
    d.showModal();
    d.querySelector<HTMLElement>('[data-editor-turn-to]:not([hidden]):not(:disabled)')?.focus();
  };
  /** Turns the blocks into another kind: each one (a text kind), several into one (a list, tiles) or one into several. */
  const turnInto = (indices: number[], to: string) => {
    const at = indices.filter((k) => k >= 0 && k < doc.body.length).sort((a, b) => a - b);
    if (!at.length) return;
    const blocks = at.map((k) => doc.body[k]);
    const instead = (out: Block[]) => ops.insert(ops.removeMany(doc.body, at), at[0], ...out);
    if (isKind(to)) {
      const changing = at.filter((k) => ops.textKindOf(doc.body[k]) !== null && ops.textKindOf(doc.body[k]) !== to);
      if (!changing.length) return announce(at.length > 1 ? `They're already ${KIND_NAME[to]}s` : `It's already a ${KIND_NAME[to]}`);
      let next = doc.body;
      for (const k of changing) next = ops.replace(next, k, ops.convertText(next[k], to));
      change(body(next), ALL, at.length > 1 ? { select: selected, picked: at } : { select: at[0] });
      return announce(at.length > 1 ? `Turned ${changing.length} blocks into: ${KIND_NAME[to]}` : `Turned into a ${KIND_NAME[to]}`);
    }
    if (to === 'join-bulleted' || to === 'join-numbered') {
      if (blocks.some((b) => ops.textKindOf(b) === null)) return announce('Only text can be joined into a list', 'negative');
      change(body(instead([ops.joinAsList(blocks, to === 'join-numbered')])), ALL, { select: at[0] });
      return announce(`Joined ${at.length} blocks into one list`);
    }
    if (to === 'tiles') {
      const r = ops.asTiles(blocks);
      if (!r.ok) return announce(r.why, 'negative');
      change(body(instead([r.block])), ALL, { select: at[0] });
      return announce(`Made ${at.length / 2} tiles`);
    }
    if (to === 'split') {
      const parts = ops.splitLines(blocks[0]);
      if (!parts) return;
      change(body(instead(parts)), ALL, { select: at[0] });
      return announce(`Split into ${parts.length} paragraphs`);
    }
    if (to === 'untile') {
      const parts = ops.tilesToText(blocks[0]);
      if (!parts) return;
      change(body(instead(parts)), ALL, { select: at[0] });
      return announce(`Turned into ${parts.length / 2} headings and paragraphs`);
    }
  };

  // ---------- undo and redo ----------
  const undo = () => {
    toCanvas({ type: 'flush' });
    picked = new Set();
    const prev = hist.past.pop();
    if (!prev) return;
    hist.future.push(JSON.stringify(doc));
    persist();
    updateUndo();
    doc = JSON.parse(prev);
    void save({ refresh: ALL });
    announce('Undone');
  };
  const redo = () => {
    picked = new Set();
    const next = hist.future.pop();
    if (!next) return;
    hist.past.push(JSON.stringify(doc));
    persist();
    updateUndo();
    doc = JSON.parse(next);
    void save({ refresh: ALL });
    announce('Redone');
  };

  // ---------- the canvas's messages ----------
  let textSession = -1;
  on(window, 'message', (e) => {
    const m = (e as MessageEvent).data as { source?: string; type: string; [k: string]: unknown };
    if ((e as MessageEvent).origin !== location.origin || (e as MessageEvent).source !== frame.contentWindow || m?.source !== 'editor-canvas') return;
    switch (m.type) {
      case 'ready': {
        toCanvas({ type: 'mode', preview: document.querySelector('[data-editor-preview]')?.getAttribute('aria-pressed') === 'true' });
        if (selected !== null) toCanvas({ type: 'select', index: selected });
        afterReady.splice(0).forEach((fn) => fn());
        break;
      }
      case 'typing':
        typingAt = Date.now();
        saveStatus.dirty();
        break;
      case 'select':
        if (m.field) {
          setSelected(null);
          root.querySelector('#inspector-tabs')?.dispatchEvent(new CustomEvent('tabs:select', { detail: { tab: 'page' } }));
        } else setSelected(m.index as number | null, { tab: true });
        break;
      case 'text': {
        const i = m.index as number;
        const b = doc.body[i];
        const value = String(m.value ?? '');
        if (!b) break;
        if (!value.trim()) {
          if (m.final && b.type === 'text') blockOp(i, 'delete');
          break;
        }
        if (m.session !== textSession) {
          textSession = m.session as number;
          checkpoint();
        }
        const next: Block = b.type === 'text' ? { ...b, markdown: value } : b.type === 'heading' || b.type === 'quote' ? { ...b, text: value } : b;
        doc = body(ops.replace(doc.body, i, next));
        void save({ refresh: m.final ? { outline: true } : {} });
        break;
      }
      case 'field': {
        const f = m.field as 'title' | 'summary';
        const value = String(m.value ?? '').trim();
        if (!value) break;
        if (m.session !== textSession) {
          textSession = m.session as number;
          checkpoint();
        }
        doc = { ...doc, [f]: value };
        void save({ refresh: m.final ? { inspector: true } : {} });
        break;
      }
      case 'split': {
        const i = m.index as number;
        const parts = m.parts as string[];
        change(body(ops.split(doc.body, i, parts)), ALL, { select: i + 1 });
        const endOfBlock = !String(parts[parts.length - 1] ?? '').trim();
        afterReady.push(() => (endOfBlock ? toCanvas({ type: 'pending', index: i + 1, kind: 'text' }) : toCanvas({ type: 'focus', index: i + parts.length - 1, at: 'start' })));
        break;
      }
      case 'paste': {
        // the canvas made the blocks (from the copy's HTML, or its plain text read as Markdown)
        const blocks = Array.isArray(m.blocks) ? (m.blocks as Block[]) : paste.blocksFromMarkdown(String(m.text ?? '')).blocks;
        const pictures = Number(m.pictures) || 0;
        if (!blocks.length) break;
        const r = paste.pasteAt(doc.body, m.index as number, { replace: !m.pending, before: String(m.before ?? ''), after: String(m.after ?? '') }, blocks);
        change(body(r.body), ALL, { select: r.focus });
        afterReady.push(() => toCanvas({ type: 'focus', index: r.focus, at: r.caret }));
        const left = pictures ? ` Left out ${pictures === 1 ? 'a picture' : `${pictures} pictures`}: add pictures from the media library.` : '';
        announce(`Pasted ${blocks.length === 1 ? 'a block' : `${blocks.length} blocks`}.${left}`);
        break;
      }
      case 'paste-picture': {
        // a picture (or a video file) pasted on the page: the picker, with it in the upload form; uploaded,
        // it's a figure (or a video) there
        const at = m.index as number;
        if (!(m.file instanceof File)) break;
        if (isVideoFile(m.file)) openPicker({ mode: 'single', min: 1, kind: 'video', title: 'Add the pasted video', onChoose: (ids) => insertBlock(at, { type: 'video', media: ids[0], width: 'wide' }) });
        else openPicker({ mode: 'single', min: 1, title: 'Add the pasted picture', onChoose: (ids) => insertBlock(at, { type: 'figure', media: ids[0], width: 'content', lightbox: true }) });
        dialog('editor-picker')?.querySelector('[data-editor-media-grid]')?.dispatchEvent(new CustomEvent('media:file', { detail: { file: m.file } }));
        break;
      }
      case 'merge': {
        const i = m.index as number;
        const prev = doc.body[i - 1];
        const offset = prev?.type === 'text' ? plainText(prev.markdown).length : 0;
        change(body(ops.merge(doc.body, i)), ALL, { select: i - 1 });
        afterReady.push(() => toCanvas({ type: 'focus', index: i - 1, at: offset }));
        break;
      }
      case 'insert':
        openPalette(m.index as number);
        break;
      case 'op':
        blockOp(m.index as number, m.op as 'up' | 'down' | 'duplicate' | 'delete');
        break;
      case 'turn':
        if (typeof m.to === 'string') turnInto([m.index as number], m.to);
        else openTurn([m.index as number]);
        break;
      case 'pending': {
        const at = m.index as number;
        const block: Block = m.kind === 'heading' ? { type: 'heading', level: 2, text: String(m.value) } : { type: 'text', markdown: String(m.value) };
        change(body(ops.insert(doc.body, at, block)), { outline: true, inspector: true }, { select: at });
        break;
      }
      case 'link-request':
        openLink(String(m.href ?? ''));
        break;
      case 'key':
        if (m.key === 'undo') undo();
        else if (m.key === 'redo') redo();
        else if (m.key === 'save') void save();
        else if (m.key === 'settings') root.querySelector<HTMLElement>(`[data-block-form="${selected}"] input, [data-block-form="${selected}"] [role="combobox"], [data-block-form="${selected}"] button`)?.focus();
        break;
    }
  });

  // ---------- who can see it (documentation/access/spec.md §8.2) ----------
  // The page's file and the media only it uses move between content/ and private-pages/ in one
  // transaction, so what's unsaved here is saved first, and the editor reloads on the page's new file.
  const ACCESS_ASK: Record<NonNullable<State['access']>, string> = {
    open: 'Make this page public? It moves back to content/, and once you publish, it and its pictures are on the site for everyone and in the public repository’s history.',
    private: 'Make this page private? It moves to private-pages/ and is listed in its section only for readers you share it with, by an access code or a magic link. If it was published openly before, that earlier version stays in the public repository’s history.',
  };
  const moveProtected = async (to: NonNullable<State['access']>, section: string | undefined, what: string) => {
    await save();
    if (queue.pending || JSON.stringify(doc) !== JSON.stringify(saved)) return;
    saveStatus.saving();
    const r = await api('PUT', `articles/${state.id}/access`, { access: to, ...(section ? { section } : {}) });
    if (!r.ok) {
      showIssues((r.data.issues ?? []).map((i) => ({ ...i, path: i.path === 'section' ? '__section' : '__access' })));
      saveStatus.failed(`Not changed: ${(r.data.issues ?? []).map(describeIssue).join('; ') || 'the change was refused'}`);
      await swap(['inspector']);
      return;
    }
    saveStatus.carry(what);
    location.reload();
  };
  const setAccess = async (to: State['access'], field: HTMLInputElement) => {
    if (!to || to === state.access) return;
    const section = root.querySelector<HTMLInputElement>('[data-editor-inspector] [name="__section"]')?.value || undefined;
    if (!section) {
      showIssues([{ file: state.key, path: '__section', message: 'a private page is in a section, like any page: choose one first' }]);
      field.value = state.access ?? 'open';
      await swap(['inspector']);
      return;
    }
    if (!confirm(ACCESS_ASK[to])) {
      await swap(['inspector']);
      return;
    }
    await moveProtected(to, section, to === 'open' ? 'Made public' : 'Made private');
  };
  // a private page's new address: every link to the old one, magic links included, stops working
  on(root, 'click', async (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-editor-address]');
    if (!b) return;
    if (!confirm('Change this page’s address? Every link to it stops working, including magic links already sent.')) return;
    saveStatus.saving();
    const r = await api('POST', `articles/${state.id}/address`);
    if (!r.ok) return void saveStatus.failed(`Not changed: ${(r.data.issues ?? []).map(describeIssue).join('; ') || 'the change was refused'}`);
    saveStatus.carry('Address changed');
    location.reload();
  });

  // ---------- the inspector's fields ----------
  on(root, 'change', (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.name || !t.closest('[data-editor-inspector]')) return;
    const kind = t.closest<HTMLElement>('[data-type]')?.dataset.type ?? 'text';
    const bad = (msg: string) => showIssues([{ file: state.key, path: t.name, message: msg }]);
    let value: unknown;
    if (t.type === 'checkbox') value = kind === 'bool-default-true' ? (t.checked ? undefined : false) : t.checked ? true : undefined;
    else if (kind === 'number') value = Number(t.value);
    else if (kind === 'duration') {
      const d = ops.parseDuration(t.value);
      if (d === null) return bad('Write the length as minutes and seconds (2:20).');
      value = d;
    } else if (kind === 'video-url') {
      const v = ops.parseVideo(t.value);
      if (!v) return bad('Use a YouTube or Vimeo link (https://youtu.be/…, https://vimeo.com/…).');
      value = v;
    } else value = t.value.trim() === '' ? undefined : t.value;
    if (t.name === '__access') return void setAccess(String(value ?? 'open') as State['access'], t);
    if (t.name === '__section' && state.access === 'private') {
      if (!value) {
        showIssues([{ file: state.key, path: '__section', message: 'a private page is always in a section: choose one, or make it public first' }]);
        return;
      }
      return void moveProtected('private', String(value), 'Moved to another section');
    }
    if (t.name === '__section') return change(doc, ALL, { section: (value as string | undefined) ?? null });
    if (t.name === '__place') return change(doc, { inspector: true }, { place: (value as string | undefined) ?? null });
    const renders = t.name.startsWith('body.') || t.name.startsWith('hero.') || ['title', 'summary', 'publishedAt', 'kind'].includes(t.name);
    change(ops.setPath(doc, t.name, value), { canvas: renders, outline: t.name.startsWith('body.') });
  });

  // ---------- clicks ----------
  let insertAt = doc.body.length;
  let pick: Pick | null = null;
  const chosen = new Set<string>();

  const openPalette = (at: number) => {
    insertAt = at;
    toCanvas({ type: 'flush' });
    dialog('editor-palette')?.showModal();
  };
  const openPicker = (p: Pick) => {
    pick = p;
    chosen.clear();
    const d = dialog('editor-picker');
    if (!d) return;
    const title = d.querySelector(`#editor-picker-title`);
    if (title) title.textContent = p.title;
    d.querySelectorAll('[data-editor-media]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    pickKind();
    syncPicker();
    d.showModal();
  };
  /** The picker's grid shows only what it takes (and keeps doing so when the grid is drawn again). */
  const pickKind = () => {
    const grid = dialog('editor-picker')?.querySelector<HTMLElement>('[data-editor-media-grid]');
    if (grid) grid.dataset.pickKind = pick?.kind ?? 'image';
  };
  const syncPicker = () => {
    const d = dialog('editor-picker');
    const use = d?.querySelector<HTMLButtonElement>('[data-editor-media-use]');
    const count = d?.querySelector<HTMLElement>('[data-editor-media-count]');
    if (count) count.textContent = pick?.mode === 'multiple' ? `${chosen.size} chosen (at least ${pick.min})` : 'Choose one';
    if (use) {
      use.disabled = !pick || chosen.size < (pick?.min ?? 1);
      use.hidden = pick?.mode !== 'multiple';
    }
  };
  const choose = (ids: string[]) => {
    const p = pick;
    pick = null;
    dialog('editor-picker')?.close();
    p?.onChoose(ids);
  };
  let linkRequest = '';
  const openLink = (href: string) => {
    linkRequest = href;
    const d = dialog('editor-insert-link');
    const input = d?.querySelector<HTMLInputElement>('input[name="href"]');
    if (input) input.value = href.startsWith('ref:') ? '' : href;
    d?.showModal();
  };

  on(root, 'click', (e) => {
    const t = e.target as Element;
    const el = t.closest<HTMLElement>(
      '[data-editor-select], [data-editor-move], [data-editor-group], [data-editor-add-at], [data-editor-block-op], [data-editor-turn-open], [data-editor-turn-to], [data-editor-pick], [data-editor-crop], [data-editor-clear], [data-editor-items], [data-editor-facts], [data-editor-tiles], [data-editor-add], [data-editor-media], [data-editor-media-use], [data-editor-unlink], [data-editor-reload]',
    );
    if (!el) return;
    const d = el.dataset;
    const i = Number(d.index ?? d.editorSelect ?? -1);
    if (d.editorSelect !== undefined) {
      const n = Number(d.editorSelect);
      const m = e as MouseEvent;
      if (m.shiftKey) return pickRange(n);
      if (m.ctrlKey || m.metaKey) return pickToggle(n);
      return setSelected(n, { tab: true, canvas: true, scroll: true });
    }
    if (d.editorGroup === 'turn') return openTurn(group());
    if (d.editorGroup) return d.editorGroup === 'clear' ? clearPicked() : moveGroup(d.editorGroup === 'up' ? -1 : 1);
    if (d.editorMove) return inGroup(i) ? moveGroup(d.editorMove === 'up' ? -1 : 1) : blockOp(i, d.editorMove as 'up' | 'down');
    if (d.editorAddAt !== undefined) return openPalette(Number(d.editorAddAt));
    if (d.editorBlockOp) return blockOp(i, d.editorBlockOp as 'duplicate' | 'delete');
    if (d.editorTurnOpen !== undefined) return openTurn(inGroup(Number(d.editorTurnOpen)) ? group() : [Number(d.editorTurnOpen)]);
    if (d.editorTurnTo) {
      dialog('editor-turn')?.close();
      return turnInto(turnTarget, d.editorTurnTo);
    }
    if (d.editorPick) {
      const path = d.editorPick;
      const multiple = d.pickMode === 'multiple';
      const kind = d.pickKind === 'video' ? 'video' : 'image';
      return openPicker({
        mode: multiple ? 'multiple' : 'single',
        min: 1,
        kind,
        title: multiple ? 'Add pictures' : kind === 'video' ? 'Choose a video' : 'Choose a picture',
        onChoose: (ids) => {
          if (multiple) {
            const list = (ops.getPath(doc, path) as { media: string }[]) ?? [];
            change(ops.setPath(doc, path, [...list, ...ids.map((media) => ({ media }))]), ALL);
          } else if (path === 'hero.media') change({ ...doc, hero: { ...(doc.hero ?? {}), media: ids[0] } }, ALL);
          else change(ops.setPath(doc, path, ids[0]), ALL);
        },
      });
    }
    if (d.editorCrop) {
      // a field's picture, cropped for its use; the thumbnail left empty crops the lead picture into one
      const path = d.editorCrop;
      const own = ops.getPath(doc, path) as string | undefined;
      const id = own ?? (path === 'thumbnail' ? doc.hero?.media : undefined);
      if (!id) return;
      const use = path === 'hero.media' ? PICTURE_SPECS.lead : path === 'thumbnail' ? PICTURE_SPECS.thumbnail : undefined;
      return openCrop({
        id,
        use,
        copy: !own,
        onSaved: (next) => {
          // the same cropped copy, cut again: only the pictures change
          if (next === id && own) return void refreshAll(ALL);
          if (path === 'hero.media') change({ ...doc, hero: { ...(doc.hero ?? {}), media: next } }, ALL);
          else change(ops.setPath(doc, path, next), ALL);
        },
      });
    }
    if (d.editorClear === 'hero') {
      const { hero: _h, ...rest } = doc;
      return change(rest as Article, ALL);
    }
    if (d.editorClear === 'thumbnail') {
      const { thumbnail: _t, ...rest } = doc;
      return change(rest as Article, ALL);
    }
    if (d.editorClear === 'portrait') {
      const { portrait: _p, ...rest } = doc;
      return change(rest as Article, ALL);
    }
    if (d.editorItems) {
      const b = doc.body[i] as Extract<Block, { type: 'gallery' | 'carousel' }>;
      const n = Number(d.item);
      const items = d.editorItems === 'remove' ? b.items.filter((_, k) => k !== n) : ops.move(b.items as unknown as Block[], n, d.editorItems === 'up' ? n - 1 : n + 1);
      return change(body(ops.replace(doc.body, i, { ...b, items } as Block)), ALL);
    }
    if (d.editorFacts) {
      const b = doc.body[i] as Extract<Block, { type: 'facts' }>;
      const items = d.editorFacts === 'add' ? [...b.items, { label: 'Label', value: 'Value' }] : b.items.filter((_, k) => k !== Number(d.item));
      return change(body(ops.replace(doc.body, i, { ...b, items })), ALL);
    }
    if (d.editorTiles) {
      const b = doc.body[i] as Extract<Block, { type: 'tiles' }>;
      const items = d.editorTiles === 'add' ? [...b.items, { label: 'Label', text: 'What it says.' }] : b.items.filter((_, k) => k !== Number(d.item));
      return change(body(ops.replace(doc.body, i, { ...b, items })), ALL);
    }
    if (d.editorAdd) {
      dialog('editor-palette')?.close();
      return addBlock(d.editorAdd);
    }
    if (d.editorMedia && pick) {
      const id = d.editorMedia;
      if (pick.mode === 'single') return choose([id]);
      if (chosen.has(id)) chosen.delete(id);
      else chosen.add(id);
      el.setAttribute('aria-pressed', chosen.has(id) ? 'true' : 'false');
      return syncPicker();
    }
    if (d.editorMediaUse !== undefined && pick) return choose([...chosen]);
    if (d.editorUnlink !== undefined) {
      dialog('editor-insert-link')?.close();
      return toCanvas({ type: 'link', href: '' });
    }
    if (d.editorReload !== undefined) return location.reload();
  });

  const addBlock = (type: string) => {
    const at = insertAt;
    if (type === 'text' || type === 'heading') return toCanvas({ type: 'pending', index: at, kind: type });
    if (type === 'divider') return insertBlock(at, { type: 'divider' });
    if (type === 'quote' || type === 'facts' || type === 'tiles') return dialog(`editor-insert-${type}`)?.showModal();
    // a YouTube or Vimeo video: its address and title, then its poster
    if (type === 'embed') return dialog('editor-insert-video')?.showModal();
    // a video file: one from the library, or one uploaded there and then
    if (type === 'video')
      return openPicker({ mode: 'single', min: 1, kind: 'video', title: 'Choose or upload a video', onChoose: (ids) => insertBlock(at, { type: 'video', media: ids[0], width: 'wide' }) });
    if (type === 'figure')
      return openPicker({ mode: 'single', min: 1, title: 'Choose a picture', onChoose: (ids) => insertBlock(at, { type: 'figure', media: ids[0], width: 'content', lightbox: true }) });
    if (type === 'gallery')
      return openPicker({ mode: 'multiple', min: 2, title: 'Choose the pictures (two or more)', onChoose: (ids) => insertBlock(at, { type: 'gallery', items: ids.map((media) => ({ media })), layout: 'grid', lightbox: true }) });
    if (type === 'carousel')
      return openPicker({
        mode: 'multiple',
        min: 2,
        title: 'Choose the pictures (two or more)',
        onChoose: (ids) => {
          pendingCarousel = ids;
          dialog('editor-insert-carousel')?.showModal();
        },
      });
  };
  let pendingCarousel: string[] = [];
  let pendingVideo: { embed: { provider: 'youtube' | 'vimeo'; id: string }; title: string; duration?: number } | null = null;

  on(root, 'submit', (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('[data-editor-insert-form]');
    if (!form) return;
    e.preventDefault();
    const data = new FormData(form);
    const val = (k: string) => String(data.get(k) ?? '').trim();
    const issue = (msg: string) => {
      const p = form.querySelector<HTMLElement>('[data-editor-form-issue]')!;
      p.textContent = msg;
      p.hidden = !msg;
    };
    const kind = form.dataset.editorInsertForm;
    const close = () => {
      issue('');
      form.reset();
      form.closest('dialog')?.close();
    };
    if (kind === 'quote') {
      if (!val('text')) return issue('Write the quote.');
      close();
      return insertBlock(insertAt, { type: 'quote', text: val('text'), variant: (val('variant') || 'pull') as 'pull' | 'block', ...(val('cite') ? { cite: val('cite') } : {}) });
    }
    if (kind === 'facts') {
      const items = [0, 1, 2].map((n) => ({ label: val(`label${n}`), value: val(`value${n}`) })).filter((f) => f.label && f.value);
      if (!items.length) return issue('Give at least one label and its value.');
      close();
      return insertBlock(insertAt, { type: 'facts', items });
    }
    if (kind === 'tiles') {
      const items = [0, 1, 2, 3].map((n) => ({ label: val(`label${n}`), text: val(`text${n}`) })).filter((t) => t.label && t.text);
      if (items.length < 2) return issue('Give at least two tiles, each a label and its text.');
      if (items.some((t) => t.label.length > 40)) return issue('Keep each label to 40 characters.');
      close();
      return insertBlock(insertAt, { type: 'tiles', items });
    }
    if (kind === 'carousel') {
      if (!val('label')) return issue('Name the carousel.');
      const ids = pendingCarousel;
      close();
      return insertBlock(insertAt, { type: 'carousel', items: ids.map((media) => ({ media })), label: val('label'), lightbox: true });
    }
    if (kind === 'video') {
      const embed = ops.parseVideo(val('url'));
      if (!embed) return issue('Use a YouTube or Vimeo link.');
      if (!val('title')) return issue('Give the video a title.');
      const duration = ops.parseDuration(val('duration'));
      if (duration === null) return issue('Write the length as minutes and seconds (2:20).');
      pendingVideo = { embed, title: val('title'), ...(duration ? { duration } : {}) };
      const at = insertAt;
      close();
      return openPicker({
        mode: 'single',
        min: 1,
        title: 'Choose the poster',
        onChoose: (ids) => {
          if (pendingVideo) insertBlock(at, { type: 'video', ...pendingVideo, poster: ids[0], width: 'wide' });
          pendingVideo = null;
        },
      });
    }
    if (kind === 'link') {
      const href = val('href');
      const ref = val('ref');
      const target = ref || href || linkRequest;
      if (target && !/^(https?:\/\/|mailto:|ref:)/i.test(target)) return issue('Use an address that starts with https://, http:// or mailto:, or choose an article.');
      close();
      return toCanvas({ type: 'link', href: target });
    }
  });

  // a picture (or video) uploaded from the picker is chosen at once, when it's the kind the picker takes
  on(root, 'media:uploaded' as keyof DocumentEventMap, async (e) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    await swap(['media-grid', 'state']);
    pickKind();
    announce('Uploaded');
    const kind = root.querySelector<HTMLElement>(`[data-media-card="${CSS.escape(id)}"]`)?.dataset.mediaKind ?? 'image';
    if (pick && kind !== (pick.kind ?? 'image')) return announce(kind === 'video' ? 'Uploaded the video: it’s in the library, but this takes a picture.' : 'Uploaded the picture: it’s in the library, but this takes a video.');
    if (pick?.mode === 'single') choose([id]);
    else if (pick) {
      chosen.add(id);
      root.querySelector(`[data-editor-media="${CSS.escape(id)}"]`)?.setAttribute('aria-pressed', 'true');
      syncPicker();
    }
  });

  // ---------- the outline: drag, and keys ----------
  on(root, 'pointerdown', (e) => {
    const grip = (e.target as Element).closest<HTMLElement>('[data-editor-drag]');
    if (!grip) return;
    e.preventDefault();
    const from = Number(grip.dataset.editorDrag);
    const rows = [...root.querySelectorAll<HTMLElement>('[data-editor-outline] [data-row]')];
    const row = rows[from];
    grip.setPointerCapture(e.pointerId);
    const middlesOf = () =>
      rows.map((r) => {
        const b = r.getBoundingClientRect();
        return b.top + b.height / 2;
      });
    if (inGroup(from)) {
      // the whole selection moves: it lands before the row under the pointer
      const before = group();
      before.forEach((k) => (rows[k].dataset.dragging = ''));
      let slot = -1;
      const moveAll = (ev: PointerEvent) => {
        const middles = middlesOf();
        const at = middles.findIndex((m) => ev.clientY < m);
        slot = at < 0 ? rows.length : at;
        rows.forEach((r, k) => {
          delete r.dataset.drop;
          if (slot < rows.length && k === slot) r.dataset.drop = 'before';
          if (slot === rows.length && k === rows.length - 1) r.dataset.drop = 'after';
        });
      };
      const upAll = () => {
        grip.removeEventListener('pointermove', moveAll);
        rows.forEach((r) => {
          delete r.dataset.drop;
          delete r.dataset.dragging;
        });
        if (slot < 0) return;
        const r = ops.moveGroupTo(doc.body, before, slot);
        if (r.indices.every((k, n) => k === before[n])) return;
        change(body(r.body), ALL, { select: follow(before, r.indices, selected), picked: r.indices });
        anchor = follow(before, r.indices, anchor);
        announce(`Moved ${r.indices.length} blocks to positions ${r.indices[0] + 1} to ${r.indices[r.indices.length - 1] + 1} of ${doc.body.length}`);
      };
      grip.addEventListener('pointermove', moveAll);
      grip.addEventListener('pointerup', upAll, { once: true });
      grip.addEventListener('pointercancel', upAll, { once: true });
      return;
    }
    row.dataset.dragging = '';
    let to = -1;
    const move = (ev: PointerEvent) => {
      const middles = middlesOf();
      to = ops.dropTarget(middles, ev.clientY, from);
      rows.forEach((r, k) => {
        delete r.dataset.drop;
        if (to < 0) return;
        if (to < from && k === to) r.dataset.drop = 'before';
        if (to > from && k === to) r.dataset.drop = 'after';
      });
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      rows.forEach((r) => delete r.dataset.drop);
      delete row.dataset.dragging;
      if (to >= 0) {
        change(body(ops.move(doc.body, from, to)), ALL, { select: to });
        announce(`Moved to position ${to + 1} of ${doc.body.length}`);
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
    grip.addEventListener('pointercancel', up, { once: true });
  });
  on(root, 'keydown', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-editor-select]');
    if (!b) return;
    const i = Number(b.dataset.editorSelect);
    const mod = e.ctrlKey || e.metaKey;
    const kind = ops.turnShortcut(e);
    if (kind) {
      e.preventDefault();
      turnInto(inGroup(i) ? group() : [i], kind);
      afterReady.push(() => root.querySelector<HTMLElement>(`[data-editor-select="${i}"]`)?.focus());
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && inGroup(i)) {
      e.preventDefault();
      moveGroup(e.key === 'ArrowUp' ? -1 : 1, i);
    } else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const next = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (next < 0 || next >= doc.body.length) return;
      if (anchor === null || !picked.size) anchor = i;
      pickRange(next);
      root.querySelector<HTMLElement>(`[data-editor-select="${next}"]`)?.focus();
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      pickAll();
    } else if (e.key === 'Escape' && picked.size > 1) {
      e.preventDefault();
      clearPicked();
    } else if (e.key === 'Delete' && inGroup(i)) {
      e.preventDefault();
      deleteGroup();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
      if (to < 0 || to >= doc.body.length) return;
      blockOp(i, e.key === 'ArrowUp' ? 'up' : 'down');
      announce(`Moved to position ${to + 1} of ${doc.body.length}`);
      afterReady.push(() => root.querySelector<HTMLElement>(`[data-editor-select="${to}"]`)?.focus());
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      root.querySelector<HTMLElement>(`[data-editor-select="${i + (e.key === 'ArrowUp' ? -1 : 1)}"]`)?.focus();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      blockOp(i, 'delete');
    }
  });

  // ---------- the top bar ----------
  on(document, 'click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-editor-undo], [data-editor-redo], [data-editor-device], [data-editor-preview]');
    if (!t) return;
    if (t.dataset.editorUndo !== undefined) return undo();
    if (t.dataset.editorRedo !== undefined) return redo();
    if (t.dataset.editorDevice) {
      canvasBox.dataset.device = t.dataset.editorDevice;
      document.querySelectorAll('[data-editor-device]').forEach((b) => b.setAttribute('aria-pressed', b === t ? 'true' : 'false'));
      sessionStorage.setItem('editor.canvas.device', t.dataset.editorDevice);
      return;
    }
    if (t.dataset.editorPreview !== undefined) {
      const on = t.getAttribute('aria-pressed') !== 'true';
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
      return toCanvas({ type: 'mode', preview: on });
    }
  });
  on(document, 'keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const inField = (e.target as Element).closest('input, textarea, [contenteditable="true"], [role="combobox"]');
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      toCanvas({ type: 'flush' });
      void save();
    } else if (mod && e.key.toLowerCase() === 'z' && !inField) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });
  const device = sessionStorage.getItem('editor.canvas.device');
  if (device) document.querySelector<HTMLElement>(`[data-editor-device="${device}"]`)?.click();
  addEventListener(
    'beforeunload',
    (e) => {
      toCanvas({ type: 'flush' });
      if (queue.pending) e.preventDefault();
    },
    { signal },
  );

  const last = sessionStorage.getItem(`editor.selected.${state.id}`);
  setSelected(last ? Number(last) : null);
}
