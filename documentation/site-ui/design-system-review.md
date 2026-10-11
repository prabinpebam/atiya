# Design systems: maturity review and next steps

A rating of the three design systems in this repository (the website's, the game UI's and edit mode's) against what the best production systems do, and the work that would close the gap. The rules being rated are in [the site design system](design-system.md), [the game UI design system](../game-ui/design-system.md) and [the edit mode spec](../editor/spec.md). This follows [the first completed round of audit fixes](design-system-audit.md), whose 16 items are all closed, with the documented DS-16 size-limit deviation: this page starts from that state. The DS2 work below is a separate, planned follow-up, not part of the completed round.

> **TL;DR.** On 11 October 2026 the website's system rates **about 8.8 out of 10**, edit mode's **about 7.5** and the game UI's **about 6.6**.
> - **The website is world class in discipline.** Its rules are tests that fail the build (about 88 test cases across the two systems, 278 checks, all passing), its tokens follow DTCG 2025.10 with theme and contrast contexts, contrast is calculated in every mode, and its design library builds itself from the code.
> - **Three gaps keep it from world class:** nothing compares screenshots, so a visual regression passes every test; the game's styles are global stylesheets (about 197 selectors) rather than styles kept with their components; and edit mode's parts have no size limit (the inspector is 1,152 lines).
> - **The fix is 10 work items in 4 workstreams,** each closed by a test. Nothing here is scheduled: it's recorded so the work can be picked up later.

## 1. Method

- **Code measured:** `main` at commit `f029cc7` (11 October 2026), every count taken by script over the source.
- **Policy suites:**
  - `npx vitest run tests/unit/siteDesignSystem.test.ts tests/unit/designSystem.test.ts tests/unit/responsive.test.ts tests/unit/selectRules.test.ts`;
  - result: 278 passed, 0 failed.
- **Generated files** (all up to date):
  - `node scripts/build-site-tokens.mjs --check`;
  - `node scripts/build-tokens.mjs --check`;
  - `python scripts/build-site-fonts.py --check`.
- **Compared against:** what mature systems such as GitHub's Primer, Adobe's Spectrum and IBM's Carbon commonly do: tokens in a standard format, enforcement by lint or test, a component gallery, accessibility built in, screenshot tests per story, and a published change history.
- **Ratings** are a judgement out of 10 on that comparison, backed by the evidence in §3 and §4:
  - 9 to 10: leads the field;
  - 7 to 8: solid, with known gaps;
  - 5 to 6: the rules exist but aren't carried through;
  - below 5: missing.
- **Not re-run:** the Playwright groups. They passed at the first audit's close and nothing they cover has changed since.

## 2. Ratings

| Aspect | Website | Game UI | Edit mode | Why |
|---|---|---|---|---|
| Token architecture | 9.5 | 8 | 8.5 | DTCG 2025.10 with primitive, semantic and component tiers. The website has 342 base tokens, 37 colour roles in each theme and 3 more-contrast overrides, resolved from one file, and every component group names its owner. The game has 282 tokens and no theme contexts. Edit mode's sizes are `c.editor` tokens in their own stylesheet. |
| Token discipline (enforced) | 9.5 | 9 | 9 | A CSS parser fails on any raw size, colour, time, layer or scale factor. The game allows 4 raw values, each with its reason. Primitives are private, and a test fails on a token nothing reads. |
| Accessibility built into the system | 9.5 | 6.5 | 8.5 | Website: WCAG AA contrast in both modes, and AAA muted text in more-contrast mode; fluid type that still grows at 200% zoom; 44 px targets; hover that never sticks on touch; reduced motion; Windows high-contrast mode; 42 axe calls across the browser tests. Game: no high-contrast or more-contrast support. |
| Component architecture | 8.5 | 6.5 | 6.5 | Website: strict tiers, fundamentals that can't be restyled, and a tested size limit (650 lines a file). Edit mode's parts aren't held to it (the inspector is 1,152 lines). The game's UI is 6 primitives over global stylesheets. |
| Documentation | 9 | 6 | 7 | The website's library is built from doc comments, prop comments and stories (55 stories, 175 examples), and a test fails if a story skips a prop's option. The game has written rules but no gallery. |
| Responsiveness and right-to-left readiness | 9 | 4.5 | 8.5 | The website uses logical properties throughout (377, and no physical ones) and breakpoint tokens only. The game has 28 physical properties against 3 logical ones. |
| Quality checks | 7.5 | 7 | 7.5 | Strong static checks, axe and browser tests, but no screenshot comparisons. |
| Governance | 7 | 6.5 | 7 | Written rules, an audit and a Definition of Done, but no changelog, versioning or deprecation path. |
| **Overall** | **8.8** | **6.6** | **7.5** | |

## 3. What makes it world class

1. **The rules are tests, not guidance.** About 88 test cases cover tokens, tiers, sealing, docs and stories, copy, icons, fonts, scrollbars and each page's script setup. Most large systems hold much of this through lint rules and review; here a broken rule fails the build.
2. **It follows the token standard closely.** DTCG 2025.10 colour and dimension objects, a resolver with light and dark contexts and a contrast modifier, and generated CSS and docs with a `--check` that fails when they're stale.
3. **Contrast is calculated, not judged by eye.** Every text role on every surface, the focus ring, outlines, the duotone icons' second layer and text over pictures are checked in light, dark and more-contrast modes.
4. **The documentation can't go stale.** The design library (`/design/`) is generated from the components; a missing story, an undocumented prop or an unshown option fails a test.
5. **Separation is held by tests.** The website and the game never import each other, the game's tokens never reach the site, and edit mode never reaches a production build.

## 4. Gaps

| ID | Gap | Evidence (11 October 2026) | Systems |
|---|---|---|---|
| G1 | No screenshot tests | 0 uses of `toHaveScreenshot` or `toMatchSnapshot` in `tests/e2e/`. A token or component change can shift the page without failing anything. | All |
| G2 | The game's styles are global | `src/styles/hud.css` is 880 lines and `panels.css` 757, with about 197 top-level selectors between them. Styles aren't kept with the components that use them, and there are no cascade layers. | Game |
| G3 | The game has no gallery | Its 6 primitives (`Button`, `IconButton`, `KeyCap`, `Dialog`, `Panel`, `ScrollArea`) and its panels have no stories; they're seen only by playing. | Game |
| G4 | Edit mode has no size limit | The website's 650-line rule covers only the site's tiers. `Inspector.astro` is 1,152 lines, `GrantDetails.astro` 704, `SectionManager.astro` 555. | Edit mode |
| G5 | Website components near the limit | `Collection.astro` is 620 of 650 lines; `SiteHeader.astro` is 452 and `Carousel.astro` 442. | Website |
| G6 | Game accessibility gaps | 0 `forced-colors` and 0 `prefers-contrast` queries in the game's styles; 28 physical properties against 3 logical ones. | Game |
| G7 | Layout follows the screen, not the space | Compounds use `@container` twice; the rest respond to the screen width, so they adapt less well in a narrow column. No `@layer` anywhere. | Website |
| G8 | No change history | No changelog, versioning or deprecation rule for tokens or components. A renamed token or changed prop is found only when a test fails. | All |
| G9 | The game's bundle is nearly full | Its initial JS is 449.6 KB against a 450 KB budget, so each new game UI piece must load on demand or pay for itself. | Game |

## 5. Work items

Four workstreams. WS1 can start at any time; WS2 and WS3 are independent of each other; WS4 is last, as it records what the others change.

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
  - **What:** bring `Collection.astro` under 500 lines, and move the compounds that sit in columns (cards, collections, the carousel) to container queries with tokens for their sizes.
  - **Done when:** a test fails on a compound in a column that sizes itself by the screen width rather than its container; the "site on a phone" group passes.

### WS4. Change history (G8)

- **DS2-09. A generated changelog for tokens.**
  - **What:** `build-site-tokens.mjs` and `build-tokens.mjs` write the tokens added, removed, renamed and changed in value to a changelog page in the docs, compared with the last commit on `main`.
  - **Done when:** a token change without a changelog entry fails the `--check`.
- **DS2-10. A deprecation rule.**
  - **What:** a renamed or removed token or prop keeps an alias marked deprecated for one release, with a test that fails on any use of a deprecated name in the source; the rule is added to both design-system pages and AGENTS.md.
  - **Done when:** one real rename has gone through it end to end.

## 6. Measures

Re-measure these when a workstream closes.

| Measure | 11 October 2026 | Target | Item |
|---|---|---|---|
| Stories under a screenshot test | 0 of 55 | All, light and dark, 3 widths | DS2-01 |
| Top-level selectors in the game's shared stylesheets | About 197 | 0 not owned by a component | DS2-04 |
| Game primitives with a story | 0 of 6 | All | DS2-05 |
| Game `forced-colors` and `prefers-contrast` rules | 0 and 0 | Every focusable control | DS2-06 |
| Game physical properties | 28 | 0 | DS2-06 |
| Edit mode parts over 650 lines | 2 (1,152 and 704) | 0 | DS2-07 |
| `Collection.astro` | 620 lines | 500 or fewer | DS2-08 |
| Compounds using container queries | 2 uses | Every compound placed in a column | DS2-08 |
| Token changes with a changelog entry | No changelog | All | DS2-09 |
| Game initial JS | 449.6 KB of 450 KB | At or under 450 KB | DS2-04 |

## 7. Definition of Done

- [ ] Every item in §5 is closed, each with the test named in its "Done when".
- [ ] The measures in §6 are at their targets, re-measured by script.
- [ ] The design-system unit suites, `npm run check` and `npm run verify:prod` pass; the `visual`, "site design system", "site on a phone", editor and game UI groups pass.
- [ ] The ratings in §2 are re-scored with the new evidence.
- [ ] The site and game design-system pages and AGENTS.md describe the new rules, and this page gains an "As built" section.

## 8. Open questions

- **Where the screenshot baselines are made.** Fonts render differently on Windows and on the Ubuntu deploy runner, so baselines made on one fail on the other. Either make them in CI (and fetch them to update), or in a pinned Linux container locally.
- **Whether the game's gallery belongs in the website's design library.** The two systems never import each other, so the gallery would need its own page that loads the game's tokens and styles, or a separate route under `/play/`.
- **How strict the game's high-contrast support should be.** The 3D view itself can't follow forced colours; the rule would cover the HUD and panels only.
