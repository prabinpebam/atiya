import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slate-portability-"));
const repoRoot = path.join(temporaryRoot, "new-project");
const copiedSkillRoot = path.join(repoRoot, "slate");

try {
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.cpSync(sourceRoot, copiedSkillRoot, { recursive: true });

  const initializer = await import(`${pathToFileURL(path.join(copiedSkillRoot, "scripts", "init-project.mjs"))}?copy=1`);
  const runtime = await import(`${pathToFileURL(path.join(copiedSkillRoot, "scripts", "runtime-host.mjs"))}?copy=1`);
  const first = initializer.initializeProject({
    repoRoot,
    projectName: "Example Project",
    sourceRoot: copiedSkillRoot,
  });

  assert.equal(first.created.length, 6);
  assert.deepEqual(runtime.checkRuntimeHost(path.join(repoRoot, "docs"), copiedSkillRoot, repoRoot), []);
  const index = fs.readFileSync(path.join(repoRoot, "docs", "index.html"), "utf8");
  assert.match(index, /<link rel="stylesheet" href="shell\/slate\.css">\s+<link rel="stylesheet" href="project\.theme\.css">/);
  assert.doesNotMatch(index, /href="(?:vendor|slate\.)/);
  assert.match(index, /<script src="shell\/presentation\.js"><\/script>\s+<script src="shell\/slate\.js"><\/script>/);
  assert.equal(fs.existsSync(path.join(repoRoot, "docs", "shell", "canvas", "index.html")), true);
  assert.equal(fs.existsSync(path.join(repoRoot, "docs", "shell", "canvas", "canvas.js")), true);
  assert.match(fs.readFileSync(path.join(repoRoot, "docs", "slate.config.json"), "utf8"), /"themeStylesheet": "project\.theme\.css"/);
  assert.match(fs.readFileSync(path.join(repoRoot, "docs", "landing.html"), "utf8"), /Example Project/);
  assert.match(fs.readFileSync(first.adapterPath, "utf8"), /canonical Slate skill/);
  const copiedSvgSkill = path.join(copiedSkillRoot, "visualization", "skills", "svg-illustration");
  assert.equal(fs.existsSync(path.join(copiedSvgSkill, "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(copiedSvgSkill, "references", "production-and-embedding.md")), true);
  assert.equal(fs.existsSync(path.join(copiedSvgSkill, "scripts", "validate_svg.py")), true);
  assert.equal(fs.existsSync(path.join(copiedSvgSkill, "assets", "starter-slate-inline.svg")), true);
  const svgValidation = spawnSync(process.execPath, [
    path.join(copiedSkillRoot, "scripts", "test-svg-illustration.mjs"),
    "--validate-only",
  ], { cwd: copiedSkillRoot, encoding: "utf8" });
  assert.equal(svgValidation.status, 0, `${svgValidation.stdout}\n${svgValidation.stderr}`);

  fs.writeFileSync(path.join(repoRoot, "docs", "landing.html"), "host-owned content\n");
  const second = initializer.initializeProject({
    repoRoot,
    projectName: "Example Project",
    sourceRoot: copiedSkillRoot,
  });
  assert.equal(second.created.length, 0);
  assert.equal(fs.readFileSync(path.join(repoRoot, "docs", "landing.html"), "utf8"), "host-owned content\n");

  assert.throws(() => initializer.initializeProject({
    repoRoot,
    host: "../outside",
    sourceRoot: copiedSkillRoot,
  }), /Host must be inside the repository/);
  assert.equal(fs.existsSync(path.join(temporaryRoot, "outside")), false);

  const junctionTarget = path.join(temporaryRoot, "junction-target");
  const junctionRepo = path.join(temporaryRoot, "junction-repo");
  fs.mkdirSync(junctionTarget, { recursive: true });
  fs.mkdirSync(junctionRepo, { recursive: true });
  fs.symlinkSync(junctionTarget, path.join(junctionRepo, "docs"), "junction");
  assert.throws(() => initializer.initializeProject({
    repoRoot: junctionRepo,
    sourceRoot: copiedSkillRoot,
  }), /symbolic link or junction/);
  assert.equal(fs.readdirSync(junctionTarget).length, 0);

  console.log("Slate copied-package portability tests passed (7 cases).");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}