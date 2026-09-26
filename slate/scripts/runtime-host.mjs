import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeFiles = ["shell/slate.css", "shell/presentation.js", "shell/slate.js"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Runtime trees cannot contain symbolic links or junctions: ${entryPath}`);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
    .sort((left, right) => left.localeCompare(right));
}

function sourceRuntimeFiles(sourceRoot = packageRoot) {
  return [
    ...runtimeFiles,
    ...listFiles(path.join(sourceRoot, "shell", "canvas"))
      .map((filePath) => toPosix(path.relative(sourceRoot, filePath))),
    ...listFiles(path.join(sourceRoot, "shell", "vendor"))
      .map((filePath) => toPosix(path.relative(sourceRoot, filePath))),
  ];
}

function packageIdentity(sourceRoot) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(sourceRoot, "package.json"), "utf8"));
  return { name: packageJson.name, version: packageJson.version };
}

function isRuntimePath(relativePath) {
  return typeof relativePath === "string"
    && relativePath === path.posix.normalize(relativePath)
    && relativePath.startsWith("shell/")
    && !relativePath.includes("\\");
}

function assertSafeHost(repositoryRoot, hostRoot) {
  const resolvedRepository = path.resolve(repositoryRoot);
  const resolvedHost = path.resolve(hostRoot);
  if (resolvedHost !== resolvedRepository && !resolvedHost.startsWith(`${resolvedRepository}${path.sep}`)) {
    throw new Error(`Host must be inside the repository: ${resolvedHost}`);
  }
  if (!fs.existsSync(resolvedRepository)) throw new Error(`Repository root does not exist: ${resolvedRepository}`);

  const physicalRepository = fs.realpathSync(resolvedRepository);
  let currentPath = resolvedRepository;
  for (const segment of path.relative(resolvedRepository, resolvedHost).split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    if (!fs.existsSync(currentPath)) break;
    if (fs.lstatSync(currentPath).isSymbolicLink()) {
      throw new Error(`Host path cannot contain a symbolic link or junction: ${currentPath}`);
    }
    const physicalPath = fs.realpathSync(currentPath);
    if (physicalPath !== physicalRepository && !physicalPath.startsWith(`${physicalRepository}${path.sep}`)) {
      throw new Error(`Host resolves outside the repository: ${currentPath}`);
    }
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return "manifest must be an object";
  if (!Array.isArray(manifest.files)) return "files must be an array";
  const paths = new Set();
  for (const [index, entry] of manifest.files.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return `files[${index}] must be an object`;
    if (!isRuntimePath(entry.path)) return `files[${index}] has an unsafe path: ${entry.path}`;
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 || "")) return `files[${index}] has an invalid sha256`;
    if (paths.has(entry.path)) return `files contains a duplicate path: ${entry.path}`;
    paths.add(entry.path);
  }
  return "";
}

function readManifest(manifestPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const manifestError = validateManifest(manifest);
    if (manifestError) throw new Error(manifestError);
    return manifest;
  } catch (error) {
    throw new Error(`Cannot synchronize from invalid runtime manifest: ${error.message}`);
  }
}

export function syncRuntimeHost(hostRoot, sourceRoot = packageRoot, repositoryRoot = process.cwd()) {
  const resolvedHost = path.resolve(hostRoot);
  assertSafeHost(repositoryRoot, resolvedHost);
  const files = sourceRuntimeFiles(sourceRoot);
  const expectedFiles = new Set(files);
  const manifestPath = path.join(resolvedHost, ".slate-runtime.json");
  const identity = packageIdentity(sourceRoot);
  let previousManifest;
  if (fs.existsSync(manifestPath)) {
    previousManifest = readManifest(manifestPath);
    if (previousManifest.sourcePackage !== identity.name) {
      throw new Error(`Runtime manifest belongs to ${previousManifest.sourcePackage}; expected ${identity.name}`);
    }
  }

  const recordedFiles = new Map((previousManifest?.files || []).map((entry) => [entry.path, entry.sha256]));
  const obsoleteFiles = [];
  for (const entry of previousManifest?.files || []) {
    if (!isRuntimePath(entry.path)) throw new Error(`Runtime manifest contains an unsafe path: ${entry.path}`);
    if (expectedFiles.has(entry.path)) continue;
    const obsoletePath = path.join(resolvedHost, ...entry.path.split("/"));
    if (fs.existsSync(obsoletePath) && hashFile(obsoletePath) !== entry.sha256) {
      throw new Error(`Refusing to delete modified obsolete runtime file: ${entry.path}`);
    }
    obsoleteFiles.push(obsoletePath);
  }

  for (const filePath of listFiles(path.join(resolvedHost, "shell"))) {
    const relativePath = toPosix(path.relative(resolvedHost, filePath));
    if (!expectedFiles.has(relativePath) && !recordedFiles.has(relativePath)) {
      throw new Error(`Refusing to overwrite a host with an unmanaged runtime file: ${relativePath}`);
    }
  }

  for (const relativePath of files) {
    const sourcePath = path.join(sourceRoot, ...relativePath.split("/"));
    const destinationPath = path.join(resolvedHost, ...relativePath.split("/"));
    if (fs.existsSync(destinationPath)
        && !recordedFiles.has(relativePath)
        && hashFile(destinationPath) !== hashFile(sourcePath)) {
      throw new Error(`Refusing to overwrite an unmanaged runtime collision: ${relativePath}`);
    }
  }

  for (const obsoletePath of obsoleteFiles) fs.rmSync(obsoletePath, { force: true });
  for (const relativePath of files) {
    const sourcePath = path.join(sourceRoot, ...relativePath.split("/"));
    const destinationPath = path.join(resolvedHost, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }

  const manifest = {
    schemaVersion: 1,
    sourcePackage: identity.name,
    sourceVersion: identity.version,
    sourcePath: toPosix(path.relative(resolvedHost, sourceRoot)),
    files: files.map((relativePath) => ({
      path: relativePath,
      sha256: hashFile(path.join(sourceRoot, ...relativePath.split("/"))),
    })),
  };
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export function checkRuntimeHost(hostRoot, sourceRoot = packageRoot, repositoryRoot = process.cwd()) {
  const resolvedHost = path.resolve(hostRoot);
  try {
    assertSafeHost(repositoryRoot, resolvedHost);
  } catch (error) {
    return [error.message];
  }
  const manifestPath = path.join(resolvedHost, ".slate-runtime.json");
  const errors = [];
  if (!fs.existsSync(manifestPath)) return ["Missing generated runtime manifest: .slate-runtime.json"];

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return [`Invalid generated runtime manifest: ${error.message}`];
  }
  const manifestError = validateManifest(manifest);
  if (manifestError) return [`Invalid generated runtime manifest: ${manifestError}`];

  const identity = packageIdentity(sourceRoot);
  if (manifest.sourcePackage !== identity.name || manifest.sourceVersion !== identity.version) {
    errors.push(`Runtime manifest identifies ${manifest.sourcePackage}@${manifest.sourceVersion}; expected ${identity.name}@${identity.version}`);
  }

  const expectedFiles = sourceRuntimeFiles(sourceRoot);
  const recordedFiles = new Map((manifest.files || []).map((entry) => [entry.path, entry.sha256]));
  for (const relativePath of expectedFiles) {
    const sourcePath = path.join(sourceRoot, ...relativePath.split("/"));
    const destinationPath = path.join(resolvedHost, ...relativePath.split("/"));
    const sourceHash = hashFile(sourcePath);
    if (!recordedFiles.has(relativePath)) errors.push(`Runtime manifest omits ${relativePath}`);
    else if (recordedFiles.get(relativePath) !== sourceHash) errors.push(`Runtime manifest is stale for ${relativePath}`);
    if (!fs.existsSync(destinationPath)) errors.push(`Generated runtime file is missing: ${relativePath}`);
    else if (hashFile(destinationPath) !== sourceHash) errors.push(`Generated runtime file differs from canonical source: ${relativePath}`);
  }

  const expectedSet = new Set(expectedFiles);
  for (const relativePath of recordedFiles.keys()) {
    if (!expectedSet.has(relativePath)) errors.push(`Runtime manifest contains an obsolete file: ${relativePath}`);
  }
  try {
    for (const filePath of listFiles(path.join(resolvedHost, "shell"))) {
      const relativePath = toPosix(path.relative(resolvedHost, filePath));
      if (!expectedSet.has(relativePath)) errors.push(`Host runtime contains an unmanaged file: ${relativePath}`);
    }
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const command = process.argv[2];
  const host = argumentValue("--host");
  const repositoryRoot = path.resolve(argumentValue("--repo") || process.cwd());
  if (!host || !["sync", "check"].includes(command)) {
    console.error("Usage: node scripts/runtime-host.mjs <sync|check> --host <content-root>");
    process.exitCode = 2;
  } else if (command === "sync") {
    const manifest = syncRuntimeHost(host, packageRoot, repositoryRoot);
    console.log(`Slate runtime synchronized (${manifest.files.length} files, ${manifest.sourcePackage}@${manifest.sourceVersion}).`);
  } else {
    const errors = checkRuntimeHost(host, packageRoot, repositoryRoot);
    if (errors.length) {
      console.error(`Slate runtime check failed (${errors.length}):`);
      errors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
    } else {
      console.log("Slate runtime check passed.");
    }
  }
}