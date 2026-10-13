#!/usr/bin/env node
/**
 * The performance benchmark for edit mode and the site (documentation/engineering/performance.md).
 *
 *   npm run perf:bench -- [--suite editor|site|all] [--runs 5] [--build] [--reuse] [--cpu 4]
 *                         [--compare perf/baseline.json] [--check] [--save-baseline]
 *
 * editor: its own dev server on the editor's fixture (scripts/editor-test-server.mjs, port 4330: a git copy
 *   of content/ with a bare remote, so the real content is never written). It measures the server's start,
 *   its first-start warm-up (first-ready), and each screen's first load after it (cold), then every screen
 *   warm, the editing interactions (select, type and save, a field, the picker, a new block, undo, a move and
 *   a delete shown at once, the media details, another tab hearing a save, and the first visible sign of each:
 *   feedback-shown), and the API's slow calls. Each step also reads the dev server's own record of where its time went
 *   (integrations/perf.mjs: GET /_edit/api/perf), so a number comes with its causes. --cpu slows the
 *   editor's pages (×4: a laptop, report R15); those metrics are kept apart as editor-cpu4/….
 * site: the production build (npm run build, with --build or when dist/ is missing) on `astro preview`
 *   (port 4332), each page in a fresh browser (empty cache), on a desktop and on a throttled phone profile
 *   (CPU ×4, 10 Mbps, 40 ms): TTFB, FCP, LCP, CLS, TBT, load, requests and bytes by type.
 *
 * Every metric is a median (with p75, min, max) over --runs. The run is written to perf/runs/<stamp>.json
 * (not committed); --save-baseline also writes perf/baseline.json (committed: the reference). --compare
 * prints the change against a saved run, and --check fails (exit 1) when a metric is worse than the
 * baseline beyond its noise allowance (perf/budgets.json holds the allowances and the targets).
 */
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, release, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
};
const flag = (name) => args.includes(`--${name}`);
const SUITE = arg('suite', 'all');
const RUNS = Math.max(1, Number(arg('runs', 5)));
const EDITOR_PORT = 4330;
const SITE_PORT = 4332;
const EDITOR = `http://localhost:${EDITOR_PORT}`;
const SITE = `http://localhost:${SITE_PORT}`;
const BUDGETS = JSON.parse(readFileSync(join(ROOT, 'perf/budgets.json'), 'utf8'));
/** A CPU slowdown for the editor's pages (--cpu 4: a laptop, report R15); its metrics are kept apart (editor-cpu4/…). */
const CPU = Math.max(1, Number(arg('cpu', 1)) || 1);

// ---------- numbers ----------
const results = {};
const server = {};
/** Adds one sample of a metric (ms unless the name says otherwise). */
const sample = (key, value, unit = 'ms') => {
  if (!Number.isFinite(value)) return;
  if (CPU > 1) key = key.replace(/^editor\//, `editor-cpu${CPU}/`);
  (results[key] ??= { unit, values: [] }).values.push(Math.round(value * 10) / 10);
};
const stats = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
  return { median: at(0.5), p75: at(0.75), min: s[0], max: s[s.length - 1], n: s.length };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(`[perf] ${m.join(' ')}`);

// ---------- servers ----------
const listening = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500;
  } catch {
    return false;
  }
};
const waitFor = async (url, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await listening(url)) return true;
    await sleep(250);
  }
  return false;
};
const started = [];
function startServer(cmd, cmdArgs, env = {}) {
  const child = spawn(cmd, cmdArgs, { cwd: ROOT, shell: process.platform === 'win32', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  started.push(child);
  return child;
}
function stopServers() {
  for (const c of started) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else c.kill();
    } catch {
      // already gone
    }
  }
}
process.on('exit', stopServers);
process.on('SIGINT', () => process.exit(130));

/** The dev server's own record since `since`: totals by kind, and the named spans summed. */
async function serverSince(since) {
  const r = await (await fetch(`${EDITOR}/_edit/api/perf?since=${since}`)).json();
  const out = { requests: r.requests.length, byKind: {}, spans: {} };
  for (const q of r.requests) {
    const k = (out.byKind[q.kind] ??= { count: 0, ms: 0, max: 0 });
    k.count++;
    k.ms += q.total;
    k.max = Math.max(k.max, q.total);
    for (const [name, s] of Object.entries(q.spans ?? {})) {
      const t = (out.spans[name] ??= { count: 0, ms: 0 });
      t.count += s.count;
      t.ms += s.ms;
    }
  }
  return out;
}
const keepServer = (key, s) => (server[key] ??= []).push(s);
const recordServer = (key, s) => {
  keepServer(key, s);
  for (const [kind, v] of Object.entries(s.byKind)) {
    sample(`${key}/server/${kind}-requests`, v.count, 'count');
    sample(`${key}/server/${kind}-ms`, v.ms);
  }
  // the causes, tracked as metrics too: summed span time (parallel work can sum past the wall clock), and git's process count
  for (const [name, v] of Object.entries(s.spans)) sample(`${key}/span/${name}`, v.ms);
  sample(`${key}/span/git-processes`, s.spans.git?.count ?? 0, 'count');
};

