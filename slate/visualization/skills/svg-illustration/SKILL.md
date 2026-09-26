---
name: slate-svg-illustration
title: SVG Illustration (Slate)
description: "Slate's native pipeline for routing, briefing, authoring, validating, embedding, and reviewing custom SVG illustrations, explanatory diagrams, editorial scenes, icons, maps, patterns, and vector data stories. Use when exact art direction and semantic vector structure matter more than automatic chart or graph layout."
version: 0.3.0
---

# SVG Illustration (Slate)

Create factual, accessible, theme-aware SVGs that explain or depict through spatial structure. This is
Slate's native custom-vector pipeline. It applies to normal documentation pages and presentation decks,
but it does not make SVG the answer to every visual need.

The geometry, hierarchy, reading path, and silhouette must express the subject. Do not translate nouns
into equal boxes or use generic abstract decoration as a substitute for explanation.

## Slate ownership and boundaries

Slate owns this generic skill bundle, its profiles, starter assets, validators, and authoring guidance.
A host repository owns subject truth, source data, branding, rights, and the final assets it publishes.

Slate authored pages remain sanitized body fragments:

- no page-local `<script>`, `<style>`, event handler, external runtime, or `foreignObject`;
- no remote resource inside an SVG;
- no page-specific CSS added to work around an illustration;
- static meaning must be complete before any presentation motion is applied.

For presenter-controlled animation, use the
[Slate Presentation Motion skill](../../../presentation/motion/SKILL.md). The SVG supplies stable
semantic subjects; the Slate motion manifest supplies timing and presenter state. Do not add a second
CSS, SMIL, GSAP, or script timeline inside the SVG.

## Non-negotiable principles

1. **Choose the medium before drawing.** SVG is one route, not the default route.
2. **State one visual thesis.** Write the single idea the visual must make obvious at a glance.
3. **Make structure resemble meaning.** Use convergence for aggregation, branching for alternatives,
   enclosure for containment, sequence for time, proximity for affinity, and scale for importance.
4. **Design silhouette and composition before detail.** Recognition and eye flow beat decoration.
5. **Use concrete evidence.** Real labels, values, states, examples, and artifacts beat generic boxes.
6. **Encode meaning redundantly.** Pair color with shape, position, line style, pattern, icon, or label.
7. **Target the real Slate embedding profile.** Sanitized inline content, external assets, motion
   subjects, Office, print, and icons have different contracts.
8. **Render and inspect.** Valid XML is not visual evidence. Never deliver an unrendered SVG.
9. **Animate every authored Slate content illustration.** Scrolling-page SVGs start through Slate's
  viewport runtime and expose hover/focus replay; deck SVGs use presentation motion and the same
  per-visual replay affordance. Reduced/off modes show the complete final state immediately.
10. **Protect text as a first-class shape.** Every label needs an intentional text zone. Text inside a
  container stays inside its painted boundary with visible padding on every edge; text outside a
  shape must not sit on its stroke, connector, arrow, axis, or neighboring mark.
11. **Use explicit collision geometry.** Model every subject with a painted body box, every label with
   a rendered text box, and both with an inflated collision envelope. Any intersection that is not
   declared semantic containment or deliberate occlusion is a defect.
12. **Reuse established iconography.** For familiar icon-like symbols inside a larger illustration,
   use one approved source - Fluent Icons, Font Awesome, or Google Material Symbols - and use that
   source exclusively within the SVG. Do not redraw a familiar icon or mix icon libraries.
13. **Measure contrast against the immediate surface.** Text and essential foregrounds must pass in
   every supported theme and state; a token name or visually plausible color is not evidence.
14. **Keep the canvas open and comfortably framed.** Never draw a decorative border around the SVG
   viewBox. Keep all painted content inside a balanced safe area with enough whitespace to remain
   comfortable at the smallest supported render.

## Mandatory geometry, icon, contrast, and frame contract

Apply this contract before selecting detailed geometry. It is a required authoring and review input,
not a final cleanup pass.

