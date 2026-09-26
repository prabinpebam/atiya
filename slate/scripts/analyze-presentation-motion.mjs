import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseFragment } from "parse5";

function attrs(node) { return new Map((node.attrs || []).map(attribute => [attribute.name, attribute.value])); }
function classes(node) { return new Set((attrs(node).get("class") || "").split(/\s+/).filter(Boolean)); }
function text(node) { return node.nodeName === "#text" ? node.value : (node.childNodes || []).map(text).join(""); }
function descendants(node, predicate, output = []) { for (const child of node.childNodes || []) { if (predicate(child)) output.push(child); descendants(child, predicate, output); } return output; }

function analyzeSlide(slide, index, motion) {
  const attributes = attrs(slide);
  const id = attributes.get("id") || attributes.get("data-slide-id") || `slide-${index + 1}`;
  const heading = descendants(slide, node => node.tagName === "h2")[0];
  const cards = descendants(slide, node => classes(node).has("slate-card"));
  const figures = descendants(slide, node => classes(node).has("slate-slide__figure"));
  const metrics = descendants(slide, node => classes(node).has("slate-metric"));
  const explicit = descendants(slide, node => attrs(node).has("data-motion"));
  const title = text(heading).replace(/#/g, "").trim();
  const normalized = title.toLowerCase();
  const suggestions = [];
  const semanticVisual = figures.length > 0 || metrics.length > 0;
  let mechanism;
  if (/intersect|overlap|relationship|together|connect/.test(normalized)) mechanism = { family: "relationship", generate: "Venn, linked-node, orbit, or nested-region SVG", proof: "draw connectors or merge persistent subjects" };
  else if (/journey|path|sequence|process|flow|then|route|handoff/.test(normalized)) mechanism = { family: "process", generate: "path, milestone, state-machine, or staged-flow SVG", proof: "draw route, travel marker, and pop milestones" };
  else if (/more|less|increase|decrease|value|number|metric|cost|time/.test(normalized)) mechanism = { family: "quantity", generate: "bar, slope, dot-plot, or proportional-shape SVG", proof: "grow from baseline and reveal labels after values" };
  else if (/versus|instead|tradeoff|choice|priority|decision/.test(normalized)) mechanism = { family: "decision", generate: "split field, balance, or two-axis decision SVG", proof: "move evidence toward the decision boundary" };
  else if (/system|structure|pillar|asset|need|group/.test(normalized)) mechanism = { family: "system", generate: "hub, layered architecture, or hierarchy SVG", proof: "assemble parent/child structure in reading order" };

  if (!semanticVisual && mechanism) suggestions.push({ severity: "redesign", subject: "missing semantic visual", purpose: `make the ${mechanism.family} claim visible`, generate: mechanism.generate, motionProof: mechanism.proof });
  if (!semanticVisual && cards.length > 1) suggestions.push({ severity: "review", subject: `${cards.length} parallel cards`, purpose: "verify the card set itself is the argument; otherwise replace it with a bespoke SVG mechanism" });
  if (figures.length) suggestions.push({ severity: "animate", subject: "dominant figure", purpose: "animate internal paths/nodes/layers, not only the figure container", recipes: ["draw-stroke", "shape-pop", "line-grow", "path-travel"] });
  if (metrics.length > 1) suggestions.push({ severity: "animate", subject: `${metrics.length} metrics`, purpose: "grow quantities from a shared baseline and emphasize the final comparison", recipes: ["bar-grow", "shape-pop"] });
  suggestions.push({ severity: "support", subject: "slide title", purpose: "establish hierarchy only", recipe: "fade-in" });
  const manifestTargets = motion?.slides?.[id]?.targets || [];
  const explicitTargetCount = new Set([...explicit.map(node => attrs(node).get("id") || attrs(node).get("data-motion-id")).filter(Boolean), ...manifestTargets.map(target => target.id)]).size;
  return {
    slideId: id,
    title,
    recommendedAuthoringMode: semanticVisual && explicitTargetCount ? "generated" : "redesign-before-motion",
    motionThesis: {
      claim: title,
      visualMechanism: mechanism?.generate || "Name the bespoke visual that makes this claim visible",
      subjectIdentity: "Name the persistent visual subjects",
      states: "initial -> proof state(s) -> final hold",
      presenterControl: "Name the meaningful fragment holds",
      reducedMotion: "Describe the complete immediate state",
    },
    hasSemanticVisual: semanticVisual,
    explicitTargets: explicitTargetCount,
    suggestions,
  };
}

export function analyzePresentationMotion(pagePath, motionPath) {
  const root = parseFragment(fs.readFileSync(pagePath, "utf8"));
  const slides = descendants(root, node => classes(node).has("slate-slide"));
  const motion = motionPath ? JSON.parse(fs.readFileSync(motionPath, "utf8")) : null;
  return {
    version: 1,
    page: path.basename(pagePath),
    principle: "Motion is optional and must communicate hierarchy, causality, sequence, continuity, comparison, or focus.",
    authoringMode: motion?.authoringMode || "unknown",
    slides: slides.map((slide, index) => analyzeSlide(slide, index, motion)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1)))) {
  const pageIndex = process.argv.indexOf("--page");
  if (pageIndex < 0 || !process.argv[pageIndex + 1]) { console.error("Usage: node analyze-presentation-motion.mjs --page <deck.html>"); process.exit(2); }
  const motionIndex = process.argv.indexOf("--motion");
  const motionPath = motionIndex >= 0 && process.argv[motionIndex + 1] ? path.resolve(process.argv[motionIndex + 1]) : undefined;
  console.log(JSON.stringify(analyzePresentationMotion(path.resolve(process.argv[pageIndex + 1]), motionPath), null, 2));
}