// ---------- in the page ----------
/** Installed in every frame before its scripts: paints, layout shifts, long tasks, and the last input. */
function collector() {
  const w = window;
  w.__perf = { lcp: 0, cls: 0, long: [] };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__perf.lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (w.__perf.cls += e.value))).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__perf.long.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
  } catch {
    // an older engine: the rest still counts
  }
  // when the person last pressed or typed, as an epoch time any frame can compare (the canvas is a frame)
  const mark = (e) => {
    try {
      window.top.__lastInput = performance.timeOrigin + e.timeStamp;
    } catch {
      // not ours
    }
  };
  addEventListener('pointerdown', mark, true);
  addEventListener('keydown', mark, true);
}

/** The page's load, as the browser saw it, up to `readyAt` (ms from its start). */
async function pageMetrics(page, readyAt) {
  return page.evaluate((ready) => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN;
    const res = performance.getEntriesByType('resource');
    const by = { script: 0, css: 0, img: 0, font: 0, other: 0 };
    let modules = 0;
    for (const r of res) {
      const name = r.name.split('?')[0];
      const type = /\.(m?js|ts|tsx|jsx|astro)$|\/@vite\/|\/@id\/|\/@fs\/.*\.(m?js|ts)$|\/node_modules\//.test(name) || r.initiatorType === 'script' ? 'script' : /\.css$/.test(name) || r.initiatorType === 'css' && !/\.(woff2?|webp|png|jpe?g|svg|avif|gif)$/.test(name) ? 'css' : /\.(woff2?)$/.test(name) ? 'font' : r.initiatorType === 'img' || /\/_image|\.(webp|png|jpe?g|svg|avif|gif)$/.test(name) ? 'img' : 'other';
      if (type === 'script') modules++;
      by[type] += r.transferSize || r.encodedBodySize || 0;
    }
    const end = Number.isFinite(ready) ? ready : (nav?.loadEventEnd ?? 0) + 1000;
    const tbt = window.__perf.long.filter(([s]) => s >= (fcp || 0) && s <= end).reduce((n, [, d]) => n + Math.max(0, d - 50), 0);
    return {
      ttfb: nav ? nav.responseStart - nav.startTime : NaN,
      html: nav ? nav.responseEnd - nav.startTime : NaN,
      htmlKB: nav ? (nav.transferSize || nav.encodedBodySize) / 1024 : NaN,
      dcl: nav ? nav.domContentLoadedEventEnd : NaN,
      load: nav ? nav.loadEventEnd : NaN,
      fcp,
      lcp: window.__perf.lcp || NaN,
      cls: window.__perf.cls,
      tbt,
      longTasks: window.__perf.long.length,
      requests: res.length + 1,
      scripts: modules,
      kb: { script: by.script / 1024, css: by.css / 1024, img: by.img / 1024, font: by.font / 1024, other: by.other / 1024 },
      dom: document.getElementsByTagName('*').length,
    };
  }, readyAt);
}

const record = (key, m) => {
  for (const k of ['ttfb', 'html', 'dcl', 'load', 'fcp', 'lcp', 'tbt']) sample(`${key}/${k}`, m[k]);
  sample(`${key}/cls`, m.cls, 'score');
  sample(`${key}/requests`, m.requests, 'count');
  sample(`${key}/scripts`, m.scripts, 'count');
  sample(`${key}/html-kb`, m.htmlKB, 'KB');
  sample(`${key}/dom-nodes`, m.dom, 'count');
  for (const [t, kb] of Object.entries(m.kb)) sample(`${key}/${t}-kb`, kb, 'KB');
};

/** Waits for `predicate` in the page and returns when it held, in ms from the page's start. */
const readyAt = (page, predicate, arg, timeout = 120_000) => page.waitForFunction(predicate, arg, { timeout, polling: 25 }).then(() => page.evaluate(() => performance.now()));

// ---------- the content measured ----------
function inventory(contentDir) {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const files = walk(contentDir);
  const media = files.filter((f) => /[\\/]media[\\/]/.test(f) && /\.(webp|jpe?g|png|avif|gif|mp4|webm)$/i.test(f));
  return {
    articles: files.filter((f) => /[\\/]articles[\\/][^\\/]+\.json$/.test(f)).length,
    jsonDocuments: files.filter((f) => f.endsWith('.json')).length,
    mediaFiles: media.length,
    mediaMB: Math.round((media.reduce((n, f) => n + statSync(f).size, 0) / 1048576) * 10) / 10,
  };
}