### Three-box collision model

For every subject and label, reason about three explicit regions:

1. **Body box:** the actual painted geometry, including half the stroke width.
2. **Content box:** the rendered `getBBox()` of text or the painted bounds of an icon.
3. **Collision envelope:** the body or content box inflated by its required clearance.

Contained text is the one normal overlap: its collision envelope must remain wholly inside the
target body's inner boundary after subtracting padding and stroke. All other label-to-label,
label-to-shape, label-to-icon, and label-to-line envelope intersections fail. Connector and axis
paths are geometry, even when painted behind text; DOM paint order does not excuse a collision.
Record every intentional non-containment overlap before rendering with a rationale. Never derive an
allowlist from defects found after the fact.

### Contained text and padding

- Every contained label must name its visible body with `data-slate-fit-target` and record a numeric
  `data-slate-fit-padding`.
- Start with padding of at least `1.5u` and increase it for heavy strokes, curved containers, large
  type, or fallback-font uncertainty. The measured padding must remain visible on all four sides at
  the smallest supported render.
- Measure the union of all `<tspan>` line boxes after fonts load. Center the complete block, not each
  line independently.
- For circles, ellipses, polygons, and paths, test the inflated text box against the actual inner
  boundary. A rectangular target bounding box is not sufficient.
- If text fails, fix it in this order: shorten, wrap, enlarge or reshape the container, change the
  composition, then reduce type only while it remains legible. Never hide overflow with
  `textLength`, clipping, paint order, or a smaller font.

### Icon sourcing and consistency

- Treat a familiar UI glyph, status mark, product symbol, or common pictogram as sourced iconography,
  not bespoke illustration geometry.
- Run a **semantic icon pass** before drawing detail: list every named product, capability, state,
  action, device, person/group, benefit, or content type represented by a node; decide whether a
  familiar icon improves recognition; then resolve the exact icon before authoring the node.
- Choose exactly one source per SVG: **Fluent Icons**, **Font Awesome**, or **Google Material
  Symbols**. Prefer Fluent Icons for Microsoft and Windows subjects.
- Within one source, use one coherent family and variant unless brand identity requires an official
  product icon. For example, use Fluent System Regular icons for a conceptual diagram; do not mix
  regular, filled, color product logos, and unrelated glyph styles for decoration.
- Select by meaning, not silhouette. Use a product icon only for the actual product; use a system
  icon for concepts such as benefits, cloud storage, gaming, safety, learning, devices, or people.
- Copy the official vector geometry from the selected source. Do not visually trace it, approximate
  it from memory, or combine paths from multiple libraries.
- Do not use a generic dot, circle, sparkle, initial, or hand-drawn mini-symbol as a placeholder when
  the chosen library contains a clear icon for the represented concept. If no suitable icon exists,
  omit the icon or redesign the node; do not invent a familiar-looking glyph.
- Record provenance on the semantic icon group, for example
  `data-slate-icon-source="fluent" data-slate-icon-name="checkmark-regular-24"`, and record the
  source path/version and license in the visual brief or adjacent source comment.
- Normalize size, optical alignment, and color through the larger illustration's semantic roles,
  but do not distort the source icon's aspect ratio or redraw its silhouette.
- Give every icon a reserved icon box that does not overlap its label box, container padding, node
  stroke, or connector envelope. Essential icons must pass `3:1` contrast against their immediate
  surface. The same concept keeps the same icon name in desktop and mobile layouts.
- Bespoke people, objects, scenes, mechanisms, and subject-specific symbols remain custom
  illustration. This rule applies when the element functions as an icon.

### Contrast proof

- Normal text must measure at least `4.5:1`; qualifying large text and essential graphical objects
  must measure at least `3:1` against the immediate painted background.
- Test computed foreground/background pairs in light, dark, and every applicable project theme.
  Include opacity, overlays, gradients, and motion states in the calculation.
