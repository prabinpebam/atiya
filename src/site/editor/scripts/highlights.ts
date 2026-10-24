/**
 * The Home highlights screen (documentation/home-views/highlights.md §2), a list beside the chosen one's details
 * (documentation/editor/list-and-details.md). Choosing in the list draws the screen again for `?slide=` (a slide,
 * `new` or `settings`) without a reload. Every action (the carousel's settings, Add slide, a slide's excerpt, Move
 * up, Move down, Remove slide) saves the whole file with its version (PUT highlights); the status says Saved once
 * the screen shows it. A refused save keeps what was typed and says why in the form. A change made elsewhere
 * redraws the screen, unless something here is unsaved.
 */
import { api, describeIssue, onContentChange, saveStatus, swapRegions, track } from './client';
import { underWay } from '../model/feedback';
import { addHighlight, excerptHighlight, HIGHLIGHT_MAX, moveHighlight, removeHighlight, type Highlights, type HighlightChoice } from '../model/highlights';

interface State {
  highlights: Highlights;
  version: string | null;
  choices: HighlightChoice[];
  selected: string;
}

const KEY = '/content/highlights.json';
const REGION = 'highlights';
/** Unsaved changes here, kept across the screen's redraws (each sets the script up again). */
let unsaved = false;

/** The screen for `slide`, drawn again, then focus on `focus`. */
async function show(slide: string, opts: { focus?: string; push?: boolean } = {}) {
  const url = new URL(location.href);
  url.searchParams.set('slide', slide);
  if (opts.push) history.pushState(history.state, '', url);
  else history.replaceState(history.state, '', url);
  const drawn = await swapRegions([REGION], url.href, () => unsaved);
  if (drawn && opts.focus) document.querySelector<HTMLElement>(`[data-region="${REGION}"] ${opts.focus}`)?.focus();
}

const leave = () => !unsaved || confirm('Leave without saving your changes?');

