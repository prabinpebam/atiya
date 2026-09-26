# Accessibility and Validation

Accessibility depends on the SVG’s purpose and embedding method. Visual validation is separate: a semantically valid
SVG can still be clipped, illegible, misleading, or blank.

## Classify the Graphic

### Decorative

The visual adds no information beyond adjacent content.

- inline: `aria-hidden="true"` and no focusable descendants;
- external `<img>`: `alt=""`;
- prefer CSS backgrounds for purely decorative web imagery;
- do not add verbose titles that create screen-reader clutter.

### Simple informative

The graphic conveys one concise idea.

```xml
<svg role="img" aria-labelledby="diagram-title" viewBox="0 0 600 400">
  <title id="diagram-title">Three stages of sprite export</title>
  ...
</svg>
```

When embedded via `<img>`, use the HTML `alt` attribute instead.

### Complex informative

Charts, diagrams, maps, mechanisms, and illustrations with substantial structure need two levels:

1. a short name/takeaway;
2. a structured long description in adjacent HTML or documentation.

Use `<desc>` for a compact summary, but do not put a table or long structured explanation only in `<desc>` or
`aria-describedby`; assistive technology may flatten its structure. Provide visible prose, lists, or a data table
next to the figure and refer to it from the short alternative.

### Interactive

If internal elements are controls:

- use native HTML controls around the SVG when practical;
- otherwise provide focusability, role, accessible name, keyboard activation, visible focus, and equivalent state;
- ensure pointer and keyboard interactions have the same result;
- make hit areas large enough without obscuring semantics;
- announce dynamic changes appropriately in surrounding HTML.

## Accessible Naming

For inline informative SVG:

```xml
<svg role="img" aria-labelledby="asset-flow-title asset-flow-desc" viewBox="0 0 800 500">
  <title id="asset-flow-title">Character assets moving from packs to Godot</title>
  <desc id="asset-flow-desc">Pack layers are composed, recolored, saved as a recipe, and exported with credits.</desc>
  ...
</svg>
```

- Put `<title>` immediately after the opening `<svg>`.
- Use unique IDs when multiple SVGs may be inlined.
- Keep the short title useful out of context.
- Describe the conclusion and reading order, not every decorative shape.

## Text Alternatives for Complex Visuals

A useful long description includes the essential:

- purpose and main takeaway;
- organization and reading order;
- entities and meaningful relationships;
- values, trends, exceptions, or uncertainty;
- spatial composition when position carries meaning;
- source and limitations where relevant.

For data-bearing visuals, include the source data as a table or structured list. For technical diagrams, include the
important sequence, boundaries, and relationship semantics in prose.

## Contrast and Non-color Encoding

- Target at least 4.5:1 for normal text and 3:1 for large text and essential graphical objects under WCAG AA.
- Test actual foreground/background pairs, including transparency and gradients.
- Test against the immediate painted shape, not the SVG canvas or page behind it. A label inside a node inherits
  no contrast guarantee from the page's normal text token.
- Use explicit on-surface roles. In Slate, brand surfaces use `--color-on-brand`; status surfaces use their
  matching status foreground for secondary text. Muted neutral text on tinted surfaces fails unless measured.
- Do not use color alone for categories or state. Pair it with shape, line dash, label, pattern, icon, position, or
  direct annotation.
- Avoid legends when direct labels can identify marks more clearly.
- Check grayscale and common color-vision-deficiency simulations when category color carries substantial load.

## Typography and Magnification

- Preserve real text where possible so it can scale and be selected.
- Test at the smallest intended rendered size and at browser zoom.
- Avoid essential text along steep curves or vertical axes.
- Ensure line spacing and container padding survive font substitution.
- Treat text as geometry during review. A label that fits only in the authoring font, touches a
  container stroke, or sits over a connector fails even when its contrast ratio passes.
- Do not encode critical content only as tiny annotations.

## Motion

- Provide a useful static state.
- Respect `prefers-reduced-motion` in web profiles.
- Avoid flashing content and rapid high-contrast changes.
- Provide pause/stop controls for continuous meaningful animation.
- Do not make comprehension depend on catching a transient frame.

## Structural Validation

Run `scripts/validate_svg.py` before rendering. It checks a conservative baseline:

- well-formed XML and SVG root;
- valid positive `viewBox`;
- duplicate IDs and dangling `href`/`url(#...)` references;
- accessible name requirements by mode;
- script/event handlers and external resources;
- profile-specific unsupported elements/features;
- fit-target references, explicit text anchors, and non-negative padding metadata;
- connector source/target geometry references and boundary/port anchor semantics;
- missing reduced-motion handling when CSS animation is detected.

It does not prove WCAG conformance, visual quality, factual accuracy, safe sanitization, or target compatibility.

## Mandatory Visual Validation Loop

### 1. Render

