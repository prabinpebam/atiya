# Production and Embedding

SVG support varies by destination. Pick a profile before using CSS, filters, masks, markers, animation, fonts, or
external resources.

## Core SVG Contract

Every SVG should have:

- the SVG namespace;
- a `viewBox` defining its logical coordinate system;
- intentional `preserveAspectRatio` behavior;
- content within the viewBox including stroke/filter extents;
- scoped, unique IDs;
- an accessibility mode: informative, complex, decorative, or externally labeled;
- no external dependency unless the delivery contract explicitly permits it.

### Responsive sizing

Use `viewBox="minX minY width height"` as the source of aspect ratio and internal coordinates.

- `xMidYMid meet`: preserve ratio and show the entire illustration; default for diagrams and figures.
- `xMidYMid slice`: preserve ratio and fill the viewport by cropping; use only for art-directed backgrounds.
- `none`: stretch non-uniformly; avoid for subjects, diagrams, icons, and most illustrations.

For responsive web use, omit fixed `width`/`height` when the container controls size, or provide intrinsic dimensions
plus CSS `width: 100%; height: auto`. For print or Office, explicit dimensions may improve predictability.

## Production Profiles

### `slate-inline`

For static SVG authored inline in sanitized Slate pages and slides:

- use presentation attributes (`fill`, `stroke`, `font-size`) rather than embedded `<style>`;
- no `<script>`, event attributes, `foreignObject`, external images, external fonts, or remote references;
- avoid filters, masks, and renderer-sensitive blend modes;
- simple gradients, clip paths, symbols, and markers only after confirming the sanitizer preserves them;
- prefer explicit polygon arrowheads if marker support is uncertain;
- keep all visible text in native `<text>` elements;
- provide nearby prose/table alternatives for complex visuals.

### `slate-asset`

For self-contained static SVG files embedded through `<img>` in Slate:

- no embedded `<style>`, scripts, event attributes, SMIL, `foreignObject`, external fonts/images, or remote references;
- publish a complete static state; Slate does not treat an `<img>` asset as a presentation-motion subject;
- internal SVG semantics are not the host accessible name, so provide meaningful host `alt` text;
- external SVG cannot inherit Slate CSS variables or `currentColor`; publish explicit light/dark variants when needed.

### `slate-motion-subject`

- obey every `slate-inline` restriction;
- assign stable, scoped IDs to semantic subjects targeted by the Slate motion manifest;
- keep static geometry and host-animated transforms in nested groups;
- use `currentColor` and presentation attributes; do not require page-local CSS;
- do not embed animation or interaction. Slate's WAAPI presentation runtime owns timing,
  interruption, navigation, direct jumps, and reduced/off modes.

### `slate-viewport-motion`

For inline article figures that animate when they enter the viewport and expose manual replay:

- obey every `slate-inline` restriction;
- add `data-slate-svg-motion="viewport"` to the `<svg>` root;
- assign stable, scoped IDs and `data-slate-svg-step="<ordinal>"` to semantic motion subjects;
- choose `data-slate-svg-effect="fade-rise|fade|scale-in|draw"` per subject; the default is
    `fade-rise`;
- keep static geometry and animated channels in nested groups when a subject already has a
    transform;
- do not embed animation or interaction. Slate's trusted WAAPI runtime owns the 30% viewport
    trigger, finite choreography, final hold, replay control, and reduced-motion behavior;
- use host semantic variables in presentation attributes and inspect light, dark, and applicable
    project color themes in the real Slate host.

### `standalone`

- include everything required to render offline;
- internal `<style>` and definitions are acceptable;
- embed raster images as data URLs only when size and licensing allow;
- avoid remote fonts and resources unless explicitly requested;
- test opening directly in at least one browser and in the intended consumer.

### `office`

Optimize for broad import compatibility:

