import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canvasPerspective, canvasPerspectives, layoutCanvas, validateCanvasDocument, validateRecordSet } from "../canvas/src/domain.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const recordSet = {
  schemaVersion: 1,
  id: "example-records",
  revision: "example-1",
  records: [
    { id: "REC-01", kind: "capability", title: "Review one outcome", source: { label: "Source", href: "content.html#rec-01" } },
    { id: "REC-02", kind: "capability", title: "Review another outcome" },
  ],
};
const document = {
  schemaVersion: 1,
  id: "example-canvas",
  title: "Example canvas",
  mode: "readonly",
  recordSources: [{ id: "example-records", path: "data/example-records.json" }],
  groups: [
    { id: "view-home", title: "Home view", tone: "aqua", order: 1 },
    { id: "section-status", title: "Status", parentId: "view-home", order: 1 },
  ],
  placements: [
    { id: "placement-1", groupId: "section-status", recordRef: { sourceId: "example-records", recordId: "REC-01" } },
    { id: "placement-2", groupId: "section-status", recordRef: { sourceId: "example-records", recordId: "REC-01" } },
    { id: "placement-3", groupId: "view-home", recordRef: { sourceId: "example-records", recordId: "REC-02" } },
  ],
};
const recordSets = new Map([[recordSet.id, recordSet]]);

assert.deepEqual(validateRecordSet(recordSet), []);
assert.deepEqual(validateCanvasDocument(document, recordSets), []);
assert.equal(layoutCanvas(document, recordSets).nodes.length, 5, "Two group boxes and three placements: a group is its own container, so nothing extra stands in for it.");
assert.equal(document.placements.filter((placement) => placement.recordRef.recordId === "REC-01").length, 2, "A record may appear in multiple groups.");
assert.equal(canvasPerspectives(document).length, 1, "Legacy documents expose one normalized perspective.");

// Tone must inherit through the whole ancestor chain. A document normally declares a
// tone on top-level groups only, so resolving a single level dropped every group at
// depth 2 or deeper to neutral and flattened the visual hierarchy.
const toneDocument = {
  schemaVersion: 1,
  id: "tone-canvas",
  title: "Tone canvas",
  mode: "readonly",
  recordSources: [{ id: "example-records", path: "data/example-records.json" }],
  groups: [
    { id: "root", title: "Root", tone: "lilac", order: 1 },
    { id: "child", title: "Child", parentId: "root", order: 1 },
    { id: "grandchild", title: "Grandchild", parentId: "child", order: 1 },
  ],
  placements: [
    { id: "tone-placement-1", groupId: "grandchild", recordRef: { sourceId: "example-records", recordId: "REC-01" } },
  ],
};
assert.deepEqual(validateCanvasDocument(toneDocument, recordSets), []);
const toneNodes = layoutCanvas(toneDocument, recordSets).nodes;
for (const id of ["root", "child", "grandchild"]) {
  const node = toneNodes.find((item) => item.id === id);
  assert.equal(node.data.tone, "lilac", `${id} must inherit the tone declared on its ancestor`);
}
assert.equal(
  toneNodes.find((item) => item.type === "slateRecord").data.tone,
  "lilac",
  "A record must take the resolved tone of its owning group",
);

