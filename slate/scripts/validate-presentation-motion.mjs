import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseFragment } from "parse5";

const SAFE_ID = /^[a-z][a-z0-9-]{0,63}$/;
const RECIPES = new Set(["fade-in", "fade-rise", "fade-left", "scale-in", "draw-stroke", "shape-pop", "bar-grow", "line-grow", "wipe-reveal", "spin-settle", "path-travel"]);
const TRANSITIONS = new Set(["cut", "crossfade-short", "shared-axis-x", "shared-axis-x-reverse"]);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function unknownKeys(value, allowed, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) errors.push(`${label} contains a forbidden key: ${key}`);
    else if (!allowed.has(key)) errors.push(`${label} contains an unknown field: ${key}`);
  }
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function attrs(node) {
  return new Map((node.attrs || []).map(attribute => [attribute.name, attribute.value]));
}

function nodeText(node) {
  return node.nodeName === "#text" ? node.value : (node.childNodes || []).map(nodeText).join("");
}

function meaningfulFragmentNode(node) {
  if (nodeText(node).trim()) return true;
  let meaningful = false;
  walk(node, child => {
    const attributes = attrs(child);
    const renderable = (child.tagName === "path" && !!attributes.get("d")?.trim())
      || (child.tagName === "line" && (attributes.get("x1") !== attributes.get("x2") || attributes.get("y1") !== attributes.get("y2")))
      || (["polyline", "polygon"].includes(child.tagName) && !!attributes.get("points")?.trim())
      || (child.tagName === "circle" && Number(attributes.get("r")) > 0)
      || (child.tagName === "ellipse" && Number(attributes.get("rx")) > 0 && Number(attributes.get("ry")) > 0)
      || (child.tagName === "rect" && Number(attributes.get("width")) > 0 && Number(attributes.get("height")) > 0)
      || new Set((attributes.get("class") || "").split(/\s+/)).has("slate-metric");
    if (renderable) meaningful = true;
  });
  return meaningful;
}

function collectPage(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const root = parseFragment(source);
  const slides = new Map();
  const duplicates = new Set();
  let idlessSlides = 0;
  let deckId = "";
  walk(root, node => {
    const attributes = attrs(node);
    const classes = new Set((attributes.get("class") || "").split(/\s+/).filter(Boolean));
    if (classes.has("slate-deck")) deckId = attributes.get("data-deck-id") || "";
    if (classes.has("slate-slide")) {
      const id = attributes.get("id") || attributes.get("data-slide-id");
      if (id) {
        if (slides.has(id)) duplicates.add(id);
        else slides.set(id, { node, targets: new Map(), fragments: new Map() });
      } else idlessSlides++;
    }
  });
  function scan(node, currentSlide, svgRoot = "", svgCounter = { value: 0 }, fragmentContext = "") {
    const attributes = attrs(node);
    const classes = new Set((attributes.get("class") || "").split(/\s+/).filter(Boolean));
    const nextSvgRoot = node.tagName === "svg" ? (attributes.get("id") || `svg-${++svgCounter.value}`) : svgRoot;
    const inSvg = !!nextSvgRoot;
    const currentFragment = attributes.get("data-motion-fragment") || fragmentContext;
    const targetId = attributes.get("data-motion-id") || attributes.get("id");
    if (targetId) {
      if (currentSlide.targets.has(targetId)) {
        currentSlide.duplicateTargetIds = currentSlide.duplicateTargetIds || new Set();
        currentSlide.duplicateTargetIds.add(targetId);
      }
      currentSlide.targets.set(targetId, {
        tagName: node.tagName || "",
        inSvg,
        svgRoot: nextSvgRoot,
        classes,
        pathData: attributes.get("d") || "",
        fragmentId: currentFragment,
        x1: Number(attributes.get("x1")),
        x2: Number(attributes.get("x2")),
        y1: Number(attributes.get("y1")),
        y2: Number(attributes.get("y2")),
        width: Number(attributes.get("width")),
        height: Number(attributes.get("height")),
        radius: Number(attributes.get("r")),
        radiusX: Number(attributes.get("rx")),
        radiusY: Number(attributes.get("ry")),
        points: attributes.get("points") || "",
      });
    }
    const fragment = attributes.get("data-motion-fragment");
    if (fragment) currentSlide.fragments.set(fragment, { meaningful: meaningfulFragmentNode(node) });
    const recipe = attributes.get("data-motion");
    if (recipe && !RECIPES.has(recipe)) currentSlide.invalidRecipe = recipe;
    for (const child of node.childNodes || []) {
      if (child !== currentSlide.node && new Set((attrs(child).get("class") || "").split(/\s+/)).has("slate-slide")) continue;
      scan(child, currentSlide, nextSvgRoot, svgCounter, currentFragment);
    }
  }
  for (const slide of slides.values()) scan(slide.node, slide);
  return { slides, duplicates, idlessSlides, deckId };
}

