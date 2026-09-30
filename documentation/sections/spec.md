# Sections, pages and the planet

How the site is organised into sections and pages, how its top navigation is set, how the planet maps the same pages onto its fixed buildings and shows them over the game, and how edit mode controls all of it. It also covers the words a visitor reads while the site is being built. The phases, tests and Definition of Done are in the [plan](plan.md). This is v2, revised after a review (§10).

> **TL;DR.**
> - **Honest words first.** Every placeholder a visitor could see, on the site or on the planet, now says what's there, what's coming and that the site is under construction. Nothing is invented and no date is promised (§2, done).
> - **Sections hold pages.** The site is exactly three levels: home, then sections, then pages. A section is a page of its own that lists its pages as a list, tiles or a bento box. A page is anything with its own address: an article, a custom page or a gallery (§3).
> - **The top navigation is data.** It lists the sections you choose, and any pages or custom links you add, in your order. It's never hardcoded (§4).
> - **The planet is a parallel universe.** Its seven buildings are fixed by the game, and each is a section of its own. You map pages to them, or leave a page off the planet; the site's sections aren't affected (§5).
> - **Reading on the planet uses the site's own pages.** Opening a building shows its list, and each of its pages, rendered by the same Astro layouts in a planet frame, over the game behind a white smoke in light mode and a black one in dark. You can move freely through that building's pages, but the only way to another building's is to walk there (§6).
> - **Edit mode controls it all:** sections and their views, a Navigation screen, and a Planet screen for the mapping, which is separate from the site's. Every change that touches a page, the site and the planet is written in one transaction (§7).

<details>
<summary>What was asked, and where it's answered</summary>

| # | The owner's request | Where | Phase |
|---|---|---|---|
| U1 | Update every placeholder, on the site and in game mode, to say the site is under construction and sections will be updated soon. Text only; whatever is there today must make sense | §2 | S1 |
| U2 | The classic site's top navigation is hardcoded; it should reflect the sections | §4 | S2 |
| U3 | The structure is sections, then pages | §3.1 | S2 |
| U4 | A section can get an entry in the top navigation | §4.1 | S2 |
| U5 | Separate settings for the top navigation: which sections are visible, and pages or custom links added directly | §4, §7.3 | S2, S3 |
| U6 | A section has a section view, a list of its pages, as a list, tiles, a bento box and so on | §3.4 | S2 |
| U7 | A page is universal: articles, custom pages, galleries, any kind of page with its own link | §3.3 | S2 |
| U8 | Game mode is a parallel universe to all of this | §5 | S4 |
| U9 | Its sections are predefined by the buildings, and can't change without changing the buildings | §5.1 | S4 |
| U10 | The same pages are mapped to the game's sections | §5.2 | S4 |
| U11 | A page can be mapped to a game section, or not | §5.3 | S4, S6 |
| U12 | Edit mode has separate controls for the game's mapping | §7.4 | S6 |
| U13 | The game's section list and page views are the same Astro pages, over the game with a white smoke in light mode and a black one in dark | §6.1, §6.2 | S5 |
| U14 | In a building you can move through every page of its section | §6.3 | S5 |
| U15 | The only way to open another section in game mode is to walk to its building, on purpose, so that finding a section is part of the play | §6.4 | S5 |
| U16 | Spec and plan in detail, critique and improve them, then implement one thing at a time | This page, the [plan](plan.md), §10 | All |

</details>

## 1. Where things stood

Before this work (30 September 2026):
- **The site's pages came from two places.**
  - The one real article (`/leadership/do-what-makes-you-proud/`) and its section came from `content/` through the site structure ([content model](../content/model.md)).
  - The "classic site" (`/classic/` and seven pages under it) came from `src/content/landmarks/*.md`, the planet's buildings, and every one of those pages was a placeholder.
- **The header listed the landmarks, not the sections.** `classicNav` built the header from the landmarks collection on every page, so Leadership, the only section with a real page, wasn't in the header at all.
- **The planet showed its own words.** Each building's card and dialog read the landmark files: an intro and up to five highlights, all placeholders. "Classic page" linked to `/classic/<building>/`.
- **Edit mode edited the site structure only.** The navigation, the planet and the landmark pages weren't editable ([edit mode §1](../editor/spec.md#1-goals-and-boundaries)).

## 2. Words for a site under construction (U1)

**Principles.**
- **Say what's true today.** The site has one story (in Leadership). Everything else is being written.
- **Say what's coming, not when.** A section says what it will hold ("case studies of products I've led") and that it's being written. No dates, no "next week".
- **Invent nothing.** No project names, numbers, employers, links or talks that don't exist. The only facts used are the ones already published: the name, the role (Principal Design Manager at Microsoft) and the one story.
- **Keep it short and warm.** One sentence of status at most, never an apology repeated on every line, and the game's characters keep their own voice.
- **No placeholder markers.** Words like "placeholder", "lorem", "TBD", "TODO", "FIXME" and "POC" never appear in anything a visitor reads (V20).

