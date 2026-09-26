# Slate Canvas

Slate Canvas is the package-owned, project-agnostic React Flow application for read-only spatial
exploration of structured documentation records.

Hosts do not copy or customize this application. They publish validated Canvas Documents and Record
Sets, register a `canvas` manifest entry, build the package runtime, and synchronize `shell/canvas/`
through Slate's runtime-host tool.

## Package boundary

```text
Host structured authority
  -> host generator
  -> Canvas Record Set + Canvas Document
  -> Slate validation and semantic layout
  -> fixed React Flow adapter and renderers
  -> full-viewport read-only Canvas
```

The saved contract is independent of React Flow. React Flow node objects, component names,
coordinates, callbacks, selection, viewport, and transient state do not appear in host JSON.

## Source layout

```text
canvas/
  index.html          fixed standalone shell source
  README.md           this package contract
  src/
    App.jsx           loader, theme bridge, controls, and trusted renderers
    canvas.css        generic Canvas visual system
    domain.mjs        validation, record resolution, and deterministic layout
    main.jsx          React entry point
```

`npm run build:canvas` emits package-generated files under `shell/canvas/`. Those outputs are part
of Slate runtime synchronization and digest validation. Never edit a host copy.

## Host inputs

- **Record Set:** stable source records, plain-text display fields, metadata, and source links.
- **Canvas Document:** one or more named perspectives, each with nested groups and placements that
  reference the same Record Sets.
- **Manifest entry:** navigation/search metadata and `type: "canvas"`.
- **Theme config:** optional `themeStylesheet` path loaded after generic Canvas CSS.

Start from [`../templates/canvas-record-set.json`](../templates/canvas-record-set.json) and
[`../templates/canvas-document.json`](../templates/canvas-document.json). Generators should emit
deterministic formatted JSON with a trailing newline.

One record can be placed more than once. Each repeated placement receives a unique placement ID and
references the same source record ID.

When readers need different ways to understand one source set, declare named perspectives such as
`Product IA`, `Domain & scope`, `Customer promise`, or `Task flow`. The fixed toolbar renders a
responsive Slate-themed listbox with pointer, touch, arrow-key, Home/End, typeahead, Enter/Space,
Escape, selected-state, and focus-return behavior in light and dark modes. Switching perspectives rebuilds semantic layout locally; it does not
refetch, clone, or mutate source records.

## Runtime URL

The Slate reader creates this URL; hosts should not hard-code bundle filenames:

```text
shell/canvas/index.html?document=<encoded host-relative .canvas.json path>
```

The route validates the path, Canvas Document, Record Sets, group hierarchy, and references before
rendering. Inputs fail closed with an actionable error page.

## V1 controls

- pan with pointer, wheel, trackpad, or touch;
- zoom in/out, pinch zoom, current zoom, and actual size;
- fit the complete canvas or current selection;
- searchable record/group focus;
- named perspective switching;
- group navigator and selection details;
- pannable and zoomable minimap;
- full-screen mode; and
- Slate light, dark, and automatic theme behavior.

Canvas v1 is read-only. Editing and persistence remain deferred until the package defines a
separate authority-aware command, validation, conflict, and write-back contract.

## Required checks

```powershell
npm run test:canvas-contracts --prefix .\slate
npm run build:canvas --prefix .\slate
npm run test:runtime-host --prefix .\slate
npm run test:portability --prefix .\slate
npm run slate:runtime:sync
npm run slate:runtime:check
```

Every adopting host also validates exact source coverage and inspects the actual rendered Canvas in
light, dark, desktop, and narrow viewports.