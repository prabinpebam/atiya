# Information architecture, routes and navigation as data

How the IA already specified in [the information architecture](../ia-navigation/README.md) becomes data: the tree of pages, the URLs derived from it, the menus, breadcrumbs, the current location, redirects and the planet's places. Nothing here changes the IA's decisions. This page says where each one lives and which code applies it. The resources are defined in the [content model](model.md).

> **TL;DR.**
> - **The IA is a tree of documents,** built from each document's `parent` and `order`. The code never lists pages.
> - **URLs are derived from the tree** (`/work/<case-study>/`, `/expertise/<practice-area>/`), gathered into one **route table**. Code-owned routes (`/play/`, `/design/`, `/docs/`) are reserved.
> - **Menus are data** (primary, actions, footer), and their targets are references, not URLs. Local menus, breadcrumbs, the current menu item and previous/next are **rules in code applied to the tree**, so they follow the IA automatically.
> - **Renames can't break links:** a routes lock fails the build when a published path disappears without a redirect.
> - **The planet reads the same IA:** each landmark is a place that targets an IA page. Mapping the seven landmarks to the IA's destinations needs your decisions (§6).

## 1. The tree

Every document except the home page has a `parent` (a page ID), and siblings are sorted by `order`, then title. The tree for the first release, from the [sitemap](../ia-navigation/02-sitemap.md):

```text
home                      page (template: home)                     /
├── work                  page (workIndex)                          /work/
│   └── <case studies>    caseStudy                                 /work/<slug>/
├── expertise             page (expertiseOverview)                  /expertise/
│   └── <4 areas>         practiceArea                              /expertise/<slug>/
├── leadership            page (leadershipOverview)                 /leadership/
│   └── <topics>          leadershipTopic                           /leadership/<slug>/
├── about                 page (standard)                           /about/
├── contact               page (contact)                            /contact/
├── resume                page (resume)                             /resume/
└── not-found             page (notFound)                           /404.html
```

Later, with a maintenance plan: `notes` (`/notes/<slug>/`), `now`, `colophon`, `privacy` and `work/archive`. They're pages and documents like the rest, so adding them is content, not code.

## 2. Rules that stay in code

The IA's navigation rules are behaviour, so they're pure functions in `src/site/content/rules/`, unit-tested against fixtures. Their inputs are the tree and the menus.

| Rule | From the IA | Implementation |
|---|---|---|
| Current menu item | "A case study marks Work active; a practice-area page marks Expertise; a note doesn't falsely mark a section" | An item is current when its target is the page itself or one of its ancestors in the tree |
| Breadcrumbs | "Not on top-level pages; `Home / Work / Case study title`; practice areas are not extra parents" | Shown from depth 2; the chain of `parent`s, labelled with `navLabel` or `title` |
| Local navigation | "Expertise exposes all four areas as peers, in the same order everywhere" | A section's children, sorted by `order`; shown by the section's template |
| Previous and next | "Only if the order has meaning" | Only among the children of a page whose `sequence` is `true` |
| Case-study end matter | "Related case studies, linked practice areas, a clear route back to Work" | `related` (2 to 3), the practice areas, and a link to the parent |
| Card metadata | "No more than one practice area, one role phrase, one outcome phrase, optionally a period" | The card view model takes only those fields |

## 3. Routes

