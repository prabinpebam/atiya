import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseFragment } from "parse5";

const REQUIRED_ATTRIBUTES = [
  "data-xref-href",
  "data-xref-source",
  "data-xref-claim-source",
  "data-xref-evidence-source",
];

function attributes(node) {
  return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function findByClass(node, className) {
  let match;
  walk(node, (candidate) => {
    if (match) return;
    const classNames = (attributes(candidate).class || "").split(/\s+/);
    if (classNames.includes(className)) match = candidate;
  });
  return match;
}

function textContent(node, excludedClasses = new Set()) {
  if (node.nodeName === "#text") return node.value;
  const classNames = new Set((attributes(node).class || "").split(/\s+/).filter(Boolean));
  if ([...classNames].some((className) => excludedClasses.has(className))) return "";
  return (node.childNodes || []).map((child) => textContent(child, excludedClasses)).join(" ");
}

function normalizeText(value) {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function splitLocator(locator) {
  const hashIndex = locator.indexOf("#");
  return hashIndex < 0
    ? { file: locator, anchor: "" }
    : { file: locator.slice(0, hashIndex), anchor: locator.slice(hashIndex + 1) };
}

function resolvePublishedTarget(referrer, href) {
  const { file, anchor } = splitLocator(href);
  return {
    file: path.posix.normalize(path.posix.join(path.posix.dirname(referrer), file)),
    anchor,
  };
}

function htmlDetails(content) {
  const document = parseFragment(content);
  const headings = new Set();
  const sections = new Map();
  const sectionStack = [];
  const xrefs = [];

  function visit(node, excluded = false) {
    const attrs = attributes(node);
    const classNames = (attrs.class || "").split(/\s+/);
    const excludesText = excluded || classNames.includes("slate-xref__excerpt");
    if (/^h[1-6]$/.test(node.nodeName)) {
      const anchor = attrs.id || slug(textContent(node, new Set([
        "slate-xref",
        "slate-badge",
        "heading-anchor",
        "collapse-toggle",
      ])));
      const level = Number(node.nodeName.slice(1));
      while (sectionStack.length && sectionStack.at(-1).level >= level) sectionStack.pop();
      sections.set(anchor, "");
      sectionStack.push({ anchor, level });
      headings.add(anchor);
    }
    if (classNames.includes("slate-xref") && !attrs["data-xref-ready"]) xrefs.push(node);
    if (node.nodeName === "#text" && !excludesText) {
      for (const section of sectionStack) sections.set(section.anchor, `${sections.get(section.anchor)} ${node.value}`);
    }
    for (const child of node.childNodes || []) visit(child, excludesText);
  }

  visit(document);
  for (const [anchor, text] of sections) sections.set(anchor, normalizeText(text));
  return {
    headings,
    sections,
    xrefs,
    text: normalizeText(textContent(document, new Set(["slate-xref__excerpt"]))),
  };
}

function markdownDetails(content) {
  const headings = new Set();
  const sections = new Map();
  const sectionStack = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (match) {
      const level = match[0].match(/^#+/)[0].length;
      const anchor = slug(match[1]);
      while (sectionStack.length && sectionStack.at(-1).level >= level) sectionStack.pop();
      sections.set(anchor, "");
      sectionStack.push({ anchor, level });
      headings.add(anchor);
      continue;
    }
    for (const section of sectionStack) sections.set(section.anchor, `${sections.get(section.anchor)} ${line}`);
  }
  const markdownText = (value) => normalizeText(value
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/!?(\[([^\]]+)\])\([^)]*\)/g, "$2")
    .replace(/[`*_>#|~]/g, " "));
  for (const [anchor, sectionText] of sections) sections.set(anchor, markdownText(sectionText));
  return { headings, sections, text: markdownText(content) };
}

function sourceDetails(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return /\.html?$/i.test(filePath) ? htmlDetails(content) : markdownDetails(content);
}

function validateLocator(repoRoot, locator, label, excerpt, errors) {
  const { file, anchor } = splitLocator(locator);
  const absoluteRoot = path.resolve(repoRoot);
  const absolutePath = path.resolve(absoluteRoot, file);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`) || !fs.existsSync(absolutePath)) {
    errors.push(`${label} does not exist: ${locator}`);
    return;
  }
  if (!anchor) {
    errors.push(`${label} must identify an exact section: ${locator}`);
    return;
  }
  const details = sourceDetails(absolutePath);
  if (!details.headings.has(anchor)) errors.push(`${label} anchor does not exist: ${locator}`);
  const evidenceText = details.sections.get(anchor) || "";
  if (label === "Evidence source" && excerpt && !evidenceText.includes(excerpt)) {
    errors.push(`${label} does not contain the authored excerpt: ${locator}`);
  }
}

