#!/usr/bin/env node
/**
 * The performance report's charts and their data tables, from the committed baseline (perf/baseline.json):
 * documentation/engineering/performance-report.md. Each chart is a Slate chart spec (kept beside its SVG in
 * documentation/engineering/assets/perf/), rendered offline by Slate's chart renderer, and written into the
 * page's figure (<figure class="slate-figure" data-perf-chart="<name>">, its figcaption kept) with its data
 * table (<details class="slate-figure-data" data-perf-data="<name>">). Run it after saving a new baseline.
 *
 *   node scripts/build-perf-charts.mjs          write the charts into the report
 *   node scripts/build-perf-charts.mjs --check  fail if the report's charts are stale
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChartSpec } from '../slate/visualization/skills/chart/scripts/render-chart.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'documentation/engineering/performance-report.md');
const ASSETS = join(ROOT, 'documentation/engineering/assets/perf');
const base = JSON.parse(readFileSync(join(ROOT, 'perf/baseline.json'), 'utf8'));
const budgets = JSON.parse(readFileSync(join(ROOT, 'perf/budgets.json'), 'utf8'));
const m = (key) => base.metrics[key]?.median;
const s = (ms) => Math.round(ms) / 1000;
const table = (head, rows) => `\n<table>\n<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>\n<tbody>\n${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}\n</tbody>\n</table>\n`;

const SCREENS = [
  ['dashboard', 'Dashboard'],
  ['articles', 'Pages'],
  ['article', 'Article (typical)'],
  ['article-large', 'Article (largest)'],
  ['sections', 'Sections'],
  ['navigation', 'Navigation'],
  ['planet', 'Planet'],
  ['media', 'Media'],
  ['settings', 'Settings'],
  ['access', 'Access'],
  ['publish', 'Save to remote'],
];

const INTERACTIONS = [
  ['select-block', 'Select a block'],
  ['picker-open', 'Open the picker'],
  ['save-round-trip', 'Save (round trip)'],
  ['field-to-canvas', 'Field to canvas'],
  ['type-to-saved', 'Type to Saved'],
  ['media-details', "A picture's details"],
  ['other-tab-updated', 'Another tab updated'],
  ['media-save', "Save a picture's details"],
  ['add-block-to-canvas', 'New block on canvas'],
  ['type-to-settled', 'Type to settled'],
];

const PAGES = [
  ['home', 'Home'],
  ['section', 'A section'],
  ['article', 'An article'],
  ['article-large', 'Largest article'],
  ['design-library', 'Design library'],
  ['play-first-paint', 'Planet (first paint)'],
];

function charts() {
  const out = [];

  // 1. every editor screen, warm: the part that is git status, and the rest
  const screens = SCREENS.map(([key, label]) => {
    const ready = m(`editor/warm/${key}/ready`) ?? 0;
    const git = Math.min(ready, base.serverSpans?.[`editor/warm/${key}`]?.git ?? 0);
    return { key, label, ready, git, rest: ready - git, html: m(`editor/warm/${key}/html-kb`), processes: m(`editor/warm/${key}/span/git-processes`) };
  });
  out.push({
    name: 'screens',
    spec: {
      chart: 'StackedBarChart',
      title: 'Edit mode screens, warm: time until usable',
      alt: `Every screen takes about a second or more to open on a warm dev server, and waiting on git status is most of it: ${s(Math.min(...screens.map((x) => x.git)))} to ${s(Math.max(...screens.map((x) => x.git)))} s of each.`,
      props: {
        data: screens.flatMap((x) => [
          { screen: x.label, part: 'Waiting on git status', seconds: s(x.git) },
          { screen: x.label, part: 'Everything else', seconds: s(x.rest) },
        ]),
        categoryAccessor: 'screen',
        stackBy: 'part',
        valueAccessor: 'seconds',
        orientation: 'horizontal',
        valueLabel: 'Seconds until usable (median of 5)',
        width: 760,
        height: 460,
        margin: { left: 150, right: 24, top: 40, bottom: 60 },
      },
    },
    data: table(
      ['Screen', 'Usable (s)', 'Git status (s)', 'Git processes', 'HTML (KB)'],
      screens.map((x) => [x.label, s(x.ready), s(x.git), x.processes ?? '', x.html ?? '']),
    ),
  });

  // 2. the interactions against their targets
  const inter = INTERACTIONS.map(([key, label]) => ({ key, label, now: m(`editor/interaction/${key}`), target: budgets.targets[`editor/interaction/${key}`]?.max })).filter((x) => Number.isFinite(x.now));
  out.push({
    name: 'interactions',
    spec: {
      chart: 'GroupedBarChart',
      title: 'Edit mode interactions: now and the target',
      alt: 'Selecting, opening the picker and the save itself are already quick; what follows a save (the screen and the canvas drawn again) takes 1 to 4 seconds, far past the 1 second targets.',
      props: {
        data: inter.flatMap((x) => [
          { interaction: x.label, series: 'Now (median)', seconds: s(x.now) },
          ...(x.target ? [{ interaction: x.label, series: 'Target', seconds: s(x.target) }] : []),
        ]),
        categoryAccessor: 'interaction',
        groupBy: 'series',
        valueAccessor: 'seconds',
        orientation: 'horizontal',
        valueLabel: 'Seconds from the key or click',
        width: 760,
        height: 520,
        margin: { left: 180, right: 24, top: 40, bottom: 60 },
      },
    },
    data: table(
      ['Interaction', 'Now, median (s)', 'p75 (s)', 'Target (s)'],
      inter.map((x) => [x.label, s(x.now), s(base.metrics[`editor/interaction/${x.key}`].p75), x.target ? s(x.target) : '']),
    ),
  });

  // 3. the site: Largest Contentful Paint on a desktop and a throttled phone
  const pages = PAGES.map(([key, label]) => ({ key, label, desktop: m(`site/desktop/${key}/lcp`) ?? m(`site/desktop/${key}/fcp`), phone: m(`site/phone/${key}/lcp`) ?? m(`site/phone/${key}/fcp`) }));
  out.push({
    name: 'site',
    spec: {
      chart: 'GroupedBarChart',
      title: 'The site: Largest Contentful Paint',
      alt: 'The production site paints its largest content in a tenth of a second on a desktop and about half a second on a throttled phone profile, well inside the 2.5 second Web Vitals threshold.',
      props: {
        data: pages.flatMap((x) => [
          { page: x.label, profile: 'Desktop', seconds: s(x.desktop) },
          { page: x.label, profile: 'Phone (CPU x4, 10 Mbps)', seconds: s(x.phone) },
        ]),
        categoryAccessor: 'page',
        groupBy: 'profile',
        valueAccessor: 'seconds',
        orientation: 'horizontal',
        valueLabel: 'Seconds to Largest Contentful Paint (median of 5)',
        width: 760,
        height: 420,
        margin: { left: 170, right: 24, top: 40, bottom: 60 },
      },
    },
    data: table(
      ['Page', 'Desktop LCP (s)', 'Phone LCP (s)', 'Phone TBT (ms)', 'Phone CLS', 'Requests', 'JS (KB)', 'Pictures (KB)'],
      pages.map((x) => [x.label, s(x.desktop), s(x.phone), m(`site/phone/${x.key}/tbt`), m(`site/phone/${x.key}/cls`), m(`site/phone/${x.key}/requests`), m(`site/phone/${x.key}/script-kb`), m(`site/phone/${x.key}/img-kb`)]),
    ),
  });
  return out;
}

const check = process.argv.includes('--check');
let page = readFileSync(PAGE, 'utf8');
const before = page;
mkdirSync(ASSETS, { recursive: true });
for (const c of charts()) {
  const { svg } = renderChartSpec(c.spec);
  if (!check) {
    writeFileSync(join(ASSETS, `${c.name}.json`), `${JSON.stringify(c.spec, null, 2)}\n`);
    writeFileSync(join(ASSETS, `${c.name}.svg`), `${svg}\n`);
  }
  const fig = new RegExp(`(<figure class="slate-figure" data-perf-chart="${c.name}">)[\\s\\S]*?(<figcaption>)`);
  if (!fig.test(page)) throw new Error(`the report has no figure for ${c.name}`);
  page = page.replace(fig, (_, open, cap) => `${open}\n${svg}\n${cap}`);
  const data = new RegExp(`(<details class="slate-figure-data" data-perf-data="${c.name}">\\s*<summary>[^<]*</summary>)[\\s\\S]*?(</details>)`);
  if (!data.test(page)) throw new Error(`the report has no data table for ${c.name}`);
  page = page.replace(data, (_, open, close) => `${open}${c.data}${close}`);
}
if (check) {
  if (page !== before) {
    console.error('The performance report\'s charts are stale: run node scripts/build-perf-charts.mjs');
    process.exit(1);
  }
  console.log('The performance report\'s charts are up to date.');
} else {
  writeFileSync(PAGE, page);
  console.log('Wrote the performance report\'s charts.');
}