- **A path is derived** from the chain of slugs: `/` + the ancestors' slugs + the document's slug + `/`. The home page is `/`. The 404 page is written to `/404.html`, which is what GitHub Pages serves for a missing path.
- **The route table** lists every built path with its resource: `{ path, type, id, template, title, parent, breadcrumbs, updatedAt }`. The `files` adapter derives it from the resources; the API returns it from `GET /v1/routes` ([API §3](api.md#3-resources)).
- **Rendering.** One catch-all route, `src/pages/[...path].astro`, takes its static paths from the route table and renders the template for the resource's type. The code has no per-page routes for content.
- **Reserved paths** belong to the code, and content may not claim them: `/play/` (the planet), `/design/` (the design library), `/docs/` (the documentation), `/_astro/` and `/media/` (build output). The check fails if a slug collides with one.
- **The base path** (`/atiya` on GitHub Pages) is added by `withBase` when a path becomes an `href`. It's never in content.
- **Other outputs from the table:** `sitemap.xml` (published, indexable paths with `updatedAt`) and, once notes exist, an RSS or Atom feed.

## 4. Menus

Menus are resources ([model §4](model.md#4-supporting-resources)). Their items hold targets, so a page's rename or move updates every menu.

| Menu | Items (from the [navigation specification](../ia-navigation/04-navigation-specification.md)) | Where it shows |
|---|---|---|
| `primary` | Work, Expertise, Leadership, About, in this order | The site header |
| `actions` | Contact and Resume (visible actions that don't compete with the four destinations); Explore the planet (an `app` target) | The header's action slot and the phone menu |
| `footer` | Groups: Explore (the four destinations), Connect (Contact, profiles from `site.profiles`), Utility (Resume; Colophon and Privacy when they exist) | The footer |

The `content:check` rules keep the primary menu to the IA's four destinations, in order (V4). A new destination is an IA decision first, then a data change.

## 5. Redirects and the routes lock

- **Every build of published content writes `content/routes.lock.json`,** the list of published paths. It's committed.
- **The next build checks it (V9).** A path that disappears (renamed, moved or archived) must appear as a `from` in `redirects`, or the build fails and names it.
- **Redirect pages.** GitHub Pages can't send server redirects, so each redirect is built as a small static page: a meta refresh, a canonical link to the new path, and a plain link as a fallback. That's what Astro's `redirects` produce for static sites.

## 6. The planet

The planet is an alternative way into the same IA, and the IA's rules for experimental navigation apply:
- every destination has a stable URL;
- the labels match;
- no second, conflicting taxonomy.

So a landmark is a `place` whose `target` is an IA page. The place carries only what the planet needs on top: its preview words, its dialog, and its world placement. The game gets the places from the repository, as it gets the landmarks today.

The planet's seven landmarks were designed before the IA. Here is a proposed mapping, with the gaps it leaves:

| Landmark | Today (kicker) | Proposed target | Gap |
|---|---|---|---|
| Workshop | Selected case studies | `/work/` | None |
| Town Hall | About me · How I lead | `/about/` | "How I lead" is Leadership's subject |
| Lighthouse | Vision & design leadership | `/leadership/` | None |
| Library | Writing | `/notes/` | Notes is a later phase; until then it has no published target |
| Amphitheater | Talks & podcasts | None in the IA | The IA has no talks page |
| Greenhouse | Side projects & experiments | `/work/archive/` or `/colophon/` | Both are later phases in the IA |
| Post Office | Contact · résumé | `/contact/` | None |
| None | | `/expertise/` | Expertise, a primary destination, has no landmark |

These are open decisions for you (O2 in the [plan](plan.md#7-open-decisions)). Until one is made, each landmark keeps its current page. The phase 1 migration moves today's landmark pages into content as pages with the landmarks' words, so nothing is lost while you decide.

## 7. The classic site and the home page

Today the landing (`/`) asks "planet or classic site", and the classic pages live under `/classic/<landmark>/`. With the IA's routes, the regular pages are the site, so "classic" stops being a separate section:
- **Home:** the home page (`/`) becomes the IA's home, with an "Explore the planet" action in its hero. It keeps the landing's memory of the visitor's last choice.
- **Classic URLs:** `/classic/` redirects to `/`, and each `/classic/<landmark>/` redirects to its landmark's target.
- **The header:** the "Explore in 3D" action stays, from the `actions` menu.

This is decision O1 in the [plan](plan.md#7-open-decisions). The alternative keeps a `/classic/` prefix in front of every IA path, which adds a segment to every URL and a second name for the same pages.
