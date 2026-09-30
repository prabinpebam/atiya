# Sections, pages and the planet: plan and Definition of Done

How the [spec](spec.md) is built: six phases, in the order the owner asked for them, except where one depends on another. Each phase leaves the site and the planet working and deployable, and ends with its tests passing and a local commit. This is v2, re-phased after the review ([spec §10](spec.md#10-critique-and-v2)).

> **TL;DR.**
> - **Status:** all six phases are built and their Definition of Done is met (30 September 2026, §2).
> - **S1: words (done).** Every placeholder is rewritten for a site under construction, and a test keeps placeholder markers out.
> - **S2: sections, pages and the navigation.**
>   - Three levels.
>   - Section views: list, tiles and bento.
>   - Page kinds: Article, Page and Gallery.
>   - The first seven sections.
>   - The home page listing them.
>   - `menus.primary` driving the header everywhere.
>   - `/classic/` redirecting.
> - **S3: edit mode for the site.** Sections (view, "In the navigation"), a Navigation screen, and Pages.
> - **S4: the planet structure.**
>   - `content/structures/planet.json` for the words and pages, with the world in code.
>   - `/play` built from both.
>   - V13 to V16.
>   - The one-transaction page service.
> - **S5: reading on the planet.**
>   - The planet-frame routes, the place bar and the smoke.
>   - The overlay and its messages.
>   - Moving within a building, and links to other buildings.
>   - Deep links and the context switches.
> - **S6: edit mode for the planet.** The Planet screen, and "On the planet" in a page's settings.

## 1. Phases

### S1: words for a site under construction (U1), done

1. The landing's and the classic front page's standfirsts.
2. The seven landmarks' summaries, dialogs and pages: what each will hold, and that it's being written. The fake items are gone. The Lighthouse links to the first story, and the Greenhouse to how the site was built, both with relative links.
3. The game: Prabin's welcome, his lines about the buildings, and the How to play tip.
4. The guard (V20): `tests/unit/copy.test.ts`.

### S2: sections, pages and the navigation (U2 to U7)

1. **The contract** (`schema.ts`):
   - a hub's `view` replaces `template`;
   - the article kinds gain `gallery`;
   - structures refer only to `article` pages;
   - `menus.primary` (V17);
   - three levels (V22) and unique node IDs (V21) in the loader.
2. **Everything that read `template`:**
   - `[...path].astro` and `Page.astro` find home as the root;
   - edit mode's `where` API, its Sections tree and its hub form (Template becomes View);
   - edit mode's structure operations keep `menus` (R3), with a regression test over every operation.
3. **The content:**
   - the home hub's `summary` (the landing's standfirst);
   - Leadership's `view`;
   - six new sections with their S1 words ([spec §3.6](spec.md#36-the-first-sections));
   - `menus.primary` listing the seven.
4. **The design system:**
   - `StoryCard`'s `row` variant;
   - `IndexLayout`'s `view` and `empty`;
   - `ArticleHeader` fed by the kind's opening (from `Page.astro`);
   - stories for each.
5. **`src/site/content/navigation.ts`:**
   - `siteNav(route)`: the entries with their labels, the current entry, and draft pages left out;
   - `exploreHref(route)`: the plaza until S4 gives it places.
   - Every site page uses them, and `src/site/classic.ts` and `classicNav` go.
6. **The home page** (`src/pages/index.astro`):
   - the opening from the home hub's words, with "Explore the planet" and "Read the site";
   - the sections in `LandingLayout`'s `after` slot, as a `ContentsList` with "Being written" on empty ones.
7. **Redirects** (V19): a `Redirect` layout (a meta refresh, a canonical link and a plain link, through `withBase`) for:
   - `/classic/`, to `/#sections`;
   - each `/classic/<building>/`, to its section.

   The landmark collection stays until S4, because the planet still reads it.
8. **The footer:** "Classic site" becomes "Home".
9. **The game's classic links** keep working through the redirects until S4 re-points them.

**Tests:**
- unit:
  - the contract (view, kinds, V21, V22);
  - `siteNav` (labels, current, links, drafts, V17);
  - the structure operations keeping `menus`;
  - the redirects;
- E2E "content":
  - each view renders its cards;
  - an empty section shows its empty state;
  - each kind opens as it should;
- E2E "landing & classic": the home page lists the sections, and `/classic/` and `/classic/workshop/` redirect;
- E2E "site design system": the header lists `menus.primary` on the home page, a section and a page, marks the current entry, and folds into the phone menu with the same entries;
- axe on a section in each view, in both modes;
- every site E2E test that visited `/classic/…` visits a real page instead.

### S3: edit mode for the site (U5)

1. **Pages:** the screen's name, and Gallery among the kinds.
2. **Sections:** a section's form gains View and "In the navigation"; New section asks for the view and the navigation.
3. **Navigation** (`/_edit/navigation/`):
   - the preview;
   - the entries, with move, remove and their labels;
   - add a section, a page or a link.

   It writes through `PUT structure`.
4. **The editor's model:** pure menu operations in `model/structure.ts`: add, remove, move, relabel, and "is this node in the navigation". A move relocates the node (V21).
5. **Taking a page off the site** removes its menu entry in the same write, and the screen says so.

**Tests:**
- unit: the menu operations, and a move keeping the node;
- E2E "editor":
  - show and hide a section, from Sections and from Navigation;
  - add a link and reorder it;
  - the site's header follows;
  - moving a page in the navigation keeps its entry;
  - axe on the new screen in both modes.

### S4: the planet structure (U8 to U11)

1. **The world in code:** `src/game/world/places.ts` holds the seven places' world, from the landmark frontmatter. `tests/unit/fixtures.ts` reads it rather than mirroring it.
2. **The contract:**
   - `planetStructure` in `schema.ts`, with the seven IDs as an enum;
   - the loader's checks V13 to V16;
   - the repository's `getPlanet()`, `placeOf(page)` and `placePages(place)` (published, in order).
3. **The content:** `content/structures/planet.json`, with the seven places' words from S1, and the Lighthouse holding the first story.
4. **`/play`** builds its data from both:
   - the world, plus each place's words, its published pages (ID and title) and its site link;
   - `LandmarkData` loses `dialog` and gains `pages` and `siteHref`;
   - the landmark collection and its config go.
5. **The card:** "Classic page" becomes "Open classic page", to `siteHref`.
6. **The dialog, until S5:** the place's words and its published pages, each a link to its site page. It's the list, before the frame exists.
7. **Prabin's pointers:** a unit test that every building his lines name holds a published page.
8. **`exploreHref`** uses the places: a page's building, or a section's building.
9. **The page service** (`src/site/editor/server/pages.ts`): one transaction over the article and both structures ([spec §7.6](spec.md#76-one-transaction-for-a-pages-places)). Saving, unplacing and deleting a page go through it, so V13 can't be broken from the site's side once it's enforced.
10. **The budget:** `verify:prod`. The main bundle changes only by what `LandmarkData` carries.

**Tests:**
- unit:
  - the planet contract and V13 to V16;
  - the game's IDs against the contract's;
  - the data `/play` builds;
  - the page service's transaction and its refusals;
- E2E "planet": the card and the dialog show the place's words and pages;
- the layout, pads and grass tests still pass on the new world module;
- `verify:prod`.

### S5: reading on the planet (U13 to U15)

1. **The routes:** `src/pages/play/[place]/index.astro` and `src/pages/play/[place]/[page].astro`, built from the planet structure and rendered by `Page.astro` with the planet frame.
2. **The design system:**
   - `PageShell` takes `frame` (`site` or `planet`): a planet frame's page is transparent, with the scrim and smoke behind the content, and `noindex` with a canonical link;
   - `PlaceBar`, a new compound: the building's name, "Show contents", "Open classic page" and Close (showing Space);
   - `ArticleLayout` and `IndexLayout` take `frame`: the place bar replaces the header, the footer and the breadcrumbs;
   - each with its story.
3. **The frame's script** (`src/site/scripts/planetFrame.ts`):
   - moves within the building with `location.replace`;
   - sorts the links (this building, another building, the site only, elsewhere) and shows the "walk there" note;
   - Space and Esc post `planet:close`, unless the lightbox, a field or a key's default takes them first;
   - each load posts `planet:ready`;
   - opened on its own, it redirects into the game's deep link, through the base path.

   The rules are pure (`frameLinks.ts`), so they're unit-tested.
4. **The game:**
   - `ui/Dialogs.tsx` becomes the reading overlay: a modal `dialog` with the `iframe`, the messages (origin and source checked), the scheme, focus in and out, the loading status, and the failure card;
   - `parsePlayUrl` and `buildPlaySearch` gain `page`;
   - the controller opens a building at a page, and keeps the address and its history marker (`{ gameOpen, page }`) current;
   - "Classic site" and "Open classic page" follow the page being read;
   - the card prefetches its building's list.
5. **The size report** counts the frame's scripts as the site's.
6. **The docs:** the game UI design system gets the reading overlay (§6.7 keys, the smoke, the frame).
7. **The budget:** `verify:prod`.

**Tests:**
- unit:
  - the URL's `page`;
  - the link sorting;
  - the message validation (a message from elsewhere, or of an unknown type, is ignored);
- E2E "planet":
  - E opens the building's list over the planet;
  - a page opens in the frame; Next and Previous stay in the building; Show contents returns;
  - a link to another building shows its note and doesn't navigate;
  - Space closes the overlay and focus returns, and Space closes the lightbox first;
  - Back after a move closes the overlay; Forward reopens the same page; Close after a move, then Back, behaves;
  - `?page=` opens that page, and a wrong or draft `page` opens the list with a notice;
  - a cold deep link without prefetch opens;
  - a frame that fails shows the failure card;
  - the site's "Explore in 3D" arrives with the page open;
  - the frame is dark in dark mode (the scrim's colour sampled);
  - axe in the frame in both modes;
  - the phone layout keeps 44 px controls;
- a production build at `BASE_PATH=/atiya`: the redirects, the frame's links and the deep links keep the base;
- `verify:prod`, and "capability gate".

### S6: edit mode for the planet (U12)

1. **Planet** (`/_edit/planet/`):
   - the seven buildings' words, view and site link;
   - their pages, with move, "Take off the planet" and "Add page";
   - pages not on the planet, with "Put in…".

   It writes through `PUT planet`, via the page service where a page's places change.
2. **A page's settings:** "On the planet" in the Page tab, saved with the page through the page service.
3. **The Publish screen** names `structures/planet.json` "The planet".
4. **The model:** pure operations for the planet in `model/planet.ts`.

**Tests:**
- unit: the planet operations;
- E2E "editor":
  - map a page to a building, reorder it, take it off;
  - the inspector's "On the planet";
  - taking a mapped page off the site is refused with the reason;
  - deleting a mapped draft takes it off the planet;
  - axe in both modes.

## 2. Definition of Done

Each phase is done when every row for it is true and evidenced. **All rows were met on 30 September 2026**; the evidence is the test or check named, and what each phase built is in the [spec's "As built"](spec.md#11-as-built).

| # | Phase | Criterion | Evidence |
|---|---|---|---|
| 1 | S1 | No visitor-facing copy says "placeholder", "lorem", "TBD", "TODO", "FIXME" or "POC" | `copy.test.ts` |
| 2 | S1 | Every landmark and every line about the work says what's there and what's coming, and invents nothing | The S1 diff (commit "Copy: the site is under construction"); Prabin's pointers test in `landmarks.test.ts` |
| 3 | S2 | The site is home, sections and pages, and nothing else is accepted | `content.test.ts`: "is three levels…", "a section keeps its view…" |
| 4 | S2 | A section lists its pages as a list, tiles or a bento box, and shows an empty state when empty | E2E "content": "each section lists its pages in its view…"; screenshots of bento, the empty state and the row variant |
| 5 | S2 | Article, Page and Gallery open as the spec says | `content.test.ts`: "a page opens as its kind reads"; `opening.ts` |
| 6 | S2 | The header and phone menu show `menus.primary`, with the current entry, on every page of the site; `classic.ts` is gone | E2E "content": "the navigation is the site structure's…"; E2E "site on a phone" |
| 7 | S2 | The home page lists the sections, and `/classic/…` redirects, at the root and at `/atiya` | E2E "landing & classic"; a `BASE_PATH=/atiya` build (`/atiya/work/`, `/atiya/#sections`) |
| 8 | S3 | Sections, their views and the navigation (sections, pages and links) are set in edit mode, the site follows, and no operation loses the navigation | E2E "editor": "navigation: a section in and out…"; `editorModel.test.ts`: "keeps the navigation through every operation" |
| 9 | S4 | The planet's words and pages come from `content/structures/planet.json`; the buildings' world is code; V13 to V16 hold | `landmarks.test.ts`, `content.test.ts` "the planet structure"; `src/content/landmarks/` removed |
| 10 | S4 | A page's places on the site and the planet change in one transaction | `editorServer.test.ts`: "a page's building" |
| 11 | S5 | E on a building opens its list over the planet, from the site's own pages, with white smoke in light mode and black in dark | E2E "planet": "proximity preview…", "a link to another building… dark smoke"; screenshots in both modes |
| 12 | S5 | You can move through every page of a building, and never to another building's | E2E "planet": "reading on the planet…", "a link to another building…"; `frameLinks.test.ts` |
| 13 | S5 | Space closes the overlay (after a lightbox), focus returns, and Back, Forward and Close agree with the history | E2E "planet": "reading on the planet…", "preview-card Open returns focus…" |
| 14 | S5 | Deep links and the switches between the site and the planet keep the page | E2E "planet": "the site's Explore in 3D opens its page…", "context-preserving switch…" |
| 15 | S5 | The game's critical JS stays within 450 KB gz, and gated-out devices fetch no game chunk | `verify:prod`: 449.5 KB; E2E "capability gate" |
| 16 | S6 | Pages are mapped to buildings, reordered and taken off in edit mode, separately from the site; the rules refuse with reasons | E2E "editor": "planet: pages put in buildings…" |
| 17 | All | Every new screen and view passes axe in light and dark, and the design-system tests pass | E2E axe tests (site, editor, planet); `siteDesignSystem.test.ts` |
| 18 | All | The spec's "As built" and the related docs match the build: the content model, structures, edit mode, the game UI design system and AGENTS.md | The docs changes in each phase's commit |

## 3. Validation per phase

Following the tiers in [AGENTS.md](https://github.com/prabinpebam/atiya/blob/main/AGENTS.md):

| Phase | Runs |
|---|---|
| S1 | The copy guard and the unit tests the copy touches |
| S2 | Unit (content, navigation, design system, editor model), `astro check`, and the E2E groups "content", "landing & classic", "site design system" and "site on a phone"; plus the editor's "sections" test |
| S3 | Unit (editor model), and E2E "editor" |
| S4 | Unit (all: the world module is shared), E2E "planet" (the landmark tests), and `verify:prod` |
| S5 | Unit, E2E "planet" and "capability gate", `verify:prod`, and a build at `/atiya` |
| S6 | Unit (editor model), and E2E "editor" |
| End | The full `npm test`, `npm run check`, `npm run verify:prod`, and every E2E group this work touched |

## 4. Risks

| Risk | Mitigation |
|---|---|
| The game's critical JS has about 0.9 KB of headroom | The overlay lives in the lazy dialog chunk, and the main bundle gains only the URL's `page` and the context link. Measured in S4 and S5; if the margin runs out, making room comes first |
| A transparent iframe paints an opaque backdrop when its colour scheme differs from its parent's | The frame reports its scheme, and the iframe element's `color-scheme` follows it. An E2E test samples the scrim's colour in dark mode |
| Moves inside the iframe would add history entries, so Back wouldn't close the overlay | Moves use `location.replace` (D8), and the game keeps its history marker. The history cases are tested |
| Any structure operation could drop `menus` | Operations spread the structure. A regression test runs each one |
| Many E2E tests visit `/classic/…` | S2 moves them to real pages in the same change |
| Six empty sections look thin | Each says what's coming (S1's words), and the owner can hide any from the navigation (S3) |
| Moving the world out of the landmark files could shift a building | The world module holds the same numbers, and the layout tests read it |
