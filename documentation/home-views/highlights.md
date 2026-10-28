# The classic home's highlights carousel

> **TL;DR.** The space below the classic home's introduction is an owner-curated carousel, not a fixed GitHub feature. It can hold the interactive GitHub calendar, a page with a representative picture and a short excerpt, an album with its cover, or one library picture. A slide can choose its own picture and presentation without changing the source page. The owner sets its order and presentation in edit mode. Its controls, peek, dots and filmstrip are the article image carousel's own, not a look-alike. On the home it loops and plays by itself, a slide every 4 seconds, its dot a pill that fills as the time runs; the owner can turn either off or change the time, and a reader can pause it (§2.4). This change is local until the owner authorises deployment.

## 1. Scope and placement

The name, introduction and ways into the site stay above the highlights; the sections stay below. This is the **classic home only**, at `/` when Classic is the default, and at `/views/classic/`. Other home views and the capability spine's own highlights are unchanged.

The opening above the highlights has two columns: the name and the introduction's first line in the first, the ways into the site (Explore the planet, Read the site) in the second. Below 56rem they stack in that order. The introduction's other lines, and the note on how the site was built, are a quiet footnote under the sections, not part of the opening.

The existing GitHub calendar becomes a reusable contribution chart without a second copy of the owner's name or introduction. Its 2D/3D controls, month labels, hover/tap details, bounded tumble, return, theme and statistics remain.

| Slide | Its source | What the visitor sees | Primary action |
|---|---|---|---|
| Custom: GitHub | The existing anonymous public-profile snapshot | The interactive chart and statistics, not a screenshot | Chart controls; profile link |
| Page | An existing public article/page ID | Its current title and automatic or chosen picture, plus its summary or a short verbatim excerpt the owner selects | Read the page at its canonical address |
| Album | An existing public album ID | Its current title, summary and either its arranged cover (§2.3) or one picture: its cover's lead picture/poster or one chosen | Open the album |
| Image | An existing public image media ID | The picture, its sidecar alt and caption | Open the full picture in the page's lightbox |

Custom means an engine-owned renderer from a trusted catalogue, with GitHub the first entry. It does **not** mean pasted HTML, JavaScript, a URL to executable content or a private-data widget. A later custom kind must add its typed contract, renderer, editor choice and tests. Edit mode names a custom slide a **Chart**, with the same word in the picker, the list and the details (`SLIDE_KIND`).

## 2. Owner configuration

Edit mode gains **Home highlights**, reachable from its navigation and action centre. It's a [list and details](../editor/list-and-details.md) screen, like Sections and Recommendations: the list holds **Carousel settings** above a rule, then **Add slide** and the slides in order (each with its kind and whether it's ready or waiting, and why); the details show what's chosen (`?slide=<id>`, `settings` or `new`). Each action saves on its own. It offers:

