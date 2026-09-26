import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDocumentAttributions } from "./validate-document-attributions.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "slate-doc-attributions-"));

function write(relativePath, content) {
  const filePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function seed(overrides = {}) {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  write("site/docs-manifest.json", JSON.stringify({
    version: 2,
    entries: [
      { path: "claim.html", title: "Claim", type: "page" },
      { path: "evidence.html", title: "Evidence", type: "page" },
    ],
  }));
  write("source/claim.md", "# Claim\n\n## Supported assertion\n\nA supported assertion.\n");
  write("source/evidence.md", "# Evidence source\n\n## Detail\n\nSupported detail.\n");
  write("site/evidence.html", overrides.evidenceHtml || "<h1>Evidence</h1><h2>Detail</h2><p>Supported detail.</p>");
  write("site/claim.html", `<h1>Claim</h1><p>A supported assertion
    <span class="slate-xref"
          data-xref-href="${overrides.href || "evidence.html#detail"}"
          data-xref-source="Evidence"
          ${overrides.omitClaim ? "" : "data-xref-claim-source=\"source/claim.md#supported-assertion\""}
          data-xref-evidence-source="${overrides.evidenceSource || "source/evidence.md#detail"}">
      <span class="slate-xref__label">Evidence</span>
      <span class="slate-xref__excerpt">${overrides.excerpt || "Supported detail."}</span>
    </span>
  </p>`);
}

function validate() {
  return validateDocumentAttributions(root, "site");
}

function expectFailure(overrides, expectedMessage) {
  seed(overrides);
  const { errors } = validate();
  assert.ok(errors.some((error) => error.includes(expectedMessage)), errors.join("\n"));
}

try {
  seed();
  assert.deepEqual(validate(), { attributionCount: 1, errors: [] });

  expectFailure({ href: "missing.html#detail" }, "targets an unregistered route");
  expectFailure({ href: "evidence.html" }, "must deep-link to a target section");
  expectFailure({ href: "evidence.html#missing" }, "targets a missing anchor");
  expectFailure({ excerpt: "Drifted detail." }, "excerpt does not occur in target");
  expectFailure({ evidenceHtml: "<h1>Evidence</h1><h2>Detail</h2><p>Other detail.</p><h2>Elsewhere</h2><p>Supported detail.</p>" }, "excerpt does not occur in target section");
  expectFailure({ omitClaim: true }, "is missing data-xref-claim-source");
  expectFailure({ evidenceSource: "source/evidence.md#missing" }, "Evidence source anchor does not exist");
  expectFailure({ evidenceSource: "source/evidence.md" }, "Evidence source must identify an exact section");

  console.log("Documentation attribution mutation tests passed (9 cases).\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}