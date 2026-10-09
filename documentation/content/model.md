# Content model

Every resource the site and the planet render, its fields, how resources refer to each other, the blocks a body is made of, and the rules the build enforces. The model separates two things:
- **Content items:** what the portfolio says (articles, case studies, galleries, the résumé).
- **Structures:** how each channel arranges those items (the site's page tree and menus, the planet's places).

The items encode the IA's [taxonomy and content model](../ia-navigation/03-taxonomy-and-content-model.md) and [governance](../ia-navigation/07-editorial-and-governance.md). The structures are specified in [navigation structures](ia.md), and the transport in the [API contract](api.md).

> **TL;DR.**
> - **Content items are channel-agnostic.** They are articles, case studies, practice areas, leadership topics, galleries and the résumé. None knows where it's shown: it has no parent, order or URL of its own.
> - **Each channel has a structure** that maps the same items into its navigation:
>   - the **site structure** is the page tree, the menus and so the URLs;
>   - the **planet structure** is the places, what each shows, and its way out to the full page.
>
>   The two can diverge. Changing one never touches an item or the other structure.
> - **Shared item fields:** a stable `id` for references, a `slug` (the default URL segment), a title, a summary, a lifecycle `status`, a `visibility`, dates, SEO fields and a `body` of typed blocks.
> - **Blocks** map one to one onto the design system's components. Text is a small Markdown subset with no raw HTML.
> - **The build refuses bad content:** a missing field, a dangling reference, a missing alt text, an unpublishable visibility, an item placed twice on the site, a planet entry without a page on the site, or a published URL that disappears without a redirect.

<figure class="slate-figure" data-diagram="model">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 540" role="img" aria-labelledby="cp-model__title cp-model__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="cp-model__title">Content items and the structures that place them</title>
<desc id="cp-model__desc">Content items (articles, case studies, practice areas, leadership topics, galleries and the résumé) never refer to a channel. The site structure places each item once, which gives it its canonical page; the planet structure shows items in its own way and links each place to a page of the site. Redirects point old paths at the site structure. Items refer to people, vocabulary terms and media by ID; the site settings name the owner and the social card.</desc>
<g id="cp-model__redirects" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-1" x="100" y="40" width="220" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="118" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-1" data-slate-fit-padding="16">Redirects</text>
<text x="118" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-1" data-slate-fit-padding="16">old path → site</text>
</g>
<g id="cp-model__site-structure" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-2" x="390" y="40" width="220" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="408" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-2" data-slate-fit-padding="16">Site structure</text>
<text x="408" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-2" data-slate-fit-padding="16">page tree · menus · URLs</text>
</g>
<g id="cp-model__planet-structure" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-3" x="680" y="40" width="220" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="698" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-3" data-slate-fit-padding="16">Planet structure</text>
<text x="698" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-3" data-slate-fit-padding="16">places · entries</text>
</g>
<text x="620" y="62" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">full page</text>
<g id="cp-model__items" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-4" x="40" y="160" width="920" height="220" rx="20" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="64" y="194" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-4" data-slate-fit-padding="16">Content items</text>
<text x="64" y="218" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="cp-model__body-4" data-slate-fit-padding="16">No parent, order or URL: they never know where they're shown</text>
<rect id="cp-model__body-5" x="64" y="236" width="272" height="48" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="82" y="266" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-5" data-slate-fit-padding="16">Article</text>
<rect id="cp-model__body-6" x="364" y="236" width="272" height="48" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="382" y="266" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-6" data-slate-fit-padding="16">Case study</text>
<rect id="cp-model__body-7" x="664" y="236" width="272" height="48" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="682" y="266" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-7" data-slate-fit-padding="16">Practice area</text>
<rect id="cp-model__body-8" x="64" y="300" width="272" height="48" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="82" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-8" data-slate-fit-padding="16">Leadership topic</text>
<rect id="cp-model__body-9" x="364" y="300" width="272" height="48" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="382" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-9" data-slate-fit-padding="16">Gallery</text>
<rect id="cp-model__body-10" x="664" y="300" width="272" height="48" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="682" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-10" data-slate-fit-padding="16">Résumé</text>
</g>
<text x="510" y="136" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">places once</text>
<text x="800" y="136" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">shows</text>
<g id="cp-model__people" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-11" x="40" y="440" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="58" y="468" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-11" data-slate-fit-padding="16">People</text>
<text x="58" y="490" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-11" data-slate-fit-padding="16">owner, collaborators</text>
</g>
<g id="cp-model__vocabularies" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-12" x="280" y="440" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="298" y="468" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-12" data-slate-fit-padding="16">Vocabularies</text>
<text x="298" y="490" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-12" data-slate-fit-padding="16">contributions, topics…</text>
</g>
<g id="cp-model__media" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-13" x="520" y="440" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="538" y="468" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-13" data-slate-fit-padding="16">Media</text>
<text x="538" y="490" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-13" data-slate-fit-padding="16">master + sidecar</text>
</g>
<g id="cp-model__settings" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-14" x="760" y="440" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="778" y="468" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-14" data-slate-fit-padding="16">Site settings</text>
<text x="778" y="490" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-14" data-slate-fit-padding="16">owner, social card</text>
</g>
<text x="150" y="414" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">by ID</text>
<text x="390" y="414" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">by ID</text>
<text x="630" y="414" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">by ID</text>
<g id="cp-model__flow-1" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M320 72 L380 72" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="389,72 380,77 380,67" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-2" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M680 72 L620 72" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="611,72 620,77 620,67" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-3" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M500 104 L500 150" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="500,159 505,150 495,150" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-4" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M790 104 L790 150" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="790,159 795,150 785,150" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-5" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M140 380 L140 430" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="140,439 145,430 135,430" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-6" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M380 380 L380 430" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="380,439 385,430 375,430" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-7" data-slate-svg-step="15" data-slate-svg-effect="draw">
<path d="M620 380 L620 430" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="620,439 625,430 615,430" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-8" data-slate-svg-step="16" data-slate-svg-effect="draw">
<path d="M760 472 L730 472" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="721,472 730,477 730,467" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Content items sit in the middle and never refer to a channel. The site structure places them in a page tree (which gives every item its canonical path, and so the route table); the planet structure shows them in places and links each place to a page of the site. Redirects point old paths at the site structure. Items refer to people, vocabulary terms and media by ID; the site settings name the owner and the social card.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The references, as a table</summary>

