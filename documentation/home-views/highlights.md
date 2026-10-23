# The classic home's highlights carousel

> **TL;DR.** The space below the classic home's introduction is an owner-curated carousel, not a fixed GitHub feature. It can hold the interactive GitHub calendar, a page with its lead picture and a short excerpt, an album with its cover, or one library picture. The owner sets its order and presentation in edit mode. Its controls, peek, dots and filmstrip are the article image carousel's own, not a look-alike. It never advances by itself. This change is local until the owner authorises deployment.

## 1. Scope and placement

The name, introduction and ways into the site stay above the highlights; the sections stay below. This is the **classic home only**, at `/` when Classic is the default, and at `/views/classic/`. Other home views and the capability spine's own highlights are unchanged.

The existing GitHub calendar becomes a reusable contribution chart without a second copy of the owner's name or introduction. Its 2D/3D controls, month labels, hover/tap details, bounded tumble, return, theme and statistics remain.

| Slide | Its source | What the visitor sees | Primary action |
|---|---|---|---|
| Custom: GitHub | The existing anonymous public-profile snapshot | The interactive chart and statistics, not a screenshot | Chart controls; profile link |
| Page | An existing public article/page ID | Its current title and lead picture, plus its summary or a short verbatim excerpt the owner selects | Read the page at its canonical address |
| Album | An existing public album ID | Its current title, summary and cover picture/poster | Open the album |
| Image | An existing public image media ID | The picture, its sidecar alt and caption | Open the full picture in the page's lightbox |

Custom means an engine-owned renderer from a trusted catalogue, with GitHub the first entry. It does **not** mean pasted HTML, JavaScript, a URL to executable content or a private-data widget. A later custom kind must add its typed contract, renderer, editor choice and tests.

## 2. Owner configuration

Edit mode gains **Home highlights**, reachable from its navigation and action centre. It offers:

