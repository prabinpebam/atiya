---
name: slate
title: Slate
description: "Use when: creating, converting, organizing, presenting, or reviewing documentation with Slate; building a navigable visual-first static documentation site; or turning notes, transcripts, Markdown, research, and extracted documents into structured pages, charts, diagrams, infographics, and presentations."
version: 0.5.0
---

# Slate

Slate is a project-agnostic documentation system and agent skill for creating beautiful,
navigable, visual-first static documentation sites.

Turn raw content into a beautiful, navigable, **static** documentation site. You (the agent) read
this file, take the user's raw content, and generate:

- one **page** per topic (`.html` for rich layout, `.md` for prose, or a mix),
- **visualizations** (charts, diagrams, infographics) for anything that carries data, structure,
  or relationships - embedded as figures,
- optional **read-only Canvas documents** for structured information that benefits from an
  explorable infinite canvas, named nested groups, repeated placements, and professional viewport
  controls,
- a **`docs-manifest.json`** listing every page,
- an optional **`slate.config.json`** for branding,

then synchronize the package-owned runtime into the host content root. **You never hand-edit a
generated host `shell/` or add page-specific CSS or JavaScript.** You compose pages from the
documented component vocabulary in
[`components/`](components/README.md) and from the visualization skills in
[`visualization/`](visualization/README.md).

> **Building a presentation?** For a presenter-led **deck** - a single scrollable page of slide-like
> sections, each landing a few key points with a collapsed talking track - use the companion
> [presentation-deck skill](presentation/SKILL.md) instead of a normal doc page.

## Prime directive: visual-first

> **A big part of good documentation is how well information is *represented*. Default to showing,
> not telling.** Whenever content contains numbers, trends, comparisons, proportions, processes,
> hierarchies, relationships, flows, distributions, or structured entities - **represent it as a
> visualization**, not a paragraph. Prose is the fallback, used only when a visual would not add
> clarity.

Apply a **heavy bias toward visuals**:

- If a sentence describes a quantity or change ("CSAT fell from 72% to 59%") → make a **chart**.
- If it lists steps or phases → make a **steps/flow** visual.
- If it compares options → make a **comparison** or a grouped **bar/radar** chart.
- If it describes parts of a whole → **pie/treemap**.
- If it describes a network, org, or dependency → a **graph/org/mind-map**.
- If it is a narrative packed with entities and metrics → a **chart** for the quantities plus
  prose, or an authored **explanatory SVG** when the relationships matter more than the values.
- Only if none of these fit → prose primitives.

Every page should aim to **lead with or prominently feature at least one visualization** when the
source content supports it.

## Slate Canvas: reusable structured-information view

Use **Slate Canvas** when a reader needs to explore a structured information set spatially rather
than consume one fixed figure. Canvas is project-agnostic: the package owns one fixed React Flow
runtime, schemas, validation, layout, theme behavior, controls, and tests; each host supplies only
validated records, groups, placements, source links, and manifest metadata.

Good Canvas candidates include:

- records grouped by page, view, domain, phase, owner, system, or evidence class;
- taxonomies and nested inventories where group boundaries matter;
- dependency, coverage, journey, service, decision, and capability maps;
- one source record intentionally repeated in multiple views or contexts; and
- collections too large for one readable static figure but still bounded enough to explore.

Do not use Canvas for a simple list, a small hierarchy that fits in a figure, quantitative data best
shown as a chart, or content whose spatial position would falsely imply Product or Design meaning.

### V1 capability boundary

Canvas v1 is **read-only**. It supports selection and inspection, search, pan, wheel/trackpad/touch
navigation, zoom in/out, current zoom, fit all, fit selection, actual size, minimap, full screen,
light/dark/auto theme, source links, and a keyboard-accessible group navigator. It does not allow
adding, deleting, moving, resizing, reconnecting, or saving nodes. Editable Canvas and authority-
aware write-back are future capabilities and must not be simulated with host scripts or local
patches.

One record may have multiple placements. Repetition is explicit in the host Canvas document: every
placement has its own ID and resolves one record reference. Never duplicate source meaning merely
to show it in another group.