export function validatePresentationMotion({ pagePath, motionPath }) {
  const errors = [];
  let motion;
  try { motion = JSON.parse(fs.readFileSync(motionPath, "utf8")); }
  catch (error) { return [`Cannot parse motion manifest: ${error.message}`]; }
  if (motion?.version !== 1) errors.push("Motion manifest version must be 1");
  if (!SAFE_ID.test(motion?.deckId || "")) errors.push("deckId must be a stable lowercase ID");
  if (!motion?.slides || typeof motion.slides !== "object" || Array.isArray(motion.slides)) errors.push("slides must be an object");
  unknownKeys(motion, new Set(["version", "deckId", "authoringMode", "stage", "defaultRevisit", "slides", "transitions"]), "manifest", errors);
  if (!["generated", "retrofit"].includes(motion?.authoringMode)) errors.push("authoringMode must be generated or retrofit");
  if (motion?.stage != null) {
    unknownKeys(motion.stage, new Set(["width", "height"]), "stage", errors);
    for (const [field, min, max] of [["width", 800, 3840], ["height", 450, 2160]]) {
      if (!Number.isInteger(motion.stage?.[field]) || motion.stage[field] < min || motion.stage[field] > max) errors.push(`stage.${field} must be an integer from ${min} to ${max}`);
    }
  }
  if (motion?.defaultRevisit != null && !["restore", "start", "end"].includes(motion.defaultRevisit)) errors.push("defaultRevisit is invalid");
  const pageResult = collectPage(pagePath);
  const page = pageResult.slides;
  if (!pageResult.deckId || motion?.deckId !== pageResult.deckId) errors.push(`Motion deckId must match page data-deck-id: ${pageResult.deckId || "missing"}`);
  for (const id of pageResult.duplicates) errors.push(`Duplicate slide ID in page: ${id}`);
  if (motion?.authoringMode === "generated") {
    if (pageResult.idlessSlides) errors.push(`Generated deck contains ${pageResult.idlessSlides} slide(s) without stable IDs`);
    for (const slideId of page.keys()) {
      if (!Object.hasOwn(motion.slides || {}, slideId)) errors.push(`Generated deck is missing a motion plan for page slide: ${slideId}`);
    }
  }
  for (const [slideId, plan] of Object.entries(motion?.slides || {})) {
    if (!SAFE_ID.test(slideId)) errors.push(`Invalid slide ID: ${slideId}`);
    const slide = page.get(slideId);
    if (!slide) { errors.push(`Motion slide does not resolve in page: ${slideId}`); continue; }
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) { errors.push(`Slide plan must be an object: ${slideId}`); continue; }
    unknownKeys(plan, new Set(["claim", "blueprint", "visualMechanism", "reducedMotion", "durationMs", "revisit", "fragments", "targets", "fallback"]), `slide ${slideId}`, errors);
    if (motion.authoringMode === "generated") {
      if (typeof plan.claim !== "string" || plan.claim.trim().length < 8) errors.push(`Generated slide is missing a claim: ${slideId}`);
      if (!["relationship-reveal", "journey-handoff", "quantity-build", "system-assembly", "decision-shift", "custom"].includes(plan.blueprint)) errors.push(`Generated slide is missing a valid blueprint: ${slideId}`);
      if (typeof plan.visualMechanism !== "string" || plan.visualMechanism.trim().length < 8) errors.push(`Generated slide is missing a visual mechanism: ${slideId}`);
      if (typeof plan.reducedMotion !== "string" || plan.reducedMotion.trim().length < 8) errors.push(`Generated slide is missing reduced-motion behavior: ${slideId}`);
      if (!Array.isArray(plan.targets) || plan.targets.length === 0) errors.push(`Generated slide requires an explicit semantic motion target: ${slideId}`);
      if (!Array.isArray(plan.fragments) || plan.fragments.length === 0) errors.push(`Generated slide requires at least one meaningful presenter fragment: ${slideId}`);
    }
    if (plan.durationMs != null && (!Number.isInteger(plan.durationMs) || plan.durationMs < 1 || plan.durationMs > 60000)) errors.push(`Invalid durationMs on ${slideId}`);
    if (plan.revisit != null && !["restore", "start", "end"].includes(plan.revisit)) errors.push(`Invalid revisit on ${slideId}`);
    if (plan.fallback != null && !["start", "end"].includes(plan.fallback)) errors.push(`Invalid fallback on ${slideId}`);
    if (slide.invalidRecipe) errors.push(`Unknown authored recipe on ${slideId}: ${slide.invalidRecipe}`);
    for (const duplicateId of slide.duplicateTargetIds || []) errors.push(`Duplicate target ID in slide ${slideId}: ${duplicateId}`);
    const fragmentIds = new Set();
    let previousTime = -1;
    for (const fragment of plan.fragments || []) {
      const id = typeof fragment === "string" ? fragment : fragment?.id;
      const atMs = typeof fragment === "string" ? undefined : fragment?.atMs;
      if (!SAFE_ID.test(id || "")) errors.push(`Invalid fragment ID on ${slideId}: ${id}`);
      if (fragmentIds.has(id)) errors.push(`Duplicate fragment ID on ${slideId}: ${id}`);
      fragmentIds.add(id);
      if (!slide.fragments.has(id)) errors.push(`Fragment does not resolve in ${slideId}: ${id}`);
      else if (motion.authoringMode === "generated" && !slide.fragments.get(id).meaningful) errors.push(`Generated fragment has no meaningful content on ${slideId}: ${id}`);
      if (atMs != null && (!Number.isInteger(atMs) || atMs < previousTime || atMs > 60000)) errors.push(`Invalid fragment timing on ${slideId}: ${id}`);
      if (atMs != null) previousTime = atMs;
    }
    if (motion.authoringMode === "generated") {
      for (const domFragment of slide.fragments.keys()) {
        if (!fragmentIds.has(domFragment)) errors.push(`Generated slide has an unlisted DOM fragment on ${slideId}: ${domFragment}`);
      }
    }
    const targetIds = new Set();
    let semanticVisualTargets = 0;
    const actionTimings = new Map();
    const firstFragmentId = [...fragmentIds][0];
    for (const target of plan.targets || []) {
      unknownKeys(target, new Set(["id", "recipe", "startMs", "durationMs", "pathId", "fragmentId", "revealOffsetMs"]), `target on ${slideId}`, errors);
      if (!SAFE_ID.test(target?.id || "")) errors.push(`Invalid target ID on ${slideId}: ${target?.id}`);
      if (targetIds.has(target?.id)) errors.push(`Duplicate target ID on ${slideId}: ${target?.id}`);
      targetIds.add(target?.id);
      const targetElement = slide.targets.get(target?.id);
      if (!targetElement) errors.push(`Target does not resolve in ${slideId}: ${target?.id}`);
      if (!RECIPES.has(target?.recipe)) errors.push(`Unknown recipe on ${slideId}/${target?.id}: ${target?.recipe}`);
      const svgGeometry = targetElement?.inSvg && ["path", "line", "polyline", "polygon", "circle", "ellipse", "rect", "g"].includes(targetElement.tagName);
      const metric = targetElement?.classes?.has("slate-metric") || targetElement?.classes?.has("slate-metric__value");
      if (svgGeometry || metric) semanticVisualTargets++;
      if (["draw-stroke", "bar-grow", "line-grow", "shape-pop", "spin-settle", "path-travel"].includes(target?.recipe) && !svgGeometry && !metric) errors.push(`Recipe ${target?.recipe} requires an internal SVG/metric subject on ${slideId}/${target?.id}`);
      if (target?.recipe === "draw-stroke" && targetElement) {
        const measurable = (targetElement.tagName === "path" && !!targetElement.pathData.trim())
          || (targetElement.tagName === "line" && (targetElement.x1 !== targetElement.x2 || targetElement.y1 !== targetElement.y2))
          || (["polyline", "polygon"].includes(targetElement.tagName) && !!targetElement.points.trim())
          || (targetElement.tagName === "circle" && targetElement.radius > 0)
          || (targetElement.tagName === "ellipse" && targetElement.radiusX > 0 && targetElement.radiusY > 0)
          || (targetElement.tagName === "rect" && targetElement.width > 0 && targetElement.height > 0);
        if (!measurable) errors.push(`draw-stroke requires non-empty measurable SVG geometry on ${slideId}/${target?.id}`);
      }
      if (target?.recipe === "bar-grow" && targetElement && targetElement.tagName !== "rect") errors.push(`bar-grow requires an SVG rect on ${slideId}/${target?.id}`);
      if (target?.recipe === "line-grow" && targetElement && !["line", "rect"].includes(targetElement.tagName)) errors.push(`line-grow requires horizontal SVG line or rect geometry on ${slideId}/${target?.id}`);
      if (target?.recipe === "line-grow" && targetElement?.tagName === "line" && Math.abs(targetElement.x2 - targetElement.x1) < Math.abs(targetElement.y2 - targetElement.y1)) errors.push(`line-grow requires a horizontal SVG line on ${slideId}/${target?.id}`);
      if (target?.recipe === "line-grow" && targetElement?.tagName === "rect" && targetElement.width < targetElement.height) errors.push(`line-grow requires a horizontal SVG rect on ${slideId}/${target?.id}`);
      if (target?.recipe === "spin-settle" && targetElement && !["g", "path", "circle", "ellipse", "polygon"].includes(targetElement.tagName)) errors.push(`spin-settle requires compact radial SVG geometry on ${slideId}/${target?.id}`);
      if (target?.recipe === "path-travel" && targetElement && !["g", "circle", "ellipse", "path", "polygon"].includes(targetElement.tagName)) errors.push(`path-travel requires an SVG marker subject on ${slideId}/${target?.id}`);
      if (target?.recipe === "path-travel" && !target?.pathId) errors.push(`path-travel requires pathId on ${slideId}/${target?.id}`);
      if (target?.pathId != null) {
        const pathTarget = slide.targets.get(target.pathId);
        if (!SAFE_ID.test(target.pathId) || !pathTarget || pathTarget.tagName !== "path" || !pathTarget.inSvg || !pathTarget.pathData.trim() || pathTarget.svgRoot !== targetElement?.svgRoot) errors.push(`Path target must resolve to a non-empty SVG path in the same SVG on ${slideId}: ${target.pathId}`);
      }
      if (motion.authoringMode === "generated") {
        if (!target?.fragmentId || !fragmentIds.has(target.fragmentId)) errors.push(`Generated target must belong to a listed fragment on ${slideId}/${target?.id}`);
        else if (targetElement?.fragmentId !== target.fragmentId) errors.push(`Generated target fragment ownership does not match DOM on ${slideId}/${target?.id}`);
        if (target.fragmentId !== firstFragmentId && target.startMs != null) errors.push(`Later generated fragments must use revealOffsetMs instead of startMs on ${slideId}/${target?.id}`);
        const localOffset = target.fragmentId === firstFragmentId ? (target.startMs || 0) : (target.revealOffsetMs || 0);
        const duration = target.durationMs || 420;
        const timings = actionTimings.get(target.fragmentId) || [];
        timings.push({ offset: localOffset, end: localOffset + duration });
        actionTimings.set(target.fragmentId, timings);
      }
      if (target?.revealOffsetMs != null && (!Number.isInteger(target.revealOffsetMs) || target.revealOffsetMs < 0 || target.revealOffsetMs > 2000)) errors.push(`Invalid revealOffsetMs on ${slideId}/${target?.id}`);
      for (const [field, max] of [["startMs", 60000], ["durationMs", 5000]]) {
        if (target?.[field] != null && (!Number.isFinite(target[field]) || target[field] < (field === "durationMs" ? 1 : 0) || target[field] > max)) errors.push(`Invalid ${field} on ${slideId}/${target?.id}`);
      }
    }
    if (motion.authoringMode === "generated") {
      for (const [fragmentId, timings] of actionTimings) {
        const tail = Math.max(...timings.map(timing => timing.end));
        const staggerSpan = Math.max(...timings.map(timing => timing.offset)) - Math.min(...timings.map(timing => timing.offset));
        if (tail > 1200) errors.push(`Generated presenter action exceeds 1200ms on ${slideId}/${fragmentId}: ${tail}ms`);
        if (staggerSpan > 300) errors.push(`Generated presenter stagger exceeds 300ms on ${slideId}/${fragmentId}: ${staggerSpan}ms`);
        if (timings.length > 5) errors.push(`Generated presenter action has more than 5 independent targets on ${slideId}/${fragmentId}`);
      }
      if (fragmentIds.size > 5) errors.push(`Generated slide has more than 5 presenter fragments: ${slideId}`);
    }
    if (motion.authoringMode === "generated" && semanticVisualTargets === 0) errors.push(`Generated slide requires an internal semantic SVG/metric target: ${slideId}`);
  }
  for (const [name, transition] of Object.entries(motion?.transitions || {})) {
    if (!["forward", "backward", "jump"].includes(name)) errors.push(`Unknown transition field: ${name}`);
    if (!TRANSITIONS.has(transition)) errors.push(`Unknown ${name} transition: ${transition}`);
  }
  return errors;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--page") args.pagePath = argv[++index];
    else if (argv[index] === "--motion") args.motionPath = argv[++index];
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1)))) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.pagePath || !args.motionPath) {
    console.error("Usage: node validate-presentation-motion.mjs --page <deck.html> --motion <motion.json>");
    process.exit(2);
  }
  const errors = validatePresentationMotion({ pagePath: path.resolve(args.pagePath), motionPath: path.resolve(args.motionPath) });
  if (errors.length) {
    console.error(`Presentation motion validation failed (${errors.length}):\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Presentation motion validation passed.");
}
