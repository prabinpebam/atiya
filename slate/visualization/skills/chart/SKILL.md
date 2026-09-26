---
name: chart
description: "Use when content carries quantitative data - trends, comparisons, proportions, distributions, correlations, flows, or hierarchies - and needs an accurate chart. Renders a declarative spec to static, themeable, accessible SVG using Semiotic's server pipeline on D3. Do not use for decorative or explanatory illustration; use svg-illustration instead."
---

# Chart

Slate renders charts **offline at authoring time**. A declarative JSON spec goes in, a static SVG
comes out, and that SVG is embedded through the figure component.

The engine is [Semiotic](https://semiotic.nteract.io/) via `semiotic/server`, which computes chart
geometry with D3 and emits SVG in Node. There is no browser, no headless renderer, and no network
call.

## Why this shape

- **Deterministic.** The same spec always produces the same bytes, so charts diff cleanly and
  survive review.
- **Offline.** No chart data leaves the machine and no remote service can change your output.
- **Themeable.** Charts are inline SVG whose series colours are Slate tokens, so they adapt to
  light and dark. A raster chart cannot do this.
- **Accessible.** Every chart carries `role="img"`, an `aria-label`, a `<title>`, and a takeaway
  `<desc>`, and is paired with a data table in the page.
- **Verified.** The renderer asserts the chart actually drew marks. A chart whose accessors do not
  match its data fails loudly instead of shipping blank.
- **Sanitizer-safe.** Output is asserted to contain no `<script>`, `<style>`, `<foreignObject>`,
  event handler, or remote reference.

## When not to use this skill

| Need | Use instead |
| --- | --- |
| Explanatory diagram, editorial illustration, scene, object, map, motion subject | [`svg-illustration`](../svg-illustration/SKILL.md) |
| Summary poster, process diagram, or key-fact layout | [`svg-illustration`](../svg-illustration/SKILL.md) |
| Tabular data, pivot, or spreadsheet | Slate `table` component |
| Text-heavy responsive UI, cards, steps | Slate HTML components |
| Photorealism or painterly texture | Bitmap imagery |

A chart must earn its place. Do not turn two numbers into a chart, and never chart a value the
reader cannot act on.

## Supported charts

| Content shape | Chart |
| --- | --- |
| Trend over a continuous or ordered axis | `LineChart`, `ConnectedScatterplot` |
| Cumulative or banded trend | `AreaChart`, `StackedAreaChart` |
| Category comparison | `BarChart`, `GroupedBarChart`, `StackedBarChart`, `DotPlot` |
| Parts of a whole | `PieChart`, `DonutChart` |
| Correlation | `Scatterplot`, `BubbleChart` |
| Distribution | `Histogram`, `BoxPlot`, `ViolinPlot`, `SwarmPlot` |
| Conversion or flow | `FunnelChart`, `SankeyDiagram` |
| Two-factor intensity | `Heatmap` |
| Hierarchy | `Treemap`, `CirclePack`, `TreeDiagram` |
| Network or relationship | `ForceDirectedGraph`, `ChordDiagram` |

This is Slate's reviewed surface, not everything Semiotic ships. Widen it deliberately by editing
`SUPPORTED` in the renderer, never by accident.

## Spec format

A spec has four parts: the chart name, the accessible title, the takeaway, and the component props.

```json
{
  "chart": "LineChart",
  "title": "Monthly revenue",
  "alt": "Revenue climbed steadily through March, then eased in April.",
  "props": {
    "data": [
      { "month": 1, "revenue": 40000 },
      { "month": 2, "revenue": 62000 },
      { "month": 3, "revenue": 81000 },
      { "month": 4, "revenue": 74000 }
    ],
    "xAccessor": "month",
    "yAccessor": "revenue",
    "showGrid": true
  }
}
```

Required:

- `chart` - a supported chart name.
- `title` - the accessible chart title.
- `alt` - states the **takeaway**, not the chart type. "Setups doubled after the Windows release",
  not "a bar chart of setups". The renderer rejects a spec without it.
- `props` - the component props, including `data` and its accessors.

Slate supplies defaults for `width`, `height`, `showLegend`, `accessibleTable`, and `colorScheme`,
and forces `enableHover`, `tooltip`, and `animate` off because static output cannot use them. Any
other prop passes straight through to Semiotic.

**Accessors must match the data shape.** Categorical charts take a category accessor
(`categoryAccessor`) and a value accessor (`valueAccessor`); XY charts take `xAccessor` and
`yAccessor` over continuous values. A mismatch renders zero marks and the renderer fails the build.

## Produce a chart

```powershell
node .\slate\visualization\skills\chart\scripts\render-chart.mjs `
  --spec .\docs\assets\charts\monthly-revenue.json `
  --out  .\docs\assets\charts\monthly-revenue.svg
```

Validate without writing output:

```powershell
node .\slate\visualization\skills\chart\scripts\render-chart.mjs --spec <spec.json> --check
```

**Keep the spec next to the SVG.** The `.json` is the source of truth; the `.svg` is generated.
Re-render rather than hand-editing the SVG.

## Embed in a page

Charts are inline SVG so they inherit theme tokens. Follow every chart with its data as a
collapsible table - this satisfies accessibility and makes the numbers searchable.

```html
<figure class="slate-figure">
  <!-- contents of monthly-revenue.svg -->
  <figcaption>Revenue by month, FY26 (finance close, excludes deferred).</figcaption>
</figure>
<details class="slate-figure-data">
  <summary>Data</summary>
  <table>
    <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
    <tbody>
      <tr><td>January</td><td>$40,000</td></tr>
      <tr><td>February</td><td>$62,000</td></tr>
      <tr><td>March</td><td>$81,000</td></tr>
      <tr><td>April</td><td>$74,000</td></tr>
    </tbody>
  </table>
</details>
```

If a host prefers a linked asset over inline markup, reference the `.svg` with `<img>` inside the
figure. That loses theme adaptation, so prefer inline for content charts.

## Colour and theming

The default `colorScheme` is Slate's token palette: `var(--slate-chart-1, …)` through
`var(--slate-chart-8, …)`. Slate defines those tokens for light and dark, and a host may override
them in its own theme file. The fallback hexes are colour-blind safe and ordered so the first three
series stay distinguishable.

To pin one colour, pass `color` in `props`; use a token so it still themes:

```json
{ "props": { "color": "var(--slate-chart-3, #59A14F)" } }
```

Never encode meaning by colour alone. Label directly, order meaningfully, or annotate.

## Icons in charts

Charts may use icons, and often should - a platform, device, product, or people-group category is
recognised faster by symbol than by name.

**Source every icon from one of three approved libraries: Fluent Icons, Google Material Symbols, or
Font Awesome.** Use exactly one source per chart. Prefer Fluent for Microsoft and Windows subjects.
The full contract - sourcing, provenance, theming, accessibility - is in
[`iconography`](../iconography/SKILL.md).

Use icons for:

- **Category identity** beside an axis label, legend entry, or bar.
- **Annotation markers** pointing at a threshold, incident, or callout.
- **KPI and big-number figures**, where the icon carries the subject and the number carries the value.

Rules specific to charts:

- Icons are **supporting, never the data encoding**. Never size an icon to represent a quantity;
  that is a chart type (`BubbleChart`), not an icon.
- Never replace an axis or legend label with a bare icon that has no accessible name. Keep the text
  and let the icon assist it.
- Colour icons with the same Slate tokens as the series they belong to, so they theme together.
- Decorative icons take `aria-hidden="true"`; the chart's `<title>` and `<desc>` already carry the
  accessible meaning.
- Never draw an icon from memory, mix libraries within one chart, or use emoji.

Add icons through `props.annotations` or by composing the icon into the surrounding figure markup
after render. Do not hand-edit the generated SVG to insert them - see the guardrails below.

## Quality bar

Before accepting a chart:

1. **The takeaway is legible in three seconds.** If not, simplify the chart or change its type.
2. **Axes start at a truthful baseline.** A bar chart's value axis starts at zero.
3. **Labels are readable.** No overlapping category labels; shorten names or use horizontal bars.
4. **Series count is sane.** Beyond five or six lines, split into small multiples.
5. **The caption adds context** the chart cannot show: source, sample size, period, caveat.
6. **It reads correctly in light and dark**, and in greyscale.
7. **The data table matches the chart.** Numbers never disagree.

## Guardrails

- Never fabricate data points, categories, or totals.
- Never hand-edit generated SVG; change the spec and re-render.
- Never truncate a bar axis to exaggerate a difference.
- Never suppress the emptiness check to force a chart through.
- Never enable hover, tooltip, or animation in static output.
- Never use a chart where a sentence is clearer.
