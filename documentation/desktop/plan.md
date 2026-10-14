# The desktop app: plan and Definitions of Done

How the [desktop app](spec.md) and [navigation modes](modes.md) are built: ten stages, each ending in something the owner can try by hand, each held to its own Definition of Done, all held to the project's. The owner's site keeps working and deploying from `main` throughout: the work happens on the `desktop-app` branch, in its own worktree.

> **TL;DR.**
> - **How:** every stage is built in loops against its Definition of Done: build, run the stage's checks, fix, record the evidence here, commit. A stage is done when every row has its evidence and its "Try it" works by hand.
> - **Stages:** 0 the spec; 1 the owner's app; 2 setup and the agent CLI, on a fake GitHub; 3 the first run in the app, on the fake GitHub; 4 just the site; 5 real GitHub, and private pages on first use; 6 the engine release and the site's build; 7 managed sites in the app; 8 navigation modes; 9 distribution and hand-out.
> - **Project Definition of Done:** the spec's seven promises, measured (§2), plus the owner's site unchanged and every budget kept.
> - **Status:** see §6.

## 1. How each stage is built

1. **Build** the stage's parts, smallest first, pure logic in modules with unit tests.
2. **Check** against the stage's Definition of Done: each row names its evidence (a unit test, an E2E test, a command and its output).
3. **Loop:** fix what fails and check again, until every row passes; a row that can't pass for a reason outside the code (an account, a certificate, a decision) is marked **blocked**, with why and what unblocks it.
4. **Record** the evidence in §6 and the spec's §16, then commit on `desktop-app`.
5. **Hand over** with the stage's **Try it**: the steps that show the outcome by hand.

The worktree is `E:\Projects\Personal\personal-site-desktop` (branch `desktop-app`); the owner's checkout on `main` is never touched by this work.

## 2. Project Definition of Done

| # | Promise | Done when | Evidence |
|---|---|---|---|
| PD1 | P1: live today | A new account on real GitHub goes from opening the app to edit mode in ≤ 3 minutes of its time, and the site answers at its address | The live check, timed (stage 5) |
| PD2 | P2: three choices, no terminal | The setup E2E reaches edit mode with three choices in the app, and no screen before edit mode shows a path, git or a terminal | E2E "desktop: first run" counts the choices; a copy check over the setup screens (stage 3) |
| PD3 | P3: theirs, free, without us | Every repository, secret and setting setup makes is in the person's account; the site builds and serves with the app uninstalled | The fake GitHub's record of calls (stage 2); a build of a site repository on GitHub alone (stage 6) |
| PD4 | P4: just the site, or a mode | A site turns its mode on and off with one switch; a site-only build has no mode code or assets | Stage 4 and 8 tests |
| PD5 | P5: open the app and write | From a closed app, one launch reaches edit mode on the owner's checkout; only quitting the app stops the server | Stage 1 E2E; the owner's own use |
| PD6 | P6: agents | `atiya setup --yes --json` makes a site, a second run changes nothing, and every exit code of spec §5.3 is reachable and tested | Stage 2 tests |
| PD7 | P7: nothing silent | Every failure of spec §4.5 has its words and a way on | Stage 2, 3 and 5 tests |
| PD8 | The owner's site unchanged | His pages, planet, budgets and deploy are as before | `npm run e2e` site groups; `npm run verify:prod` (stages 4, 6, 8) |
| PD9 | Docs | The spec's §16 and this plan's §6 record what was built, and the engineering overview and AGENTS.md say how to run it | Review |

## 3. Stages

### Stage 0: the spec

- **Builds:** the spec v2 (promise, jobs, what people can do, flow decisions, the agent path, the architecture, the critique of v1), [navigation modes](modes.md), this plan.
- **Try it:** read the three pages at `/docs/` under Desktop app.

