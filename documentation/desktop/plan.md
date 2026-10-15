# The desktop app: plan and Definitions of Done

How the [desktop app](spec.md) and [navigation modes](modes.md) are built: eleven stages, each ending in something the owner can try by hand, each held to its own Definition of Done, all held to the project's. The owner's site keeps working and deploying from `main` throughout: the work happens on the `desktop-app` branch, in its own worktree.

> **TL;DR.**
> - **How:** every stage is built in loops against its Definition of Done: build, run the stage's checks, fix, record the evidence here, commit. A stage is done when every row has its evidence and its "Try it" works by hand.
> - **Stages:** 0 the spec; 1 the owner's app; 2 setup and the agent CLI, on a fake GitHub; 3 the first run in the app, on the fake GitHub; 4 just the site; 5 real GitHub, and private pages on first use; 6 the engine release and the site's build; 7 managed sites in the app; 7A the app's own window (one title bar row); 7B edit mode's header in that row; 7C who's signed in and which site; 7D one theme for the whole app; 8 navigation modes; 9 distribution and hand-out; 10 one engine, two builds (the owner's site stays on source, and both builds are proven the same).
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

- **Builds:** the OAuth App's client ID in the app (registered by the owner); the device flow against github.com; the keychain; the live check script on a test account; Set up private pages (spec §4.4) in the machine, the CLI and edit mode.
  - **Private pages** (`src/core/setup/private.mjs`): four steps, each a check and an act: the private repository `<site>-private`, its first files (no pages, no codes, the share message with the site's address), the build's key (an ed25519 deploy key, read-only, made in memory by `sshkey.mjs` in OpenSSH's format, its private half sealed into the site's `PRIVATE_CONTENT_KEY` secret by `seal.mjs` with libsodium 0.8.4; made again together if either is missing) and the `private-pages` submodule, committed and pushed.
  - **Where people meet it:** on a managed site without private pages, edit mode's New article dialog, a page's settings and the Access screen offer "set up private pages", a link to the app's own page (`private.html`, the bridge's `privatePages`); when it's done, the server starts again and the access choice appears. Agents run `atiya private setup --yes --json`.
  - **The token across a restart:** the app quits gracefully (never `app.exit`), so Chromium writes the key safeStorage uses.
