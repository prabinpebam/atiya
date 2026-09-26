# Composition and Layout

## Begin With a Visual Argument

A useful illustration makes a claim visible. Write the claim as a visual thesis:

> The viewer should immediately see that **A** changes, contains, blocks, feeds, outweighs, or differs from **B**.

Then choose geometry that demonstrates the verb. If the thesis could be removed without changing the layout, the
composition is probably generic.

## Three Reading Distances

Design every substantial illustration at three levels:

1. **Glance:** dominant subject, direction, and conclusion.
2. **Scan:** major groups, stages, comparisons, or spatial regions.
3. **Inspect:** evidence, annotations, values, exceptions, and source detail.

Use scale, enclosure, spacing, and contrast to keep these levels distinct. Do not render all labels at equal weight.

## Frame and Safe Area

Treat the viewBox as a framed poster, not an infinite canvas. Reserve space *before* drawing so no
label, bar, arrowhead, gridline, or annotation can reach an edge or intrude on another element's zone.
Most "text goes outside the area / overlaps other text" defects come from drawing data into the same
band as the title, or letting a value label run past the frame. A reserved-band frame prevents both.

Define these quantities before placing any mark, and derive every coordinate from them:

- **Safe margin `m = max(24, 3u, 0.04 * min(W, H))`.** Increase it for wide strokes, arrowheads,
  shadows, external labels, or dense motion. No painted geometry and no rendered text bounding box -
  measured in its longest localized/fallback form, including stroke width and arrowhead - may cross
  the inner rectangle `[x + m, x + W - m] x [y + m, y + H - m]` for viewBox `x y W H`.
- **Open canvas.** Do not draw a decorative border around the viewBox or safe-area perimeter. An
  internal enclosure is valid only when it communicates real containment and remains clearly
  separated from every canvas edge.
- **Non-overlapping horizontal bands:**
  - **header band** `[m, headerBottom]` holds only the title and subtitle;
  - **plot/subject band** `[headerBottom + g, H - footerHeight]` holds every data mark, gridline,
    node, and connector;
  - **footer band** `[H - footerHeight, H - m]` holds axis tick labels and bottom annotations.
  Compute `headerBottom` from the actual title and subtitle boxes plus a gap `g` (minimum 12). The
  maximum scale line (chart top) sits at the plot-band top, strictly *below* the header band; the
  zero/baseline sits at the plot-band bottom, strictly *above* the footer band. No data mark may enter
  the header or footer band, and no header, subtitle, or legend text may enter the plot band.
- **Value-label reserve** for bar and column charts: end the longest bar at `W - m - labelReserve`,
  where `labelReserve` is the measured width of the largest value label plus a gap. Values live in a
  fixed reserved column or a fixed offset that stays inside the safe area; never place a value over a bar.
- **Axis and tick placement:** tick labels live in the footer band or in a reserved left gutter
  `[m, plotLeft]`, never over the plotted marks or the header.
- **Legend rectangle:** place it inside a sub-rectangle of the plot that is verified empty of data
  marks and header text. A legend that cannot be placed clear of the data becomes direct labels.

If the subtitle, legend, or any label does not fit its band, wrap it, shorten it, enlarge the band, or
shrink the plot. Never let one zone's content spill into a neighboring zone.

### Frame verification (required, rendered)

After layout, and again after every copy or geometry change, render the real SVG and assert with
`getBBox()` in each theme and at the smallest host width. All five must hold with zero violations:

1. every `<text>` box and painted mark box lies fully inside
  `[x + m, x + W - m] x [y + m, y + H - m]`;
2. no two `<text>` boxes intersect after each is inflated by half the minimum label gap;
3. every header, subtitle, and legend box lies inside its band and clear of the plot band's gridlines,
   axes, and data paths;
4. every contained label passes the text-fit contract against its `data-slate-fit-target`;
5. no canvas-border geometry traces the viewBox or safe-area perimeter, and outer whitespace remains
  optically balanced rather than merely nonzero.

Any violation fails the figure. Fix the controlling zone (band size, margin, wrap, or plot extent),
not the individual symptom.

## Map Meaning to Space

