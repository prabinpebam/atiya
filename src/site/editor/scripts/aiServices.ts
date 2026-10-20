/**
 * The AI screen (documentation/editor/ai-services.md §7, §8): each change saves at once (the writer, a card's
 * model and private-pages switch, Add, Remove), then the writer and the cards are drawn again and the focus is
 * put back where it was. Test is busy on its own button, and its result is announced.
 */
import { announce, api, describeIssue, saveStatus, startTask, swapRegions, type Reply } from './client';
import { PRIVATE_LINE, testLine, type AiService, type CloudKind } from '../model/aiServices';

const REGIONS = ['ai-writer', 'ai-services'];
const card = (id: string) => `[data-ai-card="${id}"]`;
const modelField = (id: string) => `${card(id)} [role="combobox"], ${card(id)} input[name="model"]:not([type="hidden"])`;

/** Draws the writer and the cards again, then focuses `focus` (what had it was replaced). */
async function refresh(focus?: string, label?: string) {
  await swapRegions(REGIONS, location.href, undefined, label ? { label } : { quiet: true });
  if (focus) document.querySelector<HTMLElement>(focus)?.focus();
}

const why = (r: Reply) => (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";

/** Saves one change, says so, and draws the screen again; a refusal is said and returned. */
async function save(method: string, path: string, body: unknown, what: string, focus?: (r: Reply) => string | undefined): Promise<Reply> {
  saveStatus.saving();
  const r = await api(method, path, body);
  if (!r.ok) {
    saveStatus.failed(`Not saved: ${why(r)}`);
    return r;
  }
  saveStatus.saved(what);
  await refresh(focus?.(r));
  return r;
}

export function initAiWriter(el: HTMLElement, signal: AbortSignal) {
  el.addEventListener(
    'change',
    (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === 'writer') void save('PUT', 'ai/writer', { id: input.value }, 'The writer', () => '[data-ai-writer] [role="combobox"]');
    },
    { signal },
  );
  el.addEventListener(
    'click',
    async (e) => {
      const add = (e.target as Element).closest<HTMLButtonElement>('[data-ai-add-runner]');
      const look = (e.target as Element).closest<HTMLButtonElement>('[data-ai-look]');
      if (add) {
        const runner = add.dataset.aiAddRunner!;
        const model = el.querySelector<HTMLInputElement>(`input[name="model-${runner}"]`)?.value;
        const task = startTask(`Adding ${add.textContent?.replace(/^Add /, '').trim()}`, { el: add, busyLabel: 'Adding' });
        await save('POST', 'ai/services', { runner, model }, add.textContent?.replace(/^Add/, 'Added').trim() ?? 'Added', (r) => `${card(String(r.data.id))} [data-ai-test]`);
        void task.done();
      } else if (look) {
        await refresh('[data-ai-look]', 'Looking for models on this computer…');
      }
    },
    { signal },
  );
}

export function initAiCard(el: HTMLElement, signal: AbortSignal) {
  const id = el.dataset.aiCard!;
  const name = el.dataset.aiName ?? id;
  const local = el.dataset.aiLocal !== undefined;
  el.addEventListener(
    'change',
    (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === 'model') void save('PUT', `ai/services/${id}`, { model: input.value }, `${name}'s model`, () => modelField(id));
      if (input.name === 'noPrivate') void save('PUT', `ai/services/${id}`, { privatePages: !input.checked }, `${name}'s private pages`, () => `${card(id)} input[name="noPrivate"]`);
    },
    { signal },
  );
  el.addEventListener(
    'click',
    async (e) => {
      const t = e.target as Element;
      if (t.closest('[data-ai-test]')) {
        const button = t.closest<HTMLElement>('[data-ai-test]')!;
        const task = startTask(`Testing ${name}`, { el: button, busyLabel: 'Testing' });
        const r = await api<{ lastTest: NonNullable<AiService['lastTest']> }>('POST', `ai/services/${id}/test`);
        void task.done();
        if (!r.ok) {
          announce(why(r), 'negative');
          return;
        }
        announce(testLine({ name, lastTest: r.data.lastTest }), r.data.lastTest.ok ? 'default' : 'negative');
        await refresh(`${card(id)} [data-ai-test]`);
      } else if (t.closest('[data-ai-remove]')) {
        if (!confirm(`Remove ${name}? ${local ? 'Its models stay on this computer.' : 'Its key stays in Credential Manager until you delete it there.'}`)) return;
        const next = [...document.querySelectorAll<HTMLElement>('[data-ai-card]')].find((c) => c.dataset.aiCard !== id)?.dataset.aiCard;
        await save('DELETE', `ai/services/${id}`, undefined, `Removed ${name}`, () => (next ? `${card(next)} [data-ai-test]` : '[data-ai-writer] [data-ai-look]'));
      } else if (t.closest('[data-ai-copy]')) {
        const entry = t.closest<HTMLElement>('[data-ai-copy]')!.dataset.aiCopy!;
        await navigator.clipboard.writeText(entry).catch(() => undefined);
        announce(`Copied ${entry}`);
      }
    },
    { signal },
  );
}

export function initAiAdd(form: HTMLFormElement, signal: AbortSignal) {
  const kinds = JSON.parse(form.querySelector('[data-ai-kinds]')?.textContent ?? '[]') as (CloudKind & { words: string })[];
  const field = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`)!;
  const issue = form.querySelector<HTMLElement>('[data-editor-form-issue]');
  const say = (text: string) => {
    if (!issue) return;
    issue.textContent = text;
    issue.hidden = !text;
  };
  let kind = kinds.find((k) => k.provider === field('provider').value) ?? kinds[0];
  form.addEventListener(
    'change',
    (e) => {
      if ((e.target as HTMLInputElement).name !== 'provider') return;
      const next = kinds.find((k) => k.provider === field('provider').value) ?? kinds[0];
      // a name or base URL still as the kind had it follows the new kind; one you typed stays
      if (field('name').value === kind.label) field('name').value = next.label;
      if (field('base').value === kind.base) field('base').value = next.base;
      const words = form.querySelector('[data-ai-disclaimer] > *');
      if (words) words.textContent = `${next.words} ${PRIVATE_LINE}`;
      kind = next;
    },
    { signal },
  );
  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      say('');
      const body = { provider: field('provider').value, name: field('name').value, base: field('base').value, model: field('model').value, privatePages: !field('noPrivate').checked, accepted: field('accepted').checked };
      const r = await save('POST', 'ai/services', body, `Added ${body.name}`, (r) => `${card(String(r.data.id))} [data-ai-test]`);
      if (!r.ok) say(why(r));
    },
    { signal },
  );
}