/** Published articles' addresses (/<section>/<slug>/), with how many pictures each holds. */
function articlePages() {
  const structure = JSON.parse(readFileSync(join(ROOT, 'content/structures/site.json'), 'utf8'));
  const out = [];
  for (const section of structure.home.children ?? []) {
    for (const child of section.children ?? []) {
      if (child.kind !== 'item') continue;
      const file = join(ROOT, 'content/articles', `${child.item.id}.json`);
      if (!existsSync(file)) continue;
      const a = JSON.parse(readFileSync(file, 'utf8'));
      if (!['published', 'stale'].includes(a.status)) continue;
      const pictures = JSON.stringify(a.body).match(/"media":/g)?.length ?? 0;
      out.push({ id: a.id, path: `/${section.slug}/${a.slug}/`, section: `/${section.slug}/`, pictures, blocks: a.body.length });
    }
  }
  return out;
}

// ---------- the editor ----------
/** The article the interactions edit (the editor's E2E fixture article, and the largest one: 44 blocks, 14 pictures). */
const ARTICLE = 'do-what-makes-you-proud';
/** A typical article (19 blocks, 5 pictures) for the screens; the largest is measured as article-large. */
const TYPICAL = 'atiya';
const SCREENS = [
  ['dashboard', '/_edit/'],
  ['articles', '/_edit/articles/'],
  ['article', null],
  ['article-large', null],
  ['sections', '/_edit/sections/'],
  ['navigation', '/_edit/navigation/'],
  ['planet', '/_edit/planet/'],
  ['media', '/_edit/media/'],
  ['settings', '/_edit/settings/'],
  ['access', '/_edit/access/'],
  ['publish', '/_edit/publish/'],
  ['site-article', null],
];

/** A screen is ready when its app is drawn and, for an article, its canvas takes edits; a site page at load. */
const screenReady = (name) =>
  name === 'article' || name === 'article-large'
    ? () => !!document.querySelector('[data-editor-frame]')?.contentDocument?.querySelector('[data-editor-editable]')
    : name === 'site-article'
      ? () => document.readyState === 'complete'
      : () => document.readyState !== 'loading' && !!document.querySelector('[data-editor-app]');

async function measureScreen(context, key, url, name) {
  const page = await context.newPage();
  page.on('pageerror', (e) => log(`${key}: page error: ${e.message}`));
  const since = Date.now();
  await page.goto(`${EDITOR}${url}`, { waitUntil: 'commit', timeout: 180_000 });
  const ready = await readyAt(page, screenReady(name));
  await page.waitForLoadState('load', { timeout: 180_000 }).catch(() => {});
  // the pictures in view settle: what a person waits for in Media and the picker
  const settled = await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
          })
          .every((i) => i.complete),
      null,
      { timeout: 60_000, polling: 250 },
    )
    .then(() => page.evaluate(() => performance.now()))
    .catch(() => NaN);
  await sleep(500);
  const m = await pageMetrics(page, ready);
  record(key, m);
  sample(`${key}/ready`, ready);
  sample(`${key}/images-settled`, settled);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable').catch(() => {});
  const { metrics } = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
  const metric = (n) => metrics.find((x) => x.name === n)?.value;
  sample(`${key}/js-heap-mb`, (metric('JSHeapUsedSize') ?? NaN) / 1048576, 'MB');
  recordServer(key, await serverSince(since));
  await page.close();
}

/** Counts a page's `editor:*` measures, and waits for one more of `name`, returning its entry. */
const measures = (page, name) => page.evaluate((n) => performance.getEntriesByName(n, 'measure').map((e) => ({ start: e.startTime, duration: e.duration, end: e.startTime + e.duration, detail: e.detail, origin: performance.timeOrigin })), name);
async function nextMeasure(page, name, before, timeout = 60_000) {
  await page.waitForFunction(([n, c]) => performance.getEntriesByName(n, 'measure').length > c, [name, before], { timeout, polling: 50 });
  const all = await measures(page, name);
  return all[all.length - 1];
}
const lastInput = (page) => page.evaluate(() => window.__lastInput ?? NaN);
/** The next swap that draws a region the person sees (not the counts' background check), or null within `timeout`. */
async function nextDrawn(page, before, timeout) {
  for (const end = Date.now() + timeout; Date.now() < end; await sleep(100)) {
    const s = (await measures(page, 'editor:swap')).slice(before).find((e) => e.detail?.regions?.length);
    if (s) return s;
  }
  return null;
}

