# Protected content: plan and Definition of Done

How locked pages, private pages, signing in, grants and telemetry ([spec](spec.md)) get built: a setup you do once, then eight phases, each leaving the site working and deployable. Nothing protected goes live until the leak check guards the deploy (A5).

> **TL;DR.**
> - **A0: your setup.** The private repository, its deploy key, a PostHog project, and answers to the open questions (or their defaults).
> - **A1: two content folders.** The contract, the loader and the routes read `private-pages/`; opaque addresses; the rules that keep protected pages off open ones.
> - **A2: the crypto core.** Keys, codes, links, keyrings and grants as pure, tested modules that run in Node and the browser.
> - **A3: sealing the build.** Sealed regions in the layouts, the sealer, sealed media and keyrings, and the leak check.
> - **A4: signing in.** The Sign in page, the access bar and the browser runtime: shared cards in their places, locked pages, pictures, videos, the lightbox and staying signed in.
> - **A5: deploying.** The workflow checks out the private repository, builds quietly, seals, checks and deploys, and runs nightly. The first locked work goes live in Work.
> - **A6: edit mode.** The Access screen, a page's access (open, locked, private), ordering locked pages among open ones, uploads and publishing to two repositories.
> - **A7: telemetry.** PostHog, the events, identity by grant, the opt-outs and the Privacy page. It can start any time after A0.
> - **A8: who looked, in edit mode.** A grant's activity from PostHog on its page (optional).

## 1. Phases

### A0: your setup (no code)

1. **The private repository, as a submodule:**
   - create `atiya-private` (private), with a first commit (a README), since a submodule needs a commit to point at;
   - add it to the project: `git submodule add -b main https://github.com/prabinpebam/atiya-private.git private-pages`, which writes `.gitmodules` (the manifest) and the pointer;
   - commit those two in the public repository ("Private pages: add the submodule"), so it's tracked from then on;
   - run `scripts/setup-private-pages.ps1` (written in A1; until then, by hand): it sets `submodule.recurse` and `push.recurseSubmodules check`, and puts the submodule on `main`.
2. **The deploy key:**
   - make an SSH key pair for it;
   - add the public half to `atiya-private` as a read-only deploy key;
   - add the private half to `prabinpebam/atiya` as the Actions secret `PRIVATE_CONTENT_KEY`.

   `ssh-keygen`, `gh repo deploy-key add` (read-only unless told otherwise) and `gh secret set` do all three from your machine; the key files are deleted once the secret is set.