- Use the designated on-surface semantic role for each filled body. Never assume a neutral text token
  is readable on a tinted or brand surface.
- Pair color with label, shape, position, line style, pattern, or sourced icon so meaning survives
  grayscale and color-vision differences.

### Open frame and comfortable safe area

- Do not add a `rect`, `path`, or other stroke that traces the viewBox or safe-area perimeter. The
  SVG canvas has no decorative border. Internal enclosures are allowed only when they encode real
  containment and remain visibly separate from the canvas edge.
- Define the outer safe margin as `m = max(24, 3u, 0.04 * min(W, H))`, increasing it for wide
  strokes, arrowheads, shadows, external labels, or dense motion.
- The union of all painted geometry and rendered text, including stroke and effects, must fit inside
  `[x + m, x + W - m] x [y + m, y + H - m]` for viewBox `x y W H`.
- Keep outer whitespace optically balanced. A technically valid margin on one edge does not excuse a
  cramped edge or a large accidental void on another.
- Verify the safe area in the smallest real host container and in the complete static and motion
  states. Never crop the viewBox to the content bounds merely to make the figure appear larger.

### Responsive layout and legibility

- Every article SVG scales to its container width by default. Do not force a fixed pixel width or
  horizontal scrolling merely to preserve a desktop composition.
- Before accepting scale-to-fit, calculate and inspect the smallest rendered label size. Normal
  labels must remain at least `14px`; short secondary annotations may reach `12px`. Passing geometry
  with smaller text is not a responsive success.
- When scale-to-fit falls below that floor or creates crowded reading order, author one alternate
  semantic layout inside the same SVG. Set `data-slate-mobile-view-box` and
  `data-slate-mobile-safe-margin` on the root, and wrap the two compositions in
  `data-slate-layout-group="desktop"` and `data-slate-layout-group="mobile"` groups. Slate owns the
  breakpoint, active viewBox, replay, and cleanup.
- The mobile layout may change direction, grouping, or aspect ratio, but it must preserve the same
  facts, accessible name, icon identities, source order, and relationship semantics. It is a reflow,
  not a second interpretation.
- Use a long vertical mobile figure when that preserves readable labels and clear connectors. Do not
  squeeze a wide network, radial system, or spectrum into a short landscape thumbnail.

## Route the request

Read [visual routing](references/visual-routing.md) before choosing a format. If the source contains
quantities, trends, distributions, uncertainty, flows, networks, or multidimensional analysis, also
read [data visualization](references/data-visualization.md).

Use this skill when custom static vector composition and art direction are the hard parts:

- explanatory or editorial illustrations;
- architecture, process, lifecycle, spatial, relationship, and system diagrams that need deliberate
  composition rather than formal auto-layout;
- annotated scenes, maps, cutaways, comparisons, and conceptual models;
- people, objects, environments, symbols, patterns, and deterministic generative vector work;
- bespoke slide mechanisms whose geometry is part of the argument.

Prefer another Slate visualization route when its engine solves the hard part better:

- **[chart](../chart/SKILL.md):** quantitative encoding, scales, distributions, flows, hierarchies,
  or any figure whose point is a measured value;
- **HTML and Slate components:** responsive text-heavy UI, tables, dashboards, or document structure;
- **bitmap imagery:** photorealism, painterly texture, or complex natural detail;
- **Canvas/WebGL/Three.js:** simulation, 3D, particles, or thousands of changing marks;
- **Mermaid/Graphviz/PlantUML:** formal notation and reproducible auto-layout matter more than art direction.

## Slate production profiles

Choose one profile before markup. Read [production and embedding](references/production-and-embedding.md)
for detailed constraints.