**What changed** (phase S1, done):

| Where | Was | Now |
|---|---|---|
| The landing's standfirst | "Placeholder tagline about leading design teams…" | The role, and that the site is under construction, with some sections still empty |
| The classic front page's standfirst | "Placeholder tagline about building design teams…" | The same, and that the first story is in the Lighthouse |
| The seven landmarks: summary, dialog intro, highlights and page body | "Placeholder — …", fake case studies, talks and essays marked "(placeholder)" | What each will hold and that it's being written. The fake items are gone. The Lighthouse links to the first story, and the Greenhouse to how the site was built |
| Prabin's welcome | "Every building here holds part of my work" | Each building will hold part of it, and most are still being fitted out |
| Prabin's lines | "The Workshop has my case studies" | The Lighthouse has the first story; the other buildings are being fitted out |
| The menu's How to play tip | "Every building holds part of Prabin's work" | The same honesty, in the game's copy rules |

**Kept as they are:**
- the site's description and the owner's profile (true);
- the footer;
- the design library's sample pages (a documented sample area);
- Chopper's card (the owner's own words);
- the family's lines that don't mention the work.

**The guard (V20)** checks the copy's sources, not every token. It covers:
- every string in `content/`;
- the landmark files;
- the pages (not the design library);
- the layouts and compounds;
- the game's lines and HUD.

Comments and code don't count: an input's `placeholder` attribute or a token's name isn't copy. The fundamentals are left out, because there "placeholder" is an API.

Later phases move these words into `content/` (the sections' and places' summaries) unchanged.

## 3. Sections and pages (U3, U6, U7)

### 3.1 The terms

| Term | What it is | In the data |
|---|---|---|
| **Home** | The site's front page: the name, the ways in (the planet or the site), then the sections | The site structure's root hub, `home` |
| **Section** | A part of the site with its own page, which lists the pages in it | A hub directly under `home` |
| **Page** | Anything with its own address: an article, a custom page, a gallery | An item node in a section |

- **Exactly three levels (V22).** Home holds sections, and a section holds pages. There are no pages directly under home and no sections inside sections. The loader refuses both, and edit mode never offers them. A page that deserves the top level (About) gets there through the navigation (§4), not the tree.
- **A page lives in one section.** Its address is the section's slug plus its own (`/leadership/do-what-makes-you-proud/`). This is V12, unchanged.
- **Items stay channel-agnostic.** A page says nothing about where it's shown. The site structure places it, and the planet structure maps it (§5), each on its own ([structures §1](../content/ia.md#1-items-and-structures)).

### 3.2 A section's fields

| Field | What it's for | Notes |
|---|---|---|
| `id` | Stable identity | Never changes; unique among all nodes (V21) |
| `slug` | Its address segment (`work` gives `/work/`) | Fixed once it holds a published page (as today) |
| `title` | The section page's heading, and its default label | |
| `navLabel` | A shorter label for the navigation | Optional, 24 characters at most |
| `summary` | The section page's standfirst, and the line under it on the home page | 160 characters at most. While a section is empty, it says what's coming |
| `view` | How its pages are listed: `list`, `tiles` or `bento` | Default `tiles` (§3.4) |
| `sequence` | Its pages have an order that means something, so each page links to the previous and next | Optional, as today |
| `children` | Its pages, in order | Item nodes only |

**`template` goes.** It named page layouts (`workIndex`, `leadershipOverview` and so on) that never existed, and `view` is what a section actually varies. Its consumers change with it:
- `[...path].astro` and `Page.astro` recognise home by being the root (a route with no parent), not by its template;
- edit mode's API (`where`) and its Sections tree do the same;
- the hub form's Template field becomes View.

### 3.3 Pages: one resource, several kinds (U7)

Every page is the same resource, `content/articles/<id>.json` with its blocks, and a `kind` that decides how its opening reads. That keeps one editor, one set of blocks and one address rule for everything with a link.

| Kind | Stored as | For | Its opening |
|---|---|---|---|
| **Article** | `note` | Stories, case studies, essays | Topic (its section), title, standfirst, byline with the avatar, date, reading time; the minimap on long ones |
| **Page** | `page` | About, Contact, Now, a résumé | Title and standfirst only: no byline, date or reading time |
| **Gallery** | `gallery` (new) | A set of pictures with a few words | Title, standfirst, and the number of pictures instead of the reading time. The body is usually galleries and carousels |
| Talk | `talk` | Reserved until the model holds an event, a date and a recording | Refused by edit mode, as today |

