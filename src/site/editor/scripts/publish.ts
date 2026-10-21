/**
 * The Save to remote screen (documentation/editor/spec.md §7): Discard (after asking), Save to remote (commit content/
 * and push) and Push again. A publish that committed comes back to the screen with its commit in the
 * address, which shows its result and the link to its deploy; a push that failed says why.
 */
import { api, announce, describeIssue, remoteSaveStatus, swapRegions } from './client';
import { messageFor, privateNote, saveLabel } from '../model/selection';

// the changes unticked (by resource), kept while the list is drawn again; a save clears them
const leftOut = new Set<string>();
// the article's dialog is opening: the list drawn next starts from its page's changes, not what was left out before
let opening = false;

const WHAT: Record<string, string> = {
  added: "is new since the last save to remote, so it's deleted. This can't be undone.",
  changed: "goes back to how it was last saved to remote, and what you changed is lost. This can't be undone.",
  deleted: 'comes back as it was last saved to remote.',
};

type PublishReply = { ok: boolean; commit?: string; pushed?: boolean; pushError?: string; reason?: string; issues?: { file: string; path?: string; message: string }[] };

export function initPublish(root: HTMLElement, signal: AbortSignal) {
  const dialog = root.querySelector<HTMLDialogElement>('#publish-discard');
  const inArticleDialog = root.closest('#save-to-remote') instanceof HTMLDialogElement;
  let discarding: { keys: string[]; name: string } | null = null;
  const say = (el: Element | null, text: string) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = text;
    el.hidden = !text;
  };
  const back = (params: Record<string, string>) => {
    const url = new URL(location.pathname, location.href);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    location.assign(url);
  };
  const refreshArticleDialog = async (params: Record<string, string> = {}) => {
    const url = new URL(location.href);
    url.searchParams.delete('published');
    url.searchParams.delete('pushed');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    await swapRegions(['publish', 'publish-issues'], url.toString());
  };

  // ---------- always what git says now ----------
  // The list is drawn with its page, and content, commits and pushes move on after that (a save made as
  // you type, a terminal): it's read again when the article's dialog opens (Save waits for it), and when
  // the window comes back to the standalone screen. A message being written is never swapped away.
  const message = () => root.querySelector<HTMLInputElement>('input[name="message"]');
  // a message being written is one that's been changed: the dialog puts the focus in it as it opens
  const writing = () => {
    const m = message();
    return !!m && m.value !== m.defaultValue;
  };
  const recheck = async () => {
    if (writing() || root.querySelector('#publish-discard[open]')) return;
    const focused = root.contains(document.activeElement) ? document.activeElement?.getAttribute('name') : null;
    root.dataset.checking = '';
    root.setAttribute('aria-busy', 'true');
    const status = root.querySelector<HTMLElement>('[data-publish-checking]');
    if (status) status.hidden = false;
    root.querySelectorAll<HTMLButtonElement>('[data-publish-form] button[type="submit"], [data-publish-push]').forEach((b) => (b.disabled = true));
    try {
      const url = new URL(location.href);
      if (inArticleDialog) {
        url.searchParams.delete('published');
        url.searchParams.delete('pushed');
        // the last save's result stays shown while its commit is still the latest (the server checks)
        if (root.dataset.published) url.searchParams.set('published', root.dataset.published);
      }
      // a message started while it was read stays: the list is then left as it is, and Save checks again on the server
      const next = await swapRegions(['publish', 'publish-issues'], url.toString(), writing);
      if (next) {
        // the field that had the focus keeps it, in the list drawn again
        if (focused) document.querySelector<HTMLElement>(`[data-region="publish"] [name="${CSS.escape(focused)}"]:not([disabled])`)?.focus({ preventScroll: true });
        return;
      }
    } catch {
      say(root.querySelector('[data-editor-form-issue]'), "Couldn't check what changed: is the dev server running? Close this and open it again.");
    }
    delete root.dataset.checking;
    root.removeAttribute('aria-busy');
    if (status) status.hidden = true;
    label();
    root.querySelectorAll<HTMLButtonElement>('[data-publish-push]').forEach((b) => (b.disabled = false));
  };
  if (inArticleDialog) {
    document.addEventListener(
      'click',
      (e) => {
        if (!(e.target as Element).closest?.('[data-dialog-open="save-to-remote"]')) return;
        // opened from a page: only its changes are ticked to begin with (every change when it has none)
        opening = true;
        fresh();
        void recheck().finally(() => (opening = false));
      },
      { signal, capture: true },
    );
  } else {
    let lastCheck = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 3000) return;
      lastCheck = Date.now();
      void recheck();
    };
    document.addEventListener('visibilitychange', onReturn, { signal });
    window.addEventListener('focus', onReturn, { signal });
  }

  root.addEventListener(
    'click',
    async (e) => {
      const t = e.target as Element;
      const discard = t.closest<HTMLElement>('[data-publish-discard]');
      if (discard && dialog) {
        discarding = { keys: JSON.parse(discard.dataset.publishDiscard!), name: discard.dataset.name ?? '' };
        const name = dialog.querySelector('[data-publish-discard-name]');
        if (name) name.textContent = discarding.name;
        const what = dialog.querySelector('[data-publish-discard-what]');
        if (what) what.textContent = WHAT[discard.dataset.status ?? 'changed'] ?? WHAT.changed;
        dialog.showModal();
        return;
      }
      if (t.closest('[data-publish-discard-confirm]') && discarding) {
        const { keys, name } = discarding;
        discarding = null;
        dialog?.close();
        announce('Discarding\u2026');
        const r = await api('POST', 'discard', { keys });
        if (!r.ok) return announce(`Not discarded: ${(r.data.issues ?? []).map(describeIssue).join(' ') || 'the change was refused'}`, 'negative');
        await swapRegions(['publish', 'publish-issues']);
        announce(`Discarded: ${name}`);
        return;
      }
      if (t.closest('[data-publish-push]')) {
        if (inArticleDialog) remoteSaveStatus.saving('Pushing to remote\u2026');
        else announce('Pushing\u2026');
        const r = await api<PublishReply>('POST', 'push');
        if (!r.ok) {
          const why = r.data.reason ?? "The push didn't go through.";
          say(root.querySelector('[data-publish-push-issue]'), why);
          if (inArticleDialog) remoteSaveStatus.failed('Push to remote failed');
          else announce(`Not pushed: ${why}`, 'negative');
          return;
        }
        if (inArticleDialog) {
          remoteSaveStatus.saved();
          await refreshArticleDialog({ pushed: '1' });
        } else {
          back({ pushed: '1' });
        }
      }
    },
    { signal },
  );

  const form = root.querySelector<HTMLFormElement>('[data-publish-form]');
  // each change's tick (and its files); the ones unticked are kept across the list being drawn again
  const picks = () =>
    [...root.querySelectorAll<HTMLElement>('[data-publish-pick]')].flatMap((el) => {
      const input = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
      return input ? [{ input, name: el.dataset.name ?? '', keys: JSON.parse(el.dataset.publishPick!) as string[] }] : [];
    });
  const all = () => root.querySelector<HTMLInputElement>('[data-publish-pick-all] input[type="checkbox"]');
  // a fresh choice: the page's own changes ticked (data-publish-scope), or every change
  function fresh() {
    leftOut.clear();
    const scope: string[] | null = root.dataset.publishScope ? JSON.parse(root.dataset.publishScope) : null;
    for (const p of picks()) p.input.checked = !scope || scope.includes(p.input.value);
    chose();
  }
  for (const p of picks()) if (leftOut.has(p.input.value)) p.input.checked = false;
  const picked = () => picks().filter((p) => p.input.checked);
  // ticking a draft makes this a publish too, and unticking a change leaves it for later: the button says so
  const label = () => {
    const checked = !!form?.querySelector('input[name="publish"]:checked');
    const rows = picks();
    const chosen = rows.filter((p) => p.input.checked);
    const box = all();
    if (box) {
      box.checked = chosen.length === rows.length;
      box.indeterminate = chosen.length > 0 && chosen.length < rows.length;
    }
    const words = form?.querySelector('button[type="submit"] .label');
    if (words) words.textContent = saveLabel(chosen.length, rows.length, checked);
    // a change that can't be unticked (a private save not yet linked) always goes
    const anyChange = root.hasAttribute('data-publish-has-changes') && (chosen.length > 0 || rows.length === 0 || root.querySelectorAll('[data-change-list] > li').length > rows.length);
    const canSave = !root.hasAttribute('data-publish-blocked') && (anyChange || checked);
    const message = form?.querySelector<HTMLInputElement>('input[name="message"]');
    const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    const reason = form?.querySelector<HTMLElement>('[data-publish-reason]');
    if (message) message.disabled = !canSave;
    if (submit) submit.disabled = !canSave;
    if (reason && !root.hasAttribute('data-publish-blocked')) reason.hidden = canSave;
    const none = form?.querySelector<HTMLElement>('[data-publish-none]');
    if (none) none.hidden = canSave || !!reason || rows.length === 0;
    const note = form?.querySelector<HTMLElement>('[data-publish-private-note]');
    const text = privateNote(chosen.flatMap((p) => p.keys));
    if (note) {
      note.hidden = !text;
      const p = note.querySelector('p');
      if (p && text) p.textContent = text;
    }
  };
  // a choice changed: what's left out is remembered, and the message offered follows (unless you wrote your own)
  const chose = () => {
    for (const p of picks()) {
      if (p.input.checked) leftOut.delete(p.input.value);
      else leftOut.add(p.input.value);
    }
    const m = message();
    if (m && m.value === m.defaultValue) {
      const rows = picks();
      const chosen = rows.filter((p) => p.input.checked);
      const next = messageFor(chosen.length ? chosen : rows);
      m.value = next;
      m.defaultValue = next;
    }
    label();
  };
  root.addEventListener(
    'change',
    (e) => {
      const t = e.target as Element;
      if (t.closest('[data-publish-pick-all]')) {
        const on = (t as HTMLInputElement).checked;
        for (const p of picks()) p.input.checked = on;
        chose();
      } else if (t.closest('[data-publish-pick]')) chose();
    },
    { signal },
  );
  form?.addEventListener('change', label, { signal });
  if (opening) fresh();
  else if (picks().some((p) => !p.input.checked)) chose();
  else label();
  form?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const issue = form.querySelector('[data-editor-form-issue]');
      const f = new FormData(form);
      const message = String(f.get('message') ?? '').trim();
      const publish = f.getAll('publish').map(String);
      if (!message) return say(issue, 'Say what this save changes: it becomes the commit message.');
      say(issue, '');
      // only some ticked: just their files go (every change, when all are)
      const rows = picks();
      const chosen = picked();
      const keys = chosen.length < rows.length ? chosen.flatMap((p) => p.keys) : undefined;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button) button.disabled = true;
      if (inArticleDialog) remoteSaveStatus.saving();
      else announce('Saving to remote\u2026');
      const r = await api<PublishReply>('POST', 'publish', { message, publish, ...(keys ? { keys } : {}) });
      if (button) button.disabled = false;
      if (!r.ok || !r.data.commit) {
        const why = [r.data.reason, ...(r.data.issues ?? []).map(describeIssue)].filter(Boolean).join(' ') || "It wasn't saved to remote.";
        say(issue, why);
        if (inArticleDialog) remoteSaveStatus.failed('Save to remote failed');
        else announce(`Not saved: ${why}`, 'negative');
        return;
      }
      // committed: pushed (the site deploys) or left here with Push again (the screen says why)
      leftOut.clear();
      if (!r.data.pushed) sessionStorage.setItem('editor.publish.pushError', r.data.pushError ?? '');
      if (inArticleDialog) {
        // the result is the list's at once: a check started before its refresh lands carries it too
        if (r.data.pushed) root.dataset.published = r.data.commit;
        if (r.data.pushed) remoteSaveStatus.saved();
        else remoteSaveStatus.failed('Not pushed to remote');
        await refreshArticleDialog(r.data.pushed ? { published: r.data.commit } : {});
      } else {
        back(r.data.pushed ? { published: r.data.commit } : {});
      }
    },
    { signal },
  );

  // a publish whose push failed: say why, beside Push again
  const pushError = sessionStorage.getItem('editor.publish.pushError');
  if (pushError !== null) {
    sessionStorage.removeItem('editor.publish.pushError');
    say(root.querySelector('[data-publish-push-issue]'), pushError ? `Why: ${pushError}` : '');
  }
}
