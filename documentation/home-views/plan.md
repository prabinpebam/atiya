# Home page views: plan and Definitions of Done

How [home page views](README.md) are built: eight stages, each ending in something the owner can try, each held to its own Definition of Done, all held to the project's. The other features in progress keep working throughout: this work happens in its own worktree, adds rather than changes, and stays off on every site until that site's content turns it on.

> **TL;DR.**
> - **How:** each stage is built in loops against its Definition of Done: build, run the stage's checks, fix, record the evidence in §6, merge. A stage is done when every row has its evidence and its Try it works.
> - **Stages:** 0 this plan; 1 the spine and the rules (no visible change); 2 Bento, Change view and the role lens (2a the view at its own address, 2b the visitor's choice, 2c the role lens, built after stage 4 over all three views); 4 Cover and Proof grid, then 3 the Home screen in edit mode; 5 Spotlight and Showreel; 6 Keywords; 7 Questions; 8 the finish (every suite, parity, Change view's stills and the views' transitions, the docs as built).
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
| PD3 | Every claim has proof | Only published, open pages are shown as proof; saved page picks may wait through a draft. The content check refuses missing or private page references, a quote that isn't word for word, or a résumé fragment the résumé doesn't say; a strength with no proof isn't shown | Unit tests of the check and unpublish/republish rendering, plus the editor E2E "unpublishing an article pinned in Questions" ([curation §7–8](curation.md), CU7) |
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
- **In three merges** (the throughput reviews of stages 1 and 2a): **2a** is the view itself, offered at its own address (rows 2.1, 2.2, 2.3, 2.6, 2.7, 2.8 and 2.10); **2b** is the visitor's choice (Change view, the stored pick, `/views/classic/`, telemetry: rows 2.4 and 2.9, with 2.6, 2.7, 2.8 and 2.10 again and the "content security policy" E2E group, since the stored pick adds a script to `/`); **2c** is the role lens (its pages and its chip: row 2.5). The short page for a view that isn't offered moves to stage 4.
- **The default waits for the owner:** until he signs off the strengths' names and lines and picks the default (decisions H1, H2 and H9), the classic hub stays the default at `/` and Bento is offered at `/views/bento/`. Making Bento the default is then one line of `content/structures/ways.json`.
- **Try it:** 2a: run the site and open `/views/bento/`; press a tile, its details open under its row; `/` is the hub as before. 2b: on `/views/bento/` or `/views/classic/`, Change view lists Bento and the classic hub; choose one, then open `/`: it shows your choice; Use the default puts the hub back. 2c: `/?for=ai` opens Bento with AI first and "Ordered for AI and design" under the lead (on a wide screen); Change view's "Order by role" picks another lens or the usual order, and every view keeps the lens until the tab closes.

| # | Done when | Evidence |
|---|---|---|
| 2.1 | Coverage: every strength's `data-capability` element is in the first screen's HTML and in view at 1280 by 800 and 360 by 740 | E2E "home views: coverage" |
| 2.2 | Bento's three levels: names and lines at rest, the quote on hover and focus (and in the description), the drawer by press, Esc and `#cap-<id>`; focus returns | E2E "home views: bento" |
| 2.3 | Bento lays out 3, 4, 5 and 6 strengths as [for every site §4](for-every-site.md) says | Stories at each count; screenshots |
| 2.4 | Change view: a link shows its view and doesn't store; a card stores; `/` follows the stored pick before first paint; Use the default clears it; a pick no longer offered is removed | E2E "home views: change view" |
| 2.5 | The lens reorders and changes the lead voice, never hides; its chip clears it; it's kept for the visit | Unit (lens); E2E |
| 2.6 | Without a `home` key the home is the hub, as today; with the owner's (the hub as default) `/` is unchanged: from 2b, its markup differs only by the router and the `data-home-*` attributes, and it offers no Change view | Unit; the "landing & classic" E2E group; the built `/index.html` compared before and after |
| 2.7 | Axe clean in light and dark; no sideways scroll at 320 px; 44 px targets | E2E "home views", "site on a phone" |
| 2.8 | The design system's tests pass; stories for every new component; screenshots updated and looked at | `npm test`; `npm run visual` for the new stories and `/` |
| 2.9 | Telemetry's home events carry only view and lens IDs and how the visitor came, never text or an address | Unit (`homeEvents`); E2E "home views: change view" with `site.test.telemetry` |
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

- **Built before stage 3** (the throughput review): three views at their own addresses let the owner choose the default (H2) sooner, and edit mode is busy with AI editing's work. **And before 2c** (the throughput review after 2b): the lens then goes onto three views at once, with one E2E run.
- **Builds:** [Cover](cover.md) and [Proof grid](proof-grid.md), with their settings and minimums; the owner offers them. A view that isn't offered answers at its address with a short page (moved from stage 2). Change view's stills and the views' transitions move to stage 8: they redo every view's screenshots each time a view changes.
- **Try it:** `/views/cover/` and `/views/proof-grid/`; Change view moves between them.

| # | Done when | Evidence |
|---|---|---|
| 4.1 | Coverage and levels hold for both (the lens with 2c, right after) | E2E "home views" over every offered view |
| 4.2 | Each lays out 3 to 6 strengths, and Proof grid's columns are the site's five most used kinds | Stories; unit |
| 4.3 | Axe, phone, design system, screenshots, budgets | As stage 2 |

### Stage 5: Spotlight and Showreel

- **Builds:** [Spotlight](spotlight.md) and [Showreel](showreel.md) on the shared highlights; the reel's player made of live page content, with chapters, pause and reduced motion. The MP4 cut is later (§5).
- **In two parts:** 5a, Spotlight, which moves only when the visitor moves it; and 5b, the Showreel, which plays by itself and so waits on the owner's decision H4 (§6). Rows 5.1, 5.2 and 5.4 apply to both; 5.3 is the reel's.
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
| 8.5 | Change view's cards show each view's still, and moving between views is a view transition (reduced motion: none) | E2E; screenshots |

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
| A wrapped link's arrow | The `Link` fundamental's standalone variant is `inline-flex`, so when its words wrap, the arrow sits at the far edge rather than after the last word (seen in Cover's evidence lists). The fix is the one Proof grid's names use (the last word and the arrow kept together), but it moves screenshots across the whole site | With the next site-wide visual change |

## 6. Status and evidence

**When you're back** (the work so far, and what only you can decide):
- **First, the deploy is blocked:** every push since `73264ebf` ("Private pages: update") fails its build, because a private page now uses a Collection block `layout` that only exists in uncommitted work in the main checkout (`Collection.astro`, the content schema, StatTiles). Committing that work, or moving the private pages back, makes the deploy pass again. Until then, the live site stops at stage 2b.
- **See it:** live, [`/views/bento/`](https://prabinpebam.github.io/atiya/views/bento/) and [`/views/classic/`](https://prabinpebam.github.io/atiya/views/classic/), with Change view between them; it remembers your pick on the device. Merged but not deployed yet (run the site to see them): `/views/cover/`, `/views/proof-grid/`, `/views/spotlight/`, `/views/keywords/` (try `?pick=hiring,copilot`), the role lens (`/?for=ai`, or a view's page for one lens, such as `/views/proof-grid/for/leader/`), and the short page for a view the site doesn't offer (`/views/showreel/`, for now). `/` is still the classic hub, unchanged.
- **H2, the default view:** Bento is recommended. Say which, after looking at the four in [Compare the views](#compare-the-views) below (no deploy needed); it's the `default` in `home` in `content/structures/ways.json` (edit mode's Home screen, stage 3, will set it too). Once a view other than the hub is the default, `/` shows it and gets Change view. The switch is rehearsed: with Bento as the default, `/` showed Bento with Change view, the hub stayed at `/views/classic/`, and "landing & classic", the content security policy, "home views" and the home page's site tests passed (they read the default from `ways.json`, so they hold on either), then the default went back to the hub.
- **H1, the strengths' names:** Design leadership, Product strategy, AI transformation, Hands-on making, Craft and storytelling, Systems and operating models. Keep them, or rename (a rename keeps each ID, so links and lenses still work).
- **H9, the hub's "under construction" summary:** replacing it with a positioning line is recommended. Pick one of these drafts, made only from your role and your strengths' own lines, or write your own (one sentence on what you do and for whom); it goes in `content/site.json` as `positioning` and leads every view:
  1. "I build design teams, set product strategy and still make things by hand."
  2. "I lead design from the org to the pixel: teams, strategy, AI-native ways of working and the systems that hold them."
  3. "I lead design for products that change how people work: strategy, AI transformation and the craft to ship it."
- **H4, motion that runs on its own:** amending the visual language for views a visitor chose, always with a pause, is recommended. The Showreel and the Keywords drift wait on it. (Amended for carousels on 28 October 2026: the home's highlights play by themselves, with a pause: [highlights §2.4](highlights.md#24-moving-between-slides-loop-and-autoplay).)
- **Also yours:** each strength's line and keywords (`content/showcase.json`, drafted from your pages); the nine Questions answers (`questions` in `content/showcase.json`, drafted only from your résumé, pages and recommendations, quotations checked word for word: read them in [Questions §4.1](questions.md#41-wide-screen-1280-px) and sign them off or rewrite them; the view is built and waits only on that to be offered, at `/views/questions/` once it is); whether Ask something else's Not quite? may carry the words a visitor typed into the contact form's topic (it does today; they never reach telemetry); whether Contact me on a strength fills in the contact form's topic; for Cover, its picture (C1: an ink sketch portrait is recommended; until then it's the cover story's picture) and its story (C2: Do what makes you proud leads today, the first highlight).

### Compare the views

Each view with your real content, as the screenshot tests last saw it on `main` (whole pages; the deploy isn't needed to look). The wide shots are 1280 px, the phone ones 360 px.

| View | What a reader gets first | Best when | Wide | Phone |
|---|---|---|---|---|
| Classic hub (today's `/`) | The sections, then their pages | You'd rather lead with what's on the site than with strengths | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-light-1280-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-dark-1280-win32.png) | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-light-360-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-dark-360-win32.png) |
| Bento (recommended) | Every strength as a tile at once, its proof line on it; a colleague's words on hover, the evidence a press away | A reader scanning in seconds who must not miss a strength | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-bento-light-1280-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-bento-dark-1280-win32.png) | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-bento-light-360-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-bento-dark-360-win32.png) |
| Cover | A magazine cover: In this issue names every strength beside one cover story and its picture | One story and one picture carry you best | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-cover-light-1280-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-cover-dark-1280-win32.png) | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-cover-light-360-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-cover-dark-360-win32.png) |
| Proof grid | A row per strength, a column per kind of evidence, how much of each in its cell | A screener who checks depth before reading anything | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-proof-grid-light-1280-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-proof-grid-dark-1280-win32.png) | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-proof-grid-light-360-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-proof-grid-dark-360-win32.png) |
| Spotlight | One highlight at a time on a stage, Jump to naming every strength and the rail every highlight | The work is visual and a few pieces carry it | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-spotlight-light-1280-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-spotlight-dark-1280-win32.png) | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-spotlight-light-360-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-spotlight-dark-360-win32.png) |
| Keywords | A group of keywords per strength, sized by their proof, and every strength's headline beside them; picks bring the matching proof forward | A recruiter screening against a job description's words | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-keywords-light-1280-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-keywords-dark-1280-win32.png) | [light](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-keywords-light-360-win32.png), [dark](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-keywords-dark-360-win32.png) |