| Meaning | Spatial form |
| --- | --- |
| sequence / time | directed path, timeline, or repeated states |
| cycle / feedback | ring, loop, return arrow, or repeated orbit |
| one-to-many | fan-out, branching tree, or radiating field |
| many-to-one | convergence, funnel, braid, or aggregation basin |
| hierarchy | nested enclosure, levels, tree, or stepped scale |
| containment | bounded region with clear ownership and padding |
| transformation | before/after, input-machine-output, or morph sequence |
| comparison | shared baseline, aligned columns, mirror, overlay, or small multiples |
| tension / conflict | opposing direction, collision, imbalance, or blocked path |
| dependency | directed connectors, stack, or support structure |
| affinity | proximity, shared enclosure, color family, or repeated motif |
| uncertainty | ranges, fading edges, alternatives, explicit labels, or probability bands |
| central influence | radial hierarchy with controlled spokes |
| spatial reality | scene, map, cutaway, section, plan, or axonometric projection |

## Composition Patterns

### Focal field

One dominant subject with annotations or supporting evidence around it. Use for mechanisms, products, anatomy,
objects, and editorial explainers. Keep labels outside the silhouette when possible and connect with short leaders.

### Directed path

A clear start-to-finish route. Use a consistent direction and reserve reversals for actual loops. Alternate vertical
positions only when it improves label space; decorative zigzags weaken sequence.

### Layered system

Horizontal or vertical strata representing abstraction, depth, ownership, or processing. Align interfaces between
layers and show only cross-layer connections that matter.

### Branch and convergence

Use branch angles and spacing to communicate alternatives or distribution. Use convergence to communicate
aggregation or synthesis. Avoid crossing branches; if crossings are meaningful, distinguish bridges from junctions.

### Radial system

Use only when centrality, cycles, orbit, or equal relation to a core is real. Radial layouts make label placement
hard; reserve outer arcs or use numbered labels plus a keyed legend.

### Comparison

Share a baseline and visual grammar. Keep comparable features aligned. Differences should carry the visual emphasis;
identical decoration should not compete.

### Scene or cutaway

Use for spatial mechanisms and real-world contexts. Establish horizon/perspective, foreground-midground-background,
then use annotations without flattening the scene into a diagram grid.

### Multi-panel narrative

Use small multiples when change across states matters more than simultaneous overview. Lock scale, camera, and
alignment unless the change itself is camera or scale.

## Layout Procedure

1. Select the final aspect ratio and safe margin.
2. Reserve title/caption space only if the title belongs inside the artifact.
3. Place the dominant subject or main flow spine.
4. Divide remaining space into semantic zones.
5. Estimate label widths before fixing node sizes.
6. Place primary relationships and route connectors.
7. Add evidence and annotation.
8. Inspect negative space and rebalance.
9. Add restrained decoration last.

## Geometry and Spacing

Choose a base spacing unit `u` appropriate to the viewBox, commonly 8, 10, 12, or 16 units.

- micro gap: `0.5u`
- related gap: `u`
- component padding: `1.5u–2u`
- group gap: `3u–4u`
- major-zone gap: `5u–8u`
- safe outer margin: at least `3u`, more for labels, shadows, or wide strokes

Use formulas for repeated structures rather than hand-estimated coordinates:

```text
availableWidth = viewBoxWidth - leftMargin - rightMargin
cellWidth = (availableWidth - gap * (columns - 1)) / columns
x(column) = leftMargin + column * (cellWidth + gap)
```

For a radial layout with `n` items:

```text
angle(i) = startAngle + i * 2π / n
x(i) = centerX + radius * cos(angle(i))
y(i) = centerY + radius * sin(angle(i))
```

Round final authored coordinates sensibly. Preserve higher precision only for generated curves where visible quality
requires it.

## Hierarchy

Build hierarchy in this order:

1. position and spatial ownership;
2. scale and area;
3. whitespace;
4. value contrast;
5. typography;
6. color and detail.

Color cannot repair a layout where everything has the same size and spacing.

## Typography

