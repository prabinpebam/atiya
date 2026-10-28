/**
 * The Home highlights screen (documentation/home-views/highlights.md §2), a list beside the chosen one's details
 * (documentation/editor/list-and-details.md). Choosing in the list draws the screen again for `?slide=` (a slide,
 * `new` or `settings`) without a reload; Add slide's two steps (§2.1) are addresses too: its sources (`kind`, `q`)
 * and one previewed (`source`), so Back and a reload return to the same step. Every action (the carousel's settings, Add slide, a slide's excerpt, Move
 * up, Move down, Remove slide) saves the whole file with its version (PUT highlights); the status says Saved once
 * the screen shows it. A refused save keeps what was typed and says why in the form. A change made elsewhere
 * redraws the screen, unless something here is unsaved.
 */
import { api, onContentChange, refused, saveStatus, swapRegions, timeFollows, track } from './client';
import { underWay } from '../model/feedback';
import { addHighlight, coverHighlight, excerptHighlight, HIGHLIGHT_MAX, moveHighlight, pictureHighlight, removeHighlight, slideBackground, SLIDE_PICTURE_REGION, type Highlights, type HighlightChoice, type HighlightItem, type SlidePictureStyle } from '../model/highlights';
import { fillPicker } from './picker';
import { slideSeconds } from '../../scripts/media';

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

