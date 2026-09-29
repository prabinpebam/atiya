# Content model

Every resource the site renders, its fields, how resources refer to each other, the blocks a body is made of, and the rules the build enforces. The model implements the IA's [taxonomy and content model](../ia-navigation/03-taxonomy-and-content-model.md), [templates](../ia-navigation/05-page-and-content-templates.md) and [governance](../ia-navigation/07-editorial-and-governance.md). Where this page and those differ, the IA is right and this page is fixed. The architecture is in the [spec](spec.md); the transport is in the [API contract](api.md).

> **TL;DR.**
> - **Resources:** four kinds of document (standard page, case study, practice area, leadership topic), with notes to come; the vocabularies; people; media; menus; the planet's places; redirects; and one settings resource, `site`.
> - **Shared fields:** every document has a stable `id` for references and a `slug` for its URL, plus a title, a summary, a lifecycle `status`, a `visibility`, dates, SEO fields and a `body` of typed blocks.
> - **Blocks** map one to one onto the design system's components (text, heading, figure, gallery, carousel, video, quote, divider…). Text is a small Markdown subset with no raw HTML.
> - **References:** by ID. A link that can point at anything is a *target* (`{ "type": "caseStudy", "id": "…" }`, a URL, or an app route like the planet).
> - **The build refuses bad content:** a missing required field, a dangling reference, a missing alt text, an unpublishable visibility, or a published URL that disappears without a redirect.

<figure class="slate-figure">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 520" role="img" aria-labelledby="cp-model__title cp-model__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="cp-model__title">The content model's resources and references</title>
<desc id="cp-model__desc">Documents (pages, case studies, practice areas, leadership topics and, later, notes) sit in the IA tree by their parent and hold a body of blocks. Menus, places and redirects point at documents through targets. The route table is derived from the documents. Documents refer to people, vocabulary terms and media by ID. The site settings name the owner and the social card.</desc>
<g id="cp-model__menus" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-1" x="40" y="40" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="58" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-1" data-slate-fit-padding="16">Menus</text>
<text x="58" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-1" data-slate-fit-padding="16">primary, actions, footer</text>
</g>
<g id="cp-model__places" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-2" x="280" y="40" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="298" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-2" data-slate-fit-padding="16">Places</text>
<text x="298" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-2" data-slate-fit-padding="16">the planet's landmarks</text>
</g>
<g id="cp-model__redirects" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-3" x="520" y="40" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="538" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-3" data-slate-fit-padding="16">Redirects</text>
<text x="538" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-3" data-slate-fit-padding="16">old path → target</text>
</g>
<g id="cp-model__routes" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-4" x="760" y="40" width="200" height="64" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="778" y="68" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-4" data-slate-fit-padding="16">Route table</text>
<text x="778" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-4" data-slate-fit-padding="16">derived: path → document</text>
</g>
<g id="cp-model__documents" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-5" x="40" y="152" width="920" height="184" rx="20" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="64" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-5" data-slate-fit-padding="16">Documents</text>
<text x="64" y="210" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="cp-model__body-5" data-slate-fit-padding="16">In the IA tree by their parent; each holds a body of blocks</text>
<rect id="cp-model__body-6" x="64" y="238" width="160" height="56" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="80" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-6" data-slate-fit-padding="16">Page</text>
<rect id="cp-model__body-7" x="244" y="238" width="160" height="56" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="260" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-7" data-slate-fit-padding="16">Case study</text>
<rect id="cp-model__body-8" x="424" y="238" width="160" height="56" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="440" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-8" data-slate-fit-padding="16">Practice area</text>
<rect id="cp-model__body-9" x="604" y="238" width="160" height="56" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="620" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-9" data-slate-fit-padding="16">Leadership topic</text>
<rect id="cp-model__body-10" x="784" y="238" width="152" height="56" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="800" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="cp-model__body-10" data-slate-fit-padding="16">Note (later)</text>
</g>
<g id="cp-model__people" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-11" x="40" y="400" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="58" y="428" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-11" data-slate-fit-padding="16">People</text>
<text x="58" y="450" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-11" data-slate-fit-padding="16">owner, collaborators</text>
</g>
<g id="cp-model__vocabularies" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-12" x="280" y="400" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="298" y="428" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-12" data-slate-fit-padding="16">Vocabularies</text>
<text x="298" y="450" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-12" data-slate-fit-padding="16">contributions, topics…</text>
</g>
<g id="cp-model__media" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-13" x="520" y="400" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="538" y="428" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-13" data-slate-fit-padding="16">Media</text>
<text x="538" y="450" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-13" data-slate-fit-padding="16">master + sidecar</text>
</g>
<g id="cp-model__site" data-slate-svg-step="9" data-slate-svg-effect="fade-rise">
<rect id="cp-model__body-14" x="760" y="400" width="200" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="778" y="428" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-model__body-14" data-slate-fit-padding="16">Site</text>
<text x="778" y="450" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-model__body-14" data-slate-fit-padding="16">settings, owner, social card</text>
</g>
<text x="150" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">target</text>
<text x="390" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">target</text>
<text x="630" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">target</text>
<text x="870" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">derived</text>
<text x="150" y="372" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">by ID</text>
<text x="390" y="372" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">by ID</text>
<text x="630" y="372" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">by ID</text>
<g id="cp-model__flow-1" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M140 104 L140 142" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="140,151 145,142 135,142" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-2" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M380 104 L380 142" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="380,151 385,142 375,142" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-3" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M620 104 L620 142" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="620,151 625,142 615,142" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-4" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M860 152 L860 114" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="860,105 865,114 855,114" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-5" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M140 336 L140 390" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="140,399 145,390 135,390" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-6" data-slate-svg-step="15" data-slate-svg-effect="draw">
<path d="M380 336 L380 390" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="380,399 385,390 375,390" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-7" data-slate-svg-step="16" data-slate-svg-effect="draw">
<path d="M620 336 L620 390" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="620,399 625,390 615,390" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-model__flow-8" data-slate-svg-step="17" data-slate-svg-effect="draw">
<path d="M760 432 L730 432" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="721,432 730,437 730,427" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The resources and how they refer to each other. The site settings name the owner. Documents (pages, case studies, practice areas, leadership topics, notes) sit in the IA through their parent, reference people, vocabulary terms and media, and hold a body of blocks that also reference media and targets. Menus and places point at documents; redirects map old paths to targets.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The references, as a table</summary>

