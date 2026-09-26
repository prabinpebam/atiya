import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { syncRuntimeHost } from "./runtime-host.mjs";

const defaultSourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function writeIfMissing(filePath, content, created) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  created.push(filePath);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function hostIndex(sourceRoot, projectName) {
  const escapedProjectName = escapeHtml(projectName);
  return fs.readFileSync(path.join(sourceRoot, "shell", "index.html"), "utf8")
    .replace("<title>Docs</title>", `<title>${escapedProjectName}</title>`)
    .replaceAll('href="vendor/', 'href="shell/vendor/')
    .replace(
      '<link rel="stylesheet" href="slate.css">',
      '<link rel="stylesheet" href="shell/slate.css">\n  <link rel="stylesheet" href="project.theme.css">',
    )
    .replaceAll('src="vendor/', 'src="shell/vendor/')
    .replace('src="presentation.js"', 'src="shell/presentation.js"')
    .replace('src="slate.js"', 'src="shell/slate.js"');
}

function discoveryAdapter(repoRoot, sourceRoot) {
  const adapterRoot = path.join(repoRoot, ".github", "skills", "slate");
  const skillPath = path.relative(adapterRoot, path.join(sourceRoot, "SKILL.md")).split(path.sep).join("/");
  return `---
name: slate
description: "Use when: creating, converting, reviewing, or updating documentation, research, references, benchmarks, presentations, or a Slate documentation site. Loads the repository's canonical Slate system and skill."
argument-hint: "Documentation task"
user-invocable: true
disable-model-invocation: false
---

# Slate

Read and follow [the canonical Slate skill](${skillPath}). The package beside that file owns all
generic guidance, components, templates, assets, subskills, runtime code, scripts, and tests. Do not
duplicate or specialize those resources in this discovery adapter.

Repository-specific authority, content, branding, and validation rules remain outside the generic
package and apply in addition to it.
`;
}

export function initializeProject({
  repoRoot,
  host = "docs",
  projectName = "Project Documentation",
  sourceRoot = defaultSourceRoot,
}) {
  const resolvedRepo = path.resolve(repoRoot);
  const resolvedSource = path.resolve(sourceRoot);
  const hostRoot = path.resolve(resolvedRepo, host);
  if (hostRoot !== resolvedRepo && !hostRoot.startsWith(`${resolvedRepo}${path.sep}`)) {
    throw new Error(`Host must be inside the repository: ${host}`);
  }
  const created = [];
  const escapedProjectName = escapeHtml(projectName);
  const manifest = syncRuntimeHost(hostRoot, resolvedSource, resolvedRepo);

  writeIfMissing(path.join(hostRoot, "index.html"), hostIndex(resolvedSource, projectName), created);
  writeIfMissing(path.join(hostRoot, "slate.config.json"), `${JSON.stringify({
    projectName,
    defaultTheme: "auto",
    density: "comfortable",
    landing: "landing.html",
    themeStylesheet: "project.theme.css",
  }, null, 2)}\n`, created);
  writeIfMissing(path.join(hostRoot, "docs-manifest.json"), `${JSON.stringify({
    version: 2,
    entries: [
      { path: "landing.html", title: "Overview", order: 0, icon: "home", type: "page" },
    ],
  }, null, 2)}\n`, created);
  writeIfMissing(path.join(hostRoot, "project.theme.css"), `/* Project-owned design-token overrides. Never edit generated files under shell/. */
:root {
}

[data-theme="dark"] {
}
`, created);
  writeIfMissing(path.join(hostRoot, "landing.html"), `<header class="slate-hero">
  <p class="slate-hero__eyebrow">Documentation</p>
  <h1 class="slate-hero__title">${escapedProjectName}</h1>
  <p class="slate-hero__summary">A navigable source for this project's decisions, evidence, and guidance.</p>
</header>

<aside class="slate-tldr">
  <p class="slate-tldr__label">TL;DR</p>
  <p>Start here, then add focused pages and register them in the documentation manifest.</p>
</aside>

<h2>Start here</h2>
<p>Replace this starter content with the project's durable documentation.</p>
`, created);

  const adapterPath = path.join(resolvedRepo, ".github", "skills", "slate", "SKILL.md");
  writeIfMissing(adapterPath, discoveryAdapter(resolvedRepo, resolvedSource), created);
  return { created, hostRoot, adapterPath, manifest };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.resolve(argumentValue("--repo") || path.join(defaultSourceRoot, ".."));
  const result = initializeProject({
    repoRoot,
    host: argumentValue("--host") || "docs",
    projectName: argumentValue("--project") || "Project Documentation",
  });
  console.log(`Slate documentation initialized at ${path.relative(repoRoot, result.hostRoot) || "."}.`);
  console.log(`Created ${result.created.length} host-owned files; synchronized ${result.manifest.files.length} runtime files.`);
}