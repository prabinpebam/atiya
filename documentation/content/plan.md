# Content platform: plan and Definition of Done

How the site moves from hardcoded content to data-driven content, in phases that each leave the site working and deployable. It covers what's hardcoded today, the phases and their Definition of Done, the tests, the risks, the decisions needed from you, and how the backend comes later. The architecture is in the [spec](spec.md).

> **TL;DR.**
> - **Phase 0: the same site, from data.** The contract, the `files` adapter, the checks, and today's content moved into `content/`. No visible change.
> - **Phase 1: the IA.** The site structure becomes the information architecture (its routes at the root, templates, menus and rules); `/classic/` redirects; the planet structure is re-pointed at the new pages.
> - **Phase 2: the first articles.** Three case studies, four practice areas, Leadership and About, with their media organised, plus the three new blocks they need.
> - **Phase 3: API-ready.** The `api` adapter, a mock server, contract tests, OpenAPI, snapshots, webhook rebuilds and previews.
> - **Decided:** O1 (the IA's routes at the root) and O2 (a navigation structure per channel, so the planet can diverge from the site). Still open before phase 1: O5 (the home page) and O7 (talks and side projects on the site) (§7).

## 1. Today's content, and where it goes

| Where it's hardcoded today | What | Becomes |
|---|---|---|
| `src/pages/index.astro` | The landing's title, hero name, standfirst, picture and alt text, both buttons, the note and its link to the docs | The site structure's `home` hub (`hero` and `text` blocks); the picture becomes `media/structures/site/home/hero` |
| `src/pages/classic/index.astro` | Title, heading, standfirst, the "Sections" list | A `classic` hub listing its children (phase 0); gone in phase 1, when `/` is the IA's home |
| `src/pages/classic/[id].astro` | The title pattern "— Prabin Pebam", the "Classic site" crumb | Derived from `site.name` and the route table |
| `src/content/landmarks/*.md` (7) | Each landmark's title, kicker, summary, order and body; the dialog; the planet's placement | An article (kind `page`) per landmark under the `classic` hub (phase 0), replaced by the IA's pages (phase 1); and the planet structure's 7 places, with `dialog` and `world` |
| `src/site/classic.ts` | The header's menu (built from landmarks); the "Explore in 3D" label | The site structure's `primary` and `actions` menus |
| `src/site/components/compounds/SiteFooter.astro` | The footer's default links | The site structure's `footer` menu |
| `src/site/design/meta.ts` | `SITE_NAME` | `site.name` |
| `src/site/components/compounds/PageShell.astro` | The default description, social image and its alt text | `site.description`, `site.socialImage` |
| `src/layouts/BaseLayout.astro` | The `/play` page's description | `site.description` |
| `src/pages/play.astro` | The landmarks JSON for the game | Built from the planet structure |

**Staying in code**, as the spec's boundary says:
- interface strings;
- the design library's stories and samples;
- the documentation;
- the game's world, rules and its characters' preset lines (`welcomeLines` and the NPCs' `LINES`).

The characters' lines are the game's own writing. They could become a `dialogue` resource later, if the owner wants to edit them without code.

## 2. Phases

### Phase 0: the same site, from data

The pipeline, proved on the content that exists, with no visible change.

1. **The contract:** Zod schemas for every resource in the [model](model.md), in `src/site/content/schema/`, with JSON Schema output to `content/schema/`.
2. **The `files` adapter,** the shared query functions (`query.ts`), and the custom loader behind Astro collections in `src/content.config.ts`.
3. **The repository and view mappers,** and the link and media resolvers (the `local` strategy).
4. **`npm run content:check`:** schema, integrity and the rules V1 to V8, V10, V12 and V13 (V4's four primary destinations apply from phase 1); wired into `npm test`.
5. **Migration.** Write `content/`: `site`; the site structure (the `home` hub, a `classic` hub with an item node per landmark, and the three menus); one article per landmark (their bodies, from Markdown into blocks); the planet structure (7 places, each showing its landmark's article, with that article as its full page); `people/prabin`; and the first media (§1). Delete `src/content/landmarks/` and the copy from the pages listed in §1.
6. **Rendering from data:** the site structure reproduces the current routes (`/`, `/classic/`, `/classic/<id>/`), read through the repository. `/play` builds its JSON from the planet structure.
7. **Guarding against regressions:** a unit test that fails on copy in `src/pages/` (text nodes and string props other than the interface strings' module), so hardcoding can't come back.

### Phase 1: the information architecture

Follows decisions O1 and O2; needs O5 and O7 (§7).

1. **The tree and routes:** the site structure becomes the [IA](ia.md#2-the-site-structure) at the root (hubs for home, work, expertise and leadership; item nodes for about, contact, the résumé and not-found), the route table, and `src/pages/[...path].astro` with a template per item type and one for hubs. The current per-page routes and the `classic` hub are deleted.
2. **The rules** in `src/site/content/rules/`: current item, breadcrumbs, local navigation, previous and next, card metadata. Each has unit tests against fixtures.
3. **Menus** from the site structure: the header, the phone menu, the footer.
4. **Redirects and the routes lock (V9):** `/classic/` redirects to `/`, and each `/classic/<id>/` to its place's full page (O1). `routes.lock.json` is written and checked from now on.
5. **The planet structure** is re-pointed as [structures §7](ia.md#7-from-todays-site) proposes: each place gets its entries and its full page on the new site. The game's fast travel and dialogs read the planet structure; every link out uses the route table.
6. **Outputs:** `sitemap.xml`, the 404 page, and each page's canonical and social-card tags from `seo` and `site`.

### Phase 2: the first articles

The IA's "first coherent release" backlog, in data. Most of this phase is writing, which is yours. Engineering adds:

1. **New blocks:** `facts` (the case study's scan layer), `metrics` and `callout`, as design-system components with stories, then as blocks.
2. **The case-study template:** the scan layer in the first screen, the end matter (related, practice areas, back to Work), and the minimap on long ones.
3. **The media pipeline** for real assets: slots and widths (media §5), the copy integration for video, captions and PDFs, and the budget checks.
4. **Content:**
   - three case studies;
   - four practice areas;
   - the Leadership overview and its operating principles;
   - About;
   - Contact;
   - an HTML résumé.

   Each goes through the governance lifecycle (`draft` to `published`), and none is published with placeholder words.

### Phase 3: API-ready

1. **The `api` adapter:** auth, ETags, retries, the `.cache/content/` cache, and `CONTENT_FALLBACK=snapshot`.
2. **The mock server** (`npm run content:serve`) and the **contract test**: both adapters return identical data for every resource.
3. **Generated contract documents:** OpenAPI 3.1 (`content/openapi.yaml`) and the JSON Schemas, both from the Zod schemas.
4. **Snapshots:** `npm run content:snapshot`.
5. **Rebuilds:** the deploy workflow takes `repository_dispatch` (`content-published`) and a daily scheduled run, with a concurrency group. A relay design for the webhook is written, with its signature check.
6. **Previews:** `CONTENT_PREVIEW=1` with the preview token, locally and in a separate preview deployment.
7. **The media resolver's strategies:** `remote` and `cdn`, behind `MEDIA_STRATEGY`.

## 3. Definition of Done

Each phase is done when every row for it is true and evidenced (a test name, a command's output or a screenshot).

| # | Phase | Criterion | Evidence |
|---|---|---|---|
| 1 | 0 | Every resource in `content/` validates; `content:check` passes and is part of `npm test` | Test run |
| 2 | 0 | No editorial copy, menu item, content URL or media path remains in `src/pages/`, `src/layouts/` or `src/site/` (the §1 list is empty) | The regression unit test; a review of the diff |
| 3 | 0 | The site looks and behaves as before: the site E2E groups and the planet's E2E pass unchanged | E2E |
| 4 | 0 | `/play` gets its places from the planet structure through the repository; fast travel and dialogs are unchanged | The planet's E2E |
| 5 | 1 | Every page renders from the route table, which comes from the site structure; there are no per-page content routes | Route table test; E2E "content" group |
| 6 | 1 | The current item, breadcrumbs, local navigation and previous/next follow the IA rules | Unit tests on the rules; E2E |
| 7 | 1 | The old URLs redirect; the routes lock is enforced | E2E on redirects; a check that fails on a removed path |
| 8 | 1 | The channels are independent: rearranging the planet structure changes no item and no site path, and the reverse; every place and entry has a page on the site (V12, V13) | Unit tests that change one structure and compare the other's output; `content:check`; the planet's E2E |
| 9 | 2 | Three case studies, four practice areas, Leadership, About, Contact and the résumé are published and pass V1 to V11 | `content:check`; E2E; the governance review recorded in each item's `reviewedAt` |
| 10 | 2 | Every image has alt text and credit; video has captions and a poster; budgets hold | `content:check` |
| 11 | 2 | Axe passes in light and dark on every template; bundle and font budgets hold | E2E; `npm run verify:prod` |
| 12 | 3 | The `files` and `api` adapters give identical results for every resource | The contract test |
| 13 | 3 | A `repository_dispatch` event rebuilds and deploys; a failed API falls back to the snapshot only when asked | A workflow run; an adapter test |
| 14 | 3 | Switching `CONTENT_SOURCE` changes no file outside `src/site/content/source/` and configuration | Review; the contract test |

## 4. Tests

| Change | Tier (from the repository's validation rules) | What runs |
|---|---|---|
| A content file | 1 | `npm run content:check` |
| A schema, rule, mapper or adapter | 1 | `npx vitest related` on the changed files; `npm run check` |
| A template or the block renderer | 2 | The E2E "content" group, and the site groups it touches |
| The deploy workflow, the loader, or Astro's configuration | 3 | Full `npm test`, `npm run verify:prod`, and the E2E groups |

A new E2E group, **content**, covers:
- every template rendering;
- menus and their current item;
- breadcrumbs;
- redirects;
- the 404 page;
- media with alt text and without layout shift;
- a page reached from the planet.

## 5. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Long text is awkward to write in JSON | Slow authoring before the backend exists | Markdown in blocks; editor validation from the JSON Schemas. If it's still painful, a Markdown-with-front-matter importer can write the same JSON (it's an authoring tool, not a second format) |
| The repository grows with media | Slow clones; the Pages size limit | Budgets and checks (media §4); video on a video host; masters only, never generated sizes |
| The planet and the site drift apart | Visitors find things on the planet with no page, or lose their way between the two | V12 and V13 fail the build on a dead end; every place links its full page on the site |
| Build time grows with images | Slower deploys | Astro's content layer and image caches kept between CI runs |
| A backend can't serve the contract exactly | The swap costs more than an adapter | The contract is plain REST and JSON; any backend can sit behind a thin adapter service that serves `/v1` |
| Hardcoded copy creeps back | The goal erodes | The regression unit test (DoD 2) |

## 6. Later: the backend

The contract doesn't depend on a particular backend. When it's time, compare candidates (a hosted or self-hosted headless CMS, or a small custom service) on:

1. **The contract:** can it serve `/v1` as specified, directly or through a thin adapter?
2. **Editorial workflow:** the governance lifecycle (seven statuses), preview, scheduled publishing and roles.
3. **Media:** an image service (the `cdn` strategy), focus points, and metadata on assets.
4. **Webhooks:** signed, per event, with retries.
5. **Operations:** cost at a personal portfolio's size, backups and exports (the snapshot format), and whether it can be self-hosted.

The migration is then a snapshot to compare, the `api` adapter pointed at the backend, and a change of `CONTENT_SOURCE` in the deploy workflow.

## 7. Open decisions

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| O1 | **The URLs.** The IA's routes at the root (`/work/…`), with `/classic/…` redirecting; or a `/classic/` prefix kept in front of every IA path | **Decided:** the root, with redirects ([structures §7](ia.md#7-from-todays-site)) | Phase 1 |
| O2 | **The planet and the site.** One shared navigation, or one per channel | **Decided:** a structure per channel mapping the same items, joined by V12 and V13; the first planet structure is in [structures §7](ia.md#7-from-todays-site) | Phase 1 |
| O3 | **Rich text.** A Markdown subset inside blocks (D6), or structured spans | The Markdown subset | Phase 0 |
| O4 | **Video.** Short clips in the repository within the budget, and longer ones on YouTube or Vimeo | As proposed ([media §4](media.md#4-formats-and-budgets)) | Phase 2 |
| O5 | **The home page.** The landing's planet-or-pages choice folded into the IA's home page, or kept as its own step before it | Folded in: the planet as the hero's action, remembering the last choice | Phase 1 |
| O6 | **Notes.** In the first release or later | Later, as the IA advises, once there's a maintenance plan | Phase 2 |
| O7 | **Talks and side projects on the site.** The planet has the Amphitheater (talks) and the Greenhouse (prototypes, galleries); the IA has no pages for them | Talks as articles under About until there are enough for a Talks hub; prototypes as case studies under Work (`engagementType: prototype-or-experiment`); a gallery the planet shows gets its own page under Work (V13); one only embedded in a body needs none | Phase 1 |