One Canvas Document may expose multiple named **perspectives** over the same Record Sets. Use
perspectives when the source records remain identical but readers need materially different,
source-grounded groupings such as Product IA, domain/scope, customer promise, task flow, owner, or
platform. Each perspective owns its groups, placements, and layout hints; it does not clone records.
Declare one `defaultPerspectiveId`, keep perspective IDs stable, and validate exact record coverage
and intentional repetition separately for every perspective. Never create a perspective by
inferring group membership from titles or visual proximity.

### Fixed scaffold and ownership

The complete reusable scaffold is package-owned:

- [`canvas/`](canvas/README.md) contains the React source, renderer adapter, domain model, theme,
  and fixed full-viewport shell template;
- [`schema/canvas-document.schema.json`](schema/canvas-document.schema.json) and
  [`schema/canvas-record-set.schema.json`](schema/canvas-record-set.schema.json) define host data;
- [`templates/canvas-document.json`](templates/canvas-document.json) and
  [`templates/canvas-record-set.json`](templates/canvas-record-set.json) are host authoring
  starters;
- `scripts/build-canvas.mjs` builds the isolated application into `shell/canvas/`;
- `scripts/runtime-host.mjs` copies and digest-checks that generated runtime in every host; and
- `scripts/test-canvas-contracts.mjs`, runtime-host tests, portability tests, and host browser checks
  prove the boundary.

Never fork the React application, add host React components, or edit generated
`<host>/shell/canvas/` files. A host that needs another record representation proposes a generic,
trusted package renderer and tests it here first. Host JSON cannot name component modules, classes,
styles, raw visual values, callbacks, HTML, or executable formatters.

### Canvas implementation procedure

Follow this order for every Slate host:

1. **Choose the source authority.** Identify the canonical or generator-owned structured source.
  Do not scrape a readable projection when qualified source data exists.
2. **Define the grouping semantics.** Use explicit source relationships or reviewed host mapping.
  Do not infer group membership from titles, filenames, proximity, or visual convenience.
3. **Generate a Record Set.** Preserve stable record IDs, plain-text display fields, metadata, and
  source links. One source record appears once in the Record Set.
4. **Generate a Canvas Document.** Declare one or more named perspectives, each with groups and
  placements. Add another placement when one record belongs in another group or view; do not clone
  the record. Use one perspective only when no materially distinct source-grounded view is needed.
5. **Validate before rendering.** Run the generic Canvas contract suite plus a host check proving
  exact source coverage, resolvable references, intended duplicates, and generated-file parity.
6. **Register the Canvas.** Add a manifest entry with `type: "canvas"`, a `.canvas.json` path,
  `canvas.open: "new-tab"`, an appropriate icon, and concise validated `searchText`.
7. **Build and synchronize.** Run `npm run build:canvas --prefix .\slate`, then the host runtime
  sync/check. Never copy bundle files manually.
8. **Inspect the real host.** Open from reader navigation and source-page action. Check that it opens
  a new tab, fills the viewport, is nonblank, preserves all records/groups, switches every declared
  perspective without refetching or cloning the Record Set, and works in desktop, narrow, light,
  dark, keyboard, full-screen, fit-all, fit-selection, and search flows.
9. **Keep the reader isolated.** Verify ordinary pages request no Canvas JavaScript or CSS. Canvas
  loads only after its separate route opens.

The generic Canvas architecture and extension rules are specified in
[`docs/canvas-capability-spec.md`](docs/canvas-capability-spec.md).

## When to use this skill (trigger)

Use this skill when the user asks to:

- turn content into a navigable documentation site or viewer,
- format / organize / present provided content into structured, viewable pages,
- convert notes, transcripts, or extracted documents into a clean, **visual** docs experience.

## Inputs

- Raw content: Markdown, notes, transcripts, extracted docs, plain prose, tables, datasets.
- Optional branding: project name, logo, brand color, default theme.

## Outputs

