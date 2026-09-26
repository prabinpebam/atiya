#!/usr/bin/env node
// Slate chart renderer.
//
// Renders a declarative chart spec to a static, sanitizer-safe SVG using
// Semiotic's server pipeline (`semiotic/server`), which computes chart geometry
// with D3 and emits SVG in Node. There is no browser, no headless renderer, and
// no network call, so output is deterministic for a given spec.
//
// Slate adds a thin contract on top of Semiotic:
//   * required accessible title and takeaway description;
//   * Slate theme tokens as the default series palette;
//   * an emptiness gate using Semiotic's render evidence; and
//   * a sanitizer assertion on the emitted markup.
//
// Usage:
//   node render-chart.mjs --spec chart.json --out assets/charts/chart.svg
//   node render-chart.mjs --spec chart.json            # SVG to stdout
//   node render-chart.mjs --spec chart.json --check    # validate only

import fs from "node:fs";
import path from "node:path";
import { renderChartWithEvidence } from "semiotic/server";

/* ------------------------------------------------------------------ tokens */

// Series colours resolve against host theme tokens and fall back to a
// colour-blind-safe palette so a chart still reads correctly standalone.
export const SLATE_PALETTE = [
  "var(--slate-chart-1, #4E79A7)",
  "var(--slate-chart-2, #F28E2B)",
  "var(--slate-chart-3, #59A14F)",
  "var(--slate-chart-4, #B07AA1)",
  "var(--slate-chart-5, #E15759)",
  "var(--slate-chart-6, #76B7B2)",
  "var(--slate-chart-7, #EDC948)",
  "var(--slate-chart-8, #9C755F)",
];

// Chart components Slate supports. Semiotic ships more; this is the reviewed
// surface. Widen it deliberately rather than by accident.
export const SUPPORTED = new Set([
  "AreaChart",
  "BarChart",
  "BoxPlot",
  "BubbleChart",
  "ChordDiagram",
  "CirclePack",
  "ConnectedScatterplot",
  "DonutChart",
  "DotPlot",
  "ForceDirectedGraph",
  "FunnelChart",
  "GroupedBarChart",
  "Heatmap",
  "Histogram",
  "LineChart",
  "PieChart",
  "SankeyDiagram",
  "Scatterplot",
  "StackedAreaChart",
  "StackedBarChart",
  "SwarmPlot",
  "TreeDiagram",
  "Treemap",
  "ViolinPlot",
]);

const FORBIDDEN = /<script|<style|<foreignObject|\son[a-z]+\s*=|javascript:|(?:href|src)\s*=\s*["']https?:/i;

/* --------------------------------------------------------------- validation */

function fail(message) {
  throw new Error(message);
}

export function validateSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail("Spec must be an object");
  if (!spec.chart || typeof spec.chart !== "string") {
    fail(`Spec requires a chart name. Supported: ${[...SUPPORTED].sort().join(", ")}`);
  }
  if (!SUPPORTED.has(spec.chart)) {
    fail(`Unsupported chart "${spec.chart}". Supported: ${[...SUPPORTED].sort().join(", ")}`);
  }
  if (!spec.title || typeof spec.title !== "string") {
    fail("Spec requires a title. It becomes the accessible chart title.");
  }
  if (!spec.alt || typeof spec.alt !== "string") {
    fail("Spec requires an alt statement describing the takeaway, not the chart type.");
  }
  if (!spec.props || typeof spec.props !== "object" || Array.isArray(spec.props)) {
    fail("Spec requires a props object for the chart component.");
  }
  return spec;
}

/* ------------------------------------------------------------------ render */

// The renderer paints structural chrome - axis lines, ticks, tick labels, grid,
// and legend text - with fixed greys that assume a light page. Slate charts are
// inlined into a themed host, so those greys disappear in dark mode. Map only
// the exact structural literals onto host semantic tokens, keeping the original
// grey as the fallback. Data colours come from SLATE_PALETTE and are untouched.
const STRUCTURAL_COLORS = new Map([
  ["#333", "var(--color-neutral-fg-1, #333)"],
  ["#666", "var(--color-neutral-fg-2, #666)"],
  ["#999", "var(--color-neutral-fg-3, #999)"],
  ["gray", "var(--color-neutral-fg-2, #666)"],
  ["#ccc", "var(--color-neutral-stroke-1, #ccc)"],
  ["#e0e0e0", "var(--color-neutral-stroke-2, #e0e0e0)"],
]);

