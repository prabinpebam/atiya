# Design systems: maturity review and next steps

A rating of the three design systems in this repository (the website's, the game UI's and edit mode's) against what the best production systems do, and the work that would close the gap. Each system is rated on how well it **defines** its rules (tokens, components, documentation) and how well it **applies** them (whether the code actually uses the library). The rules being rated are in [the site design system](design-system.md), [the game UI design system](../game-ui/design-system.md) and [the edit mode spec](../editor/spec.md). This follows [the first completed round of audit fixes](design-system-audit.md), whose 16 items are all closed, with the documented DS-16 size-limit deviation: this page starts from that state. The DS2 work below is a separate, planned follow-up, not part of the completed round.

> **TL;DR.** Re-measured on 19 October 2026: the website's system rates **about 8.7 out of 10**, edit mode's **about 7.2** and the game UI's **about 6.8**. Nothing the 11 October review planned has been done yet, and the largest files have grown: the inspector to 1,206 lines, the website's header to 646 of its 650, and the game's `hud.css` to 953.
> - **The website defines and applies its rules best.** The rules are tests that fail the build (297 checks, all passing). Its tokens follow DTCG 2025.10 with theme and contrast contexts, contrast is calculated in every mode, and its design library builds itself from the code.
> - **Edit mode defines its rules well but doesn't apply them.** It shares the website's tokens and raw-value tests, but 10 of its 34 parts write their own controls (40 `<button>` and 11 `<input>` elements). It has its own set of rows, lists, issue notes, action bars and list-and-details layouts, rebuilt in up to 18 parts with no shared component, and 62 rule bodies are copied between parts.
> - **The game UI enforces the strictest tokens, but it's the least systematic.** Only 4 raw values are allowed, and its controls go through 6 enforced primitives. But its styles are global stylesheets (200 top-level rules), it has no gallery, no high-contrast support and no owners for its component tokens, and none of its hover rules account for touch.
> - **The largest gap shared by all three:** nothing compares screenshots, so a visual regression passes every test.
> - **The fix is 18 work items in 6 workstreams,** each closed by a test. Nothing here is scheduled.

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

![Grouped bar chart of the ratings out of 10. The website rates 8.5 to 9.5 on every aspect except quality checks (7.5) and governance (7). Edit mode matches it on token discipline but drops to 5.5 on component architecture, 5 on reuse and 6 on documentation. The game UI is strict on token discipline (9) and reuse (8) but weakest on responsiveness (4.5), accessibility (6) and documentation (6).](assets/charts/design-system-ratings.svg)

| Aspect | Website | Game UI | Edit mode | Why |
|---|---|---|---|---|
| Token architecture | 9.5 | 8 | 8 | DTCG 2025.10 with primitive, semantic and component tiers. The website has 359 base tokens and 37 colour roles in each theme, plus more-contrast overrides, resolved from one file; each of its 31 component groups names its owner. The game has 283 tokens, no theme contexts and 23 component groups with no owners. Edit mode's 26 sizes are one `c.editor` group marked `shared`, so no part owns its own (down from 8.5). |
| Token discipline (enforced) | 9.5 | 9 | 9 | A CSS parser fails on any raw size, colour, time, layer or scale factor. The game allows 4 raw values, each with its reason. Primitives are private, and a test fails on a token nothing reads. Edit mode is held by the website's tests. |
| Accessibility built into the system | 9.5 | 6 | 8.5 | Website: WCAG AA contrast in both modes, and AAA muted text in more-contrast mode; fluid type that still grows at 200% zoom; 44 px targets; hover that never sticks on touch; reduced motion; Windows high-contrast mode; axe in the site, protected-content, contact, planet and editor browser tests. Game: no high-contrast or more-contrast support, and all 8 of its `:hover` rules apply on touch, where they stick (down from 6.5). Edit mode's bespoke controls keep the global focus ring. |
| Component architecture | 8.5 | 6.5 | 5.5 | Website: strict tiers, fundamentals that can't be restyled, and a tested size limit (650 lines a file). The game's UI is 6 enforced primitives over global stylesheets. Edit mode's parts have no size limit (the inspector is now 1,206 lines) and write their own controls (down from 6.5). |
| Reuse in practice (new) | 8.5 | 8 | 5 | Website: compounds and layouts write 4 raw buttons and 4 dialogs, each inside the component that owns that pattern (Dialog, Carousel, Lightbox, Tabs, the minimap). Game: a test allows no `<button>`, `<kbd>` or `<dialog>` outside its primitives. Edit mode: 40 raw buttons and 11 raw inputs across 10 parts, a repeated set of pieces in up to 18 parts, and 62 copied rule bodies. |
| Documentation | 9 | 6 | 6 | The website's library is built from doc comments, prop comments and stories (57 stories, 184 examples), and a test fails if a story skips a prop's option. The game documents 17 of its 22 exported components, but no test requires it, and it has no gallery. Edit mode's parts must carry a summary, `@tier` and `@a11y`, but not prop comments or stories, and the design library doesn't list them (down from 7). |
| Responsiveness and right-to-left readiness | 9 | 4.5 | 8.5 | The website and edit mode use logical properties throughout (436, against 1 physical) and breakpoint tokens only. The game has 70 physical properties against 15 logical ones. |
| Quality checks | 7.5 | 7 | 7.5 | Strong static checks, axe and browser tests, but no screenshot comparisons. |
| Governance | 7 | 6.5 | 6.5 | Written rules, two audits and a Definition of Done, but no changelog, versioning or deprecation path. Edit mode's spec (§10) says its screens are built from the website's components, but no test holds that, and the code has drifted (down from 7). |
| **Overall** | **8.7** | **6.8** | **7.2** | On 11 October: 8.8, 6.6 and 7.5. Those weren't a plain mean of their rows, so compare row by row instead. The website's rows haven't changed. The game lost half a point on accessibility, and gains only from the new reuse row. Edit mode lost ground in four rows. |

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
- **DS2-05. A gallery for the game's primitives and panels.**
  - **What:** a design-library section that renders the primitives and the wood panels with sample data, outside the game's bundle.
  - **Done when:** a test fails on a primitive without a story, as on the website.
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
- **DS2-10. A deprecation rule.**
  - **What:** a renamed or removed token or prop keeps an alias marked deprecated for one release, with a test that fails on any use of a deprecated name in the source; the rule is added to both design-system pages and AGENTS.md.
  - **Done when:** one real rename has gone through it end to end.

### WS5. Edit mode on the design system (G10, G11, G12)

- **DS2-11. Controls only through fundamentals.**
  - **What:** replace the raw buttons and inputs in edit mode's parts with `Button`, `IconButton`, `TextField`, `Checkbox` and the rest. Where none fits, add the missing fundamental to the website's system, with its story: a toggle button for the inspector's section navigation, a toolbar button for the canvas.
  - **Done when:** a test fails on a `<button>`, `<input>`, `<select>`, `<textarea>` or `<dialog>` in a part, as the game's test does for its primitives (any exception named with its reason); the editor E2E project passes.
- **DS2-12. Edit mode's shared pieces as components.**
  - **What:** make the repeated pieces components: the list-and-details layout (Access, Recommendations, Sections), the issue note, the action bar, the form and the list row. Each goes to the website's compounds if the site could use it, else to an editor kit tier the parts may import. The part-import test gains that tier.
  - **Done when:** no class name is defined in 3 or more parts, and fewer than 10 identical rule bodies are copied between parts (62 now), both checked by a test.
- **DS2-13. Parts documented like components.**
  - **What:** a comment on every prop, and a story per part in a development-only "Edit mode" section of the design library, with the same test that every option of a prop is shown.
  - **Done when:** the website's documentation test covers edit mode's parts and passes.
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

Re-measure these when a workstream closes. Where the 19 October count used a different method from the 11 October one, the note says so.

| Measure | 11 October 2026 | 19 October 2026 | Target | Item |
|---|---|---|---|---|
| Stories under a screenshot test | 0 of 55 | 0 of 57 | All, light and dark, 3 widths | DS2-01 |
| Top-level rules in the game's shared stylesheets | About 197 | 200 | 0 not owned by a component | DS2-04 |
| Game primitives with a story | 0 of 6 | 0 of 6 | All | DS2-05 |
| Game `forced-colors` and `prefers-contrast` rules | 0 and 0 | 0 and 0 | Every focusable control | DS2-06 |
| Game physical properties | 28 | 70 (a wider count: border sides and `top`, `right`, `bottom`, `left` included) | 0 | DS2-06 |
| Edit mode parts over 650 lines | 2 (1,152 and 704) | 2 (1,206 and 705) | 0 | DS2-07 |
| `Collection.astro` and `SiteHeader.astro` | 620 and 452 lines | 643 and 646 lines | 500 or fewer each | DS2-08 |
| Website compounds using container queries | 2 uses (both edit mode's) | 0 | Every compound placed in a column | DS2-08 |
| Token changes with a changelog entry | No changelog | No changelog | All | DS2-09 |
| Game initial JS | 449.6 KB of 450 KB | 449.7 KB of 450 KB | At or under 450 KB | DS2-04 |
| Raw controls in edit mode's parts | Not measured | 51 (40 buttons, 11 inputs) in 10 parts | 0, or each named with its reason | DS2-11 |
| Identical rule bodies copied between edit mode's parts | Not measured | 62 | Fewer than 10 | DS2-12 |
| Edit mode parts with a story | Not measured | 0 of 34 | All | DS2-13 |
| Game `:hover` rules outside `@media (hover: hover)` | Not measured | 8 of 8 | 0 | DS2-15 |
| Game component token groups with an owner | Not measured | 0 of 23 | All | DS2-16 |
| Identical rule bodies copied across the website's components | Not measured | 46 | Fewer than 25 | DS2-18 |

## 8. Definition of Done

- [ ] Every item in §6 is closed, each with the test named in its "Done when".
- [ ] The measures in §7 are at their targets, re-measured by script.
- [ ] The design-system unit suites, `npm run check` and `npm run verify:prod` pass; the `visual`, "site design system", "site on a phone", editor and game UI groups pass.
- [ ] The ratings in §2 are re-scored with the new evidence.
- [ ] The site and game design-system pages, the edit mode spec (§10) and AGENTS.md describe the new rules, and this page gains an "As built" section.

## 9. Open questions

- **Where the screenshot baselines are made.** Fonts render differently on Windows and on the Ubuntu deploy runner, so baselines made on one fail on the other. Either make them in CI (and fetch them to update), or in a pinned Linux container locally.
- **Whether the game's gallery belongs in the website's design library.** The two systems never import each other, so the gallery would need its own page that loads the game's tokens and styles, or a separate route under `/play/`.
- **How strict the game's high-contrast support should be.** The 3D view itself can't follow forced colours; the rule would cover the HUD and panels only.
- **Where edit mode's shared pieces live (DS2-12).** The list-and-details layout and the action bar could serve the website too (and Atiya Studio, which reads the website's tokens), so they may belong in its compounds. The issue note and the inspector's rows are edit mode's alone. Adding an editor kit tier changes the rule that a part never imports another part, so the edit mode spec has to say which pieces go where.
