# Research Sources and Synthesis

This skill uses original wording and examples. It synthesizes recurring practices from the sources below rather
than copying any one skill. Repository licenses were reviewed where discoverable; external source code or assets
must not be copied into deliverables without following their licenses.

## Agent Skills Reviewed

### Production SVG skill

- Source: <https://github.com/majiayu000/claude-skill-registry/tree/main/skills/documents/svg-tazomatalax-context-engineering>
- Contribution: target-environment discovery; Office, HMI, and technical-diagram profiles; dependable geometry;
  explicit canvas/scale requirements; editable versus outlined variants; restrained renderer features.

### `_svg-drawing`

- Source: <https://github.com/majiayu000/claude-skill-registry/tree/main/skills/data/svg-drawing>
- Contribution: rapid render/view/revise loop, progressive construction, and iteration snapshots.

### `svg-art`

- Source: <https://github.com/kv0906/cc-skills/tree/main/svg-art-skill>
- Contribution: deterministic programmatic generation for grids, radial forms, fractals, waves, particles, charts,
  and icons; fixed seeds; composable scripts; optimization tooling.

### `svg-graphics`

- Source: <https://github.com/m-e-conroy/Skills-Library/tree/main/.github/skills/svg-graphics>
- Contribution: broad SVG authoring, accessibility, theme-aware graphics, animation tradeoffs, transform isolation,
  clipping layers, optimization, and silhouette-first guidance for real subjects.

### `svg-illustration`

- Source: <https://github.com/narumiruna/agent-skills/tree/main/skills/svg-illustration>
- Contribution: progressive-disclosure structure and a minimal SVG-specific reading path for diagrams, embedding,
  and troubleshooting.

### Mermaid skill

- Source: <https://github.com/Agents365-ai/mermaid-skill>
- Contribution: medium routing, validation before export, local/remote rendering backends, visual self-check after
  auto-layout, bounded repair loops, and plain-text source as a versionable artifact.

### Excalidraw diagram skill

- Source: <https://github.com/coleam00/excalidraw-diagram-skill>
- Mirror reviewed: <https://github.com/kv0906/cc-skills/tree/main/excalidraw-diagram>
- Contribution: diagrams should make visual arguments; semantic layout should mirror behavior; multi-zoom design;
  real evidence artifacts; concept-first planning; render-and-inspect quality gates; avoiding uniform containers.

### Draw.io, PlantUML, Excalidraw, and tldraw skill families

- Organization: <https://github.com/Agents365-ai>
- Contribution: explicit tool routing by notation, layout control, editability, collaboration, and visual style;
  validation/export pipelines; use of mature layout engines and domain shape libraries where appropriate.

### IFQ Design Skills

- Source: <https://github.com/peixl/ifq-design-skills>
- Contribution: short routing path, mode/template selection, smallest viable reviewable artifact, tiered export policy,
  HTML-first fallback, and verification before optional high-cost export.

### OpenGenerativeUI

- Source: <https://github.com/CopilotKit/OpenGenerativeUI>
- Contribution: choose the rendering technology from the visual task; progressive skill loading; sandboxed previews;
  responsive sizing; theme support; separation of static SVG, interactive HTML, charts, Canvas, networks, and 3D.

### AntV visualization skills

- Source: <https://github.com/antvis/chart-visualization-skills>
- Contribution retained: chart opportunity and form selection; scales and visual channels; explicit data
  transforms; label collision strategy; small-multiple composition; graph-layout choice from topology; pivot-table
  judgment; interactive-versus-static routing.
- Consolidation choice: library APIs, generated-chart wrappers, editor-specific configuration, and hundreds of
  implementation references were removed. Their useful general principles were rewritten in original form in
  [data visualization](data-visualization.md).

## Libraries and Systems Reviewed

### Rough.js

- Source: <https://github.com/rough-stuff/rough>
- Contribution: roughness, bowing, hachure, dots, and other sketch qualities can be controlled parameters rather
  than improvised path noise. Use only when the target aesthetic and profile justify it.

### SVG.js

- Source: <https://github.com/svgdotjs/svg.js>
- Contribution: fluent programmatic SVG manipulation and animation; useful for generated/interactive work, while the
  delivered artifact should remain portable when possible.

### Mermaid, Graphviz, PlantUML, Kroki

- Sources: <https://mermaid.js.org/>, <https://graphviz.org/>, <https://plantuml.com/>, <https://kroki.io/>
- Contribution: formal diagram grammars and layout engines solve dense graph and notation problems better than
  hand-authored coordinates. Kroki demonstrates renderer fallback and format-agnostic export.

### SVGO

- Source: <https://github.com/svg/svgo>
- Contribution: post-approval optimization should be configurable and must preserve `viewBox`, accessibility,
  references, and editability required by the delivery contract.

### HyperFrames

- Source: <https://github.com/heygen-com/hyperframes>
- License: Apache-2.0.
- Contribution retained: atomic motion vocabulary; time-coded phases; deterministic and seek-safe states; explicit
  first/proof/final poses; staged reveals instead of front-loading; small motion-rule sets; compositor-friendly
  channels; restrained easing and stagger; stillness as a design choice; frame sampling and bounding-box diagnostics.
- Consolidation choice: no HyperFrames runtime, adapters, recipes, or source code are vendored. The SVG-specific
  synthesis lives in [motion and animation](motion-and-animation.md).

## Standards and Authoritative Guidance

### W3C SVG 2

- Source: <https://www.w3.org/TR/SVG2/>
- Contribution: rendering model, coordinate systems, painting order, text, linking, reusable content, and core SVG
  behavior.

### MDN SVG guides

- Inline SVG: <https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_in_HTML>
- `viewBox`: <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox>
- `preserveAspectRatio`: <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/preserveAspectRatio>
- Contribution: responsive coordinate systems, `meet` versus `slice`, inline accessibility, and embedding behavior.

### W3C Web Accessibility Initiative image tutorials

- Complex images: <https://www.w3.org/WAI/tutorials/images/complex/>
- Decorative images: <https://www.w3.org/WAI/tutorials/images/decorative/>
- Informative images: <https://www.w3.org/WAI/tutorials/images/informative/>
- Contribution: purpose-based alternatives; short plus structured long descriptions for complex visuals; null
  alternatives for decorative images; visible descriptions available to everyone.

### WCAG 2.2

- Source: <https://www.w3.org/TR/WCAG22/>
- Contribution: text and non-text contrast, non-color encoding, keyboard access, focus visibility, motion controls,
  and accessible alternatives.

## What This Skill Adds

The sources tend to specialize in dependable SVG syntax, iterative drawing, programmatic art, statistical charts,
formal diagrams, themes, or motion. This skill combines those strengths with an original end-to-end model:

1. route by the hardest representational problem;
2. establish a production profile before selecting SVG features;
3. model source truth and write a visual thesis;
4. map conceptual verbs to spatial structures;
5. use construction methods appropriate to diagrams, subjects, scenes, maps, icons, and generative work;
6. select honest data encodings, scales, transforms, and graph/table structures;
7. apply customizable semantic themes without changing content or geometry;
8. add optional deterministic motion only when time clarifies the message;
9. validate markup and accessibility semantics;
10. render in context and inspect conceptual, visual, and temporal defects;
11. optimize only after approval and preserve the editable master.

The result is intentionally broader than an infographic template library and more art-directed than a generic
diagram grammar, while retaining explicit escape routes to those tools when they are the better engine.