export function themeStructuralColors(svg) {
  return svg.replace(/(fill|stroke)="([^"]*)"/g, (match, attribute, value) => {
    const replacement = STRUCTURAL_COLORS.get(value.trim().toLowerCase());
    return replacement ? `${attribute}="${replacement}"` : match;
  });
}

// The renderer emits a fixed pixel width and height. A Slate figure scales its
// SVG to the container, which needs an intrinsic aspect ratio, so promote the
// rendered size to a viewBox and drop the fixed attributes. Without this the
// chart either overflows narrow columns or renders at the wrong height.
export function makeResponsive(svg) {
  const end = svg.indexOf(">");
  const root = svg.slice(0, end + 1);
  if (/\sviewBox=/.test(root)) return svg;
  const width = root.match(/\swidth="([\d.]+)(?:px)?"/)?.[1];
  const height = root.match(/\sheight="([\d.]+)(?:px)?"/)?.[1];
  if (!width || !height) return svg;
  const responsiveRoot = root
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace("<svg", `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"`);
  return responsiveRoot + svg.slice(end + 1);
}

export function renderChartSpec(rawSpec) {
  const spec = validateSpec(rawSpec);

  const props = {
    // Slate defaults. A spec may override any of these.
    width: 720,
    height: 420,
    showLegend: true,
    accessibleTable: true,
    colorScheme: SLATE_PALETTE,
    ...spec.props,
    // Slate owns accessibility text; a spec cannot silently drop it.
    title: spec.title,
    description: spec.alt,
    // Interaction is meaningless in static output and would add handlers.
    enableHover: false,
    tooltip: false,
    animate: false,
  };

  const { svg: rendered, evidence } = renderChartWithEvidence(spec.chart, props);
  let svg = rendered;

  if (typeof svg !== "string" || !svg.trimStart().startsWith("<svg")) {
    fail(`${spec.chart} did not produce an SVG root element`);
  }
  if (evidence?.empty || evidence?.markCount === 0) {
    const warnings = (evidence?.warnings || []).join("; ");
    fail(
      `${spec.chart} rendered no marks. Check the accessors against the data shape.` +
        (warnings ? ` Renderer warnings: ${warnings}` : ""),
    );
  }
  // Marks can exist and still be geometrically broken when an accessor does not
  // resolve: the scale yields NaN and the shape is drawn with no extent. That
  // ships an invisible or corrupt chart, so treat it as a hard failure.
  if (/=["'][^"']*NaN/.test(svg)) {
    fail(
      `${spec.chart} produced NaN geometry. An accessor likely does not match the data shape, ` +
        "so marks have no computed position or size.",
    );
  }
  svg = themeStructuralColors(makeResponsive(svg));
  if (FORBIDDEN.test(svg)) {
    fail(`${spec.chart} produced markup the Slate sanitizer forbids`);
  }

  return { svg, evidence };
}

/* -------------------------------------------------------------------- cli */

function arg(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  const specPath = arg("--spec");
  if (!specPath) {
    console.error("Usage: node render-chart.mjs --spec <chart.json> [--out <chart.svg>] [--check]");
    process.exit(2);
  }
  try {
    const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
    const { svg, evidence } = renderChartSpec(spec);
    if (process.argv.includes("--check")) {
      console.log(`Chart spec is valid: ${spec.chart} "${spec.title}" (${evidence.markCount} marks).`);
    } else {
      const out = arg("--out");
      if (out) {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, `${svg}\n`);
        console.log(`Chart written to ${out} (${evidence.markCount} marks).`);
      } else {
        process.stdout.write(`${svg}\n`);
      }
    }
  } catch (error) {
    console.error(`Chart render failed: ${error.message}`);
    process.exit(1);
  }
}
