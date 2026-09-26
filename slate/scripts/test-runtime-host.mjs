import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkRuntimeHost, syncRuntimeHost } from "./runtime-host.mjs";

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slate-runtime-host-"));
const hostRoot = path.join(temporaryRoot, "docs");

try {
  const sync = (target = hostRoot) => syncRuntimeHost(target, undefined, temporaryRoot);
  const check = (target = hostRoot) => checkRuntimeHost(target, undefined, temporaryRoot);
  const manifest = sync();
  assert.ok(manifest.files.length >= 3, "Expected core and vendor runtime files.");
  assert.ok(manifest.files.some((entry) => entry.path === "shell/canvas/index.html"), "Expected the Canvas shell in generated runtime files.");
  assert.ok(manifest.files.some((entry) => entry.path === "shell/canvas/canvas.js"), "Expected the Canvas application bundle in generated runtime files.");
  assert.deepEqual(check(), []);

  fs.appendFileSync(path.join(hostRoot, "shell", "slate.js"), "\n// drift\n");
  assert.ok(check().some((error) => error.includes("differs from canonical source: shell/slate.js")));

  sync();
  fs.appendFileSync(path.join(hostRoot, "shell", "presentation.js"), "\n// presentation drift\n");
  assert.ok(check().some((error) => error.includes("differs from canonical source: shell/presentation.js")));

  sync();
  fs.writeFileSync(path.join(hostRoot, "shell", "host-only.css"), "/* unmanaged */\n");
  assert.ok(check().some((error) => error.includes("unmanaged file: shell/host-only.css")));

  fs.rmSync(path.join(hostRoot, "shell", "host-only.css"));
  const manifestPath = path.join(hostRoot, ".slate-runtime.json");
  const manifestWithObsoleteFile = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const obsoletePath = path.join(hostRoot, "shell", "vendor", "obsolete.js");
  const obsoleteContent = "// obsolete generated file\n";
  fs.writeFileSync(obsoletePath, obsoleteContent);
  manifestWithObsoleteFile.files.push({
    path: "shell/vendor/obsolete.js",
    sha256: crypto.createHash("sha256").update(obsoleteContent).digest("hex"),
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestWithObsoleteFile, null, 2)}\n`);
  sync();
  assert.equal(fs.existsSync(obsoletePath), false);
  assert.deepEqual(check(), []);

  const collisionRoot = path.join(temporaryRoot, "collision");
  fs.mkdirSync(path.join(collisionRoot, "shell", "vendor"), { recursive: true });
  fs.writeFileSync(path.join(collisionRoot, "shell", "vendor", "marked.min.js"), "host-owned script\n");
  assert.throws(() => sync(collisionRoot), /unmanaged runtime collision/);
  assert.equal(fs.existsSync(path.join(collisionRoot, "shell", "slate.css")), false);
  assert.equal(fs.existsSync(path.join(collisionRoot, ".slate-runtime.json")), false);

  const protectedHostFile = path.join(hostRoot, "landing.html");
  fs.writeFileSync(protectedHostFile, "host-owned content\n");
  const unsafeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  unsafeManifest.files.push({ path: "shell/../landing.html", sha256: "unsafe" });
  fs.writeFileSync(manifestPath, `${JSON.stringify(unsafeManifest, null, 2)}\n`);
  assert.throws(() => sync(), /unsafe path/);
  assert.equal(fs.readFileSync(protectedHostFile, "utf8"), "host-owned content\n");

  fs.writeFileSync(manifestPath, "{}\n");
  assert.deepEqual(check(), ["Invalid generated runtime manifest: files must be an array"]);

  fs.writeFileSync(manifestPath, `${JSON.stringify({ files: [null] })}\n`);
  assert.deepEqual(check(), ["Invalid generated runtime manifest: files[0] must be an object"]);
  assert.throws(() => sync(), /files\[0\] must be an object/);

  fs.writeFileSync(manifestPath, `${JSON.stringify({ files: [{ path: "shell/slate.js" }] })}\n`);
  assert.deepEqual(check(), ["Invalid generated runtime manifest: files[0] has an invalid sha256"]);
  assert.throws(() => sync(), /files\[0\] has an invalid sha256/);

  const validHash = "0".repeat(64);
  fs.writeFileSync(manifestPath, `${JSON.stringify({ files: [
    { path: "shell/slate.js", sha256: validHash },
    { path: "shell/slate.js", sha256: validHash },
  ] })}\n`);
  assert.deepEqual(check(), ["Invalid generated runtime manifest: files contains a duplicate path: shell/slate.js"]);
  assert.throws(() => sync(), /duplicate path/);

  fs.writeFileSync(manifestPath, `${JSON.stringify({ files: [
    { path: "shell/../landing.html", sha256: validHash },
  ] })}\n`);
  assert.deepEqual(check(), ["Invalid generated runtime manifest: files[0] has an unsafe path: shell/../landing.html"]);
  assert.throws(() => sync(), /unsafe path/);

  const junctionHost = path.join(temporaryRoot, "junction-host");
  const externalRuntime = path.join(temporaryRoot, "external-runtime");
  fs.mkdirSync(path.join(junctionHost, "shell"), { recursive: true });
  fs.mkdirSync(externalRuntime, { recursive: true });
  fs.symlinkSync(externalRuntime, path.join(junctionHost, "shell", "vendor"), "junction");
  const externalFile = path.join(externalRuntime, "obsolete.js");
  fs.writeFileSync(externalFile, "external content\n");
  assert.throws(() => sync(junctionHost), /symbolic links or junctions/);
  assert.equal(fs.readFileSync(externalFile, "utf8"), "external content\n");

  console.log("Slate runtime host mutation tests passed (15 cases).");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}