- `*.html` (rich) and/or `*.md` (prose) pages - one per topic - as **body fragments** (no `<head>`).
- **Visualization assets** saved under an `assets/` folder next to the pages (e.g.
  `assets/charts/*.svg` / `*.png`), embedded via the figure component.
- `docs-manifest.json` - validated against [`schema/manifest.schema.json`](schema/manifest.schema.json).
- Optional `slate.config.json` - validated against [`schema/config.schema.json`](schema/config.schema.json).
- A generated `shell/` containing CSS, JavaScript, and vendor assets whose hashes match this
  package's canonical runtime.

## Portable package and ownership

This folder is one project-agnostic, copyable package. It owns generic instructions, components,
templates, schemas, visualization subskills, assets, demo content, runtime code, initialization,
and tests. Copy the whole `slate/` folder into a new repository; do not select
individual subfolders or duplicate it under `.github/skills`.

From the new repository root, initialize a host and the thin discovery adapter:

```powershell
node .\slate\scripts\init-project.mjs --repo . --host docs --project "Project name"
```

The host owns `index.html`, `slate.config.json`, `project.theme.css`, content, manifests, source
authority, and repository-specific policy. The package's `shell/index.html` is an initialization
template; the package owns the generated CSS, JavaScript, and vendor assets under `docs/shell/`.
Synchronize and verify those assets with:

```powershell
node .\slate\scripts\runtime-host.mjs sync --repo . --host docs
node .\slate\scripts\runtime-host.mjs check --repo . --host docs
```

The generated `.slate-runtime.json` records package identity and SHA-256 hashes. Never put host-only
files in `shell/`; keep theme overrides beside `index.html` so runtime updates remain replaceable.

### Generic-first improvement loop

When a host reveals a reusable presentation need or defect:

1. Classify it as generic capability or repository-specific meaning/branding/policy.
2. Change generic guidance, runtime, components, templates, or validation only in this package.
3. Add or update a package demo, fixture, mutation test, or portability test that proves the change.
4. Run the package tests, then synchronize the host runtime.
5. Validate the real host's content, policy, responsive layout, accessibility, and light/dark output.

Do not repair generic behavior in a generated host and backfill the package later. Product meaning,
authority, and brand decisions must not move into this package.

## Change characterization and proportional validation

Before editing, characterize the change from evidence rather than assigning it a fixed workflow by
file type or request label. Record a concise working assessment:

1. **Authority:** Is this exploratory input, sourced research, durable host content, canonical
   product meaning, host branding/configuration, generated output, or reusable Slate capability?
2. **Changed surfaces:** Which of content, source provenance, navigation/manifest, visual output,
   interaction, accessibility/responsiveness, host composition, runtime, validator/tooling, package,
   or downstream consumer behavior can actually change?
3. **Dependency reach:** Is the edit local to one page, shared by many pages, generated from another
   source, published as a package, or consumed by another repository?
4. **Risk and uncertainty:** What could become false, broken, inaccessible, incompatible, or hard to
   recover? Which assumptions remain uncertain?
5. **Discriminating checks:** What is the smallest executable or rendered check that would falsify
   each material assumption?
6. **Expansion triggers:** Which concrete failure, shared dependency, public-contract change, or
   unresolved uncertainty would justify a broader check?

This is an agentic assessment. Do not replace it with a deterministic filename classifier, a fixed
suite for every documentation edit, or a self-assigned risk score. Repository policy may impose a
mandatory check, but the remaining plan must stay proportional to the observed change.

### Select checks by affected behavior

- **Authored facts or research:** verify primary sources, observation dates, status language,
  quotations, and ordinary source links. Use independent review only when source conflict,
  consequential interpretation, or unresolved factual ambiguity remains.
- **Manifest or navigation:** parse the manifest and check the changed route, uniqueness, file
  existence, title/group/order, and any affected links. Do not retest unrelated routes by default.
- **Rendered content:** inspect the changed page at one representative desktop viewport. Add mobile,
  theme, keyboard, overflow, or assistive checks only when the change can affect those dimensions or
  when existing component behavior is uncertain.