1. Show/hide the highlights area and name the carousel.
2. Add a GitHub, page, album or image slide by browsing the public sources and previewing one as the carousel would show it, then adding it (§2.1). Only public resources are offered. No made-up content is added.
3. Choose a page excerpt (optional, at most 280 characters, found in the article's own plain text); leaving it empty uses the article's summary. Titles stay linked to the source. Each picture slide can use its automatic picture or an independent library picture, with its own presentation (§2.2).
4. Reorder with Move up/Move down buttons in a slide's details, and remove a slide (two presses) without deleting its source.
5. Set **Peek**, previous/next **buttons**, and pager **dots**, **filmstrip** or **wrapping filmstrip**. Dots-only is buttons off and dots selected. Picture display (fill, fit, actual, tile), automatic background, rounded corners and shadow use the article carousel's existing options. **Loop slides**, **Play slides automatically** and **Time per slide** (§2.4).
6. Save through the versioned content store, with the standard busy and saved/failed feedback. Conflicts preserve unsaved input. Other open screens and the preview hear changes.

A carousel holds at most 12 slides. Item IDs are stable and unique; the same source cannot be added twice. The owner can save an empty or disabled carousel. Empty is an intentional absence, not an instruction to restore the planet picture.

### 2.1 Adding a slide: choose by seeing

Add slide was first a dropdown of titles. But the kinds differ: a live chart, a page with its picture and words, an album's cover, one picture. A title alone doesn't say how a slide will look, whether it can show yet, or what it needs. So choosing meant adding, looking at the home and removing. Adding is now a **sources step** and a **preview step**, both in the details pane. Promise served: the classic home leads with what best represents the owner now, and he sets that up without trial and error.

| # | Job: when I…, I want to…, so I can… |
|---|---|
| J1 | When I want the home to lead with my best recent work, I want to find it among everything public, so I can put it in front quickly. |
| J2 | When several kinds could tell the same story (a page or its album, a picture or the chart), I want to see how each would look as a slide, so I can choose the strongest without adding and removing. |
| J3 | When something I want isn't ready, I want to know before choosing what it needs and where to fix it, so a slide that never shows doesn't surprise me. |
| J4 | When a source is already a slide, I want to see that rather than wonder where it went, so I go straight to it. |

| # | User-can statement | Jobs |
|---|---|---|
| U1 | A person can narrow the sources to one kind, see how many of each there are, and read what that kind shows and where it leads. | J1, J2 |
| U2 | A person can find a source by its name. | J1 |
| U3 | A person can browse sources by their picture, name and kind, and see whether each is ready, waiting (and why) or already a slide. | J1, J3, J4 |
| U4 | A person can see a source as the home's carousel would show it, with the carousel's settings, before adding it. | J2 |
| U5 | A person can read, before adding, where the slide leads, the words and picture it uses, and, for one that waits, what it needs, with a way to fix it. | J3 |
| U6 | A person can set a page's excerpt as they add it. | J2 |
| U7 | A person can go from a source that's already a slide to that slide. | J4 |
| U8 | A person can do all of it by keyboard, with a screen reader and on a phone, and reload, back and forward keep what they chose. | J1 to J4 |
| U9 | A person can't add a private source or the same source twice. Opening the screen never waits for every source's picture. | J1 |

**Task flow.**

1. **Add slide** (the list) opens the sources step (`?slide=new`, with `&kind=` and `&q=` once a kind or a search is chosen, replacing the history entry rather than adding one).
   - The sources are listed at once, by name, kind and status. Their pictures fill in afterwards: each shimmers until its picture arrives, in their own region (`highlight-sources`). This is a responsive wait, and the screen never waits for it.
   - Ready sources come first, then waiting ones, then those already slides. Within each group the order is chart, page, album, picture, then by name.
2. **Narrow it.** Choosing a kind or typing a name filters in place, at once. The count line says how many are left, and the address keeps the kind and the search. With no match it says so and suggests another name or All.
3. **Choose a source.** A ready or waiting source opens the preview step (`?slide=new&source=<key>`).
   - The preview is the slide drawn by the carousel's own renderers (`HighlightCard`, the embedded `ContributionHero`) with the carousel's settings.
   - The details say what it is, where it leads, the words and picture it uses, and the place it will take.
   - A waiting source still previews when it has a picture; without one, the preview says what's missing. The details give the reason and a link to the screen that fixes it (the page or album editor, the picture's details). Adding it anyway keeps its place until it can show.
   - A page has its excerpt field here.
   - **Back to sources** (or the browser's back) returns with the kind and the search kept.
   - A source that's already a slide is marked "Slide N" and goes to that slide.
4. **Add slide** saves the source, with the excerpt typed for a page, using the file's version, then chooses the new slide (`?slide=<id>`) with the focus on its row.
   - When the carousel is full, both steps say so and Add slide in the list is disabled.
   - A refused save (an excerpt that isn't word for word) says why and keeps the preview and what was typed.

**The UI.**

- The details pane's heading is **Add slide** in both steps, with the same line, so nothing above the content moves between them.
- **The sources step:**
  - a kind filter: one choice per kind, each with its count (All, Charts, Pages, Albums, Pictures), and a line under it on what the chosen kind shows;
  - **Find a source**;
  - a polite count line;
  - a grid of source tiles: the picture whole (3:2), or the kind's icon when there's none; the name; the kind and status line; and a "Slide N" tag on one that's already added.
- **The preview step:**
  - Back to sources;
  - the source's name;
  - the framed preview, with a note that it's drawn with the carousel's settings;
  - the details, led by its Status (Ready to show or Waiting), then Kind, Opens, Words, Picture, Place;
  - the waiting note and its fix link;
  - the excerpt field (a page);
  - Add slide.

The kinds' lines:

- Charts: "A live chart drawn from your public data, with its own controls."
- Pages: "A page's picture and title, with its summary or a line you choose. Opens the page."
- Albums: "An album's cover, title and summary: its arranged cover or one picture. Opens the album."
- Pictures: "One library picture with its caption. Opens it full size."

| # | Assumption | Criterion | Check |
|---|---|---|---|
| A1 | Seeing the slide before adding ends the add, look and remove loop. | The owner adds the slide he meant on the first try. | The owner's review of the flow |
| A2 | Every source's picture (about 180) can fill in after the screen shows, quickly enough to browse. | Pictures appear within 2 s of the step opening with a warm picture cache. | The `editor:swap` measure for `highlight-sources` |

### 2.2 A slide's representative picture

| ID | Intent |
|---|---|
| P2 | The home can represent a page without changing how that page opens. |
| J5 | When a page has no lead picture, or another picture represents it better, I want to choose the slide's picture independently, so the home tells the right story. |
| U10 | A person can use a page's automatic picture without adding a lead picture (J5). |
| U11 | A person can choose or upload a public picture for a page or album slide, and return to automatic selection without changing its source (J5). |
| U12 | A person can set a slide's fill, fit, actual size, tile or stretch, its background (none, automatic or a chosen colour), rounded corners and shadow, for its automatic or its chosen picture, or return to the carousel's settings (J5). |

Automatic page selection checks the wide thumbnail, lead picture and thumbnail in that order, then body pictures in document order: figures, gallery/carousel items, collection item pictures and video posters. It skips missing, non-public and unpublishable candidates and pictures without alt text unless decorative. An album keeps its existing cover rule. No eligible picture means waiting, not a requirement to add a lead picture.

Both Add slide's preview and a saved slide's details offer **Choose picture**, opening the existing on-demand library picker with upload. Choosing changes only the pending slide; closing without choosing changes nothing. **Use automatic** removes a page/album override. A picture-only slide replaces its own picture. The slide's look is always shown under its picture, for the automatic picture and a chosen one alike (owner's request, 26 October 2026): **Picture display** (Fill, Fit, Actual size, Tile, Stretch), **Picture background** (None, Automatic: the picture's edge colour, or Colour, with a colour field), **Round picture corners** and **Show picture shadow**. While the slide follows the carousel, a line says so and the controls show the carousel's values; changing any stores all four explicit values, including `false`. **Use carousel settings** puts the carousel's values back and removes the slide's presentation override. The picture above the controls is the slide's own look, redrawn through the `slide-picture` region as anything changes, on Add slide and on a saved slide. Stretch and a chosen colour are the slide's only: the carousel's settings keep fill, fit, actual and tile with an automatic background on or off, and a chosen colour is the same in both themes. These changes never modify a page, album or image sidecar. Add slide's preview updates through its own `highlight-preview` region, retaining the old preview until the new one is ready and never replacing the pending fields.

Add slide / Save slide commits the choices with the existing versioned transaction and task feedback. A refused save preserves the pending picture, settings and excerpt and names the reason; an upload uses the library's existing progress and retry feedback. Uploaded media is a library item even if the slide is not subsequently saved. Home, preview, pager and usage guards use the same resolved picture. A chosen picture never bypasses a source's publication or placement requirements.

### 2.3 An album's cover as its slide

An album's story is rarely one picture. Its owner already says which pictures lead it, and how, when he arranges its cover (gallery spec §9.6): the band the Albums view shows. An album slide that shows only one of them undersells the album, and choosing that picture repeats work the cover already did. So an album slide can show **the album's cover**, arranged exactly as the album's band draws it, instead of one picture. Promise served (as §2.1's): the classic home leads with what best represents the owner now, told as he chose to tell it.

| # | Job: when I…, I want to…, so I can… |
|---|---|
| J6 | When I put an album on the home, I want its slide to show the album's cover as I arranged it, so the home tells the album's story in the pictures I chose, without choosing them again. |

| # | User-can statement | Jobs |
|---|---|---|
| U13 | A person can choose, for an album slide, between **Album cover** and **One picture**, as they add it and on a saved slide, and see the slide as the home will show it before saving. | J6 |
| U14 | A person sees the cover exactly as the album's band draws it on a wide screen: the same tiles, places, displays, focus points, backgrounds and corners, at every width (scaled, never restacked); and a later change to the cover shows on the home without touching the slide. | J6 |
| U15 | A person can go from the slide to where the cover is arranged, and can switch back to One picture before saving without losing a picture chosen for the slide. | J6 |

**Task flow.**

1. On Add slide's preview of an album, or a saved album slide's details, the **Slide picture** part starts with **Show**: Album cover or One picture. A new album slide starts on One picture, so every slide saved before this change looks as it did.
2. **Album cover** redraws the preview at once with the cover (Add slide's own preview; a saved slide's preview in the part), through the same `highlight-preview` and `slide-picture` regions, keeping the old preview until the new one is ready. The picture's choices (Choose picture, Use automatic and the look) are put away, with a line saying the cover keeps the album's own looks and an **Arrange album cover** link to the album's editor, where Edit cover is.
3. **One picture** brings the picture's choices back as they were, with whatever was chosen still there.
4. **Add slide** or **Save slide** saves the choice through the versioned save. A cover slide stores no picture or look of its own: what it shows is the album's.

**The UI.** Show is a pair of radio cards (ChoiceGroup) above the preview: **Album cover**, "The pictures you arranged in the album's cover"; **One picture**, "Its lead picture, or one you choose". The card on the home is the same `HighlightCard`: its picture becomes the cover's mosaic on the album's grid of square cells, 12 columns at every width, with the album's corners (square when its gallery's pictures are square). It never switches to the album's phone arrangement: that is a long stack meant for scrolling the album's own page (a nine-picture cover is 6 by 28 cells there), and a carousel slide must stay as short as its cover's shape, so on a phone the cover is scaled down whole. Scaled down that far, a picture's own corner would round the small tiles into pills, so on a slide narrower than its split width the tiles take a smaller corner (`c.highlight-card.cover-radius-narrow`). The card keeps the height rule of §4: a cover is as tall as its rows, so on a wide, short screen the card narrows round it. The pager's thumbnail stays the cover's lead picture. The tiles aren't links (the title is the slide's one link); each picture's alternative text is its tile's name.

