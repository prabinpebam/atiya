// Performance audit (see documentation/poc-3d-navigation/performance-audit.md).
//
//   npm run dev            (or: npm run build:test && npx astro preview)
//   npm run perf:audit -- [--url http://127.0.0.1:4321/play/?quality=high] [--runs 4] [--cpu 4] [--net fast|slow] [--swiftshader]
//
// --net: a throttled connection (fast: 10 Mbps, 40 ms; slow: 1.6 Mbps, 150 ms). Each run is a new browser, so the
// cache starts empty; it isn't turned off, because the page warms it with the first assets for the game's loaders.
//
// Needs a dev or test build (the `window.__game` hook). Uses the machine's real GPU through ANGLE
// unless --swiftshader is given. Reports, as medians over the runs:
//   - load (progressive-loading.md): first paint (the welcome is on it), time to live (`game:live`: playable),
//     shader warm-up (`game:shaders-compile` → `game:shaders-ready`), time to complete (`game:complete`:
//     every summoned group out), the long tasks (> 50 ms) between live and complete, and the JS heap
//   - steady state at the spawn view: GPU time per frame (EXT_disjoint_timer_query_webgl2, when exposed),
//     JS time per frame, and the scene census from `__game.perfStats()` (draw calls, triangles,
//     vertices, programs, shadow casters, lights, textures)
//   - Inf/NaN pixels in the HDR scene render (4× MSAA, spawn and behind three landmarks): must be 0
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1] ?? true;
};
const url = arg('url', 'http://127.0.0.1:4321/play/?quality=high');
const runs = Number(arg('runs', 4));
const cpu = Number(arg('cpu', 1));
const swift = process.argv.includes('--swiftshader');
const NETS = { fast: { mbps: 10, latency: 40 }, slow: { mbps: 1.6, latency: 150 } };
const net = NETS[arg('net', '')] ?? null;
const args = swift
  ? ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
const median = (a) => {
  const s = a.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

/** GPU timer around every animation frame (summed per frame), plus the JS time of each frame. */
function frameTimer() {
  const orig = window.requestAnimationFrame.bind(window);
  window.__perf = { gpu: {}, js: {}, n: 0 };
  window.requestAnimationFrame = (cb) =>
    orig((t) => {
      const P = window.__perf;
      const gl = window.__game?.__gfx?.()?.gl.getContext();
      const ext = gl && (P.ext ??= gl.getExtension('EXT_disjoint_timer_query_webgl2'));
      let q = null;
      if (ext && !P.active) {
        q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        P.active = true;
      }
      const s = performance.now();
      cb(t);
      P.js[t] = (P.js[t] ?? 0) + performance.now() - s;
      if (!q) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      P.active = false;
      const poll = () => {
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return setTimeout(poll, 5);
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) P.gpu[t] = (P.gpu[t] ?? 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
        P.n++;
        gl.deleteQuery(q);
      };
      setTimeout(poll, 5);
    });
}

async function run() {
  const browser = await chromium.launch({ args });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (net) {
    await cdp.send('Network.enable');
    const bps = (net.mbps * 1e6) / 8;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: bps, uploadThroughput: bps });
  }
  await page.addInitScript(() => localStorage.setItem('site.onboardingSeen', '1'));
  await page.addInitScript(frameTimer);
  await page.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* (no long-task timing in this browser) */
    }
  });
  await page.goto(url);
  const cont = page.getByRole('button', { name: 'Continue anyway' });
  await page.waitForFunction(() => window.__game || document.querySelector('[data-gate-continue]'), null, { timeout: 120_000 });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await page.waitForFunction(() => window.__game && window.__game.getState().phase !== 'loading', null, { timeout: 180_000, polling: 50 });
  const heapMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : NaN));
  await page.waitForFunction(() => window.__game.loadStage?.().tier !== 'live' && window.__game.loadStage?.().tier !== 'loading', null, { timeout: 180_000, polling: 100 });
  const load = await page.evaluate(() => {
    const marks = Object.fromEntries(performance.getEntriesByType('mark').map((m) => [m.name.replace('game:', ''), Math.round(m.startTime)]));
    const fcp = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
    const after = window.__long.filter(([t]) => t >= (marks.live ?? Infinity) && t <= (marks.complete ?? Infinity));
    return {
      ...marks,
      fcp: fcp ? Math.round(fcp.startTime) : NaN,
      longN: after.length,
      longMax: Math.round(Math.max(0, ...after.map(([, d]) => d))),
      longSum: Math.round(after.reduce((s, [, d]) => s + d, 0)),
    };
  });
  load.heapMB = heapMB;
  // (the game starts by itself, with Prabin's welcome: end it)
  if (await page.evaluate(() => Boolean(window.__game.getState().talk))) await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const g = window.__game;
    g.setAdaptiveQuality(false);
    if (g.getState().postLevel !== 2) g.adaptiveStep(1);
    g.setTime(10.5);
    g.setWind(0.2);
  });
  await page.waitForTimeout(4000);
  await page.evaluate(() => Object.assign(window.__perf, { gpu: {}, js: {}, n: 0 }));
  await page.waitForTimeout(swift ? 8000 : 3000);
  const frame = await page.evaluate(() => ({ gpu: Object.values(window.__perf.gpu).filter((v) => v > 0.02), js: Object.values(window.__perf.js) }));
  const stats = await page.evaluate(() => window.__game.perfStats());
  // Inf/NaN pixels in the HDR scene (bloom would smear them into a black screen); only a real GPU shows them
  let nan = 0;
  for (const id of [null, 'town-hall', 'lighthouse', 'library']) {
    if (id) await page.evaluate((i) => window.__game.standBehind(i), id);
    await page.waitForTimeout(300);
    for (let k = 0; k < 3; k++) nan = Math.max(nan, (await page.evaluate(() => window.__game.hdrScan(1280, 4))).bad);
  }
  await browser.close();
  return { load, gpuMs: median(frame.gpu), jsMs: median(frame.js), stats, nan };
}

