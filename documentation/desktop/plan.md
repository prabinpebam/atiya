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
- **Try it:** in `apps/desktop`, start the fake GitHub in one terminal (`npm run fake-github`), then in another: `$env:GH_TOKEN='fake-ada'; node bin/atiya.mjs setup --github http://localhost:4390 --token env --dir $env:TEMP\atiya-try --yes`. The steps tick to Done in a few seconds, and the site's files are in `%TEMP%\atiya-try`. Run it again: nothing is made twice. Leave out `--yes` to see the plan alone; add `--json` for an agent's view; `node bin/atiya.mjs doctor --github http://localhost:4390 --dir $env:TEMP\atiya-try` checks it.

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
- **Try it:** in `apps/desktop`, `npm start -- --fake-github` (it starts a fake GitHub inside the app, and authorizes the code two seconds after it's shown; real `astro dev` runs for the new site on port 4325, so the first start takes about a minute). Choose **Make my site**, **Continue with GitHub**, **Create my site**: edit mode opens on the new site, and the frame goes from Going live to Live, with Open my site. The site's files are in `%USERPROFILE%\Atiya\ada.github.io`; delete that folder and the app's data (`%APPDATA%\atiya-studio`) to try again from the start.

| # | Done when | Evidence |
|---|---|---|
| 3.1 | The flow reaches edit mode on the new site with three choices, and the frame shows Going live, then Live | E2E "desktop: first run" |
| 3.2 | The code is copied to the clipboard and GitHub's page opened when Continue with GitHub is pressed | E2E (the clipboard; the opened address recorded) |
| 3.3 | Your site is prefilled from the profile (name, address, the planet card chosen, samples on) | E2E |
| 3.4 | Confirm your email shows only for an unconfirmed account, and carries on by itself once confirmed | E2E |
| 3.5 | Quitting while Creating and starting again resumes at the step it stopped on | E2E |
| 3.6 | The failures of spec §4.5 that the fake can cause show their words and their way on | E2E |
| 3.7 | Each setup screen passes axe in light and dark and works by keyboard; none shows a path, git or a terminal | E2E with axe; a copy check |

### Stage 4: just the site, and nothing of the owner's

Found while checking stage 3 by hand: a new site's header said the owner's name (it was `SITE_NAME` in code), and a site made with Just the site couldn't build at all (`play.astro` threw without a planet structure). So this stage makes the engine any site's.

- **Builds:**
  - **The site's identity from its content:** `integrations/editor.mjs` defines, from the content in use, the site's name (`content/site.json`; a rename in Settings restarts the dev server), the host its links stay in the tab for (`SITE_URL`'s, else its git remote's `<owner>.github.io`) and its features (`integrations/features.mjs`).
  - **The features:** the planet when the content has a planet structure; the design library and the documentation for the engine's own repository, and for a managed site only if its `atiya.json` turns them on.
  - **Just the site:** no Explore link (header or footer), no planet on the home page, `/play/` sends home, and `integrations/site-only.mjs` removes the game's chunks, the planet's assets, `/design/` and `/docs/` from what a build writes.
  - **The check:** `scripts/build-starter.mjs` builds the starter as Ada Lovelace's site, with or without the planet, and checks the output.
- **Try it:** in the worktree, `npm run build:site-only` (about 2 minutes) prints each check; `npx astro preview` then shows Ada Lovelace's site with no Explore button, no planet and no `/play/`. `npm run build:starter` does the same with the planet. Both put this checkout's own content back when they finish.

| # | Done when | Evidence |
|---|---|---|
| 4.1 | A site-only build has no game chunk, no planet asset, no design library or documentation, no link to `/play/`, `/design/` or `/docs/`, no planet on its home page, and `/play/` sends home | `npm run build:site-only`: every check passes |
| 4.2 | The owner's site is the same as before: its budgets, its pages, its links | `npm run verify:prod`; the E2E groups "landing & classic" and "site design system" |
| 4.3 | A site built from the starter names itself, not the engine's owner, in its header, titles and pages (except the access agreement's words, O14, and the planet's host until stage 8, O5) | `build-starter.mjs`'s checks, with and without the planet |
| 4.4 | The design system's rules still hold for every changed component | `tests/unit/siteDesignSystem.test.ts` and the unit tests of the changed modules |

`atiya.json` is checked by `atiya doctor` today; the build checks it in stage 6 (its schema) and stage 8 (its modes).

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

- **Builds:** `scripts/pack-engine.mjs` (`git archive` of the commit through the allow-list, then checked against the listing, with its manifest: version, commit, sha256), `.github/workflows/release.yml` (on an `engine-v*` tag: tests, the type check, the starter built both ways, pack, publish), the reusable `.github/workflows/site-build.yml`, and `scripts/site-build-local.mjs`, which rehearses the workflow's steps on this computer. Setup pins a release's manifest when it has one (`ATIYA_ENGINE_MANIFEST`, or `engine.json` in a bundled engine).
- **Try it:** `node scripts/pack-engine.mjs --out %TEMP%\engine-rel` packs the engine (about 12 MB). Make a site pinned to it (stage 2's Try it, with `$env:ATIYA_ENGINE_MANIFEST='%TEMP%\engine-rel\engine-0.1.0.json'`), then `node scripts/site-build-local.mjs --engine %TEMP%\engine-rel\engine-0.1.0.tgz --site <its folder> --keep` builds it as GitHub would, and keeps the built site beside the folder.

| # | Done when | Evidence |
|---|---|---|
| 6.1 | The archive holds nothing from `content/`, `private-pages/`, `modes/prabin-planet/`, `assets-src/`, `documentation/`, `tests/` or `.env`, holds the one file of `contact-api/` the site imports (its rules), and has its sha256 | `tests/unit/packEngine.test.ts`; the packer checks the archive against its listing |
| 6.2a | A site with only content, `atiya.json` and the workflow builds from the archive, seals, passes the leak check and is the person's site; a wrong checksum or commit stops it | `site-build-local.mjs`: every step passes in 75 s; a wrong checksum fails, naming both |
| 6.2b | The same on GitHub: a released engine and a test site repository deploy | Blocked on the owner: push an `engine-v0.1.0` tag (merging this branch first), and a test account's site repository |

### Stage 7: managed sites in the app

- **Builds:**
  - **The bundled engine:** `apps/desktop/scripts/bundle-engine.mjs --engine <engine-x.y.z.tgz>` unpacks a release (stage 6) with its production dependencies into `apps/desktop/engine/` (about 335 MB; gitignored), and the packaged app carries it in its resources. A managed site's server runs on it with `utilityProcess.fork` (`src/main/utility-spawn.mjs`), with Vite's and Astro's caches in the app's data folder (`ATIYA_CACHE_DIR`).
  - **The launch token:** the main process makes one per start, gives it to the server (`ATIYA_LAUNCH_TOKEN`) and adds it to every request its views send to that port; `integrations/launch.mjs` answers anything without it with 403.
  - **The bundled git:** dugite's git (`src/core/setup/bundled-git.mjs`) for setup, sync and the server's own git (`editGitEnv` in `main.mjs`: on the PATH first, no system configuration, the author from `atiya.json`).
  - **Sync and Check my site:** sync before opening (`src/core/setup/sync.mjs`, with its conflict page `sync.html`), and Check my site (`check.html`) from the same checks as `atiya doctor` (`src/core/setup/doctor.mjs`).
  - **Edit mode without the owner's tools:** a managed site's edit mode has no Tests screen and no checks group, and no Planet screen without the planet; its dashboard speaks of saving to the site, not of git.
  - **A quiet restart:** a new site name restarts the dev server only once edit mode has had no call in flight for 1.5 s, so a Save to remote sent just after a rename keeps its answer.
- **Try it:** in the worktree, `node scripts/pack-engine.mjs --out %TEMP%\engine-rel`, then `node apps/desktop/scripts/bundle-engine.mjs --engine %TEMP%\engine-rel\engine-0.1.0.tgz`. Start the app on a fake GitHub (stage 3's Try it) with `ATIYA_DEV_SERVER` empty: Make my site opens the real edit mode on the bundled engine (about a minute the first time). Rename the site in Settings and save to remote: the change reaches the fake's repository, by the person's no-reply address. Open `http://localhost:4325/` in a browser: it says the site is open in Atiya Studio. Check my site lists the checks `node apps/desktop/bin/atiya.mjs doctor` prints.

| # | Done when | Evidence |
|---|---|---|
| 7.1 | Edit mode on a managed site runs on the bundled engine with no checkout or developer tools, saves and saves to remote; the engine's files are left as they were, apart from Astro's own `.astro/` folder | The hand check below; E2E "desktop: managed site" (on the stand-in server) |
| 7.2 | A browser tab gets 403 from the managed server; the app's views get through | Guard unit tests; E2E 7.2 |
| 7.3 | Two workspaces' changes merge; one resource changed on both asks which to keep | Sync tests; E2E 7.3 |
| 7.4 | Check my site and `atiya doctor` report the same checks | Unit test; E2E 7.4 |
| 7.5 | Setup, sync and Save to remote use the bundled git, not the computer's | Unit tests (the `Git` class defaults to it); the hand check's commit |

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
| 1 | Done | 18 unit tests (`apps/desktop/test/stage1.test.mjs`) and 7 E2E tests (`apps/desktop/e2e/stage1.spec.mjs`), one per row, all passing; by hand: the app ran this checkout's own `astro dev` and showed edit mode's dashboard 37 s after Open this checkout, and Quit freed the port. Found on the way: Astro 7's entry is `bin/astro.mjs` (read from its package.json now); Windows can report a listening socket as CLOSED or with no state (a listener is now one with no remote end); npm skipped Electron's binary download (`postinstall` runs it) |
| 2 | Done | 21 tests in `apps/desktop/test/stage2.test.mjs` (real HTTP to the fake GitHub, real git, the CLI run as an agent would) and 5 in `tests/unit/starter.test.ts` (every starter through the content contract), all passing. By hand: the whole flow on the fake took 5 s; a second run made no write call. Found on the way: a `safe.bareRepository=explicit` git setting refuses bare repositories found by folder (the fake names them with `--git-dir`); exiting while fetch's sockets close crashed Node on Windows (the CLI sets `exitCode`); `doctor --json` printed words too |
| 3 | Done | 7 E2E tests in `apps/desktop/e2e/stage3.spec.mjs` (the app on the fake GitHub, with a stand-in dev server that reports whose content it was given), all passing, with stage 1's 7 still passing after the new welcome. Screens checked by eye in light and dark. Found on the way: this session has no system clipboard (even PowerShell's reads back empty), so the tests read what the app copied from a log; the first screen's focus was lost when the page loaded after its phase had changed |
| 4 | Done | `npm run build:site-only`: every check passes (Ada Lovelace's site, no game chunk, no planet asset, no design library or docs, no link to any of them, `/play/` sends home); `npm run build:starter`: the planet's site builds, naming the owner only on the planet's page (O5); `npm run verify:prod` on the owner's site: every budget met; the E2E groups "landing & classic" and "site design system": 26 of 27 pass. The one failure is the docs half of "links keep the parent domain in this tab", which fails on `main` too: the Slate runtime refreshed in `0db18bf` no longer reads `parentDomain` (an upstream Slate issue; the site half, which this stage changed, passes). Unit: 383 tests across the six affected files |
| 5 | Blocked | Needs the owner: register the OAuth App (O8) and a GitHub test account for the live check. The app already signs in with the GitHub CLI's token or `GH_TOKEN` until then, and the CLI works against real GitHub today (it makes public repositories: run it only on purpose) |
| 6 | Done here; on GitHub blocked | 6.1: `packEngine.test.ts` (3 tests) and the packer's own check (673 files, 12.4 MB). 6.2a: the rehearsal built a site made by setup from the archive in 75 s and refused a wrong checksum. Found on the way: the site imports the contact form's rules from `contact-api/src/rules.mjs` (now in the engine), the docs integration threw without `documentation/` (now it skips), and `.env` (the owner's contact endpoint) must stay out. 6.2b needs a released tag and a test repository |
| 7 | Done | 46 app unit tests (`stage7.test.mjs`: sync merges, conflicts and choices; the shared checks; the launch token) and 17 app E2E tests (stage 7's 7.2–7.4 on the stand-in server), all passing. By hand on the real bundled engine under `utilityProcess`: Make my site reached edit mode's dashboard in 52 s; a plain request got 403; a rename in Settings saved, and Save to remote committed as `Ada Lovelace <1001+ada@users.noreply.github.com>` with the bundled git and reached the fake's repository; the restarted server showed the new name. The engine's only writes were Astro's `.astro/` files. Found on the way: renaming the site restarted the server under a Save to remote that followed it, so Chromium sent the POST again and got "there is nothing to save" (the restart now waits for edit mode to be quiet); a managed server pushing to real GitHub needs the token, so the app gives it to that one process as git configuration in its environment (`GIT_CONFIG_*`), not per push as spec §7.5 has it (recorded in spec §16) |
| 8 | Not started | The planet split and the mode host: unblocked, large (it moves `src/game/`) |
| 9 | Blocked | Needs a code-signing certificate, an Apple Developer account and five study participants |