3. **PostHog:** create a free PostHog Cloud project in the region you choose (O1). Add its project key and host to `prabinpebam/atiya` as Actions variables, not secrets: `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`.
4. **The open questions** O1 to O8 ([spec §13](spec.md#13-decisions)): answer them, or the defaults stand.

**Done when** `gh repo view prabinpebam/atiya-private` works, `git submodule status` lists `private-pages` on a commit that's on the private `main`, `gh secret list` shows `PRIVATE_CONTENT_KEY`, and `gh variable list` shows the two PostHog variables.

### A1: two content folders

1. **The submodule's guard:** a unit test that `private-pages` is a submodule entry (mode 160000) pointing at the private repository, and that the public repository tracks no file under it; and `scripts/setup-private-pages.ps1` (A0).
2. **The contract** (`schema.ts`):
   - the overlay structure: locked page nodes placed in open sections, each section's full order (V31), and private pages, each with a `token`;
   - V23, V24, V25, V28 and V31 in the loader.
3. **The source and loader** (`source.ts`, `load.ts`):
   - read `private-pages/` when it exists, into the same snapshot, with each file's folder known;
   - in tests, read the fixture folder (`tests/fixtures/private-pages/`), never the real one.
4. **Routes** (`routes.ts`):
   - locked pages at `/<section>/<token>/`;
   - private pages at `/p/<token>/`;
   - the Sign in page at `/sign-in/`;
   - `p`, `sign-in`, `_sealed` and `_access` join `RESERVED`.
5. **Masters:** `masters.ts` imports the private masters too, so a build emits them for sealing.
6. **Keeping protected pages off open ones:** a section's list holds its open pages, plus its locked ones marked as such (for sealed cards, in the overlay's order). Every other list (related stories, next and previous, the home page, the navigation, redirects and the planet's data) leaves protected pages out unless the page being built is itself protected.
7. **In dev**, protected pages render open with a ribbon ("Locked: listed for signed-in readers" or "Private: opens from a magic link"), and sections list their locked pages with a lock tag.
8. **Fixtures:** a fixture Work-like section with two open pages and three locked ones in between (one with a picture, a dark mode version and a small video), a section with only locked pages, and one private page, all made up.
9. **AGENTS.md** gains a "Protected content" section with this feature's rules, and links to the spec.

**Tests:**
- unit (`content.test.ts`, `routes.test.ts`):
  - V23, V24, V25, V28 and V31, each with a failing fixture;
  - the opaque routes, and reserved paths;
  - a public-only build's routes and section lists, without the private folder, are today's;
  - a section's order with locked pages between open ones;
  - no list but a section's includes a protected page;
  - the submodule rule;
- E2E "content": a locked page in dev shows its ribbon, and its section lists it with a lock tag.

### A2: the crypto core

All pure, in `src/site/access/`, with no DOM and no Node-only API:
1. **`crypto.ts`:**
   - AES-256-GCM seal and open with the `ATS1` format and its additional data;
   - PBKDF2 at 600,000 and HKDF derivations;
   - random keys, IVs, tokens and IDs.
2. **`codes.ts`:**
   - the EFF large wordlist (bundled only into edit mode and the build, never into a page);
   - code generation (a unique name and four words), parsing and normalising what a visitor types (case, spaces, hyphens).
3. **`grants.ts`:**
   - the grant contract (V26, V29, V30);
   - a grant's state at a given time (active, expires soon, expired, withdrawn);
   - which pages its scope covers.
4. **`keyring.ts`:** building a keyring for a grant, and opening one with its expiry check.
5. **Credits:** the EFF wordlist in `assets-src/CREDITS.md` (CC BY 3.0 US).

**Tests (unit, in Node's Web Crypto, which is the browser's API):**
- a round trip for every sealed file kind;
- a wrong key, one changed byte, a swapped file, the wrong additional data and a truncated file all fail cleanly;
- known-answer tests for PBKDF2, HKDF and AES-GCM (published test vectors);
- codes: the format, uniqueness of names, what a visitor may type;
- grant states across their dates and time zones;
- a keyring past its expiry is refused.

### A3: sealing the build

1. **`SealedRegion`** (compound) and the layouts' `sealed` prop ([spec §5.4](spec.md#54-sealing-a-page)): `ArticleLayout` and `IndexLayout` wrap the page, the last crumb, the minimap, related, next and previous, and the cards. `PageShell` gives a sealed page a neutral head, `noindex` and its referrer policy. Each with a doc comment and a story.
2. **`integrations/seal.mjs`**, last in `astro:build:done`:
   - fresh page keys; regions and each card sealed in place;
   - every file a sealed region refers to is sealed into `_sealed/`, its address rewritten inside the sealed HTML, and the readable file deleted;
   - a keyring for every valid grant;
   - a log of counts only.
3. **`scripts/verify-sealed.mjs`** and `npm run verify:sealed` ([spec §6.3](spec.md#63-the-leak-check)), added to `verify:prod` and to the E2E build.
4. **Test builds** seal the fixtures with fixture grants whose codes the tests know; a production build refuses fixture grants.

**Tests:**
- unit:
  - the sealer on a small fixture `dist/`: regions, cards, media, keyrings, and nothing readable left;
  - the leak check fails on each kind of leak, planted one at a time (a title, a heading, a caption, an alt text, a master's bytes, a stray image, an open page's link, a missing `noindex`);
  - an expired grant and a withdrawn one get no keyring;
- `npm run verify:prod` passes, with the leak check, on a build with the fixtures.

### A4: signing in, in the browser

1. **`UnlockPanel`** and **`AccessBar`** (compounds), with stories and every state; **the Sign in page** (`/sign-in/`, back to where you came from); **the sign-in line** under a section with locked pages; **the footer's Sign in link** ([spec §2.3, §7](spec.md#7-what-a-visitor-sees)).
2. **`src/site/scripts/sealed.ts`:**
   - the code or link (reading and removing the fragment);
   - the keyring and its expiry;
   - on a section: the covered cards decrypted and inserted in their places, the sign-in line removed;
   - on a locked or private page: regions swapped in, the real title, then `astro:page-load`;
   - staying signed in (session, Remember on this device, Sign out putting lists back);
   - the messages, in the live region too.
3. **The media resolver:**
   - pictures decrypted near the viewport at the width they need;
   - dark mode versions;
   - the lightbox's full size on opening;
   - videos and their posters;
   - `blob:` URLs revoked on leaving.
4. **No JavaScript and old browsers:** the `<noscript>` message and the Web Crypto check.

**Tests:**
- unit: the fragment parser; placing decrypted cards in the section's order; the choice of picture width; storage and expiry rules; the same-site return path;
- E2E, a new group "protected content", on the test build:
  - signed out, the Work-like section lists only its open pages, then the sign-in line, and its source holds no locked title;
  - signing in on `/sign-in/` returns to the section, whose covered cards appear in their places, tagged; a grant with one page sees only that card;
  - a section with only locked pages shows its empty state and the sign-in line signed out;
  - a locked page opened directly shows the panel, and opens after signing in there;
  - a wrong code, an expired grant and a withdrawn one show their messages; a locked page outside the grant's scope says so;
  - a magic link opens a private page and leaves no fragment in the address bar; a code never shows a private page;
  - moving between pages needs no code; Sign out puts the lists back;
  - pictures, a dark mode version, the lightbox and a video work after signing in;
  - every network response holds no fixture page's title;
  - axe on the Sign in page, a section signed in, and a locked page, in both modes;
  - the Sign in page and the access bar on a phone (the group "site on a phone": 320 px, 44 px targets).

### A5: deploying

1. **`.github/workflows/deploy.yml`** ([spec §6.1](spec.md#61-the-deploy-workflow)):
   - the public checkout as today, then `private-pages` fetched at its pinned commit with the deploy key (an SSH agent holding only that key), which stops the deploy if it fails;
   - the quiet build;
   - `verify:sealed` before the upload;
   - `retention-days: 1`;
   - the nightly schedule and `workflow_dispatch`;
   - the 60-day warning (an issue when the last commit is 50 days old).
2. **A base build check** (`BASE_PATH=/atiya`): the sealed addresses, the keyrings and the media go through the base.
3. **The first real locked work**, a locked case study in Work beside the open ones, with your first grant, made by hand in `private-pages/` (edit mode's screens come in A6).

**Tests:**
- the workflow run is green, and its log shows counts only;
- on the live site: the section shows no titles, the first grant's code opens it, and an expired test grant doesn't;
- a deliberate leak (a fixture title planted in an open page, on a branch) fails the deploy before the upload.

### A6: edit mode

1. **The Access screen** (`/_edit/access/`), from the editor's tier ([spec §8.1](spec.md#81-the-access-screen)):
   - the list and its filters;
   - New access code and New magic link, with the message to copy;
   - a grant's page: Extend, Change scope, Withdraw now, Copy message again, its history;
   - the pure operations in `model/access.ts`.
2. **A page's access** (Open, Locked or Private): locking or opening moves the page and its media between the folders in one transaction, keeping its place, with the history warning; the Sections screen orders locked pages among open ones and writes both orders.
3. **Pages:**
   - the list marks and filters locked and private pages; New private page;
   - a private page's address, Change address and Share;
   - uploads go to the right folder.
4. **The store** writes to both folders in one transaction; versions, the check and rollback cover both.
5. **Publish** ([spec §8.3](spec.md#83-publishing-to-two-repositories)): two groups; the private commit pushed first, then one public commit with `content/` and the pointer (the fixed message when it's only the pointer); Push again for each; refusing on a submodule that isn't on `main`.
6. **Preview as a visitor:** the sealed shell, sealed on the fly with a dev-only grant.
7. **PostHog person properties** on creating or changing a grant (only once A7 is in, and only with the project key set).
8. **The editor's test server** (`scripts/editor-test-server.mjs`) gives its throwaway repository a fixture `private-pages` submodule, with a bare remote for each, so publishing is tested end to end without touching GitHub.

**Tests:**
- unit: the access operations (create, extend, change scope, withdraw; a withdrawn grant stays withdrawn); locking and opening a page, keeping its place; ordering locked pages among open ones (V31); the two-folder transaction and its rollback;
- E2E "editor":
  - create a code and a link, copy the message;
  - withdraw a grant;
  - lock a section and see its pages move;
  - create a private page and share it;
  - publish to both remotes, private first;
  - axe on the new screen in both modes.

### A7: telemetry

1. **`src/site/scripts/telemetry.ts`** ([spec §9](spec.md#9-telemetry)):
   - `posthog-js` pinned, in its build that loads no other script, imported on idle;
   - production builds only, and only with `PUBLIC_POSTHOG_KEY` set;
   - cookieless, with `person_profiles: 'identified_only'` and session replay off;
   - `before_send` strips fragments and drops text and attributes from sealed regions.
2. **The events:**
   - `access_signed_in`, `access_opened`, `access_failed` and `access_signed_out` from `sealed.ts`, with `identify` by grant on every page while signed in;
   - `video_played`;
   - `planet_opened`.
3. **On the planet**, the script loads only after the planet is live, so the progressive-loading budgets hold.
4. **Opting out:** GPC and DNT respected; `?telemetry=off` and `?telemetry=on`.
5. **The Privacy page**, as content in the Contact section, and its link in the footer.
6. **The workflow** passes the two Actions variables to the build.

**Tests:**
- unit: the `before_send` sanitizer (fragments, sealed text, attributes), the opt-out rules;
- E2E "protected content" (a test build with a fake PostHog host, every request captured):
  - a magic link's secret is in no request;
  - no fixture page's text is in any request;
  - signing in sends `access_signed_in` with the grant's ID and nothing else that identifies the recipient;
  - GPC set sends nothing;
- `verify:prod`: the site's JS stays within its budgets, and the planet's critical path doesn't change.

### A8: who looked, in edit mode (optional)

1. **A personal PostHog API key**, read from Windows Credential Manager by the dev server, never written to a file.
2. **A grant's page** shows its activity: unlocks, pages viewed, devices, places and IPs, with the dates.
3. **The list** shows when each grant was last opened.

**Tests:**
- unit: the query and its mapping to the screen, on recorded responses;
- E2E "editor": the activity, from a stubbed PostHog.

## 2. Definition of Done

Each phase is done when every row for it is true and evidenced.

| # | Phase | Criterion | Evidence |
|---|---|---|---|
| 1 | A0 | The private repository, the deploy key secret and the PostHog variables exist | `gh repo view`, `gh secret list`, `gh variable list` |
| 2 | A1 | `private-pages/` is a submodule, and none of its files can be committed to the public repository | The submodule unit test |
| 3 | A1 | Protected pages have opaque addresses; no open page, and no list but their own section's, refers to them; a section keeps one order for open and locked pages | `content.test.ts`, `routes.test.ts`: V23 to V25, V28, V31 |
| 4 | A1 | The site builds without `private-pages/` | A public-only build in the unit tests |
| 5 | A2 | Every sealed file opens only with its key, its bytes and its purpose | Crypto unit tests, with known-answer vectors |
| 6 | A2 | Codes are generated, never chosen, and grant states follow their dates | `access.test.ts` |
| 7 | A3 | A built protected page holds no readable title, text, picture or video, and its shell is `noindex` | `verify:sealed` on the fixture build; its planted-leak unit tests |
| 8 | A3 | An expired or withdrawn grant has no keyring in the build | Sealer unit test |
| 9 | A4 | Signed out, a section lists only its open pages; signed in, it also lists the locked pages the grant covers, in their places, and nothing outside its scope | E2E "protected content" |
| 10 | A4 | A magic link opens its private page and leaves no secret in the address bar; a code never shows a private page | E2E "protected content" |
| 11 | A4 | Pictures, dark mode versions, the lightbox and videos work after signing in | E2E "protected content" |
| 12 | A4 | The Sign in page, a signed-in section and a locked page pass axe in both modes, and work at 320 px | E2E "protected content", "site on a phone" |
| 13 | A5 | The deploy fails closed: a private fetch that fails, a failed build or any leak stops it before the upload | A deliberate-leak run on a branch |
| 14 | A5 | The build log shows no protected title, slug or ID | The green run's log |
| 15 | A5 | An expiry date takes effect by the next nightly deploy | A short-lived test grant on the live site |
| 16 | A6 | Codes and links are made, extended and withdrawn in edit mode, and each records who, why, when and until | E2E "editor" |
| 17 | A6 | Publishing pushes the private commit first, then the public commit with the pointer, and a private-only change deploys through that pointer commit | E2E "editor", on the fixture remotes |
| 18 | A7 | Visits, clicks, outbound links and sign-ins by grant reach PostHog, with IP addresses | A live check in PostHog after deploy |
| 19 | A7 | No secret and no protected text is ever sent | E2E with captured requests |
| 20 | A7 | GPC, DNT and `?telemetry=off` send nothing, and the Privacy page says what's collected | E2E; the page |
| 21 | A7 | The planet's loading budgets are unchanged | `verify:prod`, `npm run perf:audit` |
| 22 | All | The spec's "As built" records what was built, and AGENTS.md has the feature's rules | The docs |

## 3. Validation per phase

As [AGENTS.md](https://github.com/prabinpebam/atiya/blob/main/AGENTS.md) sets out: the lowest tier that covers each change, and a broad run at the milestones.

| Phase | Run | Broad run (tier 3) |
|---|---|---|
| A1 | `npx vitest related` on the content modules; `npm run check`; E2E "content" | `npm test` at the end (the loader is shared) |
| A2 | `npx vitest related` on `src/site/access/` | None |
| A3 | The sealer and leak-check unit tests; `npm run verify:prod` | `verify:prod` (it changes the build) |
| A4 | E2E "protected content", "site design system", "site on a phone" | None |
| A5 | The workflow run; a `BASE_PATH=/atiya` build | Full `npm run e2e` before the first real locked work goes live |
| A6 | `npx playwright test --project=editor` | None |
| A7 | E2E "protected content" (requests); `verify:prod` | `verify:prod` and `perf:audit` (a new dependency) |
| A8 | Its unit tests; E2E "editor" for the screen | None |

## 4. Order and dependencies

- **A0 comes first**, since A1 needs `private-pages/` and A5 needs the key.
- **A1 → A2 → A3 → A4 → A5** is the critical path: nothing protected is published until A5's deploy has the leak check in front of it.
- **A6** needs A1 to A4. Until it lands, grants and protected pages are made by hand in `private-pages/` (A5 shows how).
- **A7** needs only A0. Its access events need A4, and its person properties need A6.
- **A8** needs A6 and A7.

The risks are in [spec §12](spec.md#12-limits-and-risks).