| From | Field | To |
|---|---|---|
| Site | `owner` | Person |
| Site | `socialImage` | Media |
| Any document | `parent` | Page (its place in the IA) |
| Any document | `hero`, blocks | Media |
| Any document | `related` | Documents |
| Case study | `practiceAreas.primary`, `.secondary` | Practice areas |
| Case study | `contributions`, `outcomeTypes`, `engagementType`, `tools` | Vocabulary terms |
| Case study | `testimonial.person`, `collaborators` | People |
| Practice area | `related` | Practice areas |
| Leadership topic, note | `evidence`, `related` | Case studies |
| Menu item | `target` | A document, a URL or an app route |
| Place | `target` | A document |
| Redirect | `to` | A target |

</details>

## 1. Conventions

- **Format.** JSON (UTF-8, two-space indent). One resource per file in the mock layout ([API §6](api.md#6-the-mock-api-files-that-mirror-it)).
- **Names.** Fields are `camelCase`. Resource types in targets are `camelCase` singular (`caseStudy`); API paths are `kebab-case` plural (`/v1/case-studies`).
- **IDs** are lowercase `kebab-case`, unique within their type, and **never change**. References use IDs.
- **Slugs** are lowercase `kebab-case`, used only to build URLs, and may change (with a redirect, §8). A new document's slug usually equals its ID.
- **Dates** are ISO 8601: `2026-09-29` or `2026-09-29T10:00:00Z`. A period of time uses the precision the story allows: `2021`, `2021-03`.
- **Text lengths** are limits, not targets: a `summary` is at most 160 characters, a card phrase at most 80.
- **Localisation.** Every resource has `locale` (default `en`). One locale is built today (§9 of the [spec](spec.md#9-security-privacy-and-localisation)).
- **Unknown fields** are an error in the mock files (to catch typos), and ignored from the API (so the backend can add fields within a version, D12).

## 2. Shared document fields

Every document (page, case study, practice area, leadership topic, note) has these fields.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable identifier |
| `type` | enum | yes | `page`, `caseStudy`, `practiceArea`, `leadershipTopic`, `note` |
| `slug` | string | yes | The last URL segment ([IA §3](ia.md#3-routes)) |
| `title` | string | yes | The page's H1 |
| `navLabel` | string | no | A shorter name for menus and breadcrumbs ("Work"), when the title is long |
| `summary` | string ≤ 160 | yes | The standfirst, the card text and the meta description unless `seo.description` is set |
| `parent` | page ID | no | Its parent in the IA; absent only for the home page |
| `order` | integer | no | Editorial order among its siblings (the IA's default order is editorial, not chronological) |
| `status` | enum | yes | The lifecycle (§7) |
| `visibility` | enum | yes | `public`, `publicRedacted` or `summaryOnly`; anything else can't be published (§7) |
| `publishedAt` | date | when published | The first publication; drives scheduled publishing |
| `updatedAt` | date | yes | The last meaningful edit (shown as "Updated") |
| `reviewedAt` | date | no | The last governance review; drives the "stale" check |
| `locale` | string | yes | `en` |
| `hero` | media ref | no | The lead picture, with an optional `caption` and `credit` override |
| `body` | block[] | yes | The content (§6); may be empty for index pages |
| `related` | document ref[] | no | Two or three, chosen editorially |
| `seo` | object | no | `title`, `description`, `image` (media), `noindex` |

## 3. Document types

### Page

Every page in the sitemap that isn't one of the other types: home, the Work, Expertise and Leadership overviews, About, Contact, Resume, Colophon, Now, Privacy and the 404 page.

| Field | Type | Notes |
|---|---|---|
| `template` | enum | `home`, `workIndex`, `expertiseOverview`, `leadershipOverview`, `notesIndex`, `standard`, `contact`, `resume`, `notFound`: the layout and the section order the [templates](../ia-navigation/05-page-and-content-templates.md) define |
| `sequence` | boolean | Whether its children's order has meaning, so they get previous and next links ([IA §2](ia.md#2-rules-that-stay-in-code)); default `false` |

A page's sections are blocks: a home page is a `hero`, a `collection` of featured case studies, a `collection` of practice areas, and so on (§6).

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

### Note (later)

`topics` (topic term IDs), plus the shared fields. A note is published only when there's a maintenance plan (the IA's backlog), so the type is specified but not built in the first release.

## 4. Supporting resources

| Resource | Fields | Notes |
|---|---|---|
| **Site** (one) | `name`, `positioning`, `description`, `owner` (person), `socialImage` (media), `profiles` (`{ label, href, kind }[]`), `contactEmail`, `disclaimer`, `locale` | Everything the site says about itself |
| **Person** | `id`, `name`, `role`, `bio` (Markdown), `avatar` (media), `links` | The owner, collaborators and testimonial givers (with permission) |
| **Vocabulary term** | `id`, `label`, `description?`, `order` | One file per vocabulary: `contributions`, `outcomeTypes`, `engagementTypes`, `tools`, `topics` |
| **Menu** | `key`, `label` (its accessible name), `items[]`: `{ id, label, target, children?, kind: link or action }` | `primary`, `actions`, `footer`, the local menus ([IA §4](ia.md#4-menus)) |
| **Place** | `id`, `target` (document), `order`, `label`, `kicker`, `summary ≤ 140`, `dialog: { intro, highlights ≤ 5 }`, `world: { lat, lon, modelYawDeg, footprintU, approachDistanceU, variant, accent }` | The planet's landmark for an IA page ([IA §6](ia.md#6-the-planet)); `world` is engineering-owned and validated by the game's rules |
| **Media** | `id`, `kind`, `file`, `alt`, `decorative`, `caption`, `credit`, `licence`, `focus`, and more | Specified in [media §3](media.md#3-the-metadata-sidecar) |
| **Redirect** | `from` (path), `to` (target), `status` (301 or 302), `since` | Written whenever a published path changes |

## 5. References and targets

- **A typed field holds an ID.** When the field can only point at one type, it's a bare ID: `"primary": "product-experience"`, `"cover": "case-studies/design-system-at-scale/cover"`.
- **A target can point at anything a link can.** It's an object:

| Target | Resolves to |
|---|---|
| `{ "type": "page", "id": "work" }` (or any document type) | The document's path from the route table |
| `{ "type": "url", "href": "https://…" }` | The URL (https, http or mailto only) |
| `{ "type": "app", "name": "play" }` | A route the code owns: `home`, `play`, `design`, `docs` |
| `{ "type": "media", "id": "…" }` | A file to download (the résumé PDF) |

- **Inside Markdown**, an internal link uses the `ref:` scheme, `[the design system](ref:caseStudy/design-system-at-scale)`, so a slug change never breaks a link in a body.
- **Resolution** happens in the view mappers: a target becomes an `href` through the route table and `withBase`, so the base path (`/atiya` on GitHub Pages) is never written into content.

## 6. Blocks

A `body` is an array of blocks. Each block has a `type` and an optional `id` (an anchor; headings get one from their text if absent). The renderer maps each type onto one component. A type marked "new" needs a component added to the design system (in its tier, with a story) before content may use it.

| Block | Fields | Renders with |
|---|---|---|
| `text` | `markdown` | `Prose` |
| `heading` | `level` (2 to 4), `text` | `Prose` heading, with an anchor id; it's also a minimap landmark |
| `figure` | `media`, `caption?`, `credit?`, `width` (`content`, `popout`, `wide`, `full`), `lightbox?` | `Figure` |
| `gallery` | `items` (media refs), `layout` (`grid`, `mosaic`, `row`), `caption?`, `lightbox?` | `Gallery` |
| `carousel` | `items` (`{ media, caption? }[]`), `label`, `peek?`, `pager?`, `arrows?` | `Carousel` |
| `video` | `media` (a video asset) or `embed` (`{ provider: youtube or vimeo, id }`), `caption?`, `width?` | `VideoEmbed` |
| `quote` | `text`, `cite?` (text or person), `variant` (`block`, `pull`) | `Quote` |
| `divider` | none | `Divider` |
| `hero` (pages) | `title?`, `standfirst?`, `media?`, `actions` (`{ label, target, variant }[]`) | `Hero` with `Button`s |
| `collection` (pages) | `source` (a query: `type`, `filter`, `sort`, `limit`, `featured`), `presentation` (`cards` or `list`), `heading?` | `StoryCard` grid or `ContentsList` |
| `related` | `items` (document refs), `heading?` | `StoryCard` grid |
| `facts` | `items` (`{ label, value }[]`) | New: a definition list (the case study's scan layer uses it too) |
| `metrics` | `items` (`{ value, label, note? }[]`) | New: a metrics list |
| `callout` | `tone` (`note`, `caution`), `markdown` | New |

**The Markdown subset** in `text`, `pointOfView`, `bio` and the like: paragraphs, emphasis, strong, inline code, links (`https:`, `http:`, `mailto:`, `ref:`), bulleted and numbered lists, and hard line breaks. Not allowed: raw HTML, images (use `figure`), headings (use `heading`, so every heading is a real landmark with a stable anchor), and tables (a block later).

## 7. Lifecycle and visibility

The governance lifecycle, as `status`:

| Status | Built on the public site? | Notes |
|---|---|---|
| `draft` | No | Preview only |
| `factReview` | No | Preview only |
| `editorialReview` | No | Preview only |
| `approved` | No | Ready; publishing is setting `published` (with `publishedAt`) |
| `published` | Yes | Live and in navigation |
| `stale` | Yes | Live, and listed by `content:check` as due for review |
| `archived` | No | Out of navigation; its path must redirect (§8) |

`visibility` follows the IA: `public`, `publicRedacted` and `summaryOnly` can be published. `privateDiscussionOnly` and `notPublishable` exist so the inventory can record them, but the build refuses to publish them, and the `api` adapter never asks for them with the public token.

## 8. Validation rules

The build runs these checks (`npm run content:check`), and names the file and field that fails.

| ID | Rule |
|---|---|
| V1 | Every resource matches its schema; unknown fields in mock files are errors |
| V2 | IDs are unique within a type; slugs are unique among siblings; paths are unique site-wide |
| V3 | Every reference resolves to a published resource of the right type (a published page may not link to a draft) |
| V4 | Every menu target and place target resolves; the primary menu has the IA's four destinations |
| V5 | Every image used has alt text, unless it's marked `decorative`; third-party media has a credit and a licence |
| V6 | A case study has one primary practice area, at most two secondary ones, at least one contribution, one or two outcome types, at least one constraint, and at least one practice-area link |
| V7 | Card phrases respect the IA's limits (one practice area, one role phrase, one outcome phrase) |
| V8 | Only the published statuses and public visibilities are built |
| V9 | **Routes lock:** every path in `content/routes.lock.json` (written by each build of published content) still exists, or has a redirect. A renamed or archived page can't break a link silently |
| V10 | The places' `world` values pass the game's `validateLandmarks` and layout tests |
| V11 | `stale` is reported (not failed) when `reviewedAt` is older than the review cadence (twice a year for case studies) |

## 9. An example

A case study, in the mock layout at `content/case-studies/design-system-at-scale.json`. The words are placeholders, like the rest of today's content, until the owner writes them.

```json
{
  "id": "design-system-at-scale",
  "type": "caseStudy",
  "slug": "design-system-at-scale",
  "title": "Placeholder: scaling a design system across many teams",
  "summary": "Placeholder: how a shared system replaced a dozen divergent kits.",
  "parent": "work",
  "order": 2,
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
