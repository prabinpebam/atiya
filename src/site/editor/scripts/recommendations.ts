/**
 * The Recommendations screen (documentation/sections/recommendations.md §4): a list beside the chosen one's details.
 * Choosing in the list draws the screen again for `?rec=` (a recommendation, `new`, or `place`) without a reload;
 * Where they show saves a section's settings with the structure's version (PUT recommendations/section); a
 * recommendation's form, Move up, Move down and Delete save the whole list with its file's version (PUT
 * recommendations), then its photo (POST recommendations/photo: the file chosen, else its LinkedIn profile's).
 * The status says Saved once the screen shows it. A change made elsewhere redraws it too, unless something here is
 * unsaved.
 */
import { announce, api, describeIssue, onContentChange, saveStatus, swapRegions, track } from './client';
import { cleanRecommendation, moveRecommendation, recommendationIdFor, removeRecommendation, upsertRecommendation, wantsProfilePhoto, type Recommendation, type RecommendationSettings } from '../model/recommendations';

interface State {
  items: Recommendation[];
  listVersion: string | null;
  structureVersion: string | null;
  section: string | null;
  selected: string;
  structureKey: string;
  listKey: string;
}

const REGION = 'recommendations';
const HTTPS = /^https:\/\/[^\s/]+\.[^\s]+$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Unsaved changes here, kept across the screen's redraws (each sets the script up again). */
let unsaved = false;
let listening = false;

/** The screen for `rec` (and the section Where they show is for), drawn again, then focus on `focus`. */
async function show(rec: string, opts: { section?: string | null; focus?: string; push?: boolean } = {}) {
  const url = new URL(location.href);
  url.searchParams.set('rec', rec);
  if (opts.section) url.searchParams.set('section', opts.section);
  if (opts.push) history.pushState(history.state, '', url);
  else history.replaceState(history.state, '', url);
  // typing began while it was on its way: what's typed stays (never lost to a redraw)
  const drawn = await swapRegions([REGION], url.href, () => unsaved);
  if (drawn && opts.focus) document.querySelector<HTMLElement>(`[data-region="${REGION}"] ${opts.focus}`)?.focus();
}

const leave = () => !unsaved || confirm('Leave without saving your changes?');

export function initRecommendations(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-recs-state]')?.textContent ?? '{}') as State;
  const place = root.querySelector<HTMLFormElement>('[data-recs-place]');
  const form = root.querySelector<HTMLFormElement>('[data-recs-form]');
  const issueOf = (f: HTMLFormElement | null) => f?.querySelector<HTMLElement>('[data-editor-form-issue]');
  const say = (el: Element | null | undefined, text: string) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = text;
    el.hidden = !text;
  };
  const why = (r: { data: { issues?: Parameters<typeof describeIssue>[0][] } }) => (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved.";
  const changed = (what: string) => {
    unsaved = true;
    saveStatus.dirty(what);
  };

  // ---------- choosing in the list ----------
  root.addEventListener(
    'click',
    (e) => {
      const go = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-recs-go]');
      if (!go || e.defaultPrevented || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey) return;
      e.preventDefault();
      if (!leave()) return;
      unsaved = false;
      saveStatus.saved();
      const rec = go.dataset.recsGo!;
      void show(rec, { push: true, focus: rec === 'new' ? 'input[name="name"]' : `[data-recs-go="${rec}"]` });
    },
    { signal },
  );
  if (!listening) {
    listening = true;
    window.addEventListener('popstate', () => void show(new URL(location.href).searchParams.get('rec') ?? ''));
  }

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
          if (!leave()) return;
          unsaved = false;
          saveStatus.saved();
          void show('place', { section: t.value, focus: '[data-recs-place] [role="combobox"]' });
          return;
        }
        follow();
        say(issueOf(place), '');
        changed('Where recommendations show');
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
          say(issueOf(place), why(r));
          return;
        }
        unsaved = false;
        // said once the screen shows it, so nothing chosen meanwhile is redrawn away
        await show('place', { section: state.section, focus: '[data-recs-place] button[type="submit"]' });
        saveStatus.saved('Saved where recommendations show');
      },
      { signal },
    );
    follow();
  }

  // ---------- a recommendation ----------
  /** Saves the whole list; on success `then` runs (its photo), the screen shows `rec`, and the status says what was saved. */
  const saveList = async (items: Recommendation[], what: string, rec: string, focus: string, el?: Element | null, then?: () => Promise<string | void>): Promise<boolean> => {
    saveStatus.saving();
    const r = await track(`Saving ${what.toLowerCase()}`, { el }, () => api('PUT', 'recommendations', { items, ifMatch: { [state.listKey]: state.listVersion } }));
    if (!r.ok) {
      saveStatus.failed(`Not saved: ${why(r)}`);
      say(issueOf(form), why(r));
      return false;
    }
    const note = then ? await then() : undefined;
    unsaved = false;
    await show(rec, { focus });
    saveStatus.saved(what);
    if (note) announce(`${what}. ${note}`, 'negative');
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

  if (form) {
    form.addEventListener(
      'input',
      () => {
        say(issueOf(form), '');
        changed('Recommendation');
      },
      { signal },
    );
    form.addEventListener(
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
          say(issueOf(form), problems.join(' '));
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
        await saveList(upsertRecommendation(state.items, rec), existing ? `Saved ${rec.name}’s recommendation` : `Added ${rec.name}’s recommendation`, id, `[data-recs-go="${id}"]`, form, () =>
          givePhoto(rec, rec.noPhoto ? undefined : file),
        );
      },
      { signal },
    );
  }

  root.addEventListener(
    'click',
    async (e) => {
      const t = e.target as HTMLElement;
      const id = state.selected;
      const rec = state.items.find((r) => r.id === id);
      const move = t.closest<HTMLButtonElement>('[data-rec-move]');
      if (move && rec && !move.disabled) {
        if (!leave()) return;
        const by = Number(move.dataset.recMove) as -1 | 1;
        // focus stays on the same move, unless it's now at the end it moved towards (then on the other)
        const i = state.items.findIndex((r) => r.id === id) + by;
        const atEnd = i <= 0 || i >= state.items.length - 1;
        await saveList(moveRecommendation(state.items, id, by), `Moved ${rec.name}`, id, `[data-rec-move="${atEnd ? -by : by}"]`, move);
        return;
      }
      const del = t.closest<HTMLElement>('[data-recs-delete]');
      if (del && rec) {
        // twice: the first press asks, the second deletes
        if (!del.hasAttribute('data-confirm')) {
          del.setAttribute('data-confirm', '');
          const l = del.querySelector('.label');
          if (l) l.textContent = 'Delete for good';
          return;
        }
        const rest = removeRecommendation(state.items, id);
        const next = rest[Math.min(state.items.findIndex((r) => r.id === id), rest.length - 1)]?.id ?? 'new';
        await saveList(rest, `Deleted ${rec.name}’s recommendation`, next, next === 'new' ? '[data-recs-go="new"]' : `[data-recs-go="${next}"]`, del);
      }
    },
    { signal },
  );

  // a change made elsewhere (another tab, the file by hand): drawn again unless something here is unsaved
  onContentChange((c) => {
    if (unsaved) return;
    if (c.files.some((f) => f.includes('recommendations.json') || f.includes('structures/site.json'))) void swapRegions([REGION], location.href, () => unsaved, { quiet: true });
  }, signal);
}
