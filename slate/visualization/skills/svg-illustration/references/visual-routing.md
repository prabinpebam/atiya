# Visual Routing

Choose the representation whose native model matches the problem. Do not use custom SVG merely because it is
available.

## First Decision: What Must the Visual Do?

| Intent | Best default | Use custom SVG when |
| --- | --- | --- |
| Explain a concept or mechanism | SVG illustration | spatial metaphor, annotation, or art direction carries meaning |
| Show architecture or containment | SVG, Mermaid, Draw.io | branded composition or multi-level evidence matters |
| Show process or decisions | Mermaid or SVG | the path needs custom emphasis, scenes, or nonstandard geometry |
| Show a formal sequence, ERD, or UML model | Mermaid / PlantUML | only when formal notation is not required and custom storytelling is |
| Compare measured values | chart library | the chart must be integrated into a larger illustrated explanation |
| Explore data interactively | HTML + chart library | static editorial annotation is the actual deliverable |
| Show a network with many nodes | graph library | the network is small enough to compose intentionally |
| Present KPIs or a dashboard | HTML/CSS | a static poster or report figure is required |
| Depict a person, animal, object, or place | SVG or bitmap | a stylized, shape-led vector depiction fits the needed fidelity |
| Simulate physics or algorithms | Canvas/HTML | only the static state or small step sequence is required |
| Render a 3D object or spatial scene | Three.js | an axonometric or schematic 2D projection communicates better |
| Produce decorative/generative art | SVG/Canvas | mark count is moderate and scalable vector output matters |
| Collaboratively edit a sketch | Excalidraw/tldraw | the final source must be plain SVG instead of whiteboard data |

## SVG Suitability Test

SVG is a strong fit when most answers are yes:

- Is the output primarily 2D and vector-shaped?
- Does custom composition matter more than automatic layout?
- Is the mark count moderate enough for DOM rendering?
- Must it scale cleanly for web, slides, or print?
- Is a static or lightly animated deliverable sufficient?
- Can the content be expressed with paths, shapes, text, symbols, and images?
- Does source-level editability or version control matter?

Choose another medium when any of these dominate:

- thousands of continuously moving marks;
- photorealistic or painterly texture;
- complex responsive text reflow;
- formal notation with a mature layout engine;
- live data exploration, sorting, filtering, zooming, or simulation;
- full 3D depth, camera, material, and lighting behavior.

## SVG Illustration Families

Classify the request before choosing layout and technique.

### Explanatory and conceptual

Mechanisms, mental models, abstract relationships, cause/effect, before/after, or “how it works.” Use a visual
metaphor that mirrors the behavior. Include concrete examples where they improve understanding.

### Technical and architectural

Systems, services, pipelines, protocols, data movement, infrastructure, and code structure. Accuracy comes first.
Inspect source material and show real boundaries, names, payloads, states, or events rather than generic placeholders.

### Process, lifecycle, and journey

Sequences, loops, branches, funnels, roadmaps, and user journeys. Spatial order must be unambiguous. If sequence is
the only requirement and styling is secondary, route to Mermaid.

### Infographic and visual summary

A compact synthesis of facts, comparisons, metrics, and narrative. Use one visual thesis, a clear scan path, and a
small number of visual forms. For data-dominant work, build charts with a chart library and compose them into SVG or
the surrounding document only when export compatibility is known.

### Editorial and narrative

Scenes, annotated stories, symbolic compositions, cutaways, and visual essays. Favor recognizable silhouette,
atmosphere, focal hierarchy, and purposeful annotation over diagram conventions.

### Subject illustration

People, animals, objects, products, environments, and icons. Anatomy, proportion, construction, perspective,
overlap, and lighting determine credibility. Details cannot rescue a weak silhouette.

### Spatial and map-like

Floor plans, site relationships, regions, routes, layers, and geographic or schematic maps. Declare whether
position, distance, area, direction, or topology is literal. Do not imply geographic accuracy when the visual is
schematic.

### Pattern and generative

Grids, radial systems, waves, particles, tessellations, ornaments, and procedural fields. Use deterministic
parameters and fixed seeds. Keep generated decoration subordinate when the artifact also communicates information.

### Icon and symbol

Small, reduced visual vocabulary. Start on the target pixel grid, use optical correction, and test every required
size. Prefer the project’s established icon library when one exists.

## Complexity Routing

| Complexity | Approach |
| --- | --- |
| 1–8 major elements | Hand-compose directly in SVG |
| 9–30 structured elements | Use measured grid/flow formulas and semantic grouping |
| 30–100 networked elements | Consider a layout engine, then art-direct the exported geometry |
| 100+ nodes or high interaction | Use graph/Canvas/WebGL tooling instead of raw authored SVG |

## Output Routing

- **Inline SVG:** best for CSS theming, DOM accessibility, and interaction; IDs must be scoped.
- **External SVG via `<img>`:** strong isolation and caching; use `alt` in HTML because internal semantics may not be exposed.
- **Standalone SVG file:** best reusable vector artifact; keep it self-contained.
- **PNG:** compatibility or preview artifact; not the editable source.
- **PDF:** print and archival output; verify font embedding and effects.
- **Office SVG:** use the restricted profile and retain editable text unless portability requires an outlined variant.

## Final Routing Question

Ask: **what is the hardest part of this visual?** Use the medium whose engine solves that part. If the hardest part
is custom visual explanation, shape language, and art-directed composition, use this skill.