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
> - **Pages move freely:** a page's slug, section and status can change at any time, published or not. Its address follows, and the old one simply goes, with no redirect (the owner's call). Only a draft can be deleted.
> - **Publishing:** the Publish screen lists what changed in `content/`, checks it all, commits just those files and pushes. Discard puts a file back as it was last published.
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

| Screen | Path | What it's for |
|---|---|---|
| Dashboard | `/_edit/` | What's in draft, what changed since the last publish, what needs attention (missing alt text, unplaced articles), and the quick actions |
| Pages | `/_edit/articles/` | Every page of every kind (Article, Page, Gallery), open and private together, with its kind, section, status and last update; search and filters (status, kind, who can see it); new, duplicate and delete |
| Article editor | `/_edit/articles/<id>/` | The canvas, the outline and the inspector (§3) |
| Sections | `/_edit/sections/` | The site structure: sections, what each holds and in what order, each one's view and whether it's in the navigation; pages not yet on the site (§5) |
| Planet | `/_edit/planet/` | The planet's seven buildings: each one's words, view and section on the site, its pages in order, and the pages not on the planet ([sections spec §7.4](../sections/spec.md#74-planet-new-screen-u12)) |
| Navigation | `/_edit/navigation/` | The top navigation: a preview of the header, its entries in order (sections, pages, custom links), their labels, and adding, moving and removing them ([sections spec §7.3](../sections/spec.md#73-navigation-new-screen-u5)) |
| Media | `/_edit/media/` | The media library: upload, alt text, captions, credits, focus points, where each picture is used (§6) |
| Settings | `/_edit/settings/` | The site settings and the owner's profile |
| Access | `/_edit/access/` | Every access code and magic link that opens private pages, grouped by state beside the chosen one's details: made, changed, withdrawn and deleted there ([access spec §8.1](../access/spec.md#81-sharing-the-access-screen)) |
| Save to remote | `/_edit/publish/` | What changed in `content/` and `private-pages/`, the contract check, discard, publishing drafts, and saving to remote (§7) |

A private page ([access spec §2](../access/spec.md#2-private-pages)) is a page like any other: it's listed, filtered, moved and edited on these screens, tagged Private, and there's no screen of its own. Who it's shared with (the access codes and magic links) is the Access screen's.

Every screen shares one frame: a side navigation to the screens, and a top bar with the screen's title, the save status and the number of unpublished changes (linking to Publish). To the content model a page is an article whose `kind` is `page` (About, Contact; [model §3](../content/model.md#3-content-item-types)), so pages are listed with the rest and filtered by kind.

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
- **Every change reaches every open page** (§8.4): the server pushes each change, with the editor tab that made it, to every page the dev server shows.
  - A **page of the site** reloads once the changes settle (typing saves about once a second), so an open article shows a caption saved in Media at once.
  - The **article editor** takes in a change to its own article from another tab or from disk at once (the outline, the inspector, the canvas and the versions it saves against) when nothing here is unsaved; with unsaved typing, it stops its saves and shows the conflict (§8.3), so nothing is lost or written over. Anything else it shows (a picture's caption, the sections, a page it links to) comes in once the typing stops.
  - **Every other screen** draws itself again (its `screen` region). With unsaved input, a text field in use or a dialog open, it keeps what's being typed, says it's behind, and catches up once that's saved, put away or left.
  - A tab's own saves come back to it as its own (the `X-Editor-Tab` header), and a page drawn after a change (one that reloaded after its save) knows it has it already (the content generation), so neither is told twice.

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

- **It's the real page.** The canvas is an iframe showing `/_edit/canvas/articles/<id>/`, which renders the article with the same layout, components and pictures as its public route. It renders drafts too. Its DOM is the production DOM: nothing wraps a block, so every spacing rule applies as it will on the site. Before each block the canvas route writes an HTML comment (`<!--editor-block:3-->`), which no selector sees, and the canvas finds each block's elements between two of them. Every block renders exactly one element: a text block is one paragraph or one list (§9).
- **Selecting.** Hovering a block outlines it and names its kind; clicking selects it (a firm outline, its toolbar, its settings in the inspector, its row in the outline). The title and the standfirst select as the page's own fields. Links, the lightbox, carousels and the video facade are inert while editing; the Preview toggle in the top bar turns the overlays off and the page back on.
- **The block toolbar** sits on the selected block's top edge: the block's kind, then Move up, Move down, Turn into (text and collections), Duplicate, Add a block below and Delete. Each is a square icon button with rounded corners and its name as a tooltip, and the kind's label is as tall as the buttons.
- **Adding.** In the space between any two blocks, above the first and below the last, a "+" appears while the pointer is there (never over a block, so it doesn't come up while you read or select one), on an accent line across the gap, as wide as the blocks either side (the narrower: the text column beside a wide picture), marking exactly where the block will go; or on focus. It opens the block palette (§3.4) for that position. It never sits under the block toolbar: where the toolbar covers the middle of the line, the "+" moves to the line's start, just outside the column when there's room (clear of the words), else just inside it.
- **Width and theme.** The top bar switches the canvas between desktop, tablet and phone widths. The colour theme (match the system, light or dark) is the site's own choice, set by the switch in edit mode's top bar on every screen: it changes the whole of edit mode, and the canvas follows, as every open page of the site does.

### 3.2 Editing text on the page

Paragraphs (text blocks), headings, quotes, the title and the standfirst are edited in place.

| Key | While editing text |
|---|---|
| Ctrl or Cmd + B, I | Bold, italic |
| Ctrl or Cmd + K | Link: a small dialog for the address (https, http, mailto) or another article (a `ref:` link) |
| Enter | In a paragraph or heading: a new paragraph (a new text block) after it, split at the caret. In a list: a new item, taking the words after the caret; on an empty last item, the list ends and a new paragraph starts after it |
| Ctrl or Cmd + Enter | A new paragraph after the block, its words kept whole: the way out of a list from any item |
| Shift + Enter | A line break (the poem) |
| Backspace at the start | Joins the paragraph to the one before it |
| Escape | Stops editing; the block stays selected |

- **A format bar** appears over a text selection with Bold, Italic, Code and Link, for the mouse. Inline code has no shortcut: the browsers keep Ctrl+E and Ctrl+Shift+C for themselves.
- **Paste keeps the formatting the site has.** A paste becomes the closest blocks and marks the site supports, whether it comes as a rich copy or as Markdown; what the site can't show (colours, fonts, sizes, underline) never comes in, and a copied picture on its own goes to the upload form (§6). The canvas handles `beforeinput` and reads the clipboard itself:
  - **A rich copy** (a web page, Word, Google Docs, a chat, another page of the site) is read from its HTML: H1 and H2 a heading 2 (the title is the page's one H1), H3 a heading 3, H4 to H6 a heading 4; paragraphs with their bold, italic, code and links, whether written as elements (`b`, `strong`, `i`, `em`, `code`) or as styles (a bold `font-weight`, an italic `font-style`, a monospaced font, as Docs and Word write them; Docs' outer `<b style="font-weight:normal">` isn't bold); bulleted and numbered lists, Word's list paragraphs among them, a nested list's items joining their parent list (the site's lists are one level); a quote's words; a rule a divider; a preformatted block its lines as code; and a table's rows as paragraphs, their cells side by side. A copy from a code editor (all of it monospaced or preformatted, as VS Code copies) is left to its plain text, so Markdown copied from one arrives as Markdown. Prose that keeps its white space (`pre-wrap`, as chats and mail write it) isn't code: its line ends become line breaks and its links and marks stay. A link copied from the canvas keeps what was written, a site page's `ref:` too.
  - **Plain text** is read as the site's Markdown (from a `.md` file, a note or a chat): `#` and `##` a heading 2, `###` a heading 3, `####` and beyond a heading 4, each keeping only its words (`### **Challenge**` is "Challenge"); `-`, `*`, `+` and `1.` lines a list; `>` lines a quote, whose last line becomes its source when it starts with a dash; `---` a divider; a fenced block its lines as code; and every other paragraph one text block, its hard-wrapped lines joined and its bold, italic, code and links kept.
  - **Where it lands.** In a paragraph, anything more than plain words arrives as the blocks it describes, at the caret: the words before the caret join the first pasted paragraph, and the words after it the last, a space at the caret kept. In a list, each pasted line (a paragraph, a list item, a heading's words) becomes an item with its marks, the first joining the words before the caret and the last those after it. Plain words are typed in place; in a heading, a quote or a caption, only the words come in, marks off (they hold no marks). Pictures are left out (the announcement says so: they come from the media library), and a link the site can't follow (not https, http or mailto) keeps only its words. Pairs of a heading and its words, pasted, turn into a collection in one step (Turn into, below).
  - The rules are pure and unit-tested: `model/richPaste.ts` (HTML to blocks) and `model/paste.ts` (Markdown to blocks, placing them, the words and lines of a paste).
- **What's stored** is the Markdown subset ([model §6](../content/model.md#6-blocks)). One parser turns it into an inline tree (text, bold, italic, code, link, line break), which renders it on the site; the canvas turns the edited text back into the same tree, and one serializer writes it as Markdown, escaping everything else, so what you type is what renders. Bold and italic may nest; code holds plain text only; links hold text, bold and italic, and never another link.
- **Typing in another script** (an input method) is never interrupted: no shortcut, save or split runs while a composition is open, and the text saves when it ends.
- **The drop cap** is turned off while its paragraph is being edited, because its enlarged first letter moves the caret.
- **Saving** happens 800 ms after typing stops, on leaving the block, and on Ctrl or Cmd + S. Saves go through one queue per document, so two never race; text saves don't reload the canvas, so the caret stays put.
- **New paragraphs and headings** are pending until they have words: an empty one is never written, and it disappears if you leave it empty.

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

- **The outline** lists every block (its kind's icon, and its first words or its picture's alt text). Clicking a row selects the block and scrolls the canvas to it. Rows can be dragged to reorder; every drag has a keyboard and button alternative (Move up, Move down), as WCAG 2.5.7 asks.
- **Turn into, any time.** Any text block (a paragraph, a heading, a quote, a list) turns into any other kind of text, and back: from the block toolbar on the canvas, the inspector, the outline's selection bar or the keys above. Its words stay: a paragraph or a list keeps its bold, italic, code and links, a heading or a quote takes the plain words, a paragraph's lines become a list's items (and back), and a heading keeps its anchor, a quote its source, while only the level or the style changes. The choices, like the palette's, also make one block from several (one bulleted or numbered list; a collection laid out as tiles, from pairs of a heading and its words) and several from one (a list's items or a paragraph's lines as paragraphs; a collection's items as headings and paragraphs, with their pictures). A choice that doesn't fit what's selected isn't offered, or says why. Each is one step in the history.
- **Several blocks at once.** In the outline, Shift + click (or Shift + Up and Down) selects a range, Ctrl or Cmd + click adds or removes one block, Ctrl or Cmd + A selects them all, and Escape clears the selection. A bar over the rows says how many are selected, with Move up, Move down and Clear. The selection then moves together, one step at a time, in its order (a row's own Move buttons and Alt + Up and Down do the same; nothing moves past the start or the end). Dragging one of its rows drags them all, and Delete deletes them all. Each of these is one step in the history. The inspector shows the block clicked last; clicking a block on the canvas ends the selection.
- **Undo and redo** step through whole-document snapshots, one step per change: a block added, moved, deleted or reconfigured, a setting changed, or one editing session of one block's text (from entering it to leaving it). The history lasts for the browser session. While you're typing, Ctrl+Z is the browser's own undo within that text; the top bar's Undo first ends the editing session, then steps back. Picture details (alt text, caption, focus) belong to the picture, not the article, and aren't in the article's history: the media screen says so.

### 3.4 The block palette

A dialog listing the content model's blocks, in two groups, each with its icon and one line on what it's for. A block that needs something before it can exist asks for it first, so no block is ever saved incomplete.

| Group | Block | What happens when chosen |
|---|---|---|
| Text | Paragraph, Heading | An empty one appears in place, ready to type (pending until it has words) |
| Text | Quote | Asks for the quote (and, optionally, who said it and the style: block or pull) |
| Text | Collection | Asks for its layout, how its headings read, and up to three items (a heading, a subtext or words each; at least one item); pictures and more items are added in the inspector ([model §6.1](../content/model.md#61-collections-one-shape-of-content-any-layout)) |
| Text | Divider | Inserted at once |
| Media | Picture | Opens the media picker (choose or upload), then the width |
| Media | Gallery, Carousel | The media picker in multiple mode (two or more); a carousel also asks for its label |
| Media | Video | The media picker for videos: choose one, or upload one there and then (under 100 MB) |
| Media | YouTube or Vimeo | Asks for the address, the title and the poster (the media picker) |

### 3.5 The inspector

Two tabs, as the APG tabs pattern: **Block** (the selected block's settings) and **Page** (the article's). A change is saved when it's committed (on change, or on leaving a text field), after the contract check. A value the contract refuses stays in the field with the reason under it, and nothing is written.

| Block | Its settings |
|---|---|
| Paragraph | None: its words are edited on the page. Turn into any other kind of text (§3.3) |
| Heading | Level (2, 3 or 4); anchor (optional; made from its words if left empty) |
| Picture | The picture (media field: thumbnail, Replace, and its alt text); width (content, popout, wide, full); show the caption and credit (off: nothing under the picture, nor in the lightbox); caption and credit (each left empty to use the picture's own); open in the lightbox |
| Gallery | Its pictures (add, remove, reorder); layout (grid, mosaic, row); fit (cover, or contain for artwork); width; show the captions (off: no caption for the set, none for its pictures in the lightbox); caption; open in the lightbox |
| Carousel | Its pictures; label; peek; pager (dots, filmstrip, wrapping filmstrip); arrows; show the captions (off: none under any slide, nor in the lightbox); open in the lightbox |
| Video | A video file: the video (thumbnail, its title, Replace from the videos); title (left empty, the video's own); show the caption and credit; caption and credit (each left empty to use the video's own); width. An embed: address (YouTube or Vimeo; the provider and ID are taken from it); title; poster (media field); length (minutes and seconds); show the caption and credit; caption; credit; width |
| Quote | Style (block or pull); who said it. Its words are edited on the page |
| Collection | Its items (add, remove, reorder; one to 24), each with its picture (Add a picture or Replace, Crop, Remove picture), heading, subtext and words; layout (Rows, Columns, Tiles, Masonry, Carousel: changing it keeps the items, and shows only the settings that layout uses); columns (tiles and masonry); label (a carousel); headings (labels or titles); width; and for its pictures: Shape, Shown as, Colour behind them, Rounded corners, Drop shadow. Turn into headings and paragraphs |
| Divider | None |

**Page:**
- **Title and address:** the title, the menu label, and the slug with the address it makes.
  - Changing a published page's slug changes its address, and the old one simply goes (no redirect: [sections spec D11](../sections/spec.md#9-decisions)).
- **Summary:** at most 160 characters, with a counter. It is the standfirst, the card text and the meta description.
- **Kind, status and visibility:**
  - kind: page or note (a talk needs its event, date and recording, which the contract doesn't hold yet; an existing talk shows its kind read-only);
  - status: the lifecycle up to Published ([model §7](../content/model.md#7-lifecycle-and-visibility)); a published page can go back to Draft, which takes it off the site until it's published again;
  - visibility: public, public with details removed, or summary only.
- **Where it appears:** the section (hub) that places it, or "Not on the site yet". This edits the site structure, and can change at any time: the page's address follows its section.
- **Lead picture:** a media field, which can be removed; its caption (left empty to use the picture's own), and whether to show it; **Lead picture shown as** (Fill, Fit, Actual size or Tile), **Colour behind the lead picture**, **Lead picture's rounded corners** and **Lead picture's drop shadow** ([media §9.1](../content/media.md#91-how-a-picture-is-shown-fill-fit-actual-size-tile-a-background-corners-a-drop-shadow)). Under it, a tip gives its shape and the size it stays sharp at (21:9, at least 2400 × 1029 px), and a note says what the page does with the picture in it ("This one is 1024 × 576 px (16:9). The page crops it to 21:9 around its focus point…", and when it's too small). **Crop** opens the crop at 21:9 (§6.1).
- **Thumbnail:** the picture on its cards, shown whole in a 3:2 frame unless **Thumbnail shown as** says otherwise, with **Colour behind the thumbnail**, **Thumbnail's rounded corners** and **Thumbnail's drop shadow**; left empty, the lead picture. The same tip and note (3:2, at least 960 × 640 px), Choose or Replace, Remove, and **Crop**: with the field empty, it crops the lead picture into a 3:2 copy of its own, so one lead picture gives both.
- **A picture block, a gallery, a carousel and a collection** have the same four choices (Shown as, Colour behind it, Rounded corners, Drop shadow); a picture block and a collection also have **Shape**, the frame (its own, Square, Classic, Photo, Screen or Wide).
- **Search and sharing:** the SEO title, the description and the image, and whether to keep the page out of search.
- **Dates:** published, updated and last reviewed. The server keeps "Updated" and "Published" true (§9); a date set by hand in the same change wins.
- **Delete:** a draft can be deleted, and with it, if you ask, the pictures in its own folder that nothing else uses. A published article goes back to Draft first, then can be deleted.

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

## 5. Sections: the site structure

The site structure ([structures §2](../content/ia.md#2-the-site-structure)) in two columns: the sections listed on the left, and the chosen one on the right, with its **Pages** and its **Settings** as two tabs ([sections spec §7.2](../sections/spec.md#72-sections)). The Planet screen is the same pattern over the game's seven buildings ([§7.4](../sections/spec.md#74-planet-new-screen-u12)).

- **The list of sections:** the home page, each section with its address and how many pages it holds, and "Not on the site" (the pages that aren't in a section). It stays in view as the screen scrolls, and the address keeps the chosen section and tab.
- **Pages:** a row per page, in order, open and private together: a handle, a checkbox labelled with its title (its kind and address under it), its status (and Private) and Edit. A move that involves a private page writes the public structure and the private overlay together, and a private page can't be taken off the site ([access spec §8.2](../access/spec.md#82-sections-and-pages)). Find a page and Show (every status, published, not published) narrow the list; the checkboxes and Select all make a selection that moves together.
- **Moving pages:** drag a handle to another place in the list, or onto a section in the list of sections; Alt+Up and Alt+Down move a page within its section; a click on the handle (or Move selected) opens Move, with Move up, Move down and a button for every section. A published page moves like any other: its address follows its section, and the old one simply goes (no redirect).
- **Settings:** a section's title, its menu label, its summary, its slug and its view (List, Tiles or Bento: how it lists its pages, [sections spec §3.4](../sections/spec.md#34-the-section-view-u6)), a switch, In the navigation, that adds it to the top navigation or takes it out (the same menu the Navigation screen edits), and Move up and Move down (Alt+Up and Alt+Down on the section in the list do the same). New section, under the list, adds a section at the end, with its summary, its view and the switch (on), and opens it. The site is three levels, so there are no sections inside sections and no pages directly under the home page (V22).
- **The home hub** (Home page) has its title, its menu label and its summary: the home page's name and the line under it ([sections spec §3.5](../sections/spec.md#35-the-home-page-decision-o5)).
- **Drafts can be placed.** A node may place a draft: its route is resolved and checked like any other (so two drafts can't claim one address), and the build leaves it out until it's published. On the dev server it's served at its address, a preview with a Draft tag beside its topic (the article editor's **Preview it as a page**). So an article's section is chosen when it's created, and publishing it is only a status change (§9).

## 6. Media

- **The library** is a grid of every master under `content/media/` and, tagged Private, `private-pages/media/` (a private page's own), grouped by owner (an article, a person, `shared`, the site), searchable by alt text and ID and filtered by who can see it, with a warning on any picture without alt text. Every change to a picture or video is made where it lives, and an upload to a private page's folder goes into `private-pages/media/`. Selecting one opens its details (they save to the picture, so they aren't part of an article's undo):
  - the picture, with its **focus point**: click where the crop must keep, stored as `focus` ([media §3](../content/media.md#3-the-metadata-sidecar));
  - alt text (required unless marked decorative; at most 250 characters; never "image of"), caption, credit, licence and source;
  - **Used in**: every document that refers to it, linking to the editor;
  - **Crop**: Crop the picture (§6.1); a cropped copy links to its original, and an original lists its copies;
  - **Dark mode version**: add, replace or remove it (§6.2);
  - Delete, only when nothing refers to it: no article in any state (its hero, thumbnail, blocks or social image), no person and not the site settings.
- **Uploading** takes drag and drop, a file picker or a paste (Ctrl+V while the form shows, in the library or the picker), into an owner's folder (the article being edited, or `shared`). The chosen picture shows at once, as it will be uploaded: on a checkerboard so its transparency shows, with its size, its format and whether it's transparent. **Crop it** opens the crop dialog (§6.1) on the file itself; the crop goes with the upload (in the pixels the browser showed, which the server scales to the file's own) and is cut from the full-quality file before the master is made, and Undo the crop takes it back. It takes any picture: the server reads JPEG, PNG, WebP, AVIF, GIF (its first frame), TIFF and SVG (drawn at the master's full size); anything else the browser can decode (BMP, ICO…) is drawn into a PNG there first, its transparency kept, and a format neither can read (HEIC in Chrome) is refused with what to do. Each file asks for its alt text (or to be marked decorative) before it's saved. The editor then makes the master:
  - WebP (lossless if the source had transparency);
  - at most 2560 px on the long side and 1.5 MB (the budgets in [media §4](../content/media.md#4-formats-and-budgets));
  - metadata stripped (no location);
  - named from the file name (lowercase, hyphenated, unique in the folder; a pasted screenshot, often just "image.png", is `pasted-picture-<date>`);
  - with its JSON sidecar beside it, both written in one transaction.
- **A picture pasted in the canvas** (a screenshot, a copied image, with no text beside it) opens the picker with it in the upload form, previewed; uploaded, it becomes a figure after the block being edited (or in place of a new, empty paragraph). The rules (formats, what a paste holds, the names, the preview's line) are pure, in `model/upload.ts`, and unit-tested.
- **Videos** ([media §12](../content/media.md#12-video-files)) are uploaded from the same form: an MP4, WebM or MOV under 100 MB, GitHub's limit for a file. A bigger one is refused at once, before anything is sent (and again on the server), with how to make it smaller; one past 50 MB uploads with GitHub's warning. The chosen video plays in the form, with its size, format, length and weight; one this browser can't play is refused, since a reader's browser couldn't play it either. The form asks for its **title** (not alt text), and takes a frame from it as its poster. The server keeps the file as it is (a MOV becomes an MP4, its streams copied by ffmpeg; an MP4 gets its index at the front), and writes it, its poster and its sidecar in one transaction. In the library a video is a card with its poster, a Video tag and its length; its details are the video itself, its title, caption, credit, licence and source, Used in, and Delete (the video, its poster and its sidecar). The picker shows only what its field or block takes: pictures, or videos. A video file pasted in the canvas becomes a video block the same way a picture becomes a figure.
- **Media IDs never change.** There's no rename; replacing a picture keeps its ID and writes a new master.
- **The media picker** (in the article editor and the settings) is the same library in a dialog, with upload, in single or multiple mode, for pictures or for videos. The dialog fits the window and its library scrolls inside it. In multiple mode (a gallery, a carousel) the dialog's footer, always in view, says how many are chosen and how many it needs, and holds the button that adds them ("Use 3 pictures"); in single mode a press on a picture adds it.

### 6.1 The crop

The crop follows the pattern of the established editors (Photos, WordPress's image editor, Sanity's crop): the picture whole, and a box over what to keep.
- **The box** has eight handles; what it leaves out is veiled in the page's smoke, and a rule-of-thirds grid shows while it moves or has the focus. Dragging it moves it; a press elsewhere on the picture centres it there first; a handle resizes it from the opposite side (a corner keeps the shape and follows the pointer's further way; a side keeps the other axis centred).
- **Shape:** Free, Original, 1:1, 4:5, 3:2, 4:3, 16:9 and 21:9. Opened from a field, it starts at that use's shape (the lead picture's 21:9, the thumbnail's 3:2) with the use's tip above the picture; from the library, at Free.
- **Size** scales the box about its centre, from 5% to the largest of its shape. **Reset** goes back to the largest box of the starting shape.
- **The readout** gives the size it makes ("1024 × 439 px (21:9), from 1024 × 576"), a polite live region; a warning says when that's narrower than its use shows.
- **Keys** (on the crop area, which has the focus when it opens): the arrows move it by 1% of the picture (10% with Shift), + and − resize it, Home centres it. Shape, Size and a click to centre are the single-pointer ways (WCAG 2.5.7).
- **Save the crop** never changes an original ([media §9](../content/media.md#9-shapes-thumbnails-and-crops)): an original is cut into a copy beside it, which the field then uses (or the library opens); a cropped copy is cut again from its original and updated where it's used. The dialog says which before you save.
- **Built as:** `CropDialog.astro` and `scripts/crop.ts` (one dialog per screen, opened with `openCrop`), the geometry pure in `model/crop.ts` (unit-tested), and `GET`/`POST media/<id>/crop` (`cropSource`, `cropMedia` in `server/media.ts`), which cut with sharp and encode the copy as every master is. A picture's dark mode version (§6.2) is cut with it, from the same place.

### 6.2 Dark mode versions

A picture can have a dark mode version, shown on the site instead of it whenever the page is dark ([media §10](../content/media.md#10-dark-mode-versions)).
- **In the picture's details** (Media), under Dark mode version: with none, it says the same picture shows in both modes, and **Add it** takes a file (chosen or dropped; any format an upload takes). With one, the two show side by side, each on a page of its own mode (Light, Dark), with its size; **Replace it** and **Remove it** change it. A dark version of another shape is saved, with a warning in words that a page shifts when the theme changes.
- **The library** tags the pictures that have one ("Dark version").
- **Kept with the picture:** it's a second master, `<name>.dark.webp`, made like every master (WebP within the budgets, transparency kept) and named in the sidecar's `dark`, written with it in one transaction (`setDark`, `removeDark` in `server/media.ts`; `POST` and `DELETE media/<id>/dark`). Saving the details never changes it; a crop cuts it too (§6.1); Replace keeps it; Delete deletes it; deleting a draft with its own pictures deletes their dark versions with them; Publish and Discard treat it as part of the picture.

## 7. Publishing

**Two words, two actions** (6 October 2026). **Save to remote** sends your changes to GitHub (a commit and a push), which redeploys the site. **Publish** puts a page on the site: its Status becomes Published. A page only reaches readers when both have happened, so the Save to remote screen offers to publish the drafts it would otherwise leave behind. (Until then the screen and its button were called Publish, and a private page saved with it stayed a draft, which read as a failed publish.)

- **The Save to remote screen** (`/_edit/publish/`, "Save to remote" in the top bar and the navigation) lists every file in `content/` that differs from the last commit, as git sees it: added, changed or deleted. Each is named as its resource ("Article: Do what makes you proud", "Media: articles/…/tshirt"), with Discard, which puts it back as last committed and deletes a new file.
- **Publish pages:** every page placed in a section whose Status isn't Published is listed with a checkbox; a private page changed since the last save is ticked. A ticked page's Status becomes Published (and its published date is set) just before the commit, and the button says **Publish and save to remote**. With nothing else changed, ticking a draft is enough to save.
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
  - the body is JSON (or multipart for uploads, at most 20 MB).

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
- **Canvas refreshes:** the editor refreshes the canvas itself, only after changes that re-render it (a block moved, added or reconfigured, or a change made elsewhere), keeping its scroll position and selection. Text saves don't refresh it.

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
| `src/site/editor/components/` | The editor's parts (the outline, the inspector's fields, the media grid, the canvas frame, the section manager): built from the site's fundamentals, compounds and tier 0 only. A part never imports another part; the editor's layout and pages compose them |
| `src/site/editor/EditorLayout.astro` | The editor's frame: side navigation, top bar, live status |
| `src/site/editor/model/` | Pure and shared by the browser and the server: document operations (insert, move, duplicate, delete, split, merge, update), text to Markdown, IDs and slugs, the guard, the change list's names, the reference graph, the save queue |
| `src/site/editor/server/` | Node only: the store, uploads (sharp), git |
| `src/site/editor/scripts/` | The browser's controllers: the editor, the canvas, the screens, and the site's Edit button (the launcher, in a shadow root so it touches nothing of the page) |

- **One owner of the document.** The article editor's controller holds the article, applies each operation with the shared document operations, saves it through the API and tells the canvas what changed (by `postMessage`, same origin only). The canvas only reports what the reader did (selected, typed, asked to add or move) and redraws when told.
- **Forms are rendered by the server** with the design system's fields, one form per block and one for the page, so the inspector needs no client-side templating. The page re-renders its outline and inspector after structural changes by fetching itself and swapping those regions.

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

- **Tokens only.** The editor's styles read the site's tokens: its colour roles, type, space, radii, motion and layers. Its own dimensions are component tokens under `c.editor` in `tokens.json` (the panel widths, the canvas widths per device, the selection outline). The token build writes them to their own stylesheet, `editor-tokens.css`, which only the editor's layout imports, so they never reach a production page. The design-system unit test covers `src/site/editor/` like the rest of the site: no raw values, hover inside `@media (hover: hover)`, scripts through `page.ts`, `withBase` for every URL.
- **Components:** the editor uses the site's fundamentals and compounds (Button, IconButton, TextField, Select, Switch, Checkbox, ChoiceGroup, Tag, Text, Heading, Icon, Image, Spinner, Progress, ScrollArea, SideNav, Breadcrumbs). Two generic compounds are added to the design system, with stories, because the site will use them too:
  - **Dialog:** a native modal `<dialog>` with a title, a body, actions and a close button; focus goes in and comes back; Escape closes it.
  - **Tabs:** the APG tabs pattern (automatic activation, arrow keys, Home and End).
- **Tiers:** the editor adds one tier on top of the site's: its parts are made of fundamentals, compounds and tier 0 (never a site layout, another part, or the game); its layout and pages compose parts; its pages carry no styles. The design library doesn't list the parts (it lists only the site's tiers). A unit test enforces all of it.
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
- The screens use the design system's accessible parts: labelled fields with hints and errors, the APG tabs, the native modal dialog, and the page handles on Sections and Planet (a button each: Alt+Up and Alt+Down move the page, Enter or a click opens Move).
- The save status and every error are announced in a live region; a refused value is named with its field.
- Focus is never lost: after a structural change the selected block keeps focus; after a dialog closes, focus returns to what opened it.
- The editor passes axe in light and dark, like the site.

## 13. As built

Built to this spec (the evidence for each point of the Definition of Done is in the [plan, §6](plan.md#6-status)). What the build added or settled:

- **The way in.** Every page the dev server shows has an icon button in its header, just before the colour theme switch and drawn like the header's other quiet icon buttons: Edit this page on an article, Edit this section on a section, Edit mode anywhere else, the label being its accessible name and its tooltip (`scripts/launcher.ts`, injected with `injectScript` in dev only; it asks the API where a page leads). A page without the site header gets it floating in its lower corner. It never changes the header's layout, so the dev server's header looks like the site's: where the header has no room for it, it sits over the free space before the switch, taking none, and where that would cover the name or a section, it floats in the corner too (placed again as the header resizes). It sits in a shadow root with token-only styles, so it can't change the page it's on, and hides in the canvas and on the planet.
- **One theme for all of edit mode.** The top bar's theme switch (on every screen) is the site header's: it sets `site.theme`, and the whole of edit mode changes with it, not only the canvas. Every page of the site follows a theme chosen on another (the `storage` event, `followTheme` in `scripts/theme.ts`), so the canvas, and any other open tab, change at once. It replaces v2's canvas-only "Dark page" toggle, at the owner's request.
- **Screens that change in place.** A screen re-renders the regions a change affects by fetching itself and swapping them (`swapRegions` in `scripts/client.ts`), and the counts of changes to publish (the top bar's and the navigation's) come along every time. What left the page stops listening (the swap signals `astro:after-swap`, which `each` aborts on).
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
- **Windows:** git is asked for the content folder's place in the repository (`rev-parse --show-prefix`) rather than a path computed from two spellings of one folder (short names like `PRABIN~2`, junctions); pictures are read with sharp from their bytes, never their path, because sharp keeps files it opened by path open and Windows then refuses to replace or delete them.
- **The design library** shows every component token except `c.editor`: edit mode is dev only, and the production check searches `dist/` (except the published docs) for its sentinels.
- **Tests:** the unit tests are `editor.test.ts` (the guard, the store), `editorModel.test.ts` (document operations, pasted Markdown, the DOM to Markdown, the structure, IDs, the names, the reference graph, the queue), `editorRichPaste.test.ts` (rich copies from the web, Word and Docs as blocks) and `editorServer.test.ts` (uploads through sharp, a crop chosen before an upload, SVG, GIF and TIFF, details, Replace, Delete, git against a temporary repository and bare remote, the integration), and `editorUpload.test.ts` (the upload form's rules: formats, pastes, names, the preview's line), and `editorStatus.test.ts` (the save status's words); `editor.test.ts` also holds that a write is pushed with the tab that made it. The E2E group is the Playwright project `editor` (`npx playwright test --project=editor`), on the fixture server (`scripts/editor-test-server.mjs`, port 4330), reset between tests.
