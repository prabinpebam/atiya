/**
 * The Save to remote screen (documentation/editor/spec.md §7): Discard (after asking), Save to remote (commit content/
 * and push) and Push again. A publish that committed comes back to the screen with its commit in the
 * address, which shows its result and the link to its deploy; a push that failed says why.
 */
import { api, announce, describeIssue, remoteSaveStatus, swapRegions } from './client';

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
  // ticking a draft makes this a publish too: the button says so
  const label = () => {
    const checked = !!form?.querySelector('input[name="publish"]:checked');
    const words = form?.querySelector('button[type="submit"] .label');
    if (words) words.textContent = checked ? 'Publish and save to remote' : 'Save to remote';
    const canSave = !root.hasAttribute('data-publish-blocked') && (root.hasAttribute('data-publish-has-changes') || checked);
    const message = form?.querySelector<HTMLInputElement>('input[name="message"]');
    const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    const reason = form?.querySelector<HTMLElement>('[data-publish-reason]');
    if (message) message.disabled = !canSave;
    if (submit) submit.disabled = !canSave;
    if (reason && !root.hasAttribute('data-publish-blocked')) reason.hidden = canSave;
  };
  form?.addEventListener('change', label, { signal });
  label();
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
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button) button.disabled = true;
      if (inArticleDialog) remoteSaveStatus.saving();
      else announce('Saving to remote\u2026');
      const r = await api<PublishReply>('POST', 'publish', { message, publish });
      if (button) button.disabled = false;
      if (!r.ok || !r.data.commit) {
        const why = [r.data.reason, ...(r.data.issues ?? []).map(describeIssue)].filter(Boolean).join(' ') || "It wasn't saved to remote.";
        say(issue, why);
        if (inArticleDialog) remoteSaveStatus.failed('Save to remote failed');
        else announce(`Not saved: ${why}`, 'negative');
        return;
      }
      // committed: pushed (the site deploys) or left here with Push again (the screen says why)
      if (!r.data.pushed) sessionStorage.setItem('editor.publish.pushError', r.data.pushError ?? '');
      if (inArticleDialog) {
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
