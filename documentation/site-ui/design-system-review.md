# Design systems: maturity review and next steps

A rating of the three design systems in this repository (the website's, the game UI's and edit mode's) against what the best production systems do, and the work that would close the gap. Each system is rated on how well it **defines** its rules (tokens, components, documentation) and how well it **applies** them (whether the code actually uses the library). The rules being rated are in [the site design system](design-system.md), [the game UI design system](../game-ui/design-system.md) and [the edit mode spec](../editor/spec.md). This follows [the first completed round of audit fixes](design-system-audit.md), whose 16 items are all closed, with the documented DS-16 size-limit deviation: this page starts from that state. The DS2 work below is a separate, planned follow-up, not part of the completed round.

> **TL;DR.** The DS2 round (19 October 2026) took every system to its acceptable level: the website from **8.7 to 9.1 out of 10**, edit mode from **7.2 to 8.7** and the game UI from **6.8 to 8.2**, with no aspect below 8. All 18 work items are closed, each held by a test, and `node scripts/design-system-audit.mjs --check` holds all 18 measures at their targets.
> - **Screenshots now catch what tests can't.** 1,732 baselines cover every story in light and dark at three widths, the key pages, edit mode's parts library and the game's gallery. Two runs in a row passed unchanged, and so did a comparison against the code before the round.
> - **Edit mode now applies the system.** It writes no controls of its own (6 new fundamentals). It has a kit tier and 2 new website compounds for its shared pieces, and every part has a story on its own dev-only library. Copied rule bodies fell from 62 to 9.
> - **The game UI is now a system.** Its styles sit beside their components, in cascade layers. It has a dev-only gallery, high-contrast support, logical properties only and hover that never sticks on touch, and every component token has an owner.
> - **The website got tighter.** Its recipes are written once (copied blocks fell from 46 to 20), every component is 500 lines or fewer, and the compounds that sit in columns use container queries.
> - **Governance:** generated token changelogs and a deprecation rule for tokens and props, both tested.
>
> The measurements from before the round are kept in §3, §5 and §7; [§10](#10-as-built) is what was built and how it was checked.

## 1. Method

- **Code measured:** `main` at commit `1401333` (19 October 2026), every count taken by script over the source. The first review measured `f029cc7` (11 October 2026); where a count's method changed, §7 says so rather than showing a trend.
- **Policy suites:**
  - `npx vitest run tests/unit/siteDesignSystem.test.ts tests/unit/designSystem.test.ts tests/unit/responsive.test.ts tests/unit/selectRules.test.ts`;
  - result: 297 passed, 0 failed (278 on 11 October).
- **Applying the rules,** measured on top of the policy suites (new in this review):
  - raw `<button>`, `<input>`, `<select>`, `<textarea>` and `<dialog>` elements in each tier's markup, outside its styles and scripts;
  - class names that 3 or more files each define for themselves;
  - identical declaration blocks (60 or more characters) copied into 2 or more files;
  - which fundamentals and compounds each tier imports.
- **Generated files** (all up to date):
  - `node scripts/build-site-tokens.mjs --check`;
  - `node scripts/build-tokens.mjs --check`;
  - `python scripts/build-site-fonts.py --check`.
- **Compared against:** what mature systems such as GitHub's Primer, Adobe's Spectrum and IBM's Carbon commonly do: tokens in a standard format, enforcement by lint or test, a component gallery, accessibility built in, screenshot tests per story, and a published change history.
- **Ratings** are a judgement out of 10 on that comparison, backed by the evidence in §3 and §5:
  - 9 to 10: leads the field;
  - 7 to 8: solid, with known gaps;
  - 5 to 6: the rules exist but aren't carried through;
  - below 5: missing.
- **Overall** is the plain mean of the aspects. This review adds one aspect, "Reuse in practice", and the 11 October overalls weren't a plain mean, so compare the aspects rather than the overalls (§2 says which aspects moved).
- **Not re-run:** the Playwright groups. This review reads code, and no rating depends on a browser result.

## 2. Ratings

![Grouped bar chart of the ratings out of 10 after the DS2 round. Every aspect of every system rates 8 or more: the website 8.5 to 9.5, edit mode 8.5 to 9 and the game UI 8 to 9.](assets/charts/design-system-ratings.svg)

Each cell is the rating before the DS2 round and after it (19 October 2026). The evidence for "before" is in §3 and §5; the evidence for "after" is below and in [§10](#10-as-built).

| Aspect | Website | Edit mode | Game UI | Evidence after the round |
|---|---|---|---|---|
| Token architecture | 9.5 → 9.5 | 8 → 9 | 8 → 8.5 | Every component token group names its owner in all three systems: edit mode's `c.editor` is split into groups each owned by one part, keeping a shared core (5 of 6 owned); the game's 24 groups each name a component, a class family or `shared`. Both are tested. |
| Token discipline (enforced) | 9.5 → 9.5 | 9 → 9 | 9 → 9 | Unchanged rules, now scanning every new stylesheet (the game's 35 component sheets, edit mode's kit and recipes). |
| Accessibility built into the system | 9.5 → 9.5 | 8.5 → 8.5 | 6 → 8 | Game: a `forced-colors` rule for every control family, `prefers-contrast: more` switching to new `-strong` roles (contrast-tested), every `:hover` inside `@media (hover: hover)` with an `:active` twin, and axe passing with forced colours emulated. Edit mode's new controls are fundamentals, with their `@a11y` notes and stories. |
| Component architecture | 8.5 → 9 | 5.5 → 8.5 | 6.5 → 8 | Website: every component at most 500 lines (Collection and SiteHeader were 643 and 646). Edit mode: an editor kit tier, parts at most 650 lines (the inspector, 1,206, is now a frame the page composes with four parts), and no part writes its own control. Game: styles beside their components, in cascade layers. |
| Reuse in practice | 8.5 → 9 | 5 → 8.5 | 8 → 8 | Website: copied declaration blocks fell from 46 to 20 (type tokens, `base.css` recipes, one picture type). Edit mode: 0 raw controls beyond 1 named exception (was 51), copied rule bodies from 62 to 9, and its repeated pieces are kit pieces or the new SplitView and ActionBar compounds. |
| Documentation | 9 → 9 | 6 → 8.5 | 6 → 8 | Edit mode: a comment on every prop and a story for all 59 parts and kit pieces, shown on a dev-only parts library (`/_edit/library/`). Game: all 22 exports and every primitive prop documented (tested), and a dev-only gallery (`/play/gallery/`) with every exported component (tested). |
| Responsiveness and right-to-left readiness | 9 → 9 | 8.5 → 8.5 | 4.5 → 8 | Website: Collection, StoryCard and Carousel are containers, switching at size tokens they own. Game: 0 physical properties (was 70) and text aligned to start or end, tested. |
| Quality checks | 7.5 → 9 | 7.5 → 9 | 7 → 8.5 | Screenshot tests: 1,732 baselines across the website's 65 stories and 5 key pages (light and dark, 360, 768, 1280), edit mode's 55 parts and kit pieces with stable stories (light and dark, 1024 and 1440, and 390 for the list screens) and the game's gallery (20 views, paper and wood, 3 widths). Stable over two runs in a row. |
| Governance | 7 → 8.5 | 6.5 → 8.5 | 6.5 → 8 | Generated token changelogs for both systems, a deprecation rule for tokens and props (one real token rename through it), the audit script with `--check`, and every new rule written in its system's page, the edit mode spec and AGENTS.md. |
| **Overall** | **8.7 → 9.1** | **7.2 → 8.7** | **6.8 → 8.2** | Each at or above its acceptable level (§8). |
## 3. By system

### Website

- **Defines:** the strongest of the three. There are four tiers (tokens, fundamentals, compounds, layouts), each made only from the tiers below it. Its 26 fundamentals are sealed (no `class` or `style` props). Every component documents itself (a summary, `@tier`, `@a11y`, a comment on every prop) and has a story; the design library (`/design/`) is generated from them.
- **Applies:**
  - Its pages carry no styles.
  - The 27 compounds import fundamentals rather than rewriting them (Heading and Text 11 times each, Image 9, Button 7).
  - Raw controls appear only where a component owns the pattern.
- **Weak spots:**
  - `SiteHeader.astro` has grown from 452 to 646 lines and `Collection.astro` from 620 to 643, both just under the 650-line limit.
  - A few small recipes are written in several components rather than once: the disabled state in 6 controls, the focus ring in 5, the picture's drop shadow in 5, and the field label's type in 4. The same picture-source prop type is declared in 4 compounds.
  - There are no container queries in the website's components (the 2 in the repository are edit mode's: the inspector and the insert forms) and no cascade layers.

### Edit mode

- **Defines:**
  - It shares the website's tokens, raw-value tests, hover rule, script setup and URL rules.
  - It adds one tier: parts made of fundamentals, compounds and tier 0, composed by pages that carry no styles.
  - A test holds the tier, each part's summary and that nothing outside edit mode imports it.
- **Applies, poorly:**
  - **Controls written by hand.** 10 parts write 40 `<button>` and 11 `<input>` elements, styled in the part. The inspector has 22 (its section navigation), and the canvas toolbar 10. Its own spec says it uses the website's Button, IconButton, TextField and the rest.
  - **A vocabulary no library holds.** The same pieces are rebuilt part by part:
    - an issue note (`.issue`) in 18 parts;
    - an action bar (`.actions`) in 17;
    - a form (`.form`) and a row (`.row`) in 10 each;
    - a list (`.list`) in 8;
    - a list-and-details layout (`.split`, with the same columns, overflow and empty state) in the Access, Recommendations and Sections screens.

    62 identical rule bodies are copied between parts, against 46 across the website's 53 components (mostly the small recipes above) and 4 within the game's stylesheets.
  - **Size.** `Inspector.astro` is 1,206 lines (730 without its styles) and `GrantDetails.astro` 705 (433). Both are over the limits the website holds its components to.
  - **Tokens.** Its 26 `c.editor` tokens are one group marked `shared`, so the ownership rule can't tell one part's sizes from another's.

### Game UI

- **Defines:**
  - The strictest token rules of the three. A CSS parser allows 4 raw values in all, sizes are in rem so "Larger text" scales everything, contrast is checked on both surfaces (paper and wood), and every wood role is defined.
  - Its 6 primitives (`Button`, `IconButton`, `KeyCap`, `Dialog`, `Panel`, `ScrollArea`) are enforced by a test.
- **Applies:**
  - Well where it's tested: no control is written outside the primitives, and only 4 rule bodies are repeated in its stylesheets.
  - Everything else is styled from global stylesheets: `hud.css` (953 lines) and `panels.css` (765), with 200 top-level rules between them, owned by no component and in no cascade layer.
- **Weak spots:**
  - No gallery or stories, so the panels are seen only by playing.
  - Its 23 component token groups have no owners.
  - No `forced-colors` or `prefers-contrast` rules.
  - 70 physical properties.
  - All 8 `:hover` rules apply on touch, although the game supports touch.
  - The documented components (17 of 22) are documented by habit, not by test.

## 4. What makes it world class

1. **The rules are tests, not guidance.** 297 checks across four suites cover tokens, tiers, sealing, docs and stories, copy, icons, fonts, scrollbars and each page's script setup. Most large systems hold much of this through lint rules and review; here a broken rule fails the build.
2. **It follows the token standard closely.** DTCG 2025.10 colour and dimension objects, a resolver with light and dark contexts and a contrast modifier, and generated CSS and docs with a `--check` that fails when they're stale.
3. **Contrast is calculated, not judged by eye.** Every text role on every surface, the focus ring, outlines, the duotone icons' second layer and text over pictures are checked in light, dark and more-contrast modes.
4. **The documentation can't go stale.** The design library (`/design/`) is generated from the components; a missing story, an undocumented prop or an unshown option fails a test.
5. **Separation is held by tests.** The website and the game never import each other, the game's tokens never reach the site, and edit mode never reaches a production build.

## 5. Gaps

Evidence as of 19 October 2026; G1 to G9 were found on 11 October, and G10 to G15 are new.

| ID | Gap | Evidence | Systems |
|---|---|---|---|
| G1 | No screenshot tests | 0 uses of `toHaveScreenshot` or `toMatchSnapshot` in `tests/e2e/`. A token or component change can shift the page without failing anything. | All |
| G2 | The game's styles are global | `src/styles/hud.css` is 953 lines (880 on 11 October) and `panels.css` 765, with 200 top-level rules between them. Styles aren't kept with the components that use them, and there are no cascade layers. | Game |
| G3 | The game has no gallery | Its 6 primitives (`Button`, `IconButton`, `KeyCap`, `Dialog`, `Panel`, `ScrollArea`) and its panels have no stories; they're seen only by playing. | Game |
| G4 | Edit mode has no size limit | The website's 650-line rule covers only the site's tiers. `Inspector.astro` is 1,206 lines (1,152 on 11 October), `GrantDetails.astro` 705, `SectionManager.astro` 556. | Edit mode |
| G5 | Website components at the limit | `SiteHeader.astro` is 646 of 650 lines (452 on 11 October) and `Collection.astro` 643 (620); `Carousel.astro` is 444. | Website |
| G6 | Game accessibility gaps | 0 `forced-colors` and 0 `prefers-contrast` queries in the game's styles; 70 physical properties against 15 logical ones (counting margin, padding and border sides and `top`, `right`, `bottom`, `left`). | Game |
| G7 | Layout follows the screen, not the space | No website component uses a container query; they respond to the screen width, so they adapt less well in a narrow column. No `@layer` anywhere. | Website |
| G8 | No change history | No changelog, versioning or deprecation rule for tokens or components. A renamed token or changed prop is found only when a test fails. | All |
| G9 | The game's bundle is nearly full | Its initial JS is 449.7 KB against a 450 KB budget (`npm run verify:prod`, 19 October), so each new game UI piece must load on demand or pay for itself. | Game |
| G10 | Edit mode writes its own controls | 40 `<button>` and 11 `<input>` elements in 10 parts, styled in each part: `Inspector.astro` 22 (its section navigation), `CanvasChrome.astro` 10 (the canvas toolbar), `ThemePanel.astro` 2 and 6. The game has a test that stops this; edit mode doesn't. | Edit mode |
| G11 | Edit mode's shared pieces aren't components | Class names that 3 or more parts each define: `.issue` (18), `.actions` (17), `.form` and `.row` (10), `.list` and `.group` (8). The list-and-details layout (`.split`) is built 3 times. 62 identical rule bodies are copied between parts. | Edit mode |
| G12 | Component tokens without owners | Edit mode's 26 `c.editor` tokens are one group marked `shared`; the game's 23 `c.*` groups name no owner and no test checks who reads them. | Edit mode, Game |
| G13 | The game's hover sticks on touch | All 8 `:hover` rules in the game's stylesheets apply outside `@media (hover: hover)`, although the game has a touch mode. The website's test for this doesn't cover the game. | Game |
| G14 | Small recipes written several times | The disabled state in 6 controls, the focus ring in 5, the picture's drop shadow in 5, the field label's type in 4, and one picture-source prop type declared in 4 compounds. | Website |
| G15 | The game's component docs are untested | 17 of the 22 exported game UI components carry a doc comment of their own (every file has one at the top), but no test requires it or a comment on each prop, as the website's does. | Game |

## 6. Work items

Six workstreams. WS1 can start at any time; WS2, WS3, WS5 and WS6 are independent of each other; WS4 is last, as it records what the others change. **If only two are done, do WS1 and WS5.** WS1 catches what no other test can (a visual regression in any of the three systems), and WS5 closes the largest gap between a system's rules and its code (edit mode's).

### WS1. Screenshot tests (G1)

- **DS2-01. Every story, in light and dark, at 3 widths.**
  - **What:** a Playwright project, `visual`, that opens each design-library story page and compares a screenshot of each `<Example>` with a committed baseline. Widths: 360, 768 and 1280 px. Animations off, fonts loaded, a fixed clock.
  - **Done when:** changing one colour token fails the run and names the examples it changed; an unchanged tree passes twice in a row.
- **DS2-02. The website's key pages.**
  - **What:** the home page, a section in each view (list, tiles, bento), an article and the Sign in page, at the same widths and in both modes.
  - **Done when:** the same as DS2-01, and the run takes under 5 minutes on a quiet machine.
- **DS2-03. Updating baselines on purpose.**
  - **What:** `npm run visual:update` rewrites the baselines and lists what changed, and the AGENTS.md validation table gains a "visual" row.
  - **Done when:** a baseline changes only through that command; review shows the before and after images.

### WS2. The game UI as a system (G2, G3, G6, G9)

- **DS2-04. Styles beside their components, in layers.**
  - **What:** split `hud.css` and `panels.css` into one stylesheet per component (the hotbar, the prompt, the preview card, the panels, the menu), imported by that component, inside `@layer tokens, base, components`.
  - **Done when:** a test fails on a top-level selector in a shared stylesheet that no component owns. The game's initial bundle stays at or under its budget, and the game's E2E groups pass.
  - **Status (19 October 2026):** done. `hud.css`, `panels.css` and `components.css` became 35 stylesheets in `src/game/ui/styles/`, each imported by the component that writes its classes (Astro hoists them into the page's CSS, so they cost the game's JS nothing), in the layers `tokens, base, primitives, components, cursors` ([game design system](../game-ui/design-system.md) §4); the look is unchanged (its "As built"). Held by `tests/unit/designSystem.test.ts` ("styles beside their components, in layers (DS2-04)"): a rule no importer writes, a rule outside a layer, a component's class in `base.css` or a new shared stylesheet fails. The audit's measure is now game rules outside a layer (any depth, every game stylesheet) and shared stylesheets beyond `base.css`.
- **DS2-05. A gallery for the game's primitives and panels.**
  - **What:** a design-library section that renders the primitives and the wood panels with sample data, outside the game's bundle.
  - **Done when:** a test fails on a primitive without a story, as on the website.
  - **Status (19 October 2026):** done, as its own page (§9): `/play/gallery/` in development and test builds only (`integrations/game-gallery.mjs`; `verify:prod` fails if it reaches `dist/`), drawing the real components from sample data on paper and wood ([game design system](../game-ui/design-system.md) §9.1). Held by `tests/unit/designSystem.test.ts` ("the gallery (DS2-05)": every primitive and exported game UI component is drawn); screenshots in `tests/e2e/visual-game.spec.ts`, baselines still to make.
- **DS2-06. Game accessibility.**
  - **What:** `forced-colors` and `prefers-contrast: more` rules for the HUD and panels, and logical properties in place of physical ones.
  - **Done when:** the game's design-system test fails on a physical property or a missing high-contrast rule for a focusable control; the game passes axe in Windows high-contrast emulation.

### WS3. Component size and adaptability (G4, G5, G7)

- **DS2-07. The size limit for edit mode.**
  - **What:** apply the 350/650-line rule to `src/site/editor/components/`, splitting `Inspector.astro`, `GrantDetails.astro` and anything else over the limit; logic beyond wiring goes in `src/site/editor/model/`.
  - **Done when:** the size test covers edit mode's parts and passes; the editor E2E project passes.
- **DS2-08. Room under the limit, and container queries.**
  - **What:** bring `Collection.astro` and `SiteHeader.astro` under 500 lines each, and move the compounds that sit in columns (cards, collections, the carousel) to container queries with tokens for their sizes.
  - **Done when:** a test fails on a compound in a column that sizes itself by the screen width rather than its container; the "site on a phone" group passes.

### WS4. Change history (G8)

- **DS2-09. A generated changelog for tokens.**
  - **What:** `build-site-tokens.mjs` and `build-tokens.mjs` write the tokens added, removed, renamed and changed in value to a changelog page in the docs, compared with the last commit on `main`.
  - **Done when:** a token change without a changelog entry fails the `--check`.
  - **Status (19 October 2026):** done. Each build compares the tokens with the last set it built (a generated `token-history.json` beside each `tokens.json`, rather than the last commit on `main`, so it works offline and in a person's own build) and writes [the site's](token-changelog.md) and [the game's](../game-ui/token-changelog.md) changelog, starting from a baseline of that day's tokens. Held by `tests/unit/tokenChangelog.test.ts` ("token changelogs: generated, and current", "token changelogs: the rules").
- **DS2-10. A deprecation rule.**
  - **What:** a renamed or removed token or prop keeps an alias marked deprecated for one release, with a test that fails on any use of a deprecated name in the source; the rule is added to both design-system pages and AGENTS.md.
  - **Done when:** one real rename has gone through it end to end.
  - **Status (19 October 2026):** done for tokens (DTCG `$deprecated`; [site §2](design-system.md#2-tokens-tier-0), [game §3](../game-ui/design-system.md#3-tokens)). The first rename: the game's `--c-chopper-thumb-w` and `-h` became `--c-chopper-thumb-width` and `-height`, the old names kept as deprecated aliases with no reader. Held by `tests/unit/tokenChangelog.test.ts` ("deprecation (DTCG $deprecated): built, marked, never read"). Component props: a JSDoc `@deprecated` tag in `interface Props` ([site §4](design-system.md#4-writing-a-component)), shown by the library's props table, and never passed by an `.astro` file; no real prop needed deprecating, so it's proved on fixtures, held by `tests/unit/deprecation.test.ts`. Not yet: the rule in AGENTS.md.

### WS5. Edit mode on the design system (G10, G11, G12)

- **DS2-11. Controls only through fundamentals.**
  - **What:** replace the raw buttons and inputs in edit mode's parts with `Button`, `IconButton`, `TextField`, `Checkbox` and the rest. Where none fits, add the missing fundamental to the website's system, with its story: a toggle button for the inspector's section navigation, a toolbar button for the canvas.
  - **Done when:** a test fails on a `<button>`, `<input>`, `<select>`, `<textarea>` or `<dialog>` in a part, as the game's test does for its primitives (any exception named with its reason); the editor E2E project passes.
- **DS2-12. Edit mode's shared pieces as components.**
  - **What:** make the repeated pieces components: the list-and-details layout (Access, Recommendations, Sections), the issue note, the action bar, the form and the list row. Each goes to the website's compounds if the site could use it, else to an editor kit tier the parts may import. The part-import test gains that tier.
  - **Done when:** no class name is defined in 3 or more parts, and fewer than 10 identical rule bodies are copied between parts (62 now), both checked by a test.
  - **Status (19 October 2026):** done. Two website compounds, SplitView (the list-and-details layout) and ActionBar (the action bar), with their stories; thirteen kit pieces (IssueNote, Form, FormFoot, Fieldset, RichField, StatusNote, Panel, PanelGrid, ListPane, ListLink, PlainList, Grip, ChoiceTiles); and the recipes no component can hold in `src/site/styles/editor-recipes.css` (the busy line, the drop line, a rich field's paragraphs), keyed by data attributes ([edit mode spec §10](../editor/spec.md#10-the-design-system-in-the-editor)). No vocabulary class is defined in 3 or more parts and kit pieces (it was `.issue` 19, `.actions` 17, `.row` 13, `.form` 12, `.list` 8, `.split` 3), and 9 identical rule bodies are copied between them (56 at the start of the work). Held by `tests/unit/editorDesignSystem.test.ts` ("edit mode: its shared pieces built once (DS2-12)", and "its recipes written once"); the measure is `scripts/lib/cssCopies.mjs`, shared with the audit script.
- **DS2-13. Parts documented like components.**
  - **What:** a comment on every prop, and a story per part in a development-only "Edit mode" section of the design library, with the same test that every option of a prop is shown.
  - **Done when:** the website's documentation test covers edit mode's parts and passes.
  - **Status (19 October 2026):** done. Every part and kit piece (59) has a comment on every prop and a story in `src/site/editor/stories/`, with made-up sample data (`samples.ts`), showing every option of its union props. They're shown on a development-only screen of edit mode's own, the parts library (`/_edit/library/`, a page per piece built like the design library's), rather than in the design library, which ships. Held by `tests/unit/editorDesignSystem.test.ts` ("edit mode: its parts and kit documented like components (DS2-13)": the website's documentation test run on each piece, no story without a piece, the stories' imports, and nothing outside edit mode importing them).
- **DS2-14. Edit mode's tokens owned.**
  - **What:** split `c.editor` into groups owned by the parts that read them (the inspector's widths, the crop's handles, the pattern's cells), keeping only common values `shared`.
  - **Done when:** the ownership test fails when a part reads another part's group.

### WS6. Rules carried through (G12, G13, G14, G15)

- **DS2-15. Hover only where it can hover, in the game.**
  - **What:** put the game's 8 `:hover` rules inside `@media (hover: hover)`, each with an `:active` twin, as the website does.
  - **Done when:** the game's design-system test fails on a `:hover` outside that query; the "touch" group passes.
- **DS2-16. Owners for the game's component tokens.**
  - **What:** each `c.*` group in `src/design/tokens.json` names the component that reads it, or says it's shared.
  - **Done when:** a test fails when a stylesheet section or component reads a group it doesn't own.
- **DS2-17. The game's components document themselves.**
  - **What:** a doc comment on every exported component in `src/game/ui/` and the chunks' UI files, and a comment on every prop of the primitives and containers.
  - **Done when:** a test fails on an exported game UI component without one; it can share its parser with DS2-05's gallery test.
- **DS2-18. The website's recipes written once.**
  - **What:** turn the repeated recipes into tokens or tier 0: the field label's type as one composite typography token, the disabled state and the focus ring as shared component tokens, and the picture-source prop type as one type in `src/site/design/`.
  - **Done when:** fewer than 25 identical rule bodies are copied across the website's components (46 now), checked by a test.

## 7. Measures

`node scripts/design-system-audit.mjs` re-takes these (`--check` fails if one misses its target). Where the 19 October "before" count used a different method from the 11 October one, the note says so.

| Measure | 11 October 2026 | 19 October, before | 19 October, after | Target | Item |
|---|---|---|---|---|---|
| Stories under a screenshot test | 0 of 55 | 0 of 57 | 65 of 65, plus 5 key pages, 55 edit mode parts and 20 game views (1,732 baselines) | All, light and dark, 3 widths | DS2-01 to 03 |
| Game rules outside a cascade layer / shared stylesheets beyond `base.css` | About 197 top-level rules | 274 | 0 / 0 | 0 / 0 | DS2-04 |
| Game primitives in the gallery | 0 of 6 | 0 of 6 | 6 of 6 (and every exported component) | All | DS2-05 |
| Game `forced-colors` and `prefers-contrast` rules | 0 and 0 | 0 and 0 | 20 and 1 | Every focusable control | DS2-06 |
| Game physical properties | 28 | 70 (a wider count: border sides and `top`, `right`, `bottom`, `left` included) | 0 (86 logical) | 0 | DS2-06 |
| Edit mode parts over the size limit | 2 (1,152 and 704) | 2 (1,206 and 705) | 0 | 0 | DS2-07 |
| `Collection.astro` and `SiteHeader.astro` | 620 and 452 lines | 643 and 646 lines | 500 and 499 | 500 or fewer each | DS2-08 |
| Website compounds using container queries | 2 uses (both edit mode's) | 0 | Carousel, Collection, StoryCard | Every compound placed in a column | DS2-08 |
| Token changelogs | None | None | Both systems, generated | Both | DS2-09 |
| Game initial JS | 449.6 KB of 450 KB | 449.7 KB of 450 KB | 449.7 KB of 450 KB | At or under 450 KB | DS2-04 |
| Raw controls in edit mode's parts | Not measured | 51 (40 buttons, 11 inputs) in 10 parts | 0 beyond 1 named exception (the focus point's target) | 0, or each named with its reason | DS2-11 |
| Identical rule bodies copied between edit mode's parts | Not measured | 62 | 9 | Fewer than 10 | DS2-12 |
| Edit mode vocabulary classes in 3 or more parts | Not measured | 6 (`.issue` in 19 parts) | 0 | 0 | DS2-12 |
| Edit mode parts and kit pieces with a story | Not measured | 0 of 34 | 59 of 59 | All | DS2-13 |
| Edit mode token groups owned by a part | Not measured | 0 of 1 | 5 of 6 (one shared core) | All but one shared group | DS2-14 |
| Game `:hover` rules outside `@media (hover: hover)` | Not measured | 8 of 8 | 0 | 0 | DS2-15 |
| Game component token groups with an owner | Not measured | 0 of 23 | 24 of 24 | All | DS2-16 |
| Exported game UI components with a doc comment | Not measured | 17 of 22 | 22 of 22 | All | DS2-17 |
| Identical rule bodies copied across the website's components | Not measured | 46 | 20 | Fewer than 25 | DS2-18 |

## 8. Definition of Done

**The acceptable level:** the website at **9.0 or more** overall, edit mode at **8.5 or more**, the game UI at **8.0 or more**, and **no aspect below 7.5** in any system. A score moves only when its evidence is in the code and held by a test; the measures are re-taken by `node scripts/design-system-audit.mjs`, never by hand.

| Aspect | Website before, target | Edit mode before, target | Game UI before, target | Earned by |
|---|---|---|---|---|
| Token architecture | 9.5, 9.5 | 8, 9 | 8, 8.5 | Every component token group has an owner (DS2-14, DS2-16) |
| Token discipline | 9.5, 9.5 | 9, 9 | 9, 9 | Held as it is |
| Accessibility | 9.5, 9.5 | 8.5, 8.5 | 6, 8 | Game: high contrast and forced colours for the HUD and panels, hover only where it can hover (DS2-06, DS2-15) |
| Component architecture | 8.5, 9 | 5.5, 8.5 | 6.5, 8 | Website: room under the size limit (DS2-08). Edit mode: its parts under the limit, controls only through fundamentals (DS2-07, DS2-11). Game: styles beside their components, in layers (DS2-04) |
| Reuse in practice | 8.5, 9 | 5, 8.5 | 8, 8 | Website: recipes written once (DS2-18). Edit mode: no raw controls, its shared pieces as components (DS2-11, DS2-12) |
| Documentation | 9, 9 | 6, 8.5 | 6, 8 | Edit mode: parts documented and shown like components (DS2-13). Game: a gallery and documented components (DS2-05, DS2-17) |
| Responsiveness and right-to-left | 9, 9 | 8.5, 8.5 | 4.5, 8 | Website: container queries (DS2-08). Game: logical properties only (DS2-06) |
| Quality checks | 7.5, 9 | 7.5, 9 | 7, 8.5 | Screenshot tests of every story, the key pages, edit mode's parts and the game's gallery (DS2-01 to DS2-03) |
| Governance | 7, 8.5 | 6.5, 8.5 | 6.5, 8 | A token changelog and a deprecation rule (DS2-09, DS2-10); the audit script; each rule written in its system's page |
| **Overall** | **8.7, 9.1** | **7.2, 8.7** | **6.8, 8.2** | The targets above average 9.1 for the website (this table first said 9.2, a sum error) |

- [x] Every item in §6 is closed, each with the test named in its "Done when".
- [x] The measures in §7 are at their targets, re-measured by `node scripts/design-system-audit.mjs`.
- [x] The design-system unit suites, `npm run check` and `npm run verify:prod` pass; the `visual`, "site design system", "site on a phone", editor and game UI groups pass, apart from the 4 failures that predate the round (§10).
- [x] The ratings in §2 are re-scored with the new evidence, and every aspect is at its target above.
- [x] The site and game design-system pages, the edit mode spec (§10) and AGENTS.md describe the new rules, and this page gains an "As built" section.

## 9. Decisions

The open questions, decided on 19 October 2026 so the work could start:

- **Screenshot baselines are made and checked on Windows, locally.** No workflow runs the browser tests (CI runs the unit tests only), so there's no second platform to agree with; Playwright keeps a baseline per platform, so a Linux run later would make its own.
- **The game's gallery is its own page, never in production.** It exists only in development and `--mode test` builds (like the test hook), loads the game's tokens and styles, and the production check fails if it reaches `dist/`. The website's design library stays the website's.
- **High contrast covers the HUD and panels only.** The 3D view can't follow forced colours.
- **Edit mode's shared pieces go where they could be used.** A piece the website could use (the list-and-details layout, the action bar) becomes a website compound, with its story. A piece only edit mode needs (the issue note, the inspector's rows) goes in a new editor kit tier, `src/site/editor/kit/`, made of fundamentals, compounds and tier 0, which parts may import. The edit mode spec (§10) records the new tier.

## 10. As built

The DS2 round ran on 19 October 2026 as seven parallel threads, each owning its files and its tests, with a Definition of Done (§8) and the audit script as the scoreboard: governance (WS4), the game UI in two passes (WS6, then WS2), edit mode in two passes (WS3 and WS5), the website (WS3 and WS6) and the screenshot tests (WS1).

- **How the look was protected.** Before any change, every story, layout and key page was captured from a clean worktree of the last commit and checked stable on a second run. Each thread's refactor was then compared against that set. Two differences were sent back and fixed: the tablet layouts that container queries had changed, and a sub-pixel text shift. What remains is deliberate:
  - **New components** (the 6 fundamentals and 2 compounds).
  - **The 863 to 896 px band:** pages differ from before only there, where Collection and StoryCard switch at their own column width (49.5rem) rather than the screen's.
  - **StoryCard's thumbnails** sit 1 px lower in two examples, because of the inner layout box its container query needs.
  - **Small changes in edit mode:** issue notes share one type; the three managers' list rows share one padding; the new-collection dialog uses the inspector's sections.
  - **The game draws nothing differently.** Computed styles and screenshots matched in every state checked. The one difference is the preview card's row, which after a touch shows the game's own pointer.
- **The colour-token check (DS2-01).** Light mode's `accent` was moved one shade (indigo 700 to 600, #3A3C9E to #4448B0), the tokens rebuilt and four stories compared. Button, Checkbox and Text failed, naming every example the accent reaches; Tag, which doesn't use it, passed. Playwright's default per-pixel threshold (20% colour distance) had let the same change pass unseen, so the `visual` project compares at 2%, with anti-aliasing still told apart. Every comparison is soft, so a run lists every changed example, not just each story's first.
- **How the screenshots stay stable.** Getting a strict comparison to pass run after run took most of the work. What it needs:
  - **A fresh load for each mode and width:** the theme is set before the first paint, and the width before the page lays out.
  - **A page that has finished loading:** the theme switches show the theme, every stylesheet is in and every picture has loaded (none is left lazy). One run caught a stylesheet still arriving and drew bare HTML.
  - **Each example moved onto whole pixels,** because an example's place depends on everything above it.
  - **Pictures drawn as one flat colour,** keeping their box, corners, shadow and place. Otherwise the baselines would be 222 MB; they're 54 MB.
  - **The still state:** the project runs with reduced motion, so an entrance (the hero's words rise) never ends a fraction of a pixel off.
  - **Moving parts held still:** the overlay scrollbar's handles are hidden, the site's sticky header stays at the top, anything sticky inside an example stays in its flow, and edit mode's app shell flows as a page.
  - **Strict limits:** a pixel counts as changed at 2% colour distance. Examples allow 0.2% of their pixels to change and whole pages 1%. Every comparison is soft, so a run lists every changed example. One story, PlaceBar, allows 1.5% instead of 0.2%, with its reason in the spec: its layout measures the same on every load, but its title sits on a fractional pixel row and is drawn one of two ways between runs. The project allows one retry: a real change fails both tries, while a one-off sub-pixel shift of text (seen about once in 1,700 shots) passes the second and is reported as flaky.
- **New tests:**
  - `tests/unit/editorDesignSystem.test.ts`;
  - `tests/unit/tokenChangelog.test.ts`, `deprecation.test.ts`, `siteRecipes.test.ts` and `visualTests.test.ts`;
  - the DS2 groups in `siteDesignSystem.test.ts` and `designSystem.test.ts`;
  - `tests/e2e/visual.spec.ts`, `visual-editor.spec.ts` and `visual-game.spec.ts`;
  - a forced-colours axe test in `planet.spec.ts`.
- **What to know:**
  - `npm run visual` takes about 10 minutes, and `npm run visual:update` about 15.
  - The edit mode copy count is 9 of a limit under 10, so a new copied block fails the test.
  - The game's `/play` page loads 4 stylesheets instead of 1, and about 7 KB of its CSS is duplicated (first paint in dev imports some sheets twice).
  - `npx vitest related` doesn't run in this repository (a glob in `src/site/content/masters.ts` stops it), so threads ran the importing test files instead.
- **Validation:**
  - The whole unit suite passed: 1,756 tests.
  - `npm run check` found 0 errors.
  - `npm run verify:prod` met every budget, including game JS at 449.7 of 450 KB, and found no edit mode and no game gallery in the build.
  - The audit holds 18 of 18 measures.
  - The `visual` project passed twice in a row.
  - The full browser suite: every site and game test passed except one. The edit mode project passed 73 tests, with 3 failing and 15 not run after them. Those 4 failures are the same on the commit before the round (each project was run on a clean worktree of it), so none comes from this round:
    - the website's "each section lists its pages" counts every `main article.card`, which includes About's recommendation cards;
    - edit mode's optimistic move, Tests screen and sections tests pass alone but fail late in a full run.
  - After this round's fixes, the visual project passed twice more (145 of 145).
