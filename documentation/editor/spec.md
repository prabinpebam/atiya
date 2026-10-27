# Edit mode: a local CMS for the site

A content editor that runs only on your machine, inside the Astro dev server, and edits the site the way Squarespace, Webflow and Framer do: on the page itself, with a settings panel beside it. Everything it saves goes into the JSON files in `content/`. Publishing commits them and pushes, and GitHub Pages builds the site as it does today, with no editor and no backend. This page is the spec (v2: the first sketch, critiqued twice, in §11). The build order and Definition of Done are in the [plan](plan.md), and the investigation behind it is in the [research](research.md).

> **TL;DR.**
> - **Where:** `http://localhost:4321/_edit/`, only while `npm run dev` runs, or the **Edit this page** icon button in the header, beside the colour theme switch, of every page the dev server shows (Edit this section on a section's page). An Astro integration injects the editor's routes and that button for the `dev` command alone, so a build has no trace of it. It answers only loopback requests from its own origin, and no other site can frame it.
> - **What you can edit:**
>   - **Articles and pages:** create, duplicate, delete and change their status.
>   - **Their blocks:** on a canvas that is the real page.
>   - **Their settings:** in an inspector beside the canvas.
>   - **The site's sections and the planet's buildings:** the sections listed beside the chosen one's pages and settings (two tabs); pages are dragged onto another section, or moved with Move.
>   - **Everything else:** a media library with uploads, alt text and focus points; the site settings and the owner's profile.
> - **How it feels:**
>   - **Text:** click a paragraph, heading, quote, the title or the standfirst and type. Enter makes a new paragraph.
>   - **Blocks:** a "+" between blocks adds one from a palette of the content model's blocks. A toolbar on the selected block moves, duplicates or deletes it.
>   - **Order and look:** an outline beside the canvas reorders blocks by drag or keyboard. A block's look is limited to the choices the design system offers (its width, a gallery's layout), so no edit can break the design.
> - **Saving:** every change is written as soon as it's made, after the same contract check the build runs, as one transaction: a change the contract refuses, or one that conflicts with an edit made elsewhere, never reaches a file. The top bar always says whether it's saved, and every open tab shows a change the moment it's saved (§2.1). Undo and redo cover the whole document, and git is the version history.
> - **Optimistic edits** (§3.6, built 13 October 2026): a move, a removal, a copy or a new block shows in the outline, the inspector and the canvas at once, the server's redraw only confirming it; a refused change is put back with the reason.
> - **Never a silent wait** (§2.2, built 13 October 2026): every wait shows a sign where it happens (a busy button, a pending row, a region or the canvas updating, the picker filling, a screen opening) as well as in the status line, through one task tracker.
> - **Pages move freely:** a page's slug, section and status can change at any time, published or not. Its address follows, and the old one simply goes, with no redirect (the owner's call). Only a draft can be deleted.
> - **Publishing:** Save to remote lists what changed in `content/`, checks it all, commits just those files (or only the ones you tick) and pushes. From a page editor it opens as a dismissible modal and keeps running after the modal closes; the top bar keeps showing its progress and result. Discard puts a file back as it was last saved to remote.
> - **Built from the design system:** the editor's screens are Astro pages made of the site's own tokens, fundamentals and compounds, with two new generic compounds (Dialog, Tabs). Client scripts only coordinate; the page and every form are rendered by the server.

<figure class="slate-figure" data-diagram="editor">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 470" role="img" aria-labelledby="ed-arch__title ed-arch__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-arch__title">Edit mode: from the local editor to GitHub Pages</title>
<desc id="ed-arch__desc">On the owner's machine, the browser opens edit mode at localhost. Its pages and its canvas (the real page, rendered by the dev server) call the editor API, which exists only in the dev server and only answers loopback requests from its own origin. Every write is checked against the content contract before it reaches the files in content/. Publishing commits the content folder and pushes it; GitHub Actions builds the static site, which has no editor in it, and deploys it to GitHub Pages.</desc>
<g id="ed-arch__browser" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-arch__body-1" x="40" y="40" width="250" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-arch__body-1" data-slate-fit-padding="16">Edit mode</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-arch__body-1" data-slate-fit-padding="16">the browser, at localhost</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-arch__body-1" data-slate-fit-padding="16">Screens and inspector</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-arch__body-1" data-slate-fit-padding="16">Canvas: the real page</text>
</g>
<g id="ed-arch__api" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-arch__body-2" x="370" y="40" width="250" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="390" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-arch__body-2" data-slate-fit-padding="16">Editor API</text>
<text x="390" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-arch__body-2" data-slate-fit-padding="16">dev server only, loopback only</text>
<text x="390" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-arch__body-2" data-slate-fit-padding="16">Checks the contract</text>
<text x="390" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-arch__body-2" data-slate-fit-padding="16">Writes atomically</text>
</g>
<g id="ed-arch__files" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-arch__body-3" x="700" y="40" width="260" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="720" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-arch__body-3" data-slate-fit-padding="16">content/</text>
<text x="720" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-arch__body-3" data-slate-fit-padding="16">JSON and media masters</text>
<text x="720" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-arch__body-3" data-slate-fit-padding="16">Articles, sections, media</text>
<text x="720" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-arch__body-3" data-slate-fit-padding="16">Site settings, people</text>
</g>
<g id="ed-arch__publish" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-arch__body-4" x="700" y="270" width="260" height="70" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="720" y="300" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-arch__body-4" data-slate-fit-padding="16">Publish</text>
<text x="720" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-arch__body-4" data-slate-fit-padding="16">git commit content/, then push</text>
</g>
<g id="ed-arch__build" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-arch__body-5" x="370" y="270" width="250" height="70" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="390" y="300" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-arch__body-5" data-slate-fit-padding="16">GitHub Actions</text>
<text x="390" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-arch__body-5" data-slate-fit-padding="16">astro build: no editor in it</text>
</g>
<g id="ed-arch__pages" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ed-arch__body-6" x="40" y="270" width="250" height="70" rx="16" fill="var(--color-brand-bg)" />
<text x="60" y="300" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ed-arch__body-6" data-slate-fit-padding="16">GitHub Pages</text>
<text x="60" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ed-arch__body-6" data-slate-fit-padding="16">the static site</text>
</g>
<text x="300" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">API calls</text>
<text x="630" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">valid writes</text>
<text x="840" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">when ready</text>
<text x="640" y="296" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">push</text>
<text x="300" y="296" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">deploy</text>
<text x="60" y="410" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">A write the contract refuses never reaches a file. Nothing on this side of the build exists in production.</text>
<g id="ed-arch__flow-1" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M290 115 L360 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="369,115 360,120 360,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-arch__flow-2" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M620 115 L690 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="699,115 690,120 690,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-arch__flow-3" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M830 190 L830 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="830,269 835,260 825,260" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-arch__flow-4" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M700 305 L630 305" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="621,305 630,310 630,300" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-arch__flow-5" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M370 305 L300 305" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="291,305 300,310 300,300" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Edit mode lives on the left, inside the dev server: its API checks every write against the content contract before it reaches content/. Publishing is a git commit and push; the build that GitHub Actions runs has no editor in it.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The parts, as a table</summary>

| Part | Where it runs | What it does |
|---|---|---|
| Edit mode | The browser, at `localhost` | Screens, the canvas (the real page), the inspector |
| Editor API | The Astro dev server, only for `astro dev` | Checks the contract; writes `content/` atomically |
| `content/` | The repository | The mock API: articles, the site structure, media, settings, people |
| Publish | The dev server, calling git | Commits `content/` only, then pushes |
| GitHub Actions and Pages | GitHub | Builds the static site (no editor) and serves it |

</details>

## 1. Goals and boundaries

**Goals**
- **G1: edit on the page.** Text is edited where it's read; blocks are added, moved and removed on the page; every other setting is one click away in the inspector. What you see is the page as it renders, at desktop, tablet or phone width, in light or dark.
- **G2: the content is the files.** Every edit lands in the JSON the site is built from ([content model](../content/model.md)). There is no database, no editor-only copy and no export step.
- **G3: never break the site.** Every write passes the same contract and references check as the build. The editor only offers what the content model allows, so a block's look comes from the design system and a page can't be designed into something it isn't.
- **G4: local only.** Nothing of the editor ships. It exists only in the dev server, answers only its own origin on the loopback address, and the production build proves its absence.
- **G5: publish without a backend.** Publishing is a git commit and push of `content/`; GitHub Actions and Pages do the rest, as today.
- **G6: one design system.** The editor is built from the site's tokens, fundamentals and compounds, held to the same rules and tests. What it needs that the design system lacks is added to the design system, with stories.

**Not in this version**
- Designing: new layouts, colours, fonts or free positioning. Those belong to the design system and its code.
- Adding, removing or moving the planet's buildings: they're the game's ([sections spec §5.1](../sections/spec.md#51-buildings-are-fixed-whats-in-them-is-content)). What each holds is edited on the Planet screen.
- Menus beyond the header's navigation: the footer's links and the header's action stay in code. The navigation itself is `menus.primary`, edited on the Navigation screen ([sections spec §4](../sections/spec.md#4-the-top-navigation-u2-u4-u5)).
- Several people at once, roles and permissions, scheduled publishing and comments: there is one owner, and git is the history.
- Video hosting: a video file is the site's own (under 100 MB, [media §12](../content/media.md#12-video-files)); a long one is better as a YouTube or Vimeo embed. Captions files (WebVTT) aren't uploaded yet.

## 2. The screens

Every screen that manages a collection (Sections, Recommendations, Access, Albums, Home highlights, and any new one) is **list and details**: the collection's list beside the chosen item's details, built from the shared pieces, its choice in the address and each action saved on its own ([list and details](list-and-details.md)). A screen that edits one object, or works on a canvas or a grid of pictures, is the exception.

