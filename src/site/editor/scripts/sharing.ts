/**
 * Sharing one private page from its Share dialog (documentation/access/spec.md §8.1): making an access code
 * or a magic link for this page (or every private page in its section) and showing its message to copy, and
 * copying a grant's message again. Everything else a code or link can change is on the Access screen
 * (scripts/grants.ts). Each is one call to the API; the list of who it's shared with then refreshes.
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

  const done = async (r: { ok: boolean; data: { issues?: Issue[] } }, what: string) => {
    if (!r.ok) {
      const text = (r.data.issues ?? []).map(describeIssue).join('; ') || 'That didn’t work: try again.';
      saveStatus.failed(text);
      if (issue) {
        issue.textContent = text;
        issue.hidden = false;
      }
      return false;
    }
    saveStatus.saved(what);
    await swapRegions(regions);
    return true;
  };

  /** What a new grant opens: this page, or every private page in its section. */
  const scopeOf = (f: FormData) => {
    const opens = form?.querySelector<HTMLElement>('fieldset[data-page]');
    return f.get('opens') === 'section' && opens?.dataset.section ? { sections: [opens.dataset.section] } : { pages: [opens?.dataset.page ?? ''] };
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
      if (!(await done(r, body.kind === 'code' ? 'Access code made' : 'Magic link made'))) return;
      delete form.dataset.unsaved;
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
    'click',
    async (e) => {
      const t = (e.target as Element).closest<HTMLElement>('button, a');
      if (!t) return;
      if (t.matches('[data-access-copy-new]')) {
        e.preventDefault();
        await copy(form?.querySelector<HTMLTextAreaElement>('textarea[name="message"]')?.value ?? '');
        return;
      }
      if (t.dataset.accessCopy) {
        const r = await api<{ message: string }>('GET', `access/grants/${t.dataset.accessCopy}/message`);
        if (r.ok) await copy(r.data.message);
      }
    },
    { signal },
  );
}