Usability heuristics: the choice and its effect are seen together before saving (H1, H6); the words are the album editor's own, Album cover and Edit cover (H2, H4); switching back is free before saving (H3); a cover slide can't hold a look that does nothing, and the contract refuses one (H5); the link to arrange the cover answers "how do I change it" where it's asked (H10).

| # | Assumption | Criterion | Check |
|---|---|---|---|
| A3 | An album's arranged cover fits a slide well enough without its own look settings. | The owner keeps the cover on the slides he adds, rather than switching back to one picture. | The owner's review on the home |

### 2.4 Moving between slides: loop and autoplay

The home's highlights are a handful of things the owner wants seen; a visitor who reads the opening and never touches the carousel sees only the first. So on the home the carousel moves on by itself, and comes back round, while every other carousel (an article's) stays still unless its author asks. Promise served (as §2.1's): the classic home leads with what best represents the owner now, and a visitor sees more than one of them without having to look for the controls.

| # | Job: when I…, I want to…, so I can… |
|---|---|
| J7 | When a visitor lands on my home, I want the highlights to show themselves one after another, so they see more of what I've chosen than the first slide. |
| J8 | When I'm reading a slide, I want it to stay put while I read it, and to go on again when I'm done, so the carousel never takes a slide from under me. |
| J9 | When I put a carousel in an article, I want to choose whether it loops or plays by itself, and for how long each slide shows, so it suits what it holds. |

| # | User-can statement | Jobs |
|---|---|---|
| U16 | A visitor sees the home's highlights move on every 4 seconds (or the owner's time), the last followed by the first, and sees the time left in the active dot, drawn out into a pill that fills (on a filmstrip, a bar along the frame shown). | J7 |
| U17 | A visitor can pause and play it by pressing the active pill, which shows a pause sign as the mouse comes to it (a play sign once paused); there's no button of its own. It also holds while the mouse moves over the slides, the active pill turning into a pause sign, and goes on 6 seconds after the mouse was last moved there, the slide getting its whole time again (so 6 plus 4 seconds by default); moving over the controls or off the carousel doesn't hold it. It holds while the page is hidden or it's out of view, and stops for good when keyboard focus comes into it. Under reduced motion it starts paused. | J8 |
| U18 | The owner can turn the loop and autoplay on or off and set the time per slide (2 to 30 seconds) for the home's highlights (on by default) and for each article carousel (off by default). | J9 |