- **One kind of reference.** A structure refers to a page as `{ "type": "article", "id": … }`. The content model's other item types (`caseStudy`, `gallery` as a resource, and so on) have no repository or renderer, so structures refuse them until one exists. A "gallery" here is always a page of kind Gallery.
- **A new kind of page later** (a résumé with its own layout, say) is a new `kind` and an opening, not a new resource or route.

### 3.4 The section view (U6)

A section's page is its heading, its standfirst and its pages, in its `view`:

| View | Look | Best for |
|---|---|---|
| **List** | A contents page: one row per page, with its title set large, its one-line summary, its meta, and a small picture at the end of the row | Many pages, words first (writing, talks) |
| **Tiles** | An even grid of cards: picture, title, summary, meta | A set of equals (case studies) |
| **Bento** | A mosaic: the first page across the whole width (its picture beside its words), then a row of two halves and a row of three thirds, in turn | A few pages with a clear lead (leadership) |

- **All three are the layout's, from the same card.** `IndexLayout` takes `view` and arranges `StoryCard`s:
  - `row`, a new variant, for the list;
  - `standard` for tiles, and for bento's single cells;
  - `feature` for bento's lead.
  No section can be styled beyond its view.
- **The meta line** follows the page's kind: an Article's reading time, a Page's nothing, a Gallery's number of pictures.
- **On a phone** every view is a single column. The list keeps its small pictures; tiles and bento stack.
- **Empty.** A section with no published pages shows its summary and an empty state: "Nothing here yet. This section is being written." Its address works, and it stays in the navigation if the owner put it there.
- **Drafts** show in edit mode's canvas only, never on the site (as today).

### 3.5 The home page (decision O5)

The landing stops being a separate step and becomes the home hub's page, as the [content plan](../content/plan.md#7-open-decisions) recommended:
- **The header** carries the navigation (§4), like every other page.
- **The opening** keeps the name, the painted planet and the two ways in:
  - "Explore the planet" goes to `/play/`;
  - "Read the site" goes down to the sections (`#sections`).
  The one the visitor chose last time is the primary button (as today, `site.mode`).
- **The words** are content: the title and the standfirst are the home hub's `title` and `summary`. The buttons and the note under them are interface words, and stay in code.
- **Below the opening** comes the list of sections, as a contents page (`ContentsList`): each with its title, its summary, and "Being written" while it's empty.
- **The classic site's addresses redirect:**
  - `/classic/` goes to `/#sections`;
  - each `/classic/<building>/` goes to the section its topic became (§3.6).

  Each redirect is a static page with a meta refresh, a canonical link and a plain link, all through `withBase`, because GitHub Pages can't send server redirects (V19).
- **"Classic site" stays in the game's glossary,** meaning the site's regular pages.

### 3.6 The first sections

Today's seven topics become the site's first sections, in the planet's order. Each keeps its landmark's topic and its S1 words as its summary. None gets a placeholder page: an empty section shows its empty state (§3.4).

| Building | Section | Address | Pages | View |
|---|---|---|---|---|
| Workshop | Work | `/work/` | None yet | Tiles |
| Town Hall | About | `/about/` | None yet | List |
| Lighthouse | Leadership | `/leadership/` | Do what makes you proud | Bento |
| Library | Writing | `/writing/` | None yet | List |
| Amphitheater | Talks | `/talks/` | None yet | List |
| Greenhouse | Side projects | `/side-projects/` | None yet | Tiles |
| Post Office | Contact | `/contact/` | None yet | List |

The owner can rename, hide or delete any of them in edit mode. They're sections, not code.

## 4. The top navigation (U2, U4, U5)

### 4.1 The data

The navigation is the site structure's `menus.primary`, a list of entries in the order they show:

| Entry | Shape | Label |
|---|---|---|
| A section | `{ "node": "work" }` | The entry's `label`, else the section's `navLabel`, else its `title` |
| A page | `{ "node": "<its node id>" }` | The same rule, from the page's node, then the page's `navLabel` or `title` |
| A custom link | `{ "label": "GitHub", "href": "https://github.com/…" }` | Its `label` |

```json
"menus": {
  "primary": [
    { "node": "work" },
    { "node": "leadership" },
    { "label": "Résumé", "href": "https://…/resume.pdf" }
  ]
}
```

- **A section is "visible in the navigation"** when an entry points at it. Hiding it removes the entry. The section and its pages stay where they are, listed on the home page.
- **A page entry points at its node.** So only a page placed on the site can be in the navigation, and moving it to another section keeps the entry: a move relocates the node, keeping its ID, slug and label (V21). Taking a page off the site removes its entry in the same write, and edit mode says so.
- **A custom link's `href`** is one of two things:
  - an `https`, `http` or `mailto` address;
  - a path on this site (`/play/`, `/docs/` or a built page), which gets the base path when it's rendered.