export function initHighlights(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-highlights-state]')?.textContent ?? '{}') as State;
  const h = state.highlights;
  const form = root.querySelector<HTMLFormElement>('[data-highlights-settings], [data-highlights-new], [data-highlights-slide]');
  const issue = form?.querySelector<HTMLElement>('[data-editor-form-issue]');
  const say = (text: string) => {
    if (!issue) return;
    issue.textContent = text;
    issue.hidden = !text;
  };
  const field = (name: string) => form?.elements.namedItem(name) as HTMLInputElement | null;
  const go = (id: string) => `[data-highlights-go="${id}"]`;

  /** Saves the whole file; on success the screen shows `slide` with the focus on `focus`, and the status says `what`. */
  const save = async (next: Highlights, what: string, slide: string, focus: string, el?: Element | null): Promise<boolean> => {
    say('');
    saveStatus.saving();
    const r = await track(underWay(what), { el: el ?? form }, () => api('PUT', 'highlights', { highlights: next, ifMatch: { [KEY]: state.version } }));
    if (!r.ok) {
      const why = (r.data.issues ?? []).map(describeIssue).join(' ') || "The change wasn't saved. Try again.";
      say(r.status === 409 ? `${why} What you typed is kept. Reopen this screen to see the newer version before trying again.` : why);
      saveStatus.failed(`Not saved: ${why}`);
      return false;
    }
    unsaved = false;
    // said once the screen shows it, so nothing chosen meanwhile is redrawn away
    await show(slide, { focus });
    saveStatus.saved(what);
    return true;
  };

  // ---------- choosing in the list ----------
  root.addEventListener(
    'click',
    (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-highlights-go]');
      if (!link || e.defaultPrevented || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey) return;
      e.preventDefault();
      if (link.getAttribute('aria-disabled') === 'true' || !leave()) return;
      unsaved = false;
      saveStatus.clean();
      const slide = link.dataset.highlightsGo!;
      void show(slide, { push: true, focus: slide === 'new' ? '[data-highlights-new] [role="combobox"]' : go(slide) });
    },
    { signal },
  );
  window.addEventListener('popstate', () => void show(new URL(location.href).searchParams.get('slide') ?? ''), { signal });

  if (!form) return;
  const changed = () => {
    unsaved = true;
    say('');
    saveStatus.dirty(form.hasAttribute('data-highlights-settings') ? 'Carousel settings' : 'Home highlights');
  };
  form.addEventListener('input', changed, { signal });
  form.addEventListener('change', changed, { signal });

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      // ---------- the carousel's settings ----------
      if (form.hasAttribute('data-highlights-settings')) {
        const checked = (name: string) => !!field(name)?.checked;
        const next: Highlights = {
          ...h,
          enabled: checked('enabled'),
          label: field('label')?.value ?? h.label,
          peek: checked('peek'),
          arrows: checked('arrows'),
          pager: (field('pager')?.value || h.pager) as Highlights['pager'],
          display: (field('display')?.value || h.display) as Highlights['display'],
          background: checked('background'),
          rounded: checked('rounded'),
          shadow: checked('shadow'),
        };
        await save(next, 'Saved carousel settings', 'settings', 'button[type="submit"]');
        return;
      }
      // ---------- a new slide ----------
      if (form.hasAttribute('data-highlights-new')) {
        const choice = state.choices.find((c) => c.key === field('source')?.value);
        if (!choice) {
          say('Choose a source to add, then press Add slide.');
          return;
        }
        const id = `slide-${crypto.randomUUID()}`;
        const items = addHighlight(h.items, choice.item, id);
        if (items === h.items) {
          say(h.items.length >= HIGHLIGHT_MAX ? 'The carousel is full. Remove a slide to add another.' : 'That source is already a slide. Choose another.');
          return;
        }
        await save({ ...h, items }, 'Added slide', id, choice.item.type === 'article' ? 'textarea[name="excerpt"]' : go(id));
        return;
      }
      // ---------- a slide's excerpt ----------
      const id = state.selected;
      await save({ ...h, items: excerptHighlight(h.items, id, field('excerpt')?.value ?? '') }, 'Saved slide', id, 'button[type="submit"]');
    },
    { signal },
  );

  // ---------- moving and removing the chosen slide ----------
  root.addEventListener(
    'click',
    async (e) => {
      const t = e.target as HTMLElement;
      const id = state.selected;
      const at = h.items.findIndex((i) => i.id === id);
      if (at < 0) return;
      const move = t.closest<HTMLButtonElement>('[data-highlight-move]');
      if (move && !move.disabled) {
        const by = Number(move.dataset.highlightMove) as 1 | -1;
        // focus stays on the same move, unless it's now at the end it moved towards (then on the other)
        const i = at + by;
        const atEnd = i <= 0 || i >= h.items.length - 1;
        await save({ ...h, items: moveHighlight(h.items, id, by) }, `Moved slide to place ${i + 1}`, id, `[data-highlight-move="${atEnd ? -by : by}"]`, move);
        return;
      }
      const remove = t.closest<HTMLButtonElement>('[data-highlight-remove]');
      if (!remove) return;
      // twice: the first press asks, the second removes (the source itself is never deleted)
      if (!remove.hasAttribute('data-confirm')) {
        remove.setAttribute('data-confirm', '');
        const label = remove.querySelector('[data-button-label]');
        if (label) label.textContent = 'Remove for good';
        return;
      }
      const rest = removeHighlight(h.items, id);
      const next = rest[Math.min(at, rest.length - 1)]?.id ?? 'new';
      await save({ ...h, items: rest }, 'Removed slide', next, next === 'new' ? go('new') : go(next), remove);
    },
    { signal },
  );

  // a change made elsewhere (another tab, a source renamed or published): drawn again unless something here is unsaved
  onContentChange(() => {
    if (unsaved) return;
    void swapRegions([REGION], location.href, () => unsaved, { quiet: true });
  }, signal);
}