| Profile | Use | Contract |
| --- | --- | --- |
| `slate-inline` | Static fallback, export source, or unsupported-host SVG | Presentation attributes only; no style, script, animation, external assets, filters, masks, or `foreignObject`; not the final profile for an authored live Slate illustration |
| `slate-asset` | Static local SVG through `<img>` | Self-contained; no script, style animation, external resource, SMIL, or `foreignObject`; host `alt` is authoritative |
| `slate-viewport-motion` | Inline article figure that animates on viewport entry | Safe static markup with semantic step/effect metadata; trusted Slate runtime owns entry, replay, reduced motion, and final hold |
| `slate-motion-subject` | Inline SVG animated by Slate presentation motion | Same safe markup as `slate-inline`, plus stable scoped IDs on motion subjects; no internal animation clock |
| `standalone` | Direct-file or exported self-contained SVG | Embedded static style allowed when portable; no script or external resource |
| `office` | PowerPoint/Word import | Simple editable geometry/text; avoid markers, filters, masks, CSS, and animation |
| `print` | PDF/print source | Vector-safe effects, explicit dimensions when needed, verified fonts |
| `icon` | UI glyph or symbol | Pixel-grid-aware viewBox, no text, minimal paths, `currentColor` when appropriate |

### Theme behavior

- For `slate-inline`, `slate-viewport-motion`, and `slate-motion-subject`, use host semantic CSS
  variables in presentation attributes. The containing Slate figure resolves light, dark, and
  project color themes without changing geometry or choreography.
- Multi-color inline work must use documented Slate/host semantic values converted to safe
  presentation attributes; never scatter arbitrary literals or depend on an embedded style block.
- Text and essential symbols use the semantic on-surface role of the shape beneath them. Brand surfaces use
  `--color-on-brand`; status surfaces use the matching status foreground for secondary text. Never put muted
  neutral text on a tinted surface without measured 4.5:1 contrast.
- A `slate-asset` loaded through `<img>` cannot inherit host CSS variables. Publish explicit light and
  dark variants when one fixed palette cannot serve both.
- For standalone, Office, print, or export families, use the
  [theme contract](references/theme-contract.md) and validate the theme JSON.

## Required workflow

### Fast path for one generated host SVG

Keep a one-illustration change local until evidence requires expansion. The default loop is four
actions, not a repository-wide validation program:

1. Edit the owning generator or source SVG once, including its visual brief and machine-readable
  fit, margin, connector, and icon metadata.
2. Generate and drift-check only the owning page, for example:
  `npm run generate:docs-illustrations -- --path 2027/overview.html` then
  `npm run validate:docs-illustrations -- --path 2027/overview.html`.
3. Run one batched browser check for that page covering the smallest supported width and one normal
  width, light and dark themes, final motion state, text-fit targets, collisions, contrast, safe
  margin, and page overflow. Capture one screenshot per materially different layout, not one per
  assertion.
4. Stop when those checks pass. Run the focused SVG package test only when shared skill, validator,
  generator, component, or runtime behavior changed. Expand to the full Slate or Product suite only
  when a shared contract changed or the focused check exposes broader drift.

Do not regenerate every governed illustration, reopen the same page repeatedly, or run unrelated
repository gates for a one-page SVG correction. Do not substitute structural validation for the one
real rendered check.

### 1. Model the truth

- Inventory entities, relationships, sequence, hierarchy, quantities, states, and uncertainty.
- Separate sourced facts from visual interpretation. Never invent values or causal links for beauty.
- Inspect the actual code, schema, protocol, source document, or data before illustrating it.
- Decide what should be understood after 3 seconds, 30 seconds, and close inspection.

### 2. Write the visual brief

Record this beside the source SVG, in a host artifact, or as an adjacent source comment:

```text
Audience:
Visual thesis:
Content that must be visible:
Reading order:
Visual form or metaphor:
Slate production profile and final display size:
Theme modes and host tokens:
Motion purpose and Slate fragment states (or static):
Accessibility mode: informative | complex | decorative
Source/provenance:
```

### 3. Choose a composition

Read [composition and layout](references/composition-and-layout.md).

- Pick one dominant structure: path, field, layers, radial system, comparison, hierarchy, scene, or
  focal object.