- **Authored excerpt references:** run the production attribution validator. Run validator mutation
  tests only when the attribution contract, parser, validator, fixtures, or runtime behavior changed.
- **Reusable Slate component, runtime, template, schema, initializer, or package:** add focused
  package evidence, run the affected package test, synchronize generated runtime when needed, and
  run the full Slate suite when the shared blast radius warrants it.
- **Host entry, config, theme, or generated runtime:** run the runtime drift check and browser checks
  for the affected host behavior. Do not run portability tests unless portability changed.
- **Canonical product, generated artifacts, or downstream UI contract:** use the owning repository's
  Product and cross-repository gates. A readable projection or research note alone does not imply
  Product-contract impact.

Start narrow. Expand only when a named trigger occurs. Once the relevant checks pass and no trigger
remains, stop validating. In the final report, state what was run and any broad suites intentionally
skipped because their behavior was unaffected.

## Procedure (deterministic - follow in order)

1. **Ingest** the content; identify topics → one page per topic.
2. **Outline** each page: title, TL;DR, section hierarchy (H2/H3).
3. **Visualize first (per section).** For every section, ask: *does this carry data, structure, or
   relationships?* If yes, choose a visualization from the **decision matrix** below, produce it
   with the matching visualization skill, save the asset, and embed it as a figure. Do this
   **before** reaching for text components.
4. **Select components** for the non-visual remainder from the catalog, matching content shape to
   component.
5. **Generate** each page from [`templates/page.html`](templates/page.html) (or `templates/landing.html`
   for an overview), filling slots with visualizations and catalog component markup.
