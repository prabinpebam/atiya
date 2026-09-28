/**
 * /play capability gate (spec §5.9). Runs first and must stay tiny:
 * no React or three imports — the game bundle is only fetched if this passes.
 */
import { CONFIG } from '../config';
import type { LandmarkData } from '../types';
import { decide, probeCapabilities, type GateDecision } from './capabilities';
import { prefs } from './prefs';
import { parsePlayUrl } from './url';
import { withBase } from './base';
import { hideLoadScene, startLoadScene, warmCriticalAssets } from './greeting';

const container = document.getElementById('game-container') as HTMLElement;

function landmarks(): LandmarkData[] {
  const el = document.getElementById('landmarks-data');
  return el?.textContent ? (JSON.parse(el.textContent) as LandmarkData[]) : [];
}

/** A gate card over the page (the loading scene and the welcome are hidden behind it). */
function panel(html: string, focusSelector?: string): void {
  container.querySelector('[data-gate-panel]')?.remove();
  hideLoadScene(container, true);
  const el = document.createElement('div');
  el.className = 'overlay';
  el.dataset.gatePanel = '';
  el.innerHTML = `<div class="card center-card gate-card">${html}</div>`;
  container.append(el);
  if (focusSelector) container.querySelector<HTMLElement>(focusSelector)?.focus();
}

const CLASSIC = `<a class="btn primary" href="${withBase('/classic/')}" data-gate-classic>Go to the classic site</a>`;

function bindClassic(): void {
  container.querySelectorAll('[data-gate-classic]').forEach((a) => a.addEventListener('click', () => prefs.setMode('classic')));
}

/** The loading scene (play.astro): Prabin's welcome, the little planet and the bar (greeting.ts). */
function showLoading(): void {
  container.querySelector('[data-gate-panel]')?.remove();
  hideLoadScene(container, false);
  startLoadScene(container).progress(0.08);
}

function showFallback(): void {
  panel(
    `<h1 class="card-title">Your browser can't show the 3D planet</h1>
     <p>No problem — everything is available on the classic site.</p>
     <div class="actions">${CLASSIC}</div>`,
    '[data-gate-classic]',
  );
  bindClassic();
  container.dataset.gate = 'fallback';
}

function showOffer(reason: Extract<GateDecision, { kind: 'offer' }>['reason']): void {
  const why =
    reason === 'save-data'
      ? 'Data Saver is on, and the 3D planet downloads extra assets.'
      : "Your device may struggle with the 3D planet (it looks like graphics acceleration isn't available).";
  panel(
    `<h1 class="card-title">Explore in 3D anyway?</h1>
     <p>${why}</p>
     <div class="actions">${CLASSIC}<button class="btn" type="button" data-gate-continue>Continue anyway</button></div>`,
    '[data-gate-classic]',
  );
  bindClassic();
  container.dataset.gate = 'offer';
  container.querySelector('[data-gate-continue]')?.addEventListener('click', () => void load('low'));
}

function showError(kind: 'load' | 'timeout'): void {
  const msg = kind === 'timeout' ? 'The planet is taking too long to load.' : "The planet couldn't be loaded.";
  panel(
    `<h1 class="card-title">${msg}</h1>
     <div class="actions"><button class="btn" type="button" data-gate-retry>Retry</button>${CLASSIC}</div>`,
    '[data-gate-classic]',
  );
  bindClassic();
  container.dataset.gate = 'error';
  container.querySelector('[data-gate-retry]')?.addEventListener('click', () => location.reload());
}

/**
 * Dev only: /play has no Astro React island, so Astro never injects React Fast Refresh's preamble.
 * Install it before importing the game, otherwise dev-transformed modules throw `$RefreshSig$ is not defined`.
 */
async function installDevRefreshPreamble(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as Record<string, unknown>;
  if (w.__vite_plugin_react_preamble_installed__) return;
  const url = '/@react-refresh';
  const runtime = (await import(/* @vite-ignore */ url)) as { injectIntoGlobalHook?: (w: Window) => void; default?: { injectIntoGlobalHook?: (w: Window) => void } };
  (runtime.injectIntoGlobalHook ?? runtime.default?.injectIntoGlobalHook)?.(window);
  w.$RefreshReg$ = () => {};
  w.$RefreshSig$ = () => (type: unknown) => type;
  w.__vite_plugin_react_preamble_installed__ = true;
}

async function load(quality: 'high' | 'low' = 'high'): Promise<void> {
  // Non-production builds only: ?quality=high|low overrides the tier (visual testing on headless GPUs).
  if (import.meta.env.MODE !== 'production') {
    const q = new URLSearchParams(location.search).get('quality');
    if (q === 'high' || q === 'low') quality = q;
  }
  container.dataset.gate = 'loading';
  performance.mark('game:gate');
  showLoading();
  warmCriticalAssets(prefs.getCharacter());
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    showError('timeout');
  }, CONFIG.loadTimeoutMs);
  try {
    await installDevRefreshPreamble();
    const { mountGame } = await import('../game-mount');
    if (timedOut) return;
    performance.mark('game:chunk');
    window.clearTimeout(timer);
    container.dataset.gate = 'loaded';
    await mountGame(container, landmarks(), { quality });
  } catch (err) {
    window.clearTimeout(timer);
    console.error(err);
    if (!timedOut) showError('load');
  }
}

document.querySelectorAll('[data-classic-link]').forEach((a) => a.addEventListener('click', () => prefs.setMode('classic')));

const url = parsePlayUrl(location.search);
if (url.mode === 'classic') {
  prefs.setMode('classic');
  location.replace(withBase('/classic/'));
} else {
  if (url.mode === 'play') prefs.setMode('play');
  const decision = decide(probeCapabilities());
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (decision.kind === 'load') void load(coarse ? 'low' : 'high');
  else if (decision.kind === 'offer') showOffer(decision.reason);
  else showFallback();
}
