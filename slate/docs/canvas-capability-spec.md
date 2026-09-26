# Slate Canvas Capability

> **Document type:** Package architecture, capability specification, and delivery plan
> **Package:** Slate  
> **Status:** Candidate implementation
> **Version:** 0.2
> **Date:** 2026-07-24  
> **Decision owner:** Slate package maintainers

## 1. Purpose

Slate Canvas is a reusable, project-agnostic capability for exploring structured documentation on
an infinite spatial canvas. It complements Slate's document reader and static visualization
pipeline; it does not replace either one.

Canvas opens in a new browser tab as a full-viewport application. A host can represent records as
nodes, organize them into named groups at multiple levels, repeat one source record in multiple
groups through distinct placements, and preserve links back to the owning documentation.

The first implementation uses `@xyflow/react` (React Flow) for viewport navigation, selection,
node rendering, grouping, minimap behavior, and accessibility foundations. Slate owns one fixed
React application and a renderer-neutral data contract. Host repositories supply JSON data and
grouping semantics; they do not build or fork React Flow applications.

## 2. Primary Use

Use Canvas when structured information becomes clearer through spatial exploration and named
containment. Suitable examples include:

- capabilities grouped by product page or view;
- requirements grouped by domain, release, owner, or support status;
- evidence grouped by claim and source class;
- journeys grouped by phase and actor;
- systems grouped by boundary and responsibility;
- information architecture grouped by area and section; and
- one record intentionally repeated across multiple applicable views.

Do not use Canvas when:

- a list, table, or definition set is easier to scan;
- a small hierarchy fits in a static figure;
- values are better represented by a chart;
- a relationship has not been established by source authority or reviewed host mapping; or
- spatial placement could be mistaken for approved UI design or implementation detail.

## 3. V1 Decision

### 3.1 Read-only first

Canvas v1 is read-only. A reader may:

- pan and zoom;
- search for records and groups;
- select and inspect records or groups;
- focus one result, one group, one selection, or the complete canvas;
- use a minimap and group navigator;
- open source documentation;
- change light, dark, or automatic theme; and
- enter browser full-screen mode.

A reader may not add, delete, move, resize, connect, edit, import, persist, or write back records or
groups. This is an intentional architecture boundary, not missing polish.

Editing is deferred until Slate defines a separate authority-aware contract for commands, conflict
resolution, validation, source ownership, persistence, review, and repository write-back. Hosts
must not add local scripts or fork the scaffold to simulate editing.

### 3.2 Standalone route

Canvas is a trusted package application beside the Slate reader. It is not embedded in article
content.

This preserves the reader's sanitizer boundary:

- normal content still permits no content-owned scripts, event handlers, style blocks, or iframes;
- opening an ordinary page does not load React, React DOM, React Flow, Canvas CSS, or Canvas data;
- Canvas loads only after a user opens a `canvas` manifest entry; and
- the Canvas tab does not depend on `window.opener`.

### 3.3 Renderer-neutral documents

React Flow is an implementation dependency, not Slate's saved format. Canvas Documents contain
semantic groups and placements. Record Sets contain source-backed records. Neither contract
contains React components, React Flow nodes, coordinates, callbacks, classes, raw colors, styles,
or transient viewport state.

This separation allows Slate to change renderer versions, improve layout, add static export, or
introduce another trusted adapter without migrating every host's meaning.

## 4. Ownership

| Concern | Owner |
| --- | --- |
| Canvas skill instructions and routing rules | Slate package |
| Fixed React Flow application and full-viewport shell | Slate package |
| Schemas, semantic validation, layout, and safe loading | Slate package |
| Trusted node renderers and semantic tones | Slate package |
| Runtime build, host synchronization, digests, and portability tests | Slate package |
| Structured records and their meaning | Host source authority |
| Group names, hierarchy, placements, and source links | Host repository or reviewed host generator |
| Host brand-token overrides | Host theme stylesheet |
| Browser-level acceptance for an adopted Canvas | Host repository |

The package must remain copyable as one `slate/` directory. No Microsoft Family name, Product ID
prefix, route, wording, or grouping rule may appear in generic Canvas runtime code or templates.

