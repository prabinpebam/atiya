# Slate

Slate is a project-agnostic documentation system and agent skill for producing navigable,
visual-first static documentation sites.

> **Status:** Working (v0.6.3). The canonical host template and runtime assets (`shell/index.html`,
> `slate.css`, `presentation.js`, `slate.js`, and `vendor/`) form a
> functioning viewer: it renders Markdown **and** HTML content through one sanitized pipeline, with
> navigation, search, TOC, theming, config-driven branding, and the full v1 component library. A
> runnable [`demo/`](demo/) exercises the framework. Package tests cover copied-package
> initialization, generated-runtime drift and upgrades, and authored attribution routes, anchors,
> excerpts, and provenance. Presenter-controlled WAAPI motion is experimental; the package includes
> a versioned manifest schema, validator/mutation suite, and runnable demo. Slate also includes a
> native SVG Illustration pipeline with medium routing, sanitizer-aware profiles, accessible starter
> assets, structural/theme validators, viewport entry/replay, and presentation-motion integration.
> Slate Canvas adds a package-owned, project-agnostic, read-only React Flow surface for structured
> records, nested groups, repeated placements, named perspectives over one Record Set, and
> professional viewport navigation. Its fixed
> scaffold and host contract are documented in [Slate Canvas](canvas/README.md) and the
> [Canvas capability specification](docs/canvas-capability-spec.md). Editing and authority-aware
> write-back remain future work.

This repository is the **drop-in skill package**. Drop it (unchanged) into any project as `slate/`,
hand an AI agent some raw content, and the agent - reading [`SKILL.md`](SKILL.md) - produces
navigable HTML/Markdown pages plus a manifest that the viewer renders consistently.

Slate is standalone and dependency-light for authors: hosts need no build step, and the viewer runs
as static files over plain HTTP.

## Try the demo

Serve this repository over HTTP and open the demo content root:

```powershell
python -m http.server 8080 --bind 127.0.0.1
# then open http://127.0.0.1:8080/demo/
```

Keep local preview servers bound to loopback. Do not bind this basic server to `::`,
`0.0.0.0`, or another externally reachable interface.

The viewer needs HTTP (it cannot run from `file://`). Check desktop/mobile layout, keyboard use,
light/dark themes, navigation, search, and any visualizations changed by the work.

## What's here

```
.
  SKILL.md          # agent instructions: when + how to use this skill
  AGENTS.md         # working rules for agents contributing to this repository
  README.md         # this file
  shell/            # host-entry template plus canonical CSS, JavaScript, and vendor assets
  demo/             # a runnable content root that exercises the framework
  components/       # component catalog: one example per component (few-shot patterns)
  canvas/           # fixed read-only React Flow application source and domain model
  templates/        # page + landing scaffolds the agent fills in
  visualization/    # chart rendering, native SVG illustration, and icon retrieval skills
  docs/             # package architecture, planning, and capability specifications
  assets/icons/     # system icon set (no emoji)
  schema/           # JSON Schemas for manifest + config
  scripts/          # generic initialization, runtime sync/check, and validation tests
  examples/         # a worked before/after conversion + example manifest
```

## For agents

Read [`SKILL.md`](SKILL.md). The package's `shell/index.html` is the initializer template; its CSS,
JavaScript, and vendor files are canonical generated runtime assets. A host's generated `shell/` is
never hand-edited. **Bias heavily toward visuals**: for any
data, trend, comparison, proportion, process, hierarchy, or relationship, produce a visualization
using the bundled [`visualization/`](visualization/README.md) skills and embed it as a figure,
*before* falling back to prose. You compose pages from [`components/`](components/README.md) using
[`templates/`](templates/page.html), then write a `docs-manifest.json` validated by
[`schema/manifest.schema.json`](schema/manifest.schema.json).

## For humans

- The complete generic authoring contract is in [`SKILL.md`](SKILL.md), with component examples in
  [`components/`](components/README.md), schemas in [`schema/`](schema/), and runnable examples in
  [`demo/`](demo/).
- Contributing to Slate itself? Read [`AGENTS.md`](AGENTS.md) for the ownership boundary,
  proportional validation policy, and release steps.
- Host content, authority, branding, and validation policy stay outside this repository.

## Adopt in a new repository

Add Slate as `slate/` in the consuming repository. Either pin it as a submodule:

```powershell
git submodule add https://github.com/prabinpebam/slate.git slate
```

or simply copy the repository contents unchanged into a `slate/` directory.

Then run the initializer from the consuming repository root:

```powershell
node .\slate\scripts\init-project.mjs --repo . --host docs --project "Project name"
```

1. Add or replace content pages and register them in `docs/docs-manifest.json`.
2. Put project tokens in `docs/project.theme.css`; keep generic component CSS in the package.
3. Serve the repository over static HTTP and open `docs/index.html`.

The initializer is non-destructive for host-owned files and always refreshes generated runtime
files. It also creates the thin `.github/skills/slate/SKILL.md` adapter that points back to this
canonical Slate package.

## Synchronize and validate a host

Run these from the consuming repository root:

```powershell
node .\slate\scripts\runtime-host.mjs sync --repo . --host docs
node .\slate\scripts\runtime-host.mjs check --repo . --host docs
node .\slate\scripts\validate-document-attributions.mjs --repo . --host docs
node .\slate\scripts\validate-presentation-motion.mjs --page <deck.html> --motion <deck.motion.json>
```

`docs/.slate-runtime.json` pins the package name/version and canonical SHA-256 hashes. The checker
rejects changed, missing, stale, obsolete, and unmanaged files in generated `docs/shell/`.

## Develop Slate itself

Run these from this repository root:

```powershell
npm install

npm run test:runtime-host
npm run test:portability
npm run test:attributions
npm run test:presentation-motion
npm run test:canvas-contracts
npm run test:svg-illustration
npm run validate:svg-illustration
```

`shell/canvas/` is generated from `canvas/src/` by `npm run build:canvas`. Rebuild the canvas
**before** synchronizing any host, otherwise that host's runtime drift check will report stale
canvas assets. See [`AGENTS.md`](AGENTS.md) for the full contribution and release contract.

## Ownership and evolution

- Package-owned: generic skill, runtime, components, templates, schemas, visualization subskills,
  demo, initialization, and tests.
- Host-owned: content, sources, manifest, `index.html`, config, theme, authority, and policy.
- Adapter-owned: repository-specific discovery and additional rules only; never copied runtime or
  component contracts.

Learn from real hosts, but implement reusable changes in this package first with a generic fixture
or test. Synchronize the host only after package validation. Keep project meaning and branding in
the host even when they motivated the generic improvement.

## Status of shell files

The package's `shell/slate.css`, `shell/presentation.js`, `shell/slate.js`, and `shell/vendor/*` files are the only editable
runtime authority. Host copies of those assets are generated, recorded, and drift-checked. The
initializer derives the host-owned root `index.html` from `shell/index.html`; later host titles,
paths, and theme links remain host composition rather than generated runtime. Vendor dependencies
are included, so a generated host is self-contained once served over HTTP.