export function validateDocumentAttributions(repoRoot = process.cwd(), host = "docs") {
  const docsRoot = path.resolve(repoRoot, host);
  const manifestPath = path.join(docsRoot, "docs-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entries = Array.isArray(manifest) ? manifest : manifest.entries;
  const routes = new Set(entries
    .filter((entry) => !["divider", "external", "link"].includes(entry.type))
    .map((entry) => entry.path));
  const pages = new Map();
  const errors = [];
  let attributionCount = 0;

  for (const route of routes) {
    const filePath = path.resolve(docsRoot, ...route.split("/"));
    if (!filePath.startsWith(`${docsRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      errors.push(`Manifest route does not exist: ${route}`);
      continue;
    }
    if (/\.html?$/i.test(route)) pages.set(route, htmlDetails(fs.readFileSync(filePath, "utf8")));
  }

  for (const [route, page] of pages) {
    page.xrefs.forEach((xref, index) => {
      attributionCount += 1;
      const attrs = attributes(xref);
      const location = `${route} attribution ${index + 1}`;
      for (const name of REQUIRED_ATTRIBUTES) {
        if (!attrs[name]?.trim()) errors.push(`${location} is missing ${name}`);
      }

      const excerptNode = findByClass(xref, "slate-xref__excerpt");
      const excerpt = normalizeText(excerptNode ? textContent(excerptNode) : "");
      if (!excerpt) errors.push(`${location} has no excerpt`);

      if (attrs["data-xref-href"]) {
        const target = resolvePublishedTarget(route, attrs["data-xref-href"]);
        if (!target.anchor) errors.push(`${location} must deep-link to a target section`);
        if (!routes.has(target.file)) {
          errors.push(`${location} targets an unregistered route: ${target.file}`);
        } else {
          const targetPage = pages.get(target.file);
          if (target.anchor && !targetPage?.headings.has(target.anchor)) {
            errors.push(`${location} targets a missing anchor: ${target.file}#${target.anchor}`);
          }
          const targetText = target.anchor ? targetPage?.sections.get(target.anchor) || "" : targetPage?.text || "";
          if (excerpt && targetPage && !targetText.includes(excerpt)) {
            errors.push(`${location} excerpt does not occur in target section: ${target.file}${target.anchor ? `#${target.anchor}` : ""}`);
          }
        }
      }

      if (attrs["data-xref-claim-source"]) {
        validateLocator(repoRoot, attrs["data-xref-claim-source"], "Claim source", "", errors);
      }
      if (attrs["data-xref-evidence-source"]) {
        validateLocator(repoRoot, attrs["data-xref-evidence-source"], "Evidence source", excerpt, errors);
      }
    });
  }

  return { attributionCount, errors };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = validateDocumentAttributions(
    path.resolve(argumentValue("--repo") || process.cwd()),
    argumentValue("--host") || "docs",
  );
  if (result.errors.length) {
    console.error(`Documentation attribution validation failed (${result.errors.length}):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`Documentation attribution validation passed (${result.attributionCount} authored references).`);
  }
}