- use inline presentation attributes rather than complex CSS;
- prefer `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, and moderate `path` data;
- use polygons instead of marker arrowheads when portability matters;
- avoid `foreignObject`, filters, masks, blend modes, scripts, SMIL, and nested external SVG;
- use simple linear/radial gradients sparingly;
- keep labels as `<text>` for editability and provide an outlined-text variant only when exact appearance is required;
- use common font fallbacks and verify import into the actual Office application.

### `print`

- set explicit physical size when required (`mm`, `in`, or points in the consuming workflow);
- verify font embedding/substitution and CMYK conversion in the downstream PDF/print pipeline;
- avoid effects that rasterize unexpectedly;
- inspect hairlines and small reversed text at print size;
- provide outlined and editable variants when the production workflow requires both.

### `icon`

- use a standard viewBox and no embedded text;
- align to target pixel sizes and use optical correction;
- prefer simple strokes/fills and minimal definitions;
- test at all final sizes, including high-contrast and disabled states if applicable;
- expose color through `currentColor` when the icon is a UI glyph.

## IDs, Definitions, and Reuse

Inline SVG IDs share the HTML document namespace. Prefix all reusable IDs:

```xml
<linearGradient id="slate-example__accent-gradient">...</linearGradient>
<path fill="url(#slate-example__accent-gradient)" ... />
```

Keep IDs stable and semantic until final optimization. Check all `url(#id)` and `href="#id"` references after
editing. Reuse geometry with `<symbol>` and `<use>` for repeated icons and marks, but test Office/sanitizer support.

## Text and Fonts

- Use system or project-approved font stacks unless embedding is explicitly allowed.
- SVG has no native paragraph layout. Author line breaks with `<tspan>`.
- Do not use `foreignObject` merely to gain HTML wrapping; it compromises portability.
- Do not assume font metrics are identical across systems. Leave horizontal and vertical safety space.
- Use `textLength` only for controlled adjustment, not to crush long labels into fixed boxes.
- Keep critical labels editable. Outlined text is a portability fallback, not the default.

## Images

Prefer vector construction when appropriate. When raster imagery is necessary:

- use local files or embedded data URLs according to the profile;
- declare dimensions and `preserveAspectRatio`;
- provide licensing/source metadata outside the SVG;
- do not hotlink remote images;
- verify that the asset survives export and offline viewing.

## Clipping, Masks, and Filters

Use effects only when they add explanatory value and the profile supports them.

For clipped containers, use three layers:

1. background shape;
2. clipped content;
3. border drawn last.

Expand filter regions to prevent cropped blur or shadow. When portability matters, replace filters with explicit
offset shapes, flat plane values, hatching, or line work.

## Animation

Static clarity comes first. Animation should reveal sequence, state, direction, causality, or attention.

For Slate, keep SVG markup structurally static. Use `slate-viewport-motion` for scrolling article
figures and `slate-motion-subject` plus a motion manifest for decks. Use CSS or SMIL only in non-Slate
standalone exports when the target explicitly permits them. Never animate Slate SVG, Office, or print
output internally.

Rules:

- separate static position and animated transform into nested groups;
- use restrained durations and easing; avoid constant motion without purpose;
- provide a meaningful static first frame;
- stop or simplify animation under `prefers-reduced-motion: reduce`;
- avoid flashing and large parallax movement;
- interactive animation requires keyboard-equivalent controls and a pause mechanism when it continues automatically.

## Deterministic Generation

For repeated, procedural, or data-driven SVG:

- fix and record the random seed;
- sort input entities and output attributes consistently;
- derive stable IDs from semantic names, not iteration timing;
- separate data, layout calculation, and rendering;
- round numbers only after layout;
- save the source data/config beside the generated SVG when reproducibility matters.

## Optimization

Optimize only after visual approval.

Safe wins:

- remove editor metadata and unused namespaces;
- remove hidden leftovers and unused definitions;
- reduce excessive decimal precision;
- reuse repeated geometry;
- simplify auto-traced paths while preserving silhouette;
- remove empty groups and comments that have no maintenance value.

Preserve:

- `viewBox` and intentional dimensions;
- `<title>`, `<desc>`, roles, and referenced IDs;
- editability and semantic grouping when part of the deliverable;
- required whitespace in text content;
- path geometry needed for morphing or exact alignment.

SVGO is useful, but review its configuration. Never enable transformations blindly on an editable master.

## Export

Keep the SVG as the source of truth. Produce exports from that source:

- PNG at the exact required dimensions and at 2x when a high-density raster is useful;
- PDF through a browser or vector-aware renderer, followed by font/effect inspection;
- presentation import by testing the SVG directly in the target application;
- optimized delivery SVG as a derivative, not the only editable copy.

## Embedding Patterns

### Inline in Slate HTML

Best for theming, accessibility, and Slate motion subjects. Use sanitizer-safe markup and scoped IDs.

### `<img src="...svg" alt="...">`

Best for isolation and caching. Put the accessible text in `alt`; do not rely on internal SVG semantics being
announced. The file is isolated from host styles and motion state; provide explicit theme variants and keep it static.

### `<object data="...svg">`

Allows internal interaction but complicates accessibility, styling, and security. Use only when required.

### CSS background

Use for decorative visuals only. Information-bearing SVG must have an accessible equivalent in content.

## Compatibility Test Matrix

At minimum, test the actual target. For reusable assets, consider:

- Chromium and Firefox for web;
- light and dark contexts;
- narrow and wide containers;
- sanitizer output for documentation systems;
- PowerPoint or Word for Office assets;
- PDF/print preview for print assets;
- direct-file opening for standalone assets.

Markup validation cannot substitute for these rendering checks.