/** A browser context for the editor's pages: the collector in every frame, and the CPU slowdown when asked. */
async function editorContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(collector);
  if (CPU > 1)
    context.on('page', (p) => {
      void context.newCDPSession(p).then((cdp) => cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })).catch(() => {});
    });
  return context;
}

/**
 * When something first shows (spec §3.6 and §2.2: from the click to the outline and the canvas both
 * showing it, or to the first visible sign): polls `check` in the page every frame, started before the
 * click; returns the time (epoch ms) it first held, or NaN.
 */
function shownWhen(page, check, timeout = 15_000) {
  return page
    .evaluate(
      ([src, ms]) =>
        new Promise((resolve) => {
          const fn = new Function(`return (${src})()`);
          const end = performance.now() + ms;
          const tick = () => {
            let ok = false;
            try {
              ok = !!fn();
            } catch {
              ok = false;
            }
            if (ok) resolve(performance.timeOrigin + performance.now());
            else if (performance.now() > end) resolve(NaN);
            else requestAnimationFrame(tick);
          };
          tick();
        }),
      [check.toString(), timeout],
    )
    .catch(() => NaN);
}
/** In the editor's page: the canvas's blocks' words, in order, and the outline's rows' names. */
const VIEWS = () => {
  const doc = document.querySelector('[data-editor-frame]')?.contentDocument;
  const prose = doc?.querySelector('.prose');
  const canvas = [];
  let mark = false;
  for (const n of prose ? [...prose.childNodes] : []) {
    if (n.nodeType === 8 && /^editor-block:\d+$/.test(n.data.trim())) mark = true;
    else if (n.nodeType === 1 && mark) {
      canvas.push((n.textContent ?? '').trim().slice(0, 40));
      mark = false;
    }
  }
  const outline = [...document.querySelectorAll('[data-editor-outline] [data-editor-rows] > [data-row] [data-editor-select]')].map((b) => b.getAttribute('aria-label'));
  return { canvas, outline };
};