## 5. Fixed Package Scaffold

```text
slate/
  SKILL.md
  canvas/
    README.md
    index.html
    src/
      App.jsx
      canvas.css
      domain.mjs
      main.jsx
  docs/
    canvas-capability-spec.md
  schema/
    canvas-document.schema.json
    canvas-record-set.schema.json
    config.schema.json
    manifest.schema.json
  templates/
    canvas-document.json
    canvas-record-set.json
  scripts/
    build-canvas.mjs
    runtime-host.mjs
    test-canvas-contracts.mjs
    test-runtime-host.mjs
    test-portability.mjs
  shell/
    canvas/
      index.html
      canvas.js
      canvas.css
      canvas.js.LEGAL.txt
```

The editable authority is under `canvas/`, `schema/`, and `scripts/`. `shell/canvas/` is generated
package output. A host receives the generated files under `<host>/shell/canvas/` through
`runtime-host.mjs`; host copies are never edited.

The package build uses pinned React, React DOM, React Flow, Lucide React, and esbuild dependencies.
The production output is static and offline-capable after checkout.

## 6. Generic Data Model

### 6.1 Record Set

A Record Set is a versioned collection of source-backed structured records.

```json
{
  "$schema": "https://slate.dev/schema/canvas-record-set.schema.json",
  "schemaVersion": 1,
  "id": "example-records",
  "revision": "example-revision",
  "records": [
    {
      "id": "RECORD-001",
      "kind": "capability",
      "title": "Review one source-owned outcome",
      "eyebrow": "Organizer",
      "source": {
        "label": "Source definition",
        "href": "content/source.html#record-001"
      },
      "metadata": [
        { "label": "Owner", "value": "Source authority" }
      ]
    }
  ]
}
```

One source record appears once in a Record Set. Record fields are plain text and declarative
metadata. They never contain HTML, CSS, scripts, event handlers, component references, or arbitrary
formatters.

### 6.2 Canvas Document

A Canvas Document declares groups and placements.

```json
{
  "$schema": "https://slate.dev/schema/canvas-document.schema.json",
  "schemaVersion": 1,
  "id": "example-canvas",
  "title": "Example capability map",
  "description": "Records grouped by area and section.",
  "kind": "capability-map",
  "mode": "readonly",
  "source": {
    "label": "Source catalog",
    "href": "content/source.html"
  },
  "recordSources": [
    { "id": "example-records", "path": "example-records.json" }
  ],
  "groups": [
    { "id": "area-home", "title": "Home", "tone": "aqua", "order": 1 },
    { "id": "section-status", "title": "Status", "parentId": "area-home", "order": 1 }
  ],
  "placements": [
    {
      "id": "placement-record-001-home",
      "groupId": "section-status",
      "recordRef": { "sourceId": "example-records", "recordId": "RECORD-001" },
      "variant": "standard",
      "order": 1
    }
  ],
  "presentation": {
    "groupColumns": 3,
    "childGroupColumns": 2,
    "recordColumns": 2
  }
}
```

### 6.3 Groups

A group has a stable ID, visible title, optional description, optional registered semantic tone,
order, and optional parent group. V1 supports three semantic levels including leaf records.

Group names must explain the source-derived boundary. Generic runtime code does not infer names from
record text or physical file paths.

### 6.4 Placements and repetition

A placement is a visual occurrence of one record inside one group. Placement identity is distinct
from record identity.

The same record may appear in multiple groups:

```json
[
  {
    "id": "placement-record-001-home",
    "groupId": "view-home",
    "recordRef": { "sourceId": "example-records", "recordId": "RECORD-001" }
  },
  {
    "id": "placement-record-001-details",
    "groupId": "view-details",
    "recordRef": { "sourceId": "example-records", "recordId": "RECORD-001" }
  }
]
```

This repetition does not clone or change the record. Host validation must distinguish intentional
repeated placement from duplicate placement IDs or accidental source duplication.

### 6.5 Perspectives

One Canvas Document may define multiple named perspectives over the same Record Sets. A perspective
contains its own groups, placements, and optional layout hints. The document declares one stable
`defaultPerspectiveId`, and the fixed toolbar presents a responsive `View` selector whenever more
than one perspective exists.

