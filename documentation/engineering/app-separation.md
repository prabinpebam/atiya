# Separating the site and the planet

Why work on the classic site keeps breaking the planet, what the two share today, and a proposal to make them two apps in one repository. They'd be joined only where they have to be: content, the links between them, and one published site. It covers the audit, the options, the target, the seams, the migration and its Definition of Done.

> **TL;DR.**
> - **It isn't the code.** Only 3 of 93 commits since August touched both `src/game/` and `src/site/`, and nothing in the game imports the site. The breakage comes from the **toolchain they share**: one dev server, one dependency optimizer, one config, one `package.json`, one type check, one test run, one end-to-end (E2E) build.
> - **Today's failure:** the dev server re-bundled its dependencies mid-session without the game's `SkeletonUtils`. From then on every `/play` load asked for an outdated bundle ("504 Outdated Optimize Dep"), loaded a second copy of three ("Multiple instances of Three.js") and a broken React ("`_jsxDEV` is not a function"). The same thing happened when the design library's page router was added.
> - **Fixed now (phase 0):** every package the game imports is pre-bundled at start-up, and a unit test fails if one isn't.
> - **The recurring cause (30 September):** it kept happening because every `astro build` (`npm run verify:prod`, the E2E test build) and every check pre-bundled the same list, in production mode, into the **same cache folder** the running dev server serves from. The site's pages import no packages and never noticed; `/play/` got the 504s and production React's JSX runtime. Site work is when builds get run, so it looked as if site changes broke the game.
> - **Fixed (phase 0b):** each command has its own caches ([dev-isolation.mjs](https://github.com/prabinpebam/atiya/blob/main/integrations/dev-isolation.mjs)), so no build or check can touch a running dev server's, and a unit test holds it (§1).
> - **Proposal:** two apps (`apps/site`, `apps/planet`), each with its own dev server, dependencies, checks, tests and budgets. Two packages (`packages/content`, `packages/platform`) are the only code both import, and a compose step merges the two builds into one `dist/`. Same URLs, same budgets, same deploy.
> - **Next:** four phases, with a Definition of Done. Phase 1 needs no files moved; phase 2 is the move. Four decisions are yours (§9).

<figure class="slate-figure" data-diagram="separation">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 510" role="img" aria-labelledby="eng-sep__title eng-sep__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="eng-sep__title">Two apps, joined only through two packages and the composed build</title>
<desc id="eng-sep__desc">On the left, apps/site: an Astro project on its own dev server with the landing, the classic and IA pages, the design library and the docs, and its own dependencies, tests and budgets. On the right, apps/planet: an Astro page with React and three, holding /play/ (the gate and the game) and the game's textures, models and audio, with its own dependencies, tests and budgets. Between them, the only code both import: packages/content (the content contract and each channel's view) and packages/platform (withBase, the routes they link to, and the mode memory). Below, a compose step merges the two builds, refusing any path both write and checking every link, into one dist folder published on GitHub Pages.</desc>
<g id="eng-sep__site" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="eng-sep__body-1" x="40" y="40" width="300" height="200" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="eng-sep__body-1" data-slate-fit-padding="16">apps/site</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="eng-sep__body-1" data-slate-fit-padding="16">Astro, on its own dev server</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="eng-sep__body-1" data-slate-fit-padding="16">Landing, classic, IA pages</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="eng-sep__body-1" data-slate-fit-padding="16">Design library, the docs</text>
<text x="60" y="192" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="eng-sep__body-1" data-slate-fit-padding="16">Its own deps, tests, budgets</text>
</g>
<g id="eng-sep__planet" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="eng-sep__body-2" x="660" y="40" width="300" height="200" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="eng-sep__body-2" data-slate-fit-padding="16">apps/planet</text>
<text x="680" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="eng-sep__body-2" data-slate-fit-padding="16">Astro page, React and three</text>
<text x="680" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="eng-sep__body-2" data-slate-fit-padding="16">/play/: the gate, the game</text>
<text x="680" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="eng-sep__body-2" data-slate-fit-padding="16">Textures, models, audio</text>
<text x="680" y="192" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="eng-sep__body-2" data-slate-fit-padding="16">Its own deps, tests, budgets</text>
</g>
<g id="eng-sep__content" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="eng-sep__body-3" x="380" y="40" width="240" height="90" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="400" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="eng-sep__body-3" data-slate-fit-padding="16">packages/content</text>
<text x="400" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="eng-sep__body-3" data-slate-fit-padding="16">contract, channel views</text>
</g>
<g id="eng-sep__platform" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="eng-sep__body-4" x="380" y="150" width="240" height="90" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="400" y="182" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="eng-sep__body-4" data-slate-fit-padding="16">packages/platform</text>
<text x="400" y="204" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="eng-sep__body-4" data-slate-fit-padding="16">withBase, routes, mode</text>
</g>
<g id="eng-sep__compose" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="eng-sep__body-5" x="380" y="300" width="240" height="70" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="400" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="eng-sep__body-5" data-slate-fit-padding="16">scripts/compose</text>
<text x="400" y="352" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="eng-sep__body-5" data-slate-fit-padding="16">merges, checks links</text>
</g>
<g id="eng-sep__dist" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="eng-sep__body-6" x="380" y="420" width="240" height="60" rx="16" fill="var(--color-brand-bg)" />
<text x="400" y="448" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="eng-sep__body-6" data-slate-fit-padding="16">dist/</text>
<text x="400" y="468" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="eng-sep__body-6" data-slate-fit-padding="16">one site on GitHub Pages</text>
</g>
<text x="424" y="276" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">the only shared imports</text>
<g id="eng-sep__flow-1" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M380 85 L350 85" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="341,85 350,90 350,80" fill="var(--color-neutral-fg-2)" />
</g>
<g id="eng-sep__flow-2" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M620 85 L650 85" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,85 650,90 650,80" fill="var(--color-neutral-fg-2)" />
</g>
<g id="eng-sep__flow-3" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M380 195 L350 195" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="341,195 350,200 350,190" fill="var(--color-neutral-fg-2)" />
</g>
<g id="eng-sep__flow-4" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M620 195 L650 195" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,195 650,200 650,190" fill="var(--color-neutral-fg-2)" />
</g>
<g id="eng-sep__flow-5" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M190 240 L190 335 L370 335" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="379,335 370,340 370,330" fill="var(--color-neutral-fg-2)" />
</g>
<g id="eng-sep__flow-6" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M810 240 L810 335 L630 335" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="621,335 630,340 630,330" fill="var(--color-neutral-fg-2)" />
</g>
<g id="eng-sep__flow-7" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M500 370 L500 410" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="500,419 505,410 495,410" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The target: two apps, each with its own dev server, dependencies, tests and budgets, joined only through two small packages and the step that composes their builds into one site.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The target, as a table</summary>

| Part | Owns | Imports |
|---|---|---|
| `apps/site` | `/`, the classic (later IA) pages, `/design/`, `/docs/`; the site's design system, fonts and icons | `packages/content`, `packages/platform` |
| `apps/planet` | `/play/`: the gate, the game, its textures, models, audio, icons and avatars; the game's design system | `packages/content`, `packages/platform` |
| `packages/content` | The content contract, the source adapters, and each channel's view of the content | Nothing from the apps |
| `packages/platform` | `withBase`, the routes the apps link to, and the remembered mode (site or planet) | Nothing (plain TypeScript; the gate may load it) |
| `scripts/compose.mjs` | One `dist/` from the two builds; fails on a path both write; checks every link | The two builds |

</details>

## 1. Why site work breaks the planet

The planet's browser code is the only part of the repository that imports packages from `node_modules` (three, React Three Fiber, drei, postprocessing, React, zustand). The site's browser code imports none. In development, Vite pre-bundles those packages into `node_modules/.vite/deps/` and serves them under one version hash for the whole server.

1. **The planet loads late.** `/play/` reaches the game through a capability-gated dynamic import, so its modules are transformed and served on first visit, with that moment's hash baked into their imports.
2. **Anything can re-bundle.** A dependency found mid-session re-bundles every dependency under a new hash. So does an edit to `astro.config.mjs`, or a start-up scan that misses one. Site work does all of these: the page router, new optimizer entries, config edits, restarts.
3. **The planet is left holding old URLs.** Its already-served modules still ask for the old hash, and the server answers "504 Outdated Optimize Dep". What does load comes from two generations of bundles: two copies of three and of React, and a JSX runtime from the wrong one.
4. **Another process can re-bundle too, and did.** Vite's cache folder (`node_modules/.vite` by default) was shared by every Astro command. `astro build` starts a Vite of its own that pre-bundles the same `optimizeDeps.include` list, in production mode, and wrote it over the running dev server's bundles. Astro's own cache (`node_modules/.astro`, its content store) was shared the same way, and a build rewriting it reloaded every open page.

**Evidence, today.** The running server's optimizer had re-bundled without `three/examples/jsm/utils/SkeletonUtils.js`, which the family's view imports ([FamilyView.tsx](https://github.com/prabinpebam/atiya/blob/main/src/game/world/home/FamilyView.tsx)). It had never been in the pre-bundle list since the family arrived (26 September): it worked only while the start-up scan found it. Every `/play/` load in that session failed the same way, in the VS Code browser and in a fresh one. A server restarted with a clean cache scanned it again and `/play/` loaded without errors.

**Evidence, 30 September (the recurring cause).** With the pre-bundle list complete, `/play/` failed again: `react.js?v=4278c7f8` answered 504. The dev server had bundled its dependencies at 10:36; the files on disk were rewritten at 10:44, when `npm run verify:prod` ran, with another config's hash (`d9cfd1fc`). An experiment reproduced it: a scratch dev server with its own cache served its bundles at one hash; `astro build` pointed at the same folder rewrote them; the dev server then served React's **production** `jsx-dev-runtime` (`jsxDEV = void 0`, so "`_jsxDEV` is not a function") under its development URLs. With each command's own folder, the same build and `npm run check` run beside the dev server left its bundles untouched (same files, same hash, the development runtime still served) and `/play/` kept loading with no error.

**Evidence, earlier.** Adding the design library's page router ([f6b20f5](https://github.com/prabinpebam/atiya/commit/f6b20f5)) brought new modules to the optimizer mid-session, and `/play/` failed with the same 504. The fix ([2226f57](https://github.com/prabinpebam/atiya/commit/2226f57)) pre-bundled the router: a site feature, fixed in the game's config.

## 2. The audit: what the two share

| # | Shared | Kind | What it costs |
|---|---|---|---|
| 1 | One dev server, one module graph, one dependency optimizer and hash | Toolchain | Site work re-bundles the planet's dependencies under it (§1); a restart for one reloads both |
| 2 | One `astro.config.mjs` | Toolchain | The optimizer list mixes both apps; `@astrojs/react` and the shader-comment plugin apply to a site that has no React or shaders; any edit restarts both |
| 3 | One `package.json` and lockfile | Toolchain | The site inherits React below 19.3 (React Three Fiber's limit) and the Astro version the game is tested on; a site dependency bump re-bundles and re-tests the game |
| 4 | One type check (`astro check` over all of `src/`) | Checks | A type error in either app fails both |
| 5 | One unit run (`npm test`, 59 files in `tests/unit/`) | Checks | Game tests gate site commits and deploys, and the reverse |
| 6 | One E2E build (`build:test`) and one Playwright suite | Checks | Site E2E waits for, and depends on, the game's build and test hook |
| 7 | One production build and budget report (`verify:prod`) | Checks | Site pages are built and measured with the game's chunks |
| 8 | Folders that look shared but belong to one app | Layout | `src/pages/` (both apps' routes), `src/layouts/BaseLayout.astro` (the game's), `src/styles/` and `src/design/` (the game's; the site's live in `src/site/`), `public/` (mostly the game's; the landing uses `public/poster/`) |
| 9 | `withBase` lives in the game (`src/game/platform/base.ts`) | Code | The site imports a game module ([meta.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/design/meta.ts)); the only import that crosses |
| 10 | `src/content/landmarks/*.md` | Data | One file held the site's copy and the planet's world placement. **Resolved (30 September 2026):** the world is `src/game/world/places.ts` and the words and pages are `content/structures/planet.json`; `play.astro` joins them ([sections spec §5](../sections/spec.md#5-the-planet-a-parallel-structure-u8u11)) |
| 11 | Links: `/classic/…` from the game, `/play/?at=…` from the site; the `site.mode` memory | Seam | Real connections, but spread across eight files (the `site.mode` key is spelled out in three), and not tested across the join |
| 12 | One AGENTS.md | Process | Every task loads both apps' rules; most of it is the planet's |

Source code is already well apart: 3 of 93 commits since August touched both apps. The toolchain files are touched often: `astro.config.mjs` 7 times, `package.json` 7, `scripts/size-report.mjs` 20.

## 3. Goals

- **G1: dev isolation.** Running, restarting, reconfiguring or adding a dependency to one app never affects the other's dev server or open pages.
- **G2: check isolation.** A change in one app type-checks, tests, builds and measures only that app, plus the seams it touches.
- **G3: dependency ownership.** Each app lists and pins only what it imports; the site can upgrade Astro, or drop React, without the game.
- **G4: declared seams only.** The apps connect through content, routes, the mode memory and the composed build, each with a test.
- **G5: the same site.** The same URLs, budgets, capability gate, `game-*` chunks and deploy.
- **G6: little ceremony.** npm workspaces and the tools already here; no monorepo build system.

Not in scope: separate deployments, domains or repositories; changing how the game loads; the content platform itself (§7 phase 4 joins it).

## 4. Options

| Option | Dev isolation (G1) | Checks (G2) | Dependencies (G3) | Cost | Verdict |
|---|---|---|---|---|---|
| A. Guardrails in one app: a complete pre-bundle list, boundary tests, test scoping | Partial: one server still re-bundles for both, on restart or config change | Partial | No | Low | Phase 0 and 1 of the plan |
| B. Two Astro projects, one `package.json` (two configs, cache folders and source folders) | Yes | Yes | By rule only | Medium | A stepping stone that moves the files twice |
| **C. Two apps and shared packages, npm workspaces** | **Yes** | **Yes** | **Yes** | Medium: one move, scripted | **Recommended** |
| D. Two repositories | Yes | Yes | Yes | High: content and deploy cross repositories | Overkill for one site |

C is the standard monorepo shape (apps and packages, each with its own manifest, boundaries enforced by tests). It's the smallest step that gives all three isolations. npm workspaces need no new tool and work through the package feed proxy.

## 5. The target

```text
apps/
  site/                  Astro: /, the classic and IA pages, /design/, /docs/
    astro.config.mjs     no React, no game plugins; its own cacheDir
    package.json         astro, the site's fonts
    src/  public/  tests/unit/  tests/e2e/  AGENTS.md
  planet/                Astro page + React Three Fiber: /play/
    astro.config.mjs     react(), the shader-comment plugin, the game's pre-bundle list
    package.json         astro, @astrojs/react, react, three, R3F, drei, postprocessing, zustand, Font Awesome Free
    src/pages/play.astro  src/layouts/  src/game/  src/styles/  src/design/
    public/              textures, models, audio, icons, avatars, chopper
    scripts/             its asset builders and size report
    tests/unit/  tests/e2e/  AGENTS.md
packages/
  content/               the content contract, adapters, repository, and each channel's view
  platform/              withBase, routes, the mode memory (plain TypeScript)
content/                 the data: the mock API (content platform)
documentation/           this site, published by apps/site at /docs/
scripts/compose.mjs      one dist/ from both builds
tests/bridge/            the few tests that need both apps
AGENTS.md                the rules for the whole repository
```

**Output.** The planet builds its assets under their own folder (`build.assets`), so the two builds never write the same path. The composed `dist/` has the same URLs as today's.

**Brand.** The favicon and the social image are the site's; the planet's page refers to them by URL.

## 6. The seams

These are the only places the two apps connect. Each has one owner and one test.

| Seam | Owner | Contract | Tested by |
|---|---|---|---|
| **Content** | `packages/content` | The site gets its items and site structure; the planet gets `PlanetData`: places, their entries with canonical paths, and world placement ([the planet structure](../content/ia.md#5-the-planet-structure)) | The content check (V1 to V13); the planet validates `PlanetData` with its own rules (V10) |
| **Routes** | `packages/platform` | `withBase`, `routes.play({ at })`, `routes.classic(id)` (later the route table's paths); no app writes another's path by hand | A link check over the composed build: every internal link resolves |
| **Mode memory** | `packages/platform` | The `site.mode` key: the landing, the site's "Explore in 3D" and the planet's "Classic site" write it | A bridge test |
| **Composition** | `scripts/compose.mjs` | Merge the two builds; a path both write fails it; run the link check | The deploy workflow |
| **Docs** | `apps/site` | `documentation/` at `/docs/` (the docs integration moves with the site) | The Slate check |

**Import rules**, enforced by a unit test over every source file:
- `apps/site` never imports `apps/planet`, and the reverse.
- `packages/*` never import an app.
- `packages/platform` imports nothing but TypeScript: the capability gate loads it, and must stay free of React and three.
- An app's `package.json` lists what it imports, and nothing it doesn't.

**Working on one app:**

| Task | Site | Planet |
|---|---|---|
| Dev server | `npm run dev -w site` (port 4321) | `npm run dev -w planet` (port 4322) |
| Both together | `npm run dev` starts both; the site's server proxies `/play/` and the planet's assets to the planet's, so links between them work | |
| Type check, unit tests | `npm run check -w site`, `npm test -w site` | `npm run check -w planet`, `npm test -w planet` |
| E2E | Its own build, port and groups | Its own test build, port and groups |
| Budgets | The landing's eager JS | The gate, the initial JS, the later chunks |
| Across the join | `tests/bridge/` against the composed preview: the landing's choice, classic to planet at a landmark, planet to classic, the gate's way out, the link check | |

Validation tiers then follow the path. A change under `apps/site/` runs the site's tiers only, and one under `apps/planet/` the planet's. A change to `packages/` runs both apps' tier 1 and the bridge tests. The root configuration is tier 3. AGENTS.md splits the same way: the root keeps the repository-wide rules, and each app gets its own.

## 7. Migration

| Phase | What | Moves files? |
|---|---|---|
| **0. Stop the bleeding** (done) | Every package the game imports is in `optimizeDeps.include`: `SkeletonUtils` was missing, and React is listed explicitly. [devDeps.test.ts](https://github.com/prabinpebam/atiya/blob/main/tests/unit/devDeps.test.ts) fails, naming the file, when the game imports a package that isn't | No |
| **0b. Caches per command** (done) | [dev-isolation.mjs](https://github.com/prabinpebam/atiya/blob/main/integrations/dev-isolation.mjs) gives each command its own Vite cache (`node_modules/.vite/astro-<command>[-<mode>]`) and Astro cache (dev keeps `node_modules/.astro`; others `node_modules/.astro-<command>`), so a build, a check or the E2E test build never touches a running dev server's. `devDeps.test.ts` holds it, and that nothing else sets a cache folder | No |
| **1. Seams in place** | `src/platform/` takes `withBase`, the routes and the mode memory from the game; both apps import it, and every cross-link goes through it. The landmarks are read through two views, one per app. The import-boundary test (site and game never import each other) | A few |
| **2. Two apps** | npm workspaces; `git mv` into `apps/site`, `apps/planet`, `packages/platform` (and a `packages/content` shell). Per-app Astro configs, cache folders, `public/`, tsconfig, Vitest and Playwright configs, and size reports. `scripts/compose.mjs`; the deploy workflow builds both and composes. A script rewrites the paths in tests, scripts, asset sources, AGENTS.md and the docs' GitHub links (about 600 references, most of them test imports) | Yes, once |
| **3. Checks and rules** | The bridge tests; per-app AGENTS.md; validation tiers by path; the [engineering overview](overview.md)'s repository map and commands | No |
| **4. The content seam** | With the content platform's phase 0: `packages/content` holds the contract, and the planet reads `PlanetData` from the planet structure instead of the landmark files. The content spec's `src/site/content/` paths become `packages/content/` | No |

Phase 1 is safe to do at any time. Phase 2 is one focused change, proved by the parity checks in the Definition of Done. Doing phases 1 to 3 before the content platform's phase 0 means the content code is written in its final place.

## 8. Definition of Done

Each row is true and evidenced (a test, a command's output or a recorded check).

| # | Phase | Criterion | Evidence |
|---|---|---|---|
| 1 | 0 | Every package the game imports is pre-bundled at start-up; `/play/` loads on a fresh dev server with no 504 and one copy of three | `devDeps.test.ts`; a fresh-browser check of `/play/` |
| 1b | 0b | A build, a type check or the E2E build run beside the dev server leaves its bundles untouched, and a loaded `/play/` keeps working | `devDeps.test.ts` ("the dev server's caches"); the 30 September check in §1: `astro build` and `npm run check` beside the dev server, its `astro-dev` metadata unchanged, the development JSX runtime still served, `/play/` reloaded with no error |
| 2 | 1 | No import crosses between the site and the game; both reach `withBase`, routes and the mode memory through `platform` | The boundary test |
| 3 | 2 | With only the site's dev server running, every site page works, and its optimizer holds no three or React | The dev server's dependency metadata; the site E2E |
| 4 | 2 | With only the planet's, `/play/` works | The planet E2E |
| 5 | 2 | Restarting the site's server, editing its config or adding a dependency to it leaves a loaded `/play/` working | A script: start both, load `/play/`, change the site's config, reload `/play/`: no 504, one copy of three |
| 6 | 2 | Each app's type check, unit tests and E2E compile and run none of the other's code | The commands' file lists |
| 7 | 2 | The composed build has today's URLs, every link resolves, and every budget holds | A path-parity script (hashed names aside); the link check; both size reports |
| 8 | 2 | The deploy builds both apps and composes them; a path both write fails it | A workflow run; a unit test of `compose.mjs` |
| 9 | 3 | The bridge tests pass; AGENTS.md and the validation tiers are per app; the overview is updated | Test run; review |
| 10 | 4 | The planet reads `PlanetData`; a change to site copy runs no planet test | The content check; the test selection for such a change |

## 9. Open decisions

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| S1 | **Workspaces**, with a `package.json` per app (option C), or one `package.json` with two configs (option B) | C: it's the only one that separates dependencies, and it moves the files once | Phase 2 |
| S2 | **The planet stays an Astro page**, or becomes a plain Vite app | Stays Astro: the page shell, the capability gate, the preloads and the size report work as they are | Phase 2 |
| S3 | **`npm run dev` starts both apps** with the site's server proxying `/play/`, or each app starts alone and links between them work only in a composed preview | Both, with the proxy; each app still starts alone | Phase 2 |
| S4 | **Order with the content platform:** separation phases 1 to 3 first, or the content platform's phase 0 first | Separation first: the content code then lands in `packages/content` | Before either |
