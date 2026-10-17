# Theming: a site's look, made from its tokens and fonts

How a person changes the look of their site without touching code: a theme is a small set of choices (spacing, corners, fonts, the type ramp and colours) that edit mode turns into changes to [the site's design tokens](tokens.md). This page is the spec: the benchmark it rests on, the design and UX, the model, how it's built, and its Definition of Done.

> **TL;DR.**
> - **A theme is choices, not a stylesheet.** Spacing (tight, balanced, loose), corners (sharp, balanced, rounded), a font for each of the three roles, four type-ramp controls, and a palette. The build turns them into custom properties over the site's own tokens, so every component follows with no change, and **the site's own theme writes nothing**.
> - **Presets are read only.** Atiya (the site's own look), Studio, Journal and Garden. A person makes a theme theirs with **Save as new theme**; only their own themes take **Save**. Edit mode refuses a write over a preset.
> - **Colour always passes WCAG 2.2 AA.** Pick a preset palette, set one accent (the rest is generated in OKLCH, following the site's own design logic), take colours from a picture, or set any role by hand. Generated palettes are held to AA in light and dark by moving lightness; a role set by hand is checked, flagged and fixed in one press.
> - **Fonts always have a fallback.** Pairings made from the site's own faces, or a font imported from Google Fonts or any HTTPS font host: edit mode downloads it into `content/fonts/` and the site serves it itself (no third party at run time). Each role's stack ends in the role's own face, then a generic family.
> - **Where it lives:** the themes panel, docked on the right of the live site (Atiya Studio's site view, or `/_edit/theme/` in a browser), `content/themes/<id>.json`, `content/fonts/`, the active theme in `content/site.json` (`theme`), and the pure model in [`src/site/theme/`](https://github.com/prabinpebam/atiya/tree/main/src/site/theme).

## 1. Goals and limits

- **Robust, not complicated.** About a dozen controls cover what people change most (benchmark §2): how roomy, how round, which fonts, how big and how far apart the sizes are, and which colours. Everything else stays the design system's.
- **Tokens and fonts only.** A theme changes token values and the faces behind the font roles. It never changes a component, a layout, line height, weights, motion or a breakpoint.
- **Safe by construction.** No combination of controls breaks the page: sizes stay in order and above their floors, fluid sizes grow at most 2.5× (WCAG 1.4.4), touch targets stay 44 px, generated colours pass AA, and a font that fails falls back.
- **Where a theme applies:** the site's pages (the landing, sections, pages, the classic site, the pages the planet opens). Not edit mode, the design library (which documents the system as it is) or the game's own interface.

## 2. Benchmark

Researched for this spec (October 2026), with sources.

| Area | What the leaders do | What we take |
|---|---|---|
| Presets and user themes | WordPress style variations become the user's own customisation once chosen ([WordPress](https://developer.wordpress.org/themes/global-settings-and-styles/style-variations/)); Shopify says to duplicate a theme before customising ([Shopify](https://help.shopify.com/en/manual/online-store/themes/managing-themes/duplicating-themes)); Webflow's "duplicate" is an explicit fork ([Webflow](https://help.webflow.com/hc/en-us/articles/33961311094419-Classes)) | Presets are read only; Save as new is the fork, named; a theme remembers the preset it came from, so it can go back to it. Avoid silent overwrites (Squarespace) and no reset (Shopify, Wix) |
| Density | Radix Themes' one `scaling` multiplier, 90 % to 110 % ([Radix source](https://github.com/radix-ui/themes/blob/main/packages/radix-ui-themes/src/styles/tokens/scaling.css)); Material 2's per-component density tables | One three-step control scaling the space scale, with the layout's whitespace moving further than the room inside components; never per-component tables |
| Corners | Radix's radius factor 0, 0.75, 1, 1.5 with pills opting into 9999 px ([Radix source](https://github.com/radix-ui/themes/blob/main/packages/radix-ui-themes/src/styles/tokens/radius.css)); shadcn/ui's one `--radius` ([shadcn/ui](https://ui.shadcn.com/docs/theming)) | One three-step factor (0, 1, 1.5) over the radius scale; pills stay pills unless sharp; circles never change |
| Fonts | Squarespace font packs, then any role swapped ([Squarespace](https://support.squarespace.com/hc/en-us/articles/206545327-Choose-and-style-your-site-s-fonts)); Google Fonts CSS2 API ([Google](https://developers.google.com/fonts/docs/css2)); a Munich court found loading Google Fonts from Google's servers breaches GDPR ([LG München, 3 O 17493/20](https://gdprhub.eu/index.php?title=LG_M%C3%BCnchen_-_3_O_17493/20)); next/font self-hosts at build ([Next.js](https://nextjs.org/docs/app/getting-started/fonts)); `FontFace.load()` proves a font parses ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)) | Pairings, then any role; import from a Google Fonts or other HTTPS address, downloaded and self-hosted; `font-display: swap`; a fallback stack per role; the preview proves the font loads |
| Type ramp | Utopia's two-point fluid scale: sizes and ratios at a small and a large viewport ([Utopia](https://utopia.fyi/blog/clamp)); modular ratios ([type-scale.com](https://type-scale.com)); Radix's global scaling on top | The site's own fluid ramp, changed by four controls: overall size, the largest sizes, the smallest sizes, and the step between sizes; presets for common shapes |
| Colour | Material's HCT tonal palettes from one seed, contrast solved per role, colours from a wallpaper by quantizing and scoring ([Material Color Utilities](https://github.com/material-foundation/material-color-utilities)); Leonardo generates to target contrast ratios ([Adobe Leonardo](https://github.com/adobe/leonardo)); Tailwind's palette is OKLCH ([Tailwind](https://tailwindcss.com/docs/colors)) | OKLCH ramps from a seed that keep each role on the step the site's tokens give it, then each failing role moved in lightness until it passes; k-means in OKLab and a Material-style score for pictures |
| Editor UX | Radix's ThemePanel beside a live preview; Webflow's contrast readout in the colour picker ([Webflow](https://help.webflow.com/hc/en-us/articles/33961288849171-Color-picker-overview)); WordPress's Style Book; Framer's light and dark toggle | Controls beside a live preview of real pages, light and dark and phone width; a contrast badge on every colour; a "changed from the preset" mark and Reset |

## 3. The model

A theme is a JSON document ([`model.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/theme/model.ts), checked by the content contract):

```json
{
  "id": "night-garden",
  "name": "Night garden",
  "basedOn": "garden",
  "spacing": "balanced",
  "corners": "rounded",
  "fonts": { "display": "fraunces", "text": "font:lora", "ui": "figtree" },
  "type": { "size": 0, "largest": 1, "smallest": 0, "contrast": 1 },
  "colors": { "seed": { "accent": "#2F6B4A", "highlight": "#E8B04A", "neutral": "warm" }, "light": { "mark": "#F6E7B8" }, "dark": {} }
}
```

- **Presets** are code (`PRESETS`), never files, so they can't be edited or deleted. User themes are `content/themes/<id>.json`; an ID is never a preset's.
- **The active theme** is `theme` in `content/site.json` (a preset's ID or a user theme's); without it, `atiya`.
- **Imported fonts** are `content/fonts/<id>.json` with their `.woff2` files beside them.
- **A theme is resolved against the base** ([`base.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/theme/base.ts)): the values the site's tokens give every role, size, space and radius, read from the token model. So the design system stays the one source, and a theme is only what differs.

## 4. Spacing and corners

| Control | Steps | What changes |
|---|---|---|
| Spacing | Tight, Balanced, Loose | The space scale (`--space-*`) × 0.875, 1, 1.125; the layout's whitespace (`--space-gutter`, `--space-block`, `--space-section`) × 0.75, 1, 1.25. Touch targets and control heights don't change |
| Corners | Sharp, Balanced, Rounded | The radius scale (`--radius-xs` to `--radius-xl`) × 0, 1, 1.5; `--radius-pill` becomes 0 only when sharp; `--radius-round` (avatars, dots) never changes |

## 5. Type

### 5.1 Fonts

- **Three roles,** as the design system has them: display (headlines), text (reading), interface (controls, captions).
- **Pairings** (presets) made from the site's own faces: Magazine (Fraunces, Newsreader, Figtree: the site's own), Editorial (Fraunces over Figtree), Classic (Newsreader, Figtree), Modern (Figtree), System (the reader's own fonts, nothing downloaded).
- **Any role, any face:** a preset face or an imported font.
- **Fallback, always:** a role's stack is the chosen face, then the role's own face if it's of the same kind (a serif for a serif), else a face of the chosen font's kind, then a generic family. A font that's gone (deleted) leaves the role's own face. `font-display: swap` shows the fallback at once.

### 5.2 Importing a font

1. The person pastes an address: a Google Fonts stylesheet (`https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700`), any HTTPS stylesheet with `@font-face` rules, or a `.woff2` file's address.
2. Edit mode (the dev server, never the browser) fetches it: HTTPS only, at most 5 stylesheets' worth of files, each `.woff2` checked by its signature (`wOF2`) and at most 1.5 MB, and for a stylesheet only the Latin subset of each style (as the site's own faces).
3. It writes `content/fonts/<id>.json` (family, kind, source, licence note, its faces) and the files, through the store, in one transaction.
4. The preview loads it with `FontFace.load()` before offering it: one that doesn't parse is refused with what happened and what to try.
5. The site serves the files itself (`<base>/fonts/<file>`): no request to a font host when someone reads the site, which is also why loading Google Fonts from Google is avoided (benchmark §2).

### 5.3 The type ramp

Four controls over the site's own fluid ramp, in whole steps, working in log space round body text:

| Control | Range | Effect |
|---|---|---|
| Overall size | −3 to +5 (5 % a step) | Every size |
| Largest text | −3 to +3 (10 % a step) | The biggest sizes by the whole step, the sizes between them and body text in proportion; body text unchanged |
| Smallest text | −2 to +3 (5 % a step) | The smallest sizes by the whole step, the sizes between them and body text in proportion; body text unchanged |
| Step between sizes | −2 to +2 (10 % a step) | How far each size is from body text: more is more dramatic, less is quieter |

- **Presets:** Balanced (the site's own), Compact, Dramatic, Large print.
- **Held by construction** ([`ramp.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/theme/ramp.ts)): sizes stay in the site's order at both ends; nothing under 12 px; body text never under 16 px; each fluid size grows at most 2.5×. The screen warns (without refusing) when small text goes under 14 px or body text under 16 px on a phone.

## 6. Colour

### 6.1 Roles

A theme can set the site's 27 opaque colour roles (page, cards, wells, hover; text, muted, rules, outlines; accent and its hover, soft and on-colours; focus; highlight, its ink and marks; success and error). The translucent ones follow: the frosted scrollbar handle takes the accent; the lightbox's smoke and the shadows stay the site's.

### 6.2 Ways to set colours

- **Preset palettes:** Indigo and marigold (the site's own), Forest, Harbour, Plum, Ember, Ocean, Graphite.
- **One accent:** pick one colour; the highlight is chosen from it (the site's own relation, about 160° round the wheel at marigold's lightness) unless picked too, and the neutrals are warm, neutral, cool or tinted by the accent.
- **From a picture:** a picture from the site's media or a file from the computer; its colours are shown as swatches, best accent first; one press uses one as the accent, or the whole suggestion (accent, highlight, neutrals).
- **One by one:** any role, light and dark, with its contrast against what it's read on beside it.

### 6.3 Generating a palette

1. Each family of the site's primitives (the indigo, marigold and stock ramps) is re-hued to the seed in OKLCH; the step the site uses for the role (indigo 700 for the light accent) moves to the seed's own lightness and its neighbours move with it, fading out with distance, so the light and dark pages keep the site's logic.
2. Each role takes the step the tokens give it, in each mode.
3. Every rule is checked ([`palette.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/theme/palette.ts) `RULES`: the same as the site's own palette is held to): text roles 4.5:1 on every surface, muted text 7:1 and outlines 4.5:1 for "more contrast", outlines, focus and icons 3:1, text on fills 4.5:1. A failing role moves in lightness away from what it's read on until it passes; text on a fill picks white or ink.
4. The screen says when it moved the chosen accent ("Darkened to read on the page").

### 6.4 Colours from a picture

The picture is drawn small (96 px) on a canvas in the browser; its pixels are clustered in OKLab (k-means, seeded, so the same picture always gives the same colours), each cluster scored by its share of the picture and its chroma, mid-lightness preferred (after Material's score); near-duplicates are dropped. The best becomes the accent, a second of another hue the highlight, and greys pick the neutrals ([`extract.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/theme/extract.ts)).

## 7. How it's built

- **CSS:** [`css.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/theme/css.ts) resolves a theme against the base and writes only what differs: imported fonts' `@font-face`, then `:root:root { … }` (outranking `tokens.css`'s `:root` wherever the two land), colours as `light-dark()` pairs, fluid sizes as `clamp()`, then the "more contrast" swaps again inside `@media (prefers-contrast: more)` so the reader's setting still wins. The site's own theme writes nothing.
- **On a page:** `PageShell` writes the active theme's CSS into the head (a `<style data-site-theme>`, there even when empty on a themed page), its `theme-color` from the theme's page colour, and preloads the faces the theme uses. Edit mode and the design library ask for no theme, so they have no such element.
- **Live drafts:** the themes panel never saves to show a change. It writes the draft (its CSS and the light or dark page to preview) to the site origin's `localStorage` (`atiya.themeDraft`, with a heartbeat every few seconds while the panel is open). Every site page in dev runs a small script in its head (injected by edit mode, never in a build) that applies a fresh draft before the first paint, so a page the person navigates to shows the draft at once, and follows the `storage` event, so a change shows on the open page at once. A draft whose heartbeat stopped (a panel closed or crashed) is ignored after 15 seconds; closing the panel clears it, and the pages go back to the saved theme. One mechanism serves Atiya Studio (the panel and the site are two views of the same origin) and a browser (the panel beside the site in a frame). The draft's rules outrank the saved theme's (`:root:root:root`), so both can be on the page.
- **In dev:** pages read the saved theme from disk on each request, so a save shows on the next load too.

## 8. The themes panel

Theme settings aren't a settings form. Opening them (Theme in edit mode's navigation, the action center, or the Theme button in the title bar when the site is showing) shows **the site**, with **the themes panel docked on its right**. The site stays live and navigable beside it, and every change in the panel shows on it at once.

```text
| Atiya Studio  [Edit mode | Site]  ...                         [Theme] |
| the site, live, navigable                  | Themes panel             |
|                                            | Theme: [Garden      v]   |
|                                            |  Based on Garden . Unsaved changes |
|                                            | [Save] [Save as new] [Apply]  |
|                                            | > Browse themes          |
|                                            | > Colour                 |
|                                            | > Type                   |
|                                            | > Spacing and corners    |
|                                            | [Light | Dark]  Close    |
```

- **Where:** in Atiya Studio, a third view docked on the right of the body (the site's view narrows; the dock is about 24 rem, resizable later) and the title bar's Theme button (a pressed toggle, shown when the site is showing). Theme in edit mode switches the window to the site and opens the dock. In a browser, `/_edit/theme/` shows the site in a frame with the same panel on its right.
- **Navigate freely while previewing:** the site beside the panel is the real site, not a picture of it. The person can go to any section and any page (the header's menu, links, cards, the back button) and the preview follows them: every page they open shows the draft from its first paint, and the panel stays open with its state as they go.
- **Browse:** the panel opens on the theme in use. Its theme list shows the presets, then the person's own themes, each with its swatches, "In use" on the applied one, and "Unsaved" on one with a draft. Choosing one previews it on the site at once. Nothing is applied until Apply.
- **Change:** every control previews on the site at once (colours, fonts, the ramp, spacing, corners), in the light or dark page (the panel's Light and Dark switch previews either, whatever the system's).
- **Drafts:** each theme keeps its own draft while the person browses others (kept for the session), so trying a preset and coming back loses nothing. A theme with a draft says "Unsaved changes", with **Revert** (back to its saved state).
- **Save:** on the person's own theme, Save writes it. On a preset there's no Save: **Save as new theme** (asks a name, offers "<preset> copy") is the primary action. Save as new works on any theme.
- **Apply:** makes the chosen theme the site's (`site.json` `theme`). A preset with unsaved changes asks for a name first (Save as new, then apply), since a preset can't change.
- **Rename and Delete** (the person's own themes; Delete asks once; deleting the theme in use puts the site back on Atiya in the same save). **Reset to preset** puts the person's theme back to the preset it came from, as a draft.
- **Close:** the site goes back to the theme in use; drafts stay for the session.
- **Groups** (each a disclosure, Colour open first): Colour (palettes, accent, from a picture, one by one with contrast and Fix contrast), Type (pairings, a select per role, Import a font, type scales, the four controls), Spacing and corners (two segmented controls).
- **Copy** follows the site's rules: sentence case, verbs on buttons, no analogies (the ramp's controls are named for what they do).

## 9. Accessibility

- Controls are native (radio groups, selects, range inputs, colour inputs), labelled and grouped with legends; the panel passes axe in light and dark.
- Every colour shows its contrast and AA status in words, not colour alone.
- The preview's page (as the system, light or dark) is a radio group with a legend.
- Saves and refusals are announced in the panel's live region; a save also reports through edit mode's status line.

## 10. Definition of Done

| # | Done when | Evidence |
|---|---|---|
| T1 | The model is pure and tested: any accent gives an AA palette in both modes; every ramp combination keeps order, floors and the 2.5× limit; spacing and corners scale as §4 says; fonts always fall back; pictures give the same colours every time | Unit `theme.test.ts` |
| T2 | The site's own theme writes nothing, so the owner's site is byte-for-byte unchanged | Unit `theme.test.ts`; `build-parity` |
| T3 | Themes, fonts and the active theme are content: checked by the contract (a theme's fonts exist, the active theme exists, no file takes a preset's ID) | Unit `content.test.ts` (themes) |
| T4 | A site page shows the active theme (colours both modes, fonts, ramp, spacing, corners); edit mode and the design library don't | Site E2E "theme" |
| T5 | Opening theme settings shows the site with the themes panel docked on its right (Atiya Studio: a docked view; a browser: the site in a frame beside it); every change in the panel shows on the live site at once, light and dark; the person can navigate to any section and page while previewing, and each page shows the draft from its first paint, the panel keeping its state | Editor E2E "editor: theme"; app E2E "desktop: themes panel" |
| T6 | Every control in §4 to §6 works and is saved; colours show contrast and Fix contrast fixes them | Editor E2E "editor: theme"; unit |
| T7 | Browse, preview, keep a draft per theme, Revert, Save (own only: a preset has none, and the API refuses a write over one), Save as new, Apply (a changed preset is saved as new first), Rename, Delete, Reset to preset, Close (the site goes back to the theme in use) | Editor E2E; unit `themeStore.test.ts` |
| T8 | A font imports from a Google Fonts or other HTTPS address into `content/fonts/`, is served by the site, and a broken one is refused with the reason, leaving the fallback | Unit (parser, signature); editor E2E (a fixture font host) |
| T9 | Colours come from a picture (the site's or a file) | Unit `extract`; editor E2E |
| T10 | axe passes on the themes panel in light and dark; everything works from the keyboard | Editor E2E |
| T11 | Documented: this page, the design system's tokens section, edit mode's spec, the action center finds the screen | Docs; unit `find` |

## 11. As built

Built on 17 October 2026, in one change, unattended.

| # | Status | Evidence |
|---|---|---|
| T1 | Done | Unit `theme.test.ts` (36): every preset and palette, and 864 seeds (18 hues × 4 lightnesses × 3 chromas × 4 neutrals) give no contrast issue in either mode; all 1,890 combinations of the four type controls keep the order, the 12 px and 16 px floors and the 2.5× limit; no preset or type scale warns; spacing, corners and fonts as §4 and §5; the same picture gives the same colours |
| T2 | Done | `themeCss` of Atiya is empty (unit); `PageShell` writes no `<style data-site-theme>` when it's empty, so the owner's pages are unchanged; `verify:prod` passed (budgets, no edit mode in the build) |
| T3 | Done | Unit `themeContent.test.ts` (5): a theme, its font and the site using it load; a preset needs no file; refused: a preset's ID, a font not imported, a site theme that doesn't exist, controls out of range, a colour that isn't `#RRGGBB`, an unknown role, a font without its files, a file without its font |
| T4 | Done | Editor E2E "editor: theme" (presets read only): after Apply, a page with no draft is drawn in the theme (`style[data-site-theme]`, its radius); edit mode and the design library pass `themed={false}` to `PageShell` |
| T5 | Done | Editor E2E "editor: theme" (the live site): a preset and two controls previewed at once in the site's frame; a page navigated to shows the draft from its first paint; another tab follows; Close clears it. App E2E "desktop: themes panel": the Theme button docks the panel on the right of the site (the site's card narrows, the gap kept, the same height), the dock closes itself, edit mode's Theme screen opens it beside the site, leaving the site closes it |
| T6 | Done | Editor E2E "editor: theme" (colours): a palette, a picture's colours, a muted text set too light flagged under 4.5:1, Fix contrast passing it |
| T7 | Done | Editor E2E (presets read only): no Save or Delete on a preset; Apply on a changed preset asks a name ("Garden copy"), saves and applies; Save, Rename, Delete of the theme in use (the site back on Atiya); the API answers 422 to a write over a preset. Unit `themeStore.test.ts` (5): the same through the store, 409 on a taken ID |
| T8 | Done | Unit `themeImport.test.ts` (Google Fonts' stylesheet read, Latin kept, only HTTPS off this computer, WOFF2 signature) and `themeStore.test.ts` (a stand-in font host: imported and self-hosted with its licence noted; refused: not a font, not HTTPS, no WOFF2, over 1.5 MB; imported again replaces it). The panel loads each imported face with `FontFace.load()` before offering it |
| T9 | Done | Unit (`extract`); editor E2E (a red picture's colours used) |
| T10 | Done | Editor E2E: axe on the panel in light and dark, with every group open |
| T11 | Done | This page; [the design system](design-system.md) §2; [edit mode's spec](../editor/spec.md); [the desktop spec](../desktop/spec.md) §7.2; unit `editorFind.test.ts` (Theme in the side navigation and the action center) |

**Decisions made while building:**
- **The step between sizes spreads the headings only.** Spreading the small sizes too pushed captions under 14 px on presets (Garden); the small sizes are the smallest-text control's.
- **Compact keeps the overall size.** It's smaller headlines set closer together; shrinking everything took captions under 14 px.
- **Body text never under 16 px** (the benchmark: the browser's own default), small text never under 12 px; the panel warns under 14 px.
- **A draft states every token** (`themeCss(…, { all: true })`), so previewing Atiya over a site using another theme shows Atiya.
- **Drafts live in the panel's session** (`sessionStorage`), one per theme; the site's pages read only the current one (`localStorage['atiya.themeDraft']`, refreshed every 4 seconds, ignored after 15).
- **The dock** is 400 px and gives way before the site has less than 480 px (`apps/desktop/src/core/dock.mjs`); the frame draws its card's edge, and the body's hole narrows to leave the gap.
- **Font import fetches with a browser's user agent** (Google Fonts serves WOFF2 only to one), keeps the Latin subset and refuses local addresses (it's the dev server that fetches).
- **No phone-width preview in the panel:** narrow the window (or open the site on a phone) instead; later if asked.

**Fixed since:** the docs link policy (Slate `parentDomain`, upstream `26b5619`, pinned here) and the action center test's wait for the dev server to settle after the reset's rename.

## 12. Later

- Metric-matched fallbacks (`size-adjust`, `ascent-override`) for imported fonts, from the font's own metrics, to remove the shift when a font swaps in.
- Adobe Fonts kits (they're served by Adobe by design: they can't be self-hosted).
- Per-section themes.