Use perspectives only when each grouping is grounded in source relationships or a reviewed host
mapping. Suitable examples include Product IA, domain and scope, customer promise, task flow,
authority, and platform. Switching perspective reuses the already validated Record Sets; it does
not refetch, clone, mutate, or reinterpret source records.

Legacy documents with one top-level `groups` and `placements` set remain supported as one normalized
`Overview` perspective. A document cannot combine that legacy shape with named `perspectives`.

### 6.6 Semantic validation

JSON Schema validates local structure. Package domain validation additionally proves:

1. document, source, record, group, and placement IDs are valid and unique in their scope;
2. every source path is normalized and host-relative;
3. every parent group resolves;
4. containment is acyclic and stays within the depth limit;
5. every placement group resolves;
6. every placement source and record resolves;
7. records and placements stay within resource limits;
8. only registered modes, variants, and tones are used; and
9. Canvas v1 documents declare `mode: "readonly"`.
10. perspective IDs are unique, the default resolves, and every perspective validates independently.

An adopting host adds semantic checks for exact source coverage, intended omissions, intended
repetition, grouping authority, and generator drift.

## 7. Deterministic Layout

Hosts provide semantic order, not geometry. Slate measures and lays out the Canvas deterministically:

- root groups, nested groups, and records are packed bottom-left against a running skyline, so a
  short item never reserves the height of the tallest item beside it;
- nested groups lay out within their parent;
- each record card is measured from its own text: card width hugs the widest of its identifier,
  title, and context line within bounded minimum and maximum widths, and card height follows the
  predicted wrapped line count;
- text is measured with a deterministic, DOM-free character model that is deliberately biased high,
  so a measured box is never narrower or shorter than the painted content;
- parent dimensions derive from child dimensions;
- group and record spacing comes from package constants;
- `presentation` column counts are soft density hints, not fixed grids; and
- layout produces React Flow nodes only in memory.

Saved documents do not contain React Flow positions. A future explicit-position or auto-layout
contract requires a versioned schema decision; it must not be added as an undocumented host field.

## 8. Launch And Manifest Contract

Canvas is registered in the standard Slate manifest:

```json
{
  "path": "canvases/example.canvas.json",
  "title": "Example capability map",
  "group": "Architecture",
  "icon": "account_tree",
  "badge": "canvas",
  "type": "canvas",
  "canvas": {
    "open": "new-tab",
    "searchText": "Read-only Canvas of capabilities grouped by area and section."
  }
}
```

The reader:

- includes Canvas entries in navigation and search;
- does not fetch Canvas Documents or load React during reader startup;
- renders a normal link with `target="_blank"` and `rel="noopener"`;
- creates the generated Canvas route from the host-relative document path; and
- excludes Canvas entries from the document previous/next pager.

The fixed route shape is:

```text
shell/canvas/index.html?document=<encoded host-relative .canvas.json path>
```

The Canvas loader rejects missing, absolute, traversal-containing, backslash-containing, or
non-`.canvas.json` document paths.

## 9. Runtime Architecture

```text
Slate reader
  -> canvas manifest link
  -> shell/canvas/ in a new tab
  -> safe document-path validation
  -> Canvas Document fetch
  -> Record Set fetches
  -> structural and semantic validation
  -> deterministic semantic layout
  -> trusted React Flow node adapter
  -> full-viewport read-only Canvas
```

| Layer | Responsibility |
| --- | --- |
| Reader integration | Navigation/search entry and isolated new-tab launch |
| Canvas loader | Safe path resolution, fetch, validation, and failure reporting |
| Domain model | Renderer-neutral records, groups, placements, and deterministic layout |
| React Flow adapter | Translate validated layout nodes into the trusted viewport |
| Renderer registry | Package-owned group and record representations |
| Theme bridge | Resolve Slate theme preference and load host semantic token overrides |
| Details surface | Present full selected record metadata and source links |
| Viewport controls | Pan, zoom, focus, fit, minimap, and full-screen commands |

No runtime layer mutates the source Canvas Document or Record Sets in v1.

## 10. Professional Viewport Controls