async function editorInteractions(browser, run, reset) {
  reset();
  await sleep(1500);
  const context = await editorContext(browser);
  const page = await context.newPage();
  await page.goto(`${EDITOR}/_edit/articles/${ARTICLE}/`, { timeout: 180_000 });
  await readyAt(page, screenReady('article'));
  await sleep(800);
  const canvas = page.frameLocator('[data-editor-frame]');

  // 1. select a block in the outline: its settings show in the inspector
  {
    const at = 1;
    const t = Date.now();
    await page.locator(`[data-editor-outline] [data-editor-select="${at}"]`).click();
    await page.locator(`[data-block-form="${at}"]`).waitFor({ state: 'visible' });
    const done = await page.evaluate(() => performance.timeOrigin + performance.now());
    sample('editor/interaction/select-block', done - (await lastInput(page)) || Date.now() - t);
  }

  // 2. type in the canvas: the words are saved (the canvas sends them after a pause in typing)
  {
    const since = Date.now();
    const saves = (await measures(page, 'editor:save')).length;
    const swaps = (await measures(page, 'editor:swap')).length;
    await canvas.locator('.prose > p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' x');
    const typedAt = await lastInput(page);
    const save = await nextMeasure(page, 'editor:save', saves);
    sample('editor/interaction/type-to-saved', save.origin + save.end - typedAt);
    sample('editor/interaction/save-round-trip', save.duration);
    const swap = await nextDrawn(page, swaps, 3000);
    if (swap) {
      sample('editor/interaction/type-swap', swap.duration);
      sample('editor/interaction/type-swap-kb', swap.detail.bytes / 1024, 'KB');
      sample('editor/interaction/type-to-settled', swap.origin + swap.end - typedAt);
    } else {
      // words alone redraw nothing (spec §3.6): typing has settled once it's saved
      sample('editor/interaction/type-swap-kb', 0, 'KB');
      sample('editor/interaction/type-to-settled', save.origin + save.end - typedAt);
    }
    // the canvas stops being edited (the Page tab takes the focus): its final words are sent and saved
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    await sleep(2500);
    recordServer('editor/interaction/type', await serverSince(since));
  }

  // 3. a field in the inspector: the page's summary, changed and saved
  {
    const since = Date.now();
    await page.getByRole('tab', { name: 'Page', exact: true }).click();
    const field = page.locator('#page-summary');
    await field.waitFor({ state: 'visible' });
    await sleep(300);
    const saves = (await measures(page, 'editor:save')).length;
    const canvases = (await measures(page, 'editor:canvas')).length;
    await field.focus();
    await page.keyboard.press('End');
    await page.keyboard.type('.');
    await page.keyboard.press('Tab');
    const changedAt = await lastInput(page);
    const save = await nextMeasure(page, 'editor:save', saves);
    sample('editor/interaction/field-to-saved', save.origin + save.end - changedAt);
    const redraw = await nextMeasure(page, 'editor:canvas', canvases, 30_000).catch(() => null);
    if (redraw) sample('editor/interaction/field-canvas-redraw', redraw.duration);
    if (redraw) sample('editor/interaction/field-to-canvas', redraw.origin + redraw.end - changedAt);
    await sleep(1500);
    recordServer('editor/interaction/field', await serverSince(since));
  }

  // 4. the media picker: open it from the thumbnail's field, and its pictures in view
  {
    await page.locator('[data-editor-pick="thumbnail"]').click();
    const openedAt = await lastInput(page);
    const dialog = page.locator('#editor-picker');
    await dialog.waitFor({ state: 'visible' });
    const shown = await page.evaluate(() => performance.timeOrigin + performance.now());
    sample('editor/interaction/picker-open', shown - openedAt);
    const settled = await page
      .waitForFunction(() => { const shown = [...document.querySelectorAll('#editor-picker [data-editor-media] img')].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; }); return shown.length > 0 && shown.every((i) => i.complete); }, null, { timeout: 60_000, polling: 100 })
      .then(() => page.evaluate(() => performance.timeOrigin + performance.now()))
      .catch(() => NaN);
    sample('editor/interaction/picker-images', settled - openedAt);
    // every card, once the last page has landed (the picker fills a page at a time)
    await page.waitForFunction(() => !document.querySelector('#editor-picker [data-media-preparing], #editor-picker [data-picker-pending]'), null, { timeout: 60_000, polling: 100 }).catch(() => {});
    sample('editor/interaction/picker-filled', (await page.evaluate(() => performance.timeOrigin + performance.now())) - openedAt);
    sample('editor/interaction/picker-cards', await dialog.locator('[data-editor-media]').count(), 'count');
    await page.keyboard.press('Escape');
  }

  // 5. a new paragraph from the palette: added, saved and on the canvas
  {
    const since = Date.now();
    const saves = (await measures(page, 'editor:save')).length;
    const canvases = (await measures(page, 'editor:canvas')).length;
    const add = page.locator('[data-editor-outline] [data-editor-add-at]').first();
    if (await add.count()) {
      await add.click();
      const palette = page.locator('#editor-palette');
      await palette.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      const paragraph = palette.locator('[data-editor-add="divider"]');
      if (await paragraph.count()) {
        const rows = (await page.evaluate(VIEWS)).outline.length;
        const shown = shownWhen(page, new Function(`const v = (${VIEWS.toString()})(); return v.outline.length === ${rows + 1} && v.canvas.length === ${rows + 1};`));
        await paragraph.click();
        const at = await lastInput(page);
        const seen = await shown;
        sample('editor/interaction/add-block-shown', seen - at);
        sample('editor/interaction/feedback-shown', seen - at);
        const save = await nextMeasure(page, 'editor:save', saves).catch(() => null);
        if (save) sample('editor/interaction/add-block-to-saved', save.origin + save.end - at);
        const redraw = await nextMeasure(page, 'editor:canvas', canvases, 30_000).catch(() => null);
        if (redraw) sample('editor/interaction/add-block-to-canvas', redraw.origin + redraw.end - at);
      } else await page.keyboard.press('Escape');
    }
    await sleep(1000);
    recordServer('editor/interaction/add-block', await serverSince(since));
  }

  // 6. undo: the last change taken back and saved
  {
    const saves = (await measures(page, 'editor:save')).length;
    await page.locator('[data-editor-undo]').click();
    const at = await lastInput(page);
    const save = await nextMeasure(page, 'editor:save', saves).catch(() => null);
    if (save) sample('editor/interaction/undo-to-saved', save.origin + save.end - at);
    await sleep(1500);
  }

  // 7. a move and a delete, shown at once (spec §3.6): from the click to the outline and the canvas both showing it
  {
    await sleep(2500);
    const before = await page.evaluate(VIEWS);
    if (before.outline.length >= 3 && before.canvas.length === before.outline.length) {
      const [a, b] = before.outline.slice(1, 3);
      const [ca, cb] = before.canvas.slice(1, 3);
      const moved = shownWhen(page, new Function(`const v = (${VIEWS.toString()})(); return v.outline[1] === ${JSON.stringify(b)} && v.outline[2] === ${JSON.stringify(a)} && v.canvas[1] === ${JSON.stringify(cb)} && v.canvas[2] === ${JSON.stringify(ca)};`));
      await page.locator('[data-editor-outline] [data-editor-select="1"]').click();
      await page.locator('[data-editor-outline] [data-editor-move="down"][data-index="1"]').click();
      const at = await lastInput(page);
      const seen = await moved;
      sample('editor/interaction/move-shown', seen - at);
      sample('editor/interaction/feedback-shown', seen - at);
      await sleep(2500);
      const n = (await page.evaluate(VIEWS)).outline.length;
      const gone = shownWhen(page, new Function(`const v = (${VIEWS.toString()})(); return v.outline.length === ${n - 1} && v.canvas.length === ${n - 1};`));
      await page.locator('[data-editor-outline] [data-editor-select="2"]').click();
      await page.keyboard.press('Delete');
      const del = await lastInput(page);
      const gotIt = await gone;
      sample('editor/interaction/delete-shown', gotIt - del);
      sample('editor/interaction/feedback-shown', gotIt - del);
      await sleep(2500);
    }
  }
  await page.close();

  // 7. another tab on the articles list hears a save made here, and draws it again
  {
    const list = await context.newPage();
    await list.goto(`${EDITOR}/_edit/articles/`, { timeout: 120_000 });
    await list.waitForFunction(() => !!document.querySelector('[data-editor-app]'));
    const editor = await context.newPage();
    await editor.goto(`${EDITOR}/_edit/articles/${ARTICLE}/`, { timeout: 120_000 });
    await readyAt(editor, screenReady('article'));
    await sleep(1000);
    const swaps = (await measures(list, 'editor:swap')).length;
    const saves = (await measures(editor, 'editor:save')).length;
    await editor.getByRole('tab', { name: 'Page', exact: true }).click();
    await editor.locator('#page-summary').waitFor({ state: 'visible' });
    await editor.locator('#page-summary').focus();
    await editor.keyboard.press('End');
    await editor.keyboard.type('!');
    await editor.keyboard.press('Tab');
    const save = await nextMeasure(editor, 'editor:save', saves);
    const heard = await nextMeasure(list, 'editor:swap', swaps, 30_000).catch(() => null);
    if (heard) {
      sample('editor/interaction/other-tab-updated', heard.origin + heard.end - (save.origin + save.end));
      sample('editor/interaction/other-tab-swap', heard.duration);
      sample('editor/interaction/other-tab-swap-kb', heard.detail.bytes / 1024, 'KB');
    }
    await list.close();
    await editor.close();
  }

  // 8. the media library: a picture's details opened, and its alt text saved
  {
    const page2 = await context.newPage();
    await page2.goto(`${EDITOR}/_edit/media/`, { timeout: 180_000 });
    await page2.waitForFunction(() => !!document.querySelector('[data-editor-media]'));
    await sleep(800);
    const card = page2.locator('[data-editor-media]').nth(3);
    const id = await card.getAttribute('data-editor-media');
    const since = Date.now();
    const current = shownWhen(page2, new Function(`return document.querySelector('[data-editor-media="${id}"]')?.getAttribute('aria-current') === 'true';`));
    await card.click();
    const at = await lastInput(page2);
    sample('editor/interaction/feedback-shown', (await current) - at);
    await page2.waitForFunction((want) => document.querySelector('[data-editor-media-details] [data-editor-media-form]') && document.querySelector(`[data-editor-media="${CSS.escape(want)}"]`)?.getAttribute('aria-current') === 'true', id, { timeout: 60_000 });
    sample('editor/interaction/media-details', (await page2.evaluate(() => performance.timeOrigin + performance.now())) - at);
    recordServer('editor/interaction/media-details', await serverSince(since));
    const saves = (await measures(page2, 'editor:save')).length;
    const alt = page2.locator('[data-editor-media-form] textarea[name="alt"]');
    await alt.focus();
    await page2.keyboard.press('End');
    await page2.keyboard.type(' ');
    await page2.getByRole('button', { name: 'Save the details' }).click();
    const clicked = await lastInput(page2);
    const save = await nextMeasure(page2, 'editor:save', saves, 60_000).catch(() => null);
    if (save) sample('editor/interaction/media-save', save.origin + save.end - clicked);
    else {
      await page2.locator('[data-editor-status]').filter({ hasText: /^Saved/ }).waitFor({ timeout: 60_000 }).catch(() => {});
      sample('editor/interaction/media-save', (await page2.evaluate(() => performance.timeOrigin + performance.now())) - clicked);
    }
    await page2.close();
  }
  await context.close();
  log(`editor interactions, run ${run + 1} of ${RUNS}`);
}