Render the real SVG, not a manually recreated preview. Prefer the actual embedding context. Capture a PNG at the
intended size and, for dense work, a larger inspection size.

### 2. Inspect conceptual quality

- Does the first glance reveal the visual thesis?
- Is the reading order obvious?
- Does the spatial structure match the relationships?
- Are visual hierarchy and emphasis faithful to the content?
- Are real evidence and important exceptions visible?
- Does the image add understanding beyond the accompanying prose?

### 3. Inspect defects

- blank or partially rendered output;
- clipped strokes, labels, shadows, filters, markers, and symbols;
- text overflow, fallback-font reflow, or unreadably small type;
- accidental overlaps and near-tangencies;
- connectors crossing nodes, labels, or one another;
- shape edges, axes, leaders, arrows, or decorative lines crossing through text or running close
  enough behind it to weaken letterforms;
- wrong endpoints, arrow directions, or relationship labels;
- inconsistent alignment, spacing, and optical weight;
- large empty voids or crowded clusters;
- low contrast and color-only distinctions;
- broken silhouettes, anatomy, perspective, or layer order;
- unsupported target features.

For every bounded label, compare its rendered `getBBox()` with the padded geometry named by
`data-slate-fit-target`. For every connector, inspect both ends at high zoom and verify that the painted stroke or
arrow tip touches the declared boundary/port without a gap or intrusion. Compare repeated anchor coordinates
numerically, and run pairwise inflated-bounds checks for subjects that are not allowed to overlap.

### Text and line clearance checks

- Inflate every rendered text box by its declared padding, or by the visual system's minimum label
  padding when the label is external.
- For contained labels, require the inflated box to remain wholly inside the target's painted inner
  boundary. Check left, right, top, and bottom independently; a centered anchor does not prove fit.
- For curved containers, calculate clearance from the actual circle/ellipse/path boundary at each
  text-box corner or sample the painted geometry. Never substitute the container's rectangular
  bounding box for curved-boundary clearance.
- For external labels, require a visible gap from adjacent shape strokes and reserve a stable column
  or band for values rather than placing values over bars or nodes.
- Run pairwise checks across nearby rendered text boxes. Reject overlaps and gaps too small to
  preserve separate line boxes after fallback-font substitution.
- Intersect inflated label boxes with every connector, axis, leader, arrow, and decorative line.
  Report every hit. Do not dismiss a hit because the line is behind the text in DOM order.
- When a backplate is intentional, record it as an allowed overlap and inspect the plate in all
  themes; it must fully cover the line with enough padding and must not obscure endpoint meaning.
- Re-run these checks at the smallest real host render and with the fallback font. Capture a focused
  screenshot of each dense label/connector region, not only a whole-figure screenshot.

### 4. Inspect responsive behavior

- smallest expected width;
- normal display width;
- large/print width;
- narrow container with `meet` behavior;
- theme variants when applicable.

Do not accept a layout that only works at the authoring zoom level.

### 5. Revise

Change the smallest controlling cause: composition, zone size, label wrap, connector route, viewBox margin, palette,
or unsupported feature. Re-render after every substantive correction. After three unsuccessful local correction
rounds, reconsider the composition or medium.

## Programmatic Checks Worth Adding in Host Projects

Depending on risk and tooling:

- XML parsing and schema/profile linting;
- duplicate-ID and dangling-reference detection;
- Playwright screenshot tests at multiple sizes/themes;
- bounding-box checks for elements outside the viewBox;
- computed contrast checks for known fill/text pairs;
- pixel checks for nonblank output;
- axe-core checks for surrounding HTML and interactive controls;
- snapshot or semantic checks for generated labels and data values;
- deterministic-output checks for generated SVG.

Geometry-sensitive illustrations should additionally capture a machine-readable defect report with:

- text box, fit-target box, padding, and overflow on each edge;
- inflated text-box intersections with connector/axis/edge geometry and the rationale for every
  intentional backplate;
- subject box inflated by stroke and minimum gap;
- connector start/end points, referenced node/port IDs, and distance from the painted boundary;
- intended alignment axis and maximum peer deviation;
- explicit allowlist entries for semantic containment or deliberate occlusion.

Do not derive the allowlist from observed overlaps. Author intent first, capture geometry second, detect defects
third.

## Factual and Ethical Review

- Verify labels, values, relationships, chronology, and source attribution.
- Distinguish observed data from projection and metaphor.
- Do not imply geographic scale, causation, certainty, or hierarchy that the source does not support.
- Avoid stereotypes and stigmatizing visual metaphors.
- Record licenses for icons, fonts, images, and source artwork.
- Do not trace copyrighted artwork or imitate a living artist’s distinctive style.

## Final Review Record

For consequential visuals, record:

```text
Source SVG:
Production profile:
Rendered sizes tested:
Themes/targets tested:
Structural validator result:
Accessibility mode and text alternative:
Visual issues found and corrected:
External assets and licenses:
Known limitations:
```