- Establish major zones and connectors before detail.
- Build hierarchy with position and scale first, then type and color.
- Reserve margins and label space. Avoid uniform card grids unless equal comparison is the meaning.
- Allocate text zones before drawing connectors or decorative geometry. A container is not large
  enough merely because its label technically fits: leave a deliberate interior padding band that
  remains visible after fallback-font substitution and at the smallest rendered size.
- For dense material, design overview, grouped regions, then evidence detail.
- For measured data, declare scale, domain, ordering, units, transformation, and uncertainty first.

### 4. Choose a visual language

- Use host/Slate semantic roles, not a free palette of literals.
- Define type roles, spacing, stroke family, corner language, icon style, and depth model.
- Use one dominant motif and at most two supporting motifs.
- Keep decoration subordinate to explanation.
- For real subjects, follow [illustration techniques](references/illustration-techniques.md):
  silhouette, proportions, construction, perspective, overlap, lighting, then detail.

### 5. Construct semantic SVG layers

Use readable, scoped IDs and group by meaning, not element type:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"
     role="img" aria-labelledby="example-title example-desc"
     preserveAspectRatio="xMidYMid meet">
  <title id="example-title">Short identifying title</title>
  <desc id="example-desc">Essential takeaway and reading order.</desc>
  <defs><!-- only definitions allowed by the profile --></defs>
  <g id="example-background">...</g>
  <g id="example-primary-subject">...</g>
  <g id="example-relationships">...</g>
  <g id="example-annotations">...</g>
