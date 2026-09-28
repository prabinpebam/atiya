/**
 * The /play page's own part of the load (docs: poc-3d-navigation/progressive-loading.md §5.2, §5.3):
 * Prabin's welcome, which shows from the first paint (play.astro renders it) and which the game takes
 * over at the line the visitor has reached once the planet is live, and the loading scene (a little
 * drawn planet and a progress bar) that the real planet replaces. Part of the gate, so it stays tiny:
 * no React, no three.js.
 */

interface Greeting {
  lines: string[];
  index: number;
  closed: boolean;
  handOver(): void;
}

const READY = 'Getting the planet ready…';

/** The loading scene's progress (0…1), and the moment the planet goes live (it fades out). */
function loadScreen(container: HTMLElement) {
  const scene = container.querySelector<HTMLElement>('[data-load-scene]');
  const fill = container.querySelector<HTMLElement>('[data-load-fill]');
  const status = container.querySelector<HTMLElement>('[data-load-status]');
  let shown = 0;
  return {
    progress(f: number): void {
      shown = Math.max(shown, Math.min(1, f));
      fill?.style.setProperty('--load', String(shown));
    },
    /** Said beside the bar once the visitor has read the welcome and the planet isn't there yet. */
    waiting(): void {
      if (status && scene && !scene.dataset.live) status.textContent = READY;
    },
    live(): void {
      if (!scene || scene.dataset.live) return;
      this.progress(1);
      scene.dataset.live = '';
      if (status) status.textContent = '';
      const done = () => scene.remove();
      scene.addEventListener('transitionend', done, { once: true });
      // (no transition under reduced motion, or in a background tab)
      window.setTimeout(done, 1200);
    },
  };
}

export type LoadScreen = ReturnType<typeof loadScreen>;

function greeting(container: HTMLElement, screen: LoadScreen): Greeting | null {
  const box = container.querySelector<HTMLElement>('[data-greeting]');
  const data = document.getElementById('greeting-data')?.textContent;
  if (!box || box.hidden || !data) return null;
  const variants = JSON.parse(data) as Record<'first' | 'touch' | 'back', string[]>;
  const lines = variants[(box.dataset.variant as 'first' | 'touch' | 'back') ?? 'first'] ?? variants.first;
  const line = box.querySelector<HTMLElement>('[data-greeting-line]');
  const label = box.querySelector<HTMLElement>('[data-greeting-label]');
  line?.setAttribute('aria-live', 'polite');
  const g: Greeting = {
    lines,
    index: 0,
    closed: false,
    handOver() {
      document.removeEventListener('keydown', onKey, true);
      box.remove();
    },
  };
  const show = () => {
    if (line) line.textContent = lines[g.index];
    if (label) label.textContent = g.index === lines.length - 1 ? 'Bye' : 'Next';
  };
  const close = () => {
    g.closed = true;
    box.hidden = true;
    screen.waiting();
  };
  const next = () => {
    if (g.index + 1 < lines.length) {
      g.index++;
      show();
    } else close();
  };
  // the game's keys for a conversation: E or Enter goes on, Space or Escape ends it
  function onKey(e: KeyboardEvent): void {
    if (g.closed || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
    // (a link or another button keeps its own Enter)
    const other = t?.closest('a, button') && !t.closest('[data-greeting]');
    if (e.code === 'KeyE' || (e.code === 'Enter' && !other)) {
      e.preventDefault();
      if (!e.repeat) next();
    } else if ((e.code === 'Space' && !other) || e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) close();
    }
  }
  box.querySelector('[data-greeting-next]')?.addEventListener('click', next);
  box.querySelector('[data-greeting-close]')?.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  show();
  return g;
}

/** Starts the page's side of the load: the game finds these on `window` (controller.ts, game-mount.tsx). */
export function startLoadScene(container: HTMLElement): LoadScreen {
  const w = window as unknown as { __loadScreen?: LoadScreen; __greeting?: Greeting | null };
  if (w.__loadScreen) return w.__loadScreen;
  const screen = loadScreen(container);
  w.__loadScreen = screen;
  w.__greeting = greeting(container, screen);
  return screen;
}

/** Hides the load scene and the welcome behind a gate panel (the fallback, the offer, an error). */
export function hideLoadScene(container: HTMLElement, hidden: boolean): void {
  container.querySelectorAll<HTMLElement>('[data-load-scene], [data-greeting]').forEach((el) => {
    if (hidden) el.dataset.gateHidden = '';
    else delete el.dataset.gateHidden;
  });
}

/**
 * Warms the browser's cache with what the planet needs before it's live (its tier-1 textures and the
 * character's model), in parallel with the game's code, so the game's loaders find them there. The
 * list is generated into the page (play.astro).
 */
export function warmCriticalAssets(character: string): void {
  const el = document.getElementById('critical-assets');
  if (!el?.textContent) return;
  const list = JSON.parse(el.textContent) as { textures: string[]; characters: Record<string, string> };
  const urls = [list.characters[character] ?? Object.values(list.characters)[0], ...list.textures].filter(Boolean);
  for (const url of urls)
    void fetch(url, { credentials: 'same-origin' })
      .then((r) => r.blob())
      .catch(() => undefined);
}