Canvas must provide a tool-quality navigation model comparable to professional spatial tools while
remaining focused on read-only exploration.

### 10.1 Pan

- pointer drag on open canvas;
- wheel and trackpad panning;
- touch panning;
- no page scroll competing with the full-viewport canvas; and
- no dependency on a middle mouse button.

### 10.2 Zoom

- wheel and trackpad zoom;
- touch pinch zoom;
- toolbar zoom in and zoom out;
- visible current zoom percentage;
- bounded zoom from overview scale to detail scale;
- actual-size command; and
- reduced-motion-compatible animated transitions.

### 10.3 Focus and fit

- **Fit all:** frames every root group with stable padding.
- **Fit selection:** frames all currently selected nodes and is disabled with no selection.
- **Focus search result:** selects and frames one matching record or group.
- **Focus group:** the navigator selects and frames one top-level group.
- **Actual size:** returns to 100% zoom and a predictable viewport origin.

Keyboard commands are discoverable through button tooltips and labels:

| Command | Shortcut |
| --- | --- |
| Search | `Ctrl/Cmd+K` |
| Fit all | `0` |
| Fit selection | `Shift+2` |
| Zoom in | `+` |
| Zoom out | `-` |

### 10.4 Minimap

The minimap is pannable and zoomable, can be toggled, and uses semantic theme colors. It must not
cover the main control bar or selection details. It may be hidden at narrow widths when insufficient
space remains.

### 10.5 Full screen

The Canvas supports the browser Fullscreen API with explicit enter and exit controls. It remains
fully functional when Fullscreen API permission is unavailable; full-screen is enhancement, not a
load requirement.

## 11. Full-Viewport Interface

The Canvas is unframed and fills the viewport. It contains:

- a compact top toolbar for identity, counts, search, source, theme, and full screen;
- the React Flow viewport with dotted grid;
- a collapsible group navigator;
- a contextual selection-details panel;
- a centered viewport-control bar;
- an optional minimap; and
- an explicit read-only status.

Group names are always visible at useful zoom levels. Group boundaries use subtle semantic tone,
visible labels, counts, and borders rather than decorative cards or color alone. Record nodes use a
stable compact shape designed for scanning IDs and short statements.

At narrow widths, search moves below the toolbar, panels become bounded overlays, controls remain
reachable, and the minimap may hide. The canvas itself continues to pan in two dimensions.

## 12. Theme Contract

- Canvas supports `light`, `dark`, and `auto` with the same `slate-theme-pref` key as the reader.
- The new tab resolves preference independently and never reads opener state.
- Generic Canvas CSS defines complete fallback tokens.
- `slate.config.json.themeStylesheet` may identify a normalized host-relative stylesheet.
- The host theme loads after generic Canvas CSS and may override semantic Slate tokens.
- Canvas node JSON never contains colors or style values.
- The dotted grid remains subdued but visible in both themes.
- Selection, focus, hierarchy, and status are not distinguished by color alone.
- Forced-colors mode uses visible system-compatible borders.
- Reduced-motion mode removes nonessential viewport animation.

## 13. Accessibility

Slate Canvas targets WCAG 2.2 AA within the realities of a spatial view.

- Toolbar and panel controls are native buttons or links with accessible names.
- All viewport commands have keyboard-operable controls.
- The group navigator provides a non-spatial way to find and focus top-level groups.
- Search provides a non-spatial way to find and focus any group or record.
- Selection details expose full record text and metadata without requiring zoom.
- Focus indicators remain visible in light, dark, and forced-colors modes.
- Source links open as normal keyboard-operable links.
- Touch targets remain usable at narrow widths.
- At 200% browser zoom, essential controls remain reachable.
- The Canvas has an accessible label derived from the document title.

React Flow's accessibility support is a foundation, not complete evidence. Host browser review must
exercise Slate's custom nodes, search, navigator, selection details, and controls.

## 14. Security And Privacy

- Input JSON contains no executable code, HTML, CSS, callback, event handler, data URL, or arbitrary
  component reference.
