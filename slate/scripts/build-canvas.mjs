import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(packageRoot, "canvas");
const outputRoot = path.join(packageRoot, "shell", "canvas");

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

await build({
  entryPoints: [path.join(sourceRoot, "src", "main.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: path.join(outputRoot, "canvas.js"),
  minify: true,
  sourcemap: false,
  legalComments: "linked",
  logLevel: "info",
});

// The shell requests canvas.js and canvas.css with a ?v= cache key. That key was
// hard-coded in the source index.html, so it never changed on release and browsers kept
// executing a cached bundle after every Slate upgrade. Stamp the real package version.
const packageVersion = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")).version;
const canvasIndex = fs.readFileSync(path.join(sourceRoot, "index.html"), "utf8")
  .replaceAll("__SLATE_VERSION__", packageVersion);
if (canvasIndex.includes("__SLATE_VERSION__") || !canvasIndex.includes(`?v=${packageVersion}`)) {
  throw new Error("Canvas index.html must request its assets with the current package version");
}
fs.writeFileSync(path.join(outputRoot, "index.html"), canvasIndex);
console.log("Slate Canvas runtime built at shell/canvas.");