- Use no more than three type roles in most illustrations: title, label, annotation.
- Prefer sentence case and concise labels.
- Keep essential text as `<text>` rather than paths.
- SVG does not wrap text automatically. Measure and split labels into `<tspan x="..." dy="...">` lines.
- Increase line count or container width instead of shrinking below the delivery-size legibility threshold.
- Test long words, numbers, and CJK text; character count is not a reliable universal width measure.
- Set `text-anchor` and baseline intentionally; browser baseline behavior should be verified in the target renderer.
- Avoid vertical or curved body text. Use it only for short labels where the reading cost is justified.

### Text-fit contract

Every label that visually belongs inside a bounded shape needs an explicit fit region. Do not infer that region from
the nearest ancestor group or from what looks acceptable at authoring zoom.

1. Name the visible body shape with a stable ID.
2. Mark the label with `data-slate-fit-target="body-id"` and an intentional `text-anchor`.
3. Reserve inner padding before measuring. The available rectangle is the body geometry minus padding and stroke
	 inflation on every side.
4. Wait for fonts, then measure the rendered `<text>` or combined `<tspan>` block with `getBBox()` in the actual
	 host. Test the longest localized/fallback-font case, not only the preferred font.
5. Fail the visual when the text box exceeds the fit region on any edge. A one-pixel screenshot tolerance may
	 absorb antialiasing, but it must not excuse layout overflow.

Use this correction order: shorten copy, wrap at semantic boundaries, enlarge the container, change the composition,
then reduce type only while it remains above the delivery-size legibility floor. Never use `textLength` to disguise
an overfull label. For multi-line labels, compute the whole block height and center the block, not each line
independently.

Optional machine-readable padding may be recorded as `data-slate-fit-padding="16"`. It is a validation input, not a
CSS substitute.

## Iconography Inside Illustrations

Familiar UI glyphs, status marks, product symbols, and common pictograms are sourced icons, not an
invitation to draw a new approximation.

- Choose exactly one library per SVG: Fluent Icons, Font Awesome, or Google Material Symbols.
- Prefer Fluent Icons for Microsoft and Windows subjects.
- Copy official vector geometry from the selected source; do not trace or redraw it.
- Do not mix libraries within one SVG, even when another source has a superficially closer glyph.
- Preserve aspect ratio and silhouette. Normalize only scale, optical position, and semantic color.
- Record `data-slate-icon-source` and `data-slate-icon-name` on the semantic icon group, with the
  source path/version and license in the visual brief or adjacent source comment.

Custom geometry remains appropriate for subject-specific people, objects, environments, mechanisms,
and explanatory forms. The single-source rule applies when an element functions as an icon.

## Alignment and Anchor Coordinate Contract

Every positioned subject has three potentially different anchors:

- **transform anchor:** the local origin used for motion and repeated placement;
- **connector anchor:** a boundary point or named port where a relationship terminates;
- **label anchor:** the baseline/inline point controlled by `text-anchor` and the chosen baseline behavior.

Do not collapse these into one center by convenience. A node with a label below it must keep the body and label in
separate groups so connector calculations use the body bounds rather than the combined labeled bounds.

- Establish shared alignment lines before placing coordinates: centers, edges, baselines, or a flow spine.
- Repeated peers use formulas from one origin and gap, never individually nudged coordinates.
- Use mathematical centering first. Apply optical correction only after rendering, record it as a small deliberate
	offset, and apply the same rule to comparable peers.
- In transformed groups, compute anchors in local coordinates and transform them once into the SVG viewport. Do not
	mix local and viewport coordinates in one route calculation.
- Use `dominant-baseline` only after verifying target support; otherwise place text from measured font bounds.
- Alignment passes only when the intended anchor values match numerically within the declared tolerance, not merely
	when elements look approximately aligned.

## Connectors

- Draw connectors before nodes, but do not rely on node paint to hide an incorrect endpoint.
- Connect boundary-to-boundary or named port-to-port. A visible connector must never continue inside a node body.
- Prefer direct or orthogonal routes. Use curves when they encode flow or reduce crossings.
- Keep arrowheads proportional to stroke width and visible at final size.
- Use line style semantically: solid for primary/current, dashed for optional/projected, dotted for indirect/ambient.
- Label relationships near the middle of a clear segment, with a background knockout if necessary.
- Do not let lines pass behind text unless the occlusion is deliberate and readable.
- When many edges cross, change the layout or use a graph engine; styling is not a cure for topology.

