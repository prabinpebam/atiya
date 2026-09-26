/* ============================================================
   Slate Presentation Runtime
   ------------------------------------------------------------
   Presenter-controlled slide navigation with deterministic,
   interruptible WAAPI motion. Authored pages remain script-free;
   this trusted runtime enhances semantic .slate-slide content.
   ============================================================ */
(function () {
  'use strict';

  const STAGE_WIDTH = 1600;
  const STAGE_HEIGHT = 900;
  const ENTRANCE_DEADLINE_MS = 250;
  const CHANNEL_PREFIX = 'slate-presentation:';
  const PROTOCOL_VERSION = 1;
  const MOTION_MODES = ['full', 'reduced', 'off'];

  const runtime = {
    attached: false,
    path: '',
    revision: '',
    slides: [],
    meta: [],
    content: null,
    overlay: null,
    canvas: null,
    viewport: null,
    mode: 'reading',
    index: 0,
    fragmentIndex: -1,
    remembered: new Map(),
    animations: new Set(),
    navigationRevision: 0,
    commandRevision: 0,
    relativeDelta: 0,
    relativeScheduled: false,
    transitionWatchdog: null,
    layoutEpoch: 0,
    themeEpoch: 0,
    motionMode: readMotionMode(),
    motionPlan: null,
    motionUrl: '',
    attachRevision: 0,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
    presentButton: null,
    resizeObserver: null,
    resizeHandler: null,
    channel: null,
    sessionId: '',
    presenterId: '',
    sequence: 0,
    lastSequence: -1,
    audienceWindow: null,
    startedAt: 0,
    timer: null,
    historyHandler: null,
    keyHandler: null,
    themeObserver: null,
    destroyed: false,
    priorFocus: null,
    adapterFailures: 0,
    elementAnimations: new WeakMap(),
    noteDirty: false,
    noteSaveTimer: null,
    pendingNote: null,
    forceReflow: false,
  };

  const waapiAdapter = {
    play(element, keyframes, options) {
      const prior = runtime.elementAnimations.get(element);
      if (prior) {
        try { prior.cancel(); } catch (_) {}
        runtime.animations.delete(prior);
      }
      const animation = element.animate(keyframes, options);
      runtime.elementAnimations.set(element, animation);
      animation.finished.catch(() => {}).finally(() => {
        if (runtime.elementAnimations.get(element) === animation) runtime.elementAnimations.delete(element);
      });
      return trackAnimation(animation);
    },
    cancel(reason) {
      runtime.animations.forEach(animation => {
        try { animation.cancel(); } catch (_) { runtime.adapterFailures++; }
      });
      runtime.animations.clear();
      return { cancelled: true, reason };
    },
    applyStableState(slide, fragmentIndex) {
      const slideId = stableSlideId(runtime.slides[runtime.index], runtime.index);
      const fragments = fragmentIdsFor(runtime.slides[runtime.index], slideId);
      slide.querySelectorAll('[data-motion-fragment]').forEach(element => {
        const visible = fragments.indexOf(element.getAttribute('data-motion-fragment')) <= fragmentIndex;
        element.classList.toggle('slate-motion-pending', !visible);
        if (visible) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', 'true');
      });
    },
    dispose(slide) {
      slide?.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
      slide?.querySelectorAll('[data-motion="draw-stroke"]').forEach(element => {
        element.style.removeProperty('stroke-dasharray');
        element.style.removeProperty('stroke-dashoffset');
      });
    },
    inspect() {
      return { runtime: 'waapi', activeAnimations: runtime.animations.size, failures: runtime.adapterFailures };
    },
  };

  function randomId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }

  function readMotionMode() {
    try {
      const saved = localStorage.getItem('slate-presentation-motion');
      if (MOTION_MODES.includes(saved)) return saved;
    } catch (_) {}
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
  }

  function writeMotionMode(mode) {
    runtime.motionMode = MOTION_MODES.includes(mode) ? mode : 'full';
    try { localStorage.setItem('slate-presentation-motion', runtime.motionMode); } catch (_) {}
    if (runtime.overlay) runtime.overlay.dataset.motion = runtime.motionMode;
    syncSnapshot('preference');
  }

  function stableSlideId(slide, index) {
    return slide.getAttribute('data-slide-id') || slide.id || `slide-${index + 1}`;
  }

  function sourceRevision() {
    return runtime.revision || 'unversioned';
  }

  function noteKey(slideId) {
    return `slate-presenter-note:${runtime.path}:${sourceRevision()}:${slideId}`;
  }

  function isEditable(target) {
    return !!target?.closest?.('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], video, audio');
  }

  function namespaceIds(root, prefix) {
    const map = new Map();
    root.querySelectorAll('[id]').forEach(element => {
      const oldId = element.id;
      const newId = `${prefix}-${oldId}`;
      map.set(oldId, newId);
      element.id = newId;
    });
    ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach(attribute => {
      root.querySelectorAll(`[${attribute}]`).forEach(element => {
        const value = element.getAttribute(attribute).split(/\s+/).map(id => map.get(id) || id).join(' ');
        element.setAttribute(attribute, value);
      });
    });
    root.querySelectorAll('a[href^="#"]').forEach(anchor => {
      const oldId = anchor.getAttribute('href').slice(1);
      if (map.has(oldId)) anchor.setAttribute('href', `#${map.get(oldId)}`);
    });
  }

  function motionPlanFor(slideId) {
    return runtime.motionPlan?.slides?.[slideId] || null;
  }

  function validMotionPlan(value) {
    if (!value || value.version !== 1 || !/^[a-z][a-z0-9-]{0,63}$/.test(value.deckId || '') || !value.slides || typeof value.slides !== 'object' || Array.isArray(value.slides)) return false;
    const dangerous = new Set(['__proto__', 'prototype', 'constructor']);
    const recipes = new Set(['fade-in', 'fade-rise', 'fade-left', 'scale-in', 'draw-stroke', 'shape-pop', 'bar-grow', 'line-grow', 'wipe-reveal', 'spin-settle', 'path-travel']);
    const transitions = new Set(['cut', 'crossfade-short', 'shared-axis-x', 'shared-axis-x-reverse']);
    const safeObject = (object, allowed) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => !dangerous.has(key) && allowed.has(key));
    if (!safeObject(value, new Set(['version', 'deckId', 'authoringMode', 'stage', 'defaultRevisit', 'slides', 'transitions']))) return false;
    if (!['generated', 'retrofit'].includes(value.authoringMode)) return false;
    if (value.stage && (!safeObject(value.stage, new Set(['width', 'height'])) || !Number.isInteger(value.stage.width) || !Number.isInteger(value.stage.height) || value.stage.width < 800 || value.stage.width > 3840 || value.stage.height < 450 || value.stage.height > 2160)) return false;
    if (value.defaultRevisit && !['restore', 'start', 'end'].includes(value.defaultRevisit)) return false;
    if (value.transitions && (!safeObject(value.transitions, new Set(['forward', 'backward', 'jump'])) || Object.values(value.transitions).some(item => !transitions.has(item)))) return false;
    for (const [slideId, slide] of Object.entries(value.slides)) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(slideId) || !safeObject(slide, new Set(['claim', 'blueprint', 'visualMechanism', 'reducedMotion', 'durationMs', 'revisit', 'fragments', 'targets', 'fallback']))) return false;
      if (value.authoringMode === 'generated') {
        if (typeof slide.claim !== 'string' || slide.claim.trim().length < 8) return false;
        if (!['relationship-reveal', 'journey-handoff', 'quantity-build', 'system-assembly', 'decision-shift', 'custom'].includes(slide.blueprint)) return false;
        if (typeof slide.visualMechanism !== 'string' || slide.visualMechanism.trim().length < 8) return false;
        if (typeof slide.reducedMotion !== 'string' || slide.reducedMotion.trim().length < 8) return false;
        if (!Array.isArray(slide.fragments) || slide.fragments.length === 0 || !Array.isArray(slide.targets) || slide.targets.length === 0) return false;
      }
      if (slide.revisit && !['restore', 'start', 'end'].includes(slide.revisit)) return false;
      if (slide.fallback && !['start', 'end'].includes(slide.fallback)) return false;
      if (slide.durationMs != null && (!Number.isInteger(slide.durationMs) || slide.durationMs < 1 || slide.durationMs > 60000)) return false;
      if (slide.fragments && (!Array.isArray(slide.fragments) || slide.fragments.length > 20)) return false;
      if (slide.targets && (!Array.isArray(slide.targets) || slide.targets.length > 100 || slide.targets.some(target => !safeObject(target, new Set(['id', 'recipe', 'startMs', 'durationMs', 'pathId', 'fragmentId', 'revealOffsetMs'])) || !recipes.has(target.recipe) || (target.recipe === 'path-travel' && !target.pathId) || (target.pathId != null && !/^[a-z][a-z0-9-]{0,63}$/.test(target.pathId)) || (target.fragmentId != null && !/^[a-z][a-z0-9-]{0,63}$/.test(target.fragmentId)) || (target.revealOffsetMs != null && (!Number.isInteger(target.revealOffsetMs) || target.revealOffsetMs < 0 || target.revealOffsetMs > 2000))))) return false;
    }
    return true;
  }

  function fragmentIdsFor(slide, slideId) {
    const planned = motionPlanFor(slideId)?.fragments;
    if (Array.isArray(planned)) return planned.map(item => typeof item === 'string' ? item : item?.id).filter(Boolean);
    const seen = new Set();
    slide.querySelectorAll('[data-motion-fragment]').forEach(element => seen.add(element.getAttribute('data-motion-fragment')));
    return [...seen].filter(Boolean);
  }

  async function loadMotionPlan(url, attachRevision) {
    runtime.motionPlan = null;
    runtime.motionUrl = url || '';
    if (!url) return;
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.json();
      if (!validMotionPlan(value)) throw new Error('unsupported or unsafe motion manifest');
      const pageDeckId = runtime.slides[0]?.closest('.slate-deck')?.getAttribute('data-deck-id');
      if (!pageDeckId || value.deckId !== pageDeckId) throw new Error('motion deckId does not match the page deck');
      if (attachRevision !== runtime.attachRevision) return;
      runtime.motionPlan = value;
      runtime.stageWidth = Number(value.stage?.width) || STAGE_WIDTH;
      runtime.stageHeight = Number(value.stage?.height) || STAGE_HEIGHT;
      fitStage();
      if (runtime.overlay) renderStable({ animate: false, transition: 'cut', source: 'manifest' });
    } catch (error) {
      console.warn(`Slate presentation motion disabled: ${error.message}`);
    }
  }

  function addPresentButton() {
    runtime.presentButton?.remove();
    const header = document.querySelector('.header');
    const theme = document.querySelector('.theme-toggle');
    if (!header) return;
    const button = document.createElement('button');
    button.className = 'present-button';
    button.type = 'button';
    button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">present_to_all</span><span>Present</span>';
    button.setAttribute('aria-label', 'Present this deck');
    button.addEventListener('click', () => enter('presenter'));
    header.insertBefore(button, theme || null);
    runtime.presentButton = button;
  }

  function attach(options) {
    destroy();
    const attachRevision = ++runtime.attachRevision;
    runtime.destroyed = false;
    runtime.attached = true;
    runtime.path = options.path || location.hash.slice(1).split('#')[0] || 'deck';
    runtime.revision = options.revision || '';
    runtime.slides = Array.from(options.slides || []);
    runtime.meta = Array.from(options.meta || []);
    runtime.content = options.content || document.querySelector('#content');
    runtime.index = 0;
    runtime.fragmentIndex = -1;
    runtime.remembered = new Map();
    runtime.stageWidth = STAGE_WIDTH;
    runtime.stageHeight = STAGE_HEIGHT;
    void loadMotionPlan(options.motionUrl, attachRevision);
    addPresentButton();

    const params = new URLSearchParams(location.search);
    const requestedSlide = params.get('slateSlide');
    if (requestedSlide) {
      const index = runtime.slides.findIndex((slide, i) => stableSlideId(slide, i) === requestedSlide);
      if (index >= 0) {
        runtime.index = index;
        const requestedFragment = params.get('slateFragment');
        const fragments = fragmentIdsFor(runtime.slides[index], requestedSlide);
        runtime.fragmentIndex = requestedFragment ? fragments.indexOf(requestedFragment) : -1;
      }
    }
    if (params.get('slateAudience') === '1') {
      runtime.sessionId = params.get('slateSession') || '';
      queueMicrotask(() => enter('audience'));
    }
  }

  function shellMarkup(mode) {
    const presenter = mode === 'presenter';
    const audience = mode === 'audience';
    return `
      <div class="slate-present__viewport">
        <div class="slate-present__stage" aria-live="off"><div class="slate-present__canvas"></div></div>
      </div>
      ${presenter ? `<aside class="slate-present__panel" aria-label="Presenter notes">
        <div class="slate-present__panel-head"><strong>Presenter view</strong><span class="slate-present__connection" data-state="closed">Audience closed</span></div>
        <div class="slate-present__preview"><span>Next</span><div class="slate-present__next"></div></div>
        <section class="slate-present__notes">
          <div class="slate-present__notes-head"><strong>Canonical script</strong><span><button type="button" data-note="smaller" aria-label="Smaller notes text">A-</button><button type="button" data-note="larger" aria-label="Larger notes text">A+</button></span></div>
          <div class="slate-present__canonical"></div>
          <div class="slate-present__notes-head"><label for="slate-personal-note"><strong>My presenter notes</strong></label><span><button type="button" data-note="copy">Copy canonical</button><button type="button" data-note="reset">Reset</button></span></div>
          <textarea id="slate-personal-note" rows="7" placeholder="Saved only in this browser"></textarea>
          <div class="slate-present__save" role="status">Saved in this browser</div>
        </section>
      </aside>` : ''}
      <nav class="slate-present__controls" aria-label="Presentation controls">
        ${audience ? '' : '<button type="button" data-command="previous" aria-label="Previous"><span class="material-symbols-outlined" aria-hidden="true">arrow_back</span></button>'}
        <span class="slate-present__counter" aria-live="polite"></span>
        ${audience ? '' : '<button type="button" data-command="next" aria-label="Next"><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button><button type="button" data-command="audience" aria-label="Open audience window"><span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></button><button type="button" data-command="restart" aria-label="Restart slide"><span class="material-symbols-outlined" aria-hidden="true">replay</span></button><button type="button" data-command="motion" class="slate-present__motion" aria-label="Change motion mode"></button><button type="button" data-command="theme" aria-label="Change color theme"><span class="material-symbols-outlined" aria-hidden="true">brightness_6</span></button>'}
        <button type="button" data-command="fullscreen" aria-label="Toggle fullscreen"><span class="material-symbols-outlined" aria-hidden="true">fullscreen</span></button>
        ${audience ? '' : '<button type="button" data-command="exit" aria-label="Exit presentation"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>'}
      </nav>
      <div class="slate-present__announce slate-sr-only" aria-live="polite"></div>`;
  }

  function enter(mode) {
    if (!runtime.attached || runtime.overlay) return;
    runtime.mode = mode;
    runtime.priorFocus = document.activeElement;
    if (mode === 'audience') document.querySelectorAll('.slate-talktrack').forEach(element => element.remove());
    const app = document.querySelector('.app');
    if (app) { app.inert = true; app.setAttribute('aria-hidden', 'true'); }
    runtime.startedAt = Date.now();
    const overlay = document.createElement('div');
    overlay.className = `slate-present slate-present--${mode}`;
    overlay.dataset.motion = runtime.motionMode;
    overlay.dataset.state = 'preparing';
    overlay.innerHTML = shellMarkup(mode);
    document.body.appendChild(overlay);
    document.body.classList.add('slate-presenting');
    runtime.overlay = overlay;
    runtime.viewport = overlay.querySelector('.slate-present__viewport');
    runtime.canvas = overlay.querySelector('.slate-present__canvas');
    bindOverlayEvents();
    observeTheme();
    fitStage();
    runtime.resizeHandler = () => {
      runtime.layoutEpoch++;
      cancelAnimations('layout');
      fitStage();
      renderStable({ animate: false, transition: 'cut', source: 'layout' });
    };
    runtime.resizeObserver = new ResizeObserver(runtime.resizeHandler);
    runtime.resizeObserver.observe(runtime.viewport);
    addEventListener('resize', runtime.resizeHandler);
    runtime.historyHandler = event => {
      const position = event.state?.slatePresentation;
      if (position?.path === runtime.path) restorePosition(position);
    };
    addEventListener('popstate', runtime.historyHandler);
    runtime.keyHandler = onKeyDown;
    addEventListener('keydown', runtime.keyHandler, true);
    setupChannel(mode);
    if (runtime.motionPlan?.authoringMode === 'generated' && runtime.fragmentIndex < 0 && fragmentIdsFor(runtime.slides[runtime.index], currentSlideId()).length) runtime.fragmentIndex = 0;
    renderStable({ animate: mode !== 'audience', transition: 'cut', source: 'enter' });
    overlay.dataset.state = 'stable';
    updateMotionButton();
    startTimer();
  }

  function bindOverlayEvents() {
    runtime.overlay.querySelector('.slate-present__controls').addEventListener('click', event => {
      const command = event.target.closest('button')?.dataset.command;
      if (!command) return;
      if (command === 'next') queueRelative(1, { source: 'pointer' });
      if (command === 'previous') queueRelative(-1, { source: 'pointer' });
      if (command === 'restart') dispatchAbsolute(() => restart({ dispatched: true }));
      if (command === 'audience') openAudience();
      if (command === 'motion') cycleMotionMode();
      if (command === 'theme') document.querySelector('.theme-toggle')?.click();
      if (command === 'fullscreen') toggleFullscreen();
      if (command === 'exit') exit();
    });
    const notes = runtime.overlay.querySelector('#slate-personal-note');
    if (notes) {
      notes.addEventListener('input', () => {
        runtime.noteDirty = true;
        const status = runtime.overlay?.querySelector('.slate-present__save');
        if (status) status.textContent = 'Saving...';
        clearTimeout(runtime.noteSaveTimer);
        const slideId = currentSlideId();
        const value = notes.value;
        runtime.pendingNote = { slideId, value };
        runtime.noteSaveTimer = setTimeout(() => savePersonalNote(slideId, value), 300);
      });
    }
    runtime.overlay.querySelector('.slate-present__notes')?.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.note;
      if (!action) return;
      const area = runtime.overlay.querySelector('#slate-personal-note');
      const notesRegion = runtime.overlay.querySelector('.slate-present__notes');
      if (action === 'copy' && area) { area.value = runtime.overlay.querySelector('.slate-present__canonical')?.innerText.trim() || ''; savePersonalNote(currentSlideId(), area.value); }
      if (action === 'reset' && area) { area.value = ''; savePersonalNote(currentSlideId(), ''); }
      const current = Number(notesRegion?.dataset.noteScale || 1);
      if (action === 'smaller' || action === 'larger') {
        const next = Math.max(.8, Math.min(1.5, current + (action === 'larger' ? .1 : -.1)));
        notesRegion.dataset.noteScale = String(next);
        notesRegion.style.setProperty('--notes-scale', String(next));
      }
    });
  }

  function setupChannel(mode) {
    if (!('BroadcastChannel' in window)) return;
    if (mode === 'presenter') {
      runtime.sessionId = runtime.sessionId || randomId();
      runtime.presenterId = randomId();
    }
    if (!runtime.sessionId) return;
    runtime.channel = new BroadcastChannel(CHANNEL_PREFIX + runtime.sessionId);
    runtime.channel.addEventListener('message', onChannelMessage);
    if (mode === 'audience') runtime.channel.postMessage({ type: 'hello', protocol: PROTOCOL_VERSION, sessionId: runtime.sessionId, senderId: randomId() });
  }

  function onChannelMessage(event) {
    const message = event.data;
    if (!message || message.protocol !== PROTOCOL_VERSION || message.sessionId !== runtime.sessionId) return;
    if (runtime.mode === 'presenter' && message.type === 'hello') {
      setConnection('ready', 'Audience ready');
      syncSnapshot('snapshot');
      return;
    }
    if (runtime.mode !== 'audience' || message.type !== 'snapshot' || message.sequence <= runtime.lastSequence) return;
    runtime.lastSequence = message.sequence;
    if (message.path !== runtime.path) return;
    const index = runtime.slides.findIndex((slide, i) => stableSlideId(slide, i) === message.slideId);
    if (index < 0) return;
    const sameSlide = runtime.index === index;
    const nextFragmentIndex = Number.isInteger(message.fragmentIndex) ? message.fragmentIndex : -1;
    const systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    runtime.motionMode = systemReduced && message.motionMode === 'full' ? 'reduced' : (message.motionMode || runtime.motionMode);
    const root = document.documentElement;
    if (message.theme && root.getAttribute('data-theme') !== message.theme) root.setAttribute('data-theme', message.theme);
    updateMotionButton();
    if (sameSlide) {
      setFragment(nextFragmentIndex, { animate: message.action === 'adjacent', source: 'sync' });
      return;
    }
    runtime.index = index;
    runtime.fragmentIndex = nextFragmentIndex;
    renderStable({ animate: message.action === 'adjacent', transition: message.action === 'adjacent' ? message.direction : 'jump', source: 'sync' });
  }

  function syncSnapshot(action, direction) {
    if (runtime.mode !== 'presenter' || !runtime.channel) return;
    runtime.channel.postMessage({
      type: 'snapshot', protocol: PROTOCOL_VERSION, sessionId: runtime.sessionId,
      senderId: runtime.presenterId, sequence: ++runtime.sequence, path: runtime.path,
      slideId: currentSlideId(), fragmentIndex: runtime.fragmentIndex,
      motionMode: runtime.motionMode, theme: document.documentElement.getAttribute('data-theme') || 'light',
      action: action === 'adjacent' ? 'adjacent' : 'snapshot', direction,
    });
  }

  function setConnection(state, text) {
    const element = runtime.overlay?.querySelector('.slate-present__connection');
    if (!element) return;
    element.dataset.state = state;
    element.textContent = text;
  }

  function openAudience() {
    if (runtime.mode !== 'presenter') return;
    runtime.sessionId = runtime.sessionId || randomId();
    if (!runtime.channel && 'BroadcastChannel' in window) setupChannel('presenter');
    const url = new URL(location.href);
    url.searchParams.set('slateAudience', '1');
    url.searchParams.set('slateSession', runtime.sessionId);
    url.searchParams.set('slateSlide', currentSlideId());
    const fragment = currentFragmentId();
    if (fragment) url.searchParams.set('slateFragment', fragment); else url.searchParams.delete('slateFragment');
    runtime.audienceWindow = window.open(url, '_blank', 'noopener=false');
    setConnection(runtime.audienceWindow ? 'opening' : 'closed', runtime.audienceWindow ? 'Opening audience...' : 'Popup blocked');
  }

  function observeTheme() {
    runtime.themeObserver = new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'data-theme')) return;
      runtime.themeEpoch++;
      cancelAnimations('theme');
      renderStable({ animate: false, transition: 'cut', source: 'theme' });
      syncSnapshot('preference');
    });
    runtime.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function fitStage() {
    if (!runtime.viewport || !runtime.overlay) return;
    const style = getComputedStyle(runtime.viewport);
    const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availableWidth = Math.max(1, runtime.viewport.clientWidth - horizontalPadding);
    const availableHeight = Math.max(1, runtime.viewport.clientHeight - verticalPadding);
    const scale = Math.min(availableWidth / runtime.stageWidth, availableHeight / runtime.stageHeight);
    const reflow = runtime.forceReflow || scale < 0.42;
    runtime.overlay.classList.toggle('slate-present--reflow', reflow);
    runtime.overlay.style.setProperty('--stage-scale', String(Math.max(scale, 0.01)));
    runtime.overlay.style.setProperty('--stage-width', `${runtime.stageWidth}px`);
    runtime.overlay.style.setProperty('--stage-height', `${runtime.stageHeight}px`);
    const stage = runtime.overlay.querySelector('.slate-present__stage');
    if (reflow) {
      if (stage) { stage.style.width = ''; stage.style.height = ''; }
      if (runtime.canvas) { runtime.canvas.style.width = ''; runtime.canvas.style.height = ''; runtime.canvas.style.transform = ''; }
    } else {
      if (stage) { stage.style.width = `${runtime.stageWidth * scale}px`; stage.style.height = `${runtime.stageHeight * scale}px`; }
      if (runtime.canvas) {
        runtime.canvas.style.width = `${runtime.stageWidth}px`;
        runtime.canvas.style.height = `${runtime.stageHeight}px`;
        runtime.canvas.style.transform = `scale(${Math.max(scale, 0.01)})`;
      }
    }
  }

  function detectStageOverflow(slide) {
    if (!runtime.overlay || !slide) return;
    const body = slide.querySelector('.slate-slide__body');
    // Measure the slide in fixed-stage layout so the scrollable reflow container cannot hide the true
    // content size. This runs every render and is recoverable in both directions: a content-heavy slide
    // escapes to reflow, and a following lighter slide returns to the fitted stage instead of staying
    // stuck in reflow because an earlier slide overflowed once.
    const wasReflow = runtime.overlay.classList.contains('slate-present--reflow');
    if (wasReflow) runtime.overlay.classList.remove('slate-present--reflow');
    // Use a rounding-proof tolerance: genuine overflow is tens of pixels, while sub-pixel layout
    // rounding can report 1-3px. A small tolerance prevents a rounding difference from tripping reflow.
    const tolerance = 6;
    const overflow = !!body && (
      body.scrollHeight > body.clientHeight + tolerance
      || body.scrollWidth > body.clientWidth + tolerance
      || slide.scrollHeight > slide.clientHeight + tolerance
    );
    runtime.forceReflow = overflow;
    fitStage();
  }

  function cloneSlide(index) {
    const source = runtime.slides[index];
    const clone = source.cloneNode(true);
    clone.classList.add('slate-present__slide');
    if (runtime.motionPlan?.authoringMode === 'generated') clone.classList.add('slate-present__slide--generated');
    clone.classList.remove('slate-slide');
    clone.removeAttribute('inert');
    clone.querySelectorAll('.slate-talktrack').forEach(element => element.remove());
    clone.querySelectorAll('.heading-anchor, .collapse-toggle').forEach(element => element.remove());
    clone.querySelectorAll('[id]').forEach(element => {
      if (!element.hasAttribute('data-motion-id')) element.setAttribute('data-motion-id', element.id);
    });
    const plan = motionPlanFor(stableSlideId(source, index));
    for (const target of plan?.targets || []) {
      const element = clone.querySelector(`[data-motion-id="${CSS.escape(target.id)}"]`);
      if (!element) continue;
      element.setAttribute('data-motion', target.recipe);
      if (target.startMs != null) element.setAttribute('data-motion-delay', String(target.startMs));
      if (target.durationMs != null) element.setAttribute('data-motion-duration', String(target.durationMs));
      if (target.pathId != null) element.setAttribute('data-motion-path', target.pathId);
      if (target.fragmentId != null) element.setAttribute('data-motion-fragment-owner', target.fragmentId);
      if (target.revealOffsetMs != null) element.setAttribute('data-motion-reveal-offset', String(target.revealOffsetMs));
    }
    namespaceIds(clone, `slate-present-${runtime.navigationRevision}-${index}`);
    return clone;
  }

  function applyFragments(clone, slideId) {
    const fragments = fragmentIdsFor(runtime.slides[runtime.index], slideId);
    clone.querySelectorAll('[data-motion-fragment]').forEach(element => {
      const fragment = element.getAttribute('data-motion-fragment');
      const position = fragments.indexOf(fragment);
      if (position > runtime.fragmentIndex) {
        element.classList.add('slate-motion-pending');
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.classList.remove('slate-motion-pending');
        element.removeAttribute('aria-hidden');
      }
    });
    return fragments;
  }

  async function awaitSlideReady(slide, revision, layoutEpoch) {
    const timeout = new Promise(resolve => setTimeout(() => resolve(false), 220));
    const resources = [];
    slide.querySelectorAll('img').forEach(image => {
      if (image.complete) return;
      resources.push(typeof image.decode === 'function' ? image.decode().catch(() => {}) : new Promise(resolve => image.addEventListener('load', resolve, { once: true })));
    });
    if (document.fonts?.ready) resources.push(document.fonts.ready.catch(() => {}));
    const ready = Promise.allSettled(resources).then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
    const result = await Promise.race([ready, timeout]);
    return result && revision === runtime.navigationRevision && layoutEpoch === runtime.layoutEpoch;
  }

  function renderStable(options = {}) {
    if (!runtime.canvas || !runtime.slides.length) return;
    const revision = ++runtime.navigationRevision;
    clearTimeout(runtime.transitionWatchdog);
    cancelAnimations('render');
    const slideId = currentSlideId();
    const incoming = cloneSlide(runtime.index);
    const fragments = applyFragments(incoming, slideId);
    incoming.dataset.active = 'true';
    incoming.setAttribute('aria-label', `Slide ${runtime.index + 1} of ${runtime.slides.length}`);
    const outgoing = runtime.canvas.querySelector('.slate-present__slide[data-active="true"]');
    if (outgoing) {
      outgoing.dataset.active = 'false';
      outgoing.inert = true;
      outgoing.setAttribute('aria-hidden', 'true');
      stopSlideMedia(outgoing);
    }
    runtime.canvas.appendChild(incoming);
    // Decide fixed-stage vs reflow synchronously (before the transition/entrance) so the layout mode is
    // stable for the whole slide instead of flipping mid-animation, and so shouldAnimate sees it.
    detectStageOverflow(incoming);
    if (runtime.mode === 'presenter' && (options.source === 'enter' || options.source === 'keyboard' || options.source === 'layout')) {
      const heading = incoming.querySelector('.slate-slide__title');
      if (heading) { heading.tabIndex = -1; requestAnimationFrame(() => heading.focus({ preventScroll: true })); }
    }
    updateChrome(fragments);
    updateNotes();
    updateNextPreview();
    updateHistory(options.history || 'replace');
    const shouldAnimate = options.animate !== false
      && runtime.motionMode === 'full'
      && !runtime.overlay.classList.contains('slate-present--reflow');
    // Arm entrance start states synchronously before paint so content never flashes its final state
    // (during a slide transition the entrance plays only after the transition settles).
    if (shouldAnimate) armEntrance(incoming);
    if (!shouldAnimate || !outgoing) {
      outgoing?.remove();
      animateEntrance(incoming, revision, options.animate !== false);
    } else {
      animateTransition(outgoing, incoming, options.transition || 'forward', revision);
      // Play entrance immediately (content is already armed hidden) rather than chaining it to the
      // transition's finish promise, so armed content can never get stuck hidden if the transition is
      // paused or interrupted.
      animateEntrance(incoming, revision, true);
    }
    const plannedDuration = Math.max(Number(motionPlanFor(slideId)?.durationMs) || 1200, estimateChoreographyDuration(incoming));
    runtime.transitionWatchdog = setTimeout(() => {
      if (revision !== runtime.navigationRevision) return;
      cancelAnimations('watchdog');
      runtime.canvas?.querySelectorAll('.slate-present__slide:not([data-active="true"])').forEach(element => element.remove());
      incoming.getAnimations().forEach(animation => animation.cancel());
      if (runtime.overlay) runtime.overlay.dataset.state = 'stable';
    }, Math.max(900, Math.min(60300, plannedDuration + ENTRANCE_DEADLINE_MS + 300)));
    syncSnapshot(options.source === 'relative' ? 'adjacent' : 'snapshot', options.transition);
  }

  function updateChrome(fragments) {
    const counter = runtime.overlay?.querySelector('.slate-present__counter');
    if (counter) counter.textContent = `${runtime.index + 1} / ${runtime.slides.length}${fragments.length ? ` · ${Math.max(0, runtime.fragmentIndex + 1)} / ${fragments.length}` : ''}`;
    const previousButton = runtime.overlay?.querySelector('[data-command="previous"]');
    const nextButton = runtime.overlay?.querySelector('[data-command="next"]');
    if (previousButton) previousButton.disabled = runtime.index === 0 && runtime.fragmentIndex < 0;
    if (nextButton) nextButton.disabled = runtime.index === runtime.slides.length - 1 && runtime.fragmentIndex >= fragments.length - 1;
    const announcement = runtime.overlay?.querySelector('.slate-present__announce');
    if (announcement) announcement.textContent = `Slide ${runtime.index + 1} of ${runtime.slides.length}: ${runtime.meta[runtime.index]?.title || currentSlideId()}`;
  }

  function updateNextPreview() {
    const host = runtime.overlay?.querySelector('.slate-present__next');
    if (!host) return;
    host.replaceChildren();
    if (runtime.index >= runtime.slides.length - 1) {
      host.textContent = 'End of deck';
      return;
    }
    const preview = cloneSlide(runtime.index + 1);
    preview.classList.add('slate-present__next-slide');
    preview.style.width = `${runtime.stageWidth}px`;
    preview.style.height = `${runtime.stageHeight}px`;
    const previewWidth = host.clientWidth || 360;
    const previewHeight = host.clientHeight || 170;
    preview.style.transform = `scale(${Math.min(previewWidth / runtime.stageWidth, previewHeight / runtime.stageHeight)})`;
    host.appendChild(preview);
  }

  function canonicalNote() {
    const details = runtime.slides[runtime.index]?.querySelector('.slate-talktrack__body');
    return details?.innerHTML || '<p>No canonical talking track for this slide.</p>';
  }

  function updateNotes() {
    if (runtime.mode !== 'presenter' || !runtime.overlay) return;
    const canonical = runtime.overlay.querySelector('.slate-present__canonical');
    if (canonical) canonical.innerHTML = canonicalNote();
    const textarea = runtime.overlay.querySelector('#slate-personal-note');
    if (!textarea) return;
    try {
      textarea.value = localStorage.getItem(noteKey(currentSlideId())) || '';
      const status = runtime.overlay.querySelector('.slate-present__save');
      if (status) status.textContent = 'Saved in this browser';
    } catch (_) {
      textarea.value = '';
      const status = runtime.overlay.querySelector('.slate-present__save');
      if (status) status.textContent = 'Storage unavailable - notes are not saved';
    }
  }

  function savePersonalNote(slideId, value) {
    const status = runtime.overlay?.querySelector('.slate-present__save');
    try {
      localStorage.setItem(noteKey(slideId), value);
      runtime.noteDirty = false;
      runtime.pendingNote = null;
      if (status) status.textContent = 'Saved in this browser';
    } catch (_) {
      if (status) status.textContent = 'Not saved - browser storage is unavailable';
    }
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ARM_PROPS = ['opacity', 'transform', 'clipPath', 'strokeDashoffset'];

  function motionOrigin(recipe) {
    if (recipe === 'bar-grow') return 'center bottom';
    if (recipe === 'line-grow') return 'left center';
    return 'center';
  }

  function framesNeedTransform(frames) {
    return frames.some(frame => frame.transform !== undefined || frame.clipPath !== undefined);
  }

  // SVG elements transform around the viewBox origin by default, which makes scale/rotate/translate
  // jump to the top-left corner. Wrapping the subject in a <g> with transform-box: fill-box lets the
  // animation pivot on the subject's own box while preserving the subject's positioning transform.
  function motionHandle(element, frames, origin) {
    if (element.namespaceURI !== SVG_NS || !framesNeedTransform(frames)) return element;
    let wrap = element.parentNode;
    if (!(wrap && wrap.getAttribute && wrap.getAttribute('class') === 'slate-motion-wrap')) {
      wrap = document.createElementNS(SVG_NS, 'g');
      wrap.setAttribute('class', 'slate-motion-wrap');
      element.parentNode.insertBefore(wrap, element);
      wrap.appendChild(element);
    }
    wrap.style.transformBox = 'fill-box';
    wrap.style.transformOrigin = origin || 'center';
    return wrap;
  }

  function armMotion(handle, from) {
    ARM_PROPS.forEach(prop => { if (from[prop] !== undefined) handle.style[prop] = String(from[prop]); });
  }

  // Arm the start state before the animation is committed so the subject never flashes its final
  // state first; clear the inline arm once the animation is running so a later cancel resolves to the
  // natural (visible) resting state rather than the hidden start state.
  function playMotion(element, frames, options = {}) {
    const handle = motionHandle(element, frames, options.origin || frames[0].transformOrigin);
    armMotion(handle, frames[0]);
    const animation = waapiAdapter.play(handle, frames, {
      duration: options.duration || 460,
      delay: options.delay || 0,
      easing: options.easing || 'cubic-bezier(.2,.8,.2,1)',
      fill: 'both',
    });
    animation.ready.then(() => {
      ARM_PROPS.forEach(prop => { if (frames[0][prop] !== undefined) handle.style[prop] = ''; });
    }).catch(() => {});
    return animation;
  }

  function keyframesFor(recipe, element) {
    if (recipe === 'scale-in') return [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }];
    if (recipe === 'fade-left') return [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }];
    if (recipe === 'fade-in') return [{ opacity: 0 }, { opacity: 1 }];
    if (recipe === 'shape-pop') return [{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(1.12)', offset: .72 }, { opacity: 1, transform: 'scale(1)' }];
    if (recipe === 'bar-grow') return [{ opacity: .3, transform: 'scaleY(0)', transformOrigin: 'center bottom' }, { opacity: 1, transform: 'scaleY(1)', transformOrigin: 'center bottom' }];
    if (recipe === 'line-grow') return [{ opacity: .4, transform: 'scaleX(0)', transformOrigin: 'left center' }, { opacity: 1, transform: 'scaleX(1)', transformOrigin: 'left center' }];
    if (recipe === 'wipe-reveal') return [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }];
    if (recipe === 'spin-settle') return [{ opacity: 0, transform: 'rotate(-24deg) scale(.7)' }, { opacity: 1, transform: 'rotate(4deg) scale(1.06)', offset: .76 }, { opacity: 1, transform: 'rotate(0) scale(1)' }];
    if (recipe === 'path-travel') {
      const pathId = element.getAttribute('data-motion-path');
      const path = pathId ? element.closest('svg')?.querySelector(`[data-motion-id="${CSS.escape(pathId)}"]`) : null;
      if (path && typeof path.getTotalLength === 'function') {
        const length = path.getTotalLength();
        const end = path.getPointAtLength(length);
        const samples = 12;
        return Array.from({ length: samples }, (_, index) => {
          const offset = index / (samples - 1);
          const point = path.getPointAtLength(length * offset);
          return {
            offset,
            opacity: index === 0 ? 0 : 1,
            transform: `translate(${point.x - end.x}px, ${point.y - end.y}px) scale(${index === 0 ? .72 : 1})`,
          };
        });
      }
      return [{ opacity: 0, transform: 'translateX(-48px) scale(.72)' }, { opacity: 1, transform: 'translateX(0) scale(1)' }];
    }
    if (recipe === 'draw-stroke' && typeof element.getTotalLength === 'function') {
      const length = element.getTotalLength();
      element.style.strokeDasharray = String(length);
      return [{ strokeDashoffset: length }, { strokeDashoffset: 0 }];
    }
    return [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'translateY(0)' }];
  }

  // Collect the ordered entrance steps for a slide's currently visible content. The same list is used
  // both to arm start states synchronously (before paint) and to play the animation, so the two passes
  // never disagree and content is never shown in its final state first.
  function entranceSteps(slide) {
    const steps = [];
    const generated = runtime.motionPlan?.authoringMode === 'generated';
    const isVisible = element => !element.classList.contains('slate-motion-pending') && !element.closest('.slate-motion-pending');

    Array.from(slide.querySelectorAll('[data-motion]')).forEach(element => {
      if (!isVisible(element)) return;
      const recipe = element.getAttribute('data-motion');
      steps.push({
        element,
        frames: keyframesFor(recipe, element),
        delay: Number(element.getAttribute('data-motion-delay')) || 0,
        duration: Number(element.getAttribute('data-motion-duration')) || 420,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        origin: motionOrigin(recipe),
      });
    });

    // Generated decks animate only their authored targets; structural text simply belongs to the slide.
    if (generated) return steps;

    Array.from(slide.querySelectorAll(':scope > .slate-slide__kicker, :scope > .slate-slide__title, :scope > .slate-slide__lead, .slate-callout'))
      .filter(element => !element.hasAttribute('data-motion') && isVisible(element))
      .forEach((element, index) => {
        const recipe = element.matches('.slate-slide__lead') ? 'fade-in' : index > 2 ? 'fade-rise' : 'fade-in';
        steps.push({ element, frames: keyframesFor(recipe, element), delay: Math.min(index * 65, 320), duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', origin: 'center' });
      });

    Array.from(slide.querySelectorAll('.slate-slide__figure svg, .slate-card__figure svg'))
      .filter(svg => !svg.hasAttribute('data-motion') && !svg.closest('[data-motion]'))
      .forEach((svg, svgIndex) => {
        const base = 160 + svgIndex * 80;
        steps.push({ element: svg, frames: [{ opacity: 0.4 }, { opacity: 1 }], delay: base, duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
        Array.from(svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect'))
          .filter(shape => !shape.hasAttribute('data-motion') && !shape.closest('[data-motion]'))
          .forEach((shape, shapeIndex) => {
            const delay = base + 40 + shapeIndex * 55;
            const drawable = typeof shape.getTotalLength === 'function' && !['circle', 'ellipse', 'rect'].includes(shape.tagName.toLowerCase());
            if (drawable) {
              let length = 0;
              try { length = shape.getTotalLength(); } catch (_) {}
              if (length > 0) {
                shape.style.strokeDasharray = String(length);
                steps.push({ element: shape, frames: [{ strokeDashoffset: length, opacity: 0.3 }, { strokeDashoffset: 0, opacity: 1 }], delay, duration: 620, easing: 'cubic-bezier(.4,0,.2,1)' });
                return;
              }
            }
            steps.push({ element: shape, frames: [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], delay, duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', origin: 'center' });
          });
      });

    Array.from(slide.querySelectorAll('.slate-card')).forEach((card, index) => {
      const delay = 260 + index * 90;
      if (!card.hasAttribute('data-motion')) steps.push({ element: card, frames: [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], delay, duration: 440, easing: 'cubic-bezier(.16,1,.3,1)', origin: 'center' });
      const figure = card.querySelector('.slate-card__figure');
      if (figure) steps.push({ element: figure, frames: [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], delay: delay + 60, duration: 460, easing: 'cubic-bezier(.16,1,.3,1)', origin: 'center' });
      const title = card.querySelector('.slate-card__title');
      if (title) steps.push({ element: title, frames: [{ opacity: 0 }, { opacity: 1 }], delay: delay + 120, duration: 320 });
      const body = card.querySelector('.slate-card__body');
      if (body) steps.push({ element: body, frames: [{ opacity: 0 }, { opacity: 1 }], delay: delay + 180, duration: 320 });
    });

    Array.from(slide.querySelectorAll('.slate-metric')).forEach((metric, index) => {
      const delay = 240 + index * 110;
      if (!metric.hasAttribute('data-motion')) steps.push({ element: metric, frames: [{ opacity: 0, transform: 'translateY(16px) scale(.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], delay, duration: 460, easing: 'cubic-bezier(.16,1,.3,1)', origin: 'center' });
      const value = metric.querySelector('.slate-metric__value');
      if (value) steps.push({ element: value, frames: [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], delay: delay + 60, duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', origin: 'center' });
    });

    return steps;
  }

  // Apply every entrance start state synchronously before the browser paints so a slide never shows its
  // final content and then re-hides it to animate (the transition flicker).
  function armEntrance(slide) {
    if (runtime.motionMode !== 'full') return;
    entranceSteps(slide).forEach(step => {
      const handle = motionHandle(step.element, step.frames, step.origin);
      armMotion(handle, step.frames[0]);
    });
  }

  function estimateChoreographyDuration(slide) {
    const svgShapes = slide.querySelectorAll('.slate-slide__figure svg path, .slate-slide__figure svg line, .slate-slide__figure svg polyline, .slate-slide__figure svg polygon, .slate-slide__figure svg circle, .slate-slide__figure svg ellipse, .slate-slide__figure svg rect, .slate-card__figure svg path, .slate-card__figure svg line, .slate-card__figure svg polyline, .slate-card__figure svg polygon, .slate-card__figure svg circle, .slate-card__figure svg ellipse, .slate-card__figure svg rect').length;
    const cards = slide.querySelectorAll('.slate-card').length;
    const metrics = slide.querySelectorAll('.slate-metric').length;
    const explicitEnds = Array.from(slide.querySelectorAll('[data-motion]')).map(element => (Number(element.getAttribute('data-motion-delay')) || 0) + (Number(element.getAttribute('data-motion-duration')) || 420));
    return Math.max(
      900,
      180 + Math.max(0, svgShapes - 1) * 55 + 720,
      300 + Math.max(0, cards - 1) * 110 + 590,
      260 + Math.max(0, metrics - 1) * 120 + 680,
      ...explicitEnds,
    );
  }

  function trackAnimation(animation) {
    runtime.animations.add(animation);
    animation.finished.catch(() => {}).finally(() => {
      runtime.animations.delete(animation);
      try { animation.cancel(); } catch (_) {}
    });
    return animation;
  }

  function animateEntrance(slide, revision, enabled) {
    if (!enabled || runtime.motionMode !== 'full') return;
    if (revision !== runtime.navigationRevision) return;
    entranceSteps(slide).forEach(step => {
      playMotion(step.element, step.frames, { delay: step.delay, duration: step.duration, easing: step.easing, origin: step.origin });
    });
  }

  function animateTransition(outgoing, incoming, direction, revision) {
    const backward = direction === 'backward';
    const declared = runtime.motionPlan?.transitions?.[direction];
    const jump = direction === 'jump' || declared === 'crossfade-short';
    const duration = runtime.motionMode === 'reduced' ? 1 : jump ? 180 : 340;
    const outFrames = jump ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${backward ? 7 : -7}%)` }];
    const inFrames = jump ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateX(${backward ? -7 : 7}%)` }, { opacity: 1, transform: 'translateX(0)' }];
    const outAnimation = waapiAdapter.play(outgoing, outFrames, { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    const inAnimation = waapiAdapter.play(incoming, inFrames, { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    Promise.allSettled([outAnimation.finished, inAnimation.finished]).then(() => {
      if (revision !== runtime.navigationRevision) return;
      outgoing.remove();
      incoming.getAnimations().forEach(animation => animation.cancel());
    });
  }

  function cancelAnimations() {
    waapiAdapter.cancel('controller');
    runtime.canvas?.querySelectorAll('.slate-present__slide:not([data-active="true"])').forEach(element => element.remove());
  }

  function stopSlideMedia(slide) {
    slide?.querySelectorAll?.('audio, video').forEach(media => {
      try { media.pause(); media.currentTime = 0; } catch (_) {}
    });
  }

  function currentSlideId() {
    return stableSlideId(runtime.slides[runtime.index], runtime.index);
  }

  function currentFragmentId() {
    const fragments = fragmentIdsFor(runtime.slides[runtime.index], currentSlideId());
    return runtime.fragmentIndex >= 0 ? fragments[runtime.fragmentIndex] || '' : '';
  }

  function goToSlide(slideId, options = {}) {
    if (!options.dispatched) {
      dispatchAbsolute(() => goToSlide(slideId, { ...options, dispatched: true }));
      return true;
    }
    const index = runtime.slides.findIndex((slide, i) => stableSlideId(slide, i) === slideId);
    if (index < 0) return false;
    const previousIndex = runtime.index;
    runtime.remembered.set(currentSlideId(), runtime.fragmentIndex);
    runtime.index = index;
    const fragments = fragmentIdsFor(runtime.slides[index], slideId);
    const revisit = options.entry || motionPlanFor(slideId)?.revisit || runtime.motionPlan?.defaultRevisit || 'restore';
    if (Number.isInteger(options.fragmentIndex)) runtime.fragmentIndex = Math.max(-1, Math.min(options.fragmentIndex, fragments.length - 1));
    else if (revisit === 'end') runtime.fragmentIndex = fragments.length - 1;
    else if (revisit === 'restore') runtime.fragmentIndex = runtime.remembered.get(slideId) ?? -1;
    else runtime.fragmentIndex = runtime.motionPlan?.authoringMode === 'generated' && fragments.length ? 0 : -1;
    if (runtime.motionPlan?.authoringMode === 'generated' && runtime.fragmentIndex < 0 && fragments.length) runtime.fragmentIndex = 0;
    const direction = options.transition || (Math.abs(index - previousIndex) === 1 ? (index > previousIndex ? 'forward' : 'backward') : 'jump');
    renderStable({ animate: options.animate !== false, transition: direction, history: options.history || 'push', source: options.source || 'absolute' });
    return true;
  }

  function next(options = {}) {
    if (!options.dispatched) { queueRelative(1, options); return; }
    const fragments = fragmentIdsFor(runtime.slides[runtime.index], currentSlideId());
    if (runtime.fragmentIndex < fragments.length - 1) {
      setFragment(runtime.fragmentIndex + 1, { animate: true, source: 'relative' });
      return;
    }
    if (runtime.index < runtime.slides.length - 1) goToSlide(stableSlideId(runtime.slides[runtime.index + 1], runtime.index + 1), { entry: 'start', transition: 'forward', source: options.source || 'relative' });
  }

  function previous(options = {}) {
    if (!options.dispatched) { queueRelative(-1, options); return; }
    const firstFragment = runtime.motionPlan?.authoringMode === 'generated' ? 0 : -1;
    if (runtime.fragmentIndex > firstFragment) {
      setFragment(runtime.fragmentIndex - 1, { animate: false, source: 'relative' });
      return;
    }
    if (runtime.index > 0) goToSlide(stableSlideId(runtime.slides[runtime.index - 1], runtime.index - 1), { entry: 'end', transition: 'backward', source: options.source || 'relative' });
  }

  function restart(options = {}) {
    if (!options.dispatched) { dispatchAbsolute(() => restart({ dispatched: true })); return; }
    const fragments = fragmentIdsFor(runtime.slides[runtime.index], currentSlideId());
    runtime.fragmentIndex = runtime.motionPlan?.authoringMode === 'generated' && fragments.length ? 0 : -1;
    renderStable({ animate: true, transition: 'cut', history: 'replace', source: 'restart' });
  }

  function setFragment(nextIndex, options = {}) {
    const slideId = currentSlideId();
    const fragments = fragmentIdsFor(runtime.slides[runtime.index], slideId);
    const bounded = Math.max(-1, Math.min(nextIndex, fragments.length - 1));
    const prior = runtime.fragmentIndex;
    runtime.fragmentIndex = bounded;
    const active = runtime.canvas?.querySelector('.slate-present__slide[data-active="true"]');
    if (!active) {
      renderStable({ animate: options.animate, transition: 'cut', history: 'replace', source: options.source || 'fragment' });
      return;
    }
    const revealedFragments = new Set();
    const revealedRoots = [];
    active.querySelectorAll('[data-motion-fragment]').forEach(element => {
      const position = fragments.indexOf(element.getAttribute('data-motion-fragment'));
      const visible = position <= bounded;
      const wasPending = element.classList.contains('slate-motion-pending');
      element.classList.toggle('slate-motion-pending', !visible);
      if (visible) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', 'true');
      if (visible && wasPending && options.animate && runtime.motionMode === 'full') {
        const fragmentId = element.getAttribute('data-motion-fragment');
        revealedFragments.add(fragmentId);
        if (!element.hasAttribute('data-motion')) revealedRoots.push({ element, position });
      }
    });
    revealedRoots.forEach(({ element }) => {
      const fragmentId = element.getAttribute('data-motion-fragment');
      if (element.querySelector(`[data-motion][data-motion-fragment-owner="${CSS.escape(fragmentId)}"]`)) return;
      playMotion(element, keyframesFor('fade-in', element), {
        duration: Number(element.getAttribute('data-motion-duration')) || 360,
      });
    });
    revealedFragments.forEach(fragmentId => {
      const ownedTargets = active.querySelectorAll(`[data-motion][data-motion-fragment-owner="${CSS.escape(fragmentId)}"]`);
      [...new Set(ownedTargets)].forEach((target, index) => {
        const recipe = target.getAttribute('data-motion');
        playMotion(target, keyframesFor(recipe, target), {
          duration: Number(target.getAttribute('data-motion-duration')) || 420,
          delay: target.hasAttribute('data-motion-reveal-offset') ? Number(target.getAttribute('data-motion-reveal-offset')) : index * 55,
          origin: motionOrigin(recipe),
        });
      });
    });
    updateChrome(fragments);
    updateHistory('replace');
    syncSnapshot('adjacent', bounded >= prior ? 'forward' : 'backward');
  }

  function dispatchAbsolute(action) {
    runtime.commandRevision++;
    runtime.relativeDelta = 0;
    cancelAnimations('absolute-command');
    action(runtime.commandRevision);
  }

  function queueRelative(delta, options = {}) {
    runtime.relativeDelta = Math.max(-20, Math.min(20, runtime.relativeDelta + delta));
    if (runtime.relativeScheduled) return;
    runtime.relativeScheduled = true;
    queueMicrotask(() => {
      runtime.relativeScheduled = false;
      const pending = runtime.relativeDelta;
      runtime.relativeDelta = 0;
      if (!pending) return;
      runtime.commandRevision++;
      cancelAnimations('relative-command');
      const commandOptions = { ...options, dispatched: true };
      const direction = Math.sign(pending);
      for (let count = 0; count < Math.abs(pending); count++) {
        if (direction > 0) next(commandOptions);
        else previous(commandOptions);
      }
    });
  }

  function updateHistory(mode) {
    if (runtime.mode === 'audience') return;
    const url = new URL(location.href);
    url.searchParams.delete('slateAudience');
    url.searchParams.delete('slateSession');
    url.searchParams.set('slateSlide', currentSlideId());
    const fragment = currentFragmentId();
    if (fragment) url.searchParams.set('slateFragment', fragment); else url.searchParams.delete('slateFragment');
    const position = { path: runtime.path, slideId: currentSlideId(), fragmentIndex: runtime.fragmentIndex };
    const state = Object.assign({}, history.state, { slatePresentation: position });
    if (mode === 'push') history.pushState(state, '', url); else history.replaceState(state, '', url);
  }

  function restorePosition(position) {
    goToSlide(position.slideId, { fragmentIndex: position.fragmentIndex, animate: false, transition: 'cut', history: 'none', source: 'history' });
  }

  function cycleMotionMode() {
    const index = MOTION_MODES.indexOf(runtime.motionMode);
    writeMotionMode(MOTION_MODES[(index + 1) % MOTION_MODES.length]);
    cancelAnimations('preference');
    renderStable({ animate: false, transition: 'cut', history: 'replace', source: 'preference' });
    updateMotionButton();
  }

  function updateMotionButton() {
    const button = runtime.overlay?.querySelector('.slate-present__motion');
    if (!button) return;
    const icons = { full: 'animation', reduced: 'slow_motion_video', off: 'motion_photos_off' };
    button.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${icons[runtime.motionMode]}</span>`;
    button.setAttribute('aria-label', `Motion: ${runtime.motionMode}. Change motion mode.`);
    runtime.overlay.dataset.motion = runtime.motionMode;
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await runtime.overlay?.requestFullscreen();
    } catch (_) {}
  }

  function onKeyDown(event) {
    if (!runtime.overlay || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
    if (runtime.mode === 'audience') return;
    const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown'];
    const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];
    if (nextKeys.includes(event.key) || (event.key === ' ' && !event.shiftKey)) { event.preventDefault(); queueRelative(1, { source: 'keyboard' }); }
    else if (previousKeys.includes(event.key) || (event.key === ' ' && event.shiftKey)) { event.preventDefault(); queueRelative(-1, { source: 'keyboard' }); }
    else if (event.key === 'Home') { event.preventDefault(); dispatchAbsolute(() => goToSlide(stableSlideId(runtime.slides[0], 0), { entry: 'start', transition: 'jump', source: 'keyboard', dispatched: true })); }
    else if (event.key === 'End') { event.preventDefault(); const last = runtime.slides.length - 1; dispatchAbsolute(() => goToSlide(stableSlideId(runtime.slides[last], last), { entry: 'end', transition: 'jump', source: 'keyboard', dispatched: true })); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); dispatchAbsolute(() => restart({ dispatched: true })); }
    else if (event.key === 'Escape' && runtime.mode !== 'audience' && !document.fullscreenElement) exit();
  }

  function startTimer() {
    clearInterval(runtime.timer);
    runtime.timer = setInterval(() => {
      const head = runtime.overlay?.querySelector('.slate-present__panel-head strong');
      if (!head || runtime.mode !== 'presenter') return;
      const seconds = Math.floor((Date.now() - runtime.startedAt) / 1000);
      head.textContent = `Presenter view · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
  }

  function exit() {
    if (!runtime.overlay) return;
    runtime.navigationRevision++;
    runtime.attachRevision++;
    if (runtime.noteDirty && runtime.pendingNote) savePersonalNote(runtime.pendingNote.slideId, runtime.pendingNote.value);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    cancelAnimations('exit');
    stopSlideMedia(runtime.canvas);
    runtime.resizeObserver?.disconnect();
    runtime.resizeObserver = null;
    if (runtime.resizeHandler) removeEventListener('resize', runtime.resizeHandler);
    runtime.resizeHandler = null;
    runtime.themeObserver?.disconnect();
    runtime.themeObserver = null;
    if (runtime.historyHandler) removeEventListener('popstate', runtime.historyHandler);
    if (runtime.keyHandler) removeEventListener('keydown', runtime.keyHandler, true);
    clearInterval(runtime.timer);
    runtime.timer = null;
    clearTimeout(runtime.transitionWatchdog);
    runtime.transitionWatchdog = null;
    clearTimeout(runtime.noteSaveTimer);
    runtime.noteSaveTimer = null;
    runtime.channel?.close();
    runtime.channel = null;
    runtime.overlay.remove();
    runtime.overlay = null;
    runtime.canvas = null;
    runtime.viewport = null;
    runtime.mode = 'reading';
    runtime.forceReflow = false;
    document.body.classList.remove('slate-presenting');
    const app = document.querySelector('.app');
    if (app) { app.inert = false; app.removeAttribute('aria-hidden'); }
    const url = new URL(location.href);
    ['slateSlide', 'slateFragment', 'slateAudience', 'slateSession'].forEach(key => url.searchParams.delete(key));
    history.replaceState(Object.assign({}, history.state, { slatePresentation: null }), '', url);
    if (runtime.priorFocus?.isConnected) runtime.priorFocus.focus();
    else runtime.presentButton?.focus();
    runtime.priorFocus = null;
  }

  function destroy() {
    runtime.attachRevision++;
    exit();
    runtime.presentButton?.remove();
    runtime.presentButton = null;
    runtime.attached = false;
    runtime.slides = [];
    runtime.meta = [];
    runtime.content = null;
    runtime.motionPlan = null;
    runtime.forceReflow = false;
    runtime.destroyed = true;
  }

  window.SlatePresentation = {
    attach,
    destroy,
    enter,
    exit,
    next,
    previous,
    restart,
    goToSlide,
    isPresenting: () => runtime.mode !== 'reading',
    getState: () => ({ mode: runtime.mode, slideId: runtime.slides.length ? currentSlideId() : '', index: runtime.index, fragmentIndex: runtime.fragmentIndex, motionMode: runtime.motionMode, layoutEpoch: runtime.layoutEpoch, themeEpoch: runtime.themeEpoch, adapter: waapiAdapter.inspect() }),
    registerAdapter: () => { throw new Error('Custom animation adapters are not enabled in presentation motion v1.'); },
  };
})();
