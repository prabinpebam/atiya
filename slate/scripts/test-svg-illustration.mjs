import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFragment } from "parse5";

const slateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(slateRoot, "visualization", "skills", "svg-illustration");
const validator = path.join(skillRoot, "scripts", "validate_svg.py");
const themeValidator = path.join(skillRoot, "scripts", "validate_theme.py");
const starter = path.join(skillRoot, "assets", "starter-slate-inline.svg");
const theme = path.join(skillRoot, "assets", "theme-template.json");
const validateOnly = process.argv.includes("--validate-only");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slate-svg-illustration-"));

function runPython(script, args, expectedStatus = 0) {
  const result = spawnSync("python", [script, ...args], { encoding: "utf8" });
  assert.equal(
    result.status,
    expectedStatus,
    `python ${path.basename(script)} ${args.join(" ")} returned ${result.status}\n${result.stdout}\n${result.stderr}`,
  );
  return `${result.stdout}${result.stderr}`;
}

function markdownFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return markdownFiles(entryPath);
    return entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value || "";
}

function descendants(node, tagName, ancestors = [], matches = []) {
  for (const child of node.childNodes || []) {
    if (child.tagName === tagName) matches.push({ node: child, ancestors });
    descendants(child, tagName, [...ancestors, child], matches);
  }
  return matches;
}