| From | Field | To |
|---|---|---|
| Site structure | a node's `item` | A content item (its canonical placement) |
| Site structure | a hub's `children.from` | Content items, by query (placed automatically) |
| Site structure | a menu entry | A node, or a URL or app route |
| Planet structure | a place's `entries` | Content items, one by one or by query |
| Planet structure | a place's `fullPage` | A node of the site structure |
| Redirect | `to` | A node of the site structure, or an item |
| Content item | `hero`, blocks | Media, galleries, other items |
| Content item | `related` | Content items |
| Case study | `practiceAreas`, `contributions`, `outcomeTypes`, `engagementType`, `tools` | Practice areas; vocabulary terms |
| Case study | `testimonial.person`, `collaborators` | People |
| Site settings | `owner`, `socialImage` | A person; media |

</details>

## 1. Conventions

- **Format.** JSON (UTF-8, two-space indent). One resource per file in the mock layout ([API §6](api.md#6-the-mock-api-files-that-mirror-it)).
- **Names.** Fields are `camelCase`. Resource types in references are `camelCase` singular (`caseStudy`); API paths are `kebab-case` plural (`/v1/case-studies`).
- **IDs** are lowercase `kebab-case`, unique within their type, and **never change**. References use IDs.
- **Slugs** are lowercase `kebab-case`. An item's `slug` is the URL segment the site structure uses by default; a node may override it. Slugs may change, with a redirect (§8).
- **Dates** are ISO 8601: `2026-09-29` or `2026-09-29T10:00:00Z`. A period uses the precision the story allows: `2021`, `2021-03`.
- **Text lengths** are limits, not targets: a `summary` is at most 160 characters, a card phrase at most 80.
- **Localisation.** Every resource has `locale` (default `en`). One locale is built today ([spec §9](spec.md#9-security-privacy-and-localisation)).
- **Unknown fields** are an error in the mock files (to catch typos), and ignored from the API (so the backend can add fields within a version, D12).

## 2. Shared item fields

Every content item has these fields. There's deliberately no `parent`, `order` or path: those belong to the structures.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable identifier |
| `type` | enum | yes | `article`, `caseStudy`, `practiceArea`, `leadershipTopic`, `gallery`, `resume` |
| `slug` | string | yes | The default URL segment where the site structure places it |
| `title` | string | yes | The H1 on a page; the heading of a card or a planet dialog |
| `navLabel` | string | no | A shorter name for menus, breadcrumbs and the planet's labels |
| `summary` | string ≤ 160 | yes | The standfirst, the card text and the meta description unless `seo.description` is set |
| `status` | enum | yes | The lifecycle (§7) |
| `visibility` | enum | yes | `public`, `publicRedacted` or `summaryOnly`; anything else can't be published (§7) |
| `publishedAt` | date | when published | The first publication; drives scheduled publishing |
| `updatedAt` | date | yes | The last meaningful edit (shown as "Updated") |
| `reviewedAt` | date | no | The last governance review; drives the "stale" check |
| `locale` | string | yes | `en` |
| `hero` | media ref | no | The lead picture, with an optional `caption` and `credit` override |
| `thumbnail` | media ID | no | The picture on its cards, shown whole in a 3:2 frame; the lead picture when left out ([media §9](media.md#9-shapes-thumbnails-and-crops)) |
| `portrait` | media ID | no | The person a page is about (a résumé, About), shown at 4:5 beside its title ([sections §3.3](../sections/spec.md#33-pages-one-resource-several-kinds-u7)) |
| `body` | block[] | yes | The content (§6); may be empty for a gallery or the résumé |
| `related` | item ref[] | no | Two or three, chosen editorially |
| `seo` | object | no | `title`, `description`, `image` (media), `noindex` |

## 3. Content item types

### Article

Every page of the site, whatever it is: the owner's model is that a page is anything with its own address ([sections spec §3.3](../sections/spec.md#33-pages-one-resource-several-kinds-u7)). Its `kind` decides how its opening reads.

| `kind` | Shown as | For | Its opening | Extra fields |
|---|---|---|---|---|
| `note` | Article | Stories, case studies, essays, notes | Its section, byline, date and reading time | `topics` (topic term IDs) |
| `page` | Page | About, Contact, Colophon, Privacy, Now | Title and standfirst only | None |
| `gallery` | Gallery | A set of pictures with a few words | Title, standfirst and the number of pictures | None |
| `talk` | Talk | A talk, panel or podcast (reserved: edit mode refuses it until the fields below exist) | As an article | `event`, `date`, `venue?`, `recording` (a video media ID or an `embed`), `slides?` (a link) |

As built, the structures refer only to this resource (`{ "type": "article", "id": … }`): the other item types below have no repository or renderer yet, so a structure that names one is refused.

### Case study

The IA's required and optional fields, as data. The first group is the "scan layer" the template shows in the first screen.

| Field | Type | Required | Notes |
|---|---|---|---|
| `premise` | string ≤ 160 | yes | One sentence |
| `outcome` | string ≤ 240 | yes | The outcome statement |
| `role` | string ≤ 160 | yes | The personal role, stated near the beginning |
| `team` | string ≤ 240 | yes | Team and collaboration context |
| `period` | `{ start, end?, label? }` | yes | At the precision the story allows |
| `context` | `{ organisation?, disclosed }` | yes | The organisation, only if it may be disclosed |
| `practiceAreas` | `{ primary, secondary[] }` | yes | One primary, up to two secondary (practice-area IDs) |
| `contributions` | term ID[] | yes, ≥ 1 | From the contribution vocabulary |
| `outcomeTypes` | term ID[] | yes, 1 to 2 | |
| `engagementType` | term ID | yes | |
| `constraints` | string[] | yes, ≥ 1 | At least one constraint or trade-off (governance) |
| `cover` | media ref | yes | Representative media; must have alt text |
| `card` | `{ role ≤ 60, outcome ≤ 80 }` | yes | The card's role phrase and outcome phrase (the IA's card metadata limits) |
| `featured` | `{ home?, work? }` | no | Order on the home page and at the top of Work |
| `metrics` | `{ value, label, note? }[]` | no | Normalised or relative, approved |
| `testimonial` | `{ quote, person, permission: true }` | no | Only with permission |
| `tools` | term ID[] | no | Supporting metadata only |
| `links` | `{ label, href }[]` | no | Public external links |
| `afterwards` | Markdown | no | What changed afterwards |
| `differently` | Markdown | no | What would be done differently |
| `aiDisclosure` | Markdown | when AI materially affected the work | The governance's four points |

The narrative (context and stakes, problem, mandate, constraints, decisions, how it unfolded, collaboration, result, reflection) is the `body`. Its `heading` blocks follow the IA's order unless the story needs a justified variation.

### Practice area

| Field | Type | Notes |
|---|---|---|
| `promise` | string ≤ 120 | The short promise |
| `pointOfView` | Markdown | |
| `capabilities` | `{ label, description? }[]` | Plain language, not a software list |
| `questions` | string[] | Typical questions or situations |
| `evidence` | case-study ID[] | Selected evidence; defaults to the case studies whose primary area is this one |
| `related` | practice-area ID[] | The connections to the other areas |

The four practice areas are also a controlled vocabulary: their IDs are the only values `practiceAreas.primary` and `.secondary` accept.

### Leadership topic

| Field | Type | Notes |
|---|---|---|
| `principle` | string | The principle or claim |
| `whyItMatters` | Markdown | |
| `behaviours` | string[] | Observable behaviours |
| `mechanisms` | string[] | Routines, rituals or tools |
| `evidence` | case-study ID[] | |
| `tradeOffs` | Markdown | Failure modes or trade-offs |

### Gallery

A set of pictures that stands on its own. A structure can show it as its own page or place, and a body can embed it (§6).

| Field | Type | Notes |
|---|---|---|
| `items` | `{ media, caption? }[]` | In order; captions override the media's own |
| `layout` | enum | `grid`, `mosaic` or `row`: the default when it's shown or embedded |
| `caption` | Markdown | One caption for the set, as a magazine does |

### Résumé

One résumé, as structured data, so it renders as an HTML page and can feed other views.

| Field | Type | Notes |
|---|---|---|
| `headline` | string | The current role and positioning |
| `experience` | `{ role, organisation?, period, summary, highlights[] }[]` | Most recent first |
| `capabilities` | `{ practiceArea, items[] }[]` | Grouped by practice area, not by software |
| `education`, `recognition` | `{ title, organisation?, year?, note? }[]` | |
| `file` | media ID | The downloadable PDF (secondary to the HTML page) |

## 4. Structures and supporting resources

| Resource | Fields | Notes |
|---|---|---|
| **Site structure** (one) | `home` (the tree: the home hub, its sections, their pages), `menus` (as built, `primary`: sections, pages and custom links) | The site's IA: pages, URLs, the navigation ([structures §2](ia.md#2-the-site-structure), [sections spec §4](../sections/spec.md#4-the-top-navigation-u2-u4-u5)) |
| **Redirects** (one) | `[{ from, to }]`, both paths on the site | An old address to send on (today, the classic site's), built as a static redirect page (V19) |
| **Planet structure** (one) | `places[]`: `{ id, title, kicker, summary ≤ 160, view?, site?, pages }`, each of the seven buildings once | The planet's navigation ([structures §5](ia.md#5-the-planet-structure), [sections spec §5](../sections/spec.md#5-the-planet-a-parallel-structure-u8u11)); the buildings' world is the game's code (`world/places.ts`) |
| **Site settings** (one) | `name`, `positioning`, `description`, `owner` (person), `socialImage` (media), `profiles` (`{ label, href, kind }[]`), `contactEmail`, `disclaimer`, `locale` | Everything the site says about itself |
| **Person** | `id`, `name`, `role`, `bio` (Markdown), `avatar` (media), `links` | The owner, collaborators and testimonial givers (with permission) |
| **Vocabulary** | `id`, `label`, `description?`, `order` per term | `contributions`, `outcomeTypes`, `engagementTypes`, `tools`, `topics` |
| **Media** | `id`, `kind`, `file`, `alt`, `decorative`, `caption`, `credit`, `licence`, `focus`, and more | Specified in [media §3](media.md#3-the-metadata-sidecar) |
| **Redirect** | `from` (path), `to` (a site node or an item), `status` (301 or 302), `since` | Written whenever a published path changes |

## 5. References and targets

- **A typed field holds an ID.** When a field can only point at one type, it's a bare ID: `"primary": "product-experience"`, `"cover": "case-studies/design-system-at-scale/cover"`.
- **An item reference** names a type and an ID: `{ "type": "caseStudy", "id": "design-system-at-scale" }`.
- **A target** is anything a link can point at:

| Target | Resolves to |
|---|---|
| `{ "type": "node", "id": "work" }` | A node of the site structure: its path |
| `{ "type": "caseStudy", "id": "…" }` (any item type) | The item's canonical path on the site |
| `{ "type": "url", "href": "https://…" }` | The URL (https, http or mailto only) |
| `{ "type": "app", "name": "play" }` | A route the code owns: `play`, `design`, `docs` |
| `{ "type": "media", "id": "…" }` | A file to download (the résumé's PDF) |

- **Inside Markdown**, an internal link uses the `ref:` scheme, `[the design system](ref:caseStudy/design-system-at-scale)`. It resolves to the item's canonical path, so a slug change or a move in the site structure never breaks a link in a body.
- **Resolution** happens in the view mappers: a target becomes an `href` through the route table and `withBase`, so neither the base path (`/atiya` on GitHub Pages) nor any path is written into content.

## 6. Blocks

A `body` is an array of blocks. Each block has a `type` and an optional `id` (an anchor; headings get one from their text if absent). The renderer maps each type onto one component. A type marked "new" needs a component added to the design system (in its tier, with a story) before content may use it.

| Block | Fields | Renders with |
|---|---|---|
| `text` | `markdown`, `dropcap?` (a paragraph opens with a drop cap: chosen paragraph by paragraph, off unless set, never automatic; a list ignores it) | `Prose` |
| `heading` | `level` (2 to 4), `text` (plain words; a newline is a line break in it, Shift + Enter in edit mode), `marker?` and `showMarker?` (a heading 2's mark, at most 40 characters, such as a chapter's number: shown unless `showMarker` is false) | `Prose` heading, with an anchor id: its `id`, else made from its words (headings with the same words, like "What shipped" in each chapter, get `-2`, `-3`… in the page's order, the first the plain one; two `id`s set by hand must differ); it's also a minimap landmark. A heading 2's mark is set in big marigold type (the design library's tier numerals): hung in the left margin, its top on the heading's, where the screen is 72rem or wider, and over the heading on a narrower one. It's part of the heading's name (`1 Learning the medium`), never its words. A heading 3 or 4 keeps a mark but doesn't show it |
| `marker` | `text` (plain words, at most 60 characters: `1`, `Chapter 1`) | A section marker: the heading mark's big marigold type, in the column, well apart from what's before and close over what follows |
| `subheading` | `text` (plain words; a newline is a line break, as in a heading) | A line or two more about the heading just above it, set close under it in Fraunces italic, muted and a size under the heading (lead under an H2). It's a `<p data-subheading>`, not a heading: it isn't a landmark and has no anchor. Placed anywhere else, it still renders, as a quiet line on its own; the editor says so |
| `figure` | `media`, `caption?`, `credit?`, `width` (`content`, `popout`, `wide`, `full`), `lightbox?` | `Figure` |
| `gallery` | `gallery` (a gallery ID) or `items` (media refs); `layout?` (`grid` is the compatibility value for the Justified equal-height-row layout, `mosaic`, `row`), `fit?` (`cover`, or `contain` for marks and artwork that mustn't be cropped), `caption?`, `width?`, `lightbox?` | `Gallery` ([media §9.2](media.md#92-justified-galleries)) |
| `carousel` | `gallery` (a gallery ID) or `items` (`{ media, caption? }[]`); `label`, `peek?`, `pager?`, `arrows?` | `Carousel` |
| `video` | `media` (a video file, [media §12](media.md#12-video-files)) or `embed` (`{ provider: youtube or vimeo, id }`), exactly one; `title` (the player's name: an embed needs it, a video file has its own); `poster` (an embed's picture, an image media ID: the site's own thumbnail, shown until the reader presses Play; a video file has its own frame); `duration?` (seconds, shown on an embed's poster); `caption?`, `credit?` (a video file's own when left out), `width?` | `VideoEmbed` |
| `quote` | `text`, `cite?` (text or person), `variant` (`block`, `pull`) | `Quote` |
| `divider` | none | `Divider` |
| `listing` | `source` (a query: `type`, `filter`, `sort`, `limit`), `presentation` (`cards` or `list`), `heading?` | New: a `StoryCard` grid or a `ContentsList` |
| `related` | `items` (item refs), `heading?` | `StoryCard` grid |
| (pictures) | `showCaption` on `figure`, `gallery`, `carousel`, `video` and an article's `hero` | `false`: no caption and no credit under the picture (or the set, or any slide), and none in the lightbox. Left out: shown (the block's caption, else the picture's own) |
| `collection` | `items` (one to 24, each `{ when?, heading?, media?, subtext?, text? }` with at least one of the last four: §6.1), `layout` (`rows`, `columns`, `tiles`, `masonry`, `carousel`, `timeline`, `timeline-scroll`), `columns?` (1 to 4, for tiles and masonry; left out, one for a single item), `prominent?` (tiles on the accent's soft surface), `headings?` (`label` (the default) or `title`), `label?` (a carousel's or a sideways timeline's name), `width?` (`content` (the default), `popout`, `wide`, and `full` for the strips), `peek?` (a strip reaches out beside its column), and the items' pictures' `ratio?`, `display?`, `background?`, `rounded?`, `shadow?` ([media §9.1](media.md#91-how-a-picture-is-shown-fill-fit-actual-size-tile-a-background-corners-a-drop-shadow)) | `Collection` |
| `table` | `columns` (one to 8 one-line rich-text headings, each with one to 80 visible characters), `rows` (one to 60, each a cell for every column: one line of inline Markdown (bold, italic, strikethrough, code, links), or empty), `rowHeadings?` (the first column names each row: row headers), `caption?` (said above it), `width?` (`content` (the default), `popout`, `wide`) | `Table` (§6.2) |
| `metrics` | `items` (`{ value, label, note? }[]`) | New: a metrics list |
| `callout` | `tone` (`note`, `caution`), `markdown` | New |

Hub pages in the site structure use the same blocks for their sections, plus a `hero` (`title?`, `standfirst?`, `media?`, `actions`: `{ label, target, variant }[]`, rendered by `Hero` with `Button`s).

### 6.1 Collections: one shape of content, any layout

A collection is a set of items of one shape, whatever they're about: a story's facts, its brief, the features of a project, a few places with their pictures, a career. Its content and its layout are separate, so any collection can be shown any way, and changed at any time.

- **An item** has four parts, each optional, and at least one: a `heading` (a word or a few, at most 80 characters), a picture (`media`, an image media ID), a `subtext` (a short line under the heading: a value, a date, a role; at most 160 characters) and its words (`text`: paragraphs and lists, at most six of them, of the Markdown subset: bold, italic, strikethrough, code, links, and lists that nest; a blank line starts the next. They're set as compact prose, the article's own paragraphs and lists at the interface's size and the reading line height). It can also say when it was (`when`: words, not a date, such as `2016` or `July 2019 to now`; at most 40 characters), which a timeline sets by the item's mark and the other layouts show over its heading; a time alone isn't an item.
- **Its layout** (`layout`) is one of:

  | Layout | What it looks like |
  |---|---|
  | `rows` | One under another between hairlines, each picture beside its words (above them on a phone) |
  | `columns` | Side by side in a row between two hairlines, wrapping when they don't fit: the scan layer before a story's first paragraph (a story's facts) |
  | `tiles` | An even grid of cards on the raised paper, one to four to a row (`columns`; left out, one for a single item, three for three, six or more than four items, else two), fewer on a tablet, one on a phone. `prominent` sets them a step up from the raised paper, on the accent's soft tint (never inverted), with an accent edge down each tile's start side and the labels in the accent's ink: a callout, or a set of key points |
  | `masonry` | Cards in columns, each as tall as it is (the pictures keep their own shape, the words their own length) |
  | `carousel` | Cards in a strip that scrolls sideways, with Previous and Next buttons; `label` names it for assistive tech |
  | `timeline` | Down a line, each item's time (in deep marigold) in a column before its marigold mark and its words after it; the line breaks a little either side of each mark. On a phone the line runs down the start and each time sits over its words. A picture shows under its words, at most 20 rem wide |
  | `timeline-scroll` | Along a line in a strip that scrolls sideways, with the carousel's Previous and Next: the times over the line, the words under it, every mark level whatever wraps; `label` names it (left out, Timeline) |

- **The strips** (`carousel` and `timeline-scroll`) can span the viewport (`width: full`) inside the page's gutters, centred: their items shrink (down to `c.collection.strip-min`, 14 rem) so the row fits the window, and only a row that still doesn't fit scrolls, from the gutter; the other layouts show `full` as `wide`, so changing the layout never makes a block invalid. With `peek`, a strip reaches out beside its column into the room the page has there (up to the page's main region, at most an item's width) and fades to nothing across it, as the image carousel's peek does; at rest its first item sits at the column's start, and Previous and Next move it by the column's width. A strip with nothing to scroll (everything in view) hides Previous and Next, and its list leaves the tab order. A full-width strip has no room to peek into, and a phone shows a plain strip.
- **Headings** read as small capitals over the words (`label`, the default: the old fact box and tiles) or as titles (`title`).
- **Pictures** take every picture option, for all the items at once: their frame's shape (`ratio`; left out, each its own), how each is shown in it (`display`), the colour behind it, rounded corners and a drop shadow.
- **A new layout** is a new value in `COLLECTION_LAYOUTS` ([schema.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/content/schema.ts)) and its styles in the `Collection` compound; nothing in the content changes. Likely next: a compact list, a bento.

> **As built (6 October 2026).** The collection replaced the `facts` and `tiles` blocks, which were the same content in two layouts: every fact box became a collection laid out as `columns` (each label its heading, each value its subtext) and every set of tiles one laid out as `tiles` (each label its heading, each statement its words, at the width it had), so the pages look as they did. The query-driven list of items once sketched under the same name is now `listing`, still unbuilt.

> **As built (8 October 2026).** Two timeline layouts joined the five, and items gained `when`, the one part a timeline needs. The vertical `timeline` sets the times in a column (`c.collection.timeline-when-width`) before the line; the sideways `timeline-scroll` is a strip like the carousel's (the two share its buttons and script) whose items line their times, marks and words up in rows (CSS subgrid). The line, the marks and the times are component tokens (`c.collection.timeline-*`: a rule, the marigold highlighter and marigold as type), and the line and marks are hidden from assistive tech: the time beside each mark says it. The résumé's Education is the first timeline. Its Professional experience stays as headings and lists: each role there has several lists, and an item's words are one paragraph. The same day the strips gained full width and peek (`data-peek`: the list's margins reach out by `--bleed-start` / `--bleed-end`, measured by the compound's script like the image carousel's, under a mask that fades across them).

### 6.2 Tables: rows and columns of short facts

A table is for facts compared across the same columns: options side by side, a schedule, a specification. Use a collection when each item is a few sentences of its own, and a table when the reader reads across.

- **Its cells** are one line each (bold, italic, strikethrough, code and links; no lists or line breaks). A body cell can be empty; every column heading has one to 80 visible characters after its Markdown is parsed. Every row has a cell for each column, at most 8 columns and 60 rows.
- **Row headings:** with `rowHeadings`, the first column names each row, so a screen reader reads every cell with its row's name and its column's.
- **Narrow places:** it never makes the page scroll sideways. Too wide for its place, it scrolls in its own frame (a focusable region, with the overlay handle); on a phone, a table of three columns or more sizes each column to its words, up to `c.table.cell-max`, instead of squeezing them into tall, narrow rows.
- **In edit mode** every heading and body cell is rich-text editable in the article canvas. `Tab` moves across cells; `Enter` moves down, appending at the final row; edge buttons append; row and column menus insert, move or delete structure. Caption, width, row-heading semantics and a collapsed **Bulk edit table** fallback remain in the inspector. In that fallback, column headings are on the first line, then a row a line, with cells split by `|` (`\|` for a literal one). A rich copy of an HTML table (two rows and two columns or more) pasted between blocks still creates a table.

> **As built (7 October 2026).** Added when a case study's comparisons needed real tables; until then the subset allowed none.

> **As built (9 October 2026).** [Inline table editing](../editor/table-editing.md) made every cell, including column and row headings, WYSIWYG-editable in the article canvas with one-line rich text (bold, italic, strikethrough, code and links), plus edge buttons and compact row and column action menus. The JSON shape stayed the same.

**The Markdown subset** in `text`, `pointOfView`, `bio` and the like:
- **Allowed:** paragraphs, emphasis, strong, strikethrough (`~~words~~`), inline code, links (`https:`, `http:`, `mailto:`, `ref:`), bulleted and numbered lists, and hard line breaks.
- **Lists nest,** up to three levels: a line indented under an item (to where that item's words start: two spaces under `- `, three under `1. `) is an item of a list inside it, bulleted or numbered as its own marker says (`- One` then `  1. One a`). A list's own items keep one kind; a list written flat stays flat. An item can break its line (a backslash, or two spaces, at the end, as Shift+Enter writes it): the next line is more of that item, written indented under its words.
- **Not allowed:**
  - raw HTML;
  - images (use `figure`);
  - headings (use `heading`, so every heading is a real landmark with a stable anchor);
  - tables (use the `table` block, §6.2).

## 7. Lifecycle and visibility

The governance lifecycle, as `status`:

| Status | Built? | Notes |
|---|---|---|
| `draft` | No | Preview only |
| `factReview` | No | Preview only |
| `editorialReview` | No | Preview only |
| `approved` | No | Ready; publishing is setting `published` (with `publishedAt`) |
| `published` | Yes | Live, where the structures place it |
| `stale` | Yes | Live, and listed by `content:check` as due for review |
| `archived` | No | Out of every structure; its path must redirect (§8) |

`visibility` follows the IA: `public`, `publicRedacted` and `summaryOnly` can be published. `privateDiscussionOnly` and `notPublishable` exist so the inventory can record them, but the build refuses to publish them, and the `api` adapter never asks for them with the public token.

## 8. Validation rules

The build runs these checks (`npm run content:check`), and names the file and field that fails.

| ID | Rule |
|---|---|
| V1 | Every resource matches its schema; unknown fields in mock files are errors |
| V2 | IDs are unique within a type; node slugs are unique among siblings; paths are unique site-wide |
| V3 | Every reference resolves to a published resource of the right type (a published item may not link to a draft) |
| V4 | Every menu entry, redirect and planet `fullPage` resolves; the primary menu has the IA's four destinations |
| V5 | Every image used has alt text, unless it's marked `decorative`; third-party media has a credit and a licence |
| V6 | A case study has one primary practice area, at most two secondary ones, at least one contribution, one or two outcome types, at least one constraint, and at least one practice-area link |
| V7 | Card phrases respect the IA's limits (one practice area, one role phrase, one outcome phrase) |
| V8 | Only the published statuses and public visibilities are built |
| V9 | **Retired** ([sections spec D11](../sections/spec.md#9-decisions)): there's no routes lock. A renamed, moved or unpublished page leaves its old address, with no redirect |
| V10 | The planet's `world` values pass the game's `validateLandmarks` and layout tests |
| V11 | `stale` is reported (not failed) when `reviewedAt` is older than the review cadence (twice a year for case studies) |
| V12 | **One canonical page:** every published item is placed on the site exactly once (by an item node or a hub's query). An item placed twice fails; an item placed nowhere is reported, since it has no page (except a gallery that's only embedded in bodies) |
| V13 | **A way out from the planet:** every item a place shows has a canonical page on the site, and every place has a `fullPage`. The planet can arrange content its own way, but never shows something with no page to open |

## 9. An example

A case study, in the mock layout at `content/case-studies/design-system-at-scale.json`. Its words are placeholders, like the rest of today's content, until the owner writes them. Nothing in it says where it appears: the site structure places it under Work, and the planet structure can show it in the Workshop, the Greenhouse or both.

```json
{
  "id": "design-system-at-scale",
  "type": "caseStudy",
  "slug": "design-system-at-scale",
  "title": "Placeholder: scaling a design system across many teams",
  "summary": "Placeholder: how a shared system replaced a dozen divergent kits.",
  "status": "draft",
  "visibility": "public",
  "updatedAt": "2026-09-29",
  "locale": "en",
  "premise": "Placeholder: one sentence that frames the problem.",
  "outcome": "Placeholder: the outcome statement.",
  "role": "Placeholder: what was led, decided and built.",
  "team": "Placeholder: disciplines and partners.",
  "period": { "start": "2023", "end": "2024" },
  "context": { "disclosed": false },
  "practiceAreas": { "primary": "systems-and-technology", "secondary": ["strategy-and-leadership"] },
  "contributions": ["led", "strategized", "built"],
  "outcomeTypes": ["system-outcome"],
  "engagementType": "design-system",
  "constraints": ["Placeholder: a real constraint or trade-off."],
  "cover": "case-studies/design-system-at-scale/cover",
  "card": { "role": "Placeholder role phrase", "outcome": "Placeholder outcome phrase" },
  "body": [
    { "type": "heading", "level": 2, "text": "Context and stakes" },
    { "type": "text", "markdown": "Placeholder paragraph with a link to [the practice area](ref:practiceArea/systems-and-technology)." },
    { "type": "figure", "media": "case-studies/design-system-at-scale/before-after", "width": "popout", "lightbox": true },
    { "type": "heading", "level": 2, "text": "Key decisions" },
    { "type": "quote", "variant": "pull", "text": "Placeholder pull quote." }
  ],
  "related": [{ "type": "caseStudy", "id": "core-productivity-flow" }]
}
```