- Canvas and Record Set paths are normalized and same-origin.
- Validation completes before partial rendering.
- Unknown modes, types, variants, or tones fail closed.
- Production output contains no remote runtime dependency.
- The Canvas does not use `eval` or load remote scripts.
- Canvas v1 writes no local drafts, cookies, databases, files, or canonical sources.
- Theme preference is the only Canvas-related browser state and is shared with the reader.
- Telemetry is absent by default.
- External source links use safe supported protocols and `noopener` when opening a new tab.

Initial limits:

| Resource | V1 limit |
| --- | --- |
| Records | 1,000 validated; 250 interactive acceptance target |
| Groups | 250 |
| Placements | 1,000 validated; 250 interactive acceptance target |
| Group depth | 2 group levels before the record leaf |
| Record title | 320 characters |
| Canvas/group title | 160 characters |
| Summary | 2,000 characters |

## 15. Performance And Packaging

The normal reader must make no request for Canvas JavaScript or CSS. Reader support is limited to
manifest metadata and safe links.

The Canvas production build is generated with esbuild and emits static `shell/canvas/` assets. The
runtime host manifest records each output digest. Synchronization rejects modified host outputs,
unmanaged collisions, stale files, and unsafe paths.

A representative 250-placement fixture must remain responsive for:

- initial fit;
- pan and zoom;
- search and focused navigation;
- selection and details;
- fit selection;
- minimap movement;
- theme change; and
- full-screen transition.

Measured timing is environment-specific evidence, not a universal performance claim.

## 16. Generic Host Procedure

Every adopting Slate repository follows the package skill:

1. Identify canonical or generator-owned structured source data.
2. Define grouping from explicit source relationships or reviewed host mapping.
3. Generate one Record Set with each source record represented once.
4. Generate one Canvas Document with named groups and one or more placements per applicable record.
5. Validate generic schemas and semantic invariants.
6. Add host checks for exact coverage, resolvable references, intended repeated placements, and
   generated-file parity.
7. Register a `canvas` manifest entry with `open: "new-tab"`.
8. Build the package Canvas runtime.
9. Synchronize and digest-check the host runtime.
10. Inspect the real Canvas in desktop, narrow, light, dark, keyboard, search, fit, selection,
    minimap, and full-screen flows.
11. Verify ordinary reader pages did not request Canvas assets.

## 17. Current User-Can Adapter

The Microsoft Family current-offering example is a host adapter, not generic Slate behavior.

Its generator:

- reads the existing current-offering `userCapabilities` model;
- emits all 93 `CUR-UC-*` records into one Record Set;
- creates top-level groups from explicit `domain` values;
- creates nested groups from exact `scope` values;
- places every record in its domain/scope group;
- preserves actor, scenario, promise, authority, and source metadata;
- links every node to the generated Current User-Can Catalog; and
- registers the Canvas beside that catalog in the Product host manifest.

This first generated Canvas contains one placement per current record. The generic contract permits
the same record to be placed in multiple page/view groups when a future reviewed Product mapping
explicitly declares those additional relationships.

The grouping is an observed current-offering projection. It does not create future Product
requirements, Design support, Figma layout, app composition, or Actual Product adoption.

## 18. Validation Strategy

### 18.1 Package contracts

- valid Record Set and Canvas Document fixtures;
- duplicate IDs;
- missing groups, sources, and records;
- containment cycles and depth violations;
- unsafe paths;
- unknown mode, variant, and tone;
- repeated record references through distinct placements; and
- deterministic layout node count.

### 18.2 Runtime and portability

- Canvas outputs appear in `.slate-runtime.json`;
- runtime sync copies and checks all Canvas files;
- drift, unmanaged collision, obsolete output, and unsafe path mutations fail;
- copied-package initialization includes the Canvas shell and theme config; and
- hosts without Canvas content remain valid.

### 18.3 Host generation

- generated files match source data;
- source record count and ID set match the Record Set;
- every required record has at least one placement;
- every placement resolves;
- all groups resolve and remain acyclic;
- manifest registration exists and opens a new tab; and
- source-page launch links resolve to generated runtime and data.

### 18.4 Browser behavior

Browser validation covers:

- reader launch opens one new tab and preserves the reader tab;
- Canvas is nonblank and fills the viewport;
- all expected records and top-level groups render;
- every declared perspective appears, switches without a new Record Set request, and preserves its
  exact validated coverage;