- **Limits (V17).** At most eight entries, each label at most 24 characters, and every entry pointing at something that exists. Under 56 rem the header folds into its menu anyway; above it, the worst case the limits allow is tested to stay on one row.

### 4.2 The rules

- **The current entry** is the one whose node is the page's own node or its section. A page in Work marks Work, and a custom link is never current. This is the IA's rule ([structures §4](../content/ia.md#4-rules-that-stay-in-code)), in `src/site/content/navigation.ts`, pure and unit-tested.
- **Everywhere, the same.** The header and its phone menu show `menus.primary` on every page of the site: home, sections and pages. The design library keeps its own navigation, and the planet its own header.
- **Unpublished pages don't show.** A draft page's entry stays in the data but is left out of the rendered navigation until the page is published. So the navigation never leads to a missing page.
- **The header's action**, "Explore in 3D", stays code: it's an app action, not content. It follows the page:
  - on a page that's on the planet, it goes to that page, open in its building (§6.6);
  - on a section that a building points to (its `site`, §5.2), it goes to that building;
  - everywhere else, it goes to the plaza.
- **The footer** keeps its code links, re-pointed: "Classic site" becomes "Home" (`/`).

## 5. The planet: a parallel structure (U8–U11)

### 5.1 Buildings are fixed; what's in them is content

The planet has seven buildings, and each is one of the game's sections. Their shapes, their places on the planet, their order and their colours belong to the game ("the world"). Adding, removing or moving one is a change to the game, so it lives in code.

| In code (the game) | In content (the owner) |
|---|---|
| The seven place IDs: `workshop`, `town-hall`, `lighthouse`, `library`, `amphitheater`, `greenhouse`, `post-office` | Each place's words: its name, its kicker (what it holds) and its summary |
| Each place's world: latitude, longitude, facing, footprint, approach distance, model variant, accent colour, and its fast-travel order | Which pages it holds, in what order, and how its list is shown (`view`) |
| | Which section of the site it points to (`site`) |

- **The world moves out of the landmark files** into `src/game/world/places.ts`, which the game's tests read directly (no more mirrored fixtures). The landmark collection goes when its last use does (phase S4).
- **The content contract names the seven IDs** (an enum in `schema.ts`), so the content layer never imports the game. A unit test checks that the game's list and the contract's agree.
- **`/play` joins them.** `src/pages/play.astro` reads the planet structure through the repository at build time, and serialises plain data for the game. `src/game` never imports the site.

### 5.2 The planet structure

`content/structures/planet.json` has one entry for each of the seven places, in the world's order:

```json
{ "places": [
  { "id": "lighthouse", "title": "Lighthouse", "kicker": "Leadership",
    "summary": "How I lead design teams and the culture we build.",
    "view": "list", "site": "leadership",
    "pages": [ { "type": "article", "id": "do-what-makes-you-proud" } ] }
] }
```

| Field | Type | Notes |
|---|---|---|
| `id` | One of the seven | Each exactly once (V14) |
| `title` | string | The building's name on its card, in fast travel and at the head of its list |
| `kicker` | string | What it holds, over the name |
| `summary` | string, ≤ 160 | Under the name on the card and on its list. While it holds nothing, it says what's coming |
| `view` | `list`, `tiles` or `bento` | Its list's view (§3.4), independent of any site section's |
| `site` | a section's node ID, optional | Where "Open classic page" leads from its card and its list. Left out, it leads home |
| `pages` | page references, in order | What it holds (U10) |

### 5.3 The rules

- **Mapped or not (U11).** A page is on the planet when a place lists it, and off it otherwise. The site doesn't change either way.
- **At most one building per page (V15).** So "where is this page on the planet?" has one answer, which the links between buildings need (§6.4). It's the same rule as the site's one section per page.
- **Every page on the planet has its page on the site (V13).** So "Open classic page" always works. Edit mode won't put an unplaced page on the planet, and won't take a page off the site while it's on the planet. Either way it says why.
- **Only published pages show.** A draft can be mapped (it shows in edit mode's lists), and it appears on the planet when it's published, just as on the site.
- **Independent of the site.** A building can hold pages from several sections, and a section's pages can sit in different buildings or none. The first mapping follows §3.6, one building per section, because that's where the topics came from.

### 5.4 What the game shows

- **The building's card** (near it): the kicker, the name and the summary, then Open (E) and "Open classic page", which goes to the place's `site` section or home.
- **Open (E)** shows the building's list (§6). There's no separate dialog of highlights any more: the list is the building's contents.
- **Fast travel** lists the seven by their names, in the world's order (unchanged).
- **Prabin's lines** name only buildings that hold something (the Lighthouse, today). A unit test keeps his pointers true: every building his lines name has at least one published page.

## 6. Reading on the planet (U13–U15)

### 6.1 The same pages, in a planet frame

Opening a building shows two kinds of page, both rendered by the site's own `Page` component and layouts with the planet frame:

| Route | What | Rendered with |
|---|---|---|
| `/play/<place>/` | The building's list: its name, kicker, summary and its published pages in its `view`, or its empty state | `IndexLayout`, planet frame |
| `/play/<place>/<page-id>/` | One of its pages | `ArticleLayout`, planet frame: the same opening, blocks, lightbox and minimap as on the site |

- **Page IDs, not slugs,** because a building can hold pages from several sections, and slugs only need to be unique within a section. IDs never change.
- **They're built statically** with the rest of the site, from the same content, so a page reads identically in both places (U13). A test compares a page's title, blocks and pictures in both.
- **Search engines don't index them.** Each has `noindex`, and a canonical link to the page's site address.

### 6.2 The planet frame

- **The overlay** is a full-screen, modal `dialog` in the game's HUD, holding a transparent `iframe` of the route above. The game stays visible behind it, paused: its input stops, as under any overlay (`openId`, [lanes](../game-ui/design-system.md)).
- **The smoke is the site's.** The framed page paints the lightbox's scrim and drifting smoke (`--color-scrim`, `--color-smoke`) over a transparent page: paper-white in light mode and black in dark. So the planet shows faintly through, and the words sit on a scrim opaque enough for their contrast (AA, checked in both modes).
- **Light and dark follow the site's theme** (`site.theme`: the system, light or dark), not the game's wood.
  - The framed page resolves its scheme and reports it in its `ready` message.
  - The game sets the iframe element's `color-scheme` to match. Otherwise a browser paints an opaque backdrop behind a frame whose scheme differs from its parent's.
- **The frame's chrome is in the framed page:** a place bar (`PlaceBar`, a new compound) with:
  - the building's name;
  - "Show contents" (back to the list), on a page;
  - "Open classic page", to that page's site address (leaving the game);
  - Close.

  There's no site header, footer or breadcrumb.
- **The game shows only what the frame can't:** a status while the frame loads (after 400 ms), and, if it fails or times out (10 s), a card with "Try again", "Open classic page" and Close.
- **The game's own code stays small.** The overlay is the lazily loaded chunk that replaces the landmark dialog (`ui/Dialogs.tsx`). It knows a URL, the messages (§6.9) and the history. The game never imports the site, and the site never imports the game.

### 6.3 Moving through a building (U14)

- **From the list,** each page opens in the frame.
- **On a page,** the end of the article has "Previous" and "Next" through the building's pages, in the building's order, and "Show contents" back to the list. The place bar has "Show contents" too.
- **Moving within the frame adds no history entries.** The frame replaces its location on each move, so the browser's Back does what it does for every overlay: close it.
- **The game keeps the address current** (`?at=<place>&open=1&page=<id>`) with `replaceState`, keeping its history marker, `{ gameOpen: place, page }`. So Close still goes back through history, and the address can be shared or reloaded and opens the same page.
- **Back, then Forward** reopens the building at the page the address names.
- **Focus** goes to the frame's heading when it opens and after each move. When the overlay closes, focus returns to whatever opened it: the card's Open button, or the planet.

### 6.4 Other buildings, other sections (U15)

The frame never leads to another building's pages. That's on purpose: finding a section means walking there. Links in a page's words behave by where they lead:

| A link to | Does |
|---|---|
| A page in this building | Opens in the frame |
| A page in another building | Doesn't navigate. A note by the link says where it is: "That's in the Lighthouse. Walk there to read it." The note offers "Open classic page", and the live region reads it |
| A page that's only on the site | Opens the site in a new tab, and says so in its name |
| Anywhere else | Opens in a new tab |

**There's no navigation to other sections in the frame:** no header, no list of sections, no home link.

### 6.5 Keys

The game's own rule holds ([game UI §6.7](../game-ui/design-system.md)): Space goes back.

| Key | In the frame |
|---|---|
| Space | Closes the overlay, back to the planet. When a picture's lightbox is open, it goes back from that first; in a form field, it types |
| Esc | Does the same as Space, but no label shows it |
| Arrows, Page Up and Page Down, Home and End, the wheel, a swipe | Scroll the page, as on the site |
| Tab | Moves through the page and the place bar, trapped inside the overlay |
| E and the game's other keys | Nothing: the game is paused while the overlay is open |

The Close button shows Space, like every other close in the game.

### 6.6 Deep links and switching between the site and the planet

- **Into the planet:** `/play/?at=<place>&open=1&page=<id>` arrives at the building with that page open. Without `page`, it opens the building's list. A page that isn't in that building, or isn't published, opens the list instead, and the live region says so.
- **A framed route opened on its own** (`/play/<place>/…` in a tab of its own) redirects to that deep link (through the base path), so it opens inside the game rather than as a bare page.
- **From the site to the planet:** "Explore in 3D" in the header carries the context:
  - the page, in its building, when the page is on the planet;
  - the building whose `site` is this section;
  - otherwise the plaza.
- **From the planet to the site:** "Classic site" (the planet's header and menu) and "Open classic page" carry the context:
  - the page being read;
  - else the building's `site` section;
  - else home.

### 6.7 Loading and weight

- **The game's critical JavaScript stays within its budget.** The budget is 450 KB gz, and a production build measured 449.1 KB before this work.
  - The overlay is a later chunk.
  - The main bundle gains only the URL's `page` field and the context link.
  - Each phase that touches the game measures it with `npm run verify:prod`. If the margin is gone, making room comes first.
- **The size report keeps the frame's scripts out of the game's figures.** It counts them as the site's.
- **A framed page is an ordinary static page:** its HTML, the site's CSS and fonts (shared with the site, so cached for a visitor who has read it), and its pictures, lazily loaded as on the site.
- **Prefetch.** When a building's card shows, the game adds a `prefetch` link for its list, so Open feels instant.

### 6.8 Accessibility

- The overlay is a modal dialog named after the building ("Lighthouse"). The iframe's title is the page's title, and it updates on each move.
- Moves are announced ("Do what makes you proud. Page 1 of 1 in the Lighthouse").
- The frame passes axe in light and dark, over the planet. Its controls are at least 44 px, on a phone too.
- Reduced motion: the smoke doesn't drift, and the overlay appears without its fade.
- The classic site stays reachable from every state: the place bar's "Open classic page", the failure card's, and the planet's header.

### 6.9 The frame's messages

The frame and the game talk by `postMessage`, on the same origin. Each side:
- accepts a message only from the other: `event.origin === location.origin`, and `event.source` is the iframe's window, or the parent;
- posts to `location.origin`, never `*`;
- ignores a message whose `type` or fields it doesn't know.

| From the frame | When | Fields |
|---|---|---|
| `planet:ready` | Each load | `place`, `page` (or null for the list), `title`, `scheme` (`light` or `dark`), `index` and `count` |
| `planet:close` | Space, Esc or Close, when nothing inside the frame takes the key first | `place` |

The game answers `ready` by:
- setting the iframe's title and `color-scheme`;
- replacing the address;
- announcing the move;
- focusing the frame (the frame focuses its own heading).

A `ready` from a building other than the open one is ignored, because it belongs to an overlay that's closing.

## 7. Edit mode (U5, U12)

### 7.1 Pages

"Articles and pages" becomes **Pages**: every page of every kind (Article, Page, Gallery), with its kind, its section and its building. New page asks for its kind, and Gallery joins the choices.

### 7.2 Sections

The Sections screen ([edit mode §5](../editor/spec.md#5-sections-the-site-structure)) keeps its tree, reordering and placing. A section's settings change:
- **View** (List, Tiles, Bento) replaces Template.
- **In the navigation** is a switch that adds the section to the top navigation (at the end) or removes it. It edits the same `menus.primary` as the Navigation screen.
- **New section** asks for the title, the view, and whether it goes in the navigation (on by default). It's always a section under home.

Every operation on the structure keeps its other fields (`menus`) as they are, and moving a page keeps its node (V21).

### 7.3 Navigation (new screen, U5)

`/_edit/navigation/` shows the top navigation as it will show on the site:
- **A preview** of the header with these entries, at desktop width.
- **The entries**, in order. Each shows:
  - its label;
  - what it points to (a section, a page or a link);
  - whether it shows (a draft page's entry is marked "Hidden until published").

  Each has Move up, Move down and Remove.
- **Add**: "Add section" (the sections not in the navigation), "Add page" (the placed pages) and "Add link" (a label and an address).
- **Each entry's label** can be overridden. Left empty, the section's or page's own label is used.
- **Saving** writes `menus.primary` through the usual transaction and checks (V17).

### 7.4 Planet (new screen, U12)

`/_edit/planet/` shows the seven buildings, separate from the site's sections:
- **Each building** is a card with its name, kicker, summary, view and "On the site" (the `site` section, or Home).
- **Its pages** are listed in order, with Move up, Move down and "Take off the planet", plus "Add page" (from the pages not on the planet).
- **Buildings can't be added, removed or reordered here.** The screen says so: they're the game's.
- **Pages not on the planet** are listed with "Put in…" (a building), like the Sections screen's "Not on the site yet".
- **The rules** (V13, V15) are checked on save. A refusal says why, naming the page and the building.

### 7.5 A page's settings

The article editor's Page tab gains **On the planet**: None, or one of the seven buildings. Next to Section, it shows where the page appears in each world.

### 7.6 One transaction for a page's places

A page's place on the site and on the planet are two files. So the server changes them together, in one transaction, which:
- reads the article, the site structure and the planet structure;
- applies the change asked for;
- checks V13 and V15 on the result;
- writes every file that changed, each against its version (`ifMatch`).

Saving a page's settings, taking it off the site, putting it on the planet, and deleting it all go through it:
- deleting a page takes it off the planet and out of the navigation in the same write;
- taking it off the site while it's on the planet is refused, and says why.

## 8. Rules

New or changed rules, checked by the content loader. So the build, the unit tests and every write edit mode makes all check them:

| Rule | What |
|---|---|
| V12 (unchanged) | A page is placed at most once on the site |
| V13 (now enforced) | Every page on the planet is placed on the site |
| V14 | The planet structure has each of the seven places exactly once, and no other |
| V15 | A page is in at most one building |
| V16 | A place's `site` names a section that exists |
| V17 | Every navigation entry points at a node that exists, or is a valid link; at most eight entries; labels at most 24 characters |
| V18 | A section's `view`, and a place's, is `list`, `tiles` or `bento` |
| V19 | A redirect's source is free (not a built page), its target is a built page, and both go through the base path |
| V20 | No placeholder markers in visitor-facing copy |
| V21 | Every node ID is unique across the site structure, and a moved page keeps its node |
| V22 | The site is three levels: home, sections, pages |

## 9. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Today's seven topics become the first sections, empty ones with an empty state, not placeholder pages | Nothing a visitor sees pretends to be real, and the owner fills them in edit mode |
| D2 | The landing folds into home (O5) | Home is the site structure's root, and the navigation needs a front page that lists the sections |
| D3 | A page is one resource with a `kind`, and structures refer only to pages | One editor, one set of blocks and one address rule for everything with a link |
| D4 | The world stays in code, and the words and pages move to content | The buildings are the game's (U9); their contents are the owner's (U10) |
| D5 | At most one building per page | The links between buildings (§6.4) need one answer |
| D6 | The planet frame is an iframe of static pages | "The same Astro pages" (U13), untouched by React, with the game's bundle unchanged |
| D7 | In the frame, Space goes back as everywhere in the game | The owner's rule for the whole game; reading keeps every other way to scroll |
| D8 | Moves in the frame replace, not push | Back closes the overlay, as for every other overlay |
| D9 | The navigation is `menus.primary` in the site structure | One file validates nodes and menu entries together, and the IA's spec already placed menus there |
| D10 | Exactly three levels (V22) | The owner's model; a top-level page reaches the top through the navigation |

## 10. Critique and v2

A review of v1 against the code found fifteen problems. This is what each changed:

| # | Finding | Severity | What v2 does |
|---|---|---|---|
| R1 | v1 allowed pages under home and nested hubs, which contradicts "sections, then pages" | High | Exactly three levels, enforced (§3.1, V22) |
| R2 | Redirecting `/classic/` in one phase and moving the navigation in the next would leave a header full of redirects in between | High | The navigation moves in the same phase as the redirects (plan S2) |
| R3 | Every Sections operation rebuilds the structure as `{ home }`, which would erase `menus` | High | Every structure operation keeps the other fields, with a regression test (§7.2) |
| R4 | Menu entries point at node IDs, but IDs weren't unique and a move recreated the node | High | Unique node IDs, moves that keep the node, and unplacing removes the entry in the same write (V21, §4.1) |
| R5 | A page's site and planet places are two files, written separately | High | One transaction over the article and both structures (§7.6) |
| R6 | v1 made Space scroll and showed Esc in the frame, against the owner's rule, and some labels broke the copy rules | High | Space goes back; Esc works unlabelled; labels are verbs of three words at most (§6.5, D7) |
| R7 | The iframe's messages, focus, nested lightbox and failures were undefined | High | A message protocol with origin and source checks, a lightbox that takes Space first, and a loading and failure state (§6.2, §6.5, §6.9) |
| R8 | Replacing the address during reading would drop the game's history marker | High | The marker is kept, with the page, and Back, Forward and Close are tested (§6.3) |
| R9 | The game's bundle has 0.9 KB of headroom, and the size report counts every non-landing chunk as the game's | High | Measure in every phase that touches the game; make room first if needed; the report counts frame scripts as the site's (§6.7). The review's 453 KB came from the test build left in `dist/`, not a production build |
| R10 | "Gallery" meant two things, and `template` had more consumers than listed | Medium | Structures refer only to pages; every consumer of `template` is listed (§3.2, §3.3) |
| R11 | Redirects and frame links weren't shown to be base-aware | Medium | Explicit redirect pages through `withBase`, and a build at `/atiya` checks them (V19, plan) |
| R12 | Scanning every component for "placeholder" would hit real APIs | Medium | The guard reads the copy's sources and leaves the fundamentals out (§2) |
| R13 | The tests covered the happy path only | Medium | The plan adds the riskiest cases: node moves, menus through every operation, the transaction, keys, focus, messages, history, base path and phone layout |
| R14 | Eight entries don't guarantee one row | Low | Labels are capped at 24 characters, and the worst case is tested (§4.1) |
| R15 | The spec described S1 as future work after it had landed | Low | §1 and §2 describe what was and what now is |

## 11. As built

Filled in as each phase lands.

- **S1 (30 September 2026):** the copy of §2, and the V20 guard in `tests/unit/copy.test.ts`.
- **S2 (30 September 2026):** sections, pages and the navigation.
  - **The contract** (`schema.ts`): a hub's `view` replaced `template`; the `gallery` kind; structures refer only to pages (`article`); `menus.primary`; `content/redirects.json`. The loader checks V17, V19, V21 and V22.
  - **The content:** the home hub's words, the seven sections (§3.6) with their summaries (what each holds; the status is the page's, not the summary's: "Being written" on the home page, the empty state on the section), and the navigation listing them.
  - **The design system:** `StoryCard`'s `row` variant; `IndexLayout`'s `view` and `empty` (and `redirect`, for a moved address); `LandingLayout`'s `afterId`; `PageShell`'s `canonical` and `redirect`. Two component tokens, `--c-index-row-picture` and its compact twin.
  - **The site:** `navigation.ts` (`siteNav`, `exploreHref`) on every page; `classic.ts` and the classic pages are gone. The home page is the home hub's, with the sections below the opening. The footer's "Classic site" became "Home", and the design library's header action "Visit the site".
  - **Until S4:** "Explore in 3D" finds a section's building through its old classic address in `content/redirects.json`, and the game's building links reach their sections through those redirects. S4 replaces both with the planet structure.
  - **Edit mode:** the Sections screen's View (for Template), New section always under home with its view, the home hub's summary, and Gallery among the kinds. Structure operations keep `menus`; a move keeps its node; taking a page off the site takes its navigation entry too.
- **S3 (30 September 2026):** edit mode for the site.
  - **Pages:** the screen once called "Articles and pages", with Gallery among the kinds and filters.
  - **Sections:** each section's settings, and New section, have "In the navigation".
  - **Navigation** (`/_edit/navigation/`, `NavigationEditor.astro`, `scripts/navigation.ts`): an inert preview of the real header; the entries with their kind, address, "Hidden until published", their own label (saved when it changes; empty goes back to the node's own), Move up, Move down and Remove; Add section, Add page and Add link. The focus lands where the change left it after each save.
  - **The model:** `menuOf`, `inMenu`, `setInMenu`, `addLink`, `moveEntry`, `relabelEntry`, `removeEntry` and `MENU_MAX` in `model/structure.ts`, unit-tested.
  - **A dev server started before S3 needs a restart** to serve the new screen: edit mode's routes are registered when it starts.
- **S4 (30 September 2026):** the planet structure.
  - **The world** is `src/game/world/places.ts` (the same numbers as the landmark files had); `tests/unit/fixtures.ts` reads it. The landmark collection, its files and `content.config.ts` are gone.
  - **The contract:** `PLACE_IDS` and `planetStructure` in `schema.ts`; the loader checks V13 to V16; the repository has `getPlanet`, `placeOf` and `placePages` (published pages, in the building's order).
  - **The content:** `content/structures/planet.json`, each building with its words (what it holds, as the sections' summaries do: the status is the game's to show), its view, its section on the site, and the Lighthouse holding the first story.
  - **The game:** `/play` joins the two into `LandmarkData` (the world, the words, the published pages with their site addresses, and `siteHref`). The card and the dialog link to the building's section ("Open classic page"). While a building holds nothing, the card and the dialog say it's still being fitted out. Until S5, the dialog lists the pages as links to their site pages. The planet's "Classic site" follows the building. Game JS: 449.2 KB gz (+0.1).
  - **The site:** "Explore in 3D" goes to a page's building, or to the building that points to a section, from the planet structure (S2's interim use of the redirects is gone).
  - **Edit mode:** deleting a page takes it off the planet in the same transaction. Taking a page off the site while it's on the planet is refused by the loader's V13, with the page named. The Publish screen names the file "The planet". The pure planet operations are `model/planet.ts` (`placeOfPage`, `putIn`, `takeOff`, `movePage`, `updatePlace`).
  - **Tests:** the game's IDs against the contract's; each building once with a section; Prabin names only buildings that hold a published page; V13 to V16; the planet operations; E2E, the card and the dialog from the planet structure.
