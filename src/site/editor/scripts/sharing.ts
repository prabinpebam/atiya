/**
 * Sharing private pages (documentation/access/spec.md §8.1): making an access code or a magic link and
 * showing its message to copy, copying a grant's message again, setting its end date, changing what it
 * opens and withdrawing it. Each is one call to the API; the list of grants then refreshes. On a private
 * page's Share dialog, a new grant opens that page (or every private page in its section).
 */
import { announce, api, describeIssue, saveStatus, swapRegions, type Issue } from './client';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    announce('Message copied.');
  } catch {
    announce('Couldn’t copy: select the message and copy it.', 'negative');
  }
}

export function initSharing(root: HTMLElement, signal: AbortSignal) {
  const form = root.querySelector<HTMLFormElement>('[data-access-new]');
  const issue = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
  const regions = [...root.querySelectorAll<HTMLElement>('[data-region]')].map((r) => r.dataset.region!);

  const done = async (r: { ok: boolean; data: { issues?: Issue[] } }, what: string, issueAt?: Element | null) => {
    if (!r.ok) {
      const text = (r.data.issues ?? []).map(describeIssue).join('; ') || 'That didn’t work: try again.';
      saveStatus.failed(text);
      if (issueAt) {
        issueAt.textContent = text;
        (issueAt as HTMLElement).hidden = false;
      }
      return false;
    }
    saveStatus.saved(what);
    await swapRegions(regions);
    return true;
  };

  /** What a new grant opens: the checked sections and pages, or on a page, that page or its section. */
  const scopeOf = (f: FormData) => {
    const opens = form?.querySelector<HTMLElement>('fieldset[data-page]');
    if (opens) return f.get('opens') === 'section' && opens.dataset.section ? { sections: [opens.dataset.section] } : { pages: [opens.dataset.page!] };
    return { sections: f.getAll('sections').map(String), pages: f.getAll('pages').map(String) };
  };

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
        scope: scopeOf(f),
        expires: s('expires') || null,
        notes: s('notes'),
      };
      if (issue) issue.hidden = true;
      saveStatus.saving();
      const r = await api<{ share?: { message: string } }>('POST', 'access/grants', body);
      if (!(await done(r, body.kind === 'code' ? 'Access code made' : 'Magic link made', issue))) return;
      const result = form.querySelector<HTMLElement>('[data-access-result]');
      const message = form.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
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
        const date = root.querySelector<HTMLInputElement>(`input[name="expires-${grant}"]`)?.value || null;
        saveStatus.saving();
        await done(await api('POST', `access/grants/${grant}/extend`, { expires: date }), date ? 'End date set' : 'End date cleared');
        return;
      }
      if (t.dataset.accessWithdraw) {
        if (!confirm('Withdraw this access now? It stops opening anything once you publish, and it can’t be undone: you can make a new one.')) return;
        saveStatus.saving();
        await done(await api('POST', `access/grants/${grant}/withdraw`), 'Withdrawn: publish to make it take effect');
      }
    },
    { signal },
  );
}