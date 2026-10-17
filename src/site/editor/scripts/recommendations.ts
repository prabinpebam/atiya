/**
 * The Recommendations screen (documentation/sections/recommendations.md §4): a section's settings saved with the
 * structure's version (PUT recommendations/section), the list saved whole with its file's version (PUT
 * recommendations) after an add, an edit, a move or a delete. After a save the screen redraws its region, and
 * focus goes back where it was. A change made elsewhere redraws it too, unless something here is unsaved.
 */
import { announce, api, describeIssue, onContentChange, saveStatus, swapRegions, track } from './client';
import { cleanRecommendation, moveRecommendation, recommendationIdFor, removeRecommendation, upsertRecommendation, wantsProfilePhoto, type Recommendation, type RecommendationSettings } from '../model/recommendations';

interface State {
  items: Recommendation[];
  listVersion: string | null;
  structureVersion: string | null;
  section: string | null;
  structureKey: string;
  listKey: string;
}

const REGION = 'recommendations';
const HTTPS = /^https:\/\/[^\s/]+\.[^\s]+$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function initRecommendations(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-recs-state]')?.textContent ?? '{}') as State;
  const place = root.querySelector<HTMLFormElement>('[data-recs-place]');
  const form = root.querySelector<HTMLFormElement>('[data-recs-form]');
  const dialog = root.querySelector<HTMLDialogElement>('#recs-edit');
  const listIssue = root.querySelector<HTMLElement>('[data-recs-list-issue]');
  let unsaved = false;

  const say = (el: Element | null | undefined, text: string) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = text;
    el.hidden = !text;
  };
  const why = (r: { data: { issues?: Parameters<typeof describeIssue>[0][] } }) => (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";

  /** Draws the region again (for `section`, when given), then puts focus on `focus` in it. */
  const redraw = async (focus?: string, section = state.section) => {
    const url = new URL(location.href);
    if (section) url.searchParams.set('section', section);
    history.replaceState(history.state, '', url);
    await swapRegions([REGION], url.href);
    if (focus) document.querySelector<HTMLElement>(`[data-region="${REGION}"] ${focus}`)?.focus();
  };

  // ---------- where they show ----------
  if (place) {
    const field = (name: string) => place.elements.namedItem(name) as HTMLInputElement | RadioNodeList | null;
    const value = (name: string) => {
      const f = field(name);
      return f instanceof RadioNodeList ? f.value : (f?.value ?? '');
    };
    /** The page select shows only for "after a page"; expanding in place only for rows and the wall. */
    const follow = () => {
      const after = place.querySelector<HTMLElement>('[data-recs-after]');
      if (after) after.hidden = value('at') !== 'after';
      const fixed = value('layout') === 'tiles' || value('layout') === 'spotlight';
      for (const r of place.querySelectorAll<HTMLInputElement>('input[name="open"]')) {
        if (r.value !== 'inline') continue;
        r.disabled = fixed;
        if (fixed && r.checked) place.querySelector<HTMLInputElement>('input[name="open"][value="dialog"]')!.checked = true;
      }
    };
    place.addEventListener(
      'change',
      (e) => {
        const t = e.target as HTMLInputElement;
        if (t.name === 'section') {
          if (unsaved && !confirm('Leave this section’s changes unsaved?')) return;
          unsaved = false;
          saveStatus.saved();
          void redraw('[data-recs-place] [role="combobox"]', t.value);
          return;
        }
        follow();
        unsaved = true;
        say(place.querySelector('[data-editor-form-issue]'), '');
        saveStatus.dirty('Where recommendations show');
      },
      { signal },
    );
    place.addEventListener(
      'submit',
      async (e) => {
        e.preventDefault();
        const settings: Partial<RecommendationSettings> = {
          show: (field('show') as HTMLInputElement | null)?.checked ?? false,
          at: value('at') as RecommendationSettings['at'],
          after: value('after') || undefined,
          layout: value('layout') as RecommendationSettings['layout'],
          open: value('open') as RecommendationSettings['open'],
          heading: value('heading'),
          intro: value('intro'),
        };
        saveStatus.saving();
        const r = await track('Saving where recommendations show', { el: place }, () =>
          api('PUT', 'recommendations/section', { section: state.section, settings, ifMatch: { [state.structureKey]: state.structureVersion } }),
        );
        if (!r.ok) {
          saveStatus.failed(`Not saved: ${why(r)}`);
          say(place.querySelector('[data-editor-form-issue]'), why(r));
          return;
        }
        unsaved = false;
        // said once the screen shows it, so nothing opened meanwhile is redrawn away
        await redraw('[data-recs-place] button[type="submit"]');
        saveStatus.saved('Saved where recommendations show');
      },
      { signal },
    );
    follow();
  }

  // ---------- the list ----------
  /**
   * Saves the whole list; on success, `then` runs (a photo to give it), the region is drawn again with focus on
   * `focus`, and the status says what was saved (and what `then` adds: a photo that couldn't be taken).
   */
  const saveList = async (items: Recommendation[], what: string, focus?: string, el?: Element | null, then?: () => Promise<string | void>): Promise<boolean> => {
    saveStatus.saving();
    const r = await track(`Saving ${what.toLowerCase()}`, { el }, () => api('PUT', 'recommendations', { items, ifMatch: { [state.listKey]: state.listVersion } }));
    if (!r.ok) {
      saveStatus.failed(`Not saved: ${why(r)}`);
      say(dialog?.open ? form?.querySelector('[data-editor-form-issue]') : listIssue, why(r));
      return false;
    }
    const note = then ? await then() : undefined;
    if (dialog?.open) dialog.close();
    await redraw(focus);
    if (note) {
      saveStatus.saved(what);
      announce(`${what}. ${note}`, 'negative');
    } else saveStatus.saved(what);
    return true;
  };

  /** Gives a saved recommendation its photo: the file chosen, else (with none) its LinkedIn profile's. Says why not, in words. */
  const givePhoto = async (rec: Recommendation, file: File | undefined): Promise<string | void> => {
    if (!file && !wantsProfilePhoto(rec)) return;
    let body: FormData | { id: string } = { id: rec.id };
    if (file) {
      body = new FormData();
      body.set('id', rec.id);
      body.set('file', file);
    }
    const r = await track(file ? 'Uploading their photo' : 'Taking their photo from LinkedIn', { el: form }, () => api('POST', 'recommendations/photo', body));
    if (!r.ok) return `${why(r)}${file ? '' : ' Upload one instead, or keep their initials.'}`;
  };

  const open = (rec?: Recommendation) => {
    if (!form || !dialog) return;
    form.reset();
    const set = (name: string, v: string) => {
      const f = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (f) f.value = v;
    };
    set('id', rec?.id ?? '');
    set('name', rec?.name ?? '');
    set('title', rec?.title ?? '');
    set('link', rec?.link ?? '');
    set('relationship', rec?.relationship ?? '');
    set('date', rec?.date ?? '');
    set('text', rec?.text ?? '');
    const hidden = form.elements.namedItem('hidden') as HTMLInputElement | null;
    if (hidden) hidden.checked = !!rec?.hidden;
    const initials = form.elements.namedItem('noPhoto') as HTMLInputElement | null;
    if (initials) initials.checked = !!rec?.noPhoto;
    const note = form.querySelector<HTMLElement>('[data-recs-photo-note]');
    if (note) note.hidden = !(rec?.photo && !rec.noPhoto);
    const title = dialog.querySelector('#recs-edit-title');
    if (title) title.textContent = rec ? 'Edit recommendation' : 'Add recommendation';
    const del = form.querySelector<HTMLElement>('[data-recs-delete-wrap]');
    if (del) del.hidden = !rec;
    const delLabel = form.querySelector('[data-recs-delete] .label');
    if (delLabel) delLabel.textContent = 'Delete';
    form.querySelector('[data-recs-delete]')?.removeAttribute('data-confirm');
    say(form.querySelector('[data-editor-form-issue]'), '');
    dialog.showModal();
  };

  root.addEventListener(
    'click',
    async (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-recs-add]')) return open();
      const edit = t.closest<HTMLElement>('[data-rec-edit]');
      if (edit) return open(state.items.find((r) => r.id === edit.dataset.recEdit));
      const move = t.closest<HTMLButtonElement>('[data-rec-move]');
      if (move && !move.disabled) {
        const id = move.dataset.rec ?? '';
        const by = Number(move.dataset.recMove) as -1 | 1;
        const name = state.items.find((r) => r.id === id)?.name ?? '';
        // focus stays on the same move, unless it's now at the end it moved towards
        const i = state.items.findIndex((r) => r.id === id) + by;
        const atEnd = i <= 0 || i >= state.items.length - 1;
        const focus = atEnd ? `[data-rec-edit="${id}"]` : `[data-rec-move="${by}"][data-rec="${id}"]`;
        await saveList(moveRecommendation(state.items, id, by), `Moved ${name}`, focus, move.closest('li'));
        return;
      }
      const del = t.closest<HTMLElement>('[data-recs-delete]');
      if (del && form) {
        // twice: the first press asks, the second deletes
        if (!del.hasAttribute('data-confirm')) {
          del.setAttribute('data-confirm', '');
          const l = del.querySelector('.label');
          if (l) l.textContent = 'Delete for good';
          return;
        }
        const id = (form.elements.namedItem('id') as HTMLInputElement).value;
        await saveList(removeRecommendation(state.items, id), 'Deleted the recommendation', '[data-recs-add]', del);
      }
    },
    { signal },
  );

  form?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const get = (name: string) => ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '').trim();
      const problems: string[] = [];
      if (!get('name')) problems.push('Add the person’s name.');
      if (!get('title')) problems.push('Add their title.');
      if (get('link') && !HTTPS.test(get('link'))) problems.push('The profile link needs to be a full address starting with https://.');
      if (get('date') && !MONTH.test(get('date'))) problems.push('Write the month as year and month: 2025-03.');
      if (!get('text')) problems.push('Add the recommendation’s words.');
      if (problems.length) {
        say(form.querySelector('[data-editor-form-issue]'), problems.join(' '));
        return;
      }
      const existing = get('id');
      const id = existing || recommendationIdFor(get('name'), state.items.map((r) => r.id));
      const before = state.items.find((r) => r.id === existing);
      const file = (form.elements.namedItem('file') as HTMLInputElement | null)?.files?.[0];
      const rec = cleanRecommendation({
        id,
        name: get('name'),
        title: get('title'),
        link: get('link'),
        relationship: get('relationship'),
        date: get('date'),
        text: (form.elements.namedItem('text') as HTMLTextAreaElement).value,
        hidden: (form.elements.namedItem('hidden') as HTMLInputElement).checked,
        photo: before?.photo,
        noPhoto: (form.elements.namedItem('noPhoto') as HTMLInputElement | null)?.checked ? true : undefined,
      });
      await saveList(upsertRecommendation(state.items, rec), existing ? `Saved ${rec.name}’s recommendation` : `Added ${rec.name}’s recommendation`, `[data-rec-edit="${id}"]`, form, () =>
        givePhoto(rec, rec.noPhoto ? undefined : file),
      );
    },
    { signal },
  );

  // a change made elsewhere (another tab, the file by hand): drawn again unless something here is unsaved
  onContentChange((c) => {
    if (unsaved || dialog?.open) return;
    if (c.files.some((f) => f.includes('recommendations.json') || f.includes('structures/site.json'))) void swapRegions([REGION], location.href, () => unsaved || !!dialog?.open, { quiet: true });
  }, signal);
}