- **Try it:** start the app on a fake GitHub with the real engine (stage 7's Try it), make a site, choose New article: the dialog offers "set up private pages". Follow it, choose Set up private pages, then Back to edit mode: New article now asks who can see it. Quit, start the app again: Check my site shows the site connected to GitHub, without signing in again. With a test account, run the first run for real (5.2).

| # | Done when | Evidence |
|---|---|---|
| 5.1 | The OAuth App exists with device flow on, and its client ID is in the app | Blocked on the owner: register it under his account |
| 5.2 | A brand-new test account reaches edit mode in ≤ 3 minutes of its time and its site answers | The live check, timed (PD1) |
| 5.3 | The token is stored only through `safeStorage` and survives a restart | E2E 5.3: no file holds it in the clear, and Check my site reaches GitHub after a restart |
| 5.4 | Making the first page private sets up the private repository, read-only key, sealed secret and submodule, and the next build seals it | `test/stage5.test.mjs` (the key read by `ssh-keygen`, the seal, the machine on the fake: its result, a second and a dry run, a resume after each step, a lost secret, a public namesake, the CLI); E2E 5.4; the starter test (the first files pass the content contract); the build rehearsal below; on GitHub: the live check |

### Stage 6: the engine release and the site's build

- **Builds:** `scripts/pack-engine.mjs` (`git archive` of the commit through the allow-list, then checked against the listing, with its manifest: version, commit, sha256), `.github/workflows/release.yml` (on an `engine-v*` tag: tests, the type check, the starter built both ways, pack, publish), the reusable `.github/workflows/site-build.yml`, and `scripts/site-build-local.mjs`, which rehearses the workflow's steps on this computer. Setup pins a release's manifest when it has one (`ATIYA_ENGINE_MANIFEST`, or `engine.json` in a bundled engine).
- **Try it:** `node scripts/pack-engine.mjs --out %TEMP%\engine-rel` packs the engine (about 12 MB). Make a site pinned to it (stage 2's Try it, with `$env:ATIYA_ENGINE_MANIFEST='%TEMP%\engine-rel\engine-0.1.0.json'`), then `node scripts/site-build-local.mjs --engine %TEMP%\engine-rel\engine-0.1.0.tgz --site <its folder> --keep` builds it as GitHub would, and keeps the built site beside the folder.

| # | Done when | Evidence |
|---|---|---|
| 6.1 | The archive holds nothing from `content/`, `private-pages/`, `modes/cozy-life/`, `assets-src/`, `documentation/`, `tests/` or `.env`, holds the one file of `contact-api/` the site imports (its rules), and has its sha256 | `tests/unit/packEngine.test.ts`; the packer checks the archive against its listing |
| 6.2a | A site with only content, `atiya.json` and the workflow builds from the archive, seals, passes the leak check and is the person's site; a wrong checksum or commit stops it | `site-build-local.mjs`: every step passes in 75 s; a wrong checksum fails, naming both |
| 6.2b | The same on GitHub: a released engine and a test site repository deploy | Blocked on the owner: push an `engine-v0.1.0` tag (merging this branch first), and a test account's site repository |

### Stage 7: managed sites in the app

- **Builds:**
  - **The bundled engine:** `apps/desktop/scripts/bundle-engine.mjs --engine <engine-x.y.z.tgz>` unpacks a release (stage 6) with its production dependencies into `apps/desktop/engine/` (about 335 MB; gitignored), and the packaged app carries it in its resources. A managed site's server runs on it with `utilityProcess.fork` (`src/main/utility-spawn.mjs`), with Vite's and Astro's caches in the app's data folder (`ATIYA_CACHE_DIR`).
  - **The launch token:** the main process makes one per start, gives it to the server (`ATIYA_LAUNCH_TOKEN`) and adds it to every request its views send to that port; `integrations/launch.mjs` answers anything without it with 403.
  - **The bundled git:** dugite's git (`src/core/setup/bundled-git.mjs`) for setup, sync and the server's own git (`editGitEnv` in `main.mjs`: on the PATH first, no system configuration, the author from `atiya.json`).
  - **Sync and Check my site:** sync before opening (`src/core/setup/sync.mjs`, with its conflict page `sync.html`), and Check my site (`check.html`) from the same checks as `atiya doctor` (`src/core/setup/doctor.mjs`).
  - **Edit mode without the owner's tools:** a managed site's edit mode has no Tests screen and no checks group, and no Planet screen without the planet; its dashboard speaks of saving to the site, not of git.
  - **A quiet restart:** a new site name restarts the dev server only once edit mode has had no write in flight for 1.5 s, so a Save to remote sent just after a rename keeps its answer. (Reads aren't counted: the Tests screen's status is a stream that never ends, which held the restart off in the owner's own edit mode until stage 8A found it.)
- **Try it:** in the worktree, `node scripts/pack-engine.mjs --out %TEMP%\engine-rel`, then `node apps/desktop/scripts/bundle-engine.mjs --engine %TEMP%\engine-rel\engine-0.1.0.tgz`. Start the app on a fake GitHub (stage 3's Try it) with `ATIYA_DEV_SERVER` empty: Make my site opens the real edit mode on the bundled engine (about a minute the first time). Rename the site in Settings and save to remote: the change reaches the fake's repository, by the person's no-reply address. Open `http://localhost:4325/` in a browser: it says the site is open in Atiya Studio. Check my site lists the checks `node apps/desktop/bin/atiya.mjs doctor` prints.

| # | Done when | Evidence |
|---|---|---|
| 7.1 | Edit mode on a managed site runs on the bundled engine with no checkout or developer tools, saves and saves to remote; the engine's files are left as they were, apart from Astro's own `.astro/` folder | The hand check below; E2E "desktop: managed site" (on the stand-in server) |
| 7.2 | A browser tab gets 403 from the managed server; the app's views get through | Guard unit tests; E2E 7.2 |
| 7.3 | Two workspaces' changes merge; one resource changed on both asks which to keep | Sync tests; E2E 7.3 |
| 7.4 | Check my site and `atiya doctor` report the same checks | Unit test; E2E 7.4 |
| 7.5 | Setup, sync and Save to remote use the bundled git, not the computer's | Unit tests (the `Git` class defaults to it); the hand check's commit |

### Stage 7A: the app's own window

The window the app draws itself, with one title bar row (spec §7.2), from the owner's focus-notes: no system title bar or menu bar, 20 px corners, a shadow margin, and every way of managing a window that a system frame gives, done by the app.

- **Builds:** `src/core/window/` (geometry, placement, the window controller); `src/main/window-frame.mjs`; the frame's page (`frame.html`, `frame.css`, `frame.js`); the main process's layout (the body as an inset card), raising the frame for a popover, and the app's menu as a popup.
- **Try it:** open the app. Drag it by the bar to a screen's top edge (a preview, then maximized) or side; resize it from an edge; rest on Maximize (Snap Layouts); click the dot by Open in browser (the server's details and Restart); right-click the bar or press Alt+Space (the menu); quit and open it again (where you left it).

| # | Done when | Evidence |
|---|---|---|
| 7A.1 | One row: no system title bar or menu bar; the logo (the menu), the title, Edit mode \| Site, Open in browser, the server's dot, going live with its actions, and Minimize, Maximize and Close; the body starts under the bar as an inset card | E2E `stage7a.spec.mjs` 7A.1; the window composited from its views, by eye |
| 7A.2 | 20 px corners and a shadow margin at rest, whose clicks pass through; square and marginless maximized or snapped | Unit `window.test.mjs` (the hit zones, the margin passing clicks); E2E 7A.2 |
| 7A.3 | Moved by the bar, resized from every edge and corner, snapped at screen edges with a preview, maximized by a double-click on the bar and by Win+↑, restored by dragging; keyboard Move and Size; Snap Layouts on Maximize | Unit (moving, snapping, restoring under the pointer, resizing, keyboard Move); E2E 7A.2, 7A.4 |
| 7A.4 | The server's popover shows the details and Restart or Use it, over the body; Esc or a press elsewhere closes it, and focus goes back | E2E 7A.3 |
| 7A.5 | The app's menu from the logo (and Alt+Space, a right-click on the bar) holds the menu bar's commands and the window's; the place, size and state are remembered | E2E 7A.5; unit (placement) |
| 7A.6 | axe passes in light and dark, the popover open and closed; every control works by keyboard; 44 px targets | E2E 1.7, 7A.1, 7A.3 |
| 7A.7 | Stages 1, 3, 5 and 7 still pass | The app's E2E suite |

### Stage 7B: one row, with edit mode's header in it

Stage 7A's row sat above edit mode's own header, so the window had two rows. Edit mode's header (its title, its tools, the save status, the theme, Save to remote) now lives in the app's one row, and edit mode draws none of its own in the app.

- **Builds:** `src/site/editor/scripts/studio.ts` (reading the hidden header, publishing it, running commands) and `EditorLayout` in the app (`data-studio`); the app's request header, its narrow bridge for edit mode and its checks (`src/core/studio-header.mjs`); the row's drawing of it (`frame.js`, `frame.css`), its squeezing by priority and its following edit mode's theme; test launches that never take focus.
- **Try it:** open the app on edit mode: one row. Open an article: its breadcrumb, tags and tools are in the row; Undo, the device widths, the theme and Save to remote work from there. Narrow the window: the save status and Tests keep their marks, then the tags go; the window's controls never do.

| # | Done when | Evidence |
|---|---|---|
| 7B.1 | In the app, edit mode draws no header row; in a browser it does | E2E `editor-studio.spec.ts`; app E2E 7B.1 (the request header asked, a browser not) |
| 7B.2 | The row draws the screen's title after the start and its controls before the window's, in one line, in the header's order | App E2E 7B.1 (positions measured); the real app captured on the dashboard and an article |
| 7B.3 | Each of the row's controls presses edit mode's own; a choice (the theme) goes through and the row follows it | App E2E 7B.2; `editor-studio.spec.ts` (the theme applied, Save to remote, a device width pressed) |
| 7B.4 | The description and the commands are checked: plain words of bounded length, icons by name, known kinds; nothing from any other page | Unit `studio.test.mjs` |
| 7B.5 | A full row keeps the window's controls and the screen's tools, squeezing the rest by priority | The real app's article at 1440 px, captured |
| 7B.6 | axe passes on the row in light and dark with a header drawn; keyboard: the choice menu by arrows, focus back on its button | App E2E 7B.2 |
| 7B.7 | The app's tests never take focus from the person at the computer | A foreground sampler during the app's E2E: the foreground stayed with the person's own windows |

### Stage 7C: who's signed in, which site, signing out

- **Builds:** the account button and its popover in the row (`frame.html`, `frame.js`, `frame.css`); the account in the main process (read from the stored token at start, refreshed by any sign-in), a source checkout's GitHub repository from its remote, the remembered sites, switching between them; signing out and signing in from the menu (`SetupFlow.signInOnly`); the pure `src/core/account.mjs`.
- **Try it:** open the account button at the row's end: who's signed in, Sign out, your sites. Sign out (it asks once), then Sign in with GitHub. With two sites remembered, choose the other: it opens.

| # | Done when | Evidence |
|---|---|---|
| 7C.1 | The row shows who's signed in to GitHub and which site is open, and says both to screen readers | App E2E `stage7c.spec.mjs` 7C.1 |
| 7C.2 | Every remembered site is listed with its address, the open one first and marked; choosing another opens it | App E2E 7C.2; unit `account.test.mjs` |
| 7C.3 | Sign out asks once, forgets the token (none left on disk), and the app keeps working signed out; Sign in brings it back without leaving where you were | App E2E 7C.1 |
| 7C.4 | axe passes on the popover in light and dark; it works by keyboard (focus in, Esc back to the button) | App E2E 7C.1 |
| 7C.5 | Every setup screen captured, light and dark, for the owner's review | The tour: 21 screens in `atiya-review/setup-flow/`, with an index |

### Stage 7D: one theme for the whole app

| # | Done when | Evidence |
|---|---|---|
| 7D.1 | The title bar's left group holds the colour theme; the bar, the app's pages, edit mode and the site all follow it, and it's remembered | App E2E `stage7d.spec.mjs` |
| 7D.2 | The site and edit mode never choose their own theme in the app: their switches are hidden there, and edit mode's isn't in the row; in a browser they keep theirs | App E2E 7D.1 (the site's switch hidden); `editor-studio.spec.ts` |
| 7D.3 | The site's stored choice is written exactly (and cleared for the system's), never anything else | Unit `theme.test.mjs` |

### Stage 8: navigation modes

The phases of [navigation modes](modes.md): the host and contract (M1), just the site through the contract (M2), the planet split into Little planet and Cozy life (M3), the mode kit (M4), Constellation and the Ways to explore screen (M5); modes from others (M6) after v1.

| # | Done when | Evidence |
|---|---|---|
| 8.1 | The planet runs through the mode host with no visible change, within its budgets | Planet E2E groups; `verify:prod`; `perf:audit` |
| 8.2 | Mode data holds no draft or private item; V33 to V37 refuse what they name | `tests/unit/modes.test.ts`: the data on the starter with a draft and a private page; each rule raised alone by a case built to break it; the owner's site passes; the content load refuses a site that breaks one |
| 8.3 | Little planet holds nothing of the owner's; his site, with his mode, is unchanged | The owner-name scan; planet groups |
| 8.4 | Both planets, Constellation and the template pass R1 to R12 (section triggers included); a mode built to break each fails | `atiya-mode check` |
| 8.5 | Ways to explore turns modes on and off, maps slots and picks the first way in | E2E "editor: ways to explore" |

#### Stage 8A: ways to explore, on and off (the next set)

The part of stage 8 that delivers PD4 (one switch turns a mode on and off) before the planet is split, built in its own worktree (`E:\Projects\Personal\personal-site-ways`, branch `ways-to-explore`, from `desktop-app`). It comes first because it's the part a person sees: the planet becomes optional for any site, the owner's included, from edit mode.

- **Decision (D-W1): which ways in are on is content, not `atiya.json`.** It's the site's own editorial choice, made in edit mode, so it lives where edit mode writes: `content/structures/ways.json`, through the store (versions, the content check before any byte, rollback, live updates), saved by Save to remote with the rest, and checked by the content contract (V33 to V37). `atiya.json` keeps what the app and the build own: the engine's pin, the contract, the owner and the developer features. Without a ways file (the engine's own repository, and sites made before this), a site with a planet structure has Little planet on and offered first, which is how its home page behaves today.
- **Builds:**
  - **The ways file** in the content contract (`schema.ts`: `ways`, strict), read by `loadContent` into `index.ways`; `effectiveWays(index)` gives the file's, or the default above. `loadContent` checks V33 to V37 against it (the rules move from the repository into the loader), so a bad change is refused by the store with 422, naming the rule.
  - **The planet follows it** (`integrations/features.mjs`): `planet` is on when the effective ways have Little planet on, not when `planet.json` exists. Off: no Explore link, no planet on the home page, no game chunks or planet assets in `dist/` (`site-only.mjs`, as stage 4), and `/play/` is a small static page that says the site doesn't offer that way of exploring, with a link home and `noindex` (modes §2), not a redirect. The planet's structure stays (V37).
  - **Edit mode's Ways to explore screen** (`/_edit/ways/`, in the Site group): each of the engine's modes with its name, summary and a switch; the first way in offered on the home page (the site, or a mode that's on); one Save. It goes through `PUT /_edit/api/ways` (the store, with its version). Turning Little planet on for a site without a planet structure writes a starting map in the same transaction (the seven buildings shown the first seven sections, with their names and the sections' words); a site with fewer than seven sections is told it needs seven. The Planet screen shows only while the planet is on.
  - **The server follows the switch:** a change of what's on restarts the dev server (when edit mode is quiet, as a new name does); the screen waits for the restart, then shows the result.
  - **Setup writes the ways file** from the first run's choice; `atiya.json` loses `modes` and `primary`. (Only test sites were made with them there; they're ignored now.)
- **Try it:** in the worktree, `node scripts/editor-test-server.mjs`, open `http://localhost:4330/_edit/ways/`. Turn Little planet off and save: the server starts again, the header has no Explore link, the home page no planet, `/play/` says the site doesn't offer it, and the Planet screen is gone. Turn it back on: the buildings are as they were. Save to remote lists `content/structures/ways.json`.

| # | Done when | Evidence |
|---|---|---|
| 8A.1 | The ways file is part of the content contract: strict, optional, read into the index; without it, a site with a planet structure has Little planet on and offered first | `tests/unit/ways.test.ts` |
| 8A.2 | The loader holds the ways to V33 to V37: a change that breaks one is refused by the store (422, nothing written), naming the rule | Unit: `loadContent` on each broken case; the store's refusal |
| 8A.3 | The planet is on exactly when the effective ways say so, for the engine's own repository and for a managed site | Unit: `siteFeatures` with and without a ways file, on and off |
| 8A.4 | With the planet off, the site has no Explore link, no planet on its home page, no game chunk or planet asset in `dist/`, and `/play/` is the "not offered" page (`noindex`, a link home); the planet's structure is kept | `build-starter.mjs --planet-off` (the starter with a planet structure and Little planet off): every check passes |
| 8A.5 | Ways to explore turns Little planet off and on, and picks the first way in; the server starts again and the site follows; turning it on without a planet structure writes the starting map, or says seven sections are needed | E2E "editor: ways to explore" (`--project=editor`); unit tests of the starting map and the screen's model |
| 8A.6 | The screen meets edit mode's rules: tokens only, `saveStatus` for the save, every wait named, keyboard and axe in light and dark | The E2E above; `siteDesignSystem.test.ts` |
| 8A.7 | Setup writes the ways file from the first run's choice, and `atiya.json` holds no `modes` | `apps/desktop/test/stage2.test.mjs`; `tests/unit/starter.test.ts` |
| 8A.8 | The owner's site is unchanged: its planet, budgets and pages | `npm run verify:prod`; the planet E2E tests "fast travel from the menu reaches the landmark" and "reading theme"; the "landing & classic" group |
| 8A.9 | The docs say what was built: modes.md (D-W1, §2, §14), the desktop spec's `atiya.json` (§6.3), the editor spec's screens, AGENTS.md | Review; the docs checks |

#### Before M1: the baseline and the sign-offs

M1 to M3 move the planet (162 files under `src/game/`, and about 60 test files that name them) and change its loading, so they start from a measured baseline on the branch they'll be built on, and with the decisions they depend on taken.

| # | Done when | Evidence |
|---|---|---|
| B.1 | The branch has everything on `main`, and planet work on `main` waits until M3 lands (or the branch is merged first) | `ways-to-explore` merged with `main` (`5859750`): 0 commits behind; nothing on `main` had touched `src/game/` since the branch began |
| B.2 | The unit suite is green with no known failures | `cursors.css` pinned to LF in `.gitattributes`; the whole suite passes (1,370 tests) |
| B.3 | The full E2E suite's result on the branch is recorded, so a later failure is known to be new | 232 tests, run while another project's tests loaded the machine: 201 passed, 6 failed, 25 didn't run (the editor project stops at its first failure). Rerun alone, two passed (the compass, the swing: the load). Two failed on `main` too, so they predate the branch: the docs half of "links keep the parent domain" (the Slate runtime ignores `parentDomain`) and the editor's "a rich copy keeps its formatting" (its pasted markdown differs; this session also has no system clipboard). The other two, the character picker's ring and Prabin's welcome, passed on `main` and failed on the branch: 8A's `play.astro` imported the "not offered" component, which bundled the site's layout styles into the planet's page. Fixed (`658e620`): both pass, with the Ways to explore E2E; `/play/` loads one stylesheet again, as on `main`. The 25 editor tests that didn't run, and the rich-copy test, are left for M1's first full run |
| B.4 | The planet's performance on a real GPU is recorded: load, frame times, the scene's census, no NaN pixels | `npm run perf:audit` (4 runs, median), on the branch's test build and on `main`'s, each twice, under the same load: the same within run-to-run variation. Branch: live 1.89–1.92 s (shader warm-up about 0.6 s), complete 3.6 s, GPU 2.9–3.2 ms and JS 4.5–4.9 ms a frame, 262–265 draw calls, 1.511 M triangles, 828 k vertices, 89 programs, 94 shadow casters, 73 textures, 0 NaN pixels. `main`: live 1.88–1.95 s, GPU 3.1–3.3 ms, JS 4.6–4.8 ms, 262–265 calls, the same census. Another project's tests were running on the machine, so the timings are noisy; the census and the NaN check don't depend on it |
| B.5 | The owner signs off what M1 to M3 need | See the decisions below |

**Decisions waiting for the owner** (recommendations as in the [desktop spec §14](spec.md#14-decisions) and [modes §12](modes.md#12-open-decisions)):

| Decision | Recommendation |
|---|---|
| Room for the mode host: the game's initial JS is 449.6 KB of its 450 KB budget | The host's code stays out of the critical path (the page and the gate, not the game's chunks); if a byte must be added there, find the saving first; a budget change only with the owner's sign-off |
| O5: who greets visitors in Little planet | The site owner's own avatar, on the player characters' rigs |
| O6: Little planet's music | Ambient sounds only; the owner's tracks stay in Cozy life |
| Moving `planet.json` to `content/structures/modes/little-planet.json` | In M1, by a content migration that reads both places while it runs; edit mode's Planet screen moves with it |
| How the modes' packages are managed | npm workspaces (through the package feed proxy), no new tool |

The owner signed these off on 14 October 2026 ("continue as you recommend").

#### Stage 8, M1: the mode host and the contract

Built in steps, cheapest and safest first, each closed against its own rows before the next starts. The game's initial JS has 0.4 KB of room, so a step that adds code to the planet's critical path finds the saving first.

| # | Step | Done when | Evidence |
|---|---|---|---|
| M1.1 | **The structure moves:** Little planet's structure is `content/structures/modes/little-planet.json` | The loader reads it there; the old place (`structures/planet.json`) is still read, with a warning naming the move, and both at once is refused; edit mode, the starter, setup, sync, the build and the integrations use the new place; the owner's content is moved (`scripts/migrate-planet-structure.mjs`, which any site can run) | Unit: the loader on the new place, the old one and both; the starter builds three ways; E2E: the editor's "planet" test and "editor: ways to explore"; `verify:prod` with the same sizes |
| M1.2 | **The planet mounts through the contract:** the host's types (`ModeHost`, `ModeInstance`, `ModeEvent`), the page serializes the mode's data, and the gate (the host) calls the planet's `mount(root, host)` | The planet is unchanged for visitors; its initial JS stays within 450 KB (a saving first) | Planet E2E groups; `verify:prod`; `perf:audit` census as the baseline (B.4) |
| M1.3 | **The section overlay, generalized:** `frame:*` messages carrying the mode's id; `/<mount>/<slot>/…` routes; `otherSlot` | Reading on the planet is unchanged; a second mode could use the same overlay with no code of the planet's | E2E "planet" reading tests; unit tests of the messages |
| M1.4 | **The host's calls adopted:** `host.storage` (namespaced, capped), `prefs`, `announce`, `track`, `setAddress` | The planet's saved state moves under `mode.little-planet.` with its old keys read once; telemetry passes the host's allowlist | Unit; E2E for saved state and telemetry |

### Stage 9: distribution and hand-out

- **Builds:** signing, auto-update, the installer, macOS, Keep a copy of the engine, Update your site; a security review; accessibility review; a study with five people who don't write code; support pages.

| # | Done when | Evidence |
|---|---|---|
| 9.1 | A signed installer installs per user and updates itself, never during a save | The release pipeline; E2E with two versions |
| 9.2 | The security review's findings are fixed or accepted in writing | The review |
| 9.3 | Five people who don't write code each reach a live site unaided | The study's notes |

### Stage 10: one engine, two builds

The owner's site stays on source (spec §6.4, O15: D): it's developed, built and deployed from this repository as today, and is never moved. What every other site gets is proven instead: the two builds run one script, read their settings from one place, and a check builds his content both ways from one commit and finds them the same. A second site of his, made with the app, takes each release first. The live site must not break at any step: the work happens on a branch, `deploy.yml` keeps its triggers, secrets, permissions and its deploy gate, and the parity check runs beside the deploy, never in its way.

- **Builds:** `scripts/build-site.mjs` (the steps both workflows share); the site's services in `content/site.json` and the build that reads them; `scripts/build-parity.mjs` and its comparison (pure, in `scripts/lib/parity.mjs`); `parity.yml`; the parity step in `release.yml`; the canary's procedure.
- **Try it:** `node scripts/build-parity.mjs` on this checkout: it builds the owner's site twice (about 80 s) and ends `the same, but for docs/`. `node scripts/build-parity.mjs --starter` and `--starter --site-only`: `the same`. Then change a word the pages show (in `PageShell.astro`, say) without committing: the check refuses to compare a working tree that isn't the commit; with `--allow-dirty` it builds both and names every page that differs.

| # | Done when | Evidence |
|---|---|---|
| 10.1 | One build script: `deploy.yml`, `site-build.yml` and `site-build-local.mjs` build, check the seal, check for leaks and check the budgets only through `scripts/build-site.mjs`, which every engine release carries | `buildSite.test.ts` (the workflows run the script and no step of their own; the engine pack lists it); the script on the owner's site gives what `verify:prod` gives |
| 10.2 | The live deploy is unchanged but for that: the same triggers, schedule, permissions, secret, concurrency, Pages steps and deploy gate | `buildSite.test.ts` holds them; the diff reviewed; the owner runs `deploy.yml` once on the branch (its build job; the deploy job runs only on `main`) before merging |
| 10.3 | A site's services are content: `services` in `content/site.json` (schema), made the build's `PUBLIC_CONTACT_ENDPOINT`, `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`; the telemetry key only in a build for the site's own address (`services.telemetry.site`); a test build never reads them; the engine's `.env` holds no endpoint and `deploy.yml` passes no telemetry variables; the contact service's deploy script writes the endpoint to `content/site.json` | `siteServices.test.ts` (the rules for each command and mode); the owner's built pages carry his endpoint; E2E "contact" and the telemetry tests of "protected content" pass |
| 10.4 | The parity check builds one content folder from source and through the same commit's engine pack, normalises only the sealer's random parts, and allows only `docs/` to differ; it prints counts and public paths, never a sealed file's path or anything from it | `parity.test.ts` (the comparison: equal trees pass, a changed, missing or extra file fails, sealed files are compared by shape and never named); a seeded difference fails |
| 10.5 | The owner's site passes it: his content, private pages and planet | `node scripts/build-parity.mjs` on this checkout |
| 10.6 | The starter passes it, just the site and with the planet | `node scripts/build-parity.mjs --starter` and `--starter --site-only` |
| 10.7 | CI runs it: `parity.yml` on every push to `main` and on demand, with the private pages, quietly, separate from the deploy; `release.yml` on the starter before packing | `buildSite.test.ts` holds both workflows; the first run on GitHub, after the merge (the owner's) |
| 10.8 | The canary: a second site of the owner's, made with the app, moved to each release before anyone else | Spec §10.3; the first one needs an engine release (6.2b) and the owner's account: **blocked** until then |
| 10.9 | His own mode goes the consumer's way: Cozy life built as a site's own mode in both builds | Needs the planet's split (M3): **pending** |
| 10.10 | Nothing else changed: the owner's site, its budgets, its pages | `verify:prod`; unit; type check; E2E "landing & classic" |
| 10.11 | Docs: spec §6.3, §6.4, §10, O15 and §16, the contact and access specs, AGENTS.md and the whole plan say how it works | Review; the docs checks |

## 4. Order

Stages 1 and 2 need only stage 0, and can run side by side; 3 needs both. 4 needs only 0. 5 needs 3 and the owner's OAuth App. 6 needs 4. 7 needs 3 and 6. 8 needs 4. 9 needs everything. 10 needs 6 (its rows 10.8 and 10.9 need an engine release and M3). The owner can use stage 1's app as soon as it's done.

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
| 5 | Done here; on GitHub blocked | 5.3: E2E (twice in a row) after a fix it found: the app quit with `app.exit`, which skips Chromium's shutdown, so `Local State` (which holds the key safeStorage encrypts the token with) was never written and the token couldn't be opened after a restart. 5.4: 10 unit tests, the E2E, and, by hand on the real engine, the dialog's link, setup and the restart, after which New article asks who can see it. Rehearsal: a site set up this way, with one private page and one access code, built from the engine archive with `site-build-local.mjs`: the sealer sealed 1 page, 1 card and wrote 1 keyring, the leak check passed, and no built file holds the page's words. Found on the way: Node 24's `rmSync` refused git's read-only object files under Electron (removed through `removeTree`); unexpected errors put a path on the page (now plain words, with the detail for `--json`); Check my site said "not found" when GitHub wasn't connected (now it says so). 5.1, 5.2 and the live check need the owner: register the OAuth App (O8) and a GitHub test account |
| 6 | Done here; on GitHub blocked | 6.1: `packEngine.test.ts` (3 tests) and the packer's own check (673 files, 12.4 MB). 6.2a: the rehearsal built a site made by setup from the archive in 75 s and refused a wrong checksum. Found on the way: the site imports the contact form's rules from `contact-api/src/rules.mjs` (now in the engine), the docs integration threw without `documentation/` (now it skips), and `.env` (the owner's contact endpoint) must stay out. 6.2b needs a released tag and a test repository |
| 7 | Done | 46 app unit tests (`stage7.test.mjs`: sync merges, conflicts and choices; the shared checks; the launch token) and 17 app E2E tests (stage 7's 7.2–7.4 on the stand-in server), all passing. By hand on the real bundled engine under `utilityProcess`: Make my site reached edit mode's dashboard in 52 s; a plain request got 403; a rename in Settings saved, and Save to remote committed as `Ada Lovelace <1001+ada@users.noreply.github.com>` with the bundled git and reached the fake's repository; the restarted server showed the new name. The engine's only writes were Astro's `.astro/` files. Found on the way: renaming the site restarted the server under a Save to remote that followed it, so Chromium sent the POST again and got "there is nothing to save" (the restart now waits for edit mode to be quiet); a managed server pushing to real GitHub needs the token, so the app gives it to that one process as git configuration in its environment (`GIT_CONFIG_*`), not per push as spec §7.5 has it (recorded in spec §16) |
| 7A | Done (on `studio-window`) | 7A.1–7A.7: the app's E2E suite, 24 of 24, with `stage7a.spec.mjs` (5: the row, the window controls and a double-click, the server's popover over the body with axe in light and dark, Snap Layouts and a move by the bar, the menu and a remembered maximize) and stages 1, 3, 5 and 7 on the new bar; 72 app unit tests, 16 of them `window.test.mjs`; the type check clean. By eye, the window composited from its views' own pixels (this session's screen capture sees only the wallpaper): the row, the corners and shadow, the card, the popover, Snap Layouts and dark mode. Found on the way: the app's global button minimum (44 px) overflowed the segmented track and the Snap Layouts previews (now sized for it, every zone at least 24 px); axe can't see a colour painted by a box-shadow, so the bar paints its own background. Not done: the Snap Layouts preview of a zone on hover (Windows draws one), and a check on a second display with another scale |
| 7B | Done (on `studio-one-row`) | 7B.1–7B.7: the app's E2E suite 26 of 26 (`stage7b.spec.mjs` 2, and 7A's on the new row), 76 app unit tests (`studio.test.mjs` 4), `editor-studio.spec.ts` 3 on real edit mode, the site's unit suite 1,404, the type check clean. By eye, the real app on this worktree's edit mode, captured by Windows: every screen of edit mode, the site, the server's popover, the welcome and the server pages. Found on the way: the article's header (a breadcrumb, eight tools, Tests) overflowed the row, pushing the window's controls out, until the row squeezed by priority; the bar's own surface hid the card's top edge (now drawn above it); an icon's second layer vanished on a filled button (now the button's text colour); the tests' windows took focus (now shown inactive) |
| 7C | Done (on `studio-one-row`) | 7C.1–7C.5: the app's E2E suite 28 of 28 (`stage7c.spec.mjs` 2), 79 app unit tests (`account.test.mjs` 3), the type check clean; the tour of every setup screen, light and dark. Found on the way: signing out showed the account again (setup's reset re-announced its user); a sign-in during setup didn't reach the row; the server page showed a temporary path and Open another folder on a site the app made (now only for a source checkout); the tests' stand-in edit mode looked broken in a test window (now plainly labelled and theme-aware); going live's actions were full-size buttons in the row (now compact) |
| 7D | Done (on `studio-one-row`) | Attended fast checks: `theme.test.mjs` 2, `stage7d.spec.mjs` 1, `stage7b.spec.mjs` 2 (the row's choice now edit mode's own Show menu; contrast in both app themes), `stage7a` 6 and 1.7, `editor-studio.spec.ts` 3, the type check clean; one enlarged capture of the left group in light and dark. Found on the way: Playwright pins every Electron page to light unless told not to (`colorScheme: null` in the launcher) |
| 8 | Started: 8.2 done, 8.1 in part | 8.2: 9 tests in `tests/unit/modes.test.ts`; the starter builds both ways with the rules checked (`build:starter`, `build:site-only`), and `verify:prod` meets every budget on the owner's site; the full unit suite passes but for the worktree's line-ending failure in `cursors.test.ts`. Found on the way: `ModeData`'s sketch in modes.md §5.2 left out the `features` view and the `talk` kind (it now takes the content contract's). 8.1, in part: the planet's buildings now come from `ModeData` (`landmarksFrom`), equal to before by a unit test; `verify:prod` gives the same sizes (game JS 449.6 KB, before live 1588 KB); the planet E2E tests "fast travel from the menu reaches the landmark" and "reading theme" pass. `perf:audit` wasn't run: no code the browser runs changed. Next: the rest of M1 (the mode page and the host's calls, the structure's move), then M2 to M5; large, unblocked, and it moves `src/game/`, so each phase runs the planet groups and `perf:audit` |
| 8A | Done (merged into `main` 2026-10-15) | 8A.1–8A.3: `tests/unit/ways.test.ts` (7: the file optional and strict, the default, each rule refused naming the file, `planetOn` and `siteFeatures` on, off and without a file, the repository off). 8A.4: `npm run build:planet-off`: every check passes ("not offered" at `/play/`, `noindex`, a link home, no game code, chunk or asset, no building's pages); `build:starter` and `build:site-only` pass too. 8A.5–8A.6: E2E "editor: ways to explore" (2: off and back on with the first offer, the site following, the map kept, Save to remote listing the file, axe in light and dark; the starting map for a site that never had the planet), with the editor's "planet" and "navigation" tests; `tests/unit/editorWays.test.ts` (6); `siteDesignSystem.test.ts`. 8A.7: `apps/desktop/test/stage2.test.mjs` (56 app units pass) and `starter.test.ts`. 8A.8: `verify:prod` with the same sizes (game JS 449.6 KB, before live 1588 KB); "landing & classic" and the planet's "fast travel" and "reading theme" tests pass; without a ways file the planet stays the home page's first offer. The type check is clean; the full unit suite passes but for `cursors.test.ts` (the worktree's line endings). Found on the way: the quiet restart counted every edit mode call, and the Tests status's stream never ends, so in the owner's own edit mode a rename or a switch never restarted the server (now only writes are counted); a restart builds its server from the configuration it was first given, so the defines (the site's name, its features) kept their old values until the integration wrote the new ones into it; the content loader reached the design system through `placeRoutes` (now in `routes.ts`), which Playwright's loader can't import. Found later, by the full E2E baseline: `play.astro` imported the "not offered" component, so the site's layout styles were bundled into the planet's page and broke the character picker's ring and Prabin's welcome; the page is now its own route (`/not-offered/<mount>/`), `/play/` rewrites to it, and a unit test keeps `play.astro` free of the site's layouts and components. The desktop app's E2E wasn't rerun: its stand-in server doesn't read content, and setup's change is covered by its unit tests |
| 8 M1.1 | Done (merged into `main` 2026-10-15) | Little planet's structure is `content/structures/modes/little-planet.json` (the owner's content and the starter moved with `git mv`); the old place is read with a warning and both are refused; `scripts/migrate-planet-structure.mjs` moves it and changes nothing a second time. Unit: 4 new tests in `ways.test.ts` (the new place, the old one, both, the script; the integration's and the engine's paths kept equal), and the whole suite (1,375) and the app's (56) pass; the type check is clean. `build:starter`, `build:planet-off` and `build:site-only` pass; `verify:prod` gives the same sizes (game JS 449.6 KB, before live 1588 KB). E2E: the editor's "planet" test, "editor: ways to explore" (2) and the planet's "fast travel" and "reading theme" pass |
| 8 M1.2 | Done (merged into `main` 2026-10-15) | The gate (the host) calls the planet's `mount(root, host)` with the page's mode data; the contract's types are the mode kit's (`packages/mode-kit/`, now packed with the engine). Budgets: `verify:prod` gives the game's initial JS unchanged at 449.6 KB and the gate 7.7 of its 8 KB (the entry and the host live there: no saving was needed in the game), before live 1589 KB. Unit: `modeHost.test.ts` (5: the data, tier and prefs; storage namespaced, JSON and capped; `open`, `track` and the address; the site's address for a place; the kit's lists equal to the site's); the type check is clean. E2E: "capability gate", the two deep-link tests, Prabin's welcome, the character picker, fast travel and reading theme pass (8). `perf:audit`: the census as the baseline (262 calls, 1.511 M triangles, 89 programs, 94 shadow casters, 73 textures, 0 NaN pixels), live 1.89 s, GPU 2.6 ms and JS 3.0 ms a frame |
| 9 | Blocked | Needs a code-signing certificate, an Apple Developer account and five study participants |
| 10 | Done (merged into `main` 2026-10-15); 10.8 blocked; 10.9 pending M3 | 10.2: `deploy.yml`'s build job ran on the branch on GitHub (run 38637652698: the private pages fetched, 3 pages, 3 cards and 251 files sealed, the leak check and every budget passed, no telemetry note: the address matched; the deploy job skipped off `main`); merged as `977c8dc` after the full E2E suite (202 passed; the 3 planet timeouts and the editor's one pass alone and in order; the 26 the rich-copy failure kept from running pass; the 2 left, rich copy and the docs' parent domain, fail on `main` too), then deployed (run 38638044068): the live site answers with its new build, the Contact page carries the endpoint and the service answers its challenge, the telemetry chunk carries the key, the Work page its 3 sealed cards. 10.7: `parity.yml`'s first run on `main` (38638044387, with `npm ci` for the engine): 890 files the same, 254 sealed files of the same shapes, `docs/` only in the source build. 10.1: `buildSite.test.ts` (4: the workflows and the rehearsal run only `build-site.mjs`; the pack carries it; the deploy's triggers, schedule, permissions, secret, concurrency, Pages steps and gate held; parity beside the deploy and in the release); the script built, sealed (3 pages, 3 cards, 251 files, 3 keyrings), leak-checked and budget-checked the owner's site in both builds. 10.3: `siteServices.test.ts` (6); both published builds carry his endpoint on the Contact page and the PostHog key in one chunk; `verify:prod` (no `SITE_URL`) the endpoint and no key; dev the endpoint and no key; E2E "contact" (10) and the telemetry tests (8) pass; the editor's new "the site settings save keeps what the form doesn't show" passes, with the page settings and publish tests. 10.4: `parity.test.ts` (6); a seeded word: refused uncommitted, and with `--allow-dirty` 13 pages named. 10.5: the owner's site, 890 files the same, 254 sealed files of the same shapes, `docs/` (228 files) only in the source build, 80 s. 10.6: the starter 221 files the same, just the site 106. 10.10: `verify:prod` (game 449.6 KB, gate 7.7 KB, before live 1589 KB), unit 1,401 and the app's 56, type check clean; E2E "landing & classic", "site design system" and "site on a phone" 49 of 50 (the docs half of "links keep the parent domain", which fails on `main` too: stage 4). **Found on the way:** (1) the leak check let a private table's ordinary words off only because `documentation/` held them too, so an engine release's build failed where the owner's passed: the bundled packages' files are now public sources (access spec §6.3 as built); (2) no two builds were the same: 16 components made element IDs with `Math.random()` (now `stableId`); (3) on Windows the temporary folder's short name (`PRABIN~2`) changes Astro's scoped CSS hashes, so the check builds in its real path |
