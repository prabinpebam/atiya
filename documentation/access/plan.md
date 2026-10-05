# Protected content: plan and Definition of Done

How locked pages, private pages, signing in, grants and telemetry ([spec](spec.md)) get built: a setup done once, then seven phases, each leaving the site working and deployable, held to the [quality benchmark](benchmark.md). Nothing protected goes live until the leak check guards the deploy (A5) and edit mode can make grants (A6). This is v2, revised after the critique in [spec §14](spec.md#14-the-critique-and-what-changed).

> **TL;DR.**
> - **A0: setup.** The private repository as a submodule, its deploy key, and (yours) a PostHog project.
> - **A1: two origins.** One content source reading `content/` and `private-pages/`, wired through every reader; opaque addresses; the rules that keep protected pages off open ones.
> - **A2: the crypto core.** The keyring envelope, sealed files, codes, links and grants, as pure, tested modules for Node and the browser.
> - **A3: sealing the build.** Seal markers in the layouts, the provenance record, the sealer, build-scoped keyrings and the three-layer leak check.
> - **A4: signing in.** The Sign in page, the access bar, the shared cards, the runtime (regions, pictures, videos, the lightbox) and sign-out that leaves nothing behind.
> - **A5: deploying.** The workflow fetches the submodule with the deploy key, builds quietly, seals, checks, deploys from `main` only, and runs nightly.
> - **A6: edit mode.** The Access screen, a page's access, ordering locked pages among open ones, uploads, and the existing Publish for both repositories.
> - **A7: telemetry.** PostHog with an allowlist on protected pages, identity by grant, opt-outs and the Privacy page.
> - **After A7, yours:** the first real locked page and its first grant, made in edit mode and published (§4).
> - **Status:** A0 to A7 are built and their Definition of Done rows met, except the two that need your PostHog project and a deploy from `main` (§2).

## 1. Phases

### A0: setup

1. **The private repository, as a submodule:**
   - create `atiya-private` (private), with a first commit (a README), since a submodule needs a commit to point at;
   - add it: `git submodule add -b main https://github.com/prabinpebam/atiya-private.git private-pages`, which writes `.gitmodules` (the manifest) and the pointer, and commit both in the public repository;
   - run `scripts/setup-private-pages.ps1`: it sets `submodule.recurse` and `push.recurseSubmodules check`, and puts the submodule on `main`.
2. **The deploy key:** an SSH key pair; the public half on `atiya-private` as a read-only deploy key (`gh repo deploy-key add`); the private half as the public repository's Actions secret `PRIVATE_CONTENT_KEY` (`gh secret set`); the key files deleted afterwards.
3. **PostHog (yours):** a free PostHog Cloud project (O1), its "Discard client IP data" setting off, and its key and host as Actions variables `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`. Until then the site builds without telemetry.

**Done when** `git submodule status` lists `private-pages` on the private `main`, `gh secret list` shows `PRIVATE_CONTENT_KEY`, and (once you've made it) `gh variable list` shows the two PostHog variables.

### A1: two origins

1. **The submodule's guard:** a unit test that `private-pages` is a submodule entry (mode 160000) in the public repository's index, and that no file under it is tracked there.
2. **The source** (`source.ts`): reads both folders; keys `/content/…` and `/private/…`; `fileOf` and `rootOf` by key; one digest. In a test build and the unit tests, the private folder is `tests/fixtures/private-pages/`; otherwise `private-pages/` when it exists.
3. **The contract** (`schema.ts`): the overlay (locked page nodes in open sections, each section's full order, private pages, tokens); the grant record (`access.json`) and the share message (`access-message.json`).
4. **The loader** (`load.ts`): private articles and media; the overlay merged into the route table; V23 to V26, V28, V29, V30 (the snapshot part), V31 and V32; the eligibility table (spec §10).
5. **Routes:** locked pages at `/<section>/<token>/`, private pages at `/p/<token>/`; `p`, `sign-in`, `_sealed` and `_access` reserved; each route knows its access (`open`, `locked`, `private`).
6. **Every reader of the content root:** picture metadata in dev (`pictures.ts`), the masters a build imports (`masters.ts` globs both), the files the content-files integration serves and copies, and the editor integration's watcher.
7. **The repository's lists:** a section lists its open pages, plus its locked ones marked for sealing; every other list (related, next and previous, the home page, the navigation, redirects, the planet) is open pages only, for every page (V32).
8. **In dev,** protected pages render open with a ribbon, and sections list their locked pages with a lock tag.
9. **Fixtures:** a Work-like section with two open pages and three locked ones between them (one with a picture and its dark version, one with a small video and its poster), a second section with one locked page, two private pages, and grants: all of the Work section (a code), one page (a code), a private page (a link), an expired one and a withdrawn one. All made up.

**Tests (unit):** the submodule rule; the two-origin source; V23 to V32 each with a failing fixture; opaque and reserved routes; a public-only build's routes and lists unchanged; a section's order with locked pages between open ones; no list but a section's holds a protected page.

### A2: the crypto core

In `src/site/access/`, pure, with no DOM and no Node-only API:
1. **`crypto.ts`:** AES-256-GCM seal and open (`ATS1`, its additional data); the keyring envelope (spec §5.3) with its strict header checks; PBKDF2 (600,000) and HKDF derivations; random keys, IVs, tokens, IDs and build IDs; base64url.
2. **`codes.ts`:** the EFF large wordlist (bundled into edit mode and the build, never into a page); generating a code (a unique name and four words); normalising what a visitor types.
3. **`grants.ts`:** a grant's state at a time; which pages its scope covers; the transition rules (no delete, no reused ID or name, a withdrawn grant's scope and secret fixed).
4. **`keyring.ts`:** building a grant's keyring, and opening one (the header checks, then the expiry).
5. **Credits:** the EFF wordlist in `assets-src/CREDITS.md`.

**Tests (unit, Node's Web Crypto):** QB2, QB2a, QB2b; codes (format, unique names, typed variants); grant states across dates and time zones; transitions.

### A3: sealing the build

1. **Seal markers in the layouts** (spec §5.4): `ArticleLayout` and `PageShell` take `sealed`; the regions in comment pairs; the neutral head; `IndexLayout` holds a section's locked cards in a hidden holder after the list, each marked with its page.
2. **The provenance record** (spec §6.2): written by `pictures.ts`, the content-files integration and the protected routes, emptied at the start of a build.
3. **`integrations/seal.mjs`**, last in `astro:build:done`: the build ID, the keys, the sealed regions and cards, the sealed private-origin files under `_sealed/<build>/`, the deletions, the keyrings under `_access/<build>/`; a log of counts only. It loads the crypto through a Node entry built from `src/site/access/` (one implementation).
4. **`scripts/verify-sealed.mjs`** and `npm run verify:sealed` (spec §6.3), in `verify:prod` and run on the E2E build.
5. **`npm run preview:protected`:** a local build with the real private content, checked, served on port 4331.

**Tests:** QB1 to QB1b (the sealer on a fixture `dist/`; the leak check against every planted kind; their output captured); an expired and a withdrawn grant get no keyring; `npm run verify:prod` passes with the fixtures.

### A4: signing in

1. **Components** (compounds, with doc comments and stories): `UnlockPanel`, `AccessBar`; `StoryCard`'s `shared` tag; the footer's Sign in link; the sign-in line in `IndexLayout`.
2. **The Sign in page** (`/sign-in/`), back to a same-site path afterwards.
3. **The runtime** (`src/site/scripts/sealed.ts`, loaded only where needed, QB7):
   - the code or the link (the fragment read and removed);
   - the keyring: build-scoped, the header checks, one reload on a missing or stale one, the expiry;
   - on a section, cards decrypted and placed after the open page each follows, the sign-in line removed;
   - on a locked or private page, regions swapped in, the real title, `astro:page-load`, focus on the heading;
   - pictures and dark versions near the viewport at the width they need, the lightbox's full size, videos and posters;
   - staying signed in, Remember on this device, sign-out across tabs and the back-forward cache;
   - every message in spec §7.2, in the live region too;
   - DOM events for telemetry (A7) to hear.
4. **No JavaScript and old browsers:** the `<noscript>` message and the Web Crypto check.

**Tests:**
- unit: the fragment parser; placing cards; the picture width; storage, expiry and reload decisions; the messages;
- E2E, a new group "protected content", on the test build: QB3 (the scope matrix), QB4, QB5, QB7a (timed), QB8 (axe in both themes, 320 px), QB9 (each reachable failure).

### A5: deploying

1. **`.github/workflows/deploy.yml`** (spec §6.1): the submodule fetched at its pinned commit with the deploy key; the quiet build; `verify:sealed` before the upload; `retention-days: 1`; the nightly schedule and `workflow_dispatch`; the deploy job for `main` only; the 50-day guard (`scripts/activity-guard.mjs`, unit-tested).
2. **A branch run** (Deploy now on a branch): green, sealed, checked, not deployed, and its log shows counts only.
3. **A base build** (`BASE_PATH=/atiya`): the sealed addresses, keyrings and media go through the base.

**Tests:** the activity guard (unit); the branch run; the base build.

### A6: edit mode

1. **Two origins in the store:** `/private/…` keys resolved to `private-pages/`; one transaction across both folders; the grant transitions refused (spec §4.1).
2. **The Access screen** (`/_edit/access/`): the list and its filters; New access code and New magic link with the message to copy; a grant's page with Extend, Change scope, Withdraw now, Copy message again, its history and its PostHog link; pure operations in `model/access.ts`.
3. **A page's access** (Open, Locked or Private) in the inspector: locking or opening moves the page and the media only it uses between the folders, keeping its place, with the history warning; a private page's address, Change address and Share.
4. **The Sections screen** lists locked pages among open ones, with a lock tag, and its reorder writes both orders.
5. **Uploads** for a protected page go into `private-pages/media/`.
6. **The existing Publish** (spec §8.3): the badge and the change list cover both folders; the message rules (yours only when nothing private changed); the private commit pushed first, then the public one with the pointer; Push again for whichever is behind; the refusals in words.
7. **The editor's test server** gives its throwaway repository a fixture `private-pages` submodule, with a bare remote for each.
8. **The editor spec's** publishing section ([§7](../editor/spec.md#7-publishing)) updated to match.

**Tests:** unit for the access operations, the transitions, the moves and the two-folder transaction; E2E "editor": QB10 (make a code and a link; withdraw; lock and open a page; publish a locked page's edit with the top bar's Publish: private commit, then the pointer with the generated message; a failed private push recovered), axe on the Access screen in both modes.

### A7: telemetry

1. **`src/site/scripts/telemetry.ts`** (spec §9): `posthog-js` pinned, its no-external build, on idle; production builds with `PUBLIC_POSTHOG_KEY` only (and, for the tests, a test build pointed at a fake host); cookieless; `person_profiles: 'identified_only'`; replay off; automatic page views and autocapture off on protected pages and the Sign in page, with the allowlist sent by the site; `before_send` stripping fragments everywhere and enforcing the allowlist on protected pages; `identify` and `reset` from the runtime's DOM events.
2. **On the planet,** loaded after the planet is live.
3. **Opting out:** GPC and DNT; `?telemetry=off` and `?telemetry=on`.
4. **The Privacy page,** as content in the Contact section, and its link in the footer.
5. **The workflow** passes the two Actions variables to the build.

**Tests:** unit for the sanitizer, the allowlist and the opt-outs; E2E "protected content": QB6 (every request to the fake host captured and decoded); `verify:prod` (QB7, QB7b).

## 2. Definition of Done

Each phase is done when every row for it is true and evidenced. A row marked *yours* needs something only you can do (an account, your content).

| # | Phase | Criterion | Evidence (benchmark) |
|---|---|---|---|
| 1 | A0 | `private-pages` is a submodule on the private `main`; the deploy key secret exists | `git submodule status`; `gh secret list` |
| 2 | A0 | *Yours:* a PostHog project with IP capture on, and its two Actions variables | `gh variable list`; PostHog's settings |
| 3 | A1 | No file under `private-pages/` can be committed to the public repository | The submodule unit test |
| 4 | A1 | Both folders load as one, through every reader; V23 to V32 hold; the eligibility table holds | `content.test.ts` |
| 5 | A1 | Protected pages have opaque addresses, appear only in their own section's list, and a public-only build is unchanged | `content.test.ts` |
| 6 | A2 | The crypto meets its vectors and refuses every malformed file | QB2, QB2a, QB2b |
| 7 | A2 | Codes are generated, never chosen; grant states and transitions follow their rules | `access.test.ts` |
| 8 | A3 | Every build is sealed, and the leak check passes and catches every planted leak, saying nothing protected | QB1, QB1a, QB1b |
| 9 | A3 | An expired or withdrawn grant has no keyring; every sealed file is build-scoped | Sealer unit tests |
| 10 | A4 | Signed out, a section lists only its open pages; signed in, exactly the grant's scope, in place | QB3 |
| 11 | A4 | A magic link opens its private page and leaves no fragment; a code never shows a private page | QB3 |
| 12 | A4 | Pictures, dark versions, the lightbox and videos work after signing in, within the time budgets | QB7a |
| 13 | A4 | Stale builds, sign-out, other tabs and Back leave nothing readable and no false error | QB4, QB5 |
| 14 | A4 | Accessible in both themes and at 320 px; every failure has its message | QB8, QB9 |
| 15 | A4 | The runtime and the open-page cost are within budget | QB7 |
| 16 | A5 | The workflow fetches the submodule, builds quietly, seals, checks before upload, deploys from `main` only, and runs nightly with its guard | The branch run; `activity-guard` unit test |
| 17 | A5 | The base build keeps every sealed address under `/atiya` | The base build |
| 18 | A6 | Grants are made, extended, rescoped and withdrawn in edit mode, recording who, why, when and until; the transitions are enforced | E2E "editor"; `editorAccess.test.ts` |
| 19 | A6 | Pages are locked, opened and made private in edit mode, keeping their place; locked pages are ordered among open ones | E2E "editor" |
| 20 | A6 | The existing Publish publishes both repositories, private first, and never puts your words in public history when anything private changed | QB10 |
| 21 | A7 | Telemetry sends nothing secret, only the allowlist on protected pages, and nothing at all when opted out | QB6 |
| 22 | A7 | The Privacy page says what's collected, and the footer links to it | The page |
| 23 | A7 | *Yours (needs row 2):* visits, clicks and sign-ins by grant reach PostHog with IP addresses | PostHog, after a deploy |
| 24 | All | The repository's checks pass, the spec's "As built" and AGENTS.md are up to date | QB11, QB12 |

**Status, 6 October 2026.** Rows 1 and 3 to 22 and 24 are met; their evidence is in the [spec's "As built"](spec.md#15-as-built) (§15.3), and where the build differs from the spec it says so there (§15.2: no grant filters or history; Withdraw now waits for Publish). Rows 2 and 23 are yours: the PostHog project and its variables, then a deploy from `main`.

## 3. Validation per phase

As [AGENTS.md](https://github.com/prabinpebam/atiya/blob/main/AGENTS.md) sets out: the lowest tier that covers each change, and a broad run at the end.

| Phase | Run | Broad run |
|---|---|---|
| A1 | `npx vitest related` on the content modules; `npm run check` | `npm test` (the loader is shared) |
| A2 | `npx vitest run tests/unit/access.test.ts` | None |
| A3 | The sealer and leak-check tests; `npm run verify:prod` | `verify:prod` |
| A4 | E2E "protected content", "site design system", "site on a phone" | None |
| A5 | The branch run; a base build | None |
| A6 | `npx playwright test --project=editor` | None |
| A7 | E2E "protected content"; `verify:prod` | `verify:prod` (a new dependency) |
| End | `npm test`, `npm run check`, `npm run verify:prod`, the touched E2E groups | The full E2E suite when the owner next deploys |

## 4. Order, and what comes after

- **A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7.** A2 can run beside A1. A7's anonymous part needs only A0; its access events need A4.
- **Nothing protected is published before A6**, so the first real grant is made in edit mode, never by hand.
- **Then, yours:** write the first locked page in edit mode, make its first grant, Publish, and check the live site: signed out, Work shows only its open work; your code shows the locked page. Try it once on a real phone and in Safari (the [benchmark's](benchmark.md#what-isnt-measured-here-and-why) manual checks).
