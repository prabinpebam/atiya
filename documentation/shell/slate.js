/* ============================================================
   Slate - Runtime (slate.js)
   ------------------------------------------------------------
   Portable documentation viewer. Renders Markdown and HTML content
   through one pipeline (sanitize -> transform -> enhance), with
   client-side nav, TOC, search, theming, and config-driven branding.

   Depends on (loaded by index.html): marked, highlight.js, DOMPurify.
   Spec: ../../specs/  ·  Content root & paths: spec §02 REQ-AR-10..12
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    currentPath: null,
    docs: new Map(),          // rawPath -> { title, content, order, group, icon, badge, hidden, type, text }
    orderedPaths: [],         // navigable pages in reading order (for pager)
    fileTree: null,
    searchIndex: [],
    config: {},
    contentRoot: '',
    projectName: 'Docs',
    landing: null,
    sidebarOpen: false,
    scrollSpyCleanup: null,
    svgMotionCleanup: null,
    svgReplayBound: false,
    searchSel: -1,
    themePref: 'auto',
  };

  /* ==========================================================
     PATH HELPERS
     ========================================================== */
  function resolvePath(basePath, relativePath) {
    if (!relativePath || /^https?:\/\//.test(relativePath) || relativePath.startsWith('data:')) return relativePath;
    const baseDir = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/') + 1) : '';
    const parts = (baseDir + relativePath).split('/');
    const out = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); }
    return out.join('/');
  }
  // Prepend contentRoot for actual fetches / asset URLs (hash routes stay raw).
  function joinRoot(path) {
    if (!state.contentRoot || /^https?:\/\//.test(path) || path.startsWith('data:')) return path;
    const r = state.contentRoot.replace(/\/+$/, '');
    return r ? r + '/' + path.replace(/^\/+/, '') : path;
  }
  function humanize(str) {
    return str.replace(/(?<!\d)-|-(?!\d)|_/g, ' ').replace(/\.(md|html?)$/i, '').replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\b(Of|And|To|For|In)\b/g, word => word.toLowerCase());
  }
  function extractTitle(content, path) {
    const md = content.match(/^#\s+(.+)$/m);
    if (md) return md[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
    const h1 = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) return h1[1].replace(/<[^>]+>/g, '').trim();
    return humanize(path.split('/').pop());
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function modClick(e) { return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1; }

  /* ==========================================================
     CONFIG  (REQ-CF-*)
     ========================================================== */
  async function loadConfig() {
    let cfg = {};
    try { const r = await fetch('slate.config.json', { cache: 'no-cache' }); if (r.ok) cfg = await r.json(); } catch (_) {}
    state.pendingConfig = cfg;                       // merged with manifest header in discovery
    return cfg;
  }
  function applyConfig(cfg) {
    state.config = cfg || {};
    state.contentRoot = state.config.contentRoot || '';
    state.projectName = state.config.projectName || state.projectName;
    state.landing = state.config.landing || null;
    // Branding
    const logoText = $('#logo-text'); if (logoText && state.config.projectName) logoText.textContent = state.config.projectName;
    if (state.config.logo) {
      const mark = $('#logo-mark');
      if (mark) { mark.src = joinRoot(state.config.logo); mark.style.display = ''; }
    }
    if (state.config.brandColor) applyBrandColor(state.config.brandColor);
    if (state.config.displayFont) document.documentElement.style.setProperty('--font-family-display', state.config.displayFont);
    if (state.config.density) document.documentElement.setAttribute('data-density', state.config.density);
  }
  function applyBrandColor(hex) {
    const root = document.documentElement.style;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const shade = `color-mix(in srgb, ${hex} 85%, ${dark ? 'white' : 'black'})`;
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const luminance = channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const blackContrast = (luminance + .05) / .05;
    const whiteContrast = 1.05 / (luminance + .05);
    root.setProperty('--color-brand-bg', hex);
    root.setProperty('--color-brand-fg-1', hex);
    root.setProperty('--color-brand-stroke', hex);
    root.setProperty('--color-brand-bg-hover', shade);
    root.setProperty('--color-brand-fg-2', shade);
    root.setProperty('--color-on-brand', blackContrast >= whiteContrast ? '#111111' : '#FFFFFF');
  }

  /* ==========================================================
     THEME  (REQ-CF-04, REQ-AP-04)
     ========================================================== */
  function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function initTheme() {
    const def = (state.pendingConfig && state.pendingConfig.defaultTheme) || 'auto';
    applyTheme(localStorage.getItem('slate-theme-pref') || def, false);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((localStorage.getItem('slate-theme-pref') || def) === 'auto') applyTheme('auto', false);
    });
  }
  function applyTheme(pref, persist = true) {
    state.themePref = pref;
    if (persist) localStorage.setItem('slate-theme-pref', pref);
    const actual = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', actual);
    const light = $('#hljs-light'), darkS = $('#hljs-dark');
    if (light) light.disabled = (actual === 'dark');
    if (darkS) darkS.disabled = (actual === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', actual === 'dark' ? '#292929' : '#ffffff');
    updateThemeButton(pref);
    if (state.config && state.config.brandColor) applyBrandColor(state.config.brandColor);
    if (window.hljs) $$('#document pre code[data-highlighted]').forEach(el => { el.removeAttribute('data-highlighted'); hljs.highlightElement(el); });
  }
  function updateThemeButton(pref) {
    const btn = $('.theme-toggle'); if (!btn) return;
    const icon = pref === 'light' ? 'light_mode' : pref === 'dark' ? 'dark_mode' : 'brightness_auto';
    const label = 'Theme: ' + pref + ' \u2014 click to change';
    btn.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>`;
    btn.setAttribute('aria-label', label); btn.title = label;
  }
  function toggleTheme() {
    const order = ['light', 'dark', 'auto'];
    applyTheme(order[(order.indexOf(state.themePref) + 1) % order.length], true);
  }

  /* ==========================================================
     DISCOVERY  (REQ-AR-05/07/09)
     ========================================================== */
  async function discover() {
    try {
      const resp = await fetch(joinRoot('docs-manifest.json'), { cache: 'no-cache' });
      if (resp.ok) { await loadFromManifest(await resp.json()); return true; }
    } catch (_) {}
    return await crawl();
  }
  async function loadFromManifest(manifest) {
    // Normalize v1 (array) and v2 (object) -> entries + optional config header (REQ-MF-01)
    let entries = [], headerCfg = {};
    if (Array.isArray(manifest)) entries = manifest;
    else if (manifest && typeof manifest === 'object') { entries = manifest.entries || []; headerCfg = manifest.config || {}; }
    // Precedence: standalone config wins over manifest header (REQ-CF-05)
    applyConfig(Object.assign({}, headerCfg, state.pendingConfig || {}));

    await Promise.all(entries.map(async (entry, idx) => {
      const type = entry.type || 'page';
      if (type !== 'page') {
        state.docs.set(entry.path || ('__' + type + '_' + idx), {
          title: entry.title || '', order: entry.order != null ? entry.order : idx,
          group: entry.group, type, content: '', hidden: !!entry.hidden,
          icon: entry.icon, badge: entry.badge, status: entry.status, updated: entry.updated,
          canvas: entry.canvas,
        });
        return;
      }
      try {
        const r = await fetch(joinRoot(entry.path), { cache: 'no-cache' });
        if (!r.ok) return;
        const content = await r.text();
        state.docs.set(entry.path, {
          title: entry.title || extractTitle(content, entry.path),
          content, order: entry.order != null ? entry.order : idx,
          group: entry.group, icon: entry.icon, badge: entry.badge,
          status: entry.status, updated: entry.updated,
          presentation: entry.presentation,
          hidden: !!entry.hidden, type,
        });
      } catch (_) {}
    }));
    return true;
  }
  function extractLinks(content, basePath) {
    const links = new Set();
    const re = /\[[^\]]*\]\(([^)]+\.(?:md|html?)(?:#[^)]*)?)\)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const href = m[1].split('#')[0];
      if (href && !/^https?:/.test(href)) links.add(resolvePath(basePath, href));
    }
    return links;
  }
  async function crawl() {
    const seeds = ['README.md', 'readme.md', 'index.md', 'index.html'];
    const queue = [...seeds], visited = new Set();
    applyConfig(state.pendingConfig || {});
    while (queue.length) {
      const batch = [];
      while (queue.length && batch.length < 8) { const p = queue.shift(); if (!visited.has(p)) { visited.add(p); batch.push(p); } }
      if (!batch.length) break;
      await Promise.all(batch.map(async (path) => {
        try {
          const r = await fetch(joinRoot(path)); if (!r.ok) return;
          const content = await r.text();
          state.docs.set(path, { title: extractTitle(content, path), content, type: 'page' });
          for (const l of extractLinks(content, path)) if (!visited.has(l)) queue.push(l);
        } catch (_) {}
      }));
    }
    return state.docs.size > 0;
  }

  /* ==========================================================
     RENDER + SANITIZE  (REQ-CM-01/03, REQ-SEC-*)
     ========================================================== */
  const SANITIZE_TRUSTED = {
    ADD_TAGS: ['figure', 'figcaption', 'section', 'article', 'aside', 'header', 'footer', 'dl', 'dt', 'dd'],
    ADD_ATTR: ['class', 'data-cols', 'role', 'aria-label', 'aria-hidden', 'colspan', 'rowspan', 'target', 'rel'],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'meta'],
    FORBID_ATTR: ['style'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };
  function renderToHtml(path, content) {
    const isHtml = /\.html?$/i.test(path);
    let html = isHtml ? content : (window.marked ? marked.parse(content) : content);
    if (window.DOMPurify) html = DOMPurify.sanitize(html, SANITIZE_TRUSTED);
    return html;
  }

  /* ==========================================================
     PIPELINE  (REQ-CM-02/07)  order is normative
     ========================================================== */
  function postProcess(container, basePath) {
    transformCallouts(container);          // REQ-CM-11
    // Links
    container.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href'); if (!href) return;
      if (/^https?:\/\//.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; return; }
      const tool = href.match(/^(.+\.html?)(\?[^#]*)?(#.*)?$/i);
      if (tool && a.target === '_blank') {
        a.setAttribute('href', joinRoot(resolvePath(basePath, tool[1])) + (tool[2] || '') + (tool[3] || ''));
        a.rel = 'noopener';
        return;
      }
      const m = href.match(/^(.+\.(?:md|html?))(#.*)?$/i);
      if (m) {
        const resolved = resolvePath(basePath, m[1]); const anchor = m[2] || '';
        a.setAttribute('href', '#' + resolved + anchor);
        a.addEventListener('click', (e) => {
          e.preventDefault(); navigateTo(resolved, anchor);
        });
      }
    });
    // Images (resolve against contentRoot for display)
    container.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !/^https?:/.test(src) && !src.startsWith('data:')) img.src = joinRoot(resolvePath(basePath, src));
    });
    // Specification IDs and authored excerpt references share the preview popover.
    markSpecTargets(container);
    processSpecRefs(container);
    // Excerpt references (must run before heading IDs so pill text does not leak into slugs)
    processXrefs(container, basePath);
    // Stable heading IDs preserve authored and inbound deep links without adding visible controls.
    container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
      if (!h.id) {
        // Slug from the heading's own text only - strip decorative children
        // (pills, badges, toggles) so ids stay clean and stable.
        const c = h.cloneNode(true);
        c.querySelectorAll('.slate-xref, .slate-badge, .collapse-toggle').forEach(n => n.remove());
        h.id = c.textContent.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      }
    });
    // Code copy buttons
    container.querySelectorAll('pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'copy-btn'; btn.title = 'Copy code'; btn.setAttribute('aria-label', 'Copy code to clipboard'); btn.innerHTML = COPY_SVG;
      btn.addEventListener('click', () => { const code = pre.querySelector('code'); if (!code) return; navigator.clipboard.writeText(code.textContent).then(() => { btn.innerHTML = CHECK_SVG; setTimeout(() => { btn.innerHTML = COPY_SVG; }, 1600); }); });
      pre.appendChild(btn);
    });
    enhanceTables(container);
    makeSectionsCollapsible(container);
    processVersionHistory(container);
    enhanceSvgIllustrations(container);
    enhanceGallery(container);
    if (window.hljs) container.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
  }

  function enhanceTables(container) {
    container.querySelectorAll('table').forEach(table => {
      if (table.parentElement && table.parentElement.classList.contains('slate-table-scroll')) return;
      const frame = document.createElement('div');
      frame.className = 'slate-table-scroll';
      frame.tabIndex = 0;
      frame.setAttribute('role', 'region');
      frame.setAttribute('aria-label', table.caption ? `Scrollable table: ${table.caption.textContent.trim()}` : 'Scrollable table');
      table.parentNode.insertBefore(frame, table);
      frame.appendChild(table);
      applyTableColumnSizing(table, frame);
    });
  }

  function applyTableColumnSizing(table, frame) {
    const columns = [];
    table.querySelectorAll('tr').forEach(row => {
      let column = 0;
      row.querySelectorAll(':scope > th, :scope > td').forEach(cell => {
        const span = Math.max(1, Number(cell.colSpan) || 1);
        const style = getComputedStyle(cell);
        const measure = document.createElement('span');
        measure.textContent = cell.innerText.replace(/\s+/g, ' ').trim();
        measure.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing};`;
        document.body.appendChild(measure);
        const contentWidth = measure.getBoundingClientRect().width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        measure.remove();
        const minimum = contentWidth <= 60 * span ? 60 : 100;
        for (let index = 0; index < span; index += 1) {
          columns[column + index] = Math.max(columns[column + index] || 60, minimum);
        }
        column += span;
      });
    });
    table.querySelectorAll('tr').forEach(row => {
      let column = 0;
      row.querySelectorAll(':scope > th, :scope > td').forEach(cell => {
        const span = Math.max(1, Number(cell.colSpan) || 1);
        const minimum = columns.slice(column, column + span).reduce((total, value) => total + value, 0);
        cell.style.setProperty('--slate-column-min', `${Math.min(400, minimum)}px`);
        column += span;
      });
    });
    table.style.minWidth = `${columns.reduce((total, minimum) => total + minimum, 0)}px`;
    requestAnimationFrame(() => {
      frame.classList.toggle('slate-table-scroll--expanded', table.scrollWidth > frame.clientWidth + 1);
    });
  }

  function transformCallouts(container) {
    container.querySelectorAll(':scope > blockquote, blockquote').forEach(bq => {
      const first = bq.querySelector('p'); if (!first) return;
      const m = first.textContent.match(/^\s*\[!(NOTE|TIP|INFO|WARNING|DANGER)\]\s*(.*)$/i);
      if (!m) return;
      const type = m[1].toLowerCase(), rest = m[2].trim();
      const div = document.createElement('div');
      div.className = 'slate-callout slate-callout--' + type; div.setAttribute('role', 'note');
      const titleMap = { note: 'Note', tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Careful' };
      const title = document.createElement('p'); title.className = 'slate-callout__title'; title.textContent = rest || titleMap[type];
      div.appendChild(title);
      // Move remaining nodes (drop the marker paragraph)
      const nodes = Array.from(bq.childNodes); let removedFirst = false;
      nodes.forEach(n => { if (!removedFirst && n === first) { removedFirst = true; return; } div.appendChild(n); });
      bq.replaceWith(div);
    });
  }

  function makeSectionsCollapsible(container) {
    ['H2', 'H3'].forEach(tag => {
      const level = Number(tag.charAt(1));
      $$(tag, container).forEach(heading => {
        if (heading.closest('[class*="slate-"]')) return;   // skip component-internal headings
        const section = document.createElement('section'); section.className = 'doc-section';
        const body = document.createElement('div'); body.className = 'doc-section-body';
        let sib = heading.nextSibling;
        while (sib) {
          const next = sib.nextSibling;
          if (sib.nodeType === 1 && /^H[1-6]$/.test(sib.tagName) && Number(sib.tagName.charAt(1)) <= level) break;
          body.appendChild(sib); sib = next;
        }
        heading.parentNode.insertBefore(section, heading); section.appendChild(heading); section.appendChild(body);
        addCollapseToggle(heading, section);
      });
    });
  }
  function addCollapseToggle(heading, section) {
    const t = document.createElement('button');
    t.className = 'collapse-toggle'; t.title = 'Collapse section'; t.setAttribute('aria-label', 'Collapse section'); t.setAttribute('aria-expanded', 'true'); t.innerHTML = CHEVRON_SVG;
    t.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const c = section.classList.toggle('collapsed'); t.setAttribute('aria-expanded', String(!c)); t.title = c ? 'Expand section' : 'Collapse section'; });
    heading.prepend(t);
  }
  function expandToTarget(el) {
    if (!el) return; let s = el.closest('.doc-section');
    while (s) { if (s.classList.contains('collapsed')) { const tg = s.querySelector(':scope > h2 > .collapse-toggle, :scope > h3 > .collapse-toggle'); if (tg) tg.click(); else s.classList.remove('collapsed'); } s = s.parentElement ? s.parentElement.closest('.doc-section') : null; }
  }

  /* ==========================================================
     SVG ILLUSTRATION MOTION  (trusted host enhancement)
     ========================================================== */
  function enhanceSvgIllustrations(container) {
    if (state.svgMotionCleanup) { state.svgMotionCleanup(); state.svgMotionCleanup = null; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const records = [];

    container.querySelectorAll('.slate-figure > svg, .slate-slide__figure > svg, .slate-card__figure > svg').forEach(svg => {
      if (svg.dataset.slateSvgMotion === 'none') return;
      const figure = svg.parentElement;
      if (!figure) return;
      figure.classList.add('slate-svg-motion');

      const desktopViewBox = svg.getAttribute('viewBox');
      const mobileViewBox = svg.dataset.slateMobileViewBox;
      const desktopSafeMargin = svg.dataset.slateSafeMargin;
      const mobileSafeMargin = svg.dataset.slateMobileSafeMargin;
      const layoutMedia = mobileViewBox ? window.matchMedia('(max-width: 600px)') : null;
      const applyResponsiveLayout = () => {
        const useMobile = Boolean(layoutMedia?.matches && mobileViewBox);
        svg.setAttribute('viewBox', useMobile ? mobileViewBox : desktopViewBox);
        svg.dataset.slateLayout = useMobile ? 'mobile' : 'desktop';
        svg.dataset.slateActiveSafeMargin = useMobile
          ? (mobileSafeMargin || desktopSafeMargin || '')
          : (desktopSafeMargin || '');
      };
      applyResponsiveLayout();
      layoutMedia?.addEventListener('change', applyResponsiveLayout);

      const replay = document.createElement('button');
      replay.type = 'button'; replay.className = 'slate-figure__replay';
      replay.title = 'Replay illustration'; replay.setAttribute('aria-label', 'Replay illustration animation');
      replay.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">replay</span>';
      figure.insertBefore(replay, svg);

      const authoredSubjects = Array.from(svg.querySelectorAll('[data-slate-svg-step]'));
      const motionSubjects = Array.from(svg.querySelectorAll('[data-motion-id]'));
      const fallbackSubjects = Array.from(svg.children).filter(element =>
        !['title', 'desc', 'defs'].includes(element.localName));
      const subjects = (authoredSubjects.length ? authoredSubjects : motionSubjects.length ? motionSubjects : fallbackSubjects)
        .map((subject, index) => ({ subject, step: Number(subject.dataset.slateSvgStep ?? index) }))
        .sort((a, b) => a.step - b.step);
      if (!reduced) {
        figure.classList.add('slate-svg-motion--pending');
        subjects.forEach(({ subject }) => subject.classList.add('slate-svg-motion__subject'));
      }
      let animations = [];
      let hasPlayed = false;

      function cancelAnimations() {
        animations.forEach(animation => animation.cancel());
        animations = [];
      }

      function makeAnimations(paused) {
        cancelAnimations();
        if (reduced) return;
        subjects.forEach(({ subject, step: authoredStep }) => {
          const step = Math.max(0, authoredStep);
          const delay = 120 + step * 150;
          const drawCandidate = subject.matches('path, line, polyline') ||
            (subject.children.length > 0 && Array.from(subject.children).every(child => child.matches('path, line, polyline')));
          const effect = subject.dataset.slateSvgEffect || (drawCandidate ? 'draw' : 'fade-rise');
          const opacity = subject.getAttribute('opacity') || '1';
          const keyframes = effect === 'scale-in'
            ? [{ opacity: 0, scale: .88 }, { opacity, scale: 1 }]
            : effect === 'fade'
              ? [{ opacity: 0 }, { opacity }]
              : [{ opacity: 0, translate: '0 12px' }, { opacity, translate: 'none' }];
          const animation = subject.animate(keyframes, {
            duration: 440, delay, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'both',
          });
          animations.push(animation);

          if (effect === 'draw') {
            const marks = subject.matches('path, line, polyline')
              ? [subject]
              : Array.from(subject.querySelectorAll('path, line, polyline'));
            marks.forEach(mark => {
              if (typeof mark.getTotalLength !== 'function') return;
              let length;
              try { length = Math.max(1, mark.getTotalLength()); } catch (_) { return; }
              const draw = mark.animate([
                { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
                { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
              ], { duration: 560, delay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
              animations.push(draw);
            });
          }
        });
        if (paused) animations.forEach(animation => { animation.pause(); animation.currentTime = 0; });
      }

      function play() {
        hasPlayed = true;
        makeAnimations(false);
        figure.classList.remove('slate-svg-motion--pending');
      }

      replay._slateReplay = play;
      const observer = new IntersectionObserver(entries => {
        if (!hasPlayed && entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .3)) play();
      }, { threshold: [.3] });
      observer.observe(svg);
      records.push({ observer, cancelAnimations, layoutMedia, applyResponsiveLayout });
    });

    if (!state.svgReplayBound) {
      document.addEventListener('click', event => {
        const replay = event.target.closest('.slate-figure__replay');
        if (!replay) return;
        if (replay.closest('.slate-present') && window.SlatePresentation?.isPresenting()) {
          window.SlatePresentation.restart();
          return;
        }
        replay._slateReplay?.();
      });
      state.svgReplayBound = true;
    }

    state.svgMotionCleanup = () => records.forEach(record => {
      record.observer.disconnect(); record.cancelAnimations();
      record.layoutMedia?.removeEventListener('change', record.applyResponsiveLayout);
    });
  }

  /* ==========================================================
     IMAGE VIEWER  (gallery lightbox with filmstrip + caption)
     ========================================================== */
  // Every content image becomes zoomable. Clicking one opens a fullscreen
  // viewer whose gallery is all images on the page (in DOM order), so the
  // filmstrip can jump to any of them. Caption sits at the bottom over a scrim
  // for contrast and starts collapsed so it never occludes the image.
  function enhanceGallery(container) {
    const imgs = Array.from(container.querySelectorAll('img')).filter(img => !img.closest('.slate-viewer'));
    if (!imgs.length) return;
    imgs.forEach((img, i) => {
      img.classList.add('slate-zoomable');
      img.addEventListener('click', () => openViewer(imgs, i));
    });
  }

  // ---- Version history (REQ-CM-14) ----
  // A hidden .slate-history block authored at the bottom of a section renders as
  // a "Version history" pill; clicking it opens a modal timeline. Iteration
  // context is preserved without cluttering the document inline.
  //   <div class="slate-history" data-history-title="Section name">
  //     <div class="slate-history__entry" data-when="2026-07-04 10:40">
  //       <p class="slate-history__summary">Short summary</p>
  //       <p>Longer context…</p>
  //     </div>
  //   </div>
  function formatHistoryWhen(raw) {
    if (!raw) return '';
    const d = new Date(String(raw).replace(' ', 'T'));
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function openHistoryModal(title, entries) {
    const overlay = document.createElement('div');
    overlay.className = 'slate-history-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const dialog = document.createElement('div');
    dialog.className = 'slate-history-dialog';
    const head = document.createElement('div'); head.className = 'slate-history-dialog__head';
    const h = document.createElement('p'); h.className = 'slate-history-dialog__title'; h.textContent = title || 'Version history';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'slate-history-dialog__close';
    close.setAttribute('aria-label', 'Close version history');
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
    head.appendChild(h); head.appendChild(close);
    const body = document.createElement('div'); body.className = 'slate-history-dialog__body';
    entries.forEach(e => {
      const item = document.createElement('div'); item.className = 'slate-history-item';
      const when = document.createElement('p'); when.className = 'slate-history-item__when'; when.textContent = formatHistoryWhen(e.when);
      item.appendChild(when);
      if (e.summary) { const s = document.createElement('p'); s.className = 'slate-history-item__summary'; s.textContent = e.summary; item.appendChild(s); }
      if (e.body) { const b = document.createElement('div'); b.className = 'slate-history-item__body'; b.innerHTML = e.body; item.appendChild(b); }
      body.appendChild(item);
    });
    dialog.appendChild(head); dialog.appendChild(body); overlay.appendChild(dialog);
    function dismiss() {
      if (overlay.dataset.closing) return;
      overlay.dataset.closing = '1';
      overlay.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        overlay.remove();
        document.documentElement.classList.remove('slate-history-open');
      };
      overlay.addEventListener('transitionend', ev => { if (ev.target === overlay && ev.propertyName === 'opacity') finish(); });
      setTimeout(finish, 260);
    }
    function onKey(ev) { if (ev.key === 'Escape') dismiss(); }
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) dismiss(); });
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('slate-history-open');
    document.body.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
    close.focus();
  }
  function processVersionHistory(container) {
    container.querySelectorAll('.slate-history:not([data-history-ready])').forEach(block => {
      block.setAttribute('data-history-ready', '1');
      const title = block.getAttribute('data-history-title') || 'Version history';
      const entries = [];
      block.querySelectorAll('.slate-history__entry').forEach(el => {
        const summaryEl = el.querySelector('.slate-history__summary');
        const clone = el.cloneNode(true);
        const sClone = clone.querySelector('.slate-history__summary'); if (sClone) sClone.remove();
        entries.push({ when: el.getAttribute('data-when') || '', summary: summaryEl ? summaryEl.textContent.trim() : '', body: clone.innerHTML.trim() });
      });
      if (!entries.length) return;
      entries.sort((a, b) => String(b.when).localeCompare(String(a.when)));
      const pill = document.createElement('button');
      pill.type = 'button'; pill.className = 'slate-history-pill';
      pill.setAttribute('aria-label', title + ' - ' + entries.length + ' revision' + (entries.length === 1 ? '' : 's'));
      pill.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">history</span><span>Version history</span><span class="slate-history-pill__count">' + entries.length + '</span>';
      pill.addEventListener('click', () => openHistoryModal(title, entries));
      block.parentNode.insertBefore(pill, block.nextSibling);
    });
  }

  /* ==========================================================
     EXCERPT REFERENCES  (cross-reference pill + hover popover)
     ========================================================== */
  // A generic capability: tag any content with a compact pill that links to a
  // section on another page and previews an excerpt of it on hover/focus. The
  // author writes an inert, sanitizer-safe span; the runtime turns it into an
  // accessible button whose popover shows the source label, the excerpt, and a
  // CTA that deep-links to the referenced section.
  //
  //   <span class="slate-xref"
  //         data-xref-href="../other/page.html#section"
  //         data-xref-source="Source label"
  //         data-xref-cta="Read the source">
  //     <span class="slate-xref__label">Pill label</span>
  //     <span class="slate-xref__excerpt">Excerpt shown in the popover…</span>
  //   </span>
  //
  // Only the pill is visible; the excerpt block is authored hidden and lifted
  // into the shared popover. Showing connected research is just one use case.
  let xrefPop = null, xrefOpenPill = null, xrefHideTimer = null;

  function ensureXrefPop() {
    if (xrefPop) return xrefPop;
    const el = document.createElement('div');
    el.id = 'slate-xref-pop'; el.className = 'slate-xref-pop'; el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.innerHTML =
      '<span class="slate-xref-pop__arrow" aria-hidden="true"></span>' +
      '<p class="slate-xref-pop__source"><span class="material-symbols-outlined" aria-hidden="true">menu_book</span><span class="slate-xref-pop__source-text"></span></p>' +
      '<div class="slate-xref-pop__excerpt"></div>' +
      '<a class="slate-xref-pop__cta" href="#"><span class="slate-xref-pop__cta-text"></span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>';
    document.body.appendChild(el);
    const pop = {
      el,
      arrow: el.querySelector('.slate-xref-pop__arrow'),
      source: el.querySelector('.slate-xref-pop__source-text'),
      excerpt: el.querySelector('.slate-xref-pop__excerpt'),
      cta: el.querySelector('.slate-xref-pop__cta'),
      ctaText: el.querySelector('.slate-xref-pop__cta-text'),
    };
    el.addEventListener('mouseenter', cancelXrefHide);
    el.addEventListener('mouseleave', scheduleXrefHide);
    el.addEventListener('focusin', cancelXrefHide);
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget) && e.relatedTarget !== xrefOpenPill) scheduleXrefHide(); });
    pop.cta.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = xrefOpenPill && xrefOpenPill._xref;
      hideXrefPop();
      if (ref) gotoXref(ref);
    });
    // Reposition against the anchoring pill while open; hide on Escape.
    const onReflow = () => { if (xrefOpenPill && !el.hidden) positionXrefPop(xrefOpenPill); };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) { const p = xrefOpenPill; hideXrefPop(); if (p) p.focus(); } });
    document.addEventListener('click', (e) => { if (el.hidden) return; if (e.target.closest('.slate-xref-pop') || e.target.closest('.slate-xref')) return; hideXrefPop(); });
    xrefPop = pop; return pop;
  }

  function gotoXref(ref) {
    if (!ref || !ref.route) return;
    navigateTo(ref.route, ref.anchor);
  }

  function positionXrefPop(pill) {
    const pop = ensureXrefPop(); const el = pop.el;
    const r = pill.getBoundingClientRect();
    const pr = el.getBoundingClientRect();
    const margin = 12, gap = 10;
    let placement = 'bottom';
    let top = r.bottom + gap;
    if (top + pr.height > window.innerHeight - margin && r.top - gap - pr.height > margin) {
      top = r.top - gap - pr.height; placement = 'top';
    }
    let left = Math.min(Math.max(margin, r.left), window.innerWidth - margin - pr.width);
    el.style.top = Math.round(top) + 'px';
    el.style.left = Math.round(left) + 'px';
    el.dataset.placement = placement;
    const arrowX = Math.min(Math.max(r.left + r.width / 2 - left, 18), pr.width - 18);
    pop.arrow.style.left = Math.round(arrowX) + 'px';
  }

  function focusXrefAction(e, pill) {
    if ((e.key !== 'ArrowDown' && (e.key !== 'Tab' || e.shiftKey)) || xrefOpenPill !== pill || !xrefPop || xrefPop.el.hidden) return;
    e.preventDefault();
    xrefPop.cta.focus();
  }

  function showXrefPop(pill) {
    const ref = pill._xref; if (!ref) return;
    cancelXrefHide();
    if (xrefOpenPill && xrefOpenPill !== pill) xrefOpenPill.setAttribute('aria-expanded', 'false');
    const pop = ensureXrefPop();
    pop.source.textContent = ref.source || 'Reference';
    pop.excerpt.innerHTML = ref.excerpt || '';
    pop.ctaText.textContent = ref.cta || 'Go to source';
    pop.cta.setAttribute('href', '#' + ref.route + (ref.anchor || ''));
    pop.el.setAttribute('aria-label', 'Reference: ' + (ref.source || ''));
    pop.el.hidden = false;
    xrefOpenPill = pill;
    pill.setAttribute('aria-expanded', 'true');
    positionXrefPop(pill);
    setTimeout(() => { if (xrefOpenPill === pill && !pop.el.hidden) positionXrefPop(pill); }, 0);
  }

  function hideXrefPop() {
    if (!xrefPop || xrefPop.el.hidden) return;
    xrefPop.el.hidden = true;
    if (xrefOpenPill) xrefOpenPill.setAttribute('aria-expanded', 'false');
    xrefOpenPill = null;
  }
  function scheduleXrefHide() { cancelXrefHide(); xrefHideTimer = setTimeout(hideXrefPop, 160); }
  function cancelXrefHide() { if (xrefHideTimer) { clearTimeout(xrefHideTimer); xrefHideTimer = null; } }

  const SPEC_REF_PATTERN = /^(?:CP|SC|UC|IA|UNSUP)-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
  const SPEC_REF_SOURCES = {
    CP: { route: '2027/product-spec/customer-promises.html', label: 'Customer promise', cta: 'View customer promise' },
    SC: { route: '2027/product-spec/scenarios.html', label: 'Supported scenario', cta: 'View supported scenario' },
    UNSUP: { route: '2027/product-spec/scenarios.html', label: 'Unsupported boundary', cta: 'View unsupported boundary' },
    UC: { route: '2027/product-spec/user-can.html', label: 'User-can capability', cta: 'View user-can capability' },
    IA: { route: '2027/product-spec/information-architecture.html', label: 'IA view', cta: 'View IA definition' },
  };
  const specRefCache = new Map();

  function specRefAnchor(id) { return 'spec-' + id.toLowerCase(); }
  function specRefKind(id) { return id.split('-', 1)[0]; }
  function trimSpecExcerpt(text, max) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= max) return compact;
    const clipped = compact.slice(0, max - 1);
    const boundary = clipped.lastIndexOf(' ');
    return clipped.slice(0, boundary > max * 0.65 ? boundary : clipped.length).trimEnd() + '\u2026';
  }

  function markSpecTargets(container) {
    container.querySelectorAll('tr').forEach(row => {
      const first = row.querySelector(':scope > th:first-child, :scope > td:first-child');
      const id = first ? first.textContent.trim() : '';
      if (SPEC_REF_PATTERN.test(id) && !row.id) row.id = specRefAnchor(id);
    });
    container.querySelectorAll('h2,h3,h4').forEach(heading => {
      const match = heading.textContent.trim().match(/((?:CP|SC|UC|IA|UNSUP)-[A-Z0-9]+(?:-[A-Z0-9]+)+)/);
      if (match && !heading.id) heading.id = specRefAnchor(match[1]);
    });
  }

  function findSpecTarget(parsed, id) {
    return Array.from(parsed.querySelectorAll('tr, h2, h3, h4')).find(node => {
      if (node.matches('tr')) {
        const first = node.querySelector(':scope > th:first-child, :scope > td:first-child');
        return first && first.textContent.trim() === id;
      }
      return new RegExp('(^|\\s)' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(node.textContent.trim());
    });
  }

  function findIaPreview(id) {
    for (const [route, doc] of state.docs) {
      if (!route.startsWith('2027/product-spec/views/') || !doc.content || !doc.content.includes(id)) continue;
      const parsed = new DOMParser().parseFromString('<main>' + doc.content + '</main>', 'text/html');
      const contractId = Array.from(parsed.querySelectorAll('table tr')).some(row => {
        const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
        return cells.length > 1 && cells[0].textContent.trim() === 'IA ID' && cells[1].textContent.trim() === id;
      });
      if (!contractId) continue;
      const purpose = parsed.querySelector('.slate-tldr p:not(.slate-tldr__label)');
      if (purpose) return { route, summary: purpose.textContent.trim() };
    }
    return null;
  }

  function authoredSpecSummary(id, target, parsed) {
    const override = target.getAttribute('data-preview-summary');
    if (override) return { summary: override };
    const kind = specRefKind(id);
    if (kind === 'IA') {
      const view = findIaPreview(id);
      if (view) return view;
    }
    if (target.matches('tr')) {
      const cells = Array.from(target.querySelectorAll(':scope > th, :scope > td')).map(cell => cell.textContent.trim());
      if (kind === 'UC') return { summary: [cells[1], cells[6]].filter(Boolean).join(' ') };
      if (kind === 'SC' || kind === 'UNSUP') return { summary: [cells[2], cells[4]].filter(Boolean).join(' ') };
      if (kind === 'IA') return { summary: cells[2] || cells[1] || id };
    }
    if (kind === 'CP') {
      let node = target.nextElementSibling;
      while (node && !/^H[1-6]$/.test(node.tagName)) {
        if (node.matches('table')) {
          const promiseRow = Array.from(node.querySelectorAll('tbody tr')).find(row => {
            const field = row.querySelector(':scope > th:first-child, :scope > td:first-child');
            return field && field.textContent.trim().toLowerCase() === 'customer promise';
          });
          const value = promiseRow && promiseRow.querySelector(':scope > td:last-child');
          if (value) return { summary: value.textContent.trim() };
        }
        node = node.nextElementSibling;
      }
    }
    const title = target.textContent.replace(id, '').replace(/^\s*[-\u2013\u2014]\s*/, '').trim();
    return { summary: title || 'Open the source definition for details.' };
  }

  function lookupSpecRef(id) {
    if (specRefCache.has(id)) return specRefCache.get(id);
    const source = SPEC_REF_SOURCES[specRefKind(id)];
    if (!source) return null;
    const doc = state.docs.get(source.route);
    if (!doc || !doc.content) return null;
    const parsed = new DOMParser().parseFromString('<main>' + doc.content + '</main>', 'text/html');
    const target = findSpecTarget(parsed, id);
    if (!target) return null;
    const authored = authoredSpecSummary(id, target, parsed);
    const summary = trimSpecExcerpt(authored.summary, 240);
    const ref = {
      route: authored.route || source.route,
      anchor: authored.route ? '' : '#' + specRefAnchor(id),
      source: id + ' \u00b7 ' + source.label,
      cta: authored.route ? 'View detailed view specification' : source.cta,
      excerpt: '<p>' + esc(summary) + '</p>',
    };
    specRefCache.set(id, ref);
    return ref;
  }

  function processSpecRefs(container) {
    container.querySelectorAll('code:not(pre code)').forEach(code => {
      if (code.closest('a, button, .slate-xref') || code.dataset.specRefReady) return;
      const id = code.textContent.trim();
      if (!SPEC_REF_PATTERN.test(id)) return;
      const ref = lookupSpecRef(id);
      if (!ref) return;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'slate-xref slate-spec-ref';
      trigger.setAttribute('data-xref-ready', '1');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', 'slate-xref-pop');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', id + ' - show ' + SPEC_REF_SOURCES[specRefKind(id)].label.toLowerCase());
      trigger.innerHTML = '<code></code>';
      trigger.querySelector('code').textContent = id;
      trigger._xref = ref;
      trigger.addEventListener('mouseenter', () => showXrefPop(trigger));
      trigger.addEventListener('mouseleave', scheduleXrefHide);
      trigger.addEventListener('focus', () => showXrefPop(trigger));
      trigger.addEventListener('blur', scheduleXrefHide);
      trigger.addEventListener('keydown', (e) => focusXrefAction(e, trigger));
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (xrefOpenPill === trigger && xrefPop && !xrefPop.el.hidden) hideXrefPop();
        else showXrefPop(trigger);
      });
      code.replaceWith(trigger);
    });
  }

  function processXrefs(container, basePath) {
    container.querySelectorAll('.slate-xref:not([data-xref-ready])').forEach(src => {
      const raw = src.getAttribute('data-xref-href') || '';
      const m = raw.match(/^(.+\.(?:md|html?))(#.*)?$/i);
      let route = '', anchor = '';
      if (m) { route = resolvePath(basePath, m[1]); anchor = m[2] || ''; }
      else if (raw) { route = raw; }
      const labelEl = src.querySelector('.slate-xref__label');
      const excerptEl = src.querySelector('.slate-xref__excerpt');
      const source = src.getAttribute('data-xref-source') || (labelEl ? labelEl.textContent.trim() : 'Reference');
      const label = labelEl ? labelEl.textContent.trim() : source;
      const cta = src.getAttribute('data-xref-cta') || 'Go to source';
      const excerpt = excerptEl ? excerptEl.innerHTML.trim() : '';

      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'slate-xref';           // keep class so heading slugs still strip it
      pill.setAttribute('data-xref-ready', '1');
      pill.setAttribute('aria-haspopup', 'dialog');
      pill.setAttribute('aria-controls', 'slate-xref-pop');
      pill.setAttribute('aria-expanded', 'false');
      pill.setAttribute('aria-label', label + ' - reference: ' + source);
      pill.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">bookmark</span><span class="slate-xref__text"></span>';
      pill.querySelector('.slate-xref__text').textContent = label;
      pill._xref = { route, anchor, source, cta, excerpt };

      pill.addEventListener('mouseenter', () => showXrefPop(pill));
      pill.addEventListener('mouseleave', scheduleXrefHide);
      pill.addEventListener('focus', () => showXrefPop(pill));
      pill.addEventListener('blur', scheduleXrefHide);
      pill.addEventListener('keydown', (e) => focusXrefAction(e, pill));
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        if (xrefOpenPill === pill && xrefPop && !xrefPop.el.hidden) hideXrefPop();
        else showXrefPop(pill);
      });
      src.replaceWith(pill);
    });
  }

  function figcaptionFor(img) {
    const fig = img.closest('figure, .slate-figure');
    return fig ? fig.querySelector('figcaption') : null;
  }

  let viewer = null;
  function ensureViewer() {
    if (viewer) return viewer;
    const el = document.createElement('div');
    el.className = 'slate-viewer'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Image viewer');
    el.innerHTML =
      '<div class="slate-viewer__stage">' +
        '<button class="slate-viewer__close" type="button" aria-label="Close image viewer"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>' +
        '<button class="slate-viewer__nav slate-viewer__nav--prev" type="button" aria-label="Previous image"><span class="material-symbols-outlined" aria-hidden="true">chevron_left</span></button>' +
        '<button class="slate-viewer__nav slate-viewer__nav--next" type="button" aria-label="Next image"><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>' +
        '<img class="slate-viewer__img" alt="">' +
        '<figure class="slate-viewer__caption" data-collapsed="true">' +
          '<button class="slate-viewer__caption-toggle" type="button" aria-expanded="false" aria-label="Expand caption">' +
            '<figcaption class="slate-viewer__caption-text"></figcaption>' +
            '<span class="slate-viewer__caption-chevron material-symbols-outlined" aria-hidden="true">keyboard_arrow_up</span>' +
          '</button>' +
        '</figure>' +
      '</div>' +
      '<div class="slate-viewer__filmstrip" aria-label="Image thumbnails"></div>';
    document.body.appendChild(el);

    const v = {
      el,
      stage: el.querySelector('.slate-viewer__stage'),
      img: el.querySelector('.slate-viewer__img'),
      caption: el.querySelector('.slate-viewer__caption'),
      captionToggle: el.querySelector('.slate-viewer__caption-toggle'),
      captionText: el.querySelector('.slate-viewer__caption-text'),
      prev: el.querySelector('.slate-viewer__nav--prev'),
      next: el.querySelector('.slate-viewer__nav--next'),
      filmstrip: el.querySelector('.slate-viewer__filmstrip'),
      items: [], index: 0, lastFocus: null, touchX: null, keyHandler: null,
    };

    el.querySelector('.slate-viewer__close').addEventListener('click', closeViewer);
    v.prev.addEventListener('click', () => showImage(v.index - 1));
    v.next.addEventListener('click', () => showImage(v.index + 1));
    v.captionToggle.addEventListener('click', () => {
      const collapsed = v.caption.getAttribute('data-collapsed') !== 'false';
      v.caption.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
      v.captionToggle.setAttribute('aria-expanded', String(collapsed));
      v.captionToggle.setAttribute('aria-label', collapsed ? 'Collapse caption' : 'Expand caption');
    });
    // Click the dark backdrop (stage padding) to close; clicks on the image or
    // controls do not close.
    v.stage.addEventListener('click', (e) => { if (e.target === v.stage) closeViewer(); });
    // Touch swipe to move between images.
    v.stage.addEventListener('touchstart', (e) => { v.touchX = e.changedTouches[0].clientX; }, { passive: true });
    v.stage.addEventListener('touchend', (e) => {
      if (v.touchX == null) return;
      const dx = e.changedTouches[0].clientX - v.touchX; v.touchX = null;
      if (Math.abs(dx) > 45) showImage(v.index + (dx < 0 ? 1 : -1));
    }, { passive: true });

    viewer = v; return v;
  }

  function openViewer(imgs, index) {
    const v = ensureViewer();
    v.items = imgs; v.lastFocus = document.activeElement;
    v.el.classList.toggle('is-single', imgs.length < 2);
    // Build the filmstrip for this page.
    v.filmstrip.innerHTML = '';
    imgs.forEach((img, i) => {
      const b = document.createElement('button');
      b.className = 'slate-viewer__thumb'; b.type = 'button'; b.setAttribute('aria-label', 'View image ' + (i + 1));
      const t = document.createElement('img'); t.src = img.currentSrc || img.src; t.alt = ''; t.loading = 'lazy';
      b.appendChild(t); b.addEventListener('click', () => showImage(i));
      v.filmstrip.appendChild(b);
    });
    v.el.hidden = false;
    document.documentElement.classList.add('slate-viewer-open');
    // Start collapsed each time the viewer opens.
    v.caption.setAttribute('data-collapsed', 'true');
    v.captionToggle.setAttribute('aria-expanded', 'false');
    v.captionToggle.setAttribute('aria-label', 'Expand caption');
    v.keyHandler = (e) => {
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowLeft') showImage(v.index - 1);
      else if (e.key === 'ArrowRight') showImage(v.index + 1);
    };
    document.addEventListener('keydown', v.keyHandler);
    showImage(index);
    v.el.querySelector('.slate-viewer__close').focus();
  }

  function showImage(index) {
    const v = viewer; if (!v) return;
    const n = v.items.length; if (!n) return;
    v.index = Math.max(0, Math.min(index, n - 1));
    const img = v.items[v.index];
    v.img.src = img.currentSrc || img.src; v.img.alt = img.alt || '';
    // Caption: prefer a figcaption, fall back to alt text; hide if neither.
    const cap = figcaptionFor(img);
    v.captionText.textContent = '';
    let hasCaption = false;
    if (cap && cap.textContent.trim()) {
      Array.from(cap.cloneNode(true).childNodes).forEach(node => v.captionText.appendChild(node));
      hasCaption = true;
    } else if (img.alt && img.alt.trim()) {
      v.captionText.textContent = img.alt.trim(); hasCaption = true;
    }
    v.caption.hidden = !hasCaption;
    // Nav availability.
    v.prev.disabled = v.index === 0;
    v.next.disabled = v.index === n - 1;
    // Filmstrip active state + keep the active thumb in view.
    const thumbs = v.filmstrip.children;
    for (let i = 0; i < thumbs.length; i++) thumbs[i].classList.toggle('is-active', i === v.index);
    const active = thumbs[v.index];
    if (active) {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      active.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function closeViewer() {
    const v = viewer; if (!v || v.el.hidden) return;
    v.el.hidden = true;
    document.documentElement.classList.remove('slate-viewer-open');
    if (v.keyHandler) { document.removeEventListener('keydown', v.keyHandler); v.keyHandler = null; }
    v.img.src = '';
    if (v.lastFocus && v.lastFocus.focus) v.lastFocus.focus();
  }

  /* ==========================================================
     NAVIGATION  (REQ-UX-03..07)
     ========================================================== */
  function buildFileTree() {
    const root = { name: '', children: new Map(), files: [] };
    for (const [path, doc] of state.docs) {
      if (doc.hidden) continue;
      if (doc.type && !['page', 'canvas'].includes(doc.type)) continue;
      const pathParts = path.split('/');
      // Manifest groups are complete narrative navigation paths. Physical folders
      // must not be appended or they duplicate virtual sections in the tree.
      let parts = pathParts;
      if (doc.group) {
        const groupParts = String(doc.group).split('/').filter(Boolean);
        parts = [...groupParts, pathParts[pathParts.length - 1]];
      }
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) { if (!node.children.has(parts[i])) node.children.set(parts[i], { name: parts[i], children: new Map(), files: [] }); node = node.children.get(parts[i]); }
      node.files.push({ path, title: doc.title, filename: pathParts[pathParts.length - 1], order: doc.order != null ? doc.order : Infinity, icon: doc.icon, badge: doc.badge, status: doc.status, updated: doc.updated, type: doc.type });
    }
    state.fileTree = root;
    // Ordered navigable pages (for pager)
    state.orderedPaths = [...state.docs.entries()]
      .filter(([, d]) => !d.hidden && (!d.type || d.type === 'page'))
      .sort((a, b) => (a[1].order ?? Infinity) - (b[1].order ?? Infinity) || String(a[1].title).localeCompare(String(b[1].title)))
      .map(([p]) => p);
  }
  function folderMinOrder(folder) {
    let min = Infinity; for (const f of folder.files) min = Math.min(min, f.order ?? Infinity);
    for (const [, c] of folder.children) min = Math.min(min, folderMinOrder(c)); return min;
  }
  function renderNav() {
    const nav = $('.nav-tree'); nav.innerHTML = ''; const tree = state.fileTree;
    const rootFiles = [...tree.files].sort((a, b) => { if (a.filename.toLowerCase() === 'readme.md') return -1; if (b.filename.toLowerCase() === 'readme.md') return 1; return (a.order ?? Infinity) - (b.order ?? Infinity) || a.title.localeCompare(b.title); });
    rootFiles.forEach(f => nav.appendChild(makeNavItem(f)));
    [...tree.children.entries()].sort((a, b) => folderMinOrder(a[1]) - folderMinOrder(b[1]) || a[0].localeCompare(b[0])).forEach(([n, f]) => nav.appendChild(makeNavFolder(n, f, n)));
  }
  function makeNavItem(file) {
    const a = document.createElement('a');
    const canvas = file.type === 'canvas';
    a.className = 'nav-item'; a.href = canvas ? canvasUrl(file.path) : '#' + file.path; a.dataset.path = file.path; a.title = canvas ? file.title + ' - opens Canvas in a new tab' : file.title;
    if (canvas) { a.target = '_blank'; a.rel = 'noopener'; }
    const indicator = file.status
      ? `<span class="nav-status" data-status="${esc(String(file.status).toLowerCase())}" title="${esc(navMetaTitle(file))}" aria-label="${esc(statusLabel(file.status))}"></span>`
      : (file.badge ? `<span class="nav-badge">${esc(file.badge)}</span>` : '');
    a.innerHTML = `<span class="material-symbols-outlined nav-icon" aria-hidden="true">${esc(file.icon || 'description')}</span><span class="nav-item-text">${esc(file.title)}</span>${indicator}`;
    if (!canvas) a.addEventListener('click', (e) => { if (modClick(e)) return; e.preventDefault(); navigateTo(file.path); });
    return a;
  }
  function canvasUrl(path) {
    const documentPath = joinRoot(path);
    return 'shell/canvas/index.html?document=' + encodeURIComponent(documentPath);
  }
  function navStorageKey(name) { return `slate-navigation:${state.projectName}:${state.contentRoot || '/'}:${name}`; }
  function readStoredValue(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function writeStoredValue(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function setFolderExpanded(group, expanded) {
    group.classList.toggle('expanded', expanded);
    group.querySelector(':scope > .nav-folder-header')?.setAttribute('aria-expanded', String(expanded));
    writeStoredValue(navStorageKey(group.dataset.folderPath), expanded ? 'expanded' : 'collapsed');
  }
  function makeNavFolder(name, folder, folderPath) {
    const group = document.createElement('div'); group.className = 'nav-folder';
    group.dataset.folderPath = folderPath;
    const header = document.createElement('button'); header.className = 'nav-folder-header'; header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `<span class="material-symbols-outlined nav-chevron" aria-hidden="true">chevron_right</span><span class="material-symbols-outlined nav-folder-icon" aria-hidden="true">folder</span><span class="nav-folder-text">${esc(humanize(name))}</span>`;
    header.addEventListener('click', () => setFolderExpanded(group, !group.classList.contains('expanded')));
    const content = document.createElement('div'); content.className = 'nav-folder-content';
    [...folder.files].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.title.localeCompare(b.title)).forEach(f => content.appendChild(makeNavItem(f)));
    [...folder.children.entries()].sort((a, b) => folderMinOrder(a[1]) - folderMinOrder(b[1]) || a[0].localeCompare(b[0])).forEach(([n, f]) => content.appendChild(makeNavFolder(n, f, `${folderPath}/${n}`)));
    group.appendChild(header); group.appendChild(content);
    if (readStoredValue(navStorageKey(folderPath)) === 'expanded') setFolderExpanded(group, true);
    return group;
  }
  function setAllFolders(expanded) { $$('.nav-folder').forEach(folder => setFolderExpanded(folder, expanded)); }

  /* ==========================================================
     STATUS + LAST-UPDATED METADATA
     ========================================================== */
  const STATUS_LABELS = { stub: 'Stub', planned: 'Planned', draft: 'Draft', wip: 'In progress', review: 'In review', pending: 'Pending', deciding: 'Deciding', stable: 'Stable', published: 'Published', done: 'Done' };
  function statusLabel(s) { if (!s) return ''; const k = String(s).toLowerCase(); return STATUS_LABELS[k] || (String(s).charAt(0).toUpperCase() + String(s).slice(1)); }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function absDate(d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; }
  function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso); if (isNaN(then.getTime())) return '';
    const secs = Math.floor((Date.now() - then.getTime()) / 1000);
    if (secs < 0) return 'just now';
    if (secs < 45) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 1) return 'just now';
    if (mins === 1) return 'a minute ago';
    if (mins < 60) return mins + ' minutes ago';
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return 'an hour ago';
    if (hrs < 24) return hrs + ' hours ago';
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 11) return 'a week ago';
    if (days < 28) return Math.round(days / 7) + ' weeks ago';
    const months = Math.round(days / 30);
    if (days < 45) return 'a month ago';
    if (days < 335) return months + ' months ago';
    return absDate(then); // older than ~11 months -> absolute day month year
  }
  function navMetaTitle(file) {
    const bits = [];
    if (file.status) bits.push(statusLabel(file.status));
    if (file.updated) { const rel = relativeTime(file.updated); if (rel) bits.push('updated ' + rel); }
    return bits.join(' \u00b7 ');
  }
  function renderPageMeta(path, entry) {
    const doc = state.docs.get(path) || entry || {};
    const status = doc.status, updated = doc.updated;
    if (!status && !updated) return '';
    const parts = [];
    if (status) parts.push(`<span class="slate-pagemeta__status" data-status="${esc(String(status).toLowerCase())}">${esc(statusLabel(status))}</span>`);
    if (updated) { const rel = relativeTime(updated); if (rel) parts.push(`<span class="slate-pagemeta__updated" title="${esc(absDate(new Date(updated)))}">Updated ${esc(rel)}</span>`); }
    if (!parts.length) return '';
    return `<div class="slate-pagemeta">${parts.join('<span class="slate-pagemeta__sep" aria-hidden="true">\u00b7</span>')}</div>`;
  }

  /* ==========================================================
     BREADCRUMBS + PAGER  (REQ-UX-20/21)
     ========================================================== */
  function renderBreadcrumbs(path) {
    const parts = path.split('/'); const crumbs = [];
    crumbs.push('<a href="#' + (state.landing || 'README.md') + '">Home</a>');
    for (let i = 0; i < parts.length - 1; i++) crumbs.push('<span>' + esc(humanize(parts[i])) + '</span>');
    crumbs.push('<span>' + esc(state.docs.get(path)?.title || humanize(parts[parts.length - 1])) + '</span>');
    return '<nav class="breadcrumbs" aria-label="Breadcrumb">' + crumbs.join('<span class="sep">/</span>') + '</nav>';
  }
  function renderPager(path) {
    const i = state.orderedPaths.indexOf(path); if (i < 0) return '';
    const prev = i > 0 ? state.orderedPaths[i - 1] : null;
    const next = i < state.orderedPaths.length - 1 ? state.orderedPaths[i + 1] : null;
    if (!prev && !next) return '';
    const link = (p, dir, cls) => p ? `<a class="${cls}" href="#${esc(p)}" data-path="${esc(p)}"><span class="pager-dir">${dir}</span><span class="pager-title">${esc(state.docs.get(p).title)}</span></a>` : '<span class="pager-spacer"></span>';
    return `<div class="pager">${link(prev, 'Previous', 'pager-prev')}${link(next, 'Next', 'pager-next')}</div>`;
  }

  /* ==========================================================
     NAVIGATE / RENDER A PAGE
     ========================================================== */
  const FADE_MS = 180;
  function navigateTo(path, anchor) {
    const entry = state.docs.get(path); if (!entry) return;
    const prevPath = state.currentPath;
    anchor = anchor ? (anchor.charAt(0) === '#' ? anchor : '#' + anchor) : '';
    // Update route state synchronously so the hashchange router stays a no-op
    // and the URL stays correct even while the visual swap is deferred.
    state.currentPath = path;
    if (anchor) {
      // Deep-link: carry the anchor in the hash so renderPage scrolls to it
      // AFTER the (possibly fade-deferred) content is in the DOM.
      if (window.location.hash.slice(1) !== path + anchor) window.location.hash = path + anchor;
    } else {
      const hash = window.location.hash.slice(1);
      if (hash.split('#')[0] !== path) window.location.hash = path;
    }

    const article = $('#document');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // First paint, re-selecting the same page, or reduced-motion: swap at once.
    if (!prevPath || prevPath === path || reduced) { article.classList.remove('is-fading'); renderPage(path, entry); return; }
    // Cross-page: fade the current content out, swap it while invisible, then
    // fade the new content in. The scroll reset happens during the invisible
    // window, so there is no visible scroll animation and no jump.
    clearTimeout(state.fadeTimer);
    article.classList.add('is-fading');
    state.fadeTimer = setTimeout(() => {
      renderPage(path, entry);
      // Paint the hidden state with the new content, then release for fade-in.
      requestAnimationFrame(() => requestAnimationFrame(() => article.classList.remove('is-fading')));
    }, FADE_MS);
  }

  function renderPage(path, entry) {
    const article = $('#document');
    if (state.svgMotionCleanup) { state.svgMotionCleanup(); state.svgMotionCleanup = null; }
    article.innerHTML = renderBreadcrumbs(path) + renderPageMeta(path, entry) + '<div class="page-body"></div>';
    const body = article.querySelector('.page-body');
    // Parse in an inert document (DOMParser docs do not load subresources) so
    // images are not fetched with their raw, pre-rewrite src; postProcess fixes
    // the paths before the nodes are attached, so each asset is fetched once.
    const parsed = new DOMParser().parseFromString(renderToHtml(path, entry.content), 'text/html');
    postProcess(parsed.body, path);
    while (parsed.body.firstChild) body.appendChild(parsed.body.firstChild);
    // Pager appended after body
    article.insertAdjacentHTML('beforeend', renderPager(path));
    article.querySelectorAll('.pager a').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); navigateTo(a.dataset.path); }));

    $$('.nav-item').forEach(it => it.classList.toggle('active', it.dataset.path === path));
    document.title = `${entry.title} - ${state.projectName}`;
    buildToc(body);
    // Reset scroll instantly (not smoothly) - the fade covers the change, so an
    // animated scroll here would read as "same page, just scrolled".
    $('#content').scrollTo({ top: 0, behavior: 'instant' }); window.scrollTo({ top: 0, behavior: 'instant' });
    if (state.sidebarOpen) toggleSidebar();

    const ai = window.location.hash.indexOf('#', 1);
    if (ai > 0) { const anchor = decodeURIComponent(window.location.hash.slice(ai + 1)); requestAnimationFrame(() => { const el = document.getElementById(anchor); if (el) { expandToTarget(el); el.scrollIntoView({ behavior: 'instant', block: 'start' }); } }); }
  }

  /* ==========================================================
     TABLE OF CONTENTS + SCROLLSPY  (REQ-UX-08/09)
     ========================================================== */
  function headingText(h) {
    const c = h.cloneNode(true);
    c.querySelectorAll('.collapse-toggle, .heading-anchor, .slate-xref, .slate-badge').forEach(n => n.remove());
    return c.textContent.trim();
  }
  function buildToc(container) {
    const tocEl = $('#toc');
    if (state.scrollSpyCleanup) { state.scrollSpyCleanup(); state.scrollSpyCleanup = null; }
    const article = $('#document'); const oldMobile = article.querySelector('.toc-mobile'); if (oldMobile) oldMobile.remove();
    tocEl.classList.remove('toc--minimap');
    document.querySelector('.app')?.classList.remove('app--deck');
    article.classList.remove('is-deck');

    // Presentation decks get a slide-navigator minimap instead of a heading TOC.
    const slides = $$('.slate-slide', container);
    if (slides.length) { buildSlideMinimap(tocEl, slides); return; }

    // Restore the standard TOC scaffold (a prior deck page may have replaced it).
    let tocNav = tocEl.querySelector('.toc-nav');
    if (!tocNav) { tocEl.innerHTML = '<div class="toc-header">On this page</div><nav class="toc-nav" aria-label="Table of contents"></nav>'; tocNav = tocEl.querySelector('.toc-nav'); }
    tocNav.innerHTML = '';
    const headings = $$('h2, h3', container).filter(h => !h.closest('[class*="slate-"]'));
    if (!headings.length) { tocEl.classList.add('hidden'); return; }
    tocEl.classList.remove('hidden');

    const mobile = document.createElement('details'); mobile.className = 'toc-mobile';
    mobile.innerHTML = '<summary>On this page<span class="material-symbols-outlined" aria-hidden="true">expand_more</span></summary>';
    const mList = document.createElement('div'); mList.className = 'toc-mobile__list'; mobile.appendChild(mList);

    const items = [];
    headings.forEach(h => {
      const cls = 'toc-item' + (h.tagName === 'H3' ? ' toc-item--nested' : '');
      const label = headingText(h); const href = '#' + state.currentPath + '#' + h.id;
      const go = (e) => { if (modClick(e)) return; e.preventDefault(); expandToTarget(h); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); window.location.hash = href; if (mobile.open) mobile.open = false; };
      const item = document.createElement('a'); item.className = cls; item.textContent = label; item.href = href; item.addEventListener('click', go); tocNav.appendChild(item); items.push(item);
      const mItem = document.createElement('a'); mItem.className = cls; mItem.textContent = label; mItem.href = href; mItem.addEventListener('click', go); mList.appendChild(mItem);
    });
    if (container.parentElement) container.parentElement.insertBefore(mobile, container);

    const contentEl = $('#content'); const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      let idx = -1;
      for (let i = 0; i < headings.length; i++) { if (visible.has(headings[i])) { idx = i; break; } }
      if (idx === -1) for (let i = 0; i < headings.length; i++) { if (headings[i].getBoundingClientRect().top < 120) idx = i; }
      items.forEach((it, i) => it.classList.toggle('active', i === idx));
    }, { root: null, rootMargin: '-64px 0px -70% 0px', threshold: 0 });
    headings.forEach(h => io.observe(h));
    state.scrollSpyCleanup = () => io.disconnect();
  }

  /* ==========================================================
     SLIDE MINIMAP  (presentation-deck navigator)
     A vertical rail of ticks - one per .slate-slide - shown in the
     right rail instead of the heading TOC. Hover/focus previews the
     slide (number, beat, title); click smooth-scrolls to it; the
     in-view slide stays highlighted; marks near the cursor magnify
     in a dock/fisheye wave. Geometry is read live from the DOM via
     data-slide-id <-> data-minimap-id, never stored.
     ========================================================== */
  function buildSlideMinimap(tocEl, slides) {
    tocEl.classList.remove('hidden');
    tocEl.classList.add('toc--minimap');
    document.querySelector('.app')?.classList.add('app--deck');
    $('#document').classList.add('is-deck');
    const usedIds = new Set();
    let duplicateIds = false;
    slides.forEach((slide, index) => {
      const title = slide.querySelector('.slate-slide__title');
      const authored = slide.id || slide.getAttribute('data-slide-id') || (title ? slugify(headingText(title)) : 'slide-' + (index + 1));
      const stableId = authored || 'slide-' + (index + 1);
      if (usedIds.has(stableId)) duplicateIds = true;
      usedIds.add(stableId);
      slide.id = stableId;
      slide.setAttribute('data-slide-id', stableId);
      slide.setAttribute('data-slide-index', String(index));
    });

    const meta = slides.map((s, i) => {
      const num = (s.querySelector('.slate-slide__num')?.textContent || String(i + 1)).trim();
      const kEl = s.querySelector('.slate-slide__kicker');
      const beat = kEl ? kEl.textContent.replace(num, '').replace(/\s+/g, ' ').trim() : '';
      const tEl = s.querySelector('.slate-slide__title');
      const title = tEl ? headingText(tEl) : ('Slide ' + num);
      return { id: slides[i].getAttribute('data-slide-id'), num, beat, title };
    });

    const nav = document.createElement('nav');
    nav.className = 'slate-minimap'; nav.setAttribute('aria-label', 'Slide navigator');
    const rail = document.createElement('div'); rail.className = 'slate-minimap__rail';
    const track = document.createElement('div'); track.className = 'slate-minimap__track';
    const tip = document.createElement('div'); tip.className = 'slate-minimap__tip'; tip.setAttribute('role', 'status');

    const marks = meta.map(m => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slate-minimap__mark';
      b.setAttribute('data-minimap-id', m.id);
      b.setAttribute('aria-label', 'Slide ' + m.num + (m.beat ? ' - ' + m.beat : '') + ': ' + m.title);
      b.style.setProperty('--wave', '0');
      const pill = document.createElement('span'); pill.className = 'slate-minimap__pill'; b.appendChild(pill);
      track.appendChild(b); return b;
    });
    rail.appendChild(track); nav.appendChild(rail); nav.appendChild(tip);
    tocEl.innerHTML = ''; tocEl.appendChild(nav);

    const content = $('#content');
    const WAVE = [1, 0.62, 0.34, 0.16, 0];
    let activeIndex = -1, pinTimer = null;

    function setActive(idx) {
      activeIndex = idx;
      marks.forEach((mk, i) => {
        mk.classList.toggle('slate-minimap__mark--active', i === idx);
        const w = idx < 0 ? 0 : (WAVE[Math.min(Math.abs(idx - i), WAVE.length - 1)] || 0);
        mk.style.setProperty('--wave', String(w));
      });
    }
    function positionTip(i) {
      const r = marks[i].getBoundingClientRect(), root = nav.getBoundingClientRect();
      tip.style.top = (r.top - root.top + r.height / 2) + 'px';
    }
    function showTip(i) {
      const m = meta[i];
      tip.innerHTML = '<span class="slate-minimap__tip-num">' + esc(m.num) + (m.beat ? ' &middot; ' + esc(m.beat) : '') + '</span><span class="slate-minimap__tip-title">' + esc(m.title) + '</span>';
      tip.classList.add('is-visible'); positionTip(i);
    }
    function hideTip() { tip.classList.remove('is-visible'); }
    function scrollToSlide(i) {
      const cRect = content.getBoundingClientRect(), sRect = slides[i].getBoundingClientRect();
      const offset = Math.max(24, content.clientHeight * 0.18);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      content.scrollTo({ top: content.scrollTop + (sRect.top - cRect.top) - offset, behavior: reduce ? 'auto' : 'smooth' });
    }
    function updateCurrent() {
      const cRect = content.getBoundingClientRect();
      const line = cRect.top + content.clientHeight * 0.25;
      let idx = 0;
      for (let i = 0; i < slides.length; i++) { if (slides[i].getBoundingClientRect().top <= line) idx = i; else break; }
      // At the very bottom, the last slide may never cross the 25% line (short trailing content) - pin it.
      if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4) idx = slides.length - 1;
      marks.forEach((mk, i) => mk.classList.toggle('slate-minimap__mark--current', i === idx));
    }

    marks.forEach((mk, i) => {
      mk.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; setActive(i); showTip(i); });
      mk.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') return; if (activeIndex === i) { setActive(-1); hideTip(); } });
      mk.addEventListener('focus', () => { setActive(i); showTip(i); });
      mk.addEventListener('blur', () => { if (activeIndex === i) { setActive(-1); hideTip(); } });
      mk.addEventListener('click', () => {
        if (window.SlatePresentation?.isPresenting()) window.SlatePresentation.goToSlide(meta[i].id, { source: 'minimap' });
        else scrollToSlide(i);
      });
      mk.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        setActive(i); showTip(i);
        clearTimeout(pinTimer); pinTimer = setTimeout(() => { setActive(-1); hideTip(); }, 3600);
      });
    });

    const onReflow = () => { updateCurrent(); if (activeIndex >= 0) positionTip(activeIndex); };
    content.addEventListener('scroll', onReflow, { passive: true });
    window.addEventListener('resize', onReflow);
    requestAnimationFrame(updateCurrent);

    state.scrollSpyCleanup = () => {
      content.removeEventListener('scroll', onReflow);
      window.removeEventListener('resize', onReflow);
      clearTimeout(pinTimer);
      window.SlatePresentation?.destroy();
    };
    const entry = state.docs.get(state.currentPath) || {};
    const motion = entry.presentation?.motion;
    if (duplicateIds) {
      console.error('Slate presentation disabled: duplicate slide IDs must be resolved by the author.');
      window.SlatePresentation?.destroy();
      return;
    }
    window.SlatePresentation?.attach({
      slides,
      meta,
      content,
      path: state.currentPath,
      revision: entry.updated || '',
      motionUrl: motion ? joinRoot(resolvePath(state.currentPath, motion)) : '',
    });
  }

  /* ==========================================================
     SEARCH  (REQ-UX-10..13, D-SEARCH-1)
     Index RENDERED text via a one-time offscreen render pass.
     ========================================================== */
  function buildSearchIndex() {
    state.searchIndex = [];
    for (const [path, doc] of state.docs) {
      if (doc.type === 'canvas') {
        const text = (doc.canvas?.searchText || '').replace(/\s+/g, ' ').trim();
        state.searchIndex.push({ path, title: doc.title, text, type: 'canvas' });
        continue;
      }
      if (doc.type && doc.type !== 'page') continue;
      // Parse inert (DOMParser docs never fetch images/subresources) so building
      // the index does not trigger asset requests for every page at startup.
      const parsed = new DOMParser().parseFromString(renderToHtml(path, doc.content || ''), 'text/html');
      const text = (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
      doc.text = text;
      state.searchIndex.push({ path, title: doc.title, text, type: 'page' });
    }
  }
  function runSearch(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase(); const results = [];
    for (const e of state.searchIndex) {
      const tl = e.title.toLowerCase(), cl = e.text.toLowerCase();
      const tm = tl.includes(q); const ci = cl.indexOf(q);
      if (tm || ci >= 0) {
        let snippet = '';
        if (ci >= 0) { const s = Math.max(0, ci - 50), en = Math.min(e.text.length, ci + query.length + 80); snippet = (s > 0 ? '…' : '') + e.text.substring(s, en).trim() + (en < e.text.length ? '…' : ''); }
        results.push({ path: e.path, title: e.title, snippet, score: tm ? 2 : 1, type: e.type });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }
  function showSearchResults(results) {
    const c = $('.search-results'); state.searchSel = -1;
    const input = $('.search-input'); input.removeAttribute('aria-activedescendant');
    if (!results.length) { c.innerHTML = '<div class="search-empty">No results found</div>'; c.classList.add('visible'); return; }
    const q = input.value;
    c.innerHTML = results.map((r, i) => `<a id="sr-${i}" href="${r.type === 'canvas' ? esc(canvasUrl(r.path)) : '#' + esc(r.path)}" class="search-result" data-path="${esc(r.path)}" data-type="${esc(r.type || 'page')}" role="option"${r.type === 'canvas' ? ' target="_blank" rel="noopener"' : ''}><div class="search-result-title">${highlight(esc(r.title), q)}${r.type === 'canvas' ? ' <span class="nav-badge">Canvas</span>' : ''}</div>${r.snippet ? `<div class="search-result-snippet">${highlight(esc(r.snippet), q)}</div>` : ''}</a>`).join('');
    c.classList.add('visible');
    $$('.search-result', c).forEach(el => el.addEventListener('click', (e) => {
      if (el.dataset.type === 'canvas') { closeSearch(); return; }
      if (modClick(e)) return; e.preventDefault(); const query = input.value.trim(); navigateTo(el.dataset.path); closeSearch(); if (query) requestAnimationFrame(() => scrollToMatch(query));
    }));
  }
  function searchResultEls() { return $$('.search-result', $('.search-results')); }
  function setSearchSel(i) {
    const els = searchResultEls(); if (!els.length) return;
    state.searchSel = (i + els.length) % els.length;
    els.forEach((el, idx) => el.classList.toggle('active', idx === state.searchSel));
    const active = els[state.searchSel]; active.scrollIntoView({ block: 'nearest' });
    $('.search-input').setAttribute('aria-activedescendant', active.id);
  }
  function highlight(text, query) { if (!query) return text; return text.replace(new RegExp('(' + escRegex(query) + ')', 'gi'), '<mark>$1</mark>'); }
  function closeSearch() { $('.search-results').classList.remove('visible'); $('.search-input').value = ''; $('.search-input').blur(); }
  function scrollToMatch(query) {
    const article = $('#document'); const q = query.toLowerCase();
    $$('.search-highlight', article).forEach(el => el.replaceWith(...el.childNodes));
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, { acceptNode(n) { return n.parentElement && n.parentElement.closest('.material-symbols-outlined, .collapse-toggle, .heading-anchor, .copy-btn') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }); let node;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.toLowerCase().indexOf(q);
      if (idx >= 0) {
        if (node.parentElement) expandToTarget(node.parentElement);
        const range = document.createRange(); range.setStart(node, idx); range.setEnd(node, idx + query.length);
        const mark = document.createElement('mark'); mark.className = 'search-highlight';
        try { range.surroundContents(mark); } catch (_) { return; }
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => mark.classList.add('search-highlight-fade'), 800);
        setTimeout(() => { if (mark.parentNode) mark.replaceWith(...mark.childNodes); }, 3000);
        return;
      }
    }
  }

  /* ==========================================================
     SIDEBAR (mobile)
     ========================================================== */
  function toggleSidebar() { state.sidebarOpen = !state.sidebarOpen; $('#sidebar').classList.toggle('open', state.sidebarOpen); $('#overlay').classList.toggle('visible', state.sidebarOpen); }
  const SIDEBAR_WIDTH_STORAGE_KEY = 'slate-navigation:sidebar-width';
  function sidebarWidthLimits() { return { min: 220, max: Math.max(220, Math.min(480, Math.floor(window.innerWidth * .45))) }; }
  function setSidebarWidth(width) {
    const limits = sidebarWidthLimits();
    const next = Math.round(Math.max(limits.min, Math.min(limits.max, width)));
    document.documentElement.style.setProperty('--sidebar-w', `${next}px`);
    const handle = $('#sidebar-resize-handle'); if (handle) handle.setAttribute('aria-valuenow', String(next));
    writeStoredValue(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
  }
  function initSidebarResize() {
    const handle = $('#sidebar-resize-handle'); if (!handle) return;
    const stored = Number(readStoredValue(SIDEBAR_WIDTH_STORAGE_KEY));
    if (Number.isFinite(stored) && stored > 0) setSidebarWidth(stored);
    const limits = sidebarWidthLimits();
    handle.setAttribute('aria-valuemin', String(limits.min)); handle.setAttribute('aria-valuemax', String(limits.max));
    let pointerId = null;
    function stop() {
      if (pointerId === null) return;
      try { handle.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null; handle.classList.remove('is-resizing'); document.body.classList.remove('slate-sidebar-resizing');
    }
    handle.addEventListener('pointerdown', event => {
      if (window.matchMedia('(max-width: 768px)').matches) return;
      pointerId = event.pointerId; handle.setPointerCapture(pointerId); handle.classList.add('is-resizing'); document.body.classList.add('slate-sidebar-resizing'); event.preventDefault();
    });
    handle.addEventListener('pointermove', event => { if (event.pointerId === pointerId) setSidebarWidth(event.clientX); });
    handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
    handle.addEventListener('keydown', event => {
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 280;
      const delta = event.shiftKey ? 32 : 8;
      if (event.key === 'ArrowLeft') { event.preventDefault(); setSidebarWidth(current - delta); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setSidebarWidth(current + delta); }
      if (event.key === 'Home') { event.preventDefault(); setSidebarWidth(sidebarWidthLimits().min); }
      if (event.key === 'End') { event.preventDefault(); setSidebarWidth(sidebarWidthLimits().max); }
    });
    window.addEventListener('resize', () => {
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 280;
      const limits = sidebarWidthLimits(); handle.setAttribute('aria-valuemin', String(limits.min)); handle.setAttribute('aria-valuemax', String(limits.max));
      if (current > limits.max) setSidebarWidth(current);
    });
  }

  /* ==========================================================
     SVG ICONS
     ========================================================== */
  const CHEVRON_SVG = '<span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>';
  const COPY_SVG = '<span class="material-symbols-outlined" aria-hidden="true">content_copy</span>';
  const CHECK_SVG = '<span class="material-symbols-outlined" aria-hidden="true">done</span>';

  /* ==========================================================
     EVENTS + ROUTER
     ========================================================== */
  function initBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top'; btn.type = 'button'; btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span>';
    document.body.appendChild(btn);
    const contentEl = $('#content');
    const getTop = () => Math.max(contentEl.scrollTop || 0, window.scrollY || document.documentElement.scrollTop || 0);
    btn.addEventListener('click', () => { contentEl.scrollTo({ top: 0, behavior: 'smooth' }); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    let ticking = false;
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { btn.classList.toggle('visible', getTop() > 400); ticking = false; }); };
    contentEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function bindEvents() {
    $('.theme-toggle').addEventListener('click', toggleTheme);
    $('.menu-toggle').addEventListener('click', toggleSidebar);
    $('#overlay').addEventListener('click', toggleSidebar);
    $('.logo').addEventListener('click', (e) => { e.preventDefault(); navigateTo(state.landing || firstPath()); });
    const expandBtn = $('#expand-all-btn'), collapseBtn = $('#collapse-all-btn');
    if (expandBtn) expandBtn.addEventListener('click', () => setAllFolders(true));
    if (collapseBtn) collapseBtn.addEventListener('click', () => setAllFolders(false));
    const input = $('.search-input');
    input.addEventListener('input', () => { const q = input.value.trim(); if (q.length < 2) { $('.search-results').classList.remove('visible'); return; } showSearchResults(runSearch(q)); });
    input.addEventListener('focus', () => { const q = input.value.trim(); if (q.length >= 2) showSearchResults(runSearch(q)); });
    input.addEventListener('keydown', (e) => {
      const rc = $('.search-results'); if (!rc.classList.contains('visible')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSearchSel(state.searchSel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchSel(state.searchSel - 1); }
      else if (e.key === 'Enter') { const els = searchResultEls(); const el = els[state.searchSel] || els[0]; if (el) { e.preventDefault(); el.click(); } }
    });
    const skip = $('.skip-link'); if (skip) skip.addEventListener('click', (e) => { e.preventDefault(); const m = $('#content'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } });
    document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a && (e.metaKey || e.ctrlKey || e.shiftKey)) e.stopPropagation(); }, true);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); }
      if (e.key === 'Escape') closeSearch();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-container')) $('.search-results').classList.remove('visible'); });
    window.addEventListener('hashchange', onRoute);
  }
  function firstPath() { return state.orderedPaths[0] || [...state.docs.keys()][0]; }
  function onRoute() {
    const hash = window.location.hash.slice(1); if (!hash) { navigateTo(state.landing || firstPath()); return; }
    const path = hash.split('#')[0];
    if (path !== state.currentPath && state.docs.has(path)) navigateTo(path);
    else if (path === state.currentPath) { const ai = hash.indexOf('#'); if (ai > 0) { const el = document.getElementById(decodeURIComponent(hash.slice(ai + 1))); if (el) { expandToTarget(el); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } }
  }

  function showNotice() {
    $('#document').innerHTML = `<div class="notice"><h2>Local server required</h2><p>This viewer loads content with <code>fetch()</code>, which browsers block on <code>file://</code>. Serve the folder over HTTP, e.g.:</p><pre><code>python -m http.server 8080</code></pre><p>then open <code>http://localhost:8080/</code>.</p></div>`;
  }

  /* ==========================================================
     BOOTSTRAP
     ========================================================== */
  async function main() {
    await loadConfig();
    initTheme();
    bindEvents();
    initSidebarResize();
    initBackToTop();
    const ok = await discover();
    if (!ok) { if (location.protocol === 'file:') showNotice(); else $('#document').innerHTML = '<div class="empty-state"><h2>No content found</h2><p>Add a docs-manifest.json or a README.md.</p></div>'; return; }
    buildFileTree();
    renderNav();
    buildSearchIndex();
    onRoute();
    if (!state.currentPath) navigateTo(state.landing || firstPath());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();