async function editorApi() {
  for (const [name, path] of [
    ['changes', 'changes'],
    ['where', 'where?path=/'],
  ]) {
    for (let i = 0; i < RUNS; i++) {
      const t = performance.now();
      const r = await fetch(`${EDITOR}/_edit/api/${path}`);
      await r.arrayBuffer();
      sample(`editor/api/${name}`, performance.now() - t);
    }
  }
}

async function editorSuite(browser) {
  const { prepare, reset, FIXTURE, PRIVATE } = await import('./editor-test-server.mjs');
  const reuse = flag('reuse') && (await listening(`${EDITOR}/_edit/`));
  if (!reuse) {
    if (await listening(`${EDITOR}/_edit/`)) throw new Error(`port ${EDITOR_PORT} is in use (an editor test server?): stop it, or pass --reuse to measure it warm only`);
    // the fixture (a copy of content/ in a fresh repository) is the benchmark's set-up, not the editor's: timed apart
    let t = performance.now();
    prepare();
    sample('editor/fixture-prepare', performance.now() - t);
    // the dev server's own start, as `npm run dev` makes it (its dependency cache already built)
    t = performance.now();
    startServer('npx', ['astro', 'dev', '--port', String(EDITOR_PORT), '--ignore-lock'], { CONTENT_ROOT: join(FIXTURE, 'content'), PRIVATE_ROOT: PRIVATE, SITE_VITE_CACHE: join(ROOT, 'node_modules', '.vite-editor-test'), SITE_STRICT_PORT: '1' });
    if (!(await waitFor(`${EDITOR}/_edit/api/perf`, 180_000))) throw new Error('the editor dev server did not start');
    sample('editor/server-start', performance.now() - t);
    // the first start's warm-up (report R12): the screens compiled and the pictures' facts read, until edit mode is ready
    for (let end = Date.now() + 300_000; Date.now() < end; await sleep(250)) {
      const w = await fetch(`${EDITOR}/_edit/__warm`).then((r) => r.json()).catch(() => null);
      if (w && !w.running && w.done) break;
    }
    sample('editor/first-ready', performance.now() - t);
    log('editor server up');
  }
  const pages = articlePages();
  const large = [...pages].sort((a, b) => b.pictures - a.pictures || b.blocks - a.blocks)[0];
  const typical = pages.find((p) => p.id === TYPICAL) ?? pages[0];
  const screens = SCREENS.map(([name, url]) => [name, url ?? (name === 'article' ? `/_edit/articles/${typical.id}/` : name === 'article-large' ? `/_edit/articles/${large.id}/` : typical.path)]);

  // cold: each screen's first load on a server that has just started (its modules, pictures and git)
  if (!reuse) {
    const context = await editorContext(browser);
    for (const [name, url] of screens) {
      await measureScreen(context, `editor/cold/${name}`, url, name);
      log(`cold ${name}`);
    }
    await context.close();
  }

  // warm: a browser that has been here before, a server that has drawn each screen
  const only = arg('only', '');
  if (!only || only === 'screens') {
    const context = await editorContext(browser);
    for (const [name, url] of screens) {
      for (let i = 0; i < RUNS; i++) await measureScreen(context, `editor/warm/${name}`, url, name);
      log(`warm ${name}`);
    }
    await context.close();
  }
  if (!only || only === 'api') await editorApi();
  if (!only || only === 'interactions') for (let i = 0; i < RUNS; i++) await editorInteractions(browser, i, reset);
  reset();
  return { article: ARTICLE, typicalArticle: typical.id, largeArticle: large.id, sitePage: typical.path };
}