1. Show/hide the highlights area and name the carousel.
2. Add a GitHub, page, album or image slide by selecting an existing resource. Only public resources are offered. No made-up content is added.
3. Choose a page excerpt (optional, at most 280 characters, found in the article's own plain text); leaving it empty uses the article's summary. Titles and pictures stay linked to the source rather than copied.
4. Reorder with Move up/Move down buttons, and remove a slide without deleting its source.
5. Set **Peek**, previous/next **buttons**, and pager **dots**, **filmstrip** or **wrapping filmstrip**. Dots-only is buttons off and dots selected. Picture display (fill, fit, actual, tile), automatic background, rounded corners and shadow use the article carousel's existing options.
6. Save through the versioned content store, with the standard busy and saved/failed feedback. Conflicts preserve unsaved input. Other open screens and the preview hear changes.

A carousel holds at most 12 slides. Item IDs are stable and unique; the same source cannot be added twice. The owner can save an empty or disabled carousel. Empty is an intentional absence, not an instruction to restore the planet picture.

## 3. Content contract and safety

The optional `content/highlights.json` resource is read through the content repository. It is independent of `showcase.json` (capability curation) and `structures/ways.json` (which home view is offered).

```json
{
  "label": "Highlights",
  "enabled": true,
  "peek": false,
  "arrows": true,
  "pager": "dots",
  "display": "fill",
  "background": false,
  "rounded": true,
  "shadow": false,
  "items": [
    { "id": "github", "type": "custom", "custom": "github" }
  ]
}
```

The other item shapes are `{id, type: "article", article, text?}`, `{id, type: "album", album}` and `{id, type: "image", media}`. Unknown keys, invalid settings, duplicate IDs/sources and missing/private references fail validation before a save writes bytes.

- A saved page/album pick can wait while its source is a draft or temporarily unplaced; only published, open, public sources render. A page without a lead picture or an album without a cover is also waiting. Edit mode says why. Republishing/restoring makes it return in the same position.
- A picture must be from the public library with publishable visibility and alt text (or intentionally decorative). A page/album cover is checked by the same public-media boundary. Dark versions and picture focus/display settings travel with the image.
- Deleting a referenced resource is refused by the content check; the error tells the owner to remove the highlight first. Making it private is likewise refused rather than publishing the reference. Media usage reports include highlighted images.
- No private page identifiers, titles, pictures or excerpts go in public markup. No runtime GitHub data fetching is added.
- If the file is absent, existing sites keep their current opening (GitHub when a snapshot exists; otherwise their usual opening). The owner's initial configuration contains only the existing GitHub slide. Nothing else is selected for him.

## 4. One carousel, not two implementations

The article `Carousel` is extended with a trusted render-function slot, called with each slide's index. Its current image/video path remains the default. The same component owns the slide wrappers, snap track, peek/fade geometry, controls, status, dots, filmstrip and lifecycle script for both uses. A content-level composition resolves and supplies the highlight slides; compounds never import other compounds.

- No automatic rotation, looping at the ends or new animation.
- One visible slide: no navigation chrome when only one eligible slide exists. No eligible slides: no empty carousel region.
- Multiple slides: the article carousel's controls and 44 px targets, with a named region and numbered slides. The counter announces navigation.
- Peeked neighbours are hints: choosing one first brings it into view, not through its link. Offscreen slide controls cannot take keyboard focus.
- Left/right changes slides **only when the track itself has focus**. A focused GitHub canvas keeps its own day-navigation keys, and its pointer drag never drags the outer carousel. On touch, vertical page scrolling stays available; a chart's horizontal drag tumbles it, and carousel controls still move between slides.
- The track reserves the height of its tallest slide, avoiding jumps while changing selection. Picture slides use the existing carousel frame limits. Theme, contrast, reduced motion, base paths, lightbox and page-transition cleanup retain existing patterns.
- Without JavaScript, content stays in the HTML and the horizontal track is scrollable; links and image lightbox fallbacks remain usable. GitHub statistics and its screen-reader date table remain HTML.

## 5. Definition of Done

| ID | Outcome | Required evidence |
|---|---|---|
| HC1 | Typed, deterministic data | Unit cases for each kind, settings, order, stable IDs, duplicates, maximum, missing/private references, excerpt provenance, disabled/empty and absent-file compatibility |
| HC2 | Only eligible public content | Unit and browser coverage of drafts/unpublish/republish, missing pictures/covers and private rejection; build leak check |
| HC3 | Exactly the article carousel | The same `Carousel` component and script render both; targeted existing article carousel regressions plus mixed highlight tests for peek, buttons, dots and filmstrip |
| HC4 | All four kinds work | Fixture mixed carousel: exact page excerpt/title/lead/link, album cover/link, image/lightbox and interactive GitHub; no invented real-site picks |
| HC5 | Owner can configure it | Fixture editor E2E: add each kind, excerpt, reorder, remove, save/reopen and settings; version conflict preserves input; explicit failed-save feedback |
| HC6 | Input/accessibility | Keyboard slide controls and inner chart keys do not conflict; touch chart/tap/vertical scroll; offscreen focus excluded; axe light/dark, reduced motion and 320 px reflow |
| HC7 | Visual quality | Affected story/home/editor screenshots in light/dark at phone, tablet and desktop; review each intended baseline change |
| HC8 | Existing behavior and build safety | Affected unit suites, types, production build/budgets/leak check, existing carousel regressions; no new dependency or live service call |
| HC9 | Documented and local | This spec and evidence agree with the build; content/editor docs linked; clean scoped local work, no push or deployment |

## 6. As-built evidence

Built locally on `feature/home-highlights-carousel`. The owner configuration contains GitHub only; the mixed examples are made-up library stories and isolated test fixtures. No push or deployment is authorised.

| Gate | Evidence |
|---|---|
| HC1, HC2 | `highlights.test.ts`, `editorHighlights.test.ts`: all item kinds/options, exact maximum, duplicate IDs/sources, verbatim excerpts, missing/private sources, delete/access transitions, derived media usage, alt text and degraded dev loading. The actual fixture home excludes draft pages/albums, restores them on republish, and hides empty/disabled highlights without bringing back the planet picture. |
| HC3, HC4 | Twelve public browser cases passed across `highlights.spec.ts`, `contributions.spec.ts` and the affected `site.spec.ts` carousel cases. The mixed story uses the existing article carousel; the editor fixture checks repository-resolved lead/cover, exact excerpt, canonical links and the full-image lightbox. |
| HC5 | Five `editor-highlights.spec.ts` cases passed: add all four kinds, settings, excerpt, order/remove, save/reopen, failed validation, clean cross-tab updates, dirty input/version conflicts, public resolution and no image preload. |
| HC6 | Existing GitHub touch/tumble and reduced-motion tests passed inside the new home carousel; nested chart keys do not change slides, focused track keys do, and offscreen contents are inert. Axe passes in both themes, with public reflow at 320 px and editor reflow at 390 px. |
| HC7 | The four affected visual groups passed during intentional baseline capture. All 38 added/changed images were reviewed: mixed carousel, cards and editor parts in both themes, including phone; only the two home phone baselines changed. Existing carousel examples retained their order and baselines. |
| HC8 | 677 affected unit tests passed; the full Astro type check passed with existing hints only. Production budgets, sealed-output leak check and source/engine parity are the remaining local build gates. |
| HC9 | This page, the content model and editor screen catalogue describe the implementation. No dependency or live service call was added. The work remains local. |

Deliberately not run: the unrelated full game/editor suites and performance benchmark. This change uses existing carousel and input infrastructure; the focused existing carousel, GitHub and editor cases cover its behavior.