| # | Done when | Evidence |
|---|---|---|
| 0.1 | The spec runs promise → jobs → what people can do → decisions, and every flow decision says why | The spec |
| 0.2 | Every stage below ends in a Try it and has testable rows | This plan |
| 0.3 | The docs build: diagrams fresh, Slate's check passes, every cross-page link resolves | `build-doc-diagrams.mjs --check`; `runtime-host.mjs check`; the links checked in the viewer |

### Stage 1: the owner's app

- **Builds:** `apps/desktop/`, its own package (Electron 44.6.0, exact pin): the main process (one window, the frame and body views, the tray, single instance, settings); the developer workspace (folder check, remembered); the supervisor (the checkout's `astro dev` on 4321 under the system's Node, readiness, restart with backoff, a taken port named, the process tree stopped on quit); the frame (`app://`, the site's tokens); navigation locked.
- **Try it:** `cd apps/desktop; npm install; npm start`. The app offers the checkout it was started from (choose **Open**), then shows edit mode in its window. Close VS Code: edit mode still works. Close the window: the tray keeps it; **Quit** from the tray stops the server.

| # | Done when | Evidence |
|---|---|---|
| 1.1 | One window: the frame and edit mode of the chosen checkout, from its own dev server on 4321 | E2E with a stand-in server; by hand on the real checkout |
| 1.2 | Started from a checkout, the app offers it; File → Open a source folder chooses another; the choice is remembered; a folder that isn't a checkout is refused with why | Unit (the folder check); E2E (remembered across launches) |
| 1.3 | Closing the window keeps the app and server in the tray; Quit stops the server and its children, freeing the port | E2E |
| 1.4 | A server that exits is restarted after 1, 2, then 4 seconds; then the frame says it stopped, with Restart and the log's last lines | Unit (the backoff); E2E with a server that exits |
| 1.5 | With 4321 taken, the frame names the process and offers Use it and Try again | E2E with the port held |
| 1.6 | Views are sandboxed with context isolation and no Node; a link to another origin opens in the system browser, not the window; the bridge answers only `app://` | Unit (window options, origin rule); E2E (`require` is undefined in the body) |
| 1.7 | The frame passes axe in light and dark and works by keyboard | E2E with axe |

### Stage 2: setup and the agent CLI, on a fake GitHub

- **Builds:** the setup machine (spec §4.4 steps 1 to 9, check and act, its state file, resume); the GitHub client (REST, device flow, scopes); token sources (`env`, `gh`, `device`); git with the token per call; the starter (`starter/`) and its personalisation; a fake GitHub (an HTTP server for the calls setup makes, local bare repositories as remotes, simulated builds and a simulated site address, a record of every call); the CLI `atiya` (`setup`, `status`, `doctor`, `sites`) with words or `--json`.
- **Try it:** `cd apps/desktop; npm run fake-github` in one terminal, then `node bin/atiya.mjs setup --github http://localhost:4390 --token env --yes` with `GH_TOKEN=fake-ada`: the steps tick, and the workspace appears under `%TEMP%\atiya-try\`. Run it again: nothing is made twice. Add `--json` for the agent's view.

| # | Done when | Evidence |
|---|---|---|
| 2.1 | On the fake GitHub, `setup --yes` makes the repository, the workspace (starter, their name, `atiya.json`, the workflow, `AGENTS.md`, `README.md`, `.gitattributes`, `.gitignore`), pushes, turns on Pages, follows the build to live, and exits 0 | Integration test |
| 2.2 | Without `--yes`, and with `--dry-run`, it prints the plan and makes no write call and no file | Integration test (the fake's record; the folder) |
| 2.3 | Stopped after any step's act, a re-run finishes; a second full run makes no create call and no commit | Integration test, every step |
| 2.4 | Exit codes: 10 with an `action` for an unconfirmed email and for device sign-in; 20 for a folder holding another site; 30 for a token without `workflow` (naming `gh auth refresh -s workflow`); 0 on success | Integration tests |
| 2.5 | F5: with `<login>.github.io` taken by a repository that isn't an Atiya site, the site is made as `site` | Integration test |
| 2.6 | Every starter combination (planet on or off, samples on or off) passes the content contract | Unit test through `loadContent` |
| 2.7 | The token is never in stdout, stderr, a written file or git's configuration | Integration test (a scan) |
| 2.8 | The device flow keeps the interval, adds 5 s on `slow_down`, stops on expiry and on a refusal | Unit tests |
| 2.9 | `--json` output is one valid JSON object per line, with `plan`, `step`, `action` and `result` events as spec §5.3 shows | Integration test |

### Stage 3: the first run in the app, on the fake GitHub

- **Builds:** the welcome, Continue with GitHub, Confirm your email, Your site and Creating screens (`app://`), driven by the stage 2 machine through the bridge; edit mode opened on the new site, served by the checkout's engine with `CONTENT_ROOT` at the workspace (until stage 7 bundles the engine); the frame's Going live and Live; resume after a quit.
- **Try it:** `npm start -- --fake-github` (it starts the fake itself, and authorizes the code two seconds after it's shown). Choose **Make my site**, **Continue with GitHub**, **Create my site**: edit mode opens on the new site, and the frame goes from Going live to Live.

| # | Done when | Evidence |
|---|---|---|
| 3.1 | The flow reaches edit mode on the new site with three choices, and the frame shows Going live, then Live | E2E "desktop: first run" |
| 3.2 | The code is copied to the clipboard and GitHub's page opened when Continue with GitHub is pressed | E2E (the clipboard; the opened address recorded) |
| 3.3 | Your site is prefilled from the profile (name, address, the planet card chosen, samples on) | E2E |
| 3.4 | Confirm your email shows only for an unconfirmed account, and carries on by itself once confirmed | E2E |
| 3.5 | Quitting while Creating and starting again resumes at the step it stopped on | E2E |
| 3.6 | The failures of spec §4.5 that the fake can cause show their words and their way on | E2E |
| 3.7 | Each setup screen passes axe in light and dark and works by keyboard; none shows a path, git or a terminal | E2E with axe; a copy check |

### Stage 4: just the site

- **Builds:** the engine reads `atiya.json` (none, as on the owner's site today, means everything on); with no mode on, no `/play/` routes, no game chunks, no planet assets, no Explore link, and a home page without a mode; `atiya.json`'s schema in the content check.
- **Try it:** in the worktree, `npm run build:site-only` builds the starter as just the site; `npx astro preview` shows a site with no Explore button and no `/play/`.

| # | Done when | Evidence |
|---|---|---|
| 4.1 | A site-only build has no `/play/` page, no `game-*` chunk, no texture, model or audio file, no Explore link, and no mode on its home page | Build-output test |
| 4.2 | Without `atiya.json`, or with the owner's, the build is the same as before | `npm run verify:prod`; the site's E2E groups |
| 4.3 | A malformed `atiya.json` fails the build, naming the field | Unit test |

### Stage 5: real GitHub, and private pages on first use

- **Builds:** the OAuth App's client ID in the app (registered by the owner); the device flow against github.com; the keychain; the live check script on a test account; Set up private pages (spec §4.4) in the machine, the CLI and edit mode's Make private.
- **Try it:** with a test account, run the app's first run for real; then make a page private.

| # | Done when | Evidence |
|---|---|---|
| 5.1 | The OAuth App exists with device flow on, and its client ID is in the app | Blocked on the owner: register it under his account |
| 5.2 | A brand-new test account reaches edit mode in ≤ 3 minutes of its time and its site answers | The live check, timed (PD1) |
| 5.3 | The token is stored only through `safeStorage` and survives a restart | Unit (the store); E2E |
| 5.4 | Making the first page private sets up the private repository, read-only key, sealed secret and submodule, and the next build seals it | Integration test on the fake; the live check |

### Stage 6: the engine release and the site's build

- **Builds:** `scripts/pack-engine.mjs`, `release.yml`, the reusable `site-build.yml`; the workflow setup writes points at it.
- **Try it:** `node scripts/pack-engine.mjs --out %TEMP%\engine` lists and packs the engine; a test site repository built by `site-build.yml` from the branch.

| # | Done when | Evidence |
|---|---|---|
| 6.1 | The archive holds nothing from `content/`, `private-pages/`, `modes/prabin-planet/`, `assets-src/`, `documentation/` or `tests/`, and has its sha256 | Unit test of the listing |
| 6.2 | A site repository with only content, `atiya.json` and the workflow builds, seals and deploys; a wrong checksum or commit stops it | The test site's runs |

### Stage 7: managed sites in the app

- **Builds:** the bundled engine (`utilityProcess.fork`, read-only, caches to the data folder), the launch token in the guard, the bundled git, sync and its conflicts, Check my site.
- **Try it:** open a site made in stage 3 from the installed app, with no checkout: edit, save to remote, open it on a second workspace.

| # | Done when | Evidence |
|---|---|---|
| 7.1 | Edit mode on a managed site does everything it does in the browser, with the engine read-only | E2E "desktop: managed site" |
| 7.2 | A browser tab gets 403 from the managed server; the app's views get through | Guard unit tests; E2E |
| 7.3 | Two workspaces' changes merge; one resource changed on both asks which to keep | Sync tests; E2E |
| 7.4 | Check my site and `atiya doctor` report the same checks | Unit test |

### Stage 8: navigation modes

The phases of [navigation modes](modes.md): the host and contract (M1), just the site through the contract (M2), the planet split into Little planet and Prabin's planet (M3), the mode kit (M4), Constellation and the Ways to explore screen (M5); modes from others (M6) after v1.

| # | Done when | Evidence |
|---|---|---|
| 8.1 | The planet runs through the mode host with no visible change, within its budgets | Planet E2E groups; `verify:prod`; `perf:audit` |
| 8.2 | Mode data holds no draft or private item; V33 to V37 refuse what they name | Loader unit tests |
| 8.3 | Little planet holds nothing of the owner's; his site, with his mode, is unchanged | The owner-name scan; planet groups |
| 8.4 | Both planets, Constellation and the template pass R1 to R11; a mode built to break each fails | `atiya-mode check` |
| 8.5 | Ways to explore turns modes on and off, maps slots and picks the first way in | E2E "editor: ways to explore" |

### Stage 9: distribution and hand-out

- **Builds:** signing, auto-update, the installer, macOS, Keep a copy of the engine, Update your site; a security review; accessibility review; a study with five people who don't write code; support pages.

| # | Done when | Evidence |
|---|---|---|
| 9.1 | A signed installer installs per user and updates itself, never during a save | The release pipeline; E2E with two versions |
| 9.2 | The security review's findings are fixed or accepted in writing | The review |
| 9.3 | Five people who don't write code each reach a live site unaided | The study's notes |

## 4. Order

Stages 1 and 2 need only stage 0, and can run side by side; 3 needs both. 4 needs only 0. 5 needs 3 and the owner's OAuth App. 6 needs 4. 7 needs 3 and 6. 8 needs 4. 9 needs everything. The owner can use stage 1's app as soon as it's done.

## 5. Tests

- **Unit** (Vitest, `apps/desktop/test/` and `tests/unit/`): the supervisor's backoff and the folder check; window options and the origin rule; the setup machine against the fake GitHub (every step, interrupted, run twice); the device flow; token sources; the redactor; the starter through the content contract; `atiya.json`'s schema.
- **Integration** (Vitest, real HTTP and real git on temporary folders): the CLI against the fake GitHub.
- **E2E** (Playwright's Electron support, `apps/desktop/e2e/`): the app with a stand-in server, and the first run on the fake GitHub. Run through `scripts/test-run.mjs` when they touch the site's server; the app's own E2E start nothing on 4321.
- **Live** (on purpose only, stage 5): a test account on real GitHub; never in CI, never the owner's account.

## 6. Status

| Stage | State | Evidence |
|---|---|---|
| 0 | Done | The spec v2, modes, this plan; docs checks pass |
| 1 to 9 | Not started | — |