const sizingRecordSet = {
  schemaVersion: 1,
  id: "sizing-records",
  revision: "sizing-1",
  records: [
    { id: "S-01", kind: "note", title: "Short" },
    { id: "S-02", kind: "note", title: "A considerably longer record statement that has to wrap onto several lines inside its own card", eyebrow: "Organizer" },
  ],
};
const sizingDocument = {
  schemaVersion: 1,
  id: "sizing-canvas",
  title: "Sizing canvas",
  mode: "readonly",
  recordSources: [{ id: "sizing-records", path: "sizing-records.json" }],
  groups: [{ id: "sizing-group", title: "Group" }],
  placements: [
    { id: "sizing-placement-1", groupId: "sizing-group", recordRef: { sourceId: "sizing-records", recordId: "S-01" }, order: 1 },
    { id: "sizing-placement-2", groupId: "sizing-group", recordRef: { sourceId: "sizing-records", recordId: "S-02" }, order: 2 },
  ],
};
const sizingRecordSets = new Map([[sizingRecordSet.id, sizingRecordSet]]);
assert.deepEqual(validateRecordSet(sizingRecordSet), []);
assert.deepEqual(validateCanvasDocument(sizingDocument, sizingRecordSets), []);
const sizingNodes = layoutCanvas(sizingDocument, sizingRecordSets).nodes;
const shortCard = sizingNodes.find((node) => node.id === "sizing-placement-1");
const longCard = sizingNodes.find((node) => node.id === "sizing-placement-2");
const sizingGroup = sizingNodes.find((node) => node.id === "sizing-group");
assert.ok(shortCard.style.width < longCard.style.width, "Each card hugs its own text width.");
assert.ok(longCard.style.height > shortCard.style.height, "A wrapped title grows only its own card height.");
// A group is the box its records sit in. There is no separate node standing for the view
// or section and no unnamed enclosure beside it: the named box is the container.
assert.ok(sizingGroup.style.height > shortCard.style.height, "A group box is sized to hold its own records.");
assert.equal(
  layoutCanvas(sizingDocument, sizingRecordSets).nodes.filter((node) => node.type === "slateRecordGroup").length,
  0,
  "Records are never wrapped in a separate unnamed enclosure node.",
);
assert.equal(
  layoutCanvas(sizingDocument, sizingRecordSets).connectors.length,
  0,
  "A group needs no connector to its own records, because it already contains them.",
);
const sizingGraph = layoutCanvas(sizingDocument, sizingRecordSets);
for (const record of sizingGraph.nodes.filter((node) => node.type === "slateRecord")) {
  assert.ok(
    record.position.x >= sizingGroup.position.x
      && record.position.y >= sizingGroup.position.y
      && record.position.x + record.style.width <= sizingGroup.position.x + sizingGroup.style.width
      && record.position.y + record.style.height <= sizingGroup.position.y + sizingGroup.style.height,
    `${record.id} must sit inside its own group box`,
  );
}
assert.ok(
  sizingGraph.nodes.findIndex((node) => node.id === "sizing-group")
    < sizingGraph.nodes.findIndex((node) => node.id === "sizing-placement-1"),
  "A group box is emitted before the records it holds, so it paints behind them.",
);
const overlapping = shortCard.position.x < longCard.position.x + longCard.style.width
  && longCard.position.x < shortCard.position.x + shortCard.style.width
  && shortCard.position.y < longCard.position.y + longCard.style.height
  && longCard.position.y < shortCard.position.y + shortCard.style.height;
assert.equal(overlapping, false, "Packed cards must never overlap.");

// Spacing must open up at the top of the tree and tighten with depth, so major
// divisions read before detail.
const depthDocument = {
  schemaVersion: 1,
  id: "depth-canvas",
  title: "Depth canvas",
  mode: "readonly",
  recordSources: [{ id: "example-records", path: "data/example-records.json" }],
  groups: [
    { id: "r1", title: "Root one", tone: "aqua", order: 1 },
    { id: "r2", title: "Root two", tone: "blue", order: 2 },
    { id: "r1c1", title: "Child one", parentId: "r1", order: 1 },
    { id: "r1c2", title: "Child two", parentId: "r1", order: 2 },
  ],
  placements: [{ id: "depth-p1", groupId: "r1c1", recordRef: { sourceId: "example-records", recordId: "REC-01" } }],
};
assert.deepEqual(validateCanvasDocument(depthDocument, recordSets), []);
const depthGraph = layoutCanvas(depthDocument, recordSets);
const at = (id) => depthGraph.nodes.find((node) => node.id === id);
const rootGap = at("r2").position.y - (at("r1").position.y + at("r1").style.height);
const childGap = at("r1c2").position.y - (at("r1c1").position.y + at("r1c1").style.height);
assert.ok(rootGap > childGap, `Top-level branches must sit further apart than their children (${rootGap} vs ${childGap})`);
assert.ok(at("r1c1").position.x > at("r1").position.x, "Each level steps to the right of its parent.");
assert.equal(at("r1c1").position.x, at("r1c2").position.x, "Siblings share a column.");

// Collapsing hides a whole subtree and reports what it folded away, so the node can say
// what is behind it rather than looking like a leaf.
const collapsedGraph = layoutCanvas(depthDocument, recordSets, undefined, { collapsed: ["r1"] });
const collapsedRoot = collapsedGraph.nodes.find((node) => node.id === "r1");
assert.equal(collapsedRoot.data.collapsed, true, "A collapsed group reports that it is collapsed.");
assert.equal(collapsedRoot.data.hiddenAreas, 2, "A collapsed group reports the areas it folded away.");
assert.equal(collapsedRoot.data.hiddenRecords, 1, "A collapsed group reports the records it folded away.");
assert.ok(
  !collapsedGraph.nodes.some((node) => ["r1c1", "r1c2", "depth-p1"].includes(node.id)),
  "A collapsed subtree emits no nodes.",
);
assert.ok(
  collapsedGraph.nodes.some((node) => node.id === "r2"),
  "Collapsing one branch leaves its siblings alone.",
);
assert.ok(
  collapsedGraph.connectors.every((connector) => connector.from !== "r1"),
  "A collapsed group has no connectors leaving it.",
);
const expandedRoot = depthGraph.nodes.find((node) => node.id === "r1");
assert.equal(expandedRoot.data.collapsed, false, "An expanded group reports that it is expanded.");
assert.equal(expandedRoot.data.hasBranch, true, "A group with children advertises that it can be collapsed.");
assert.equal(
  depthGraph.nodes.find((node) => node.id === "r2").data.hasBranch,
  false,
  "A group with nothing beneath it offers no collapse affordance.",
);