| Screen | Path | What it's for |
|---|---|---|
| Dashboard | `/_edit/` | What's in draft, what changed since the last publish, what needs attention (missing alt text, unplaced articles), and the quick actions |
| Pages | `/_edit/articles/` | Every page of every kind (Article, Page, Album), open and private together, with its kind, section, status and last update; search and filters (status, kind, who can see it); new, duplicate and delete. An album opens on its Items view (§4.1); its Up front view is the arranger. The redesign moves albums to an Albums screen and an album editor of their own ([the gallery spec §9](../gallery/spec.md#9-edit-mode)) |
| Article editor | `/_edit/articles/<id>/` | The canvas, the outline and the inspector (§3) |
| Sections | `/_edit/sections/` | The site structure: sections, what each holds and in what order, each one's view and whether it's in the navigation; pages not yet on the site (§5) |
| Planet | `/_edit/planet/` | The planet's seven buildings: each one's words, view and section on the site, its pages in order, and the pages not on the planet ([sections spec §7.4](../sections/spec.md#74-planet-new-screen-u12)) |
| Navigation | `/_edit/navigation/` | The top navigation: a preview of the header, its entries in order (sections, pages, custom links), their labels, and adding, moving and removing them ([sections spec §7.3](../sections/spec.md#73-navigation-new-screen-u5)) |
| Media | `/_edit/media/` | The media library: upload, alt text, captions, credits, focus points, where each picture is used (§6) |
| Recommendations | `/_edit/recommendations/` | What people say about the owner: add, edit (with a photo uploaded, or taken once from a public LinkedIn profile), hide, order and delete them, and where and how a section shows them ([recommendations](../sections/recommendations.md) §4) |
| Home highlights | `/_edit/highlights/` | The classic home's featured carousel, as list and details (Carousel settings, then the slides): show/hide, name, add and reorder a trusted custom chart, pages with excerpts, albums and library pictures; choose the article carousel's peek, buttons, pager and picture presentation. Saves `content/highlights.json` through the versioned store, preserves dirty input on conflicts, and reports sources waiting for publication or a picture ([highlights spec](../home-views/highlights.md)) |
| Settings | `/_edit/settings/` | The site settings and the owner's profile |
| Ways to explore | `/_edit/ways/` | Which ways of exploring the site are on (the little planet), and what the home page offers first; turning one off keeps its map, and turning the planet on for a site that never had it writes a starting map ([desktop plan, stage 8A](../desktop/plan.md#stage-8a-ways-to-explore-on-and-off-the-next-set)). The Planet screen shows only while the planet is on |
| Theme | `/_edit/theme/` | The themes panel ([theming](../site-ui/theming.md) §8): the live site beside it, every change shown on it at once and on every page navigated to; presets read only, Save as new, Save, Apply, Revert, Rename, Delete; colours from a palette, one accent, a picture or one by one; fonts, an imported font, the type ramp, spacing and corners. In Atiya Studio it docks beside the app's own view of the site |
| Access | `/_edit/access/` | Every access code and magic link that opens private pages, grouped by state beside the chosen one's details: made, changed, withdrawn and deleted there ([access spec §8.1](../access/spec.md#81-sharing-the-access-screen)) |
| Save to remote | `/_edit/publish/` | What changed in `content/` and `private-pages/`, the contract check, discard and saving to remote (§7) |

A private page ([access spec §2](../access/spec.md#2-private-pages)) is a page like any other: it's listed, filtered, moved and edited on these screens, tagged Private, and there's no screen of its own. Who it's shared with (the access codes and magic links) is the Access screen's.

Every screen shares one frame: a side navigation to the screens, and a top bar with the screen's title, the save status and the number of unpublished changes (linking to Publish). A screen's content stops at the wide measure (`--size-wide`); on a wider window the space beside it carries a watermark of every icon edit mode uses, on a grid, each sized by low-frequency Perlin noise so the large ones gather in soft clouds that thin to dots, in the text colour at the `c.editor.pattern-opacity` strength (so it suits both themes), fading in from the content's edge (`components/IconPattern.astro`, the cells pure in `model/iconPattern.ts`, drawn on idle by `scripts/iconPattern.ts` in a few milliseconds, `editor:icon-pattern`). It's decorative: hidden from assistive technology, never in the article editor's studio, and gone in forced colours. To the content model a page is an article whose `kind` is `page` (About, Contact; [model §3](../content/model.md#3-content-item-types)), so pages are listed with the rest and filtered by kind.

### 2.1 Saved, and live

Edit mode always says what's become of a change, and every open page shows a change the moment it's saved.
- **The save status** (`components/SaveStatus.astro`, driven by `saveStatus` in `scripts/client.ts`, words in the pure `model/status.ts`) is in the top bar of every screen, in one of these states:

  | State | Mark | Line |
  |---|---|---|
  | Nothing changed since the screen opened | check | All changes saved |
  | Typed in and not saved yet (the article's text before it's sent, a form before its Save) | pencil, on a tinted pill | Unsaved changes |
  | A save under way | spinner | Saving… |
  | Saved | check, in green | Saved, or what was saved ("Saved the details of lettering"), and how long ago ("just now", "3 min ago", then the time) |
  | Refused | warning, on a red pill | Not saved, and why |
  | The dev server isn't answering (its socket dropped) | warning, on a red pill | Offline: nothing saves |

  A moment's note (Moved, Uploaded, Updated from another tab) has the line for a few seconds (a problem for longer) while the mark keeps the save state. A screen that reloads after its save (Sections, Navigation, Planet) carries the saved state to the page it loads. Leaving a screen with unsaved changes, or while a save is under way, asks first (not the editor's own reload after a save). The line is a live region.

  A refused change's words come from one rule, `refused(reply, happened)` in `scripts/client.ts` (pure: `refusal` in `model/feedback.ts`): what the check found wrong, or else what happened and how to put it right ("The album wasn't saved. Try again."). No script joins the issues itself (`tests/unit/editorRefusal.test.ts`).
- **Every change reaches every open page** (§8.4): the server pushes each change, with the editor tab that made it, to every page the dev server shows.
  - A **page of the site** reloads once the changes settle (typing saves about once a second), so an open article shows a caption saved in Media at once.
  - The **article editor** takes in a change to its own article from another tab or from disk at once (the outline, the inspector, the canvas and the versions it saves against) when nothing here is unsaved; with unsaved typing, it stops its saves and shows the conflict (§8.3), so nothing is lost or written over. Anything else it shows (a picture's caption, the sections, a page it links to) comes in once the typing stops.
  - **Every other screen** draws itself again (its `screen` region). With unsaved input, a text field in use or a dialog open, it keeps what's being typed, says it's behind, and catches up once that's saved, put away or left.
  - A tab's own saves come back to it as its own (the `X-Editor-Tab` header), and a page drawn after a change (one that reloaded after its save) knows it has it already (the content generation), so neither is told twice.

### 2.2 Never a silent wait: progress where it happens

> **Status: built 13 October 2026, with §3.6** (what was built, and what's still to come, is in "As built" at the end of this section). The classes of wait and their research are in [perceived performance](../engineering/perceived-performance.md); the measured waits are in [the performance report](../engineering/performance-report.md).

**The rule.** From the moment the person acts until the work is done or has failed, something visible says that it's working, **at the place the work affects**, and the status line says **what** it is. Never a state where something is processing and the person can't tell. The status line alone isn't enough: before this, a save showed "Saved" in the top bar while the outline, the inspector or the canvas was still being drawn again for 2 to 4 seconds with no sign of it, and a screen could take 2 seconds to open with nothing but the browser's own spinner.

#### Two layers, always both

| Layer | Where | Says |
|---|---|---|
| **Inline** | On the thing itself: the button pressed, the field committed, the row moved, the card saved, the region or canvas being drawn again, the dialog doing the work | That this is working, and, for a long wait, how far along |
| **Global** | The top bar's status line (§2.1), a polite live region | What is happening, in words ("Saving…", "Updating the canvas…", "Uploading lettering.png: 12 of 34 MB"), and how many tasks run when there's more than one ("Saving · 2 tasks") |

#### When each sign shows

| From the action | Inline | Global |
|---|---|---|
| **At once** (under 100 ms) | The acknowledgement: the control's pressed or busy state, or the optimistic result itself (§3.6) | "Saving…" or the task's name |
| **After 300 ms**, if still working | The indicator for its kind (below); shown for at least 500 ms once shown, so nothing flickers | The same |
| **After 3 s** | What it's doing and how long it's taken ("Drawing the canvas · 4 s") | The same, with the elapsed time |
| **After 10 s** | Determinate progress or named steps, and Cancel or Keep working (the task moves to the status line and the screen stays usable) | The task's steps and progress |
| **Done** | Where nothing else shows the result: a check with "Saved" (or the verb done) that fades after 2 s | "Saved", or what was done, and how long ago |
| **Failed** | The reason at the place, with what to do (Try again, Undo), kept until it's fixed or dismissed; the person's input is kept | "Not saved", and why |

An action that finishes in under 300 ms shows only its acknowledgement and its result: no indicator flashes.

#### The inline signs

Each is built from the design system's own fundamentals (`Spinner`, `Skeleton`, `Progress`, and Button's `loading` state), so it looks and reads the same everywhere.

| Sign | For | How it shows |
|---|---|---|
| **Busy button** | Any button that starts work: Save the details, Add it, Upload it, Crop, Delete, Save to remote, Try again | Its icon becomes a spinner, its label the work under way ("Saving the details…"), its width unchanged (no layout shift), and it can't be pressed twice; `aria-busy`. Then a brief "Saved" check, then its label again |
| **Field state** | A field in the inspector, Settings, a section's or a building's settings, committed on change | A small spinner and "Saving…" in the field's hint row; then "Saved" with a check that fades; a refusal is the field's error, as today |
| **Pending row or card** | A block's row in the outline, a page's row in Sections, a picture's card in Media, a grant in Access, while its change saves | A small spinner at the row's end, and the row's accessible description says "Saving"; a failure turns it into a warning mark with the reason and Try again |
| **Region updating** | A region drawn again from the server: the inspector, a screen after a change elsewhere, a picture's details, Save to remote's list | Its content stays (stale while updating) with a thin indeterminate progress line along its top edge and `aria-busy`; it's dimmed only when it can't be used meanwhile |
| **Canvas updating** | The canvas drawn again (double-buffered, §3.6) | An "Updating the canvas…" pill with a spinner at the canvas's top edge, in the editor's chrome (never inside the page); the old canvas stays usable until the new one replaces it |
| **Arriving block** | A new block the canvas hasn't drawn yet (§3.6) | A placeholder of the block's likely size, shimmering (`Skeleton`), named ("Adding a picture…"); a still placeholder with reduced motion |
| **Pictures loading** | Thumbnails in Media and the picker, pictures in the canvas | Their shimmer (already built, `scripts/pictures.ts`); the picker's first open of many pictures also says "Preparing pictures: 12 of 105" |
| **Screen opening** | A screen that hasn't answered within 300 ms | A thin progress line under the top bar, the clicked item in the side navigation marked busy, and, past 1 s, the screen's skeleton (its real layout, grey) |
| **Long task** | Uploads, crops, a dark version, Replace, Delete with pictures, Save to remote, Discard | In its form or dialog: a `Progress` bar (bytes for an upload, from the browser's upload progress), then named steps with a check as each ends ("Uploading · Making the master · Saving"), and the elapsed time. Closing the dialog doesn't hide it: the task carries on in the status line with its progress, and its result is announced |
| **Background check** | The counts of changes to save to remote, refreshed after a save or when the window comes back | The count shows a small spinner while it's checked; "Changes not checked" if git can't say |
| **First start** | The first screen after the dev server starts | A plain page at once: "Starting edit mode: compiling the screen", then "Preparing pictures: 40 of 118", then the screen |

#### Every operation, and its signs

| Operation | Inline | Status line | Done | Failed |
|---|---|---|---|---|
| Typing in the canvas | The words themselves; the outline row's words (§3.6) | Unsaved changes, then Saving… | Saved, and when | Not saved, why; the words stay |
| A field in the inspector | Field state | Saving… | The field's check; Saved | The field's error |
| Move, delete, duplicate a block | The optimistic result (§3.6); the moved row pending | Saving… | Saved | The change put back, the reason |
| A new block | The arriving block; its row pending | Saving…, then Updating the canvas… | The block drawn | The block removed, the reason |
| A setting the canvas redraws | Canvas updating | Updating the canvas… | The new canvas | The old canvas kept, the reason |
| Open the picker | The pictures' shimmer; past 1 s, "Preparing pictures" | The same | The grid | "Couldn't load the pictures", Try again |
| Upload a picture or a video | Long task in the form | Uploading name: bytes | Uploaded name; it opens | The reason; the file and the alt text kept |
| Crop, Replace, a dark version | Long task in the dialog or form | Its steps | The new picture shown | The reason; the original unchanged |
| Open a picture's details | The card current at once; region updating | Showing name… (past 300 ms) | The details | The reason, Try again |
| Save a picture's details | Busy button; its card pending | Saving… | The button's check; Saved | The field's error |
| Delete a picture or a page | Busy button | Deleting name… | Deleted; the list without it | The reason |
| New page, Duplicate | Busy button in the dialog | Creating… | It opens | The reason; the dialog kept |
| Sections, Navigation, Planet: move, reorder, save | The row pending; busy button | Saving… | Saved, with what moved | The reason; the list as it was |
| Settings, Access: save, withdraw, delete | Busy button; field state | Saving… | Saved | The field's error |
| Save to remote | Long task: "Checking · Committing · Pushing", each with a check | The same, also once the dialog is closed | Saved to remote, with the commit | The step that failed, why, and Push again |
| Discard | Busy button on the row | Discarding name… | The row gone | The reason |
| Open a screen | Screen opening | The screen's name past 1 s | The screen | "Couldn't open it", Try again |
| A change from another tab or the disk | Region updating, in the regions it changes | Updating with a change made in another tab… | Updated | (nothing lost; it says it's behind) |
| The first screen after a start | First start | Starting edit mode… | The screen | What failed in the dev server |

#### Rules for building it

- **One tracker.** Every wait goes through one small task tracker in `scripts/client.ts` (start, step, progress, done, failed), which drives both layers: the status line, and the inline sign on the element it names (a `data-busy` attribute that the element's component styles). Nothing starts work without starting a task.
- **Signs belong to their components.** A button's busy state is Button's `loading`; a row's pending spinner is its list's (Outline, SectionManager, MediaGrid, AccessManager); the canvas pill is the canvas frame's; the screen's progress line is the layout's. Their sizes are `c.editor` tokens, including the 300 ms delay and the 500 ms minimum (one source for the timings).
- **Accessible.** The status line announces a wait's start only if it passes 1 s, and its end; inline spinners are hidden from assistive technology, their words carried by the status line and the element's `aria-busy` and description; reduced motion turns spinners and shimmers into still marks with words.
- **Measured and tested.** The benchmark adds `feedback-shown`, from the action to its first visible sign, targeted at under 100 ms for every interaction it measures. An E2E group, "no silent wait", delays the API by 2 s and checks that each operation in the table above shows its inline sign within 400 ms and its words in the status line, and that each sign goes once the work ends.

#### Decision taken

**The done check** is shown only where nothing else shows the result (a button that saved a form says "Saved" for 2 s); where the result is visible (a moved row, the details drawn again), the status line alone says it. The owner can still ask for more.

#### As built (13 October 2026)

- **The tracker** is `startTask(label, { el, quiet, line, busyLabel })` in [`scripts/client.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/client.ts), with `track()` around a promise. An element it names gets `aria-busy` and `data-busy="ack"` at once, `data-busy="on"` past the delay, `data-busy="done"` for a done check; past 3 s its `data-busy-text` and the status line add the elapsed time. The status line's words come from the pure [`model/feedback.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/model/feedback.ts) (`taskLine`), and its own polite region is written only past 1 s ([SaveStatus](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/components/SaveStatus.astro)). `swapRegions` starts a task for the regions it draws (quiet when it only confirms, §3.6).
- **The timings** are `c.editor` tokens: `feedback-delay` 300 ms, `feedback-min` 500 ms, `feedback-elapsed` 3 s, `feedback-done` 2 s.
- **Signs built:** Button's spinner replaces its icon past the delay, keeping its width (a script's `data-busy="ack"` holds it back); the outline's rows (a small spinner at the end); the regions drawn again (a line along the top: the inspector, Media's grid and details, Settings, Access, a page's Share dialog, and the layout's screen region); the canvas pill ([CanvasFrame](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/components/CanvasFrame.astro)); the arriving block (§3.6); the picker filling ("Preparing pictures: 40 of 105", a `Progress`); a screen opening (a line under the top bar past the delay, the layout's skeleton past 1 s); the counts checked ("Checking changes…" with a spinner, and a small spinner while they're read again); the first start (§8.4).
- **Still to come:** the field state in the inspector's hint row and a long task's named steps with an elapsed time in uploads, crops and Save to remote (they keep their own progress and words today); a pending row on the Sections, Navigation, Planet and Access screens.
- **Tested** by the E2E group "editor: no silent wait" in [`tests/e2e/editor-perf.spec.ts`](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/editor-perf.spec.ts) (the API held back by 2 s) and the unit tests in `tests/unit/editorPerf.test.ts`; the benchmark's `feedback-shown` takes the first visible sign of a move, a delete, a new block and opening a picture's details.

## 3. The article editor

```text
+----------------------------------------------------------------------------------------+
| < Articles | Do what makes you proud [Published] Saved | Undo Redo | Desktop Tablet Phone |
|            |                                           | Light/Dark | Preview | Publish   |
+---------------+-----------------------------------------------------+------------------+
| Outline       |                                                     | [Block] [Page]   |
|   Collection  |      the canvas: the article as it renders          |                  |
|   Heading 2   |      at the chosen width                            |  the selected    |
|   Paragraph   |                                                     |  block's         |
|   Gallery     |      click to select, type to edit,                 |  settings, or    |
|   ...         |      "+" between blocks to add one                  |  the page's      |
| + Add block   |                                                     |                  |
+---------------+-----------------------------------------------------+------------------+
```

### 3.1 The canvas

- **It's the real page.** The canvas is an iframe showing `/_edit/canvas/articles/<id>/`, which renders the article with the same layout, components and pictures as its public route. It renders drafts too. Its DOM is the production DOM: nothing wraps a block, so every spacing rule applies as it will on the site. It leaves out only the site's header and the breadcrumbs above the title, whose links lead nowhere in the canvas (the page's article, its way on and its footer stay). Before each block the canvas route writes an HTML comment (`<!--editor-block:3-->`), which no selector sees, and the canvas finds each block's elements between two of them. Every block renders exactly one element: a text block is one paragraph or one list (§9).
- **Selecting.** Hovering a block outlines it and names its kind; clicking selects it (a firm outline, its toolbar, its settings in the inspector, its row in the outline). The title and the standfirst select as the page's own fields. Links, the lightbox, carousels and the video facade are inert while editing; the Preview toggle in the top bar turns the overlays off and the page back on. The article minimap is the exception: it's the page's way round, not its content, so it works as on the site (a row jumps to its place, by click or by its keys, and selects nothing), wherever the canvas is wide enough to show it.
- **The block toolbar** sits on the selected block's top edge: the block's kind, then Move up, Move down, Turn into (text and collections), Duplicate and Delete (a new block goes in with the `+` between blocks, or the outline's Add a block). Each is a square icon button with rounded corners and its name as a tooltip, and the kind's label is as tall as the buttons.
- **Adding.** In the vertical space between two blocks, and only while the pointer is inside the main reading column, a "+" appears on an accent line across that column (never over a block, so it does not come up while you read or select one). It marks exactly where the new block will go and opens the block palette (§3.4). It disappears as soon as the pointer leaves the gap or column, the page scrolls or resizes, the writer selects something, or an insertion starts, so a layout change never leaves it at stale coordinates. It never sits under the block toolbar: where the toolbar covers the middle of the line, the "+" moves to the line's start, just outside the column when there is room (clear of the words), else just inside it.
- **Width and theme.** The top bar switches the canvas between desktop, tablet and phone widths. The colour theme (match the system, light or dark) is the site's own choice, set by the switch in edit mode's top bar on every screen: it changes the whole of edit mode, and the canvas follows, as every open page of the site does.

Tables use the portfolio-sized [inline table editor](./table-editing.md): every heading and body cell is one-line rich text edited directly in the canvas. `Tab` moves across cells, `Enter` moves down and appends at the end, hovering near a border between cells inserts at that exact column or row boundary, and right click opens the custom structural-action menu. Caption, width, row-heading semantics and the collapsed **Bulk edit table** fallback remain in the inspector.

### 3.2 Editing text on the page

Paragraphs (text blocks), headings, quotes, the title and the standfirst are edited in place.

| Key | While editing text |
|---|---|
| Ctrl or Cmd + B, I | Bold, italic |
| Ctrl or Cmd + Shift + X | Strikethrough |
| Ctrl or Cmd + ], [ | In a list: the item one level in (an item of a list inside the one above), or back out; three levels at most |
| Ctrl or Cmd + K | Link: a small dialog for the address (https, http, mailto) or another article (a `ref:` link) |
| Enter | In a paragraph, a heading or a subheading: a new paragraph (a new text block) after it, split at the caret (at the end, an empty one, ready to type; a new heading's words are kept first). In a list: a new item, taking the words after the caret; on an empty last item, the list ends and a new paragraph starts after it |
| Ctrl or Cmd + Enter | A new paragraph after the block, its words kept whole: the way out of a list from any item |
| Shift + Enter | A line break (the poem); in a heading or a subheading too, where it's kept as a new line of its text |
| Backspace at the start | Joins the paragraph to the one before it |
| Escape | Stops editing; the block stays selected |

- **A format bar** appears over a text selection with the inspector's rich field's tools, in the same three groups: Bold, Italic, Strikethrough; Code, Link; Bulleted list and Numbered list (which turn the block into that list, or a list back into a paragraph), and in a list Indent less and Indent more. The marks and the block's list show pressed. When the bar is wider than the page (a phone's width, a list's indents), the least used tools (the indents, then Code, Strikethrough and Numbered list) move under More formatting (⋯), in the bar's own order; Escape closes it. The bar stays inside the page over the selection. Inline code has no shortcut on the canvas: the browsers keep Ctrl+E and Ctrl+Shift+C for themselves.
- **Paste keeps the formatting the site has.** A paste becomes the closest blocks and marks the site supports, whether it comes as a rich copy or as Markdown; what the site can't show (colours, fonts, sizes, underline) never comes in, and a copied picture on its own goes to the upload form (§6). The canvas handles `beforeinput` and reads the clipboard itself:
  - **A rich copy** (a web page, Word, Google Docs, a chat, another page of the site) is read from its HTML: H1 and H2 a heading 2 (the title is the page's one H1), H3 a heading 3, H4 to H6 a heading 4; paragraphs with their bold, italic, code and links, whether written as elements (`b`, `strong`, `i`, `em`, `code`) or as styles (a bold `font-weight`, an italic `font-style`, a monospaced font, as Docs and Word write them; Docs' outer `<b style="font-weight:normal">` isn't bold); bulleted and numbered lists, Word's list paragraphs among them, a nested list's items joining their parent list (the site's lists are one level); a quote's words; a rule a divider; a preformatted block its lines as code; and a table of two rows and two columns or more a table block (its first row the column headings, short rows filled, a cell's line breaks spaces), a single row (a layout's) a paragraph with its cells side by side. A copy from a code editor (all of it monospaced or preformatted, as VS Code copies) is left to its plain text, so Markdown copied from one arrives as Markdown. Prose that keeps its white space (`pre-wrap`, as chats and mail write it) isn't code: its line ends become line breaks and its links and marks stay. A link copied from the canvas keeps what was written, a site page's `ref:` too.
  - **Plain text** is read as the site's Markdown (from a `.md` file, a note or a chat): `#` and `##` a heading 2, `###` a heading 3, `####` and beyond a heading 4, each keeping only its words (`### **Challenge**` is "Challenge"); `-`, `*`, `+` and `1.` lines a list; `>` lines a quote, whose last line becomes its source when it starts with a dash; `---` a divider; a fenced block its lines as code; and every other paragraph one text block, its hard-wrapped lines joined and its bold, italic, code and links kept.
  - **Where it lands.** In a paragraph, anything more than plain words arrives as the blocks it describes, at the caret: the words before the caret join the first pasted paragraph, and the words after it the last, a space at the caret kept. In a list, each pasted line (a paragraph, a list item, a heading's words) becomes an item with its marks, the first joining the words before the caret and the last those after it. Plain words are typed in place; in a heading, a quote or a caption, only the words come in, marks off (they hold no marks). Pictures are left out (the announcement says so: they come from the media library), and a link the site can't follow (not https, http or mailto) keeps only its words. Pairs of a heading and its words, pasted, turn into a collection in one step (Turn into, below).
  - The rules are pure and unit-tested: `model/richPaste.ts` (HTML to blocks) and `model/paste.ts` (Markdown to blocks, placing them, the words and lines of a paste).
- **What's stored** is the Markdown subset ([model §6](../content/model.md#6-blocks)). One parser turns it into an inline tree (text, bold, italic, strikethrough, code, link, line break) and its lists into trees (a list can hold a list in an item, to three levels), which render it on the site; the canvas turns the edited text back into the same tree, and one serializer writes it as Markdown, escaping everything else, so what you type is what renders. Bold, italic and strikethrough may nest; code holds plain text only; links hold text and those marks, and never another link. A space the browser leaves inside a mark (`<b>bold </b>next`) is written outside it, so words never run together.
- **Typing in another script** (an input method) is never interrupted: no shortcut, save or split runs while a composition is open, and the text saves when it ends.
- **The drop cap** (a paragraph's own setting) is visually paused only while its paragraph is actively being edited, because its enlarged first letter moves the caret; the paragraph keeps its drop-cap state, the others stay drawn, and its cap returns as soon as focus leaves the canvas or Preview without the editor is turned on.
- **Saving** happens 800 ms after typing stops, on leaving the block, and on Ctrl or Cmd + S. Saves go through one queue per document, so two never race; text saves don't reload the canvas, so the caret stays put.
- **New paragraphs, headings and subheadings** are pending until they have words: an empty one is never written, and it disappears when you leave it (click or tab away) still empty.
- **A subheading** (a line or two more about a heading, set close under it: [model §6](../content/model.md#6-blocks)) is added from the palette, by turning a text block into one, or with **Add subheading** in a heading's settings (offered while the block after it isn't one), which opens an empty one right under it. It holds plain words, like a heading; a subheading that isn't right under a heading says so in its settings.
- **A heading 2's margin mark** (a chapter's number, say) is set in its settings: **Margin mark** (the words, at most 40 characters) and **Show margin mark** (on; off keeps the words to show again). The canvas shows it as the page will, and never reads it as the heading's words. A **Section marker** block sets the same big marigold type in the column ("1", "Chapter 1"): from the palette or Turn into.

### 3.3 Working with blocks

| Key | With a block selected (not editing) |
|---|---|
| Up, Down | Select the block before or after |
| Enter | Edit its text, or open its settings if it has none |
| Alt + Up, Alt + Down | Move it up or down |
| Ctrl or Cmd + Shift + D | Duplicate it (Ctrl+D is the browser's bookmark) |
| Ctrl or Cmd + Alt + 0, 2, 3, 4 | Turn it into a paragraph, or a heading of that level (while its text is being edited, too) |
| Ctrl or Cmd + Shift + 7, 8, 9 | Turn it into a numbered list, a bulleted list or a quote |
| Delete or Backspace | Delete it (Undo brings it back) |
| Ctrl or Cmd + Z, Shift + Ctrl or Cmd + Z | Undo, redo (the document's history) |

- **The outline** lists every block (its kind's icon, and its first words or its picture's alt text). Clicking a row selects the block and scrolls the canvas to it; selecting a block on the canvas (or with the keys) scrolls the outline, and only it, to bring that block's row into view when it's out of sight. Rows can be dragged to reorder; every drag has a keyboard and button alternative (Move up, Move down), as WCAG 2.5.7 asks.
- **Turn into, any time.** Any text block (a paragraph, a heading, a subheading, a section marker, a quote, a list) turns into any other kind of text, and back: from the block toolbar on the canvas, the inspector, the outline's selection bar or the keys above. Its words stay: a paragraph or a list keeps its bold, italic, code and links, a heading, a subheading, a section marker or a quote takes the plain words, a paragraph's lines become a list's items (and back), and a heading keeps its anchor, a quote its source, while only the level or the style changes. The choices, like the palette's, also make one block from several (one bulleted or numbered list; a collection laid out as tiles, from pairs of a heading and its words, or from one text block alone as a single item) and several from one (a list's items or a paragraph's lines as paragraphs; a collection's items as headings and paragraphs, with their pictures). A choice that doesn't fit what's selected isn't offered, or says why. Each is one step in the history.
- **Several blocks at once.** In the outline, Shift + click (or Shift + Up and Down) selects a range, Ctrl or Cmd + click adds or removes one block, Ctrl or Cmd + A selects them all, and Escape clears the selection. A bar over the rows says how many are selected, with Move up, Move down and Clear. The selection then moves together, one step at a time, in its order (a row's own Move buttons and Alt + Up and Down do the same; nothing moves past the start or the end). Dragging one of its rows drags them all, and Delete deletes them all. Each of these is one step in the history. The inspector shows the block clicked last; clicking a block on the canvas ends the selection.
- **Undo and redo** step through whole-document snapshots, one step per change: a block added, moved, deleted or reconfigured, a setting changed, or one editing session of one block's text (from entering it to leaving it). The history lasts for the browser session. While you're typing, Ctrl+Z is the browser's own undo within that text; the top bar's Undo first ends the editing session, then steps back. Picture details (alt text, caption, focus) belong to the picture, not the article, and aren't in the article's history: the media screen says so.

### 3.4 The block palette

A dialog listing the content model's blocks, in two groups, each with its icon and one line on what it's for. A block that needs something before it can exist asks for it first, so no block is ever saved incomplete.

| Group | Block | What happens when chosen |
|---|---|---|
| Text | Paragraph, Heading, Subheading, Section marker | An empty one appears in place, ready to type (pending until it has words) |
| Text | Quote | Asks for the quote (and, optionally, who said it and the style: block or pull) |
| Text | Collection | Asks for its layout, how its headings read, and its items: one to start, more with Add an item (an added one can be removed), each a heading, a subtext or words, and when it was, for a timeline (at least one item). The words are a rich field, as in the inspector (§3.5): bold, italic, strikethrough, code, links and lists, with the same toolbar and keys. The form is laid out as the inspector's sections (§3.5): wide, the list of its items (each named by its heading, else its subtext, time or words) and its layout beside the chosen one; narrow, each in turn. Its Cancel and Add buttons are a footer that stays in view while it scrolls; pictures are added in the inspector ([model §6.1](../content/model.md#61-collections-one-shape-of-content-any-layout)) |
| Text | Table | Inserted at once, two columns by two empty rows; its cells are written in the inspector ([model §6.2](../content/model.md#62-tables-rows-and-columns-of-short-facts)) |
| Text | Divider | Inserted at once |
| Media | Picture | Opens the media picker (choose or upload), then the width |
| Media | Gallery, Carousel | The media picker in multiple mode (two or more); a carousel also asks for its label |
| Media | Video | The media picker for videos: choose one, or upload one there and then (under 100 MB) |
| Media | YouTube or Vimeo | Asks for the address, the title and the poster (the media picker); while the poster is chosen, the video's own shape is read from its provider (`GET /_edit/api/video-shape`, the provider's oEmbed asked for a 1920 px player; a YouTube Short is 9:16 by its address, since YouTube answers 16:9 for one: `model/videoShape.ts`) and kept on the embed, so the player takes just that shape. A provider that can't be reached leaves it out (16:9), with a note |
| Media | Album | Lists every album by title, and disables one the page can't show, with the reason (V51: `model/albumBlock.ts`); the inspector sets its width, wide or full ([the gallery spec §7.2](../gallery/spec.md#72-an-album-inside-another-page)) |

### 3.5 The inspector

Two tabs, as the APG tabs pattern: **Block** (the selected block's settings) and **Page** (the article's). A change is saved when it's committed (on change, or on leaving a text field), after the contract check. A value the contract refuses stays in the field with the reason under it, and nothing is written. A length limit (the summary, 240 characters; the search description, 160: `model/limits.ts`, from `content/limits.ts`) is checked as soon as the field is committed, in the inspector or on the page itself, and says how long it is ("The summary is 260 characters: keep it to 240."); the words stay where they were typed, to be shortened. An article that fails its own check is reported once: the content check doesn't also call the node that places it missing.

- **Its width.** The inspector's start edge is a separator (the APG window splitter): drag it, or focus it and use Left and Right (by 1 rem, 4 with Shift), Home and End, to make the inspector anywhere from 24 rem to 60 rem wide, as long as the canvas keeps 24 rem. A double click puts it back to 24 rem. The width is kept for the next visit (in the browser's storage), and a narrower window holds it to what fits.
- **Its sections.** The page's settings, and a block's when it has more than one kind (a picture, a gallery, a carousel, a video, a collection, a table), are in sections. Narrow, every section shows in turn under its heading, a rule above each. From 40 rem wide it's two columns: the list of sections on the left, in groups divided by rules, and the chosen section's fields beside it. The list is a navigation of buttons (Up and Down move along it; the one shown is marked current). The choice is kept for each kind of form while the editor is open, so the inspector shows the same section after a change redraws it, and a value refused in a section that isn't shown brings it into view.
- **A collection's items** are a section each, named by their heading (or what else they have), with Add an item under them. Their handles reorder them by dragging, as the outline's rows do (a line shows where the item will land), and the item shown follows its move; Move up and Move down on each item do the same without a drag. A gallery's and a carousel's pictures are dragged by their handles the same way.
- **A collection's header** is optional: its insertion form offers Collection heading, and Layout and width in the inspector offers the same field and Show collection heading. Up to 80 plain-text characters appear above the whole collection, separate from item headings. Turning the switch off retains the words for later; an empty field renders no header. The collection E2E covers editing, hiding, restoring and persistence after reload.
- **A collection item's words are a rich field:** edited as they'll read (set as the page sets them: compact prose, its paragraphs and lists), with a toolbar in three groups (Bold, Italic, Strikethrough; Code, Link; Bulleted list, Numbered list, Indent less, Indent more) and its keys (Ctrl or Cmd + B, I, Shift + X, E, K, Shift + 8, Shift + 7, `[` and `]`). Enter starts a paragraph, or a list's next item; the indents act only in a list (three levels at most), and the toolbar's marks and list show pressed where the caret is. A link asks for its address in the canvas's link dialog. A paste comes in as the subset (a rich copy's paragraphs, lists and marks, or plain text as Markdown). The field's Markdown (`model/richText.ts`, through the canvas's own `model/dom.ts` and the one serializer) is saved when focus leaves it, as any field's change is.
- **Its height.** The inspector's panel fills its height whatever the form's length: a wide inspector's list of sections is ruled to the bottom, and a form's actions (Duplicate and Delete, a draft's Delete this draft) are a footer kept at the inspector's bottom edge while the form scrolls. (Tabs' `fill`: the panel takes the height the tabs leave.)
- **Groups:** Page (Title and summary; Topics, ticked from the site's vocabulary and shown as the page's tags; Publishing), Pictures (Lead picture; Thumbnail; Portrait) and More (Search and sharing; Dates). A collection: Items, then Settings (Layout and width; Pictures).

| Block | Its settings |
|---|---|
| Paragraph | Its words are edited on the page. Drop cap (off unless switched on; never automatic, the article's opening included). Turn into any other kind of text (§3.3) |
| Heading | Level (2, 3 or 4); anchor (optional; made from its words if left empty) |
| Picture | The picture (media field: thumbnail, Replace, and its alt text); width (content, popout, wide, full); show the caption and credit (off: nothing under the picture, nor in the lightbox); caption and credit (each left empty to use the picture's own); open in the lightbox |
| Gallery | Its pictures (add, remove, reorder); layout (grid, mosaic, row); fit (cover, or contain for artwork); width; show the captions (off: no caption for the set, none for its pictures in the lightbox); caption; open in the lightbox |
| Carousel | Its pictures; label; peek; pager (dots, filmstrip, wrapping filmstrip); arrows; show the captions (off: none under any slide, nor in the lightbox); open in the lightbox |
| Video | A video file: the video (thumbnail, its title, Replace from the videos); title (left empty, the video's own); width (a layout place, or Actual size: its own width); Autoplay (muted, while in view) and Loop, both off by default; poster (its own frame, or Choose a picture, then Replace, Crop or Use own frame); show the caption and credit; caption and credit (each left empty to use the video's own). An embed: address (YouTube or Vimeo; the provider and ID are taken from it, and a new address has its shape read again; its hint gives the shape it's shown at, or says it's 16:9 because the shape wasn't read); title; poster (media field); length (minutes and seconds); show the caption and credit; caption; credit; width (no actual size, autoplay or loop: an embed starts when the reader presses play) |
| Quote | Style (block or pull); who said it. Its words are edited on the page |
| Collection | Its items (add, remove, reorder; one to 24), each with its picture (Add a picture or Replace, Crop, Remove picture) or, without one, its illustration (SVG text in the site's colour roles), when it was, heading, subtext and words (a rich field: paragraphs and lists, with bold, italic, strikethrough, code and links); layout (Rows, Columns, Tiles, Masonry, Carousel, Timeline, Timeline, sideways, Figures: changing it keeps the items, and shows only the settings that layout uses); columns (tiles, masonry and figures: by how many there are, or one to four); Prominent tiles (tiles and figures); label (a carousel or a sideways timeline); headings (labels or titles); width (Full bleed only for the strips); Peek beside the column (the strips, not at full bleed); and for its pictures: Shape, Shown as, Colour behind them, Rounded corners, Drop shadow. Turn into headings and paragraphs |
| Divider | None |
| Table | Cells (the column headings on the first line, then a row a line, cells split by `\|`; `\\|` for a literal one; a short row is filled; a line that doesn't fit is refused with the reason); first column names each row; caption; width (content, popout, wide) |

**Page:**
- **Title and address:** the title, the menu label, and the slug with the address it makes.
  - Changing a published page's slug changes its address, and the old one simply goes (no redirect: [sections spec D11](../sections/spec.md#9-decisions)).
- **Summary:** at most 240 characters, with a counter. It is the standfirst and the card text, and the meta description unless the page has its own search description (at most 160 characters): cut at a word near 160 (`searchCopy`, `content/limits.ts`).
- **Kind, status and visibility:**
  - kind: page or note (a talk needs its event, date and recording, which the contract doesn't hold yet; an existing talk shows its kind read-only);
  - status: the lifecycle up to Published ([model §7](../content/model.md#7-lifecycle-and-visibility)); a published page can go back to Draft, which takes it off the site until it's published again;
  - visibility: public, public with details removed, or summary only.
- **Where it appears:** the section (hub) that places it, or "Not on the site yet". This edits the site structure, and can change at any time: the page's address follows its section.
- **Lead picture:** a media field, which can be removed; its caption (left empty to use the picture's own), and whether to show it; **Lead picture shown as** (Fill, Fit, Actual size or Tile), **Colour behind the lead picture**, **Lead picture's rounded corners** and **Lead picture's drop shadow** ([media §9.1](../content/media.md#91-how-a-picture-is-shown-fill-fit-actual-size-tile-a-background-corners-a-drop-shadow)). Under it, a tip gives its shape and the size it stays sharp at (21:9, at least 2400 × 1029 px), and a note says what the page does with the picture in it ("This one is 1024 × 576 px (16:9). The page crops it to 21:9 around its focus point…", and when it's too small). **Crop** opens the crop at 21:9 (§6.1).
- **Thumbnail:** the picture on its cards, shown whole in a 3:2 frame unless **Thumbnail shown as** says otherwise, with **Colour behind the thumbnail**, **Thumbnail's rounded corners** and **Thumbnail's drop shadow**; left empty, the lead picture. The same tip and note (3:2, at least 960 × 640 px), Choose or Replace, Remove, and **Crop**: with the field empty, it crops the lead picture into a 3:2 copy of its own, so one lead picture gives both.
- **Wide thumbnail** and **Square thumbnail** (20 October 2026; [media §9.4](../content/media.md#94-thumbnail-shapes)): the card picture in the home views' 21:9 and a list row's 1:1. Each row says what it uses while it's empty (the lead picture, or the thumbnail), and its pane has the shape's tip, Choose or Replace, **Crop** (from what it uses, into a copy of that shape) and Remove.
- **A picture block, a gallery, a carousel and a collection** have the same four choices (Shown as, Colour behind it, Rounded corners, Drop shadow); a picture block and a collection also have **Shape**, the frame (its own, Square, Classic, Photo, Screen or Wide).
- **Search and sharing:** the SEO title, the description and the image, and whether to keep the page out of search.
- **Dates:** published, updated and last reviewed. The server keeps "Updated" and "Published" true (§9); a date set by hand in the same change wins.
- **Delete:** a draft can be deleted, and with it, if you ask, the pictures in its own folder that nothing else uses. A published article goes back to Draft first, then can be deleted.

### 3.6 Optimistic edits

> **Status: built 13 October 2026, as the owner asked (what was built is in "As built" at the end of this section).** The measured problem and the wider plan are in [the performance report](../engineering/performance-report.md); the feedback rules it applies are in [perceived performance](../engineering/perceived-performance.md).

**The problem.** Edit mode already applied every change to the article in the browser (§8.6), but showed the change only after the server had saved it *and* drawn the screen and the canvas again. The save itself took 0.2 s; the redraw after it was what the owner waited for: a new block reached the canvas after 3.2 s, the outline settled 4.2 s after typing stopped, and a picture's saved details showed after 1.4 s (the October baseline).

**The idea.** Show each change everywhere at once, from the document the editor already holds, and let the server's redraw only confirm it. The person sees the result in under 100 ms; the save goes on in the background; the status line keeps telling the truth about it, and the place the change happened shows that it's still saving (§2.2: the moved row pending, the arriving block, the canvas updating).

#### Rules

1. **At once, everywhere.** A change shows in the outline, the inspector and the canvas within 100 ms of the key or click, before anything is sent.
2. **"Saved" stays true.** The status says Saving… until the store has committed the change, then Saved (§2.1). An optimistic view never says Saved.
3. **Confirm quietly.** The server's redraw, when it comes, replaces the optimistic view without a flicker, a blank canvas, or a change of focus, scroll, selection or inspector tab. What to keep is read when the redraw lands, not when it was asked for.
4. **Put back visibly.** A change the contract refuses (422) puts every view back to the last saved document and says so in the status ("Not saved: … The change was put back"), with the reason on the field. A conflict (409) keeps today's conflict dialog and loses nothing typed.
5. **Never lose input, never blank.** No redraw replaces text being typed, and the canvas is never reloaded in view (double-buffered, below).
6. **Only what the browser can draw truthfully.** Order, presence and words are drawn in the browser; what only the server can render (a picture at its sizes, a collection's layout, a table) shows a placeholder until the server's drawing replaces it.

#### What becomes optimistic

| Change | Shown at once | Confirmed by the server's redraw |
|---|---|---|
| **Move** a block or a selection (Move up and down, Alt + Up and Down, a drag in the outline, the canvas toolbar) | The outline's rows, the inspector's forms and the canvas's blocks in their new order; the selection follows the block | The outline, the inspector and the canvas |
| **Delete** one block or several | Their rows, forms and canvas blocks gone; the selection moves to the block beside them | The same |
| **Duplicate** | The copy's row and canvas block after the original; its settings show "Its settings show once it's saved" until its form arrives | Its form, and the canvas |
| **A new block** from the palette, or a picture or video picked for one | Its row (its kind, and its words or picture's alt text) and, on the canvas, a placeholder in its place ("Adding a picture…") | The canvas's drawing of it, and its form |
| **Typing** in the canvas | The outline row's words, as they're typed | Nothing: words alone no longer redraw the screen |
| **A setting** in the inspector (a caption, a width, a layout) | The field's value, as today; the canvas keeps its drawing, marked as updating after 300 ms | The canvas, drawn again behind the old one and swapped in |
| **Media:** a picture opened from the grid | Its card marked current; the old details stay, dimmed after 300 ms | The picture's details |
| **Media:** a picture's details saved | Its card's name and its "No alt text" mark; "Saved" as soon as the store commits | The grid and the details, in the background |

**What stays as it is** (they keep the feedback of their class in [perceived performance](../engineering/perceived-performance.md)): splitting, merging and turning text blocks, and pasting several blocks (the canvas already shows its own text, and the result needs the server's drawing); uploads, crops, replacing a picture and adding a dark version (long waits, with progress); Save to remote. The Sections, Navigation and Planet screens' moves are a later step (open question 3).

#### How it works

- **Where each block went** is worked out from the article's body before and after the change, in a pure, unit-tested module (`model/optimistic.ts`). The document operations keep every block they don't change (the same object), so a moved block is found wherever it went; a duplicate is a structured clone, so a block equal to one before is a copy of it; anything else is new.
- **The outline** is drawn in the browser from the document, with the same `kindOf` and `excerptOf` the server uses and each kind's icon taken from the palette, so the server's outline, when it comes, is the same.
- **The inspector's forms** move with their blocks: each form's field paths and ids are renamed for its block's new position (`body.3.caption` becomes `body.4.caption`, `f-3-caption` becomes `f-4-caption`, and the controls that carry a position, such as `data-index`, follow). A removed block's form goes; a new or copied block's form waits for the server, with a note.
- **The canvas** takes a `remap` message: it reorders its blocks (each with the comment that marks it), clones a copy, puts a placeholder (`data-editor-arriving`) where a new block goes, maps its blocks again and keeps the selection.
- **A double-buffered canvas.** When the canvas must be drawn again, the new one loads in a second frame in the same place, transparent and inert, at the same scroll position; when it says it's ready, it replaces the old one. If the person types in the old one meanwhile, the new one is dropped and the redraw tried again once the typing stops.
- **Confirming.** The redraws after a save are quiet (no dimming, no "Updating…"); the focus, the scroll, the selection and the inspector's tab are read when the redraw lands. An outline-only redraw is no longer asked for.
- **Putting back.** On a refusal, the editor's document returns to the last saved one, the outline is drawn again from it, and the inspector and the canvas are redrawn from the server.

#### Measured

The benchmark (`npm run perf:bench`) gains three interactions, each from the key or click to the outline and the canvas both showing it: `move-shown`, `delete-shown` and `add-block-shown`, each targeted at under 100 ms. `type-to-settled` is targeted at under 1.2 s (the typing pause and the save, with no redraw), `media-save` under 0.4 s, and `add-block-to-canvas` (the real block replacing its placeholder) under 1 s once the canvas is patched in place ([report R6](../engineering/performance-report.md#5-recommendations)).

**Tests it adds:** unit tests for `model/optimistic.ts` (moves, several, drags, deletions, duplicates, new blocks, renaming a form's fields); E2E tests with the save delayed by the test: a move, a delete and a new block show at once and stay after the save; a refused save puts the views back and says why; typing in the canvas never has its text replaced; the inspector's tab doesn't change after a late redraw; the canvas is never blank during a redraw (a screenshot).

#### Decisions taken

1. **A placeholder on the canvas** for a new block, named ("Adding a divider…"), shimmering until its drawing arrives (still under reduced motion).
2. **A refused save** puts the change back at once and says so.
3. **The Sections, Navigation and Planet screens'** moves are a later step: the article editor and Media first.

#### As built (13 October 2026)

- [`model/optimistic.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/model/optimistic.ts): `originsOf` (where each block came from: moved, a copy, or new), `isStructural` (an edit in place isn't shown this way), `targetsOf`, and `renameIndex` / `renameTree` (a form's names, ids, `for`, `aria-describedby`, `data-index`, `data-editor-pick` and the rest). Unit-tested in `tests/unit/editorPerf.test.ts`.
- The controller's `change(…, { atOnce: true })` is used by Move up and down, the keys, a drag (one block or a selection), Delete (one or several), Duplicate and every new block; `showAtOnce` draws the outline from the document (the row template and each type's icon are in [Outline](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/components/Outline.astro)'s markup), renames the inspector's forms (a new or copied block shows Inspector's "Its settings show once it's saved"), and sends the canvas `remap`; the rows it touched show a spinner while the save runs. The save then confirms the outline and the inspector quietly (the inspector is left as it is while a field in it is being typed in) and draws the canvas again behind the old one.
- Typing in the canvas updates its outline row as it's typed and redraws nothing; the title and the standfirst typed on the canvas change the Page tab's fields in place.
- The double-buffered canvas: `reloadCanvas` loads `data-editor-incoming` behind the frame (it writes the scroll position the canvas restores), `promote` swaps it in on its `ready`; a `typing` message drops it and tries again 1.6 s after the typing stops, and drops what was to happen once it was ready (a caret put back).
- Media: opening a picture marks its card current at once and draws only the details region (R11); saving its details says Saved as soon as the store commits, changes the card's name and its No alt text mark in place, and draws the grid and the details again quietly after the button's done check.
- **Not built:** patching a single block's drawing into the canvas by message (report R6's first option): the double-buffered canvas covers it without a blank frame.

## 4. Articles, and the dashboard

- **The list** shows each article's title, kind, section, status (a private page tagged Private) and last update, newest first. It can be searched by title and filtered by status, kind and who can see it (Everyone, Private). Each row opens the editor, and has View on the site (when published), Duplicate and Delete.
- **New article** and **New page** ask for the title, the summary, the section and, when `private-pages/` is set up, who can see it (Everyone or Private; a private page is written straight into `private-pages/`). The server creates a valid draft (`status: draft`, today's `updatedAt`, an empty body) with an ID and slug made from the title (lowercase, hyphenated, unique among articles and among the section's children), places it, and the editor opens it. A page is an article of kind `page`, placed under the home hub by default.
- **Duplicate** copies an article as a new draft ("… (copy)") in the same section, sharing its pictures.
- **The dashboard** shows:
  - the counts by status;
  - the five most recently updated articles;
  - the unpublished changes (linking to Publish);
  - what needs attention: the content check's warnings, and pictures without alt text;
  - the quick actions: New article, New page, Upload pictures.

### 4.1 Albums

An album is a page of kind `gallery`, as first built. The redesign, specified and not built yet, makes it its own resource with an Albums screen and an album editor modelled on Google Photos and Apple Photos ([the gallery spec §9](../gallery/spec.md#9-edit-mode)).

- **New album,** beside New page and New article, asks for the same things and opens the new album on its Items view. The list shows its kind as Album. An album's kind is locked in its settings, and no other page can be made one.
- **Album settings,** a group of the page's settings, holds its layout (Grid or Story), Captions under pictures (Grid only), Show dates taken, Allow downloads and its introduction. Choosing a default removes the field.
- **Its views** are links in the top bar's tools, sharing one undo history: **Page** (the article editor), **Items** and **Up front**. Up front, the arranger, is in progress; until it's built, Items' Up front switch puts an item in the band's next free place.
- **Items** shows the cards in album order beside the chosen one's details: Add from the library, Upload (a batch, each file with its alt text, caption and the date read from the file), Add a video link (YouTube or Vimeo: its title, shape and thumbnail are asked of the provider once, and the thumbnail kept as the site's own picture), Sort by date taken, and the album's weight under the grid. Shift and Ctrl choose several; a drag, or Alt with an arrow key, moves them; Delete removes them. Every change saves at once and can be undone. An item's details hold its words for this album (caption, description, place); its picture's own alt text, date taken and focus point are shown with a link to Media, where the alt text and the focus point are changed. The operations are pure in `src/site/editor/model/album.ts`; the cards, counts and weight come from `src/site/editor/server/albumItems.ts`.
- **An album another page shows** can't be made private or deleted, nor taken back to draft while a published page shows it: edit mode refuses, naming the pages.

## 5. Sections: the site structure

The site structure ([structures §2](../content/ia.md#2-the-site-structure)) in two columns: the sections listed on the left, and the chosen one on the right, with its **Pages** and its **Settings** as two tabs ([sections spec §7.2](../sections/spec.md#72-sections)). The Planet screen is the same pattern over the game's seven buildings ([§7.4](../sections/spec.md#74-planet-new-screen-u12)).

- **The list of sections:** the home page, each section with its address and how many pages it holds, and "Not on the site" (the pages that aren't in a section). It stays in view as the screen scrolls, and the address keeps the chosen section and tab.
- **Pages:** a row per page, in order, open and private together: a handle, a checkbox labelled with its title (its kind and address under it), its status (and Private) and Edit. A move that involves a private page writes the public structure and the private overlay together, and a private page can't be taken off the site ([access spec §8.2](../access/spec.md#82-sections-and-pages)). Find a page and Show (every status, published, not published) narrow the list; the checkboxes and Select all make a selection that moves together.
- **Moving pages:** drag a handle to another place in the list, or onto a section in the list of sections; Alt+Up and Alt+Down move a page within its section; a click on the handle (or Move selected) opens Move, with Move up, Move down and a button for every section. A published page moves like any other: its address follows its section, and the old one simply goes (no redirect).
- **Settings:** a section's title, its menu label, its summary, its slug and its view (List, Tiles, Bento, Features or Albums: how it lists its pages, [sections spec §3.4](../sections/spec.md#34-the-section-view-u6); Albums draws each album as a band, [the gallery spec §5](../gallery/spec.md#5-the-albums-view)), a switch, In the navigation, that adds it to the top navigation or takes it out (the same menu the Navigation screen edits), and Move up and Move down (Alt+Up and Alt+Down on the section in the list do the same). New section, under the list, adds a section at the end, with its summary, its view and the switch (on), and opens it. The site is three levels, so there are no sections inside sections and no pages directly under the home page (V22).
- **The home hub** (Home page) has its title, its menu label and its summary: the home page's name and the line under it ([sections spec §3.5](../sections/spec.md#35-the-home-page-decision-o5)).
- **Drafts can be placed.** A node may place a draft: its route is resolved and checked like any other (so two drafts can't claim one address), and the build leaves it out until it's published. On the dev server it's served at its address, a preview with a Draft tag beside its topic (the article editor's **Preview it as a page**). So an article's section is chosen when it's created, and publishing it is only a status change (§9).

## 6. Media

- **Editorial previews are unstyled.** Thumbnails in the Media library, its picker, the details pane (including both colour versions) and the article inspector always fit the whole source image and have square corners. They never inherit a page's fill/crop or rounding settings: the owner needs to inspect every edge. The canvas still shows the actual public-page styling, and changing these previews changes no saved picture setting or master.
- **The library** is a grid of every master under `content/media/` and, tagged Private, `private-pages/media/` (a private page's own), grouped by owner (an article, a person, `shared`, the site), searchable by alt text and ID and filtered by who can see it, with a warning on any picture without alt text. Every change to a picture or video is made where it lives, and an upload to a private page's folder goes into `private-pages/media/`. Selecting one opens its details (they save to the picture, so they aren't part of an article's undo):
  - the picture, with its **focus point**: click where the crop must keep, stored as `focus` ([media §3](../content/media.md#3-the-metadata-sidecar)); **Find the focus** measures where the subject is and moves the point there, saved with the details (not for a drawing, which is never cropped);
  - alt text (required unless marked decorative; at most 250 characters; never "image of"; a suggestion can fill it, [AI services](ai-services.md)), caption, credit, licence and source;
  - **Used in**: every document that refers to it, linking to the editor, and the albums it's in;
  - **Crop**: Crop the picture (§6.1); a cropped copy links to its original, and an original lists its copies;
  - **Dark mode version**: add, replace or remove it (§6.2);
  - Delete, only when nothing refers to it: no article in any state (its hero, thumbnail, blocks or social image), no person and not the site settings.
- **Uploading** takes drag and drop, a file picker or a paste (Ctrl+V while the form shows, in the library or the picker), into an owner's folder (the article being edited, or `shared`). The chosen picture shows at once, as it will be uploaded: on a checkerboard so its transparency shows, with its size, its format and whether it's transparent. **Crop it** opens the crop dialog (§6.1) on the file itself; the crop goes with the upload (in the pixels the browser showed, which the server scales to the file's own) and is cut from the full-quality file before the master is made, and Undo the crop takes it back. It takes any picture: the server reads JPEG, PNG, WebP, AVIF, GIF, TIFF and SVG; an SVG is kept as a drawing (cleaned, and kept as a vector) or turned into a picture, as the form asks ([media §13](../content/media.md#13-albums-drawings-and-large-pictures)); anything else the browser can decode (BMP, ICO…) is drawn into a PNG there first, its transparency kept, and a format neither can read (HEIC in Chrome) is refused with what to do. JPEG XL, camera RAW, PSD, and MKV, AVI, WMV and 3GP videos are refused with what to do; an animated PNG says before it's saved that it will be kept still. The date the picture was taken is read from its EXIF and saved as `taken`. Each file asks for its alt text (or to be marked decorative) before it's saved, and can suggest it ([suggested alt text](ai-services.md)). The editor then makes the master:
  - WebP (lossless if the source had transparency);
  - a GIF is the exception: kept exactly as it is (`<name>.gif`, byte for byte, under 100 MB, GitHub's limit for a file), never re-encoded, resized, cropped or stripped, with a still first-frame WebP poster beside it when it's animated, for reduced motion and thumbnails. The form says "Kept exactly as it is" with its size, offers no Crop it, and the server refuses a crop of one (a GIF wider than 2560 px is refused, not resized). Replace and the dark version take a GIF the same way (`<name>.gif`, `<name>.dark.gif`; replacing changes the master's file and deletes the old one);
  - at most 2560 px on the long side and 1.5 MB (the budgets in [media §4](../content/media.md#4-formats-and-budgets)); a picture uploads at up to 20 MB. **Keep it large**, offered only for a still picture over 2560 px, keeps it at up to 3840 px (`large`), and the details' **Make it standard** saves it again at 2560 px;
  - metadata stripped (no location);
  - named from the file name (lowercase, hyphenated, unique in the folder; a pasted screenshot, often just "image.png", is `pasted-picture-<date>`);
  - with its JSON sidecar beside it, both written in one transaction.
- **A picture pasted in the canvas** (a screenshot, a copied image, with no text beside it) opens the picker with it in the upload form, previewed; uploaded, it becomes a figure after the block being edited (or in place of a new, empty paragraph). The rules (formats, what a paste holds, the names, the preview's line) are pure, in `model/upload.ts`, and unit-tested.
- **Videos** ([media §12](../content/media.md#12-video-files)) are uploaded from the same form: an MP4, WebM or MOV under 100 MB, GitHub's limit for a file. A bigger one is refused at once, before anything is sent (and again on the server), with how to make it smaller; one past 50 MB uploads with GitHub's warning. The chosen video plays in the form, with its size, format, length and weight; one this browser can't play is refused, since a reader's browser couldn't play it either. The form asks for its **title** (not alt text), and takes a frame from it as its poster. The server keeps the file as it is (a MOV becomes an MP4, its streams copied by ffmpeg; an MP4 gets its index at the front), and writes it, its poster and its sidecar in one transaction. In the library a video is a card with its poster, a Video tag and its length; its details are the video itself, its title, caption, credit, licence and source, Used in, and Delete (the video, its poster and its sidecar). The picker shows only what its field or block takes: pictures, videos, or both for a gallery's or a carousel's items (its Use button says what it adds: "Use 2 pictures and 1 video"); each video item in a gallery or carousel has its own Autoplay and Loop in the inspector. A video file pasted in the canvas becomes a video block the same way a picture becomes a figure.
- **Media IDs never change.** There's no rename; replacing a picture keeps its ID and writes a new master.
- **The media picker** (in the article editor and the settings) is the same library in a dialog, with upload, in single or multiple mode, for pictures or for videos. The dialog fits the window and its library scrolls inside it. In multiple mode (a gallery, a carousel) the dialog's footer, always in view, says how many are chosen and how many it needs, and holds the button that adds them ("Use 3 pictures"); in single mode a press on a picture adds it.

### 6.1 The crop

The crop follows the pattern of the established editors (Photos, WordPress's image editor, Sanity's crop): the picture whole, and a box over what to keep.
- **The box** has eight handles; what it leaves out is veiled in the page's smoke, and a rule-of-thirds grid shows while it moves or has the focus. Dragging it moves it; a press elsewhere on the picture centres it there first; a handle resizes it from the opposite side (a corner keeps the shape and follows the pointer's further way; a side keeps the other axis centred).
- **Shape:** Free, Original, 1:1, 4:5, 3:2, 4:3, 16:9 and 21:9. Opened from a field, it starts at that use's shape (the lead picture's 21:9, the thumbnail's 3:2, the wide thumbnail's 21:9, the square thumbnail's 1:1) with the use's tip above the picture; from the library, at Free.
- **Size** scales the box about its centre, from 5% to the largest of its shape. **Reset** goes back to the largest box of the starting shape.
- **The readout** gives the size it makes ("1024 × 439 px (21:9), from 1024 × 576"), a polite live region; a warning says when that's narrower than its use shows.
- **Keys** (on the crop area, which has the focus when it opens): the arrows move it by 1% of the picture (10% with Shift), + and − resize it, Home centres it. Shape, Size and a click to centre are the single-pointer ways (WCAG 2.5.7).
- **Save the crop** never changes an original ([media §9](../content/media.md#9-shapes-thumbnails-and-crops)): an original is cut into a copy beside it, which the field then uses (or the library opens); a cropped copy is cut again from its original and updated where it's used. The dialog says which before you save.
- **Animation is never flattened silently.** An animated upload cannot take a destructive crop; its Media details replace the crop action with a note to keep it whole and use its focus point to control the visible area. The server also refuses a crop of an existing animated picture.
- **Built as:** `CropDialog.astro` and `scripts/crop.ts` (one dialog per screen, opened with `openCrop`), the geometry pure in `model/crop.ts` (unit-tested), and `GET`/`POST media/<id>/crop` (`cropSource`, `cropMedia` in `server/media.ts`), which cut with sharp and encode the copy as every master is. A picture's dark mode version (§6.2) is cut with it, from the same place.

### 6.2 Dark mode versions

A picture can have a dark mode version, shown on the site instead of it whenever the page is dark ([media §10](../content/media.md#10-dark-mode-versions)).
- **In the picture's details** (Media), under Dark mode version: with none, it says the same picture shows in both modes, and **Add it** takes a file (chosen or dropped; any format an upload takes). With one, the two show side by side, each on a page of its own mode (Light, Dark), with its size; **Replace it** and **Remove it** change it. A dark version of another shape is saved, with a warning in words that a page shifts when the theme changes.
- **The library** tags the pictures that have one ("Dark version").
- **Kept with the picture:** it's a second master, `<name>.dark.webp`, made like every master (WebP within the budgets, transparency and animation kept; a GIF kept as it is, as `<name>.dark.gif`) and named in the sidecar's `dark`, written with it in one transaction (`setDark`, `removeDark` in `server/media.ts`; `POST` and `DELETE media/<id>/dark`). An animated dark version also has `<name>.dark.poster.webp`. Saving the details never changes it; a static crop cuts a static dark version too (§6.1); Replace keeps it; Delete deletes it and its poster; deleting a draft with its own pictures deletes their dark versions with them; Publish and Discard treat them as part of the picture.

## 7. Publishing

**Planned: drafts stay private** (20 October 2026). Today a public page's draft is committed to the public repository with every Save to remote. The [Drafts and publishing](drafts-and-publishing.md) plan moves your work (every page's working copy and its versions) into the private repository. Publish, Publish changes and Unpublish become the only way to the public side, which then holds only published versions and their history. Save to remote retires, in favour of a background backup and Publish site changes. What follows is the current behaviour until that lands.

**Two words, two actions** (6 October 2026). **Save to remote** sends your changes to GitHub (a commit and a push), which redeploys the site. **Publish** puts a page on the site: its Status becomes Published. A page only reaches readers when both have happened. Publishing is the page's own action, never part of a save (below). (Until then the screen and its button were called Publish, and a private page saved with it stayed a draft, which read as a failed publish.)

- **The Save to remote screen** (`/_edit/publish/`, "Save to remote" in the top bar and the navigation) lists every file in `content/` that differs from the last commit, as git sees it: added, changed or deleted. Each is named as its resource ("Article: Do what makes you proud", "Media: articles/…/tshirt"), with a checkbox to choose whether it goes with this save (§7.1), and Discard, which puts it back as last committed and deletes a new file.
- **From a page editor, Save to remote stays with the page.** Its top-bar button opens the same change list and form in a modal instead of navigating to the standalone screen. The change list and form fill the modal's usable width rather than keeping the standalone screen's reading-column cap. The modal can be closed at any time, including while a commit or push is running; closing it returns to the editor without cancelling the operation. A separate status in the top bar says **Saving to remote…**, **Saved to remote** or that the save/push failed, independently of the page's own autosave status. On completion the hidden or open modal and the pending-change count refresh in place. Other editor screens keep using `/_edit/publish/`.
- **Always what git says now** (11 October 2026). The list and the counts are drawn with their page, and the content and git move on after that: a page saves as you type, and a commit or push can happen in a terminal. So:
  - opening the modal reads git again: the list steps back under **Checking what changed…**, with Save to remote and Push again disabled until the fresh list is in (the last save's result stays while its commit is still the latest);
  - the top bar's and the navigation's counts are drawn again a moment after every save made in the article editor (`refreshPending` in `scripts/client.ts`), and on every screen when the window comes back (at most every 3 seconds; a refresh that would land under an open dialog waits until it's put away);
  - the standalone screen reads git again when the window comes back;
  - a message being written (changed from the one offered) is never swapped away; a field that had the focus keeps it.
- **What counts** (`pendingCount` in `server/git.ts`): files changed in either folder, commits not pushed from either repository, and a private commit the public repository doesn't record yet (the private-pages pointer moved). That last one is listed as **Private pages: Saved privately, not yet linked from the site** (no Discard), so Save to remote is enabled for it.
- **A git that can't be read is never "nothing to save".** When `git status` fails (a lock, a timeout, a broken index), `changes()` reports the reason instead of an empty list: the top bar says **Changes not checked**, the navigation **Not checked**, the screen says why and blocks saving, and Save to remote on the server refuses too.
- **A save never publishes** (21 October 2026). Save to remote saves what has changed and never changes a page's Status: a draft saved to remote stays a draft. Publishing is the page's own **Publish** (its Status). The screen used to list drafts with a checkbox to publish them with the save; it was removed so nothing goes on the site by accident while you're saving something else, and the server ignores any such request.
- **The check** runs the whole content contract, as the build does. Save to remote is enabled only when it passes and there's something to save.
- **Save to remote** asks for a message (a sentence made from the changes is offered). Holding the writer lock (§8.3), so nothing can change underneath it, it:
  1. reads the content once and checks it;
  2. stages it: `git add -A -- content`;
  3. confirms that what's staged is exactly what it checked (the staged blobs' hashes against the files');
  4. commits it: `git commit -m <message> -- content`, which commits `content/` only, whatever else is staged;
  5. pushes it: `git push`.

  It refuses on a detached HEAD or a branch without an upstream, and never forces. The result shows the commit and a link to the deploy on GitHub Actions.
- **A failed push** leaves the commit local. The screen tracks commits not yet pushed separately from uncommitted changes, says why the push failed (for example, "the remote has newer commits: pull, then push again"), and offers Push again without a new commit.
- **git never waits for you.** It runs as a child process with its arguments as a list (never through a shell), in the repository that holds `content/`, with prompts off (`GIT_TERMINAL_PROMPT=0`, the credential manager non-interactive, SSH in batch mode) and a time limit, after which it's stopped and the reason shown.
- **Discard** restores a tracked file in the index and the working tree (`git restore --source=HEAD --staged --worktree`) and deletes an untracked one.
- **Line endings:** `.gitattributes` keeps content JSON at LF (`content/**/*.json text eol=lf`), so the files the editor writes, the ones git checks out and the ones publish compares are the same bytes.

### 7.1 Saving some changes, or all of them

You can save every change at once, or only the ones you choose and leave the rest for a later save (21 October 2026).

- **Every change has a checkbox,** ticked to begin with, named by the change, with its kind and what changed (§7.2) as the hint, and **Open** (its screen) and **Discard** beside it. Above them, **All changes** ticks or unticks them together, and shows a mixed state when only some are ticked. **Private pages: Saved privately, not yet linked from the site** has no checkbox, because it goes with any save.
- **The button counts.** It says **Save to remote** when every change is ticked, and **Save 1 of 3 to remote** when only some are. With nothing ticked, it's disabled and the form says to tick something. The message offered follows what's ticked until you write your own, and so does the note about private pages.
- **What you untick stays unticked** while the list is drawn again (after a Discard, or when the window comes back), until a save succeeds.
- **From a page, that page's changes are ticked** (22 October 2026). Save to remote opened from a page's editor starts with only the page's own changes ticked: its file (both rows when it was made private or open) and the pictures uploaded to it (`media/articles/<id>/`), so the save stands on its own. Everything else is unticked, to tick if you want it. Each time the modal opens it starts this way again; what you tick or untick holds while it's open. When the page itself hasn't changed, every change is ticked, as on the standalone screen, which always starts with everything. The server names the page's changes (`pageScope` and `pageOf` in `model/selection.ts`, sent as the list's `data-publish-scope`) and the script ticks them as the modal opens.
- **The server takes the same choice.** The form sends the ticked changes' files (`keys`) only when some are left out. `publish(message, titles, { keys })` in `server/git.ts` then:
  1. refuses if none of the chosen files is still changed ("check the list again");
  2. checks the content **as the commit will hold it** (`asCommitted`): every change left out as last committed, from `HEAD`, and a new file left out as absent. A choice that needs a change left out (an article without its new picture) is refused with the issues: "the changes you chose don't stand on their own…";
  3. stages, confirms and commits only the chosen paths in each repository (`git commit -- <paths>`), private first as before; a change left out, even if it was staged, stays uncommitted;
  4. pushes as before. The private-pages pointer goes with the public commit when a private commit was made or it had already moved.
- The pure rules (which files, the button's words, the message and the private note) are `model/selection.ts`, shared by the screen's script and the server.
- **Evidence:** the unit tests "saves only the changes chosen…", "saves a chosen deletion alone…", "refuses a choice that needs a change left out…" and "the content a partial save commits" (`tests/unit/editorServer.test.ts`), and the editor E2E "publish: only the ticked changes are saved, the one left out stays for a later save" and "Save to remote from an article ticks only that article's changes, each time it opens".

### 7.2 What each change is, and which are private

Every row says what changed in it, and a private one says it's private (21 October 2026).

- **Private** (the key icon, as on Pages and Media) tags every row whose files are in `private-pages/`: a private page, its media, the sharing and where private pages are listed. Its commit goes to the private repository.
- **A summary** follows the change's kind in its checkbox's hint, so a screen reader hears it with the box: "Article: Title changed, a paragraph added". It comes from comparing each JSON file with its last commit (`summariseChange` in `model/changeSummary.ts`, pure):
  - **a page:** published, unpublished or a new status; the fields that changed, in words (the slug is the address, the hero the lead picture); its blocks changed, added, removed or reordered, matched by their keys (else by content), naming the kind when they're all one ("a heading added"); "Dates updated" when nothing else did; "New article" (or page, gallery) for a new one;
  - **a picture, video or document:** the file replaced, its dark version or poster added, removed or replaced, and the words and settings chosen for it (alt text, focus point, crop, credit…), never the measures a new file brings;
  - **the sections:** sections and pages added, removed, moved or changed, the order and the navigation, naming two and counting the rest;
  - **anything else** (the settings, a person, the sharing): the fields that changed, and lists of things with IDs counted ("2 grants added").
  - **A page made private or open** shows on both its rows: the old one "Made private: moves to the private pages", the new one "Made private" with what else changed; its pictures say "Made private with its page".
- **One git process per repository:** the committed files are read with one `git cat-file --batch` each (`committedJson` in `server/git.ts`), because the list is drawn again on every check. A deleted page is named by its last committed title. A summary that can't be made is left out; it never stops the list.
- **Evidence:** `tests/unit/editorChangeSummary.test.ts`, the unit test "reads JSON files as last committed in one batch…" (`tests/unit/editorServer.test.ts`), the editor E2E "publish: only the ticked changes are saved…" (the summaries) and "makes a page private in its place from its settings…" (`tests/e2e/editor-access.spec.ts`: the Private tag and both rows' summaries).

## 8. Architecture

### 8.1 Dev only, by construction

`integrations/editor.mjs` is an Astro integration:
- **`astro:config:setup`:** for every command, it defines the content folder's absolute path from Astro's root (a Vite `define`, so nothing depends on the working directory). `CONTENT_ROOT` may replace it only in dev; a build with it set fails, so a build always reads and imports the same `content/`. When the command is `dev` (and `SITE_EDITOR` isn't `off`), it also injects the editor's routes: the screens, the canvas and `/_edit/api/[...path]`. For any other command it injects nothing, so `astro build` never sees the editor.
- **`astro:server:setup`:** watches `content/` (§8.4).
- **`astro:server:start`:** prints the editor's address.

Every editor route is on demand (`prerender = false`), which the dev server serves without an adapter; a build would need one, and never gets the chance.

### 8.2 The request guard

Every editor route and API call passes one guard (pure, unit-tested):
- **The client** is on the loopback address (127.0.0.0/8, ::1, ::ffff:127.x).
- **The `Host` header** names `localhost`, `127.0.0.1` or `[::1]`. That stops DNS rebinding, alongside Vite's own `allowedHosts` check, which in Vite 8 runs before any integration's routes.
- **No framing:** every editor response carries `Content-Security-Policy: frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`, so a page elsewhere can't frame the editor and trick a click into a write (the canvas is framed by the editor itself, on the same origin).
- **A request that writes** must also meet all of these:
  - it carries `X-Editor: 1`, which a cross-origin page can't send without a CORS preflight (Vite's CORS allows some loopback origins, but only sets headers: the next check is what refuses them);
  - its `Origin` is exactly the editor's origin (scheme, host and port); a write without one is refused;
  - `Sec-Fetch-Site`, when present, is `same-origin`;
  - the body is JSON (or multipart for uploads; the media server limits them: a picture at most 20 MB, a GIF or a video under 100 MB).

Anything else gets 403, with no detail. Paths come from IDs checked against the content model's patterns, and every resolved path is checked to be inside the content folder.

### 8.3 Reading and writing content

- **Reading:** the files adapter reads `content/` from disk into a snapshot (the documents, the masters and a digest). A process-wide content generation says when to read again: the store advances it the moment a transaction commits, and the integration advances it when anything else changes a file in `content/`. The repository compares the generation before every read, so a page rendered after a save always sees it. A build reads once. The adapter no longer uses `import.meta.glob` for JSON (§11, C1).
- **Pictures:** in dev, a master's size and format are read with sharp and handed to `astro:assets` as the same metadata an import would give, so new uploads need no restart. The build still imports the masters, so they're emitted and hashed as today.
- **Writing is a transaction.** The store takes a change set (resource paths to their new bytes, or to deletion) and the versions it was made from, and holds one writer lock (for publishing too) while it:
  1. checks every version against the file on disk; any mismatch is a 409, and nothing is written;
  2. applies the set to the snapshot and runs the full content check (`loadContent`: schema, references, routes); a failure is a 422 with each issue's path and message, and nothing is written;
  3. writes every file to a temporary file beside it, flushed to disk;
  4. renames them into place in an order that keeps every step valid (a master before its sidecar; an article before the node that places it; a node removed before its article), retrying the brief `EPERM` and `EBUSY` errors Windows raises while an indexer or antivirus holds a file;
  5. if a step still fails, puts back the bytes it replaced and removes what it added;
  6. advances the generation, and answers with the new version of every file it touched.
  
  JSON is written with two-space indent, LF line endings, a final newline, UTF-8. Every path is resolved inside the content folder (after following links) and matched against the content model's patterns before anything is read or written.
- **Versions everywhere.** Every document is served with its version (a hash of its bytes). Every write names the version of every file it may touch (an article, the structure, a sidecar), so an edit made by hand in VS Code is never silently overwritten: the editor shows the conflict and offers to reload.
- **The server owns what must stay true:** IDs and slugs for new articles, status changes, and the dates (§9). The client never sends a date it didn't mean to set.

### 8.4 No reload storms

- **The problem:** the dev server reloads every open tab when a server-only module changes. If the content JSON were modules, every save would reload the editor it came from.
- **The fix:** content is read from disk, not imported (§8.3), so a save touches no module. The integration watches `content/` itself:
  - **on any change** it sends Astro's own `astro:content-changed` event to the `ssr` and `prerender` environments, which clears the route cache, so a new or newly published article's route exists at once, without a restart;
  - **and it pushes the change to every open page** as a custom `site:content-changed` event on the dev server's socket, with the files, the editor tab that made it (`origin`: the store reads it from the request's `X-Editor-Tab` header, through `asTab` in `server/store.ts`; null for a change made by hand) and the content generation it brought the content to. The store tells it of its own writes (it records the hash of each file it writes); the watcher tells it of everything else and advances the generation, ignoring temporary files and a change whose bytes the pages already know (the store's write, or a change already announced: Windows reports one write as several events, and a second report used to look like an edit made elsewhere). What each page does with it is §2.1: a public page reloads once the changes settle; an editor screen brings the change in live, keeps unsaved input, and ignores its own saves and changes it already shows.
  - **Pictures' masters aren't watched** (the dev server's `server.watch.ignored`): a new master (an upload, a crop) made the dev server reload every open page, losing unsaved typing in other tabs. The store tells the pages of the masters it writes, and what a page shows of a picture comes from its sidecar.
- **Canvas refreshes:** the editor refreshes the canvas itself, only after changes that re-render it (a block moved, added or reconfigured, or a change made elsewhere), keeping its scroll position and selection. Text saves don't refresh it. A move, a removal, a copy or a new block is shown in the canvas at once by message (`remap`, §3.6), and every redraw is double-buffered: the new canvas loads behind the old one and replaces it when ready, so it's never blank.
- **Region fragments** (performance-report.md R4): a swap names its regions in an `X-Editor-Regions` header ([`model/regions.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/model/regions.ts)), and the layout and the screens draw only those (the article editor its outline, inspector or state; Media its grid or details; the picker a page of cards). The counts of changes to save to remote always come along. git is asked once per repository (`git status --porcelain=v2 --branch`, both repositories at once) and the answer kept until the content generation or git's own files move (at most 30 s), so a whole screen never waits for it: with no answer kept yet, the counts say "Checking changes…" and are read after the paint (R1, R2).
- **A first start** (R12): once `astro dev` listens, the integration asks each screen once (so its modules compile) and reads every picture's facts (a disk cache makes later starts quick); meanwhile a screen opened in the browser gets a plain page that says what it waits for ("Compiling the screens: 3 of 8", "Preparing pictures: 40 of 118") and then opens it (`/_edit/__warm` reports the progress; `SITE_EDITOR_WARM=off` turns it off, as the E2E fixture server does).

### 8.5 The API

All JSON, under `/_edit/api/`. A write sends `ifMatch` (each touched file's version) and answers `{ ok, versions, issues }`: 200, 409 (a conflict) or 422 (the contract's issues).

| Method and path | Does |
|---|---|
| `PUT articles/{id}` | Saves an article (the whole document), and its node when its section changes |
| `POST articles` | Creates and places an article: `{ title, summary, kind, section }` → `{ id }` |
| `POST articles/{id}/duplicate` | Copies it as a draft |
| `DELETE articles/{id}` | Deletes a draft and its node (and, with `?media=1`, the pictures in its folder that nothing else uses) |
| `PUT structure` | Saves the site structure |
| `PUT site`, `PUT people/{id}` | Saves the settings or a person |
| `PUT ways` | Saves the ways in (`content/structures/ways.json`): `{ ways, ifMatch }`; with the little planet turned on and no planet structure, writes its starting map in the same transaction, or refuses (422) a site with fewer than seven sections |
| `POST media` | Uploads (multipart: `file`, `alt` or `decorative`, `caption`, `owner`, and `crop`: a JSON rectangle with the size it's in, `{ x, y, width, height, of: { width, height } }`) → `{ id }` |
| `POST media/{id}/replace` | Writes a new master for a picture, keeping its ID and sidecar (multipart: `file`) |
| `POST media/{id}/dark`, `DELETE media/{id}/dark` | Adds or replaces a picture's dark mode version (multipart: `file`, and an optional `crop` as for an upload) → both sizes; removes it |
| `PUT media/{id}`, `DELETE media/{id}` | Saves a sidecar (never its `dark`); deletes an unused master, its dark version and its sidecar |
| `GET media` | The library, with thumbnails (for the picker after an upload) |
| `GET doc?key=`, `GET where?path=` | A document and its version; where the site's Edit button leads from a page |
| `GET changes` | What differs from the last commit in `content/` |
| `POST discard` | Puts a resource's files back as committed, in one transaction: `{ keys }` |
| `POST publish` | Checks, commits `content/` and pushes: `{ message }` |
| `POST push` | Pushes commits not yet pushed |

### 8.6 The editor's code

| Folder | Holds |
|---|---|
| `integrations/editor.mjs` | The dev-only integration (§8.1, §8.4) |
| `src/site/editor/pages/` | The routes: the screens, the canvas and the API endpoint |
| `src/site/editor/components/` | The editor's parts (the outline, the inspector's frame and forms, the media grid, the canvas frame, the section manager): built from the site's fundamentals, compounds, the editor's kit and tier 0 only. A part never imports another part; the editor's layout and pages compose them |
| `src/site/editor/kit/` | The pieces several parts are made of (a form, its issue note and foot, a list's panel and rows, a form in sections, a picture field): fundamentals, compounds, tier 0 and the editor model only (§10) |
| `src/site/editor/stories/` | A story for every part and kit piece, with its sample data (`samples.ts`: made-up, never the content), shown on the dev-only parts library (§10) |
| `src/site/editor/EditorLayout.astro` | The editor's frame: side navigation, top bar, live status, the icon watermark beside a screen |
| `src/site/editor/model/` | Pure and shared by the browser and the server: document operations (insert, move, duplicate, delete, split, merge, update), text to Markdown, IDs and slugs, the guard, the change list's names, the reference graph, the save queue |
| `src/site/editor/server/` | Node only: the store, uploads (sharp), git, and the parts library's catalogue (`library.ts`) |
| `src/site/editor/scripts/` | The browser's controllers: the editor, the canvas, the screens, and the site's Edit button (the launcher, in a shadow root so it touches nothing of the page) |

- **One owner of the document.** The article editor's controller holds the article, applies each operation with the shared document operations, saves it through the API and tells the canvas what changed (by `postMessage`, same origin only). The canvas only reports what the reader did (selected, typed, asked to add or move) and redraws when told.
- **Forms are rendered by the server** with the design system's fields, one form per block and one for the page, so the inspector needs no client-side templating. The page re-renders its outline and inspector after structural changes by fetching those regions and swapping them in; a move, a removal, a copy or a new block is drawn in the outline and the inspector at once from the document (§3.6), and the server's redraw only confirms it. The picker's cards aren't in the page: they're drawn when it first opens, a page at a time (R5).

## 9. Content rules the editor adds or changes

| Rule | Why |
|---|---|
| A site-structure node may place a draft: its route is resolved and checked with the rest, and only published items are built (the loader no longer fails on it) | An article's section is chosen when it's created; publishing is a status change; two drafts can't claim one address |
| A text block is one paragraph or one list (no blank line in its Markdown) | Every block renders one element, so the canvas and the editor agree on what a block is |
| `updatedAt` is set to today (the owner's local date) when an article's title, summary, lead picture or blocks change, unless the same change sets it | The "Updated" date stays true without anyone remembering it |
| Publishing an article with no `publishedAt` sets it to today | The same |
| A published article's slug, section and status can change like a draft's; the address it leaves isn't redirected. Only a draft can be deleted | The owner's call ([sections spec D11](../sections/spec.md#9-decisions)): simple moves matter more than old links on a site under construction |
| A new ID and slug come from the title: lowercase, hyphenated, unique among articles and among the section's children | IDs never change after that ([model §1](../content/model.md#1-conventions)) |
| The Markdown subset is parsed to an inline tree and written back by one serializer, with backslash escapes (`\*`, `\_`, `` \` ``, `\[`, `\]`, `\\`) and double backticks for code that holds a backtick | What's typed on the page renders as typed; the site renders the same tree |

## 10. The design system in the editor

- **Tokens only.** The editor's styles read the site's tokens: its colour roles, type, space, radii, motion and layers. Its own dimensions and timings are component tokens in `tokens.json`, in groups owned like the site's (`site.owner`):
  - `c.editor`, shared: what several parts or scripts read (the top bar, the outline and inspector widths, the inspector's list of sections, the picture grids' cells, the section and scope lists, the upload preview, the wait signs' timings);
  - a group for each part that alone reads its values: `c.editor-layout` (EditorLayout: the side navigation), `c.editor-context` (CanvasChrome: the table's context menu), `c.editor-device` (CanvasFrame: the tablet and phone widths), `c.editor-crop` (CropDialog: the stage, veil and handles) and `c.editor-pattern` (IconPattern: the watermark; its script reads the cell and icon sizes through the part's own `--pattern-cell` and `--pattern-icon`). The Access screen's list width is now the SplitView compound's (`c.split-view`, 19 October 2026).

  A part reads only the shared group and its own; a script owns nothing, so it reads only the shared group. Every name starts `--c-editor`. The token build writes all of them to their own stylesheet, `editor-tokens.css`, which only the editor imports, so they never reach a production page. The design-system unit test covers `src/site/editor/` like the rest of the site: no raw values, hover inside `@media (hover: hover)`, scripts through `page.ts`, `withBase` for every URL.
- **Components:** the editor draws every control through the site's fundamentals and compounds (Button, IconButton, TextField, Select, Switch, Checkbox, Radio, ChoiceGroup, FileField, Slider, Tag, Text, Heading, Icon, Image, Spinner, Progress, ScrollArea, SideNav, Breadcrumbs): no part, kit piece or the layout writes a `<button>`, `<input>`, `<select>`, `<textarea>` or `<dialog>` (a test fails on one; an exception would be named there with its reason, and there are none). Six fundamentals were added for what edit mode needed, each with its story:
  - **RowButton:** a row in a list that shows or picks what it names (the inspector's lists of sections, the outline's blocks): a name, a detail line and an optional icon; current or pressed.
  - **TileButton:** a tile that picks what it holds: outlined (the block palette, Turn into), framed (the media grid and the picker), chip and thumbnail (the themes panel's swatches and pictures); given an address it's a link with the same frame (Add slide's sources, which open their preview).
  - **MenuItem:** a command in a `role="menu"` (the table's context menu on the canvas).
  - **RadioCard:** a radio drawn as a card (the themes panel's themes and palettes).
  - **ColorField:** the system's colour input as a swatch beside its label (the themes panel's colours).
  - **HiddenField:** a value a form carries without showing it (a rich field's Markdown, an ID sent back).

  Two generic compounds were added earlier, because the site will use them too:
  - **Dialog:** a native modal `<dialog>` with a title, a body, actions and a close button; focus goes in and comes back; Escape closes it.
  - **Tabs:** the APG tabs pattern (automatic activation, arrow keys, Home and End).
- **Tiers:** the editor adds two tiers on top of the site's:
  - its **kit** (`src/site/editor/kit/`): the pieces several parts are made of, made of fundamentals, compounds, tier 0 and the editor model (never a part or another kit piece). It holds:
    - a form and what's in it: Form (a column of fields, a set space apart; it can fill its panel), IssueNote (what went wrong, said where it happened, as a script sets it), FormFoot (a form's actions kept in view at the bottom of what scrolls), Fieldset (a named group of choices without a box), RichField (words edited as they'll read, drawn as a TextField is), StatusNote (a muted line a script keeps up to date) and PictureField (a picture with its words and actions);
    - a form in sections, as the inspector draws them: Sections (narrow, every section in turn; from 40 rem, a container query on itself, the list of sections ruled off beside the chosen one), NavGroup and NavRow (the list), Pane and PaneGroup (a section, and a collection's items; the insert dialog's new collection uses them too);
    - panels and lists: Panel (a raised, ruled card, as a section, a form or a group, with a positive or negative edge), PanelGrid (cards side by side, as many as fit), ListPane (a list-and-details screen's list column: sticky under the top bar, scrolling whole, by its last part, or, with `scroll="rows"`, drawing the settings row, the Add action and the scrolling rows itself), ListLink (a row in that list: a name, lines under it, a mark (`icon`, or a face or picture in its slot) and a count), DetailPane (the details column: the chosen item's heading, its line, its own actions, then its form; [list and details](list-and-details.md)), PlainList (a list without bullets, its items a set space apart), Grip (a drag handle) and ChoiceTiles (a heading over tiles that each carry a choice: the block palette, Turn into);
  - its **parts** (`src/site/editor/components/`): made of fundamentals, compounds, the kit and tier 0 (never a site layout, another part, or the game).

  Pieces the website could use too went to its compounds instead (design-system review, decisions): **SplitView** (a list beside the details of what's chosen in it: every collection screen, [list and details](list-and-details.md)) and **ActionBar** (a row of actions, at the start, at the end or apart). A recipe no component can hold (it styles a part's own element, or what the browser writes) is written once in `src/site/styles/editor-recipes.css`, keyed by a data attribute as the site's `base.css` keys its own, and imported by EditorLayout alone, like `editor-tokens.css`: `data-busy-line` (a region drawn again from the server: the line along its top past the delay; `sticky` in a region that scrolls), `data-drop-line` (where a dragged row would land: `flush`, `close` or `spaced`, by how far apart the rows are), and a rich field's paragraphs. A script finds a piece by a data attribute (`data-editor-form-issue`, `data-link-name`), never by a class it doesn't draw.

  Its layout and pages compose parts; its pages carry no styles. A big part is split into parts the page composes through slots: the inspector is a frame (Inspector) with a BlockForm for each block (a set's SetFields or a collection's CollectionFields inside it) and the PageForm; the Access screen's details (GrantDetails) take what a grant opens (GrantScope) in a slot. Logic beyond wiring goes in `src/site/editor/model/` (the inspector's choices in `inspectorFields.ts`, a page's kinds and a quote's styles there too, what a grant opens in `access.ts`'s `scopeChoices`, how someone gets in in its `KIND_CHOICES`).
- **Documented like components:** every part and kit piece has a doc comment (a summary, `@tier editor` or `@tier kit`, `@a11y`, `@key` for its keys), a comment on every prop, and a story in `src/site/editor/stories/<Name>.stories.astro`, made of the design library's `<Example title>` blocks and showing every option of every union prop, with sample data from `stories/samples.ts` (made-up pages, people and codes, and the design library's sample paintings: never the content). The website's design library doesn't list them; the **parts library** does: a screen of edit mode's own (`/_edit/library/`, Checks in the side navigation, on a source checkout only, like Tests), with a page per piece (`/_edit/library/<name>/`) built from `server/library.ts` as the design library's pages are from its registry: the piece's examples with their code, its props table and its accessibility notes and keys. Like every edit mode route it's injected by `integrations/editor.mjs` in dev alone, and only its page imports the stories, so none of them reaches a build.
- **Checked:** unit tests enforce all of it: the tier rules in `siteDesignSystem.test.ts`, and in `editorDesignSystem.test.ts` the controls (a self-closing data script hides nothing from the check; the one exception, the focus point's invisible target in MediaDetails, is named with its reason), the shared pieces (no class among the old vocabulary, `issue`, `actions`, `split`, `form`, `row`, `list` and the classes the kit replaced, is defined in 3 or more parts and kit pieces; fewer than 10 identical declaration blocks copied between them, measured by `scripts/lib/cssCopies.mjs`, which `scripts/design-system-audit.mjs` uses too), the recipes stylesheet (tokens only, edit mode's alone), the size limit (markup and script at most 350 lines, the whole file at most 650, as the site's components), the token groups' owners, and the documentation (the website's documentation test, run on every part and kit piece; no story without a piece; the stories' imports; nothing outside edit mode imports them).
- **What ships:** the generic Dialog and Tabs ship with the design system (the design library shows them). Nothing else of the editor does: no route, script, stylesheet, token or marker. The production check searches `dist/` for the editor's sentinels (`/_edit`, `editor-block`, `--c-editor`, `data-editor`).
- **Icons** come from the site's Duotone set, imported one by one (the editor's: edit, drag handle, duplicate, delete, undo, redo, the device widths, upload, publish, the block kinds, bold, italic, code).

## 11. The critique, and what changed from v1

v1 was the first sketch: a React editor over the same files, content imported through `import.meta.glob`, blocks marked on the canvas by wrapping elements, and page forms posted and re-rendered. Reviewing it against the stack and the goals changed it as follows.

| # | v1 | The problem | v2 |
|---|---|---|---|
| C1 | Content JSON imported through `import.meta.glob` (as the first article did) | The dev server reloads every open tab when a server-only module changes: every save would reload the editor, mid-typing (verified in Astro 7's `hmr-reload` plugin) | Content read from disk; the integration clears the route cache and reloads only on external edits (§8.4) |
| C2 | A React single-page editor | It would duplicate the design system in React components that drift from the Astro ones | Server-rendered Astro screens from the design system's own components; thin client controllers (§8.6) |
| C3 | Wrapping each block in an editor element on the canvas | Prose's spacing and breakout rules select direct children: a wrapper changes the layout, so the canvas would lie | A marker-free canvas with a block map (§3.1) |
| C4 | Inspector forms posted to the page and re-rendered | Re-rendering while you tab to the next field races your typing | Client-side document operations, shared with the server; the API validates; regions re-render only after structural changes (§8.6) |
| C5 | New blocks saved empty, filled in later | The contract (rightly) refuses a figure without a picture or an empty paragraph, so the build would break | Blocks that need something ask first; paragraphs and headings are pending until they have words (§3.4) |
| C6 | Drafts not placed in the structure until published | An article's section would have nowhere to live while it's a draft | A node may place a draft; the build skips it (§9) |
| C7 | Uploaded pictures imported through `import.meta.glob` | Adding a file re-evaluates the glob and reloads every tab; a restart was needed for new images | In dev, the metadata comes from sharp; the build still imports (§8.3) |
| C8 | The API trusted anything reaching the dev server | A dev server can be reached by other pages (CSRF) or other hosts (DNS rebinding, `--host`) | The loopback, Host, Origin and header guard, on every route (§8.2) |
| C9 | Publish ran `git commit -a` | It would sweep code changes into a content publish | Pathspec-limited commit of `content/`, after the contract check; no force; refuses without an upstream (§7) |
| C10 | Editor tests against the real `content/` | Tests would rewrite the site's content and push it | `CONTENT_ROOT` points the source and the store at a fixture copy in a throwaway git repository with its own remote; the editor's E2E runs on its own dev server and Vite cache ([plan §4](plan.md#4-tests)) |
| C11 | Last write wins | Editing the JSON by hand while the editor is open would be silently overwritten | Versions and 409 on conflict (§8.3) |
| C12 | A slug change or a move applied silently | It breaks links until redirects exist | Published addresses fixed until redirects exist (§3.5, §5, §9) |

A second, independent review of that v2 then found these, all now in the spec:

| # | Found | Now |
|---|---|---|
| R1 | A hostile page could frame the editor and trick a click into a write | `frame-ancestors 'self'` and `X-Frame-Options` on every editor response (§8.2) |
| R2 | Polling modification times leaves a stale window after a save, and the repository's own cache ignores the route cache | A content generation advanced on commit (§8.3) |
| R3 | Skipping drafts would hide a route collision and leave the canvas without its section | Every node resolved and checked; only published ones built (§5, §9) |
| R4 | A full reload on external edits could wipe unsaved editor input; time-window self-detection races | A custom event; editors show the conflict; self-writes matched by path and hash (§8.4) |
| R5 | Reading from the working directory is brittle, and `CONTENT_ROOT` in a build would mix two trees | The root from Astro's config; `CONTENT_ROOT` dev and test only (§8.1) |
| R6 | A text block can render several paragraphs, so "a block" and "a paragraph" disagreed; hand-kept counts drift | One paragraph or list per text block; comment markers on the canvas (§3.1, §9) |
| R7 | A regex renderer can't round-trip nested marks | One inline tree, one parser, one serializer; compared by meaning (§3.2, §9) |
| R8 | Overlapping saves, input methods, drops and the drop cap | One save queue; composition-safe; `beforeinput`; drop cap off while editing (§3.2) |
| R9 | Native and document undo can't be handed over reliably; Ctrl+E and Ctrl+D are the browser's | Document undo outside text editing; history steps defined by change, not by save; other keys (§3.3) |
| R10 | Renaming files one by one isn't a transaction | A writer lock, version checks, ordered renames with Windows retries, rollback (§8.3) |
| R11 | Only article saves carried versions; who owns the dates was unclear | Versions for every touched file; the server owns IDs, statuses and dates (§8.3, §9) |
| R12 | A published slug change or deletion contradicts V9 while redirects don't exist | Published addresses fixed (§9) |
| R13 | "Unused" media wasn't defined, and an upload's two files weren't one write | One reference graph over every resource and state; master and sidecar in one transaction; decorative offered (§6) |
| R14 | git can prompt and hang the server; a failed push vanished from the change list | No prompts, a time limit, commits not pushed tracked, Push again (§7) |
| R15 | Publish could commit files changed after the check | Under the writer lock, the staged hashes checked against the checked files; LF by `.gitattributes` (§7) |
| R16 | The article editor needed the media picker, planned for a later phase | The picker for existing media moves into the article editor's phase ([plan](plan.md)) |
| R17 | Playwright starts its servers before global setup, so the fixture wouldn't exist | A wrapper that builds the fixture, then starts the editor's dev server ([plan §4](plan.md#4-tests)) |
| R18 | The editor's components didn't fit the tested tiers | An explicit editor tier, tested (§10) |
| R19 | `c.editor` tokens in the global stylesheet would ship | Their own stylesheet, imported only by the editor (§10) |
| R20 | Kind `talk` and visibility weren't really editable | Visibility, menu label and review date in the Page tab; `talk` read-only until its contract exists (§3.5) |

## 12. Accessibility

- Every action has a keyboard path (§3.2, §3.3); drag always has a button and key alternative (WCAG 2.5.7).
- The screens use the design system's accessible parts: labelled fields with hints and errors, the APG tabs, the native modal dialog, and the page handles on Sections and Planet (a button each: Alt+Up and Alt+Down move the page, Enter or a click opens Move). The inspector's separator is the APG window splitter (named, its width as its value, Left, Right, Home and End); its list of sections is a named navigation of buttons, each section a region named by its heading.
- The save status and every error are announced in a live region; a refused value is named with its field.
- Focus is never lost: after a structural change the selected block keeps focus; after a dialog closes, focus returns to what opened it.
- The editor passes axe in light and dark, like the site.

## 13. As built

Built to this spec (the evidence for each point of the Definition of Done is in the [plan, §6](plan.md#6-status)). What the build added or settled:

- **Shared pieces and the parts library (19 October 2026).** The vocabulary each part rebuilt for itself (the issue note in 19 parts, the action bar in 17, the form in 12, list rows and lists, the list-and-details layout in 3) became components: two website compounds (SplitView, ActionBar), the kit's new pieces and the recipes stylesheet (§10). Identical declaration blocks copied between parts went from 56 to 9. Small unifications came with it: an issue note is always the note type (`--type-note`), a list row's padding and gap are one size on the Sections, Recommendations and Access screens, a rich field draws its label, Optional and hint as a TextField does, and the insert dialog's new collection uses the inspector's own sections. Every part and kit piece has a story, on the parts library (`/_edit/library/`).
- **Whole, square editorial previews (13 October 2026).** MediaGrid, MediaDetails and every Inspector image pass `display="fit"` and `rounded={false}` to the Image fundamental. This includes gallery/carousel items, collection pictures, figure and video posters, the lead picture, the thumbnail and portrait. The same MediaGrid makes the picker consistent; neither the canvas nor public-site styling changes (§6).
- **Measured (13 October 2026).** Every dev request is timed with named spans (`integrations/perf.mjs`, `src/site/content/timing.ts`; `GET /_edit/api/perf`, `Server-Timing`), and the client names its waits (`editor:save`, `editor:swap`, `editor:canvas`). `npm run perf:bench` measures every screen and nine interactions on the fixture against a committed baseline ([measuring performance](../engineering/performance.md)). The baseline, what makes edit mode slow and the plan are in [the performance report](../engineering/performance-report.md); the feedback rules every wait follows are in [perceived performance](../engineering/perceived-performance.md).
- **The way in.** Every page the dev server shows has an icon button in its header, just before the colour theme switch and drawn like the header's other quiet icon buttons: Edit this page on an article, Edit this section on a section, Edit mode anywhere else, the label being its accessible name and its tooltip (`scripts/launcher.ts`, injected with `injectScript` in dev only; it asks the API where a page leads). A page without the site header gets it floating in its lower corner. It never changes the header's layout, so the dev server's header looks like the site's: where the header has no room for it, it sits over the free space before the switch, taking none, and where that would cover the name or a section, it floats in the corner too (placed again as the header resizes). It sits in a shadow root with token-only styles, so it can't change the page it's on, and hides in the canvas and on the planet.
- **One theme for all of edit mode.** The top bar's theme switch (on every screen) is the site header's: it sets `site.theme`, and the whole of edit mode changes with it, not only the canvas. Every page of the site follows a theme chosen on another (the `storage` event, `followTheme` in `scripts/theme.ts`), so the canvas, and any other open tab, change at once. It replaces v2's canvas-only "Dark page" toggle, at the owner's request.
- **Screens that change in place.** A screen re-renders the regions a change affects by fetching itself and swapping them (`swapRegions` in `scripts/client.ts`), and the counts of changes to publish (the top bar's and the navigation's) come along every time. What left the page stops listening (the swap signals `astro:after-swap`, which `each` aborts on).
- **A resizable inspector in two columns** (8 October 2026, at the owner's request). The studio's separator (`Studio.astro`, `scripts/resize.ts`; its rules pure in `model/inspector.ts`) sets the inspector's width, kept in `localStorage['editor.inspector.width']`. The inspector is a size container: from 40 rem (the `sm` breakpoint, so the design system's breakpoint rule holds) its forms show their list of sections beside the chosen one (`scripts/inspector.ts`). Sections are server-rendered panes with a matching list, so a narrow inspector is unchanged but for its section headings and rules. The `c.editor.inspector-max`, `inspector-nav` and `canvas-min` tokens size it. Sections are never named as a field is (a region named Cells beside a field named Cells would confuse a reader, and a test): Rows and columns, Caption and credit, Layout and width.
- **Media:** the library is a grid grouped by folder beside a details pane that stays in view (the layout's `aside` slot, scrolling on its own when taller than the screen). The focus point is set by a click on the picture, or by the arrow keys (5% a step; Home for the centre). The address keeps the open picture (`?id=`), so Back works. Uploads in the library go to `shared`; in the picker, to the article's own folder (or `site`, `people/<id>` from the settings).
- **Picture shapes and the crop** (30 September 2026, at the owner's request: a card had cropped a wide picture badly). Cards show a page's picture whole in a 3:2 frame; a page gained a Thumbnail (its cards' picture, the lead picture when empty); the lead picture's and the thumbnail's fields give their shape and sharp size as a tip, with a note on the picture in them; and every picture field, and the library, has Crop (§6.1), which makes copies and never changes an original. The shapes are single-sourced in `src/site/design/pictures.ts`, which the components frame to. The lead picture's crop on the page now uses its focus point, which it had ignored.
- **Sections and Planet** share one pattern (`SectionManager.astro`, `scripts/manager.ts`): the list of sections beside the chosen one's Pages and Settings tabs, its pages a list with a drag handle, a checkbox, Find, Show, a selection that moves together, Alt+Up and Alt+Down, and a Move dialog; a page dragged onto a section in the list moves there. It replaced v2's tree beside a settings pane (a page couldn't move between sections in one gesture, and there was no way to work on many pages at once), and then a board of columns, dropped the same day because its cards were cramped. Published pages move like drafts, and nothing is redirected ([sections spec D11](../sections/spec.md#9-decisions)).
- **Settings** has two forms, each saving its own file: the site (name, description, positioning, contact email, social image) and the owner's profile (name, role, bio, portrait, links as rows you add and remove).
- **Access** (6 October 2026; [access spec §8.1](../access/spec.md#81-sharing-the-access-screen), D22) is the Sections pattern for grants: the list (`AccessManager.astro`), grouped by state with Find, Show and Kind, stays in view beside the chosen one's details (`GrantDetails.astro`), which are swapped in without a reload (`?grant=<id>`, the `access-detail` region). One form saves who it's for, why, notes, what it opens and its last day; Save changes stays at the foot of the screen. What it opens is every section in collapsible groups with its private pages and a search. Withdraw now and Delete each ask in a dialog. Sharing left Settings.
- **Publish** lists the changes as resources: a picture's master and sidecar are one row, discarded together in one transaction, so the check sees the result as a whole (discarding a picture an article still uses is refused, with the reason). The message offered names what changed ("Content: Do what makes you proud, 2 pictures, the site settings"). After a publish the screen shows the commit and a link to the deploy on GitHub Actions (made from the remote's address); after a failed push, why, with Push again.
- **The reference graph** (`model/references.ts`) is one function over the content index: articles in any state (lead pictures, blocks, video posters, social images), people's portraits and the site's social image. Used in and Delete read it, and the content check now also refuses a site settings file whose social image doesn't exist.
- **The save queue** is `model/queue.ts`, unit-tested: one save at a time, requests made meanwhile folded into the next, a conflict stops it for good, and a save that throws (the network) leaves it free for the next.
- **Pasting Markdown** (§3.2) replaced v2's "paste is plain text, a blank line splits": Markdown written elsewhere (the owner drafts in Markdown) arrived with its `###` and `**` as literal characters. The canvas decides only what a paste is (`kindOf`: nothing, plain words, or blocks) and hands blocks to the editor with the words either side of the caret; the editor places them (`pasteAt` in `model/paste.ts`), one step in the history. A paste into a new, still-empty paragraph works the same way.
- **Pasting a rich copy** (§3.2) replaced "formatting from elsewhere never comes in": a copy from Word, Docs or a web page lost its bold, italic and lists, because only the plain text was read. In a text block the canvas now reads the clipboard's HTML first (`DOMParser`, then `blocksFromHtml` in `model/richPaste.ts`), falling back to the plain text as Markdown when the HTML has nothing or is a code editor's (all monospaced); either way the same blocks reach the editor. A list takes the paste's lines as items (`linesOf`), written straight into its items as the canvas's own elements and sent as an edit. Headings, quotes and captions are plaintext-only, so they get only the words, as before.
- **Albums** (gallery G1, G5, G9, G10; [the gallery spec §20](../gallery/spec.md#20-as-built)). New album, an album's Page, Items and Up front views, and Album settings (§4.1); Album in the block palette (§3.4); SVG drawings, refused formats, the date taken, Keep it large, Make it standard and Find the focus in Media (§6); suggested alt text in Media's upload and details and an album's batch upload ([AI services](ai-services.md)). The arranger (Up front) is built (G6). The redesign replaces these views with the Albums screen and the album editor ([the gallery spec §21](../gallery/spec.md#21-from-the-first-build)). Tests: `editorAlbum.test.ts`, `albumBlock.test.ts`, `altText.test.ts`, `aiAlt.test.ts` and `editorServer.test.ts` ("gallery uploads"); the E2E groups "editor: albums", "editor: albums: the album block", "editor: gallery uploads" and "editor: suggested alt text".
- **Windows:** git is asked for the content folder's place in the repository (`rev-parse --show-prefix`) rather than a path computed from two spellings of one folder (short names like `PRABIN~2`, junctions); pictures are read with sharp from their bytes, never their path, because sharp keeps files it opened by path open and Windows then refuses to replace or delete them.
- **The design library** shows every component token except `c.editor`: edit mode is dev only, and the production check searches `dist/` (except the published docs) for its sentinels.
- **Tests:** the unit tests are `editor.test.ts` (the guard, the store), `editorModel.test.ts` (document operations, pasted Markdown, the DOM to Markdown, the structure, IDs, the names, the reference graph, the queue), `editorRichPaste.test.ts` (rich copies from the web, Word and Docs as blocks) and `editorServer.test.ts` (uploads through sharp, a crop chosen before an upload, SVG, GIF and TIFF, details, Replace, Delete, git against a temporary repository and bare remote, the integration), and `editorUpload.test.ts` (the upload form's rules: formats, pastes, names, the preview's line), and `editorStatus.test.ts` (the save status's words); `editor.test.ts` also holds that a write is pushed with the tab that made it. The E2E group is the Playwright project `editor` (`npx playwright test --project=editor`), on the fixture server (`scripts/editor-test-server.mjs`, port 4330), reset between tests.
