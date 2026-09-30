# Navigation structures: the site and the planet

How content items become navigation. Each channel has its own structure that maps the same items:
- **the site structure** is the IA's page tree, menus and URLs;
- **the planet structure** is the landmarks, what each one shows, and the way out to the full page.

They can diverge freely: changing one never changes an item or the other structure. The site structure implements the [information architecture](../ia-navigation/README.md); the resources are defined in the [content model](model.md).

> **TL;DR.**
> - **Items are content; structures are navigation.** Articles, case studies, galleries and the résumé are just items. A structure decides where each appears. The owner decided this (O2): the planet may arrange content differently from the site, now or later.
> - **The site structure** is a tree of hubs (pages that present a collection) and item nodes (an item's canonical page). URLs, the route table, menus, breadcrumbs, the current menu item and previous/next all follow from it.
> - **The planet structure** is a list of places. Each place shows items in its own grouping, keeps its own words (preview, dialog) and its world placement, and names the page of the site that "Open full page" leads to.
> - **Two guarantees join them:** every published item has exactly one canonical page on the site (V12), and everything the planet shows has a page to open (V13). So the classic site is always one step away, as the planet's spec requires.
> - **URLs (O1, decided):** the IA's routes at the site's root (`/work/…`, `/about/…`); `/classic/…` redirects.

<figure class="slate-figure" data-diagram="structures">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 450" role="img" aria-labelledby="cp-structures__title cp-structures__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="cp-structures__title">The same content items, two structures</title>
<desc id="cp-structures__desc">In the middle, the content items: case studies, practice areas, leadership topics, articles, galleries and the résumé. On the left, the site structure places each once in the IA's page tree (Home, Work, Expertise, Leadership, About, Contact and Résumé), which gives each its canonical page. On the right, the planet structure shows the same items in its own places (Workshop, Town Hall, Lighthouse, Library, Amphitheater, Greenhouse and Post Office), arranged its own way, and links each place to a page of the site for the full page.</desc>
<g id="cp-structures__site" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="cp-structures__body-1" x="40" y="40" width="240" height="320" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Site structure</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">the IA's page tree</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Home</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Work</text>
<text x="60" y="192" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Expertise</text>
<text x="60" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Leadership</text>
<text x="60" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">About</text>
<text x="60" y="282" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Contact</text>
<text x="60" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-1" data-slate-fit-padding="16">Résumé</text>
</g>
<g id="cp-structures__items" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="cp-structures__body-2" x="380" y="40" width="240" height="320" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="400" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-structures__body-2" data-slate-fit-padding="16">Content items</text>
<text x="400" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="cp-structures__body-2" data-slate-fit-padding="16">channel-agnostic</text>
<rect id="cp-structures__body-3" x="400" y="112" width="200" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="414" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-3" data-slate-fit-padding="16">Case studies</text>
<rect id="cp-structures__body-4" x="400" y="150" width="200" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="414" y="170" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-4" data-slate-fit-padding="16">Practice areas</text>
<rect id="cp-structures__body-5" x="400" y="188" width="200" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="414" y="208" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-5" data-slate-fit-padding="16">Leadership topics</text>
<rect id="cp-structures__body-6" x="400" y="226" width="200" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="414" y="246" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-6" data-slate-fit-padding="16">Articles</text>
<rect id="cp-structures__body-7" x="400" y="264" width="200" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="414" y="284" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-7" data-slate-fit-padding="16">Galleries</text>
<rect id="cp-structures__body-8" x="400" y="302" width="200" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="414" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-8" data-slate-fit-padding="16">Résumé</text>
</g>
<g id="cp-structures__planet" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="cp-structures__body-9" x="720" y="40" width="240" height="320" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="740" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Planet structure</text>
<text x="740" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">its own places</text>
<text x="740" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Workshop</text>
<text x="740" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Town Hall</text>
<text x="740" y="192" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Lighthouse</text>
<text x="740" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Library</text>
<text x="740" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Amphitheater</text>
<text x="740" y="282" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Greenhouse</text>
<text x="740" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="cp-structures__body-9" data-slate-fit-padding="16">Post Office</text>
</g>
<text x="300" y="184" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">canonical</text>
<text x="646" y="184" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">shows</text>
<text x="444" y="416" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">full page</text>
<g id="cp-structures__flow-1" data-slate-svg-step="4" data-slate-svg-effect="draw">
<path d="M280 200 L370 200" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="379,200 370,205 370,195" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-structures__flow-2" data-slate-svg-step="5" data-slate-svg-effect="draw">
<path d="M720 200 L630 200" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="621,200 630,205 630,195" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-structures__flow-3" data-slate-svg-step="6" data-slate-svg-effect="draw">
<path d="M840 360 L840 398 L160 398 L160 370" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="160,361 165,370 155,370" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The same content items, two structures: the site places each item once in the IA's page tree, which gives it its canonical page; the planet shows the same items in its own places, arranged its own way, and links each place to a page of the site.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The two structures, as a table</summary>

| | Site structure | Planet structure |
|---|---|---|
| Shape | A tree of hubs and item nodes | A list of places |
| Places an item | Once, canonically (its page and URL) | In any place, any number of times, or not at all |
| Its own words | Hub titles, introductions and sections | Each place's label, kicker, summary and dialog |
| Navigation | Menus, breadcrumbs, local navigation, previous/next | Fast travel (by `order`), proximity, the full-page link |
| Owned by | The IA (editorial) | The planet (editorial words; engineering-owned `world`) |
| File | `content/structures/site.json` | `content/structures/planet.json` |

</details>

## 1. Items and structures

- **An item is only content.** It has an ID, a slug, words, media and metadata ([model §2](model.md#2-shared-item-fields)). It never says where it's shown: no parent, no order, no path, no place.
- **A structure is only arrangement.** It refers to items by reference or by query, and adds the words that belong to the arrangement itself: a hub's introduction, a place's dialog. It never copies an item's words.
- **Channels:**
  - the **site** (the regular pages, formerly "the classic site") and the **planet** (`/play`);
  - a new channel later (a talk mode, a print résumé) would be one more structure over the same items.
- **Why:** the planet is a playful, spatial arrangement that may want its own grouping (a Greenhouse of experiments, an Amphitheater of talks), while the site follows the IA. Tying both to one tree would force one to bend to the other.

## 2. The site structure

One resource, `structures/site`, holds the tree, the home node and the menus.

> **As built (30 September 2026).** The owner's model is exactly three levels: the home page, its sections, and their pages ([sections spec §3](../sections/spec.md#3-sections-and-pages-u3-u6-u7)). So a hub is either the home hub or a section directly under it, an item node sits in a section, and every node's ID is unique (V21, V22). A section has a `view` (`list`, `tiles` or `bento`) rather than a `template`, and the navigation is `menus.primary` alone ([sections spec §4](../sections/spec.md#4-the-top-navigation-u2-u4-u5)). Placing by query, `hero`, `sections` and the `actions` and `footer` menus below are the longer-term design, not built.

**Nodes.** Every node has an `id` (stable), a `slug` (its URL segment) and optional `children`.

| Kind | What it is | Fields |
|---|---|---|
| `hub` | The home page, or a section: a page that lists its pages | `title`, `navLabel?`, `summary`, `view` (`list`, `tiles`, `bento`), `sequence?`, `children` |
| `item` | A page's canonical address | `item` (a page reference, `{ type: "article", id }`); `slug` defaults to the page's own |

**Placing by query.** A hub can place items automatically, so adding a case study needs no structure edit:

```json
{ "id": "work", "kind": "hub", "slug": "work", "title": "Work", "view": "tiles",
  "summary": "Selected case studies.",
  "children": { "from": { "type": "caseStudy", "sort": "featured.work,title" } } }
```

Every published case study then gets a node under Work (`/work/<slug>/`). A hub can mix explicit `item` nodes and one `from` query; an item matched by a query and also placed elsewhere fails V12.

**The first release's tree**, from the [sitemap](../ia-navigation/02-sitemap.md):

```text
home          hub (home)                 /
├── work      hub (workIndex)            /work/          children from: case studies
├── expertise hub (expertiseOverview)    /expertise/     children from: practice areas
├── leadership hub (leadershipOverview)  /leadership/    children from: leadership topics
├── about     item → article "about"     /about/
├── contact   item → article "contact"   /contact/
├── resume    item → the résumé          /resume/
└── (404)     the not-found hub          /404.html
```

Later, with a maintenance plan: `notes` (a hub placing notes), `talks`, `now`, `colophon`, `privacy`, `work/archive`. Adding one is a structure change, not code.

**Menus** live in the same resource. As built, `menus.primary` is the header's navigation, and each entry is a node (a section or a page) or a custom link. The rest of this table is the longer-term design:

| Menu | Entries (from the [navigation specification](../ia-navigation/04-navigation-specification.md)) | Where it shows |
|---|---|---|
| `primary` | Work, Expertise, Leadership, About, in this order | The site header |
| `actions` | Contact and Resume; Explore the planet (an `app` target) | The header's action slot and the phone menu |
| `footer` | Groups: Explore (the four destinations), Connect (Contact, the profiles in the site settings), Utility (Resume; Colophon and Privacy when they exist) | The footer |

## 3. Routes

- **A path is derived** from the chain of node slugs: `/` + the ancestors' slugs + the node's slug + `/`. The home node is `/`; the 404 hub is written to `/404.html`, which GitHub Pages serves for a missing path.
- **An item's canonical path** is the path of the node that places it. Every `ref:` link, every item target and the planet's full-page links resolve through it.
- **The route table** lists every built path: `{ path, node, item?, title, label, breadcrumbs, updatedAt }`. The `files` adapter derives it from the site structure; the API returns it from `GET /v1/routes` ([API §3](api.md#3-resources)).
- **Rendering.** One catch-all route, `src/pages/[...path].astro`, takes its static paths from the route table and renders the node: a section's page in its view, or a page as its kind opens. The home page is `src/pages/index.astro`, which reads the home hub. The same route builds the redirect pages in `content/redirects.json` (V19).
- **Reserved paths** belong to the code, and a node may not claim them: `/play/` (the planet), `/design/` (the design library), `/docs/` (the documentation), `/_astro/` and `/media/` (build output).
- **The base path** (`/atiya` on GitHub Pages) is added by `withBase` when a path becomes an `href`. It's never in content.
- **Other outputs:** `sitemap.xml` (published, indexable paths with `updatedAt`) and, once notes exist, a feed.

## 4. Rules that stay in code

The IA's navigation rules are behaviour, so they're pure functions in `src/site/content/rules/`, unit-tested against fixtures. Their input is the site structure.

| Rule | From the IA | Implementation |
|---|---|---|
| Current menu item | "A case study marks Work active; a practice-area page marks Expertise; a note doesn't falsely mark a section" | An entry is current when its target is the page's node or one of its ancestors |
| Breadcrumbs | "Not on top-level pages; `Home / Work / Case study title`; practice areas are not extra parents" | Shown from depth 2; the chain of ancestor nodes, labelled with `navLabel` or `title` |
| Local navigation | "Expertise exposes all four areas as peers, in the same order everywhere" | A hub's children, in their order; shown by the hub's template and its children's |
| Previous and next | "Only if the order has meaning" | Only among the children of a hub whose `sequence` is `true` |
| Case-study end matter | "Related case studies, linked practice areas, a clear route back to Work" | The item's `related` (2 to 3), its practice areas, and a link to its parent node |
| Card metadata | "No more than one practice area, one role phrase, one outcome phrase, optionally a period" | The card view model takes only those fields |

## 5. The planet structure

One resource, `structures/planet`, holds the places in their fast-travel order.

> **As built (30 September 2026).** The buildings are fixed by the game, so their world (`lat`, `lon`, facing, footprint, approach, variant, accent, order) is code, `src/game/world/places.ts`. The content is `content/structures/planet.json`: each of the seven places once, with `title`, `kicker`, `summary`, `view`, `site` (its section on the site) and `pages` (page references, in order). A page is in one building at most, and must be on the site. There's no `dialog` or `entries` query: opening a building lists its pages ([sections spec §5](../sections/spec.md#5-the-planet-a-parallel-structure-u8u11)).

| Field | Type | Notes |
|---|---|---|
| `id` | string | The landmark (`workshop`); matches a building the game knows |
| `order` | integer | Fast travel and the parallel landmark list |
| `label`, `kicker`, `summary` | strings | The preview card: the place's own words, not an item's |
| `dialog` | `{ intro, highlights ≤ 5 }` | What the landmark's dialog opens with |
| `entries` | `{ item }` or `{ from: query }`, in order | What the dialog lists (each opens that item's page), and may repeat the site's grouping or not |
| `fullPage` | a site node target | Where "Open full page" and the context-preserving switch to the site lead |
| `world` | `{ lat, lon, modelYawDeg, footprintU, approachDistanceU, variant, accent }` | Engineering-owned; validated by the game's rules (V10) |

**An example.** The Greenhouse shows prototypes and a gallery, while the site keeps prototypes under Work:

```json
{ "id": "greenhouse", "order": 6, "label": "Greenhouse", "kicker": "Side projects & experiments",
  "summary": "Prototypes, tools and experiments grown on the side, including this little planet.",
  "dialog": { "intro": "…", "highlights": ["…"] },
  "entries": [
    { "from": { "type": "caseStudy", "filter": { "engagementType": "prototype-or-experiment" } } },
    { "item": { "type": "gallery", "id": "planet-concept-art" } }
  ],
  "fullPage": { "type": "node", "id": "work" },
  "world": { "lat": 25, "lon": 45, "modelYawDeg": 0, "footprintU": 1.6, "approachDistanceU": 2.6, "variant": "greenhouse", "accent": "#…" } }
```

**How the game uses it.** `/play` builds its JSON from the planet structure through the repository: each place, its words, its world placement, its entries (titles, summaries and their canonical paths), and its full-page path. The game keeps its rules (proximity, dialogs, fast travel) and no longer holds any content.

**Guarantees.** Every place has a `fullPage` that resolves, and every entry has a canonical page on the site (V13). The planet can show fewer, more or differently grouped items than the site, but never a dead end.

## 6. Redirects

- **Moves aren't redirected** (the owner's call, [sections spec D11](../sections/spec.md#9-decisions)). A page that's renamed, moved to another section or unpublished simply leaves its old address. There's no routes lock: on a site under construction, simple moves matter more than old links.
- **`content/redirects.json` holds the classic site's old addresses** (§7). A redirect that no longer fits (a page now lives at its source, or its target has gone) is left out of the build with a warning (V19).
- **Redirect pages.** GitHub Pages can't send server redirects, so each redirect is built as a small static page: a meta refresh, a canonical link to the new path, and a plain link as a fallback. That's what Astro's `redirects` produce for static sites.

## 7. From today's site

**Decided (O1):** the IA's routes at the root.
- **Home:** `/` is the home hub's page. **Decided (O5, 30 September 2026):** the landing folded into it. The opening keeps both ways in ("Explore the planet", "Read the site"), and the sections follow ([sections spec §3.5](../sections/spec.md#35-the-home-page-decision-o5)).
- **Classic URLs:** `/classic/` redirects to `/#sections`, and each `/classic/<landmark>/` to the section its topic became. The redirects are `content/redirects.json`, built as static pages.
- **The header** keeps its "Explore in 3D" action, in code.

**Decided (O2):** the planet has its own structure. The first planet structure keeps today's seven landmarks and words, and points them at the new site like this, until you rearrange it:

| Place | Shows (entries) | Full page |
|---|---|---|
| Workshop | Every case study | Work |
| Town Hall | About | About |
| Lighthouse | The leadership topics | Leadership |
| Library | The practice areas (notes later) | Expertise |
| Amphitheater | Talks (articles of kind `talk`) | A talks page, if the site gets one (O7); About until then |
| Greenhouse | Prototypes and experiments; galleries | Work |
| Post Office | Contact and the résumé | Contact |

Today's landmark pages hold placeholder words about each section. Phase 0 keeps them as articles, so nothing is lost. Phase 1 replaces them with the IA's pages and gives each place its entries.