try {
  assert.equal(fs.existsSync(validator), true);
  assert.equal(fs.existsSync(themeValidator), true);
  assert.match(runPython(validator, [starter, "--profile", "slate-inline", "--accessibility", "complex"]), /PASS:/);
  assert.match(runPython(validator, [starter, "--profile", "slate-motion-subject", "--accessibility", "complex"]), /PASS:/);
  assert.match(runPython(themeValidator, [theme]), /PASS:/);

  const viewportMotion = path.join(temporaryRoot, "viewport-motion.svg");
  fs.writeFileSync(viewportMotion, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-labelledby="title desc" data-slate-svg-motion="viewport"><title id="title">Viewport motion</title><desc id="desc">One semantic subject enters.</desc><g id="subject" data-slate-svg-step="1"><circle cx="5" cy="5" r="4"/></g></svg>`);
  assert.match(runPython(validator, [viewportMotion, "--profile", "slate-viewport-motion", "--accessibility", "complex"]), /PASS:/);

  const skillEntry = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  const productionReference = fs.readFileSync(path.join(skillRoot, "references", "production-and-embedding.md"), "utf8");
  const motionReference = fs.readFileSync(path.join(skillRoot, "references", "motion-and-animation.md"), "utf8");
  const themeReference = fs.readFileSync(path.join(skillRoot, "references", "theme-contract.md"), "utf8");
  const compositionReference = fs.readFileSync(path.join(skillRoot, "references", "composition-and-layout.md"), "utf8");
  const accessibilityReference = fs.readFileSync(path.join(skillRoot, "references", "accessibility-and-validation.md"), "utf8");
  const routingReference = fs.readFileSync(path.join(skillRoot, "references", "visual-routing.md"), "utf8");
  const dataReference = fs.readFileSync(path.join(skillRoot, "references", "data-visualization.md"), "utf8");
  const techniqueReference = fs.readFileSync(path.join(skillRoot, "references", "illustration-techniques.md"), "utf8");
  const researchReference = fs.readFileSync(path.join(skillRoot, "references", "research-sources.md"), "utf8");
  const shellRuntime = fs.readFileSync(path.join(slateRoot, "shell", "slate.js"), "utf8");
  const shellStyles = fs.readFileSync(path.join(slateRoot, "shell", "slate.css"), "utf8");
  const demo = fs.readFileSync(path.join(slateRoot, "demo", "svg-illustration.html"), "utf8");
  for (const markdownFile of markdownFiles(skillRoot)) {
    const markdown = fs.readFileSync(markdownFile, "utf8");
    for (const match of markdown.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(match[1])) continue;
      const target = path.resolve(path.dirname(markdownFile), decodeURIComponent(match[1]));
      assert.equal(
        fs.existsSync(target),
        true,
        `Missing SVG skill reference in ${path.relative(skillRoot, markdownFile)}: ${match[1]}`,
      );
    }
  }
  assert.doesNotMatch(skillEntry, /docs-inline|docs-animated|web-inline|starter-docs-inline/);
  assert.match(skillEntry, /`slate-viewport-motion`/);
  assert.match(productionReference, /30% viewport/);
  assert.match(motionReference, /hover, keyboard focus, and touch/);
  assert.match(themeReference, /light, dark, and each applicable host color theme/);
  assert.match(compositionReference, /data-slate-fit-target/);
  assert.match(compositionReference, /data-slate-connector-from/);
  assert.match(compositionReference, /Stroke caps change the visible endpoint/);
  assert.match(compositionReference, /Choose exactly one library per SVG/);
  assert.match(skillEntry, /Three-box collision model/);
  assert.match(skillEntry, /Run a \*\*semantic icon pass\*\*/);
  assert.match(skillEntry, /Do not use a generic dot, circle, sparkle, initial/);
  assert.match(skillEntry, /Normal\s+labels must remain at least `14px`/);
  assert.match(skillEntry, /data-slate-mobile-view-box/);
  assert.match(skillEntry, /Do not add a `rect`, `path`, or other stroke that traces the viewBox/);
  assert.match(skillEntry, /m = max\(24, 3u, 0\.04 \* min\(W, H\)\)/);
  assert.match(accessibilityReference, /pairwise inflated-bounds checks/);
  assert.match(routingReference, /decision tree|routing/i);
  assert.match(dataReference, /uncertainty|baseline/i);
  assert.match(techniqueReference, /silhouette|perspective/i);
  assert.match(productionReference, /standalone/);
  assert.match(productionReference, /office/);
  assert.match(productionReference, /print/);
  assert.match(motionReference, /Entry animation/);
  assert.match(motionReference, /Highlight animation/);
  assert.match(motionReference, /Loop animation/);
  assert.match(motionReference, /CSS keyframes/);
  assert.match(motionReference, /Web Animations API/);
  assert.match(motionReference, /SMIL/);
  assert.match(themeReference, /Light Mode Design/);
  assert.match(themeReference, /Dark Mode Design/);
  assert.match(researchReference, /MDN|W3C/);
  assert.match(shellRuntime, /IntersectionObserver/);
  assert.match(shellRuntime, /prefers-reduced-motion: reduce/);
  assert.match(shellRuntime, /Replay illustration animation/);
  assert.match(shellRuntime, /--color-on-brand/);
  assert.match(shellRuntime, /\.slate-slide__figure > svg/);
  assert.match(shellRuntime, /SlatePresentation\.restart/);
  assert.match(shellRuntime, /slateMobileViewBox/);
  assert.match(shellRuntime, /slateActiveSafeMargin/);
  assert.match(shellStyles, /\.slate-svg-motion:has\(> svg:hover\) \.slate-figure__replay/);
  assert.match(shellStyles, /svg text:not\(\[fill\]\)/);
  assert.match(
    shellStyles,
    /\.slate-figure > svg \{[^}]*background: transparent;[^}]*border: 0;[^}]*border-radius: 0;/,
  );
  assert.doesNotMatch(shellStyles, /\.slate-figure--wide > svg \{[^}]*width: 820px/);
  assert.match(shellStyles, /data-slate-layout-group="mobile"/);
  assert.match(demo, /data-slate-svg-motion="viewport"/);
  assert.match(demo, /data-slate-svg-effect="draw"/);

  for (const pageName of ["click-to-do.html", "svg-illustration.html", "generated-motion.html", "presentation-motion.html"]) {
    const source = fs.readFileSync(path.join(slateRoot, "demo", pageName), "utf8");
    const svgs = descendants(parseFragment(source), "svg");
    assert.ok(svgs.length > 0, `${pageName} must exercise SVG illustration`);
    for (const { node, ancestors } of svgs) {
      const inDeckFigure = ancestors.some((ancestor) => {
        const classes = attribute(ancestor, "class").split(/\s+/);
        return classes.includes("slate-slide__figure") || classes.includes("slate-card__figure");
      });
      assert.ok(
        inDeckFigure || attribute(node, "data-slate-svg-motion") === "viewport",
        `${pageName} contains a content SVG outside Slate viewport or presentation motion`,
      );
    }
  }

  if (!validateOnly) {
    const unsafe = path.join(temporaryRoot, "unsafe.svg");
    fs.writeFileSync(unsafe, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img"><title>Unsafe</title><style>circle{fill:red}</style><circle cx="5" cy="5" r="4"/></svg>`);
    assert.match(runPython(validator, [unsafe, "--profile", "slate-inline"], 1), /<style> is not allowed/);

    const noSubjects = path.join(temporaryRoot, "no-subjects.svg");
    fs.writeFileSync(noSubjects, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-labelledby="t"><title id="t">No subjects</title><circle cx="5" cy="5" r="4"/></svg>`);
    assert.match(runPython(validator, [noSubjects, "--profile", "slate-motion-subject"], 1), /stable semantic subject ID/);
    assert.match(runPython(validator, [noSubjects, "--profile", "slate-viewport-motion"], 1), /data-slate-svg-motion.*data-slate-svg-step/s);

    const external = path.join(temporaryRoot, "external.svg");
    fs.writeFileSync(external, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img"><title>External</title><image href="https://example.com/a.png"/></svg>`);
    assert.match(runPython(validator, [external, "--profile", "slate-asset"], 1), /external resource is not self-contained/);

    const invalidGeometry = path.join(temporaryRoot, "invalid-geometry.svg");
    fs.writeFileSync(invalidGeometry, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title"><title id="title">Invalid geometry metadata</title><rect id="body" x="10" y="10" width="30" height="30"/><text x="20" y="20" data-slate-fit-target="missing" data-slate-fit-padding="-2">Overflow</text><path d="M40 25 H80" data-slate-connector-from="body" data-slate-connector-to="ghost" data-slate-connector-anchor="center"/></svg>`);
    const geometryFailure = runPython(validator, [invalidGeometry, "--profile", "slate-inline"], 1);
    assert.match(geometryFailure, /text fit target does not exist: #missing/);
    assert.match(geometryFailure, /requires an explicit text-anchor/);
    assert.match(geometryFailure, /data-slate-fit-padding must be one non-negative number/);
    assert.match(geometryFailure, /connector target does not exist: #ghost/);
    assert.match(geometryFailure, /must be "boundary" or "port"/);

    const invalidContrastRole = path.join(temporaryRoot, "invalid-contrast-role.svg");
    fs.writeFileSync(invalidContrastRole, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="contrast-title"><title id="contrast-title">Invalid contrast role</title><rect id="brand-body" x="10" y="10" width="80" height="80" fill="var(--color-brand-bg)"/><text x="50" y="55" text-anchor="middle" data-slate-fit-target="brand-body" fill="var(--color-neutral-fg-1)">Wrong role</text></svg>`);
    assert.match(
      runPython(validator, [invalidContrastRole, "--profile", "slate-inline"], 1),
      /must use an allowed on-surface role: var\(--color-on-brand\)/,
    );

    const invalidFrameAndIcons = path.join(temporaryRoot, "invalid-frame-and-icons.svg");
    fs.writeFileSync(invalidFrameAndIcons, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="frame-title" data-slate-safe-margin="3"><title id="frame-title">Invalid frame and icons</title><rect x="0" y="0" width="100" height="100" fill="none" stroke="black"/><g data-slate-icon-source="fluent" data-slate-icon-name="checkmark-regular-24"><path d="M10 10h10"/></g><g data-slate-icon-source="font-awesome" data-slate-icon-name="circle-check"><path d="M20 20h10"/></g></svg>`);
    const frameAndIconFailure = runPython(validator, [invalidFrameAndIcons, "--profile", "slate-inline"], 1);
    assert.match(frameAndIconFailure, /data-slate-safe-margin must be at least 24/);
    assert.match(frameAndIconFailure, /decorative rectangle must not trace the SVG viewBox border/);
    assert.match(frameAndIconFailure, /one SVG must not mix icon sources/);

    const incompleteIcon = path.join(temporaryRoot, "incomplete-icon.svg");
    fs.writeFileSync(incompleteIcon, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="icon-title"><title id="icon-title">Incomplete icon provenance</title><g data-slate-icon-source="fluent"><path d="M10 10h10"/></g></svg>`);
    assert.match(
      runPython(validator, [incompleteIcon, "--profile", "slate-inline"], 1),
      /icon provenance requires both data-slate-icon-source and data-slate-icon-name/,
    );

    const invalidResponsive = path.join(temporaryRoot, "invalid-responsive.svg");
    fs.writeFileSync(invalidResponsive, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="responsive-title" data-slate-mobile-view-box="0 0 360 600"><title id="responsive-title">Invalid responsive metadata</title><g data-slate-layout-group="desktop"><circle cx="50" cy="50" r="20"/></g></svg>`);
    const responsiveFailure = runPython(validator, [invalidResponsive, "--profile", "slate-inline"], 1);
    assert.match(responsiveFailure, /requires both data-slate-mobile-view-box and data-slate-mobile-safe-margin/);
    assert.match(responsiveFailure, /requires exactly one desktop and one mobile layout group/);
  }

  console.log(`Slate SVG illustration ${validateOnly ? "validation" : "tests"} passed.`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