// ---------- the site ----------
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 }, cpu: 1, net: null },
  phone: { viewport: { width: 390, height: 844 }, cpu: 4, net: { mbps: 10, latency: 40 }, mobile: true },
};

async function siteSuite(browser) {
  if (flag('build') || !existsSync(join(ROOT, 'dist/index.html'))) {
    log('building the site (npm run build)');
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  }
  if (await listening(SITE)) throw new Error(`port ${SITE_PORT} is in use: stop what is serving it`);
  startServer('npx', ['astro', 'preview', '--port', String(SITE_PORT)]);
  if (!(await waitFor(SITE, 60_000))) throw new Error('astro preview did not start');
  const pages = articlePages();
  const largest = [...pages].sort((a, b) => b.pictures - a.pictures || b.blocks - a.blocks)[0];
  const typical = pages.find((p) => p.id === TYPICAL) ?? pages[0];
  const PAGES = [
    ['home', '/'],
    ['section', typical.section],
    ['article', typical.path],
    ['article-large', largest.path],
    ['design-library', '/design/'],
    ['play-first-paint', '/play/'],
  ];
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    for (const [name, path] of PAGES) {
      for (let i = 0; i < RUNS; i++) {
        const context = await browser.newContext({ viewport: profile.viewport, isMobile: !!profile.mobile, hasTouch: !!profile.mobile });
        await context.addInitScript(collector);
        // the planet: only its page and first paint here (npm run perf:audit measures the game)
        await context.addInitScript(() => localStorage.setItem('site.onboardingSeen', '1'));
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
        if (profile.net) {
          await cdp.send('Network.enable');
          const bps = (profile.net.mbps * 1e6) / 8;
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.net.latency, downloadThroughput: bps, uploadThroughput: bps });
        }
        await page.goto(`${SITE}${path}`, { waitUntil: 'load', timeout: 120_000 });
        await sleep(name === 'play-first-paint' ? 500 : 1500);
        const m = await pageMetrics(page, NaN);
        record(`site/${profileName}/${name}`, m);
        await context.close();
      }
      log(`site ${profileName} ${name}`);
    }
  }
  return { pages: Object.fromEntries(PAGES) };
}

