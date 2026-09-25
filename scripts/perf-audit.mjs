// Performance audit (see documentation/poc-3d-navigation/performance-audit.md).
//
//   npm run dev            (or: npm run build:test && npx astro preview)
//   npm run perf:audit -- [--url http://127.0.0.1:4321/play/?quality=high] [--runs 4] [--cpu 4] [--swiftshader]
//
// Needs a dev or test build (the `window.__game` hook). Uses the machine's real GPU through ANGLE
// unless --swiftshader is given. Reports, as medians over the runs:
//   - load: time to playable (`game:playable`), shader warm-up (`game:shaders-compile` → `game:shaders-ready`), JS heap
//   - steady state at the spawn view: GPU time per frame (EXT_disjoint_timer_query_webgl2, when exposed),
//     JS time per frame, and the scene census from `__game.perfStats()` (draw calls, triangles,
//     vertices, programs, shadow casters, lights, textures)
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1] ?? true;
};
const url = arg('url', 'http://127.0.0.1:4321/play/?quality=high');
const runs = Number(arg('runs', 4));
const cpu = Number(arg('cpu', 1));
const swift = process.argv.includes('--swiftshader');
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
  await page.addInitScript(() => localStorage.setItem('site.onboardingSeen', '1'));
  await page.addInitScript(frameTimer);
  await page.goto(url);
  const cont = page.getByRole('button', { name: 'Continue anyway' });
  await page.waitForFunction(() => window.__game || document.querySelector('[data-gate-continue]'), null, { timeout: 120_000 });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await page.waitForFunction(() => window.__game && window.__game.getState().phase !== 'loading', null, { timeout: 180_000, polling: 50 });
  const load = await page.evaluate(() => ({
    ...Object.fromEntries(performance.getEntriesByType('mark').map((m) => [m.name.replace('game:', ''), Math.round(m.startTime)])),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : NaN,
  }));
  await page.getByRole('button', { name: 'Start exploring' }).click();
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
  await browser.close();
  return { load, gpuMs: median(frame.gpu), jsMs: median(frame.js), stats };
}

const results = [];
for (let i = 0; i < runs; i++) results.push(await run());
const m = (f) => median(results.map(f));
const s = results[results.length - 1].stats;
console.log(`perf audit: ${url}  runs ${runs}  cpu ×${cpu}  ${swift ? 'SwiftShader' : 'real GPU'}`);
console.log(`  time to playable     ${m((r) => r.load.playable)} ms  (shader warm-up ${m((r) => r.load['shaders-ready'] - r.load['shaders-compile'])} ms, from ${m((r) => r.load['shaders-compile'])} ms)`);
console.log(`  JS heap at playable  ${m((r) => r.load.heapMB)} MB`);
console.log(`  frame: GPU ${m((r) => r.gpuMs).toFixed(2)} ms, JS ${m((r) => r.jsMs).toFixed(2)} ms (spawn view, 1280×800, dpr ${s.pixelRatio})`);
console.log(`  scene: ${s.calls} calls, ${s.triangles} triangles (all passes), ${s.vertices} vertices, ${s.programs} programs, ${s.casters} shadow casters, ${s.gpuTextures} textures`);
console.log(`  lights ${JSON.stringify(s.lights)}, shadows ${JSON.stringify(s.shadowLights)}`);
