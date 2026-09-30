# Engineering overview

> **TL;DR.** An Astro 7 static site with two faces. The **classic site** is plain HTML pages generated from Markdown content, set in its own design system (tokens, fundamentals, compounds, layouts, with a live library at `/design/`). The **planet** at `/play/` is a React Three Fiber game loaded behind a capability gate. Simulation is kept in pure, unit-tested TypeScript; rendering is in React components, and the UI is semantic DOM. GitHub Actions builds the site with the base path `/atiya` and publishes it to GitHub Pages together with this documentation at `/atiya/docs/`. The rules agents follow day to day are in [AGENTS.md](https://github.com/prabinpebam/atiya/blob/main/AGENTS.md).

## Stack

| Layer | Choice (exact pins) | Why |
|---|---|---|
| Site framework | Astro 7.3.3, `@astrojs/react` 6.0.6 | Static pages by default; islands only where needed |
| UI and 3D | React 19.2.8, three 0.186.0, `@react-three/fiber` 9.7.0, `@react-three/drei` 10.7.8 | R3F 9 needs React below 19.3; WebGL renderer only |
| Post-processing | `@react-three/postprocessing` 3.1.1, `postprocessing` 6.39.5 | Tilt-shift (always on), bloom and vignette (high tier only) |
| State | zustand 5.0.15 | One store the DOM HUD and the scene both read |
| Icons | Font Awesome Free (solid), imported by name | Only the icons that are used end up in the bundle |
| Tests | Vitest (unit), Playwright + axe (E2E, accessibility) | Pure logic is unit-tested; the E2E tests drive `window.__game` in test builds |
| Docs | Slate (vendored in `slate/`), host folder `documentation/` | Static, offline, Markdown or HTML pages; this site |

The reasons behind the stack are in [the tech-stack research](../poc-3d-navigation/research/tech-stack.md) and [the POC spec](../poc-3d-navigation/spec.md) §5.

## Repository map

The site and the planet share this layout today. [Separating the site and the planet](app-separation.md) proposes two apps with their own dev servers, dependencies and checks.

| Path | What lives there |
|---|---|
| `src/pages/` | `index.astro` (the home page), `[...path].astro` (every section, page and redirect of the site structure), `design/` (the design library), `play.astro` (the game page) |
| `content/` | The site's content as data: pages, the site structure (sections and navigation), the planet structure (what each building holds), media ([content spec](../content/spec.md)) |
| `src/game/platform/` | `gate.ts` (the capability gate: no React or three), `base.ts` (`withBase`), prefs |
| `src/game/controller.ts` | The game controller: input, simulation step, targets, talk, travel, settings |
| `src/game/math/`, `src/game/systems/` | Pure simulation: planet rotation, collision, proximity, targets, actions, seating, ready cues |
| `src/game/world/` | The scene: terrain, props, the kit, foliage, sky, day and night, water, wildlife; Chopper (`chopper/`), the home and family (`home/`), crafting (`craft/`) |
| `src/game/inventory/`, `src/game/audio/`, `src/game/player/` | Backpack rules and items, the sound engine, the player characters |
| `src/game/ui/` | The DOM HUD, dialogs, menus and the priority arbiter (`lanes.ts`) |
| `src/design/tokens.json` | The game's design tokens: the source of truth for every game UI value |
| `src/site/` | The website's own design system ([site design system](../site-ui/design-system.md)): DTCG tokens and foundations (`design/`, `scripts/`, `styles/`), fundamentals and compounds (`components/`), `layouts/`, stories and the design library (`stories/`, `library/`); the content layer (`content/`: contract, loader, repository, routes, pictures, the page); [edit mode](../editor/spec.md) (`editor/`, dev only) |
| `content/` | The site's content as data: articles, the site structure, people, settings, media masters with their sidecars ([content spec](../content/spec.md)) |
| `src/styles/` | The game's styles: `tokens.css` (generated), `base`, `components`, `hud`, `panels`, `cursors` |
| `scripts/` | Asset and token builders (textures, audio, music, icons, characters, portraits, tokens), the bundle-size report and the performance audit |
| `assets-src/` | Asset sources: texture prompts, the icon style set, character skins, `CREDITS.md` |
| `public/` | Generated assets: textures, audio, models, icons, avatars |
| `tests/unit/`, `tests/e2e/` | The Vitest and Playwright suites |
| `documentation/` | This docs site: every spec, plan and Definition of Done |
| `integrations/docs-site.mjs` | Publishes `documentation/` at `<base>/docs/` |
| `integrations/dev-isolation.mjs` | Each command's own Vite and Astro caches, so a build or check never rewrites a running dev server's bundles ([why](app-separation.md#1-why-site-work-breaks-the-planet)) |
| `integrations/editor.mjs` | [Edit mode](../editor/spec.md): its routes, guard and Edit button in `npm run dev` only; the content folder's path for every command |

## Commands

| Command | Does |
|---|---|
| `npm run dev` | The dev server at `http://localhost:4321/` (the docs are at `/docs/`, [edit mode](../editor/spec.md) at `/_edit/`). Use `localhost`, not `127.0.0.1`: YouTube won't play an embedded video on a page served from an IP address |
| `npm test` | The unit tests |
| `npm run check` | Type checks (`astro check`) |
| `npm run e2e` | Playwright and axe, against a `--mode test` build; edit mode's group runs on its own fixture server (`npx playwright test --project=editor`) |
| `npm run verify:prod` | Production build, bundle budgets (the game's initial JS at most 450 KB gzip; on-demand chunks within theirs), and a check that no test hook and nothing of edit mode ships |
| `npm run perf:audit` | Real-GPU load and frame measurements (see [the performance audit](../poc-3d-navigation/performance-audit.md)) |
| `node scripts/build-tokens.mjs` | Regenerates the game's `tokens.css` and [the token reference](../game-ui/tokens.md) |
| `node scripts/build-site-tokens.mjs` | Regenerates the site's `src/site/styles/tokens.css` and [its token reference](../site-ui/tokens.md) from the DTCG resolver |
| `python scripts/build-textures.py`, `build-audio.py`, `gen-icons.py` | Regenerate textures, sounds and item icons; never hand-edit their outputs |

## Validation: run what the change needs

Headless E2E is slow (software WebGL), so checks are scoped to what a change can affect:

| Tier | When | What |
|---|---|---|
| 0 | Docs, comments, copy | Proof-read |
| 1 | Any code change | `npx vitest related <files> --run`, plus `npm run check` if types changed |
| 2 | Rendering, input, DOM UI, sound | The affected E2E group or test, and one screenshot |
| 3 | Shared infrastructure, dependencies, the gate, or a milestone | The full unit suite, the type check, `verify:prod` and the full E2E |

The full rules and triggers are in AGENTS.md ("Validation").

## Build and deploy

- `.github/workflows/deploy.yml` builds on every push to `main` with `BASE_PATH=/atiya`, and deploys `dist/` to GitHub Pages: [prabinpebam.github.io/atiya](https://prabinpebam.github.io/atiya/). Nothing built is committed.
- Every root-relative URL goes through `withBase()` (or `import.meta.env.BASE_URL` in inline scripts). To check a change that adds URLs, build with the base: `$env:BASE_PATH='/atiya'; npm run build; npx astro preview`.
- `/play/` uses a capability-gated dynamic import: devices that fail the gate never download the game chunks.

## The documentation site

- `documentation/` is a Slate host.
  - Content: `.md` or `.html` body fragments.
  - Navigation: `docs-manifest.json`.
  - Branding: `slate.config.json` and `project.theme.css`.
  - `shell/` is generated; never edit it.
- `integrations/docs-site.mjs` serves the folder at `/docs/` in dev and copies it to `dist/docs/` at build, so it's published at [prabinpebam.github.io/atiya/docs/](https://prabinpebam.github.io/atiya/docs/).
- To add a page:
  1. Write it in the right folder, with one H1 and a TL;DR.
  2. Register it in `docs-manifest.json`, with a group, an order and a Material Symbols icon.
  3. Link it from its section.
- After a Slate update, run `node slate/scripts/runtime-host.mjs sync --repo . --host documentation`, then `check`.
- This site is the source of truth. A spec that changes while building is updated here, in the same change as the code.