const results = [];
for (let i = 0; i < runs; i++) results.push(await run());
const m = (f) => median(results.map(f));
const s = results[results.length - 1].stats;
console.log(`perf audit: ${url}  runs ${runs}  cpu ×${cpu}  ${swift ? 'SwiftShader' : 'real GPU'}${net ? `  network ${arg('net', '')}` : ''}`);
console.log(`  first paint (welcome) ${m((r) => r.load.fcp)} ms`);
console.log(`  time to live         ${m((r) => r.load.live)} ms  (shader warm-up ${m((r) => r.load['shaders-ready'] - r.load['shaders-compile'])} ms, from ${m((r) => r.load['shaders-compile'])} ms)`);
console.log(`  time to complete     ${m((r) => r.load.complete)} ms  (groups out at ${['prabin', 'props', 'home', 'grass', 'craft', 'wildlife', 'clouds'].map((g) => `${g} ${m((r) => r.load[`group:${g}`])}`).join(', ')})`);
console.log(`  long tasks, live → complete: ${m((r) => r.load.longN)} (longest ${m((r) => r.load.longMax)} ms, ${m((r) => r.load.longSum)} ms in all)`);
console.log(`  JS heap at live      ${m((r) => r.load.heapMB)} MB`);
console.log(`  frame: GPU ${m((r) => r.gpuMs).toFixed(2)} ms, JS ${m((r) => r.jsMs).toFixed(2)} ms (spawn view, 1280×800, dpr ${s.pixelRatio})`);
console.log(`  scene: ${s.calls} calls, ${s.triangles} triangles (all passes), ${s.vertices} vertices, ${s.programs} programs, ${s.casters} shadow casters, ${s.gpuTextures} textures`);
console.log(`  lights ${JSON.stringify(s.lights)}, shadows ${JSON.stringify(s.shadowLights)}`);
const nan = Math.max(...results.map((r) => r.nan));
console.log(`  Inf/NaN pixels in the HDR scene: ${nan}${nan ? '  ← a shader produces NaN: the bloom will black out the screen' : ''}`);
if (nan) process.exitCode = 1;