</svg>
```

Rules:

- Always include a `viewBox`; use `xMidYMid meet` for complete figures.
- Prefix IDs with an illustration-specific slug because multiple inline SVGs share one document.
- For `slate-motion-subject`, assign stable IDs to semantic subjects, not every primitive.
- Use nested groups to separate static geometry from host-animated transforms.
- Prefer native geometry and `<text>/<tspan>`; wrap labels deliberately.
- Draw connectors behind nodes and labels and route them around subjects.
- Never rely on paint order alone to make a line crossing under text acceptable. Opaque text
  backplates can hide a crossing, but the preferred fix is to route the connector around the label
  zone or move the label. A backplate is valid only when the line relationship remains unambiguous
  and the plate is visibly part of the design.
- Use deterministic generators with fixed inputs/seeds for procedural geometry.
- Keep the editable SVG or readable generator as source; optimize only a delivery derivative.
- Give every bounded label an explicit `data-slate-fit-target` and `data-slate-fit-padding` budget.
  Treat the padding value as a minimum on all four rendered edges, not a nominal authoring hint. Give every substantive connector
  explicit source/target body IDs and boundary/port semantics.
- Separate transform, connector, and label anchors; align repeated peers from formulas rather than hand nudges.
- Reject unclassified overlap, near-tangency, connector intrusion, and label overflow before visual approval.

### Mandatory text-placement pass

Run this pass after the static composition is complete and again after every geometry or copy change.
Start from the frame, not the individual label:

0. **Frame the canvas first.** Apply the [Frame and Safe Area](references/composition-and-layout.md#frame-and-safe-area)
  contract before placing text: set the safe margin, reserve non-overlapping header, plot, and footer
  bands, and a value-label column. The chart's maximum scale line and every data mark must sit below
  the header band and above the footer band; no text or mark may cross the safe margin. Reserved bands
  are what stop a title, subtitle, gridline, or value label from colliding.
1. **Classify each text element:** contained label, external annotation, axis/legend label, or
  relationship label.
2. **Contained labels:** identify the painted container with `data-slate-fit-target`; measure the
  rendered text `getBBox()` against the target geometry after subtracting
  `data-slate-fit-padding` from every edge. Multi-line labels use the union of all line boxes.
  For circles, ellipses, polygons, and curved paths, test against the actual painted boundary at
  the label's position; a rectangular `getBoundingClientRect()` containment check is insufficient.
3. **External labels:** reserve a label zone and measure a visible gap from the nearest shape edge.
  Do not place text directly on a shape outline or in the ambiguous gap between two marks.
4. **Label separation:** compare every label box with nearby label boxes. Labels must not overlap,
  share line boxes, or read as one accidental phrase; preserve a visible inter-label gap that
  survives fallback fonts and the smallest render.
5. **Line exclusion:** test every label box, inflated by at least half the intended padding, against
  connector paths, arrows, axes, leaders, and decorative lines. Any intersection is a defect unless
  an intentional backplate and rationale are recorded.
6. **Smallest render:** inspect the real SVG at the narrowest supported Slate figure/slide size in
  light and dark themes. Confirm fallback fonts, motion final state, and constrained scrolling do
  not move labels onto edges or lines.
7. **Fix the controlling cause:** enlarge or reshape the container, wrap/shorten/move the label, or
  reroute the line. Do not solve crowding by shrinking text below the surrounding reading scale.
8. **Run the rendered frame verification.** Render the real SVG and assert with `getBBox()`, in each
  theme and at the smallest host width, that every text and mark box is inside the safe rectangle,
  no two text boxes overlap, every header/subtitle/legend box stays clear of plot gridlines and data
  paths, and every contained label fits its target. Any violation fails the figure; fix the
  controlling zone rather than nudging one element.

### 6. Plan Slate motion

Finish the complete static state first, then add the required Slate motion layer. Read
[Slate Presentation Motion](../../../presentation/motion/SKILL.md) and
[motion and animation](references/motion-and-animation.md).

- State what motion proves: sequence, causality, state, direction, hierarchy, or attention. When the
  subject has no temporal claim, use a restrained grouped entrance rather than decorative looping.
- Use two to four semantic moves and stable subject IDs.
- For a scrolling article figure, use `slate-viewport-motion`: add
  `data-slate-svg-motion="viewport"` to the root and stable `data-slate-svg-step` subjects. Choose
  `fade-rise`, `fade`, `scale-in`, or `draw` per subject. Slate starts once at 30% visibility and
  supplies an icon-only replay control on hover, keyboard focus, and touch.
- For a deck, use `slate-motion-subject` and map meaningful proof states to Slate fragments; do not
  fragment every primitive.
- Keep the SVG free of embedded keyframes, SMIL, handlers, and scripts.
- The applicable Slate WAAPI runtime owns timing, interruption, replay/navigation, reduced/off
  modes, and final holds.

### 7. Embed through Slate

Use the canonical figure contract described in [`../../README.md`](../../README.md).

- Inline SVG: place safe markup in `.slate-figure`, `.slate-slide__figure`, or
  `.slate-card__figure` according to the content surface.
- External SVG: save under the host content `assets/` tree and embed through `<img>` with meaningful
  `alt`; internal `<title>/<desc>` is not the host accessible name.
- Complex informative figures need a caption and adjacent structured description or data table.
- Decorative SVGs use `aria-hidden="true"`; do not give them a competing accessible name.
- Do not add a new figure merely to satisfy a per-slide quota. A deliberate text-only slide is valid
  when visual structure would add noise rather than meaning.

### 8. Validate structure

From a repository containing Slate:

```powershell
python .\slate\visualization\skills\svg-illustration\scripts\validate_svg.py `
  path\to\illustration.svg --profile slate-inline --accessibility complex

python .\slate\visualization\skills\svg-illustration\scripts\validate_theme.py `
  path\to\theme.json
