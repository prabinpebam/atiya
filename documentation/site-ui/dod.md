# Site design system: Definition of Done

> **TL;DR.** The site design system is done when every row below holds, and each row names its evidence:
> - a researched spec with a first draft, a critique and a v2;
> - a visual language;
> - DTCG 2025.10 tokens in two modes;
> - 24 fundamentals, 16 compounds and 4 layouts, each built only from the tiers below it and each with a story;
> - a live design library built from the source;
> - the landing and the classic site on the new system;
> - accessibility, performance and the rules enforced by tests.
>
> The spec is [spec.md](spec.md) and the rules are [design-system.md](design-system.md).

| # | Item | Evidence | Status |
|---|---|---|---|
| 1 | Research, cited | [spec.md](spec.md) §1: Storybook and its alternatives (Ladle, Histoire, Pattern Lab, Fractal, Astrobook), in-site catalogues (GOV.UK, Every Layout, Starlight), Atomic Design, DTCG 2025.10 (format and resolver), `light-dark()`, customisable select support, the APG patterns, Utopia and the WCAG 1.4.4 limit, video facades, the Google Fonts ruling and cache partitioning, and the fonts' facts | Done |
| 2 | Spec v1, a critique, and a v2 as built | [spec.md](spec.md) §3 (v1 and 15 problems, each with its fix) and §4 (v2, plan) | Done |
| 3 | A visual language with a practical type choice and ramp | [visual-language.md](visual-language.md): palette with hex values in both modes, the three faces with their jobs and reasons, the 12-step ramp with sizes and settings, space, grid, radius by hierarchy, pictures, motion, icons and voice | Done |
| 4 | **Completely separate from the game's system** | `src/site/` has its own tokens, build, styles and components. The game's `tokens.json` is untouched, and `site.css` is gone from the game's styles. The unit test "the game and the site never import each other" | Done |
| 5 | Tokens: DTCG 2025.10, one source, three tiers, light and dark | `site.resolver.json` + `tokens.json` + `tokens.light.json` + `tokens.dark.json` → `scripts/build-site-tokens.mjs` → `src/site/styles/tokens.css` (238 tokens) and [tokens.md](tokens.md). Unit tests check the 2025.10 value objects, the resolver, both contexts, aliases in both modes, freshness, and that fluid sizes stay within 2.5x | Done |
| 6 | **Strictly token-driven**: no raw values, no primitives in components | `siteDesignSystem.test.ts`: no colour literals; no `--p-*` outside the tokens and the library's token pages; z-index, type, weight, leading, tracking, family, radius, border, shadow, motion and spacing from tokens; breakpoints from tokens; every `var()` defined | Done |
| 7 | **Tokens → fundamentals → compounds → layouts**, each tier made only from the ones before it | The test parses every component's imports (frontmatter and scripts) and fails a same-tier or upward import. It was mutation-checked: a fundamental importing a compound fails. Fundamentals are sealed (no `class` or `style` props, tested); `:global` is allowed only where a component styles markup it didn't write (tested) | Done |
| 8 | The components asked for, all custom | **Custom dropdown with its own list** (Select), radio buttons, checkboxes, switches, text fields, **scrollbars** (ScrollArea and the site-wide thin scrollbar), sliders, **progress bars**, **loaders** (Spinner in two styles, Skeleton), buttons, icon buttons, tags, links, headings, text, captions, avatars, images, **video**, **galleries**, a **fullscreen image viewer with a smoke scrim and a filmstrip** (Lightbox), a **carousel**, **quotes** (block and pull), prose, a divider (hairline and dinkus), a header, a footer, a hero, story cards, a contents list, breadcrumbs, next and previous, choice groups and a video embed with a facade. Screenshots in [spec.md](spec.md) and [visual-language.md](visual-language.md) | Done |
| 9 | Font Awesome solid icons, as for the game | `src/site/design/icons.ts` (`@fortawesome/free-solid-svg-icons` 7.3.1, drawn inline); no emoji or symbol icons (tested); credited in `assets-src/CREDITS.md` | Done |
| 10 | Layouts, uniform ones defined once | LandingLayout, IndexLayout, ArticleLayout and LibraryLayout in `src/site/layouts/`, each with a full-page sample at `/design/demo/<slug>/` | Done |
| 11 | Light and dark mode | `light-dark()` roles; the system's mode by default; the header's theme switch (Match system, Light, Dark), remembered and applied before the first paint. E2E test "the theme" (the choice survives a reload, and `data-theme` is set by DOMContentLoaded) | Done |
| 12 | **A design library to preview everything**, lighter than Storybook | `/design/`, built from the source by `src/site/library/registry.ts`, with no extra dependency. It has token pages (colour in both modes with contrast, type specimens with a live axes playground and the ramp at real size, space, shape, motion you can play, layers and component tokens, icons). Each component page has live examples with a per-example Light or Dark switch and the source cut from the story, the props from `interface Props`, the keys and accessibility notes, the tokens it reads (linked), and "uses" and "used by". Layout pages have a phone, tablet and desktop viewport frame. E2E test "every component and layout has its page" (over 45 pages, no errors) | Done |
| 13 | Every component documents itself and has a story | The unit test "every component documents itself and has a story" (a summary, `@tier`, `@a11y`, a JSDoc comment on every prop, `@key` lines when it takes keys, a story with examples; no orphan stories) | Done |
| 14 | The landing and the classic site on the new system | `src/pages/index.astro` (LandingLayout), `src/pages/classic/index.astro` (IndexLayout with a contents list), `src/pages/classic/[id].astro` (ArticleLayout, with breadcrumbs and next and previous); the pages carry no styles (tested); `ClassicLayout.astro` and `site.css` removed. The E2E group "landing & classic" and "context-preserving switch" pass | Done |
| 15 | Accessibility | Contrast in both modes (unit, including text on pictures and the lightbox's smoke); axe in light and dark on the library, the layouts and the pages (E2E); the select follows the APG key for key (`siteBehaviour.test.ts` and E2E); the lightbox is a native modal that returns focus (E2E); the carousel has no autoplay and real ends (E2E); 44 px targets; reduced motion | Done |
| 16 | Performance and privacy | Fonts self-hosted through Fontsource (no Google request), about 200 KB on a typical page; the landing's eager JS is 1.5 KB gz with no game code (`verify:prod`, and the E2E landing test); video embeds request nothing until pressed; pictures are sized, `srcset` and lazy | Done |
| 17 | Works under the deploy's base path | A `BASE_PATH=/atiya` build with no root-relative URL left in the site's HTML; the unit test bans hard-coded root-relative URLs | Done |
| 18 | No regressions | `npx vitest run` (639 passed at the last full run), `npm run check` (0 errors), `npm run verify:prod` (budgets met: game JS 449.1 of 450 KB, unchanged), and the E2E groups "landing & classic", "site design system" and the planet-to-classic round trip (10 of 10). The full E2E suite wasn't run: the change doesn't touch the game | Done |
| 19 | Documented as the source of truth | This folder, registered in the docs manifest (the "Site UI" group) and on [the docs home](../index.html); AGENTS.md has a "Site design system" section; the engineering overview and the game's design system point here | Done |

## Deferred

These are recorded in [spec.md](spec.md) §5, each with its reason:

- a native `base-select` path;
- zoom inside the lightbox;
- a table of contents for long reads;
- code highlighting in the library;
- the real case-study content.