const multiPerspectiveDocument = {
  ...document,
  groups: undefined,
  placements: undefined,
  presentation: undefined,
  defaultPerspectiveId: "by-view",
  perspectives: [
    { id: "by-view", title: "By view", groups: document.groups, placements: document.placements, presentation: document.presentation },
    { id: "by-owner", title: "By owner", groups: [{ id: "owner-product", title: "Product" }], placements: document.placements.map((placement, index) => ({ ...placement, id: `owner-placement-${index}`, groupId: "owner-product" })) },
  ],
};
delete multiPerspectiveDocument.groups;
delete multiPerspectiveDocument.placements;
delete multiPerspectiveDocument.presentation;
assert.deepEqual(validateCanvasDocument(multiPerspectiveDocument, recordSets), []);
assert.equal(canvasPerspectives(multiPerspectiveDocument).length, 2);
assert.equal(canvasPerspective(multiPerspectiveDocument, "by-owner").title, "By owner");
assert.equal(layoutCanvas(multiPerspectiveDocument, recordSets, "by-owner").nodes.length, 4, "Selected perspective should control layout nodes.");

const mutations = [
  ["duplicate records", { ...recordSet, records: [...recordSet.records, recordSet.records[0]] }, validateRecordSet, /duplicates REC-01/],
  ["editable mode", { ...document, mode: "local-draft" }, (value) => validateCanvasDocument(value, recordSets), /readonly only/],
  ["missing group", { ...document, placements: [{ ...document.placements[0], groupId: "missing" }] }, (value) => validateCanvasDocument(value, recordSets), /does not resolve: missing/],
  ["missing record", { ...document, placements: [{ ...document.placements[0], recordRef: { sourceId: "example-records", recordId: "missing" } }] }, (value) => validateCanvasDocument(value, recordSets), /does not resolve: missing/],
  ["unsafe source path", { ...document, recordSources: [{ id: "example-records", path: "../outside.json" }] }, (value) => validateCanvasDocument(value, recordSets), /normalized host-relative path/],
  ["group cycle", { ...document, groups: [{ id: "one", title: "One", parentId: "two" }, { id: "two", title: "Two", parentId: "one" }] }, (value) => validateCanvasDocument(value, recordSets), /containment cycle/],
  ["unknown default perspective", { ...multiPerspectiveDocument, defaultPerspectiveId: "missing" }, (value) => validateCanvasDocument(value, recordSets), /does not resolve: missing/],
  ["mixed perspective shapes", { ...document, defaultPerspectiveId: "by-view", perspectives: multiPerspectiveDocument.perspectives }, (value) => validateCanvasDocument(value, recordSets), /cannot be combined/],
];

for (const [name, value, validate, pattern] of mutations) {
  assert.match(validate(value).map((error) => `${error.path}: ${error.message}`).join("\n"), pattern, name);
}

const demoRecordSet = JSON.parse(fs.readFileSync(path.join(packageRoot, "demo", "structured-records.canvas.records.json"), "utf8"));
const demoDocument = JSON.parse(fs.readFileSync(path.join(packageRoot, "demo", "structured-information.canvas.json"), "utf8"));
const demoRecordSets = new Map([[demoRecordSet.id, demoRecordSet]]);
assert.deepEqual(validateRecordSet(demoRecordSet), [], "Generic demo Record Set must validate");
assert.deepEqual(validateCanvasDocument(demoDocument, demoRecordSets), [], "Generic demo Canvas Document must validate");
assert.equal(canvasPerspective(demoDocument, "by-stage").placements.filter((placement) => placement.recordRef.recordId === "DEMO-RECORD-02").length, 2, "Generic demo must prove repeated placements");
assert.equal(canvasPerspectives(demoDocument).length, 2, "Generic demo must prove perspective switching");

console.log(`Slate Canvas contract tests passed (${16 + mutations.length} cases).`);
// The canvas shell requests its bundle with a ?v= cache key. If that key stops tracking
// the package version, browsers keep running a cached bundle after an upgrade.
const canvasShellIndex = fs.readFileSync(path.join(packageRoot, "shell", "canvas", "index.html"), "utf8");
const slateVersion = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")).version;
assert.ok(canvasShellIndex.includes(`canvas.js?v=${slateVersion}`), "Built canvas shell must request canvas.js with the current package version");
assert.ok(canvasShellIndex.includes(`canvas.css?v=${slateVersion}`), "Built canvas shell must request canvas.css with the current package version");
assert.ok(!canvasShellIndex.includes("__SLATE_VERSION__"), "Built canvas shell must not ship the version placeholder");