**Task flow.** The settings sit with the carousel's others: Home highlights → Carousel settings, and an article carousel block's Slides pane. **Loop slides** and **Play slides automatically** are switches; **Time per slide** is a slider in seconds (4 by default), disabled while the slides don't play by themselves (its value kept). They save like the other settings, and the preview and the home follow.

**As built.** One rule for every carousel (`Carousel`, `scripts/carousel.ts`, the pure `slideIndex`, `loopOrder`, `autoplayRuns` and `slideSeconds` in `scripts/media.ts`):

- **The active dot is a pill** (`c.carousel.pill`): it draws out from the dot's middle inside its own 44 px target, so no other dot moves, and back again as the next one draws out, a width transition (none under reduced motion).
- **A loop** turns the slides' visual order (CSS `order`, no copies) so the slide shown is in the middle, with neighbours each way, once the track settles; the slides, the dots and the lightbox keep their order in the page. Previous and next never disable.
- **Autoplay** is a clock in the script (an animation can't time it: reduced motion cuts every animation short), drawn by a CSS animation on the pill (`c.carousel.pill-fill`, the accent, over `pill-rest`, the accent's soft wash inside an accent ring, `pill-ring`, so the fill stands at about 7:1 from what's left in both themes) or the filmstrip frame's bar (`c.carousel.progress`) that the same holds pause. Without a loop it stops at the last slide; Play from there starts again at the first. While it plays the counter's announcements are off (`aria-live`), so a screen reader isn't interrupted every few seconds. A dialog open over the page (the lightbox) holds it. **The mouse moving over the slides** (`pointermove` on the track, a real move only: a slide gliding under a still mouse isn't one) holds it as `moving`: the carousel carries `data-moving` and the pill's two halves draw in into a pause sign's bars (`c.carousel.pause-bar`, `pause-height`, `pause-spread`); `MOVING_HOLD_SECONDS` (6) after the last move it lets go, the pill draws out again and the slide's time starts whole. Hovering the controls doesn't hold it. **The pill is the pause control** (the owner's call on 28 October 2026: no Pause slides button of its own beside the pager): the shown slide's dot is named Pause slides or Play slides (the others keep Show slide n) and pressing it stops or plays the slides. The mouse resting on it holds it as `pointing`, showing the pause sign so what a press does is in view, and leaving it gives the slide its whole time again; stopped, the mouse or keyboard focus on it turns it into a play sign (`data-sign`, a clipped triangle in `pause-height`). Reduced motion is read as it changes: turned on while the slides play, they stop. Under forced colours the dots, the pill and its fill take system colours (ButtonText, Highlight over GrayText, the pause sign Highlight).
- **Defaults:** off for a carousel unless asked (`loop`, `autoplay`, `interval` props and the article block's fields); on for the home's highlights unless `content/highlights.json` says `false` (`highlightMotion`).

Usability heuristics: the pill's fill shows how long is left before it moves (H1); Pause slides and Play slides use the words a media player does, and the pill shows the sign of what a press does before it's pressed (H2, H4, H6); the reader can always stop it, and nothing moves while they read or use it (H3); a carousel that doesn't loop says where its ends are (disabled buttons) and one that does never pretends to have them (H5).

| # | Assumption | Criterion | Check |
|---|---|---|---|
| A4 | Moving on by itself shows visitors more highlights without irritating them. | The owner keeps autoplay on after living with it; nobody reports a slide moving while they read. | The owner's review on the home |
| A5 | 4 seconds is long enough to take in a highlight's title and picture. | The owner keeps the default, or the time he picks is the one we change to. | The owner's review |

This amends the visual language's "nothing moves on its own" (§6) for carousels, as the owner asked on 28 October 2026.

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
  "loop": true,
  "autoplay": true,
  "interval": 4,
  "items": [
    { "id": "github", "type": "custom", "custom": "github" }
  ]
}
```

The other item shapes are `{id, type: "article", article, text?, picture?, pictureStyle?}`, `{id, type: "album", album, show?, picture?, pictureStyle?}` and `{id, type: "image", media, pictureStyle?}`. An album's `show: "cover"` shows its arranged cover (§2.3) and can't be combined with `picture` or `pictureStyle`; left out, the slide shows one picture. `picture` is a public image media ID; `pictureStyle` is the slide's own look: `display` (the shared four plus `stretch`), `background` (`true`, `false` or a `#RRGGBB` colour), `rounded` and `shadow`, overriding carousel values only where present. Unknown keys, invalid settings, duplicate IDs/sources and missing/private references fail validation before a save writes bytes.

- A saved page/album pick can wait while its source is a draft or temporarily unplaced; only published, open, public sources render. A page/album without an eligible resolved slide picture is also waiting. Edit mode says why. Republishing/restoring makes it return in the same position. Explicit picture overrides must be eligible even while the carousel is disabled.
- A picture must be from the public library with publishable visibility and alt text (or intentionally decorative). A page/album cover is checked by the same public-media boundary. Dark versions and picture focus/display settings travel with the image.
- Deleting a referenced resource is refused by the content check; the error tells the owner to remove the highlight first. Making it private is likewise refused rather than publishing the reference. Media usage reports include highlighted images.
- No private page identifiers, titles, pictures or excerpts go in public markup. No runtime GitHub data fetching is added.
- If the file is absent, existing sites keep their current opening (GitHub when a snapshot exists; otherwise their usual opening). The owner's initial configuration contains only the existing GitHub slide. Nothing else is selected for him.

## 4. One carousel, not two implementations

The article `Carousel` is extended with a trusted render-function slot, called with each slide's index. Its current image/video path remains the default. The same component owns the slide wrappers, snap track, peek/fade geometry, controls, status, dots, filmstrip and lifecycle script for both uses. A content-level composition resolves and supplies the highlight slides; compounds never import other compounds.

- Looping and autoplay are the article carousel's own (§2.4), on by default here.
- One visible slide: no navigation chrome when only one eligible slide exists. No eligible slides: no empty carousel region.
- Multiple slides: the article carousel's controls and 44 px targets, with a named region and numbered slides. The counter announces navigation.
- Peeked neighbours are hints: choosing one first brings it into view, not through its link. Offscreen slide controls cannot take keyboard focus.
- Left/right changes slides **only when the track itself has focus**. A focused GitHub canvas keeps its own day-navigation keys, and its pointer drag never drags the outer carousel. On touch, vertical page scrolling stays available; a chart's horizontal drag tumbles it, and carousel controls still move between slides.
- The track reserves the height of its tallest slide, avoiding jumps while changing selection. Picture slides use the existing carousel frame limits. Theme, contrast, reduced motion, base paths, lightbox and page-transition cleanup retain existing patterns.
- A content slide is held between the same limits as a picture frame (`c.carousel.slide-min`, 300 px, and `c.carousel.slide-max`, 80% of the screen's height), its content in the middle; what can't fit scrolls inside the slide (the site's overlay scrollbar) rather than stretching the carousel. A highlight card's picture is at most `c.highlight-card.picture-max` (45%) of the screen's height: on a wide, short screen the card narrows round it, so it fits without scrolling. The embedded GitHub chart leaves out its statistic cards where they would stack under it (its slide narrower than 51.5rem), on phones and tablets.
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
| HC10 | Adding is choosing by seeing (§2.1) | Unit cases for the kinds, counts, order, search, chosen source and fix links. Editor E2E: filter and search, preview of each kind with its details, a waiting source's reason and fix link, an added source going to its slide, adding a page with its excerpt from the preview, back keeping the kind and search, reload by address, the first draw without the sources' pictures, and axe in both themes at 360 px. Screenshots of both steps in light and dark |
| HC11 | Independent representative pictures (U10 to U12) | Units for automatic precedence/body order, invalid explicit images even disabled, usage guards, draft/placement gates and style inheritance including false. Fixture E2E for choose/upload on add and edit, save/reopen, return to automatic/inherited settings, exact home picture/style and unchanged source. Affected editor screenshots in both themes |
| HC12 | An album's cover as its slide (U13 to U15) | Units: the `show` contract (refused with a picture or a look), the editor's switch keeping the pending picture, the preview draft. Fixture E2E: choose Album cover on Add slide and on a saved slide, the cover in both previews, save and reopen, the home's card drawing the album's tiles in its order with the album's link, and switching back. HighlightCard's cover story in light and dark at 360, 768 and 1280 |
| HC13 | Loop and autoplay (U16 to U18) | Units: `slideIndex`, `loopOrder`, `autoplayRuns`, `slideSeconds`. Browser: a loop wrapping both ways with the slide shown in the middle, the pill growing in place without moving another dot, autoplay moving on after its time, the mouse moving over the slides holding it (a pause sign) and letting go 6 seconds after it was still, hovering the controls not, the pill as Pause slides and Play slides (its pause and play signs, no button of its own), reduced motion starting paused; the home's defaults from the content; the editor saving and reopening loop, autoplay and the time. Carousel stories in light and dark at 360, 768 and 1280 |

## 6. As-built evidence

Built locally on `feature/home-highlights-carousel`, with independent representative pictures added on `feature/highlight-picture-controls`. The mixed examples are made-up library stories and isolated test fixtures; this extension does not change the owner's content. No push or deployment is authorised.

| Gate | Evidence |
|---|---|
| HC1, HC2 | `highlights.test.ts`, `editorHighlights.test.ts`: all item kinds/options, exact maximum, duplicate IDs/sources, verbatim excerpts, missing/private sources, delete/access transitions, derived media usage, alt text and degraded dev loading. The actual fixture home excludes draft pages/albums, restores them on republish, and hides empty/disabled highlights without bringing back the planet picture. |
| HC3, HC4 | Twelve public browser cases passed across `highlights.spec.ts`, `contributions.spec.ts` and the affected `site.spec.ts` carousel cases. The mixed story uses the existing article carousel; the editor fixture checks repository-resolved lead/cover, exact excerpt, canonical links and the full-image lightbox. |
| HC5 | Rebuilt as list and details on 24 October 2026 ([list and details](../editor/list-and-details.md)): the carousel settings, Add slide and the slides in the list, the chosen one in the details, every action saved on its own. Five `editor-highlights.spec.ts` cases passed on the rebuilt screen: add all four kinds, the excerpt, Move up and Move down with the ends disabled and the focus kept, settings, reopen by address, the two-press remove choosing the slide that took its place, a refused excerpt keeping its words, clean cross-tab updates, dirty input kept through a 409, public resolution, axe in both themes at 360 px. HC11 extends the details to prepare only the chosen slide's representative picture, never the whole library. Add slide's own flow is HC10. |
| HC6 | Existing GitHub touch/tumble and reduced-motion tests passed inside the new home carousel; nested chart keys do not change slides, focused track keys do, and offscreen contents are inert. Axe passes in both themes, with public reflow at 320 px and editor reflow at 390 px. |
| HC7 | The rebuild (24 October 2026) updated, on purpose, the HighlightsManager, RecommendationsManager, AlbumList, ListPane, ListLink and DetailPane story baselines; each was reviewed in both themes. Before it, the four affected visual groups passed during intentional baseline capture. All 38 added/changed images were reviewed: mixed carousel, cards and editor parts in both themes, including phone; only the two home phone baselines changed. Existing carousel examples retained their order and baselines. |
| HC8 | 677 affected unit tests passed; the full Astro type check passed with existing hints only. `build-parity.mjs` passed both production builds, bundle budgets and sealed-output leak checks: 1,465 identical files, matching sealed shapes, only the expected docs difference. Landing eager JavaScript is 16.6 KB gzip; game/gate budgets remain unchanged. |
| HC9 | This page, the content model and editor screen catalogue describe the implementation. No dependency or live service call was added. The work remains local. |
| HC10 | Built on 24 October 2026 (§2.1): SlideSources and SlidePreview parts with stories, the rules pure in `model/highlights.ts` (kinds, counts, order, search, the chosen source, fix links, facts) with unit cases. Six `editor-highlights.spec.ts` cases pass on the new flow, among them: a kind and a search narrowing in place and kept in the address; a preview of each kind (the chart, a page, an album, a picture) with its details; a waiting page's reason and its Edit page link; a page added with its excerpt from the preview; an invented excerpt refused with the preview and its words kept; Back and the browser's back keeping the kind and search; a reload by address; a source that's already a slide going to it; no picture in the step's first HTML; axe in both themes at 360 px on a slide, the sources and a preview. On the owner's content, 179 sources draw at once and their pictures fill in about 0.6 s after the step opens (A2's 2 s met). Dark versions of pictures follow the theme on the tiles. After the design system review: each tile is a link to its preview (or to the slide it already is), named by its name and described by its status line, so it can open in a new tab; a tile focused by Back keeps the focus when the pictures arrive; the kind toggles' focus ring shows in full inside their scroller; a picture that couldn't be drawn says so and how to try again. |
| HC11 | Built on 26 October 2026 (§2.2): 566 affected content, editor and design-system unit cases passed; Astro check reported no errors or warnings. All seven highlight editor E2Es passed, including automatic body-picture selection without a lead, independent selection on Add slide, live preview, per-slide presentation, save/reopen, exact home output, reset and unchanged source bytes. The upload regression adds 41 preceding fixture images, proving selection beyond the first 40-card picker page. After correcting inherited controls' hidden state, the picture workflow and phone accessibility cases passed again. Intentional screenshot capture passed all three affected story groups (HighlightsManager, SlidePreview and SlidePicture); all 53 changed/new images were reviewed in both themes, with enlarged picture-control captures. The design-system scoreboard meets all 18 targets. Extended the same day (the owner's follow-up): the slide's look is always visible for its automatic or chosen picture, with Stretch, a chosen background colour and Use carousel settings; the saved slide's picture previews live. 567 unit cases in the four affected files and Astro check passed; all seven highlight editor E2Es passed, among them Stretch over a chosen colour with square corners and a shadow, checked in both previews, saved, reopened and on the home, a saved slide's live Fit preview, and the reset. Screenshots of the HighlightsManager, SlidePreview and SlidePicture parts and the Image story (its new Stretch example) were captured and reviewed in both themes. |
| HC12 | Built on 28 October 2026 (§2.3): `show: 'cover'` on the album item, refused beside a picture or a look; the card's cover mosaic in `HighlightCard` on the album's band tiles (`bandOf`); the Show choice in SlidePicture with the Arrange album cover link. 606 unit cases in the highlights, editor highlights, site and editor design system and token changelog files passed; Astro check reported no errors or warnings. All eight `editor-highlights.spec.ts` cases passed, the new one choosing Album cover on Add slide (the cover in the preview, the picture's choices put away, the link to the album), adding it (saved with `show` and no picture or look), switching a saved slide to One picture and back with a save and a reload each, and the home's slide drawing the cover's pictures, none a link, with the album's title as its link. Measured in the browser on the owner's nine-picture album: the cover is 366 by 179 px in a 366 px card (it had been a 1,737 px stack before the slide stopped using the phone arrangement). Screenshots: HighlightCard's new cover story at 360, 768 and 1280, and the new SlidePicture and SlidePreview album examples, in both themes, reviewed; the cover's narrow corner was added after the 360 px review showed pill-shaped tiles. The other changed images are the stories renumbered by the inserted examples and the reading-time hourglass of 25 October, which their baselines had missed. |
| HC13 | Built on 28 October 2026 (§2.4): `loop`, `autoplay` and `interval` on `Carousel`, the article carousel block and `content/highlights.json` (on for the home through `highlightMotion`); the pill, its fill and the filmstrip frame's bar; Pause slides and Play slides beside the pager (on 28 October moved onto the active pill, the button removed at the owner's request); Loop slides, Play slides automatically and Time per slide in Home highlights' settings and the article block's Slides pane. 18 cases for the pure rules (`slideIndex`, `loopOrder`, `autoplayRuns`, `slideSeconds`) and 629 in the site and editor design system, highlights, editor highlights, token changelog and deprecation files passed; Astro check reported no errors. Browser: the new site E2E (a loop wrapping both ways with the slide shown centred, the pill widening without moving another dot, its fill, moving on within its time, holding under the mouse, Pause and Play, reduced motion starting paused) and the carousel group's other five cases; the home's highlights read from `content/highlights.json` (slide count, loop and autoplay present); the eight `editor-highlights.spec.ts` cases, one saving loop off, autoplay on and 6 seconds and reading them back. Two faults the checks found were fixed: a `scrollend` left from an earlier glide set the counter back mid-glide (now ignored until the glide asked for arrives), and a peeking track measured its slides 368 px short (it's their offset parent), so a loop opened halfway between two slides. Screenshots: the Carousel stories (three new: looping, playing, playing with a filmstrip), the home pages and Home highlights' settings, in both themes at every width, reviewed; the Album inspector's images were stale from the words for several pictures and were taken again. |

For HC11, deliberately not run: full suites, the performance benchmark, production verification and build parity. No dependency, build or integration changed; affected units, types, fixture E2Es, the visual test build's sealing/leak check and scoped story captures cover this local extension. The earlier HC8 production/parity evidence belongs to the original carousel change, not this extension. The same holds for HC12 and HC13, which add no dependency, build step or integration.

**Height on phones and short screens (27 October 2026, §4).** Measured on the home before: 976 px tall at 360 by 740 (the GitHub slide 916 px with its statistic cards, every card slide stretched to it with its card stuck at the top). After: 540 px at 360 by 740, 530 at 390 by 844, 607 at 768 by 1024, 668 at 1280 by 800, 632 at 1280 by 720, every card centred and none scrolling; a phone on its side (360 px tall) holds the 300 px least and scrolls inside the slide. The site design system, token changelog and deprecation unit tests passed (393). The Carousel and ContributionHero stories and the home page screenshots changed on purpose (18 images, both themes at 360, 768 and 1280) and were reviewed.
