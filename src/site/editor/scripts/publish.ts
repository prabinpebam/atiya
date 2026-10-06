/**
 * The Save to remote screen (documentation/editor/spec.md §7): Discard (after asking), Save to remote (commit content/
 * and push) and Push again. A publish that committed comes back to the screen with its commit in the
 * address, which shows its result and the link to its deploy; a push that failed says why.
 */
import { api, announce, describeIssue, swapRegions } from './client';

const WHAT: Record<string, string> = {
  added: "is new since the last save to remote, so it's deleted. This can't be undone.",
  changed: "goes back to how it was last saved to remote, and what you changed is lost. This can't be undone.",
  deleted: 'comes back as it was last saved to remote.',
};

type PublishReply = { ok: boolean; commit?: string; pushed?: boolean; pushError?: string; reason?: string; issues?: { file: string; path?: string; message: string }[] };

export function initPublish(root: HTMLElement, signal: AbortSignal) {
  const dialog = root.querySelector<HTMLDialogElement>('#publish-discard');
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
        announce('Pushing\u2026');
        const r = await api<PublishReply>('POST', 'push');
        if (!r.ok) {
          const why = r.data.reason ?? "The push didn't go through.";
          say(root.querySelector('[data-publish-push-issue]'), why);
          return announce(`Not pushed: ${why}`, 'negative');
        }
        back({ pushed: '1' });
      }
    },
    { signal },
  );

  const form = root.querySelector<HTMLFormElement>('[data-publish-form]');
  // ticking a draft makes this a publish too: the button says so
  const label = () => {
    const words = form?.querySelector('button[type="submit"] .label');
    if (words) words.textContent = form?.querySelector('input[name="publish"]:checked') ? 'Publish and save to remote' : 'Save to remote';
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
      announce('Saving to remote\u2026');
      const r = await api<PublishReply>('POST', 'publish', { message, publish });
      if (button) button.disabled = false;
      if (!r.ok || !r.data.commit) {
        const why = [r.data.reason, ...(r.data.issues ?? []).map(describeIssue)].filter(Boolean).join(' ') || "It wasn't saved to remote.";
        say(issue, why);
        return announce(`Not saved: ${why}`, 'negative');
      }
      // committed: pushed (the site deploys) or left here with Push again (the screen says why)
      if (!r.data.pushed) sessionStorage.setItem('editor.publish.pushError', r.data.pushError ?? '');
      back(r.data.pushed ? { published: r.data.commit } : {});
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