/** The screen for `to` (a slide's ID, `new` or `settings`, or an address of this screen), drawn again, then focus on `focus`. */
async function show(to: string | URL, opts: { focus?: string; push?: boolean } = {}) {
  const url = typeof to === 'string' ? new URL(`?slide=${encodeURIComponent(to)}`, location.href) : to;
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
  const picker = document.getElementById('highlight-picture-picker') as HTMLDialogElement | null;
  const pictureField = form?.querySelector<HTMLElement>('[data-slide-picture]');
  const choosePicture = (id: string) => {
    const input = field('picture');
    if (!input || !pictureField) return;
    const card = picker?.querySelector<HTMLElement>(`[data-editor-media="${CSS.escape(id)}"]`);
    if (!card) {
      say('This item cannot be used as a slide picture. Choose a public picture with alt text.');
      return;
    }
    input.value = id;
    const name = pictureField.querySelector('[data-slide-picture-name] p');
    if (name) name.textContent = card?.getAttribute('aria-label') || 'Chosen picture';
    const automatic = pictureField.querySelector<HTMLButtonElement>('[data-slide-picture-auto]');
    if (automatic) automatic.disabled = false;
    changed();
    void updatePreview();
    picker?.close();
    pictureField.querySelector<HTMLElement>('[data-slide-picture-pick]')?.focus();
  };
  const inheriting = () => field('pictureInherit')?.value !== 'false';
  /** An album slide showing its arranged cover (§2.3), as its Show choice says. */
  const showCover = () => (form?.elements.namedItem('slideShow') as RadioNodeList | null)?.value === 'cover';
  /** The slide's own look, as the always-shown fields say it. */
  const lookOf = (): SlidePictureStyle => ({
    display: (field('pictureDisplay')?.value || 'fill') as SlidePictureStyle['display'],
    background: slideBackground(field('pictureBackground')?.value ?? 'none', field('pictureColour')?.value ?? ''),
    rounded: !!field('pictureRounded')?.checked,
    shadow: !!field('pictureShadow')?.checked,
  });
  const pictureOf = (item: HighlightItem) => showCover() ? coverHighlight(item) : pictureHighlight(item, field('picture')?.value ?? '', inheriting() ? undefined : lookOf());
  /** Whether the slide follows the carousel, said in the line and on Use carousel settings. */
  const following = (inherit: boolean) => {
    const input = field('pictureInherit');
    if (input) input.value = String(inherit);
    const line = pictureField?.querySelector('[data-slide-picture-following] p');
    if (line) line.textContent = inherit ? 'Following the carousel settings. Change any to give this slide its own.' : 'This slide has its own picture settings.';
    const reset = pictureField?.querySelector<HTMLButtonElement>('[data-slide-picture-reset]');
    if (reset) reset.disabled = inherit;
    const colour = pictureField?.querySelector<HTMLElement>('[data-slide-picture-colour]');
    if (colour) colour.hidden = field('pictureBackground')?.value !== 'colour';
  };
  let previewGeneration = 0;
  const updatePreview = async () => {
    if (!pictureField) return;
    const generation = ++previewGeneration;
    const look = lookOf();
    const url = new URL(location.href);
    url.searchParams.set('draftPicture', field('picture')?.value ?? '');
    url.searchParams.set('draftInherit', String(inheriting()));
    url.searchParams.set('draftDisplay', look.display ?? 'fill');
    url.searchParams.set('draftBackground', String(look.background));
    url.searchParams.set('draftRounded', String(look.rounded));
    url.searchParams.set('draftShadow', String(look.shadow));
    if (showCover()) url.searchParams.set('draftShow', 'cover');
    else url.searchParams.delete('draftShow');
    const regions = form?.hasAttribute('data-highlights-new') ? ['highlight-preview', SLIDE_PICTURE_REGION] : [SLIDE_PICTURE_REGION];
    await swapRegions(regions, url.href, () => generation !== previewGeneration || !root.isConnected, { label: 'Updating slide preview…' });
  };

  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('[data-slide-picture-pick]') && picker) {
      const mark = (grid: HTMLElement) => {
        grid.dataset.pickKind = 'image';
        grid.querySelectorAll<HTMLElement>('[data-editor-media]').forEach((card) =>
          card.setAttribute('aria-pressed', String(card.dataset.editorMedia === field('picture')?.value)));
      };
      const grid = picker.querySelector<HTMLElement>('[data-editor-media-grid]');
      if (grid) mark(grid);
      picker.showModal();
      void fillPicker(picker, mark);
    }
    if (target.closest('[data-slide-picture-auto]') && pictureField) {
      const input = field('picture');
      if (!input) return;
      input.value = '';
      const name = pictureField.querySelector('[data-slide-picture-name] p');
      if (name) name.textContent = 'Automatic picture';
      (target.closest('[data-slide-picture-auto]') as HTMLButtonElement).disabled = true;
      changed();
      void updatePreview();
    }
    const reset = target.closest<HTMLButtonElement>('[data-slide-picture-reset]');
    if (reset && !reset.disabled && pictureField) {
      // back to following the carousel: its settings shown, the slide's own forgotten
      const select = (name: string, value: string) => field(name)?.closest('[data-select]')?.dispatchEvent(new CustomEvent('select-set', { detail: { value } }));
      select('pictureDisplay', h.display ?? 'fill');
      select('pictureBackground', h.background ? 'auto' : 'none');
      const rounded = field('pictureRounded');
      if (rounded) rounded.checked = h.rounded !== false;
      const shadow = field('pictureShadow');
      if (shadow) shadow.checked = !!h.shadow;
      following(true);
      changed();
      void updatePreview();
      pictureField.querySelector<HTMLElement>('[data-slide-picture-pick]')?.focus();
    }
  }, { signal });
  picker?.addEventListener('click', (e) => {
    const card = (e.target as Element).closest<HTMLElement>('[data-editor-media]');
    if (card?.dataset.editorMedia) choosePicture(card.dataset.editorMedia);
  }, { signal });
  picker?.addEventListener('media:uploaded', async (e) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    await swapRegions(['media-grid']);
    let chosen = false;
    await fillPicker(picker, (grid) => {
      grid.dataset.pickKind = 'image';
      if (chosen) return;
      if (grid.querySelector(`[data-editor-media="${CSS.escape(id)}"]`)) {
        chosen = true;
        choosePicture(id);
      } else if (!grid.dataset.mediaNext) {
        say('This item cannot be used as a slide picture. Choose a public picture with alt text.');
      }
    });
  }, { signal });

  /** Saves the whole file; on success the screen shows `slide` with the focus on `focus`, and the status says `what`. */
  const save = async (next: Highlights, what: string, slide: string, focus: string, el?: Element | null): Promise<boolean> => {
    say('');
    saveStatus.saving();
    const r = await track(underWay(what), { el: el ?? form }, () => api('PUT', 'highlights', { highlights: next, ifMatch: { [KEY]: state.version } }));
    if (!r.ok) {
      const why = refused(r, "The change wasn't saved. Try again.");
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
      const t = e.target as HTMLElement;
      if (e.defaultPrevented || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey) return;
      // a source's tile: its preview, keeping the kind and search to come back to
      const tile = t.closest<HTMLElement>('[data-highlight-source]');
      if (tile) {
        e.preventDefault();
        const url = new URL(location.href);
        url.searchParams.set('source', tile.dataset.highlightSource!);
        void show(url, { push: true, focus: '[data-highlights-back]' });
        return;
      }
      const link = t.closest<HTMLElement>('[data-highlights-go]');
      if (!link) return;
      e.preventDefault();
      if (link.getAttribute('aria-disabled') === 'true' || !leave()) return;
      unsaved = false;
      saveStatus.clean();
      const slide = link.dataset.highlightsGo!;
      const href = link.getAttribute('href');
      const back = link.dataset.highlightsBack;
      const focus = back ? `[data-highlight-source="${CSS.escape(back)}"]` : slide === 'new' ? '[data-source-search] input' : go(slide);
      void show(href ? new URL(href, location.href) : slide, { push: true, focus });
    },
    { signal },
  );
  window.addEventListener('popstate', () => void show(new URL(location.href)), { signal });

  if (!form) return;
  const changed = () => {
    unsaved = true;
    say('');
    saveStatus.dirty(form.hasAttribute('data-highlights-settings') ? 'Carousel settings' : 'Home highlights');
  };
  form.addEventListener('input', changed, { signal });
  form.addEventListener('change', changed, { signal });
  // a change to the picture's look gives the slide its own settings, and is previewed
  const LOOK = new Set(['pictureDisplay', 'pictureBackground', 'pictureColour', 'pictureRounded', 'pictureShadow']);
  form.addEventListener('change', (e) => {
    if (!LOOK.has((e.target as HTMLInputElement).name)) return;
    following(false);
    void updatePreview();
  }, { signal });
  // Time per slide only means something while the slides play by themselves
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'autoplay') timeFollows(t, field('interval'));
  }, { signal });
  // an album slide's Show: its arranged cover, or one picture with its choices
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).name !== 'slideShow') return;
    const cover = showCover();
    const one = pictureField?.querySelector<HTMLElement>('[data-slide-picture-one]');
    const arranged = pictureField?.querySelector<HTMLElement>('[data-slide-picture-cover]');
    if (one) one.hidden = cover;
    if (arranged) arranged.hidden = !cover;
    void updatePreview();
  }, { signal });

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
          loop: checked('loop'),
          autoplay: checked('autoplay'),
          interval: slideSeconds(Number(field('interval')?.value)),
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
        const items = addHighlight(h.items, pictureOf(choice.item), id);
        if (items === h.items) {
          say(h.items.length >= HIGHLIGHT_MAX ? 'The carousel is full. Remove a slide to add another.' : 'That source is already a slide. Choose another.');
          return;
        }
        await save({ ...h, items: excerptHighlight(items, id, field('excerpt')?.value ?? '') }, 'Added slide', id, go(id));
        return;
      }
      // ---------- a slide's excerpt ----------
      const id = state.selected;
      await save({ ...h, items: excerptHighlight(h.items.map((item) => item.id === id ? pictureOf(item) : item), id, field('excerpt')?.value ?? '') }, 'Saved slide', id, 'button[type="submit"]');
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
        if (!leave()) return;
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
    if (unsaved || picker?.open) return;
    void swapRegions([REGION], location.href, () => unsaved, { quiet: true });
  }, signal);
}