6. **Build the manifest** with `order`/`group` reflecting the reading sequence, and a
   content-appropriate **`icon`** for every page (see [Page icons](#page-icons)).
7. **Apply branding** via host-owned `slate.config.json` and token overrides in the host theme.
8. **Synchronize and check** the generated runtime with `scripts/runtime-host.mjs`.
9. **Self-validate** against the checklist below; fix issues.
10. **Stop.** The user reviews in the viewer. Invent no content or data beyond the inputs.

## Visualization decision matrix - content shape → visual → skill

Choose the visual whose shape matches the data, then author it with the linked skill. All visuals
are embedded as **figures** (see "Embedding a visualization").

| If the content is… | Represent it as | Use skill |
| --- | --- | --- |
| A time series / trend | `line` (trend) or `area` (cumulative) | [chart](visualization/skills/chart/SKILL.md) |
| Category comparison | `bar` / `column`; `radar` for multi-dimension | [chart](visualization/skills/chart/SKILL.md) |
| Parts of a whole | `pie` / `donut`; `treemap` for hierarchical proportion | [chart](visualization/skills/chart/SKILL.md) |
| Distribution / frequency | `histogram` | [chart](visualization/skills/chart/SKILL.md) |
| Correlation | `scatter` | [chart](visualization/skills/chart/SKILL.md) |
| Flow / conversion / funnel | `sankey` | [chart](visualization/skills/chart/SKILL.md) |
| Two-factor intensity | `heatmap` | [chart](visualization/skills/chart/SKILL.md) |
| Pivot table / spreadsheet / dense tabular data | Slate `table` component | [components/table.html](components/table.html) |
| Explorable structured records with nested groups, repeated placements, and viewport navigation | Slate **Canvas**, opened in a new full-viewport tab | [Canvas capability](canvas/README.md) |
| Bespoke explanatory diagram, editorial illustration, spatial model, scene, map, icon, pattern, or article/presentation motion subject | Custom semantic SVG | [svg-illustration](visualization/skills/svg-illustration/SKILL.md) |
| Summary poster of key facts, process diagram, or insight narrative | Custom semantic SVG authored directly | [svg-illustration](visualization/skills/svg-illustration/SKILL.md) |
| Need an icon for a card or tile | Icon lookup | [iconography](visualization/skills/iconography/SKILL.md) |

**Default path for quantities:** use
[chart](visualization/skills/chart/SKILL.md). You write a declarative JSON spec and render it
offline with Semiotic on D3 to a themeable **inline SVG**, saved beside its spec in `assets/charts/`. There is
no browser, no headless renderer, and no network call, so the same spec always yields the same
bytes.

**Default path for concepts:** use
[svg-illustration](visualization/skills/svg-illustration/SKILL.md). Explanatory and decorative
illustration is authored directly as semantic SVG, not produced by a chart engine.

## Embedding a visualization in a page

Normal viewer content is static and sanitized: **no `<script>`, no `<iframe>`, no `<style>` in
content.** So
visualizations are embedded as **static assets** - an image or inline SVG - inside the **figure**
component. (Interactive/library charts are authored, then **exported** to SVG/PNG.)

Slate Canvas does not weaken this rule. It is a separate trusted package application opened from a
manifest entry; it is never embedded as content-owned script or iframe.

Rules:

- **Save the asset locally.** If a skill returns a remote image URL, download it into
  `assets/charts/` and reference the local path so the site stays offline-capable and versioned.
- **Prefer `<img>` for exported charts** (self-contained). Use **inline `<svg>`** only for simple
  graphics that use the
  [`slate-inline` profile](visualization/skills/svg-illustration/SKILL.md#slate-production-profiles).
  The sanitizer strips `<style>` inside SVG, so style-based SVG must be converted to safe presentation
  attributes or exported to a local static asset.
- **Use the native SVG pipeline for custom vectors.** Write a visual thesis, choose a Slate production
  profile, validate structure, and inspect the real render. Do not improvise complex SVG from a few
  generic boxes or decorative shapes.
- **Slate owns animation.** Article SVG may use `slate-viewport-motion` for one finite entry sequence
  plus host replay; deck SVG uses `slate-motion-subject` and a companion manifest. Both expose stable
  scoped IDs, remain complete when static, honor reduced motion, and use semantic host colors that
  are inspected in light, dark, and applicable project themes.
- **Every authored content SVG animates.** The shell applies viewport entry and a top-right replay
  control to article, slide, and card illustrations in reading mode. Presenter replay restarts the
  current slide's authored motion. Only favicons, sanitizer fixtures, static exports, and explicit
  reduced/off fallbacks are exempt.
- **Meaningful `alt`** stating the *takeaway*, not just the chart type.
- **Caption** with `<figcaption>` for context/source.
- **Text alternative + searchability:** include the underlying numbers as a collapsible data table
  right after the figure. This satisfies accessibility and makes the data findable by search.
- Figures get **zoom (lightbox) for free** - the shell enlarges `.slate-figure img` on click.

Canonical embed:

```html
<figure class="slate-figure">
  <img src="assets/charts/csat-q1-drop.svg"
       alt="Line chart: CSAT fell from ~72% in Q4 to ~59% in Q1 2026; DSAT rose ~22% to ~33%." />
  <figcaption>CSAT declined ~13 points quarter over quarter (source: Q1 sample, &lt;2,000 responses).</figcaption>
</figure>
<details class="slate-figure-data">
  <summary>Data</summary>
  <table>
    <thead><tr><th>Quarter</th><th>CSAT</th><th>DSAT</th></tr></thead>
    <tbody>
      <tr><td>Q4</td><td>72%</td><td>22%</td></tr>
      <tr><td>Q1</td><td>59%</td><td>33%</td></tr>
    </tbody>
  </table>
</details>
```

## Component catalog - content shape → component

Reach for a **visualization first** (matrix above). Use these components for structure and for
content that is genuinely non-visual.

| If the content is… | Use | Example |
| --- | --- | --- |
| **Any data/relationship/process** | **Visualization (figure)** | see matrix above |
| A big number / KPI | Metric tile | [metric-tile.html](components/metric-tile.html) |
| A one-line summary of the page | TL;DR band | [tldr.html](components/tldr.html) |
| A page title + lead-in | Hero | [hero.html](components/hero.html) |
| An image needing a caption | Figure | [figure.html](components/figure.html) |
| A set of parallel items/links | Card grid | [card-grid.html](components/card-grid.html) |
| An ordered procedure or phases | Steps / Timeline | [steps.html](components/steps.html) |
| Two options side by side | Comparison | [comparison.html](components/comparison.html) |
| An aside/warning/tip | Callout | [callout.html](components/callout.html) |
| A status/label word | Badge | [badge.html](components/badge.html) |
| Key/value specs | Definition list | [defs.html](components/defs.html) |
| Tabular data (that is not better as a chart) | Table | [table.html](components/table.html) |
| A section's iteration/change history | Version history (pill + modal) | [version-history.html](components/version-history.html) |
| A link to an excerpt on another page | Excerpt reference (pill + popover) | [xref.html](components/xref.html) |
| Code | Fenced code block (Markdown) | - |

If the content needs something not covered, choose the closest visual/component or fall back to
prose - and flag the gap to the user.

## Page icons

Give **every page a content-appropriate icon** so the navigation reads at a glance - never leave the
default document icon on everything. Set it via the manifest **`icon`** field: a **Material Symbols
Outlined** name. The shell renders `entry.icon` in the nav and falls back to `description` only when
it is missing.

Pick the icon by what the page is *about*, not by its folder:

| Page is about… | Icon (Material Symbols Outlined) |
| --- | --- |
| Home / landing | `home` |
| Overview / knowledge base / index | `hub` |
| Framing / focus / capture | `center_focus_strong` |
| A model / flow / process | `conversion_path` |
| Problems / issues / pain points | `problem` (or `bug_report`) |
| Scenarios / stories / examples | `auto_stories` |
| Benchmarking / comparison / ranking | `leaderboard` |
| Strategy / vision | `flag` |
| Goals / targets | `track_changes` |
| Roadmap / timeline | `timeline` |
| User research / personas | `groups` |
| Survey / poll | `poll` |
| Feedback / discussion | `forum` (or `reviews`) |
| Metrics / analytics | `insights` |
| Features | `widgets` |
| Architecture / engineering | `schema` (or `account_tree`) |
| API reference | `api` |
| Release notes / changelog | `new_releases` |
| Source files / references | `inventory_2` |
| Security | `shield` |
| Settings / configuration | `settings` |

Differentiate pages that share a theme where their content differs (e.g. a survey `poll` vs. a
feedback summary `forum`). Any valid Material Symbols Outlined name works - browse them at
`fonts.google.com/icons`.

## Page status & last-updated

Every page may carry two optional manifest fields the shell renders automatically:

- **`status`** - authoring state. Shows as a colored dot next to the nav title and as a pill in the
  page-meta bar under the breadcrumbs. Styled values: `stub`, `planned`, `draft`, `wip`, `review`,
  `pending`, `deciding`, `stable`, `published`, `done`. Any other string renders with a neutral dot
  and a capitalized label.
- **`updated`** - an ISO 8601 date (`2026-07-04`) or date-time. Rendered as a relative time
  ("Updated 3 days ago") in the page-meta bar and nav tooltip; falls back to an absolute date beyond
  ~11 months.

```json
{ "path": "strategy/vision.html", "title": "Vision", "status": "draft", "updated": "2026-07-04" }
```

Use these to signal maturity and freshness; omit them for evergreen or finished pages.

## Version history (per-section iteration log)

To preserve *how* a section evolved without cluttering the page, author a hidden
[version-history](components/version-history.html) block at the **bottom of a section** (just before
the next `H2`/`H3`). The shell replaces it with a small "Version history" pill; clicking it opens a
modal timeline (newest first) with a formatted date/time, a one-line summary, and optional context.
Set `data-history-title` to the section name, add one `.slate-history__entry` per revision with a
`data-when` timestamp and a `.slate-history__summary`. Only capture real iteration history - never
fabricate revisions.

## Excerpt references (connect content to a source)

To tag any piece of content with a link to a specific section on **another page** - and preview an
excerpt of it inline - author an [xref](components/xref.html) pill. The shell renders a compact pill;
hovering or focusing it opens a popover card showing the source label, the excerpt, and a CTA that
deep-links to the referenced section (expanding collapsed sections and scrolling to the anchor).
Place the pill inline - inside a heading to sit beside a section title, or within a sentence or list
item.

```html
<span class="slate-xref"
      data-xref-href="../user-research/report.html#section-anchor"
      data-xref-source="Source label"
      data-xref-cta="Read the source"
      data-xref-claim-source="strategy/topic/claim.md#claim-heading"
      data-xref-evidence-source="intake/research/report.md#section-anchor">
  <span class="slate-xref__label">Pill label</span>
  <span class="slate-xref__excerpt">Short, verbatim excerpt shown in the popover.</span>
</span>
```

This is a general capability - citations, "see also" links, connecting a claim to its evidence, or
mapping problems and needs back to user research are all use cases. Quote only text that actually
exists on the target page; never fabricate an excerpt. `data-xref-claim-source` identifies the
canonical Markdown location making the assertion. `data-xref-evidence-source` identifies the
repository source containing the excerpt. Both locators are repository-relative and may include a
stable heading anchor.

Because `slate-xref` is an inline `<span>`, its label and excerpt must contain phrasing content only.
Do not place `<p>`, lists, tables, or other block content inside it; HTML parsing moves those blocks
outside the trigger and leaves an empty popover. Put the xref after the first meaningful occurrence
of a claim rather than repeating it at every mention on the same page.

After copying the package, install its validator dependency once. Before finishing documentation
changes, run the generic mutation suite and validator (replace the host path when needed):

```powershell
npm install --prefix .\slate
npm run test:attributions --prefix .\slate
node .\slate\scripts\validate-document-attributions.mjs --repo . --host docs
```

The validator rejects unregistered routes, missing anchors, excerpt drift, and absent claim/evidence
provenance. If a source has no published page or stable target section, repair that projection gap
before adding the xref.

### Specification ID previews

Exact inline-code identifiers (`CP-*`, `SC-*`, `UNSUP-*`, `UC-*`, and `IA-*`) are upgraded
automatically to preview triggers. Their summaries come only from authored semantic fields:
customer-promise copy for `CP`, situation plus expected behavior for `SC`/`UNSUP`, user outcome plus
acceptance for `UC`, and the dedicated view Purpose for `IA`. Do not construct previews by joining
route, audience, state, platform, or other table columns.

When the canonical field is not concise or contextually sufficient, add `data-preview-summary` to
the source row or heading. Its value is the reviewed summary shown in the card. Keep it to one or two
sentences, state what matters to a reader deciding whether to follow the link, and update it whenever
the owning definition materially changes. The CTA continues to point to the canonical item; the
override does not create a second source of product truth.

## Visualization skills (bundled)

Bundled under [`visualization/`](visualization/README.md). Read the linked `SKILL.md` before
authoring that visual type.

| Skill | Use for | Path |
| --- | --- | --- |
| chart | Quantitative charts rendered offline by Semiotic on D3 to themeable inline SVG (default path for data) | [visualization/skills/chart/SKILL.md](visualization/skills/chart/SKILL.md) |
| svg-illustration | Explanatory and decorative illustration authored directly as semantic SVG | [visualization/skills/svg-illustration/SKILL.md](visualization/skills/svg-illustration/SKILL.md) |
| iconography | Icons inside charts, illustrations, cards, and tiles, sourced from Fluent, Material Symbols, or Font Awesome | [visualization/skills/iconography/SKILL.md](visualization/skills/iconography/SKILL.md) |

Charts and illustrations are produced locally. Slate does not call a remote rendering service, so
chart data never leaves the machine and output is reproducible from the committed spec.

## Hard rules

1. **Visual-first.** Prefer a visualization over prose for any data, trend, comparison,
   proportion, process, hierarchy, relationship, distribution, or entity-rich narrative. Prose is
   the fallback.
2. **Every visual has a text alternative.** Meaningful `alt` + an underlying data table (or
   equivalent prose) so the information is accessible and searchable. Never present a chart as the
   *only* carrier of a fact.
3. Compose **only** from catalog components and embedded visual assets. Never invent CSS, never
   write `<style>`/`<script>` in content, never use inline `style=`. Visuals are embedded as
   **static images or inline SVG** inside a figure - never as live scripts or iframes.
4. Author **body fragments**, not full HTML documents. The shell owns `<head>`, theme, and layout.
5. **Icons come from an approved source.** Every icon used inside a chart, illustration, card, tile,
   or nav entry is official vector geometry from **Fluent Icons**, **Google Material Symbols**, or
   **Font Awesome**, and exactly one of those sources is used within a given artifact. Never draw a
   familiar icon from memory, never mix libraries, never substitute a generic dot or sparkle when
   the library has a real icon, and never use emoji. See
   [iconography](visualization/skills/iconography/SKILL.md).
6. Exactly **one H1** per page. H2/H3 drive the TOC and collapsible sections.
7. Pick format per page: prose-heavy → Markdown; layout/visual → HTML; mixed when needed.
8. Every page **leads with a TL;DR** band, and features a visualization when the content supports it.
9. **Save visualization assets locally** under `assets/`; reference relative paths.
10. Links are **relative** to real content paths; the runtime rewrites them to hash routes.
11. **Update `docs-manifest.json`** for every page (path, title, order, group).
12. **Preserve source material** - generate alongside inputs, never overwrite them.
13. **Accessibility**: alt text on every image/chart, semantic markup, keyboard-reachable components.
14. **No emoji** - use an approved icon source instead. See
    [iconography](visualization/skills/iconography/SKILL.md) and [`assets/icons/`](assets/icons/).
15. **No fabrication** - every fact, number, and data point must trace to the provided inputs. Do
    not invent data to make a nicer chart.
16. **Give every page a content-appropriate `icon`** in the manifest (a Material Symbols Outlined
    name). Never leave the default document icon on every page (see [Page icons](#page-icons)).
17. **No meta-documentation by default.** Reviews, audits, validation passes, and gap analyses update
  the durable pages they evaluate. Do not create review reports, closure records, point-in-time snapshots,
  or pages about the documentation unless the user explicitly requests a versioned record.
18. **Generic-first evolution.** Reusable capabilities and fixes land with package tests before host
  adoption. Host content, authority, branding, and policy never become generic defaults.
## Self-validation checklist

Use the change assessment above to select the applicable items. The checklist is a coverage menu,
not a command to exercise every Slate capability after every edit.

- [ ] One H1 per page; logical H2/H3 nesting.
- [ ] **Every section carrying data/structure/relationships is visualized** (or a deliberate,
      justified exception).
- [ ] Every visualization is a figure with meaningful `alt`, a caption, and an underlying data
      table (or prose) alternative.
- [ ] Visualization assets are saved under `assets/` and referenced by relative path (no
      unresolved remote-only images).
- [ ] Only catalog components + embedded static visuals used; no inline styles/scripts/iframes.
- [ ] TL;DR present on every page.
- [ ] Every page is in the manifest, in a sensible order.
- [ ] Every manifest entry has a content-appropriate `icon` (not the default document icon).
- [ ] All internal links resolve; all images have alt text and resolve.
- [ ] Every evidence-derived assertion has a canonical source link and, in published HTML, a
  validated inline excerpt reference at its first meaningful occurrence.
- [ ] Renders in light and dark (tokens guarantee contrast; check chart images read in both).
- [ ] Manifest validates against `schema/manifest.schema.json`; config (if any) against
      `schema/config.schema.json`.
- [ ] When runtime or generated host assets changed, the host passes `scripts/runtime-host.mjs check`
  and no host-only files live in `shell/`.
- [ ] No fabricated facts or data - everything traces to the inputs.

## Worked example

See [`examples/before.md`](examples/before.md) (raw input) →
[`examples/after.html`](examples/after.html) (generated page) and
[`examples/docs-manifest.json`](examples/docs-manifest.json). Imitate this structure, and add a
visualization for any data the example carries.

## Reference

This package includes the complete Slate authoring contract plus the bundled
[visualization skills](visualization/README.md). You do **not** need external repository files or to
read `shell/` source to use the skill; the catalog, templates, schemas, scripts, and visualization
skills are sufficient.
