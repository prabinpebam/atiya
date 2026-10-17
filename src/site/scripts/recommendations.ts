/**
 * Recommendations on a page (documentation/sections/recommendations.md §3): each card's words are cut to its
 * layout's lines once measured, and only a card whose words are longer shows its control: Read in full opens the
 * page's dialog (`#recommendation-dialog`, placed by the layout) with the whole recommendation, titled with the
 * person's name; Show it all (rows and the wall) expands the card in place and back.
 */

const DIALOG = 'recommendation-dialog';

/** A copy of a card's part for the dialog: whole, with no ids of its own (the card keeps them). */
function copyOf(el: Element): Element {
  const c = el.cloneNode(true) as Element;
  for (const n of [c, ...c.querySelectorAll('[id]')]) n.removeAttribute('id');
  c.removeAttribute('data-clamped');
  c.removeAttribute('data-words');
  return c;
}

export function clampRecommendations(band: HTMLElement, signal: AbortSignal): void {
  const inline = band.dataset.open === 'inline';
  const cards = [...band.querySelectorAll<HTMLElement>('[data-recommendation]')];
  const label = (b: HTMLElement, text: string) => {
    const l = b.querySelector('.label');
    if (l) l.textContent = text;
  };

  /** Cuts each card's words to its lines, and shows its control only when that cut anything. */
  const measure = () => {
    for (const card of cards) {
      const words = card.querySelector<HTMLElement>('[data-words]');
      const more = card.querySelector<HTMLElement>('[data-more]');
      if (!words || !more || words.hasAttribute('data-expanded')) continue;
      words.setAttribute('data-clamped', '');
      const cut = words.scrollHeight > words.clientHeight + 1;
      if (!cut) words.removeAttribute('data-clamped');
      more.hidden = !cut;
    }
  };

  for (const b of band.querySelectorAll<HTMLElement>('[data-more-button]')) {
    if (b.dataset.controls) b.setAttribute('aria-controls', inline ? b.dataset.controls : DIALOG);
    if (inline) b.setAttribute('aria-expanded', 'false');
    else b.setAttribute('aria-haspopup', 'dialog');
  }

  measure();
  let frame = 0;
  const watch = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  });
  watch.observe(band);
  signal.addEventListener('abort', () => {
    watch.disconnect();
    cancelAnimationFrame(frame);
  });

  band.addEventListener(
    'click',
    (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-more-button]');
      const card = button?.closest<HTMLElement>('[data-recommendation]');
      const words = card?.querySelector<HTMLElement>('[data-words]');
      if (!button || !card || !words) return;
      const dialog = document.getElementById(DIALOG);
      if (inline || !(dialog instanceof HTMLDialogElement)) {
        // in place: all of it, or back to its lines
        const open = !words.hasAttribute('data-expanded');
        if (open) {
          words.setAttribute('data-expanded', '');
          words.removeAttribute('data-clamped');
        } else {
          words.removeAttribute('data-expanded');
          words.setAttribute('data-clamped', '');
        }
        button.setAttribute('aria-expanded', String(open));
        label(button, open ? 'Show less' : 'Show it all');
        return;
      }
      // in the page's dialog: the person's name as its title, the whole words and the person
      const title = dialog.querySelector(`#${DIALOG}-title`);
      if (title) title.textContent = card.querySelector('[id$="-name"]')?.textContent?.trim() ?? '';
      const body = dialog.querySelector('[data-recommendation-full]');
      const person = card.querySelector('[data-person]');
      body?.replaceChildren(copyOf(words), ...(person ? [copyOf(person)] : []));
      dialog.showModal();
    },
    { signal },
  );
}