// ---------- the report ----------
function machine() {
  let chrome = '';
  return {
    cpu: cpus()[0]?.model.trim(),
    threads: cpus().length,
    memoryGB: Math.round(totalmem() / 1073741824),
    os: `${platform()} ${release()}`,
    node: process.version,
    chrome,
  };
}
const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

/** A metric that got worse beyond the noise allowed for its unit (perf/budgets.json `noise`). */
function regressed(key, now, then) {
  const unit = results[key]?.unit ?? 'ms';
  const noise = BUDGETS.noise[unit] ?? BUDGETS.noise.ms;
  return now > then * (1 + noise.ratio) && now - then > noise.absolute;
}

function compare(file) {
  const base = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  const rows = [];
  let worse = 0;
  for (const [key, r] of Object.entries(results)) {
    const b = base.metrics?.[key];
    if (!b) continue;
    const now = stats(r.values).median;
    const delta = b.median ? ((now - b.median) / b.median) * 100 : 0;
    const bad = regressed(key, now, b.median);
    if (bad) worse++;
    rows.push(`| ${key} | ${b.median} | ${now} | ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% | ${bad ? 'worse' : ''} |`);
  }
  console.log(`\nAgainst ${file} (${base.meta?.date ?? ''}, ${base.meta?.commit ?? ''}):\n\n| Metric | Then | Now | Change | |\n|---|---|---|---|---|\n${rows.join('\n')}\n`);
  return worse;
}

function targets() {
  const rows = [];
  for (const [key, t] of Object.entries(BUDGETS.targets)) {
    const r = results[key];
    if (!r) continue;
    const now = stats(r.values).median;
    rows.push(`| ${key} | ${now} ${r.unit} | ${t.max} ${r.unit} | ${now <= t.max ? 'met' : 'not yet'} |`);
  }
  if (rows.length) console.log(`\nTargets (perf/budgets.json):\n\n| Metric | Now | Target | |\n|---|---|---|---|\n${rows.join('\n')}\n`);
}

async function main() {
  const browser = await chromium.launch();
  const meta = {
    date: new Date().toISOString(),
    commit: git('rev-parse', '--short', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=no').length > 0,
    suite: SUITE,
    runs: RUNS,
    cpu: CPU,
    machine: { ...machine(), chrome: browser.version() },
    content: inventory(join(ROOT, 'content')),
  };
  try {
    if (SUITE === 'editor' || SUITE === 'all') meta.editor = await editorSuite(browser);
    if (SUITE === 'site' || SUITE === 'all') {
      stopServers();
      started.length = 0;
      meta.site = await siteSuite(browser);
    }
  } finally {
    await browser.close();
    stopServers();
  }
  const metrics = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { unit: r.unit, ...stats(r.values) }]));
  const serverSummary = Object.fromEntries(
    Object.entries(server).map(([k, runs]) => {
      const spans = {};
      for (const s of runs) for (const [n, v] of Object.entries(s.spans)) (spans[n] ??= []).push(v.ms);
      return [k, Object.fromEntries(Object.entries(spans).map(([n, v]) => [n, stats(v).median]))];
    }),
  );
  const out = { meta, metrics, serverSpans: serverSummary };
  const stamp = meta.date.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  mkdirSync(join(ROOT, 'perf/runs'), { recursive: true });
  const file = join(ROOT, 'perf/runs', `${stamp}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  if (flag('save-baseline')) writeFileSync(join(ROOT, 'perf/baseline.json'), JSON.stringify(out, null, 2));
  console.log(`\n| Metric | Median | p75 | Min | Max | n |\n|---|---|---|---|---|---|\n${Object.entries(metrics).map(([k, m]) => `| ${k} | ${m.median} ${m.unit} | ${m.p75} | ${m.min} | ${m.max} | ${m.n} |`).join('\n')}\n`);
  targets();
  log(`written: ${file}${flag('save-baseline') ? ' and perf/baseline.json' : ''}`);
  const against = arg('compare', null);
  if (against) {
    const worse = compare(against);
    if (flag('check') && worse) {
      log(`${worse} metric(s) worse than ${against}`);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  stopServers();
  process.exit(1);
});
