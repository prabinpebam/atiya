import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validatePresentationMotion } from "./validate-presentation-motion.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "slate-presentation-motion-"));
const pagePath = path.join(root, "deck.html");
const motionPath = path.join(root, "deck.motion.json");

const page = `<div class="slate-deck" data-deck-id="demo-deck"><section class="slate-slide" id="hook"><h2>Hook</h2><div id="hero" data-motion="scale-in"></div><p data-motion-fragment="proof">Proof</p></section></div>`;
const valid = { version: 1, deckId: "demo-deck", authoringMode: "retrofit", slides: { hook: { fragments: [{ id: "proof", atMs: 500 }], targets: [{ id: "hero", recipe: "scale-in", startMs: 0, durationMs: 400 }] } }, transitions: { forward: "shared-axis-x" } };

function validate(value = valid, html = page) {
  fs.writeFileSync(pagePath, html);
  fs.writeFileSync(motionPath, JSON.stringify(value));
  return validatePresentationMotion({ pagePath, motionPath });
}

try {
  assert.deepEqual(validate(), []);
  assert.ok(validate({ ...valid, version: 2 }).some(error => error.includes("version")));
  assert.ok(validate({ ...valid, slides: { missing: {} } }).some(error => error.includes("does not resolve")));
  assert.ok(validate({ ...valid, slides: { hook: { fragments: ["missing"] } } }).some(error => error.includes("Fragment does not resolve")));
  assert.ok(validate({ ...valid, slides: { hook: { targets: [{ id: "missing", recipe: "fade-in" }] } } }).some(error => error.includes("Target does not resolve")));
  assert.ok(validate({ ...valid, slides: { hook: { targets: [{ id: "hero", recipe: "unknown" }] } } }).some(error => error.includes("Unknown recipe")));
  assert.ok(validate(valid, page.replace('data-motion="scale-in"', 'data-motion="unknown"')).some(error => error.includes("Unknown authored recipe")));
  assert.ok(validate({ ...valid, transitions: { forward: "spin-world" } }).some(error => error.includes("Unknown forward transition")));
  assert.ok(validate({ ...valid, slides: { hook: null } }).some(error => error.includes("Slide plan must be an object")));
  assert.ok(validate(valid, `${page}<section class="slate-slide" id="hook"><h2>Duplicate</h2></section>`).some(error => error.includes("Duplicate slide ID")));
  assert.ok(validate({ ...valid, surprise: true }).some(error => error.includes("unknown field")));
  assert.ok(validate({ ...valid, stage: { width: 200, height: 100 } }).some(error => error.includes("stage.width")));
  assert.ok(validate({ ...valid, defaultRevisit: "loop" }).some(error => error.includes("defaultRevisit")));
  const pathPage = page.replace('<div id="hero" data-motion="scale-in"></div>', '<svg><path id="journey-path" d="M0 0 C20 10 40 30 60 20"></path><circle id="journey-marker" data-motion-fragment="proof"></circle></svg>');
  const pathMotion = { ...valid, slides: { hook: { targets: [{ id: "journey-marker", recipe: "path-travel", pathId: "journey-path", durationMs: 700 }] } } };
  assert.deepEqual(validate(pathMotion, pathPage), []);
  assert.ok(validate({ ...pathMotion, slides: { hook: { targets: [{ id: "journey-marker", recipe: "path-travel", pathId: "missing" }] } } }, pathPage).some(error => error.includes("Path target must resolve to a non-empty SVG path in the same SVG")));
  const generated = { ...valid, authoringMode: "generated", slides: { hook: { claim: "The marker completes the customer journey", blueprint: "journey-handoff", visualMechanism: "A route, marker, and final milestone", reducedMotion: "Show the complete route and final marker", fragments: [{ id: "proof", atMs: 500 }], targets: [{ id: "journey-marker", recipe: "path-travel", pathId: "journey-path", fragmentId: "proof" }] } } };
  assert.deepEqual(validate(generated, pathPage), []);
  assert.ok(validate({ ...generated, slides: { hook: { targets: [{ id: "journey-marker", recipe: "shape-pop", fragmentId: "proof" }] } } }, pathPage).some(error => error.includes("missing a claim")));
  assert.ok(validate({ ...generated, slides: { hook: { claim: "A valid claim", blueprint: "journey-handoff", visualMechanism: "A valid visual", reducedMotion: "A valid fallback", fragments: [{ id: "proof" }], targets: [] } } }, pathPage).some(error => error.includes("requires an explicit semantic motion target")));
  assert.ok(validate({ ...generated, slides: {} }, pathPage).some(error => error.includes("missing a motion plan for page slide")));
  assert.ok(validate({ ...generated, slides: { hook: { claim: "A valid claim", blueprint: "custom", visualMechanism: "A generic container", reducedMotion: "Show the final container", targets: [{ id: "hero", recipe: "fade-in" }] } } }).some(error => error.includes("internal semantic SVG/metric target")));
  assert.ok(validate(generated, pathPage.replace('id="hook"', '')).some(error => error.includes("slide(s) without stable IDs")));
  assert.ok(validate(generated, pathPage.replace('data-motion-fragment="proof"', 'data-motion-fragment="proof"></circle><g data-motion-fragment="empty"')).some(error => error.includes("unlisted DOM fragment") || error.includes("no meaningful content")));
  assert.ok(validate({ ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ id: "journey-marker", recipe: "bar-grow" }] } } }, pathPage).some(error => error.includes("bar-grow requires an SVG rect")));
  const outsideTargetPage = `${pathPage}<svg><circle id="outside-target"></circle></svg>`;
  assert.ok(validate({ ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ id: "outside-target", recipe: "shape-pop" }] } } }, outsideTargetPage).some(error => error.includes("Target does not resolve")));
  const duplicateTargetPage = pathPage.replace('</svg>', '<circle id="journey-marker"></circle></svg>');
  assert.ok(validate(generated, duplicateTargetPage).some(error => error.includes("Duplicate target ID")));
  const crossSvgPage = pathPage.replace('</svg>', '</svg><svg><circle id="other-marker" data-motion-fragment="proof"></circle>');
  const crossSvgMotion = { ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ id: "other-marker", recipe: "path-travel", pathId: "journey-path", fragmentId: "proof" }] } } };
  assert.ok(validate(crossSvgMotion, crossSvgPage).some(error => error.includes("same SVG")));
  const verticalLinePage = pathPage.replace('</svg>', '<line id="vertical-line" data-motion-fragment="proof" x1="10" y1="0" x2="10" y2="80"></line></svg>');
  const verticalLineMotion = { ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ id: "vertical-line", recipe: "line-grow", fragmentId: "proof" }] } } };
  assert.ok(validate(verticalLineMotion, verticalLinePage).some(error => error.includes("horizontal SVG line")));
  assert.ok(validate({ ...generated, deckId: "wrong-deck" }, pathPage).some(error => error.includes("deckId must match page")));
  const outsideFragmentMotion = { ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ id: "journey-path", recipe: "draw-stroke", fragmentId: "proof" }] } } };
  assert.ok(validate(outsideFragmentMotion, pathPage).some(error => error.includes("fragment ownership does not match DOM")));
  const badOffsetMotion = { ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ ...generated.slides.hook.targets[0], revealOffsetMs: -1 }] } } };
  assert.ok(validate(badOffsetMotion, pathPage).some(error => error.includes("Invalid revealOffsetMs")));
  const emptyPathPage = pathPage.replace('d="M0 0 C20 10 40 30 60 20"', 'd=""');
  const emptyDrawMotion = { ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ id: "journey-path", recipe: "draw-stroke", fragmentId: "proof" }] } } };
  assert.ok(validate(emptyDrawMotion, emptyPathPage).some(error => error.includes("non-empty measurable SVG geometry")));
  const longActionMotion = { ...generated, slides: { hook: { ...generated.slides.hook, targets: [{ ...generated.slides.hook.targets[0], durationMs: 1300 }] } } };
  assert.ok(validate(longActionMotion, pathPage).some(error => error.includes("exceeds 1200ms")));
  const secondFragmentPage = pathPage.replace('</svg>', '<circle id="second-marker" data-motion-fragment="second" r="10"></circle></svg>');
  const globalLaterMotion = { ...generated, slides: { hook: { ...generated.slides.hook, fragments: [{ id: "proof" }, { id: "second" }], targets: [{ id: "second-marker", recipe: "shape-pop", fragmentId: "second", startMs: 400 }] } } };
  assert.ok(validate(globalLaterMotion, secondFragmentPage).some(error => error.includes("must use revealOffsetMs instead of startMs")));
  const packageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1))), "..");
  const generatedPage = path.join(packageRoot, "demo", "generated-motion.html");
  const generatedMotion = path.join(packageRoot, "demo", "generated-motion.json");
  assert.deepEqual(validatePresentationMotion({ pagePath: generatedPage, motionPath: generatedMotion }), []);
  const generatedReference = JSON.parse(fs.readFileSync(generatedMotion, "utf8"));
  assert.equal(generatedReference.authoringMode, "generated");
  for (const [slideId, plan] of Object.entries(generatedReference.slides)) {
    assert.ok(plan.claim && plan.blueprint && plan.visualMechanism && plan.reducedMotion, `Missing creative intent on ${slideId}`);
    assert.ok(plan.targets.length > 0, `Missing explicit motion targets on ${slideId}`);
  }
  console.log("Presentation motion mutation tests passed (35 cases). Generated proof validated.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
