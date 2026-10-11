/**
 * The top bar's test status (documentation/editor/test-runs.md §6.1): the newest run's health, progress and
 * last signal, from the brief stream; shown while a run is active and for an hour after it ends.
 */
import { clock } from '../model/testRun';
import type { RunBrief } from '../server/testRuns';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const SHOW_AFTER_MS = 60 * 60 * 1000;
const STALE_MS = 3000;

export function initTestStatus(el: HTMLAnchorElement, signal: AbortSignal): void {
  el.href = `${BASE}/_edit/tests/`;
  const text = el.querySelector<HTMLElement>('[data-t="text"]')!;
  const ago = el.querySelector<HTMLElement>('[data-t="ago"]')!;
  let run: RunBrief | null = null;
  let offset = 0;
  let heard = 0;
  const source = new EventSource(`${BASE}/_edit/api/tests/stream?brief=1`);
  source.addEventListener('brief', (e) => {
    const d = JSON.parse((e as MessageEvent).data) as { asOf: number; run: RunBrief | null; active: number };
    offset = d.asOf - Date.now();
    heard = Date.now();
    run = d.run;
    draw();
  });
  signal.addEventListener('abort', () => source.close());
  const timer = setInterval(draw, 500);
  signal.addEventListener('abort', () => clearInterval(timer));

  function draw() {
    const now = Date.now() + offset;
    const recent = run && (run.active || now - run.startedAt < SHOW_AFTER_MS);
    el.hidden = !recent;
    if (!run || !recent) return;
    const c = run.counts;
    el.dataset.health = run.health.state;
    const words = [run.health.label, c.total ? `${c.done} of ${c.total}` : '', c.failed ? `${c.failed} failed` : ''].filter(Boolean).join(', ');
    text.textContent = `Tests: ${words}`;
    const quiet = Date.now() - heard;
    const stale = quiet > STALE_MS;
    ago.dataset.stale = String(stale);
    ago.textContent = stale ? `no update for ${clock(quiet)}` : run.active && run.beat ? `${clock(now - run.beat)} ago` : '';
    el.setAttribute('aria-label', `Tests: ${words}${ago.textContent ? `, ${ago.textContent}` : ''}. Open the Tests screen.`);
  }
}
