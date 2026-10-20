# Measuring performance: the benchmark and the dev server's timing

How edit mode's and the site's performance is measured, tracked and kept from slipping: one benchmark command, the dev server's own record of where its time goes, the metrics and what each one means, the committed baseline and the regression check. The numbers themselves are in [the October 2026 report](performance-report.md); the planet's game has its own audit ([performance audit](../poc-3d-navigation/performance-audit.md), `npm run perf:audit`).

> **TL;DR.**
> - **One command:** `npm run perf:bench` measures edit mode on its own throwaway copy of the content (never the real one) and the production site on `astro preview`, and writes a run to `perf/runs/`.
> - **Edit mode:** the dev server's start and its first-start warm-up, each screen's first load after it (cold) and every later one (warm), and the interactions as a person does them (select, type and save, a field, the picker, a new block, undo, a move and a delete shown at once, another tab, a picture's details and its save), timed from the key or click to what the person waits for, and to the first visible sign.
> - **The site:** six pages on a desktop and on a throttled phone (CPU ×4, 10 Mbps, 40 ms), each in an empty cache: TTFB, FCP, LCP, CLS, TBT, load, requests and bytes by type.
> - **Causes, not only symptoms:** in dev every request is timed to its last byte, with named spans for the costly work (a content reload, a picture, a git process, the store's check). `GET /_edit/api/perf` returns them; each response carries a `Server-Timing` header for the browser's developer tools.
> - **Tracking:** `perf/baseline.json` is the committed reference; `--compare perf/baseline.json --check` fails on a metric worse than the baseline beyond its noise allowance; `perf/budgets.json` holds the allowances and the plan's targets.
> - **Field data:** real visits report LCP, INP and CLS through the site's telemetry (one `web_vitals` event per page load, numbers and ratings only), so the site's numbers come from readers as well as one machine.

## 1. What is measured

| Area | Where | How |
|---|---|---|
| **Edit mode** | Its own dev server on port 4330, on the editor's fixture: a git copy of `content/` with a bare remote (`scripts/editor-test-server.mjs`), so saves and resets never touch the real content | Headless Chromium through Playwright, 1600 × 1000 |
| **The site** | The production build (`npm run build`), served by `astro preview` on port 4332 | Headless Chromium, a new browser context (empty cache) per load; a desktop profile and a phone profile |
| **The planet's game** | Not here: `npm run perf:audit` measures load, frames and the GPU | [Performance audit](../poc-3d-navigation/performance-audit.md) |

The fixture is a copy of the real content, so its size is the real size (the run records the number of articles, documents, media files and megabytes).

## 2. The metrics

### 2.1 Screens and pages

| Metric | Meaning |
|---|---|
| `ready` | Edit mode: the screen is drawn and usable; for an article, its canvas takes edits (`[data-editor-editable]` in the frame). The one number a person feels |
| `ttfb`, `html` | Time to the HTML's first byte, and to its last |
| `fcp`, `lcp` | First and Largest Contentful Paint |
| `dcl`, `load` | `DOMContentLoaded` and `load` ended |
| `tbt` | Total Blocking Time: each long task's time over 50 ms, from FCP to `ready` (or to `load` + 1 s) |
| `cls` | Cumulative Layout Shift (a score) |
| `images-settled` | Every picture in view has loaded (Media, the picker) |
| `requests`, `scripts` | Requests in all, and how many are JavaScript modules (in dev, each source file is one) |
| `html-kb`, `script-kb`, `css-kb`, `img-kb`, `font-kb` | Bytes transferred, by type |
| `dom-nodes`, `js-heap-mb` | The document's size and the page's JavaScript heap |
| `server/<kind>-ms`, `server/<kind>-requests` | The dev server's own time for the load, by kind of request: `editor` (screens), `canvas`, `page`, `api`, `module`, `image` (`/_image` transforms), `asset` |

**Cold** is the first load of each screen on a dev server that has just started: it includes compiling the screen's modules and preparing every picture the screen shows. **Warm** is every later load, in a browser that has been there before.

### 2.2 Interactions

Each is timed from the person's key or click (the last `pointerdown` or `keydown`, recorded in any frame) to the moment the result is there.

| Metric | From | To |
|---|---|---|
| `select-block` | A click on a block in the outline | Its settings in the inspector |
| `type-to-saved` | The last key typed in the canvas | "Saved" (includes the canvas's 800 ms pause before it sends the words) |
| `save-round-trip` | "Saving…" | "Saved" (the `editor:save` measure) |
| `type-swap`, `type-swap-kb`, `type-to-settled` | After the save, the outline and inspector drawn again: how long, how much HTML it fetched, and the last key to that (since words alone redraw nothing, `type-to-settled` is the save, and the swap's size 0) |
| `field-to-saved`, `field-to-canvas`, `field-canvas-redraw` | A field in the inspector committed (Tab) | Saved; the canvas drawn again with it; the redraw alone |
| `picker-open`, `picker-images`, `picker-filled`, `picker-cards` | Choose on the thumbnail's field | The picker shown; its first pictures in view loaded; every card in (it fills a page at a time); how many cards it holds |
| `ai-prompt-open` | Ctrl+Shift+Space in a paragraph's words | Ask AI's prompt shown under it (the canvas's `editor:ai-prompt-open` measure; [AI editing §18](../editor/ai-editing.md#18-as-built)) |
| `add-block-shown`, `add-block-to-saved`, `add-block-to-canvas` | A block chosen in the palette | Its row and its place on the canvas shown (editor spec §3.6); saved; drawn on the canvas |
| `move-shown`, `delete-shown` | Move down on a row; Delete on a selected row | The outline and the canvas both showing it |
| `feedback-shown` | Each of the above, and a click on a picture in Media | The first visible sign (the result itself, or the card marked current) |
| `undo-to-saved` | Undo | Saved |
| `other-tab-updated`, `other-tab-swap`, `other-tab-swap-kb` | A save in one tab | The articles list open in another tab drawn again with it |
| `media-details`, `media-save` | A click on a picture in Media; Save the details | Its details shown; saved |
| `api/changes`, `api/where` | The API's git status (behind the counts of changes to save to remote) and the launcher's lookup | The answer |
| `first-ready` | The dev server started | Its first-start warm-up done: every screen compiled and every picture's facts read (`/_edit/__warm`) |

## 3. Instrumentation

### 3.1 On the dev server

- **Every request is timed** (`integrations/perf.mjs`, in `astro dev` only): from its arrival to its last byte, its kind (`kindOf`), its status and size. The last 2,000 are kept in memory.
- **Named spans** say where the time went. The site's code wraps its costly work in `timed` / `timedAsync` (`src/site/content/timing.ts`); inside a request they add to it, and they always add to the process's running totals. Outside `astro dev` (a build, a preview, the unit tests) they only run the work.

| Span | What it times |
|---|---|
| `content.read`, `content.validate` | Reading every content file again, and the whole content check, after any change (`repository.ts`) |
| `picture.metadata`, `picture.edge`, `picture.url` | A master's size read with sharp, its edge colour worked out, and an image URL asked of `astro:assets` (`pictures.ts`) |
| `media.cards` | Every picture and video made into a card for the library or the picker (`screens.ts`) |
| `git` | Each git process the editor runs (`git.ts`) |
| `store.read`, `store.check` | The store reading the snapshot, and checking it before and after a change (`store.ts`) |

- **`GET /_edit/api/perf?since=<epoch ms>`** returns the requests since then and the running totals. The benchmark reads it after each step.
- **`Server-Timing`** on every response carries the spans known when the response started, and `head` (the time to it), for the Network panel of the browser's developer tools. Spans are summed per name; work done in parallel can sum to more than the request's own time.

### 3.2 In edit mode's pages

Three `performance.measure` entries, readable in the Performance panel and by the benchmark:

| Measure | From | To |
|---|---|---|
| `editor:save` | The status says "Saving…" | It says "Saved" |
| `editor:swap` | A screen fetched again for its regions (`swapRegions`) | Its regions swapped in; `detail` holds the regions, the bytes, and the fetch, parse and swap times |
| `editor:canvas` | The canvas reloaded after a save | It says it's ready again |

## 4. Tracking

- **Run it:** `npm run perf:bench` (both suites, 5 runs; about 20 minutes on the audit machine). `--suite editor` or `--suite site` for one; `--runs N`; `--build` to rebuild the site first; `--reuse` measures an editor test server already running (warm only); `--only screens|api|interactions` for one part of the editor suite; `--cpu 4` slows the editor's pages four times (a laptop, report R15), keeping those metrics apart as `editor-cpu4/…`. Port 4330 must be free (the editor's E2E server uses it too), and 4332.
- **Read it:** the run prints every metric's median, p75, min and max, then the plan's targets met or not, and writes `perf/runs/<stamp>.json` with the machine, the commit, the content's size and the dev server's spans for each step.
- **Compare:** `--compare perf/baseline.json` prints each metric against the baseline. `--check` exits 1 if any is worse beyond its noise allowance: both 20% and 75 ms for times, 10% and 10 KB for bytes, 10% and 2 for counts (`perf/budgets.json`, `noise`).
- **The baseline** is `perf/baseline.json`, committed (saved 13 October 2026, after the report's plan was built). Save a new one (`--save-baseline`) only on purpose: after an improvement lands, on the same machine, with nothing else heavy running, and say so in the commit. The October audit's run is kept as it was in `perf/baseline-2026-10-13.json`: the report's charts are drawn from it (`node scripts/build-perf-charts.mjs`).
- **Targets** (`perf/budgets.json`, `targets`) are the plan's goals ([report §6](performance-report.md#6-plan)). They're reported, not enforced; a target met becomes the baseline's floor.
- **When to run it** (the Validation tiers in AGENTS.md): after a change to the editor's server or client code, the content loader, the picture pipeline, a layout or a page's loading; before a release; and as the evidence for any performance change. A change that only touches copy or docs needs none.

## 5. Field data

The benchmark is one machine; the field data is every reader's. Each page load on the production site reports its own Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift through the site's telemetry, as one `web_vitals` event ([access spec §9.2](../access/spec.md#92-whats-recorded)).

- **Measured in the browser, without a library** (`src/site/scripts/webVitals.ts`): buffered `PerformanceObserver`s for `largest-contentful-paint` (the last candidate before the page was first hidden, from its activation), `layout-shift` (CLS: the largest session window, shifts under 1 s apart for at most 5 s, none just after input) and `event` (INP: each interaction's longest event, with a 40 ms threshold, at the 98th percentile of the page's interactions). The rules are pure and unit-tested (`tests/unit/telemetry.test.ts`, "field data").
- **Sent once,** with `sendBeacon`, the first time the page is hidden or left. A metric the browser doesn't report (Safari has none of the three) is left out; a page opened in the background isn't measured.
- **Off the critical path:** the observers start in PostHog's chunk, fetched on idle (on the planet, once it's live), and being buffered they still see the page's first paints. The part every page runs is unchanged (the telemetry shim's 1.2 KB budget).
- **Nothing protected:** the event carries the page's coarse kind (`home`, `section`, `page`, `private`, `sign-in`, `planet`, `planet-page`, `library`), the three values rounded (10 ms; CLS to three decimals) and their ratings against Web Vitals' thresholds (LCP 2.5 s and 4 s, INP 200 ms and 500 ms, CLS 0.1 and 0.25), never an address, a title or an ID. It's allowlisted, so protected pages and the Sign in page send it with those properties alone.
- **Consent as for the rest of telemetry:** production builds with a PostHog key only, never in dev; Global Privacy Control, Do Not Track and `?telemetry=off` turn it off with everything else.
- **Reading it:** in PostHog, the `web_vitals` event's `lcp`, `inp` and `cls` at p75, by `kind`, beside the benchmark's lab numbers ([report §2.3](performance-report.md#23-the-site)); the plan's goal is LCP under 2.5 s at p75. A page that's left before PostHog's chunk has loaded (a few seconds) sends nothing, so very short visits are under-counted.

## 6. Limits

- **Dev isn't production.** Edit mode only runs in dev, so its numbers include Vite serving each module separately and transforming pictures on demand. That's what the owner lives with, so it's what's measured. The site is measured on the production build.
- **One machine.** The baseline's machine is in the run (`meta.machine`): compare runs from the same machine. The audit machine is fast (a 24-core desktop CPU), so a laptop's editor will be slower (`--cpu 4` measures that: report §6.1); the phone profile is a CPU slowdown, not a real phone.
- **Noise.** Medians over 5 runs, and allowances wider than run-to-run noise. Close other heavy work (a build, the E2E suite) while measuring; the owner's own dev server on port 4321 may run alongside, idle.
- **Headless.** Paint timings come from headless Chromium; they track a real browser's closely but aren't identical.
