# Data Visualization

Use this reference when source material contains quantities, distributions, trends, correlations, networks, flows, or multidimensional tables. The final output may be custom SVG, but the encoding must be statistically honest before it is visually polished.

## Find the Opportunity

A visualization earns its space when it reveals something prose or a lookup table does not:

- magnitude, rank, or gap;
- change over time, rate, or turning points;
- distribution, spread, outliers, or uncertainty;
- relationship or correlation;
- composition or conserved flow;
- topology, hierarchy, community, or dependency;
- geography or spatial concentration;
- repeated dimensions requiring scan, sort, or drill-down.

Prefer a table when exact lookup matters more than pattern. Prefer prose when fewer than three values make the comparison obvious. Never invent precision, percentages, or sample sizes to justify a chart.

## State the Analytical Question

Write one sentence before selecting a form:

> Compare **measure** across **dimension**, filtered/grouped by **condition**, to understand **claim**.

Identify measure and dimension types, unit/denominator, meaningful zero/baseline, domain, uncertainty, missing data, and whether values are measured, estimated, ranked, or illustrative.

## Encoding Priority

For precise comparison, prefer:

1. position on a shared scale;
2. length from a shared baseline;
3. angle or slope;
4. area;
5. color lightness/saturation;
6. shape or texture.

Use position or length for the main claim. Reserve color for grouping, status, or secondary magnitude. Do not encode unrelated measures with arbitrary size and color simultaneously.

## Form Selection

| Question | Strong default | Avoid |
| --- | --- | --- |
| Compare categories | sorted bar or dot plot | pie with many slices; truncated bar baseline |
| Trend over time | line; area for cumulative volume | smoothing that implies unobserved values |
| Before/after | slope, dumbbell, small multiples | unrelated bars when direction matters |
| Distribution | histogram, box, strip/dot plot | average-only bar |
| Correlation | scatter with annotation | dual axes implying false relation |
| Part-to-whole | stacked bar; restrained donut for few parts | many-slice pie |
| Ranking without magnitude | numbered list or ordinal ladder | pseudo-quantitative bar lengths |
| Progress to target | bullet/progress bar with explicit target | decorative gauge/liquid |
| Flow/conversion | Sankey/funnel only when volume semantics are real | arrows with invented widths |
| Hierarchy | indented tree; treemap when area is quantitative | unreadable radial labels |
| Geography | map only when location explains the claim | map distorted by region area |
| Many dimensions | small multiples or analytical table | overloaded radar chart |
| Dense network | adjacency matrix or interactive graph | labelled force graph with collisions |

## Scales

- **Linear:** additive differences; default for quantitative data.
- **Log:** positive values spanning orders of magnitude; label it explicitly.
- **Square-root:** size/area encodings or tempered wide ranges.
- **Quantile/threshold:** explicit bins; publish breakpoints.
- **Time:** preserve real date spacing; distinguish missing observations from zero.
- **Nominal:** no implied order; sort by value or meaningful domain order.
- **Ordinal:** preserve the defined sequence.
- **Sequential color:** monotonic magnitude.
- **Diverging color:** two directions around a meaningful midpoint.
- **Categorical color:** stable distinct groups with comparable prominence.

Bars start at zero. Lines/dots may use a narrowed domain when clearly labelled and not misleading.

## Transformations

Record transformations explicitly and keep them reproducible:

- filter and sort;
- group and aggregate;
- bin distributions;
- stack or normalize;
- fold wide data into series;
- calculate rate, change, rolling average, or index;
- sample only when density requires it;
- derive network nodes/edges or hierarchy levels.

Do not hide a transformation in rectangle widths. Store source data or a deterministic generator beside the SVG. Label qualitative rankings as qualitative.

## Labels and Annotation

- Direct-label important marks when space permits.
- Put units in axes/labels, not only captions.
- Annotate the turning point, gap, outlier, or threshold supporting the thesis.
- Reserve label zones and use collision-aware placement.
- Hide low-priority labels or use indexed callouts rather than shrinking text.
- Use legends only when repeated encodings cannot be labelled directly.

## Graph and Network Layout

Choose layout from topology:

- directed hierarchy/DAG: layered;
- tree: tidy tree or indented hierarchy;
- cyclic community network: force-directed with collision and deterministic seed;
- ordered cycle: circular;
- similarity/distance: explained MDS/force metric;
- dense adjacency: matrix;
- geographic network: fixed spatial positions.

Reduce crossings, prevent node overlap, route edges around labels, and encode direction explicitly. Interactive graphs may need pan/zoom, selection, focus, and keyboard access in the host. For static publication, rebuild the selected layout as an inspected SVG rather than shipping an opaque export.

## Analytical Tables

Use semantic HTML or a spreadsheet-like host for large pivot/cross-analysis tables requiring exact values, totals, sorting, or drill-down. SVG is appropriate for a compact annotated matrix or publication snapshot, not a full analytical spreadsheet.

## Integrity Gate

- Scale, domain, unit, denominator, and baseline are explicit.
- Geometry and color bins are formula-derived from source data.
- Ranking/qualitative data do not imply measured magnitude.
- Missing, estimated, and uncertain values are identified.
- Labels do not overlap marks or leave the viewBox.
- Differences survive grayscale and color-vision simulation.
- The visual conclusion agrees with the underlying table.

## Static SVG Handoff

1. Save verified source data and transformation logic.
2. Declare form, scale/domain, ordering, units, and annotations.
3. Generate geometry deterministically.
4. Apply semantic theme after encoding decisions.
5. Validate SVG/profile and render at target sizes.
6. Inspect labels, axes, crossings, and data accuracy.
7. Keep an adjacent data table for accessibility and auditability.
