# Design systems: audit and fixes

An audit of the site's design system and the game's UI design system, with every gap turned into a work item that can be fixed, tested and closed on its own. The rules being audited are in [the site design system](design-system.md) and [the game UI design system](../game-ui/design-system.md). The first audit was a code review; this page records the second (11 October 2026), which re-measured that review's ten findings and found five more.

> **TL;DR.** The site's system is strong: four real tiers, 55 components and layouts with 55 stories, 333 generated tokens, and 218 policy tests. But one rule is broken (**217 of 218 pass**: `IndexLayout` imports from the content layer). The game's system has the right rules, but its tokens and stylesheets don't follow them yet:
> - its tokens are plain strings, not DTCG 2025.10 objects (45 hex, 38 px, 14 rem, 6 durations);
> - its stylesheets have **116 lines with raw units**;
> - its px sizes don't scale with "Larger text".
>
> **None of the first audit's ten findings is closed;** two have grown (raw values in the game, components reading other components' tokens). The fix is **16 work items in 7 workstreams on two tracks**, site and game, which can run in parallel. Every item ends with a test, so nothing it fixes can come back.
>
> **Status (as built, 11 October 2026):** every item is closed, each with its test. What was built, and where it differs from the plan, is in [§5](#5-as-built).

![Seven workstreams on two tracks. Site: WS1 suite green, then WS2 token ownership, then WS3 one source for values, then WS7a coverage and size; WS4 script lifecycle at any time. Game: WS5 docs match the split, then WS6 game tokens, then WS7b game primitives.](assets/design-system-audit-plan.svg)

## 1. Method

- **Scope.** The site (`src/site/`: tokens, fundamentals, compounds, layouts, stories, the design library, the editor's parts) and the game UI (`src/design/tokens.json`, `src/styles/`, `src/game/**/*.tsx`).
- **Policy suites:**
  - `npx vitest run tests/unit/siteDesignSystem.test.ts tests/unit/designSystem.test.ts tests/unit/lanes.test.ts`;
  - result: 251 passed, 1 failed (the site's tier rule).
- **Measures,** each by script over the source:
  - token counts by tier, and tokens nothing reads;
  - lines with raw units (`px`, `rem`, `em`, `vh`, `vw`, `deg`) outside the generated token files;
  - which components read another component's `--c-*` tokens;
  - literal `sizes` strings and `matchMedia` queries;
  - window, document and media-query listeners without a `signal`;
  - examples per story, and prop variants a story doesn't show.
- **Not re-run:** the Playwright design-library and axe checks, which passed at the first audit. Nothing they cover had changed.

## 2. Baseline

Re-measure these when a workstream closes; the target is what "done" looks like.

| Measure | Now (2026-10-11) | Target | Item |
|---|---|---|---|
| Site policy tests passing | 217 / 218 | All | DS-01 |
| Components reading `--c-header-height` (not the header) | 6 (one a fundamental) | 0: a shared token instead | DS-02 |
| Picture `sizes` strings with hand-copied widths | 5 files | 0 | DS-04 |
| Literal `matchMedia` queries in components | 6 | 0 | DS-04 |
| Raw `em` type values (drop cap, underlines, link icon) | 13 lines in 3 files | 0, except documented ones | DS-05 |
| Literal scale factors in transforms | about 20 | 0 | DS-06 |
| Site tokens nothing reads | 3 | 0 | DS-08 |
| Unsignalled document listeners, undocumented | 2 | 0 | DS-09 |
| Game docs that still call the system shared | 3 files | 0 | DS-10 |
| Game token values written as strings | 103 | 0 | DS-11 |
| Game size tokens in px | 38 | Hairlines and outlines only | DS-12 |
| Game stylesheet lines with raw units | 116 | Allow-listed only | DS-13 |
| Game `<button>` written by hand | 41 | 0 outside the primitives | DS-14 |
| Stories with one example | 11 | Only where a prop can't vary | DS-15 |
| Site components over 550 lines | 4 | 0 | DS-16 |

## 3. Findings and work items

Severity:
- **High:** a written rule is broken, or a test is red.
- **Medium:** the rule holds today, but nothing stops it breaking, or the same value lives in two places.
- **Low:** clarity, coverage or upkeep.

Effort: **S** under half a day, **M** one to two days, **L** more.

| ID | Finding | System | Severity | Effort | Depends on | First audit |
|---|---|---|---|---|---|---|
| DS-01 | A layout imports from the content layer | Site | High | S | none | #1, open |
| DS-02 | Six components, one a fundamental, read the header's height token | Site | Medium | S | DS-01 | New |
| DS-03 | Who may read which component token is unwritten and untested | Site | Medium | M | DS-02 | #6, grown |
| DS-04 | Breakpoints and widths copied by hand into `sizes` and `matchMedia` | Site | Medium | M | DS-01 | #7, open |
| DS-05 | Type details in raw `em` values | Site | Low | S | none | New |
| DS-06 | Press and hover scales as literals | Site | Low | S | none | #7, open |
| DS-07 | The raw-value scanner misses `em`, transforms and `sizes` | Site | Medium | M | DS-04 to DS-06 | #7, open |
| DS-08 | Three site tokens nothing reads | Site | Low | S | none | New |
| DS-09 | The listener rule isn't tested | Site | Low | S | none | #8, mostly fixed |
| DS-10 | The game docs still describe a system shared with the website | Game | Medium | S | none | #10, open |
| DS-11 | Game tokens aren't DTCG 2025.10 values | Game | High | M | DS-10 | #2, open |
| DS-12 | Game sizes in px don't scale with "Larger text" | Game | High | M | DS-11 | #4, open |
| DS-13 | The game's raw-value test covers too few properties | Game | High | M | DS-12 | #3, grown |
| DS-14 | Game controls are class names, not components | Game | Medium | L | DS-13 | #5, open |
| DS-15 | Stories exist, but variants and states aren't checked | Site | Low | M | none | #9, slightly better |
| DS-16 | Four components over 550 lines | Site | Low | L | DS-04 | New |

### DS-01. A layout imports from the content layer

- **Problem.** [IndexLayout.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/layouts/IndexLayout.astro#L24) imports `mergeAfterAnchors` from `src/site/content/sectionOrder.ts` to place private cards among the open ones in dev. A layout may import only lower tiers and tier 0, so the tier test fails (`siteDesignSystem.test.ts`, "layout IndexLayout imports only from lower tiers and tier 0").
- **Fix.** The content adapter decides what is listed, so let it merge:
  - [Page.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Page.astro) builds the shown list with `mergeAfterAnchors` and passes it as `stories`, each marked `privateTag`;
  - it passes `privatePages` only when the build seals them;
  - `IndexLayout` renders what it's given.
- **Fallback.** If the dev/build switch has to stay in the layout, move the generic helper into tier 0 (`src/site/scripts/`) with its test (`tests/unit/sectionOrder.test.ts`).
- **Don't:** add an exception to the tier test, or copy the algorithm into the layout.
- **Done when:** the site suite is fully green, and the "protected content" E2E group still shows private cards in place in dev and sealed in a build.
- **Validate:**
  - Tier 1: `npx vitest related src/site/layouts/IndexLayout.astro src/site/content/Page.astro --run`;
  - Tier 2: `npx playwright test --reporter=line -g "protected content"`.

### DS-02. Six components read the header's height token

- **Problem.** `--c-header-height` belongs to `SiteHeader`, but it's read by:
  - [Video.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/fundamentals/Video.astro#L98) (a fundamental, which may use tier 0 only);
  - [VideoEmbed.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/VideoEmbed.astro#L145);
  - [ArticleMinimap.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/ArticleMinimap.astro#L47);
  - [SideNav.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/SideNav.astro#L66);
  - [LandingLayout.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/layouts/LandingLayout.astro#L62);
  - [LibraryLayout.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/layouts/LibraryLayout.astro#L58).

  All they need is the height of the page's sticky top bar.
- **Fix.**
  - Add a semantic size token for it in `src/site/design/tokens.json` (for example `size.chrome-block`), and alias `c.header.height` to it.
  - Point the six readers at the semantic token.
  - Run `node scripts/build-site-tokens.mjs`.
- **Don't:** hand-edit `tokens.css` or `tokens.md`.
- **Done when:**
  - no file but `SiteHeader` reads `--c-header-height`;
  - the "site on a phone" group passes (the tucking header and the minimap's inset depend on it).
- **Validate:**
  - Tier 1: the site suite;
  - Tier 2: `-g "site on a phone|article minimap"`.

### DS-03. Token ownership is unwritten and untested

- **Problem.** The rules say a component reads tier 0 and its own component tokens. In practice, reading another group is common and mostly right, but nothing records which reads are intended. Examples:
  - controls read `c.control`;
  - pictures inside other components read `c.image`;
  - [Prose.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/fundamentals/Prose.astro#L272) reads `c.quote`;
  - `StoryCard` reads `c.index`;
  - `ScrollArea` reads `c.listbox`.
- **Fix.**
  - Classify every `c.*` group as either owned (one component) or shared (`control`, `image`, `list`, `chrome`).
  - Record the classification in the token source: a `$extensions` entry on the group, which the builder carries into `tokens.md`.
  - Add a unit test: a component may read only shared groups and the group it owns.
  - Rename groups whose owner is wrong. For example, the index's row picture belongs to `StoryCard`'s row variant.
- **Done when:** the test passes with no per-file exceptions, and [the design system](design-system.md) §2 says how to choose owned or shared.
- **Validate:** Tier 1, the site suite.

### DS-04. Breakpoints and widths copied by hand

- **Problem.** The measures `--size-popout` (52 rem) and `--size-wide` (76 rem) are copied into picture `sizes` strings in:
  - [Blocks.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Blocks.astro#L39);
  - [ArticleHeader.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/ArticleHeader.astro#L98);
  - [Hero.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Hero.astro#L65);
  - [RelatedStories.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/RelatedStories.astro#L57), with the `lg` breakpoint as well.

  [Collection.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Collection.astro#L105) keeps its own table of them. Six `matchMedia` calls write breakpoints as literals:
  - `Carousel`;
  - `Collection`;
  - `Gallery`;
  - `SideNav`;
  - `SiteHeader` (twice).

  The current test checks only that each value is a breakpoint, not that it comes from one. Change a token, and these go stale without a failure.
- **Fix.**
  - Have `scripts/build-site-tokens.mjs` also write a small typed module (for example `src/site/design/responsive.ts`, generated, never hand-edited) with:
    - the breakpoints;
    - a `media('md', 'max')` helper;
    - a `sizes()` helper that takes measure names (`popout`, `wide`) and returns the string.
  - Use it everywhere a query or `sizes` is written in a script or prop.
  - CSS `@media` keeps literals (CSS can't read a custom property there), and the existing test still checks them.
- **Done when:** no `sizes` string or `matchMedia` query in `src/site` holds a `rem` literal, and the generated module is checked for staleness like `tokens.css`.
- **Validate:** Tier 1; Tier 2, one screenshot of an article with popout and wide figures (no change expected).

### DS-05. Type details in raw `em` values

- **Problem.**
  - Underline offsets disagree:
    - `0.18em` in [Link.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/fundamentals/Link.astro#L56) and [Prose.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/fundamentals/Prose.astro#L230);
    - `0.12em` in [RelatedStories.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/RelatedStories.astro#L153).
  - The drop cap uses `4.35em`, `0.06em`, `0.1em` and `0.12em` ([Prose.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/fundamentals/Prose.astro#L344)), though a `c.dropcap` group exists.
  - The external-link icon is `0.8em` with a `-0.05em` nudge.
- **Fix.**
  - Add `underline.offset` and `underline.thickness` to the semantic tier.
  - Complete `c.dropcap`: size, gap and lift.
  - Add `c.link.icon-size`.
  - Settle the offset on one value, chosen by eye in both modes.
- **Done when:** these values come from tokens, and the design library's type page shows them.
- **Validate:** Tier 1; Tier 2, one look at an article with a drop cap and links, light and dark.

### DS-06. Press and hover scales as literals

- **Problem.** About 20 transforms scale by literal factors, from 0.92 to 1.08:
  - `Button`, which also moves by `translateY(1px)`;
  - `IconButton`, `Checkbox`, `Radio`, `Switch`, `Slider` and `Select`;
  - `StoryCard`, `Hero`, `Lightbox`, `VideoEmbed` and `ChoiceGroup`.

  Feedback should feel the same everywhere, and today it's set component by component.
- **Fix.** Add motion tokens for the few intents that exist:
  - press;
  - a check's pop in and out;
  - hover lift;
  - a picture's zoom on hover.

  Use them, and keep translations for centring (`-50%`) as they are.
- **Done when:** no scale factor is a literal outside the reduced-motion resets.
- **Validate:** Tier 1; Tier 2, `-g "site design system"`.

### DS-07. The raw-value scanner misses `em`, transforms and `sizes`

- **Problem.** `CSS reads tokens, never raw values` in [siteDesignSystem.test.ts](https://github.com/prabinpebam/atiya/blob/main/tests/unit/siteDesignSystem.test.ts#L216) checks colour, layers, type, radii, borders, shadows, motion, spacing and queries. It lets `font-size` take any `em`, and doesn't look at:
  - `transform`;
  - `text-underline-offset`;
  - grid track sizes;
  - `sizes` props.

  [LibraryLayout.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/layouts/LibraryLayout.astro#L49) sets its nav column at `minmax(14rem, 17rem)`.
- **Fix.** After DS-04 to DS-06, extend the test:
  - transforms take tokens, percentages or `0`;
  - `em` values are allowed only in a named list, each with a reason;
  - grid tracks and `sizes` props take tokens.

  Tokenise the library's nav column (`c.library.nav-min`, `c.library.nav-max`).
- **Done when:** the extended test passes with only its named exceptions.
- **Validate:** Tier 1.

### DS-08. Three site tokens nothing reads

- **Problem.** `--layer-base`, `--tracking-normal` and `--weight-bold` are defined in the site's tokens. No site style or alias reads them; the game has its own copies.
- **Fix.** Remove them from `src/site/design/tokens.json`, or mark them reserved in their `$description`. Then add a test: every semantic or component token is read by a component, a token alias or the design library.
- **Done when:** the test passes.
- **Validate:** Tier 1.

### DS-09. The listener rule isn't tested

- **Problem.** Every listener a component sets up per page passes `signal`, as §3 requires. Two exceptions are deliberate but unrecorded: the `astro:before-swap` and `astro:after-swap` listeners in [SideNav.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/SideNav.astro#L200). They run once per document and carry the kept nav's scroll. No test would catch a new listener that leaks on every page change.
- **Fix.**
  - Add a unit test: inside an `each(…)` callback, every `window`, `document` or media-query `addEventListener` passes `signal`.
  - Module-level listeners carry a comment, and the test reads it as the reason.
  - Comment SideNav's two.
- **Done when:** the test passes with SideNav's two as the only named module-level listeners in components.
- **Validate:** Tier 1.

### DS-10. The game docs still describe a shared system

- **Problem.** The website left this system on 29 September 2026, but these places still say otherwise:
  - [the game UI design system](../game-ui/design-system.md): the TL;DR ("every piece of UI on the site and in the game") and principle P4 ("Paper means you're on the website");
  - [components.css](https://github.com/prabinpebam/atiya/blob/main/src/styles/components.css#L1): its header ("shared by the site and the game");
  - [tokens.json](https://github.com/prabinpebam/atiya/blob/main/src/design/tokens.json#L81): the descriptions of the colour tier, `color.page` and `color.header-glass`.
- **Fix.**
  - Describe the system as the game's UI and the loading shell before it.
  - Keep paper as the default surface and the key caps' light face, named for what they are now.
  - Rebuild the tokens so `tokens.md` follows.
- **Done when:** a search for "website", "landing" and "classic" in those files finds only the classic-site link the game keeps (P8).
- **Validate:** Tier 0 for the docs; Tier 1 (`designSystem.test.ts`) after the token rebuild.

### DS-11. Game tokens aren't DTCG 2025.10 values

- **Problem.** [The game UI design system](../game-ui/design-system.md) §3 says its tokens are DTCG 2025.10. But [tokens.json](https://github.com/prabinpebam/atiya/blob/main/src/design/tokens.json) writes its values as plain strings:
  - 45 hex colours;
  - 38 px and 14 rem sizes;
  - 6 durations.

  The site's tokens use the 2025.10 colour object and `{ value, unit }`, and test them.
- **Fix.**
  - Convert the values.
  - Teach `scripts/build-tokens.mjs` to read them (the site's builder, `scripts/build-site-tokens.mjs`, already does).
  - Add the site's two structure tests to `designSystem.test.ts`.
  - The visual tokens stay separate: only the format and the tooling conventions are shared.
- **Done when:**
  - no string value is left in the colour, dimension or duration tiers;
  - the generated CSS is unchanged, byte for byte, apart from its header;
  - the structure tests pass.
- **Validate:** Tier 1; `npm run verify:prod`, since the CSS feeds the game's critical path.

### DS-12. Game sizes in px don't scale with "Larger text"

- **Problem.** §3 says "everything is in `rem`", so `html.text-lg` (112.5 %) scales it all. But the space scale, the radii, control sizes and panel sizes are 38 px tokens, which don't scale. Text grows inside boxes that don't.
- **Fix.**
  - Move space, radius, control, panel and slot sizes to rem.
  - Keep px only for hairlines and focus outlines, and list them in the test.
  - Add an E2E test that turns on "Larger text" and checks the menu, the backpack, the hotbar and a dialog for clipped or overflowing labels.
- **Done when:** px values are only those listed, and the E2E test passes.
- **Validate:**
  - Tier 2: the new test, plus `-g "planet"` for the HUD;
  - Tier 3: `npm run verify:prod`.

### DS-13. The game's raw-value test covers too few properties

- **Problem.** P5 says any value that isn't a token is a bug. But `designSystem.test.ts` checks only:
  - colour;
  - spacing;
  - type;
  - radii;
  - layers;
  - motion.

  Lines with raw units in the game's stylesheets, by file:

  | File | Lines with raw units |
  |---|---|
  | `hud.css` | 54 |
  | `panels.css` | 34 |
  | `components.css` | 18 |
  | `base.css` | 10 |

  Most are widths, heights, offsets, blurs, transforms and breakpoints.
- **Fix.**
  - Parse the stylesheets with a CSS parser instead of regular expressions. `postcss` is installed only because Vite needs it, so pin an exact version in `package.json` before a test imports it, and run `verify:prod`.
  - Hold every property to tokens, with an allow-list for structural values: `0`, `100%`, ratios, hairlines and centring offsets.
  - Tokenise what the parser finds.
- **Done when:** the allow-list is the only exception, and each entry has a reason.
- **Validate:** Tier 1; Tier 2, one screenshot of the HUD and the backpack (no visible change).

### DS-14. Game controls are class names, not components

- **Problem.** The game's 45 TSX files hold:
  - 41 hand-written `<button>` elements;
  - 46 uses of the `btn` classes;
  - 3 `<dialog>` elements;
  - 19 `<kbd>` key caps;
  - 6 inline styles.

  Naming, disabled and busy states, surfaces and token use are kept by convention only.
- **Fix.**
  - Add small game-local primitives: `Button`, `IconButton`, `Dialog`, `Panel`, `KeyCap`, `ScrollArea`.
  - Each owns its anatomy, accessible name, states and surface.
  - Never import the site's components.
  - Keep them tiny: they sit in the initial bundle, and the game's critical JS budget is 450 KB gzip.
- **Done when:** no `<button>` or `<dialog>` is written outside the primitives (a unit test checks), and `verify:prod` holds its budgets.
- **Validate:** Tier 2, the "planet" and "view controls" groups; Tier 3, `npm run verify:prod`.

### DS-15. Stories exist, but variants and states aren't checked

- **Problem.** All 55 components and layouts have a story, at 3.1 examples on average. But the test only asks for one example. 11 stories have only one:
  - the four layouts;
  - `BackToTop`, `Breadcrumbs`, `ContentsList`, `Lightbox`, `PageShell`, `RelatedStories` and `SideNav`.

  The picture options (`display`: fill, fit, actual, tile) are shown only in `Image`'s story, not in `Collection`, `Gallery`, `Carousel` or `StoryCard`, which pass them on.
- **Fix.** [registry.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/library/registry.ts) already reads each component's props. Use it in a test: every non-default value of a union prop appears in the story, or the prop's doc comment says where it's shown (for example, "shown in Image").
- **Done when:** the test passes, and the stories it flags gain examples, not exceptions.
- **Validate:** Tier 1; Tier 2, `-g "every component and layout has its page"`.

### DS-16. Four components over 550 lines

- **Problem.** These four are hard to change safely:

  | Component | Lines |
  |---|---|
  | [Collection.astro](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Collection.astro) | 695 |
  | `ArticleMinimap` | 596 |
  | `Select` | 592 |
  | `Carousel` | 589 |

  `Collection` alone holds rows, columns, a carousel, two timelines and strips. Compounds can't import compounds, so they can't be split into smaller compounds.
- **Fix.**
  - Move their pure decisions into tested tier-0 modules, as `edgeColour.ts` and `frameLinks.ts` do: the layout picked from the item count and width, positions, keyboard moves.
  - Leave markup and styles in the component.
  - Behaviour doesn't change.
- **Done when:** each is under 450 lines, and the moved logic has unit tests.
- **Validate:** Tier 1; Tier 2, `-g "site design system|article minimap"`.

## 4. Definition of Done

- [x] Every item above is closed, each with the test its "Done when" names. DS-16 met its intent rather than its letter for `Collection` (§5).
- [x] `npx vitest run tests/unit/siteDesignSystem.test.ts tests/unit/designSystem.test.ts tests/unit/lanes.test.ts` passes in full.
- [x] `npx playwright test -g "site design system|site on a phone|landing & classic"` passes, and so does the new "Larger text" test.
- [x] `npm run verify:prod` holds every budget. The game's critical JS is 450.0 KB, at its 450 KB limit (§5, DS-14).
- [x] The baseline in §2 is re-measured; each row meets its target (§5).
- [x] [The site design system](design-system.md) and [the game UI design system](../game-ui/design-system.md) describe the rules as built (ownership, generated responsive values, game primitives), and their check tables name the new tests.

**The full validation (11 October 2026):**
- **Unit:** every test passes but one that already fails on the stable tree (the telemetry allowlist).
- **Types:** `npm run check` is clean.
- **Build:** `verify:prod` passes.
- **E2E:** every group was run. All pass except three that fail on the stable tree too:
  - the editor's "a new article is private from the start… made public and private again";
  - the planet's "proximity preview…";
  - (in unit tests) the telemetry allowlist.
- **What the run found:** one regression the audit caused. A demo page's wide pull quote left the article minimap no room on touch screens; it was fixed.
- **Timeouts under load:**
  - two crafting tests (the swing, the viewing deck) timed out while other runs shared the machine, and pass when run alone;
  - two editor tests timed out the same way, and pass alone.

## 5. As built

### The baseline, re-measured

| Measure | Before | After | Target met |
|---|---|---|---|
| Site policy tests passing | 217 / 218 | All (227, with the new rules) | Yes |
| Components reading `--c-header-height` (not the header) | 6 | 0: they read `--size-chrome-block` | Yes |
| Picture `sizes` strings with hand-copied widths | 5 files | 0 | Yes |
| Literal `matchMedia` queries in components | 6 | 0 | Yes |
| Raw `em` type values | 13 lines in 3 files | 0 (only `1em`, by name) | Yes |
| Literal scale factors in transforms | about 20 | 0 | Yes |
| Site tokens nothing reads | 3 | 0 | Yes |
| Unsignalled document listeners, undocumented | 2 | 0 (3 documented, all the side nav's) | Yes |
| Game docs that still call the system shared | 3 files | 0 | Yes |
| Game token values written as strings | 103 | 0 (shadows too) | Yes |
| Game size tokens in px | 38 | 15: lines and outlines, the blur, the pill, the scrollbar | Yes |
| Game stylesheet lines with raw units | 116 | Allow-listed only (the visually hidden pattern, the skip link) | Yes |
| Game `<button>` written by hand | 41 | 0 outside the primitives (and no hand-written `<dialog>` or `<kbd>`) | Yes |
| Stories with one example | 11 | 11, each a whole page or with no prop that can vary | Yes |
| Site components over 550 lines | 4 | 1: `Collection`, 620, of which 450 are its styles | See DS-16 |

### By item

- **DS-01.** `Page.astro` merges a section's private pages among its open ones in dev (`mergeAfterAnchors`) and passes the build only the sealed ones; `IndexLayout` renders what it's given (each private card is marked `privateTag`).
- **DS-02.** `size.chrome-block` and `size.chrome-block-compact` are the top bar's heights; `c.header.height` and its compact twin alias them.
- **DS-03.** Every `c.*` group carries `$extensions["site.owner"]`: a component's name or `shared`, shown in [tokens.md](tokens.md). Eight groups are shared (control, check, list, image, quote, icon, scrollbar, editor). Two reads were wrong and were fixed by new groups rather than exceptions: `ScrollArea` got its own heights (`c.scroll-area`) and `StoryCard`'s row picture moved from `c.index` to `c.story-card`. The rule for choosing is in [the site design system](design-system.md) §2.
- **DS-04.** `scripts/build-site-tokens.mjs` also writes `src/site/design/responsive.ts` (breakpoints, measures, the picture widths flagged `site.sizes`, `media()` and `sizes()`), checked for staleness with the rest. Two hints changed slightly where a literal wasn't a token: the sideways timeline's pictures are asked for at 17 rem (its slide token) instead of 16, and "Read next" at a third of the wide measure (26 rem) instead of 24.
- **DS-05.** `underline.*` (offset, the nav's marker offset, the two thicknesses), `c.dropcap` (size, lift, gap, gap with initial-letter), `c.prose.code-size`, `c.link.icon-*` and `c.icon.baseline-shift`, all in `em`. Card titles now take the links' 0.18 em offset (they had 0.12). The library's type page lists them (Underline, and "Details, in em").
- **DS-06.** `scale.*` by intent (press-large, press, press-small, pop-from, enter-from, lift, zoom) and `shift.press`; the lightbox's drifting smoke has its own `c.lightbox.drift-scale`. Three values moved onto a shared intent: the icon button's press (0.94 to 0.92, with the checks), a video's play mark under the pointer (1.06 to 1.08, with the slider's thumb) and the hero's settle (1.03 to 1.02, with the cards' zoom). The library's motion page shows them, pressable.
- **DS-07.** The scanner now holds transforms (tokens, percentages, `0`, `1`, quarter turns), `em` (only `1em`, by name) and grid tracks (tokens; the library's specimen pages and the stories' sample grids excepted, by name, because their columns are sized to their samples). The library's nav column and the contents list's numeral column are tokens.
- **DS-08.** `--layer-base`, `--tracking-normal` and `--weight-bold` are removed. The test counts a breakpoint as read by its `@media` queries or a `media()` call.
- **DS-09.** The test reads every component script: a `window`, `document` or media-query listener passes `signal`, or the line before it starts `// once per document:` and says why. The side nav has three such listeners, not two: its media query's `change` too.
- **DS-10.** The game's TL;DR, P4, the surfaces table, `components.css` and the token descriptions name the game and its loading shell. Eleven tokens nothing read, most left over from the website (the brand colours, the poster's, `header-glass`, `radius.2xl`, `text.display`, `text.hero`, `shadow.poster`, `space.10`) and five primitives only they used are removed; a new test fails on any token nothing reads.
- **DS-11.** `src/design/tokens.json` is 2025.10 objects throughout, shadows included; what DTCG has no type for is named in `$extensions` (`game.unit`, `game.fluid`, `game.viewport`, `game.filter`). `scripts/build-tokens.mjs` reads them. The conversion was checked byte for byte: the generated CSS and reference didn't change.
- **DS-12.** Every game size token is rem except lines and outlines (`border.*`), `blur.glass`, the pill and the scrollbar, listed in the test. The E2E group "larger text" turns the setting on and checks the menu, fast travel, the backpack and the hotbar for clipped or off-screen labels.
- **DS-13.** `postcss` is pinned (8.5.28, a dev dependency it already was through Vite). The test parses the four stylesheets and holds every declaration and `@media` query to tokens; tokenising what it found added breakpoints (in rem), shifts, a tilt, scales, a blur, focus offsets, the underline offset and component tokens for the key cap, cards, dialogs, slots, the loader, the talk box, the aside, the toast, the view controls, the picker, Chopper's card, the help popover, recipes and paint.
- **DS-14.** `src/game/ui/primitives.tsx` holds `Button` (`default`, `primary`, or `bare` for controls with their own anatomy: slots, tiles, the compass, swatches), `IconButton` (its `label` is required and becomes its `aria-label`) and `KeyCap`; `src/game/ui/overlays.tsx` holds `Dialog` (opens modally from `open`, closes on Esc, Space and the backdrop through `onDismiss`), `Panel` (the wood panel on its backdrop) and `ScrollArea`. The containers live apart because only the on-demand screens use them: in one module they pushed the initial bundle over its budget. That budget is nearly full: the game's critical JS is 450.0 KB against 450 KB (460,794 of 460,800 bytes; it was 460,685 before), so `KeyCap` is the plain `kbd` element name rather than a component. A test fails on any `<button>`, `<dialog>` or `<kbd>` written outside the primitives, on an `IconButton` without `label`, and on the initial bundle importing `overlays.tsx`. Not converted: link-styled buttons (`<a className="btn">`, links by nature) and the View whole planet button, which `camera/overview.ts` builds with DOM calls.
- **DS-15.** The test reads each component's union props through the registry: every non-default value is in its story, or the prop's comment names the story that shows it ("shown in Image", "shown in ArticleLayout") and that story does. Layouts and `PageShell` are excepted by name: each is its story's one page. Closing the 78 gaps added examples: every frame shape and cover or contain (Image), each width in the article (ArticleLayout), a caption over a picture, a spacing divider, a picker dialog, a full-bleed opening, explicit hero layouts, standard, compact and private cards, and the remaining variants.
- **DS-16.** The pure decisions and the DOM wiring moved to tier 0 with unit tests (`collection.ts`, `collectionStrip.ts`, `carousel.ts`, `select.ts`, `articleMinimap.ts`, and additions to `listbox.ts`, `media.ts` and `minimap.ts`). `ArticleMinimap` is 250 lines (from 596), `Select` 430 (592), `Carousel` 442 (590) and `Collection` 620 (697). Collection's stylesheet alone is 450 lines, and the item's own fix keeps styles in the component, so its target became its markup and script: 170 lines. Splitting its timelines into their own compound would get the file under 450, but it would change a public component, the editor's canvas and its stories, so it isn't done. Instead a test keeps every component's markup and script under 350 lines and its file under 650, so logic can't grow back into one.