The role lens reorders any of them for one reader (the AI lens: [Bento](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-bento-lens-light-1280-win32.png), [Proof grid](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/__screenshots__/visual.spec.ts/page-home-proof-grid-lens-light-1280-win32.png)). Whichever you pick, the others stay a visitor's choice through Change view.

### Stages

| Stage | Status | Evidence |
|---|---|---|
| 0 | Done | This page; the docs checks |
| 1 | Done | 1.1 `homeContract.test.ts` (25 tests); 1.2 to 1.5 `homeCurate.test.ts` (34 tests: matching, the score, slots, kind balance, lens, hold, recency, ties, the health report, minimums, sites of 3, 40 and 500 pages, the 500 curating well under 150 ms); the 30 other suites that import the content contract pass (416 tests); 1.6 the owner's spine (`content/showcase.json`, `content/topics.json`, `resumePage`, `contribution` on 8 pages) passes the strict check, `npm run check` 0 errors, `npm run build` 134 pages, and no page renders the new code yet, so the home page is unchanged |
| 2a | Done | 2.1 and 2.2: E2E "home views" (coverage at 1280 by 800 and 360 by 740 in light and dark, from the first HTML and in view; bento's three levels, Esc and focus return, `#cap-<id>`, one drawer at a time); 2.3 the Bento story at 3, 4, 5 and 6 tiles, and their screenshots; 2.6 "landing & classic" passes and `/` is the hub, canonical `/`; 2.7 axe clean in both modes with a drawer open, "home views on a phone" (no sideways scroll and 44 px targets at 320, 360 and 844 wide, open and closed); 2.8 `siteDesignSystem.test.ts` and the home suites (367 tests), `npm run check` 0 errors, the whole visual project (144 passed; the new stories' and `/views/bento/`'s 60 baselines written and looked at; no other screenshot changed); 2.10 `verify:prod` passes, Bento's script 0.8 KB gzip and Voices' 0.2 KB. As built: [Bento §13](bento.md#13-as-built-stage-2a) |
| 2b | Done | 2.4: E2E "home views: change view" (5 tests: a link shows a view without keeping it and `?view=` is sent on; a card keeps the choice, `/` and the in-site home link follow it before the first paint and Back skips `/`, Use the default clears it; a kept choice no longer offered is dropped; the dialog by keyboard, Esc back to its opener, axe in both modes; telemetry), and the router's and the hub's ways in unit-tested (`homeRoute.test.ts`, `homeViews.test.ts`: 30 tests); 2.6: "landing & classic" passes, and the built `/index.html` compared before and after: the body is the same but for the hub's script (now a file, with the primary way in chosen by a small inline script before the first paint), the head adds the router and the `data-home-*` attributes, and two stylesheets (3.7 KB gzip) come with it, a deviation in [switcher §10](switcher.md#10-as-built-stages-2b-and-8); 2.7: "home views", "site design system" and "site on a phone" pass (49 tests, axe in both modes); 2.8: `siteDesignSystem.test.ts` and the home, content and token suites (427 tests), `npm run check` 0 errors, the ViewChoices story's 12 new screenshots and `/views/bento/`'s 6 changed ones looked at and accepted, `/` and every other screenshot run unchanged; 2.9: `homeEvents` unit-tested and the E2E reads the events sent (view and lens IDs and the source only); 2.10: `verify:prod` passes; the hub's script 0.4 KB gzip and the choices' 0.8 KB. As built: [switcher §10](switcher.md#10-as-built-stages-2b-and-8) |
| 2c | Done | 2.5: E2E "home views: role lens" (`?for=ai` on `/` and on every view's page goes to the lens's page and is kept for the visit; the lens's strength first in Bento, Cover and Proof grid, none hidden; the note says so wide and gives way on a phone, with every strength still in view and no sideways scroll; Change view's Order by role names the lens and switches it; Use usual order leaves it and keeps nothing; axe in both modes), part of "home views" (17 tests); the router's lens rules (a lens the site doesn't offer is ignored, an empty `?for=` clears it) in `homeRoute.test.ts`, and a lens's order (first, the rest in the person's order, none hidden, every strength's proof unchanged) in `homeCurate.test.ts` and `homeBento.test.ts`; the home, content and token suites (634 tests), `npm run check` 0 errors; the whole visual project (80 passed, 2 flaky stories outside the home views passed on retry): HomeLead's and ViewChoices' new examples and the two lens pages' 24 new screenshots looked at, and the HomeLead and ViewChoices stories' other screenshots moved by under a pixel of text and accepted; `verify:prod` passes. As built: [foundation §6](foundation.md#as-built-stage-2c) |
| 3 | Started: 3.2's model | 3.2, its rules: `model/home.ts`, pure, and `editorHome.test.ts` (17 tests): the goal; adding (6 at most, with an ID from the name), renaming (the ID kept), moving and removing a strength (every mention of it goes, and below 3 it says the home is the hub until there are 3); Auto, Pinned and Hidden per strength and for highlights (only a page can be hidden; a résumé line is pinned once whatever its spacing; "4 pinned, 3 shown" said; 8 highlights at most); a voice chosen word for word, 12 words at most; the actions renamed and never removed; More options and each view's settings stored only where they differ from the defaults; a default or an offered view never below its minimum, and the default never withdrawn. Every refusal names its field and what to do instead, and every change keeps the fields it doesn't touch. The screen, the first run and the editor E2E wait for AI editing's work on the side navigation and the Dashboard to settle ([§4](#4-working-alongside-other-features)) |
| 4 | Done | 4.1: E2E "home views" (16 tests): coverage at 1280 by 800 and 360 by 740 in light and dark for Bento, Cover and Proof grid from the first HTML; Cover's entries jump to their features under the header and nothing runs on its own; Proof grid's one tab stop, arrows, a cell opening its kind and a name all of it, Esc and Close giving focus back, `#cap-<id>` and `#cap-<id>-<kind>`; a view that isn't offered says so, isn't indexed and links home. 4.2: `homeCover.test.ts` and `homeProofGrid.test.ts` (3 to 6 strengths, the cover story's and picture's choice, the five most used kinds in their own order, the cells' states and counts), and both stories from 3 to 6 strengths, in both densities. 4.3: axe clean in both modes on both views; "home views on a phone" (no sideways scroll and 44 px targets from 320 px with the evidence open, the accordion); "site design system" and "site on a phone" pass (31 tests); `siteDesignSystem.test.ts` and the home, content and token suites (450 tests); `npm run check` 0 errors; the two stories' and the two pages' 54 new screenshots looked at, and the whole visual project otherwise unchanged; `verify:prod` passes. As built: [Cover §13](cover.md#13-as-built-stage-4), [Proof grid §13](proof-grid.md#13-as-built-stage-4) |
| 5a | Done (Spotlight) | 5.1: E2E "home views" (20 tests): coverage at 1280 by 800 and 360 by 740 in light and dark now includes `/views/spotlight/` from the first HTML, with Jump to naming every strength, and the role lens puts the lens's strength first there too; `homeSpotlight.test.ts` (12 tests: the settings, how many highlights and their order, a lens and Strongest first, each highlight's details, where Jump to leads for a strength with highlights, with evidence only and with nothing, and the `#h-` address rules). 5.2: E2E "spotlight: Next, the keys, the rail and Jump to…" (nothing moves in 1.5 s; Next, and Previous going round; Left and Right keeping the keyboard on the same control; the rail; Jump to going round a strength's highlights; the details following the highlight; `#h-` on arrival and on a change of address) and "spotlight: a change moves only as the site asks" (no motion on arrival, the site's motion after Next, none under reduced motion); there's nothing to pause, since nothing plays. 5.3 is the reel's; Spotlight's own script is 1.5 KB gzip. 5.4: axe clean in both modes with the details open; "spotlight on a phone" (320, 360 and 844 by 390: no sideways scroll, 44 px targets with the details open, a touch swipe both ways); the telemetry E2E reads `highlight_view`; `siteDesignSystem.test.ts` and the home, content and token suites (647 of 648 tests: the one failure is edit mode's AiPrompt, not this work); `npm run check` 0 errors; the story's 18 and the page's 6 new screenshots looked at, and the whole visual project (84 passed) otherwise unchanged; `verify:prod` passes. As built: [Spotlight §13](spotlight.md#13-as-built-stage-5) |
| 5b | Waits on H4 (Showreel) | |
| 6 | Done | 6.1: E2E "home views" (coverage at 1280 by 800 and 360 by 740 in light and dark now includes `/views/keywords/` from the first HTML and in view: every strength's group and headline with nothing picked; the groups' rows start at 324 and 678 px at 1280 by 800), and the role lens puts the lens's strength first there too; `homeKeywords.test.ts` (24 tests: the settings and 6 to a group; a group per strength in order; a strength's own keywords kept for it; a singular and its plural one keyword; matching by topic, words and body; synonyms; sizes; a keyword that matches nothing; each item once; Strongest first and a lens). 6.2: the browser's rules unit-tested (`?pick=` read and written, any pick matching with more picks first, suggestions by label then synonym, Ask about these, the status line), and E2E "home views: keywords" (one Tab stop and the arrows, a pick saying what it found and bringing it forward, the address keeping the picks, Remove and Clear all; Or type a skill by synonym, the arrows and Enter, Esc, and a skill the site doesn't show; telemetry: `keyword_pick` and `skill_typed` with `matched` only, never the words). 6.3: axe clean in both modes with picks made and a match open; "keywords on a phone" (320, 360 and 844 by 390: rows that open their keywords, no sideways scroll, 44 px targets with picks made); `siteDesignSystem.test.ts` (314 of 315: the one failure is edit mode's AiPrompt, not this work) and the home suites (150 tests); `npm run check` 0 errors; the story's 12 and the page's 6 new screenshots looked at; `verify:prod` passes, the view's script 3.3 KB gzip. As built: [Keywords §13](keywords.md#13-as-built-stage-6) |
| 7 | Done (Questions built, not offered until you sign off the answers) | **7a.** 7.2, its check: `check.ts` fails the content check on a quotation in an answer that isn't word for word in a shown recommendation or an open page (`homeContract.test.ts`). The owner's nine drafted answers (`content/showcase.json`) pass the strict check with no problems; their four quotations are Diego Baca's, March Roger's (two) and Prabu Ambravaneswaran's, word for word. The model, `questions.ts`, is tested in `homeQuestions.test.ts` (18 tests: the settings; the order and numbering; the catalogue's full wording; question 1 as the map in the person's, the lens's and the strongest order; tags; the pins first, then the tagged strengths' evidence in turn, at most 5; the lines; only open pages; the depth, ask and contact fills; the words Ask something else matches, each strength's in the question's own order, with its other proof). **7b.** 7.1: E2E "home views" coverage at 1280 by 800 and 360 by 740 in light and dark, with Questions offered for the run, includes `/views/questions/` from the first HTML and in view (question 1 open with every strength). 7.2: E2E "a view the site doesn't offer" passes with Questions not offered. The browser's rules are unit-tested in `questionsRules.test.ts` (15 tests: `#q<n>`, the words and their stems, a question leading over a strength, a strength over its evidence and its other proof least, the coverage tie-break, a word still being typed, the status line and Show more). E2E "home views: questions" (8 tests): wide, the tab list (the arrows, Enter, Next taking the keyboard to the answer, `#q<n>` opening one without it); a phone's accordion (the first three, Show more, `aria-expanded`, the answer found brought into view below the top bar); Ask something else (the closest as you type, the arrows and Enter, the note and Not quite? with the typed words as the topic, Esc, and no answer here); telemetry (`question_open`, `question_asked` with `matched` only, never the words); with the site's own questions, each typed finds its own answer; without script, every answer in the page. 7.3: axe clean in both modes, wide with the closest list open and an answer found, and on a phone with every question shown; "questions on a phone" (320, 360 and 844 by 390: no sideways scroll, 44 px targets, at rest and with the last question open); Keywords' E2E unchanged after the shared `data-suggestions` and `data-chevron` recipes; `siteDesignSystem.test.ts` and the home suites (518 of 519: the one failure is edit mode's AiPrompt, not this work); `npm run check` 0 errors; the story's 12 new screenshots looked at, and the Keywords story's and page's unchanged; `verify:prod` passes, the view's script 3.4 KB gzip. As built: [Questions §13](questions.md#13-as-built-stage-7) |
| 8 | In progress: 8.3 to 8.5 done, 8.1 and 8.2 next | 8.5: the stills are drawn from the site's own counts (`stills.ts`, `ViewStill.astro`), unit-tested in `viewStills.test.ts` (43 tests), and E2E "each card draws its view as a still, a mark for each strength (the hub: its sections)"; the transitions: E2E "moving between views is a view transition that carries each strength; none with reduced motion, or to the hub" (Bento to Cover names each strength `cap-<id>` once; to the hub, and under reduced motion, there's no transition), and the naming unit-tested against a stand-in page (`homeRoute.test.ts`, 31 tests: the largest element in view; hidden, faded, covered or scrolled out of a strip left out; the old page named by its geometry, where Chromium can't hit-test; the dialog closed first; the names cleared after; the opt-in on every view but the hub). The ViewStill story's 18 new screenshots and ViewChoices' 18 changed ones looked at (at 360 px the card's words wrap beside the still). "home views: change view" passes (7 tests). 8.4: [switcher §10](switcher.md#10-as-built-stages-2b-and-8), this row, and AGENTS.md's Home views section. 8.3: `verify:prod` passes, every bundle budget met. The home and design-system suites pass (600 of 601: the one failure is edit mode's AiPrompt, not this work); `npm run check` 0 errors |