- search focuses a result;
- fit all and fit selection change the viewport correctly;
- zoom in/out and actual size work;
- panning works by pointer, wheel/trackpad, and touch where available;
- navigator focuses a group;
- selection details expose full data and source link;
- minimap can pan, zoom, hide, and reappear;
- light, dark, and automatic themes match Slate;
- narrow viewport, 200% zoom, reduced motion, and forced colors remain usable;
- full-screen enter/exit works when permitted; and
- console, page, hydration, and request errors are absent.

Screenshots and canvas-pixel checks verify that the viewport is nonblank and useful at desktop and
narrow widths.

## 19. V1 Acceptance Criteria

V1 is accepted only when:

1. Slate's package skill explains when and how every host creates a Canvas.
2. One fixed project-agnostic React Flow scaffold ships with Slate.
3. Host data uses renderer-neutral Record Set and Canvas Document contracts.
4. A Canvas manifest entry opens a full-viewport new tab with `noopener`.
5. The dotted infinite canvas works in light, dark, and automatic themes.
6. Named nested groups and source-backed record nodes render correctly.
7. Distinct placements may reference the same record.
8. Pan, zoom, zoom percentage, fit all, fit selection, actual size, search focus, group focus,
   minimap, and full screen work.
9. Search, navigator, and details provide non-spatial discovery paths.
10. Invalid or unsafe inputs fail before partial rendering.
11. React Flow types and transient state do not appear in host JSON.
12. Canvas runtime is built, synchronized, content-addressed, and drift checked.
13. Normal Slate reader pages request no Canvas bundle.
14. Generic contract, runtime, portability, and real-host browser checks pass.
15. The current User-Can example includes the complete generated source ID set.
16. No Canvas artifact is presented as Product approval, Design support, Figma design, or app
    adoption.

## 20. Risks And Mitigations

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| React Flow leaks into host contracts | Renderer lock-in | Semantic schemas and a package adapter |
| Canvas slows every Slate page | Reader regression | Separate route and no reader import |
| Hosts fork the React app | Inconsistent behavior | Fixed scaffold, skill instructions, runtime digests |
| Grouping is inferred from wording | False structure | Explicit source relation or reviewed generator mapping |
| Repeated nodes look like duplicate authority | Misinterpretation | One source record, distinct placement IDs, source details |
| Spatial navigation excludes users | Inaccessible information | Search, navigator, details, keyboard controls, source page |
| Large maps become unreadable | Poor comprehension and performance | Limits, search, focus, minimap, future clustering |
| Canvas appears to define UI layout | False design precision | Semantic group language and explicit non-Design status |
| Host styles break Canvas | Inconsistent rendering | Semantic token-only overrides and generic fallback theme |
| Editing is added casually | Authority and conflict risk | V1 schema enforces `readonly`; separate future program |

## 21. Deferred Editing Program

Editable Canvas is not a minor v1 follow-up. Before implementation, Slate must specify and prove:

- semantic edit commands and bounded undo/redo;
- add, remove, move, resize, reparent, and relationship rules;
- a complete keyboard-equivalent structural editor;
- draft identity and source-revision binding;
- persistence privacy policy;
- concurrent source change and conflict handling;
- deterministic import/export;
- authority-specific write-back adapters;
- review, approval, and audit records;
- repository generation and validation integration; and
- failure recovery without silent data loss.

No host may claim editable support or canonical write-back until this separate contract is ratified
and implemented in the generic Slate package.

## 22. Remaining Delivery Work

1. Keep package schemas, domain tests, fixed scaffold, build, skill, and templates synchronized.
2. Finish Product host runtime synchronization and generator validation.
3. Add generic browser automation for the fixed Canvas fixture.
4. Run real-host desktop and narrow light/dark inspection with pixel checks.
5. Verify reader network isolation from Canvas assets.
6. Record measured performance for a bounded large fixture.
7. Complete keyboard, zoom, reduced-motion, and forced-colors review.
8. Publish package dependency notices and rollback guidance.
9. Treat any renderer or schema extension as a reusable package change before host adoption.
