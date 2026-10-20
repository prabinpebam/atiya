# Home page views: plan and Definitions of Done

How [home page views](README.md) are built: eight stages, each ending in something the owner can try, each held to its own Definition of Done, all held to the project's. The other features in progress keep working throughout: this work happens in its own worktree, adds rather than changes, and stays off on every site until that site's content turns it on.

> **TL;DR.**
> - **How:** each stage is built in loops against its Definition of Done: build, run the stage's checks, fix, record the evidence in §6, merge. A stage is done when every row has its evidence and its Try it works.
> - **Stages:** 0 this plan; 1 the spine and the rules (no visible change); 2 Bento, Change view and the role lens (2a the view at its own address, 2b the visitor's choice); 4 Cover and Proof grid, then 3 the Home screen in edit mode; 5 Spotlight and Showreel; 6 Keywords; 7 Questions; 8 the finish (every suite, parity, the docs as built).
> - **Project Definition of Done:** every capability seen on every view's first screen, for any site's 3 to 6 strengths; reproducible picks with a reason for each; a home page a person makes in edit mode without editing a file; nothing changed on a site that hasn't made one (§2).
> - **Alongside other work:** a worktree and branch of its own, off by default, small edits to shared files, rebased and checked before every merge (§4).
> - **Later, with their own Definitions of Done:** AI curation, links for one job, the Showreel's MP4 cut, `atiya home` in Atiya Studio and the capability ink sketches (§5).

## 1. How each stage is built

1. **Build** the stage's parts, smallest first: pure logic in `src/site/home/` with unit tests, then components, then pages and screens.
2. **Check** against the stage's Definition of Done: each row names its evidence (a unit test, an E2E test, a command and its result).
3. **Loop:** fix what fails and check again until every row passes. A row that can't pass for a reason outside the code (a decision, a picture to draw) is marked **blocked**, with why and what unblocks it.
4. **Record** the evidence in §6, and update the spec page's "as built" notes where the build differs from it.
5. **Merge:** rebase on `main`, re-run the stage's checks, fast-forward `main`, push, and watch every run the push starts (`node scripts/watch-push.mjs`).
6. **Hand over** with the stage's **Try it**.

## 2. Project Definition of Done

| # | Outcome | Done when | Evidence |
|---|---|---|---|
| PD1 | No strength is missed | Every offered view shows every strength on its first screen, with no action, at 1280 by 800 and 360 by 740, at the site's own count of 3 to 6 | The coverage E2E, run over every offered view ([foundation §5](foundation.md)) |
| PD2 | Three levels in every view | Each view shows L1 at rest, L2 at a glance or one action, L3 in place, and links beyond | Each view's E2E |
| PD3 | Every claim has proof | The content check refuses a proof that isn't a published, open page, a quote that isn't word for word, a résumé fragment the résumé doesn't say; a strength with no proof isn't shown | Unit tests of the check ([curation §8](curation.md), CU7) |
| PD4 | Picks are computed, reproducible and explained | Same content, same picks, on any day; every pick has a reason; pins first, hides absolute; no page shown as two strengths' best proof | Unit tests on made-up sites of 3, 40 and 500 pages |
| PD5 | A person makes it without a file | The Home screen's first run takes a site from the hub to a home view; every setting in [controls](controls.md) is on that screen | Editor E2E "editor: home" |
| PD6 | Nothing changes until it's made | A site without `showcase.json` and a `home` key renders its home exactly as before; the starter and site-only builds are unchanged | Unit test of the switch; `build:starter`; `build-parity.mjs` |
| PD7 | The visitor chooses | Change view on every view; a pick kept on the device; a link per view; the lens reorders and never hides | E2E "home views" |
| PD8 | Fast, accessible, on every device | Each view within [foundation §10](foundation.md)'s budgets; axe clean in light and dark; no sideways scroll from 320 px; reduced motion honoured | E2E groups; `verify:prod` |
| PD9 | The site's systems hold | The design system, edit mode's design system, telemetry's allowlist, the CSP and the leak check all pass with the new parts | `npm test`; `verify:prod` |
| PD10 | Docs | The spec says what was built; this plan's §6 holds the evidence; AGENTS.md says how to work on it | Review |

## 3. Stages

### Stage 0: this plan

| # | Done when | Evidence |
|---|---|---|
| 0.1 | Every stage has testable rows and a Try it | This page |
| 0.2 | The docs build: diagrams fresh, Slate's check passes, links resolve | `build-doc-diagrams.mjs --check`; `runtime-host.mjs check` |

### Stage 1: the spine and the rules

- **Builds:** the content contract ([curation §2](curation.md)): `content/showcase.json`, `content/topics.json`, the `home` key of `content/structures/ways.json`, the site setting `resumePage` and the article field `contribution`; the content check; the engine's catalogue (goals, common strengths, question sets, the views and their minimums) in `src/site/home/catalogue.json`; the pure rules in `src/site/home/` (the evidence index, matching, the score, slot filling, the role lens, minimums, the health report); the repository's `getHome()`; the owner's spine and topics. No `home` key yet, so no page changes.
- **Try it:** `npx vitest run tests/unit/home*.test.ts`; then `npm run build`, and the home page is as before.

| # | Done when | Evidence |
|---|---|---|
| 1.1 | The contract parses and checks the new files; every refusal of [foundation §2](foundation.md), [for every site §3](for-every-site.md) and [controls §5](controls.md) has a failing and a passing case | Unit: `homeContract.test.ts` |
| 1.2 | Matching, the score and slot filling follow [curation §4 to §6](curation.md): pins first, hides out, coverage before quality, kind balance, no page twice, at most 8 highlights, each pick with its reason | Unit: `homeCurate.test.ts` |
| 1.3 | Reproducible: the same content gives the same picks twice and on another day; ties by score, date, then ID | Unit |
| 1.4 | Scale: made-up sites of 3, 40 and 500 pages; 500 pages curate in under 150 ms | Unit (timed) |
| 1.5 | The health report lists [curation §8](curation.md)'s items; minimums follow [for every site §5](for-every-site.md) | Unit |
| 1.6 | The owner's spine passes the strict check; the site builds; the home page is unchanged | `npm run check`; `npm run build` |

### Stage 2: Bento, Change view and the role lens

- **Builds:** the home layout (the identity strip as the header's home arrangement, the sections index at the foot); the Bento compound (tiles, In their words, the evidence drawer, 3 to 6 tiles); Change view (a dialog of the offered views, Use the default, Other ways to explore); the lens chip; `/` as the default view (the hub without a `home` key), `/views/<id>/` with `/` as canonical, `/?view=` sent on, a view that isn't offered answering with a short page, `views` reserved; the stored pick before first paint; telemetry events; stories and screenshots. The owner's ways file gets `home`, offering Bento beside the classic hub.
- **In two merges** (the throughput review of stage 1): **2a** is the view itself, offered at its own address (rows 2.1, 2.2, 2.3, 2.6, 2.7, 2.8 and 2.10); **2b** is the visitor's choice (Change view, the stored pick, the lens chip, telemetry: rows 2.4, 2.5 and 2.9, with the "content security policy" E2E group, since the stored pick adds a script to `/`).
- **The default waits for the owner:** until he signs off the strengths' names and lines and picks the default (decisions H1, H2 and H9), the classic hub stays the default at `/` and Bento is offered at `/views/bento/`. Making Bento the default is then one line of `content/structures/ways.json`.
- **Try it:** 2a: run the site and open `/views/bento/`; press a tile, its details open under its row; `/` is the hub as before. 2b: Change view lists Bento and the classic hub; `/?for=ai` puts AI first with a chip.

| # | Done when | Evidence |
|---|---|---|
| 2.1 | Coverage: every strength's `data-capability` element is in the first screen's HTML and in view at 1280 by 800 and 360 by 740 | E2E "home views: coverage" |
| 2.2 | Bento's three levels: names and lines at rest, the quote on hover and focus (and in the description), the drawer by press, Esc and `#cap-<id>`; focus returns | E2E "home views: bento" |
| 2.3 | Bento lays out 3, 4, 5 and 6 strengths as [for every site §4](for-every-site.md) says | Stories at each count; screenshots |
| 2.4 | Change view: a link shows its view and doesn't store; a card stores; `/` follows the stored pick before first paint; Use the default clears it; a pick no longer offered is removed | E2E "home views: change view" |
| 2.5 | The lens reorders and changes the lead voice, never hides; its chip clears it; it's kept for the visit | Unit (lens); E2E |
| 2.6 | Without a `home` key the home is the hub, as today; with the owner's (the hub as default) `/` is unchanged | Unit; the "landing & classic" E2E group |
| 2.7 | Axe clean in light and dark; no sideways scroll at 320 px; 44 px targets | E2E "home views", "site on a phone" |
| 2.8 | The design system's tests pass; stories for every new component; screenshots updated and looked at | `npm test`; `npm run visual` for the new stories and `/` |
| 2.9 | Telemetry sends only allowlisted events with no text | E2E with `site.test.telemetry` |
| 2.10 | `verify:prod` passes; the view's script is under 15 KB gzip | `npm run verify:prod` |

### Stage 3: the Home screen

- **Builds:** `/_edit/home/` ([owner flows §1](owner-flows.md)): the top bar (View, Wide or Phone, Lens); tabs Strengths (with Who you are), Highlights, Views, Links (lenses) and Health; More options ([controls §2](controls.md)); the preview of the unpublished home with the coverage meter; the first run's four steps; Auto, Pinned and Hidden on every placed item; the topic vocabulary with suggested topics; the article's Your part and Hide from home; the Make your home page card on the Dashboard and the Pages screen; the screen in `SCREENS` and the side navigation, with its count. Suggest runs the rule-based twins ([AI curation §4](ai-curation.md)).
- **Try it:** open the editor fixture (`node scripts/editor-test-server.mjs`, `http://localhost:4330/_edit/home/`): make a home page from the first run, pin a page, offer a second view.

| # | Done when | Evidence |
|---|---|---|
| 3.1 | The first run takes a site with no spine to a home view in four steps, saving as it goes, resumable | Editor E2E "editor: home" |
| 3.2 | Every control in [controls §1 to §4](controls.md) is on the screen and saves through the store and the check; refusals name the field and the fix | Editor E2E; unit (`model/home.ts`) |
| 3.3 | The preview shows unpublished decisions and the coverage meter warns when a strength leaves the first screen | Editor E2E |
| 3.4 | The health report's fixes work from their buttons | Editor E2E |
| 3.5 | The article's Your part and Hide from home save, and a page published shows where it went on the home | Editor E2E |
| 3.6 | Edit mode's design system holds: parts from the kit, stories in the parts library, owned tokens, line limits | `editorDesignSystem.test.ts` |
| 3.7 | Nothing of it reaches a build | `verify:prod` |

### Stage 4: Cover and Proof grid

- **Built before stage 3** (the throughput review): three views at their own addresses let the owner choose the default (H2) sooner, and edit mode is busy with AI editing's work.
- **Builds:** [Cover](cover.md) and [Proof grid](proof-grid.md), with their settings and minimums; the owner offers them.
- **Try it:** `/views/cover/` and `/views/proof-grid/`; Change view moves between them.

| # | Done when | Evidence |
|---|---|---|
| 4.1 | Coverage, levels and the lens hold for both | E2E "home views" over every offered view |
| 4.2 | Each lays out 3 to 6 strengths, and Proof grid's columns are the site's five most used kinds | Stories; unit |
| 4.3 | Axe, phone, design system, screenshots, budgets | As stage 2 |

### Stage 5: Spotlight and Showreel

- **Builds:** [Spotlight](spotlight.md) and [Showreel](showreel.md) on the shared highlights; the reel's player made of live page content, with chapters, pause and reduced motion. The MP4 cut is later (§5).
- **Try it:** `/views/spotlight/`, `/views/showreel/`; the reel pauses, seeks by chapter, and is still under reduced motion.

| # | Done when | Evidence |
|---|---|---|
| 5.1 | Coverage before anything plays; the chapter bar and the jump row name every strength | E2E coverage |
| 5.2 | Nothing moves without the visitor's choice; pause always available; reduced motion shows stills | E2E |
| 5.3 | The player stays under 40 KB gzip | `verify:prod` |
| 5.4 | Axe, phone, design system, screenshots | As stage 2 |

### Stage 6: Keywords

- **Builds:** [Keywords](keywords.md): the groups from strengths' keywords and topic labels, picking, typing a skill (matched in the browser, never sent), the drift as Lively motion.
- **Try it:** `/views/keywords/`; pick two keywords; their evidence comes forward.

| # | Done when | Evidence |
|---|---|---|
| 6.1 | With nothing picked, every strength is on the first screen | E2E coverage |
| 6.2 | Picks and typed skills match in the browser; telemetry says only whether it matched | Unit (matching); E2E |
| 6.3 | Axe, phone, design system, screenshots, budgets | As stage 2 |

### Stage 7: Questions

- **Builds:** [Questions](questions.md): the goal's question set, answers in the spine with their evidence from the picks, Ask something else by local matching; offered at five answers. The owner's answers are drafted from his pages for him to sign off before the view is offered.
- **Try it:** `/views/questions/`; question 1 is open with every strength; ask a question.

| # | Done when | Evidence |
|---|---|---|
| 7.1 | Question 1 open at rest lists every strength | E2E coverage |
| 7.2 | Every answer's quotes are word for word; the view isn't offered below five answers | Unit (check); E2E |
| 7.3 | Axe, phone, design system, screenshots, budgets | As stage 2 |

### Stage 8: the finish

| # | Done when | Evidence |
|---|---|---|
| 8.1 | Every suite passes: `npm test`, `npm run check`, `npm run e2e`, the editor project, the visual project | The runs |
| 8.2 | The owner's site builds the same from source and from the engine pack; the starter builds | `build-parity.mjs`, `--starter` |
| 8.3 | `verify:prod` and the size report hold | The run |
| 8.4 | The spec's pages say what was built; AGENTS.md has a short section on home views | Review |

## 4. Working alongside other features

Other features are being built at the same time, in their own worktrees and on `main`. This work keeps out of their way:

- **Its own worktree and branch:** `E:\Projects\Personal\personal-site-home`, branch `home-views`. The owner's checkout and the other worktrees are never touched.
- **Off by default:** without `content/showcase.json` and a `home` key in the ways file, every site renders its home exactly as before, so no other feature's tests change until the owner's content turns home views on (stage 2).
- **Additive:** new code lives in `src/site/home/`, new components and pages, and a new editor screen. Shared files (the content contract, the tokens, the telemetry allowlist, edit mode's routes and screens list, the landing's tests) get small, separate edits.
- **Merged carefully:** rebase on `main`, re-run the stage's checks after the rebase, fast-forward only, never force. Only this work's files are staged.
- **One E2E run at a time:** check `node scripts/test-run.mjs status` first; never reuse another worktree's test server on 4329 or 4330.

## 5. Later, with their own Definitions of Done

| Item | Why it waits | Starts when |
|---|---|---|
| AI curation ([AI curation](ai-curation.md)) | It needs AI editing's first phase: the service connection and grounding | AI editing's phase 1 ships |
| Links for one job (`/for/<code>/`, [owner flows §5](owner-flows.md)) | Who a link is for is kept privately, in the private repository | After stage 3; lenses ship in stage 2 |
| The Showreel's MP4 cut | It needs a recording pipeline, and the film is optional ([controls §3](controls.md)) | After stage 5 |
| `atiya home` in Atiya Studio's CLI | It lives in the desktop app, built on its own branch | After stage 3 |
| Capability ink sketches | New illustrations are proposed to the owner before they're drawn (the ink sketch skill) | The owner approves a set |

## 6. Status and evidence

| Stage | Status | Evidence |
|---|---|---|
| 0 | Done | This page; the docs checks |
| 1 | Done | 1.1 `homeContract.test.ts` (25 tests); 1.2 to 1.5 `homeCurate.test.ts` (34 tests: matching, the score, slots, kind balance, lens, hold, recency, ties, the health report, minimums, sites of 3, 40 and 500 pages, the 500 curating well under 150 ms); the 30 other suites that import the content contract pass (416 tests); 1.6 the owner's spine (`content/showcase.json`, `content/topics.json`, `resumePage`, `contribution` on 8 pages) passes the strict check, `npm run check` 0 errors, `npm run build` 134 pages, and no page renders the new code yet, so the home page is unchanged |
| 2a | Done | 2.1 and 2.2: E2E "home views" (coverage at 1280 by 800 and 360 by 740 in light and dark, from the first HTML and in view; bento's three levels, Esc and focus return, `#cap-<id>`, one drawer at a time); 2.3 the Bento story at 3, 4, 5 and 6 tiles, and their screenshots; 2.6 "landing & classic" passes and `/` is the hub, canonical `/`; 2.7 axe clean in both modes with a drawer open, "home views on a phone" (no sideways scroll and 44 px targets at 320, 360 and 844 wide, open and closed); 2.8 `siteDesignSystem.test.ts` and the home suites (367 tests), `npm run check` 0 errors, the whole visual project (144 passed; the new stories' and `/views/bento/`'s 60 baselines written and looked at; no other screenshot changed); 2.10 `verify:prod` passes, Bento's script 0.8 KB gzip and Voices' 0.2 KB. As built: [Bento §13](bento.md#13-as-built-stage-2a) |
| 2b | Not started | |
| 3 | Not started | |
| 4 | Not started | |
| 5 | Not started | |
| 6 | Not started | |
| 7 | Not started | |
| 8 | Not started | |