```

The validator catches malformed XML, duplicate IDs, dangling references, unsafe resources, missing
accessible names, internal animation, and profile violations. It is a baseline, not visual proof.

### 9. Render, inspect, and revise

This step is mandatory.

1. Render in the real Slate page/deck over loopback when possible.
2. Capture a preview at the intended dimensions.
3. Test the smallest expected display and one large display.
4. Test light and dark; add print/high-contrast when applicable.
5. For viewport motion, inspect pre-entry, entry, final hold, hover/focus replay, touch, and reduced
  motion. For presentation motion, inspect every proof fragment, Previous, direct jump, reduced
  motion, and motion off.
6. Revise and repeat, up to three focused correction rounds before reconsidering the composition.

Inspect for hierarchy, clipping, tiny labels, overlap, tangencies, crossing connectors, meaningless
voids, weak silhouettes, impossible depth, contrast, color-only encoding, and renderer differences.
Measure bounded text against its padded target, verify anchor alignment numerically, and inspect connector
endpoints at high zoom for exact boundary contact.

For every review screenshot, zoom in far enough to answer two explicit questions: **Is every label
contained with breathing room?** and **Does any line, edge, arrow, or connector pass through or
immediately behind text?** A visually plausible full-page thumbnail is not sufficient evidence.
Read [accessibility and validation](references/accessibility-and-validation.md) for the full protocol.

### 10. Optimize and deliver

- Remove editor metadata, unused definitions, hidden leftovers, and accidental precision.
- Preserve `viewBox`, accessible naming, meaningful IDs, and editable text.
- Keep text as text unless exact font portability requires an additional outlined derivative.
- Deliver the source SVG plus requested exports and a text alternative for complex work.
- Record source and license metadata. Do not trace copyrighted artwork or imitate a living artist.

## Quality gate

Do not finish until every applicable statement is true:

- The chosen medium and Slate production profile are explicit.
- One visual thesis and reading order are legible.
- Spatial structure mirrors the concept rather than defaulting to equal boxes.
- Content is factual, complete, and legible at delivery size.
- Color, typography, stroke, icons, and depth are coherent and token-grounded.
- Every text/surface pair passes 4.5:1 (or 3:1 for qualifying large text) in light, dark, and applicable custom
  themes; every essential graphical object passes 3:1 against its adjacent surface.
- Meaning is not encoded by color alone.
- Every bounded label fits its declared padded region in the actual renderer and fallback font.
- Every contained label has visibly balanced padding on all four sides at the smallest supported
  render; no label touches or crowds its container stroke.
- No connector, axis, arrow, leader, decorative line, or shape edge crosses through a text box or
  reduces legibility. Intentional backplates are documented and preserve relationship clarity.
- No two labels overlap or crowd each other; related title/value/detail lines retain a visible,
  deliberate gap at the smallest supported render.
- Repeated alignments share exact anchors; all overlaps are intentional and classified.
- Connector paint touches declared body boundaries/ports without gaps or intrusion.
- Inline markup survives Slate sanitization; external assets are local and self-contained.
- Informative figures have an accessible name; complex figures have structured description/data.
- Every authored live Slate content SVG has Slate-hosted viewport or presentation motion, a
  top-right replay control revealed on SVG hover/focus, and a complete reduced/off state.
- Data encodings and labels reproduce source truth without invented precision.
- The actual render has been inspected in required modes and sizes.

## Bundle contents

- [Visual routing](references/visual-routing.md)
- [Data visualization](references/data-visualization.md)
- [Composition and layout](references/composition-and-layout.md)
- [Illustration techniques](references/illustration-techniques.md)
- [Production and embedding](references/production-and-embedding.md)
- [Theme contract](references/theme-contract.md)
- [Motion and animation](references/motion-and-animation.md)
- [Accessibility and validation](references/accessibility-and-validation.md)
- [Research sources](references/research-sources.md)
- [`assets/starter-slate-inline.svg`](assets/starter-slate-inline.svg)
- [`assets/theme-template.json`](assets/theme-template.json)
- [`assets/presets.json`](assets/presets.json)
- [`scripts/validate_svg.py`](scripts/validate_svg.py)
- [`scripts/validate_theme.py`](scripts/validate_theme.py)

## Provenance

Adapted into Slate from the complete local `svg-illustration` skill bundle supplied by the user from
`the-sprite-project/docs-presentation-skill/visualization/skills/svg-illustration`. Slate owns this
adapted generic contract and keeps the full supporting reference set with it.