### Boundary endpoint construction

Record substantive relationships with `data-slate-connector-from="source-body-id"`,
`data-slate-connector-to="target-body-id"`, and `data-slate-connector-anchor="boundary|port"`. The referenced IDs
identify visible body shapes or explicit port elements, not outer groups containing labels.

For a circle centered at $C$ with radius $r$, toward point $P$:

```text
u = (P - C) / length(P - C)
boundary = C + r * u
```

For an axis-aligned rectangle centered at $C$ with half-width $h_x$ and half-height $h_y$:

```text
d = P - C
t = min(h_x / abs(d.x), h_y / abs(d.y)) using only non-zero terms
boundary = C + t * d
```

Avoid rounded corners unless the route intentionally targets the corner arc; prefer a named side port. For arbitrary
paths, use `getPointAtLength()`/hit testing or a geometry library to find the first boundary intersection rather
than guessing.

Stroke caps change the visible endpoint. With `stroke-linecap="butt"`, place the path endpoint on the boundary. A
round or square cap extends approximately half the connector stroke beyond the path endpoint, so move the endpoint
outward by half the stroke width along the route. Arrow tips terminate at the boundary while their body remains
outside. Verify the painted pixels at high zoom: no gap, no intrusion, and no arrowhead hidden under the node.

## Collision and Tangency Control

Inflate every measured box by half its stroke width plus the required gap before testing collisions. Classify every
overlap as one of: semantic containment, deliberate occlusion, connector junction, or defect. Unclassified overlap
fails review.

- sibling subjects must have at least the related gap (`u`) unless intentional overlap is documented;
- labels must not intersect node outlines, icons, connectors, arrowheads, or other labels;
- connectors may intersect only at declared junctions; a crossing is not a junction;
- a gap between `0` and `0.5u` is a near-tangency and should be treated as a defect, not as whitespace;
- parallel edges and baselines must use exact shared coordinates; accidental one- or two-unit drift fails alignment;
- test first, peak-motion, handoff, and final states because transforms can create collisions absent from endpoints.

When a collision appears, fix the controlling geometry or composition. Do not cover it with a background patch,
reduce opacity, or shrink text until the defect becomes harder to notice.

## Color

Define roles before hex values:

- canvas / surface;
- primary ink / secondary ink;
- structural line;
- primary accent;
- secondary accent;
- success / warning / danger only when those meanings exist;
- muted region / inactive state.

Use a restrained palette. A practical default is neutral canvas and ink, one dominant accent, one supporting accent,
and semantic state colors when needed. Test contrast in every target theme. Pair color with labels or form.

## Depth and Layering

Use overlap, scale, value, and occlusion consistently. Pick one depth model:

- flat diagrammatic;
- shallow layered paper;
- axonometric;
- perspective scene.

Do not combine conflicting projections casually. Shadows should reveal hierarchy or elevation, not decorate every
shape. In technical work, explicit boundaries are usually clearer than large blurred shadows.

## Density and Multi-Zoom

For dense visuals:

- summarize the whole with one dominant path or structure;
- use visible region boundaries and section labels;
- provide one or two concrete evidence artifacts per important region;
- remove duplicated prose;
- split into panels or companion figures when labels fall below readable size.

The goal is not maximal occupancy. Empty space is useful when it separates meaning; it is waste when it interrupts
the reading path without purpose.

## Anti-patterns

- Equal rounded cards for unrelated concepts.
- A decorative central circle with arbitrary spokes.
- Arrows that indicate no defined relationship.
- Every section using a different color without semantics.
- Long paragraphs embedded inside SVG.
- Tiny labels used to preserve an overfull composition.
- Icons as substitutes for unfamiliar concepts without labels.
- Repeating the same fact as title, label, annotation, and legend.
- Gradients, glow, or shadows used to manufacture hierarchy absent from the layout.