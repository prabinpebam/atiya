/**
 * The Access screen (documentation/access/spec.md §8.1, §8.2): making a code or a magic link and showing
 * its message to copy, copying a grant's message again, setting its end date, changing what it opens,
 * withdrawing it, and a page's
 * access and place: Move up and Move down among its section's open and locked pages, Lock, Open, Make
 * private, Change address, Share. Each is one call to the API; the grants and pages regions then refresh.
 */
import { announce, api, describeIssue, saveStatus, swapRegions, type Issue } from './client';

const REGIONS = ['access-grants', 'access-pages'];

async function done(r: { ok: boolean; data: { issues?: Issue[] } }, what: string, issueAt?: Element | null) {
  if (!r.ok) {
    const text = (r.data.issues ?? []).map(describeIssue).join('; ') || 'That didn’t work: try again.';
    saveStatus.failed?.(text);
    if (issueAt) {
      issueAt.textContent = text;
      (issueAt as HTMLElement).hidden = false;
    }
    announce(text, 'negative');
    return false;
  }
  saveStatus.saved(what);
  await swapRegions(REGIONS);
  return true;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    announce('Message copied.');
  } catch {
    announce('Couldn’t copy: select the message and copy it.', 'negative');
  }
}

export function initAccess(root: HTMLElement, signal: AbortSignal) {
  const form = root.querySelector<HTMLFormElement>('[data-access-new]');
  const issue = form?.querySelector<HTMLElement>('[data-editor-form-issue]');

  form?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const s = (k: string) => String(f.get(k) ?? '').trim();
      const body = {
        kind: s('kind') === 'link' ? 'link' : 'code',
        recipient: { name: s('name'), organisation: s('organisation'), role: s('role'), email: s('email') },
        purpose: s('purpose'),
        scope: { sections: f.getAll('sections').map(String), pages: f.getAll('pages').map(String) },
        expires: s('expires') || null,
        notes: s('notes'),
      };
      if (issue) issue.hidden = true;
      saveStatus.saving();
      const r = await api<{ share?: { message: string } }>('POST', 'access/grants', body);
      if (!(await done(r, body.kind === 'code' ? 'Access code made' : 'Magic link made', issue))) return;
      const result = form.querySelector<HTMLElement>('[data-access-result]');
      const message = form.querySelector<HTMLTextAreaElement>('[data-access-message] textarea, textarea[name="message"]');
      if (result && message && r.data.share) {
        message.value = r.data.share.message;
        result.hidden = false;
        message.focus();
        message.select();
      }
    },
    { signal },
  );

  root.addEventListener(
    'submit',
    async (e) => {
      const scope = (e.target as Element).closest<HTMLFormElement>('[data-access-scope]');
      if (!scope) return;
      e.preventDefault();
      const f = new FormData(scope);
      saveStatus.saving();
      await done(await api('POST', `access/grants/${scope.dataset.accessScope}/scope`, { scope: { sections: f.getAll('sections').map(String), pages: f.getAll('pages').map(String) } }), 'What it opens is saved');
    },
    { signal },
  );

  root.addEventListener(
    'click',
    async (e) => {
      const t = (e.target as Element).closest<HTMLElement>('button, a');
      if (!t) return;
      if (t.matches('[data-access-copy-new]')) {
        e.preventDefault();
        await copy(form?.querySelector<HTMLTextAreaElement>('textarea[name="message"]')?.value ?? '');
        return;
      }
      const grant = t.dataset.accessCopy ?? t.dataset.accessExtend ?? t.dataset.accessWithdraw;
      if (t.dataset.accessCopy) {
        const r = await api<{ message: string }>('GET', `access/grants/${grant}/message`);
        if (r.ok) await copy(r.data.message);
        return;
      }
      if (t.dataset.accessExtend) {
        const date = root.querySelector<HTMLInputElement>(`[data-access-expires="${grant}"] input, input[name="expires-${grant}"]`)?.value || null;
        saveStatus.saving();
        await done(await api('POST', `access/grants/${grant}/extend`, { expires: date }), date ? 'End date set' : 'End date cleared');
        return;
      }
      if (t.dataset.accessWithdraw) {
        if (!confirm('Withdraw this access now? It stops opening anything once you publish, and it can’t be undone: you can make a new one.')) return;
        saveStatus.saving();
        await done(await api('POST', `access/grants/${grant}/withdraw`), 'Withdrawn: publish to make it take effect');
        return;
      }
      const row = t.closest<HTMLElement>('[data-access-page]');
      const page = row?.dataset.accessPage;
      if (!row || !page) return;
      if (t.dataset.accessMove) {
        const list = row.parentElement!;
        const rows = [...list.querySelectorAll<HTMLElement>(':scope > [data-access-node]')];
        const i = rows.indexOf(row);
        const j = i + Number(t.dataset.accessMove);
        if (j < 0 || j >= rows.length) return;
        [rows[i], rows[j]] = [rows[j], rows[i]];
        const section = row.closest<HTMLElement>('[data-access-section]')!.dataset.accessSection!;
        saveStatus.saving();
        await done(await api('PUT', `access/sections/${section}/order`, { order: rows.map((r) => r.dataset.accessNode) }), 'Order saved');
        return;
      }
      if (t.dataset.accessSet) {
        const to = t.dataset.accessSet;
        if (to === 'locked' && !confirm('Lock this page? It moves to private-pages/ and is listed only for readers whose access covers it. If it was published openly before, its earlier text stays readable in the public repository’s history: locking can’t undo that.')) return;
        if (to === 'open' && !confirm('Open this page? It moves back to content/ and becomes public once you publish.')) return;
        if (to === 'private' && !confirm('Make this page private? It leaves its section and opens only from a magic link.')) return;
        saveStatus.saving();
        await done(await api('PUT', `articles/${page}/access`, { access: to }), to === 'locked' ? 'Locked' : to === 'open' ? 'Opened' : 'Made private');
        return;
      }
      if ('accessAddress' in t.dataset) {
        if (!confirm('Change this page’s address? Every link to it stops working, including magic links already sent.')) return;
        saveStatus.saving();
        await done(await api('POST', `articles/${page}/address`), 'Address changed');
        return;
      }
      if (t.dataset.accessShare && form) {
        const link = form.querySelector<HTMLInputElement>('input[name="kind"][value="link"]');
        if (link) link.checked = true;
        form.querySelectorAll<HTMLInputElement>('input[name="pages"]').forEach((c) => (c.checked = c.value === t.dataset.accessShare));
        form.scrollIntoView({ block: 'start' });
        form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
      }
    },
    { signal },
  );
}
