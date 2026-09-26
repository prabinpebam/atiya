# Repository Agent Context

## Repository role

This repository is **Slate**: a project-agnostic documentation system and agent skill for
producing navigable, visual-first static documentation sites.

It is a **standalone, copyable package**. A consuming repository (a *host*) takes this package
whole, runs the initializer, and gets a working documentation viewer plus an authoring contract.
This repository owns only generic capability. It never owns any host's content, branding,
authority, or policy.

Package identity is `@slate/docs`, currently version `0.6.3`.

## Start here

Read these in order before changing anything:

1. `README.md` - what Slate is, how to try the demo, how to adopt it.
2. `SKILL.md` - the complete generic authoring contract. This is the primary agent instruction
   set and the largest source of truth in the repository.
3. `components/README.md` - the component catalog and few-shot patterns.
4. `visualization/README.md` - the bundled visualization subskills.
5. `docs/canvas-capability-spec.md` - the Slate Canvas contract.

## Ownership boundary

This boundary is the most important rule in the repository. Violating it is what makes a
documentation system unmaintainable.

| Layer | Owns |
|---|---|
| **Package (this repo)** | Skill, runtime, components, templates, schemas, visualization subskills, canvas, demo, initializer, tests |
| **Host** | Content, sources, manifest, root `index.html`, config, theme, authority, policy |
| **Adapter** | Host-specific discovery and extra rules only |

Consequences:

- A host's generated `shell/` is **never hand-edited**. It is copied from this package and
  drift-checked against SHA-256 hashes recorded in the host's `.slate-runtime.json`.
- Never move project meaning, branding, product names, or organizational policy into this
  package. Slate must stay generic enough to drop into an unrelated repository unchanged.
- When a real host reveals a reusable need or defect, fix it **here first** with a generic
  demo, fixture, or test. Then synchronize the host. Do not patch a generated host and
  backfill the package later.

## Authoring rules that agents get wrong

These are the recurring failure modes. Apply them deliberately.

- **Visual-first is the prime directive.** Any content carrying data, trends, comparisons,
  proportions, processes, hierarchies, or relationships becomes a visualization *before* prose
  is considered. Prose is the fallback, not the default.
- **Quantities are charts; concepts are illustrations.** Measured values route to the `chart`
  skill, which renders a declarative spec offline through Semiotic on D3. Explanatory and
  decorative visuals are authored directly as semantic SVG. Never hand-draw a bar chart, and
  never generate a conceptual diagram from a chart engine.
- **Pages are body fragments.** No `<head>`, no `<script>`, no `<style>`, no `<iframe>`.
  The viewer sanitizes everything through one pipeline; anything else is stripped.
- **Compose from the catalog.** Use the documented components rather than inventing markup or
  page-specific CSS. If content needs something absent from the catalog, choose the closest
  component or fall back to prose and flag the gap.
- **No emoji** in user-facing text, labels, status, or tooltips. Every icon - in a chart, an
  illustration, a card, a tile, or the nav - is official vector geometry from **Fluent Icons**,
  **Google Material Symbols**, or **Font Awesome**, and one source is used exclusively per artifact.
  Never draw a familiar icon from memory or mix libraries. See
  `visualization/skills/iconography/SKILL.md`. Nav icons use Material Symbols Outlined names in the
  manifest.
- **Never fabricate.** Do not invent excerpts, sources, version-history entries, or data. An
  `xref` must quote text that actually exists at the target anchor.
- **Every page needs a content-appropriate `icon`** in the manifest. Do not leave the default
  document icon on everything.

## Change characterization and proportional validation

Do not run every suite because a file changed, and do not use the light path when shared
contracts changed. Before editing, characterize the change:

1. **Authority** - generic capability, package docs, demo content, or runtime?
2. **Changed surfaces** - content, navigation, visual output, interaction, accessibility,
   runtime, schema, validator, or consumer behavior?
3. **Dependency reach** - local to one file, shared by many, generated, or published to hosts?
4. **Risk** - what becomes false, broken, inaccessible, or incompatible?
5. **Discriminating checks** - the smallest executable or rendered check that would falsify each
   assumption.
6. **Expansion triggers** - the concrete failure that would justify a broader run.

Start narrow. Expand only when a named trigger fires. State which broad suites you intentionally
skipped and why.

## Validation

```powershell
npm install

npm run test:runtime-host
npm run test:portability
npm run test:attributions
npm run test:presentation-motion
npm run test:canvas-contracts
npm run test:chart
npm run test:svg-illustration
npm run validate:svg-illustration
```

Render checks require HTTP; the viewer cannot run from `file://`:

```powershell
python -m http.server 8080 --bind 127.0.0.1
# open http://127.0.0.1:8080/demo/
```

Keep preview servers bound to loopback. Never bind to `0.0.0.0` or `::`.

## Runtime assets and the canvas build

`shell/` holds the canonical runtime: `slate.css`, `slate.js`, `presentation.js`,
`vendor/`, and the built `canvas/`.

`shell/canvas/*` is **generated** from `canvas/src/` by:

```powershell
npm run build:canvas
```

**Ordering matters.** Rebuilding the canvas changes `shell/canvas/*` hashes. Any host
synchronized before that rebuild will fail its runtime drift check. Always run `build:canvas`
*before* synchronizing a host, and re-synchronize hosts after any canvas change:

```powershell
node ./scripts/runtime-host.mjs sync --repo <host-repo> --host <content-dir>
node ./scripts/runtime-host.mjs check --repo <host-repo> --host <content-dir>
```

## Releasing a change to hosts

1. Make the generic change here, with a demo, fixture, or test proving it.
2. Run `npm run build:canvas` if `canvas/src/` changed.
3. Run the relevant validation.
4. Bump `version` in `package.json` when runtime assets or public contracts change. Hosts
   record package name and version in `.slate-runtime.json`, and a mismatch is reported.
5. Commit and push.
6. In each host, update the pinned Slate revision, re-run `runtime-host sync`, then `check`.

## Guardrails

- Never hand-edit a host's generated `shell/`.
- Never add host-specific names, branding, content, or policy to this package.
- Never edit `shell/canvas/*` directly; change `canvas/src/` and rebuild.
- Never weaken a validator, schema, or drift check to make a change pass.
- Never add `<script>`, `<style>`, or `<iframe>` to authored page content.
- Never bind a preview server to a non-loopback interface.
- Never fabricate excerpts, sources, data, or version history.
