# Slate Visualization

Slate routes structured content to the visual medium that explains it best. This folder is part of
the portable Slate package and contains the authoring skills for charts, custom SVG illustration,
and icons.

## Native routes

| Need | Skill | Output |
| --- | --- | --- |
| Quantitative data: trend, comparison, proportion, distribution, correlation, flow, hierarchy | [`chart`](skills/chart/SKILL.md) | Static themeable SVG rendered offline by Semiotic on D3 |
| Bespoke explanatory diagram, editorial illustration, spatial model, object/scene, icon, map, pattern, or motion subject | [`svg-illustration`](skills/svg-illustration/SKILL.md) | Validated SVG, optionally enhanced by Slate viewport or presentation motion |
| Supporting icon inside any chart, illustration, card, tile, or nav entry | [`iconography`](skills/iconography/SKILL.md) | Official vector from Fluent, Material Symbols, or Font Awesome |

Charts are rendered at authoring time from a declarative JSON spec. There is no browser, no
headless renderer, and no network call, so output is deterministic and no chart data leaves the
machine.

## Routing rule

Choose the medium before authoring:

- Use **Chart** when the point is a *quantity*: how much, how many, what changed, how it is
  distributed, or how it flows.
- Use **SVG Illustration** when the point is a *concept*: exact composition, semantic geometry,
  spatial relationships, accessibility, theming, or stable motion subjects. Decorative and
  explanatory illustration is authored directly by the model, not produced by a chart engine.
- Use **Slate HTML components** for text-heavy responsive UI, tables, cards, and document
  structure. A pivot or spreadsheet is a table, not a chart.
- Use **bitmap imagery** for photorealism, painterly texture, or complex natural detail.
- Use **Canvas/WebGL/Three.js** for simulation, 3D, or thousands of changing marks.

Do not turn every process into boxes, every number into a chart, or every presentation slide into
decorative SVG. The chosen visual must materially improve comprehension.

## Icons

Charts and illustrations may both use icons. **Every icon comes from one of three approved sources -
Fluent Icons, Google Material Symbols, or Font Awesome - and one source is used exclusively within
a given SVG, chart, or component.** Prefer Fluent for Microsoft and Windows subjects.

Never draw a familiar icon from memory, never mix libraries in one artifact, never substitute a
generic dot or sparkle when the library has a real icon for the concept, and never use emoji. The
complete contract is in [`iconography`](skills/iconography/SKILL.md).

## Slate embedding boundary

Slate content is static and sanitized. Visuals are either:

1. safe inline SVG using presentation attributes;
2. local exported SVG/PNG through the figure component; or
3. an inline SVG with semantic steps animated on viewport entry by Slate's trusted article runtime; or
4. an inline SVG with stable IDs animated by Slate's presentation motion manifest.

No content-owned script, style block, event handler, remote resource, iframe, or autonomous SVG
animation is allowed. Slate owns viewport detection, replay controls, reduced motion, and deck state.
Every authored content SVG uses that host layer: it starts when it enters the viewport in reading
mode, exposes replay only while the SVG is hovered or keyboard-focused, and delegates to the current
slide restart action in presenter mode. Static SVG remains the fallback/export state, not the live
Slate illustration behavior.
See the complete
[SVG Illustration production profiles](skills/svg-illustration/SKILL.md#slate-production-profiles).

Chart SVG follows the same boundary: presentation attributes only, semantic theme tokens, and an
accompanying data table so the numbers stay accessible and searchable.

## Validation

Run the focused visualization checks from a repository containing Slate:

```powershell
npm run validate:svg-illustration --prefix .\slate
npm run test:svg-illustration --prefix .\slate
npm run test:chart --prefix .\slate
```

Render inspection in the actual host remains mandatory; structural validation is not proof of visual
quality.
