// Slate chart contract tests.
//
// Proves the chart renderer produces sanitizer-safe, accessible, deterministic
// SVG, and that it rejects specs which would ship a misleading or blank chart.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderChartSpec,
  validateSpec,
  SUPPORTED,
  SLATE_PALETTE,
} from "../visualization/skills/chart/scripts/render-chart.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = [];
function test(name, fn) {
  cases.push([name, fn]);
}

const bar = {
  chart: "BarChart",
  title: "Adoption by team",
  alt: "Design leads adoption at 82 percent.",
  props: {
    data: [
      { label: "Design", value: 82 },
      { label: "Product", value: 73 },
      { label: "Engineering", value: 69 },
    ],
    categoryAccessor: "label",
    valueAccessor: "value",
  },
};

/* ------------------------------------------------------------- positive */

test("output is responsive: viewBox replaces fixed width and height", () => {
  const { svg } = renderChartSpec(bar);
  const root = svg.slice(0, svg.indexOf(">") + 1);
  assert.match(root, /viewBox="0 0 [\d.]+ [\d.]+"/, "chart root must carry a viewBox");
  assert.ok(!/\swidth="/.test(root), "fixed width must be dropped so the figure can scale");
  assert.ok(!/\sheight="/.test(root), "fixed height must be dropped so the figure can scale");
});

test("structural chrome uses host theme tokens while data colours survive", () => {
  const { svg } = renderChartSpec(bar);
  assert.ok(
    !/(fill|stroke)="(#333|#666|#999|#ccc|#e0e0e0|gray)"/i.test(svg),
    "fixed structural greys must be mapped onto host semantic tokens",
  );
  assert.ok(svg.includes("var(--color-neutral-"), "expected host neutral tokens on chart chrome");
  assert.ok(svg.includes("var(--slate-chart-1"), "data palette must survive the mapping");
});

test("renders a chart with marks", () => {
  const { svg, evidence } = renderChartSpec(bar);
  assert.ok(svg.trimStart().startsWith("<svg"), "expected an SVG root");
  assert.ok(evidence.markCount > 0, "expected rendered marks");
  assert.equal(evidence.empty, false);
});

test("output is sanitizer safe", () => {
  const { svg } = renderChartSpec(bar);
  for (const pattern of [/<script/i, /<style/i, /<foreignObject/i, /\son[a-z]+\s*=/i, /javascript:/i, /(?:href|src)\s*=\s*["']https?:/i]) {
    assert.doesNotMatch(svg, pattern, `forbidden construct ${pattern} in chart output`);
  }
});

test("output carries accessible title and takeaway", () => {
  const { svg } = renderChartSpec(bar);
  assert.match(svg, /role\s*=\s*["']img/i, "expected role=img");
  assert.match(svg, /<title/i, "expected a title element");
  assert.match(svg, /<desc/i, "expected a desc element");
  assert.ok(svg.includes(bar.title), "title text must reach the SVG");
  assert.ok(svg.includes(bar.alt), "takeaway text must reach the SVG");
});

test("series colours use Slate theme tokens", () => {
  const { svg } = renderChartSpec(bar);
  assert.match(svg, /var\(--slate-chart-/, "expected Slate chart tokens so charts theme");
});

test("rendering is deterministic", () => {
  const first = renderChartSpec(bar).svg;
  const second = renderChartSpec(bar).svg;
  assert.equal(first, second, "same spec must produce identical bytes");
});

test("a spec may override Slate defaults", () => {
  const { svg } = renderChartSpec({
    ...bar,
    props: { ...bar.props, width: 480, height: 300 },
  });
  assert.match(svg, /viewBox="0 0 480 300"/, "expected the spec size to win, expressed as the viewBox");
});

test("the bundled example renders", () => {
  const specPath = path.join(packageRoot, "visualization", "skills", "chart", "examples", "monthly-revenue.json");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const { evidence } = renderChartSpec(spec);
  assert.ok(evidence.markCount > 0, "bundled example must render marks");
});

/* ------------------------------------------------------------- negative */

const rejected = [
  ["missing chart name", { title: "t", alt: "a", props: {} }],
  ["unsupported chart", { chart: "PyramidChart", title: "t", alt: "a", props: {} }],
  ["missing title", { chart: "BarChart", alt: "a", props: bar.props }],
  ["missing takeaway", { chart: "BarChart", title: "t", props: bar.props }],
  ["missing props", { chart: "BarChart", title: "t", alt: "a" }],
];

for (const [name, spec] of rejected) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateSpec(spec), `expected ${name} to be rejected`);
  });
}

test("rejects a chart that renders no marks", () => {
  // Accessors that do not exist in the data must fail loudly, not ship blank.
  assert.throws(
    () =>
      renderChartSpec({
        chart: "BarChart",
        title: "Mismatched",
        alt: "This should never ship.",
        props: { data: [{ label: "A", value: 1 }], categoryAccessor: "nope", valueAccessor: "missing" },
      }),
    /rendered no marks|NaN geometry|did not produce/i,
  );
});

test("supported chart list is non-empty and sorted-stable", () => {
  assert.ok(SUPPORTED.size >= 20, "expected a meaningful supported chart surface");
  assert.ok(SUPPORTED.has("BarChart") && SUPPORTED.has("SankeyDiagram"));
});

test("palette exposes eight themed series colours", () => {
  assert.equal(SLATE_PALETTE.length, 8);
  assert.ok(SLATE_PALETTE.every((c) => c.startsWith("var(--slate-chart-")));
});

/* ---------------------------------------------------------------- run */

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}\n  ${error.message}`);
  }
}

if (failed) {
  console.error(`\nSlate chart contract tests failed (${failed} of ${cases.length}).`);
  process.exit(1);
}
console.log(`Slate chart contract tests passed (${cases.length} cases).`);
