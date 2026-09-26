# SVG Theme Contract

## Separation of Concerns

An illustration has four independent layers:

1. **Content:** labels, data, entities, and relationships.
2. **Geometry:** positions, dimensions, paths, and hierarchy.
3. **Semantic theme:** color roles and appearance parameters.
4. **Delivery mode:** light/dark selection and embedding profile.

Changing layers 3 or 4 must not change content or measured geometry. If a heavier stroke or substituted font causes
overlap, regenerate and visually validate rather than silently moving semantic elements.

## Required Theme Shape

```json
{
  "name": "theme-name",
  "appearance": {},
  "modes": {
    "light": {},
    "dark": {}
  }
}
```

Custom modes such as `print`, `highContrast`, or `brandCampaign` may be added, but `light` and `dark` remain required
for reusable web/document themes.

## Color Token Semantics

| Token | Purpose |
| --- | --- |
| `canvas` | illustration background |
| `surface` | primary bounded regions/cards |
| `surfaceAlt` | alternating rows, nested zones, secondary regions |
| `text` | primary labels and values |
| `textMuted` | secondary annotation that remains readable |
| `line` | meaningful boundaries, axes, and connectors |
| `grid` | supporting grid/guides; may be lower contrast if not information-bearing |
| `accent` | primary focus and active state |
| `accentSecondary` | secondary focus or comparison series |
| `accentMuted` | accent-tinted surface/background |
| `onAccent` | text/symbols placed on `accent` |
| `positive` | success/completion color and border |
| `positiveSurface` | positive-state background |
| `onPositiveSurface` | content on `positiveSurface` |
| `warning` | warning/caution encoding |
| `danger` | error/blocker/high-risk encoding |

Factual colors are outside the theme. Examples include an exact LPC palette ramp, a measured heatmap scale, a flag,
or a product color being documented. Surrounding labels and structure still use theme tokens.

For Slate hosts, `onAccent` maps to `--color-on-brand`. Status surfaces pair with their own foreground role:
`--color-status-info-fg` on info, `--color-status-success-fg` on success,
`--color-status-warning-fg` on warning, and `--color-status-danger-fg` on danger. General muted neutral text is
never valid on a tinted or saturated surface merely because it works on the page canvas.

## Required Contrast Pairs

Contrast is evaluated against the immediate painted surface, after opacity and compositing, in every supported
theme. Required minimums:

| Pair | Minimum |
| --- | --- |
| normal text / immediate surface | 4.5:1 |
| large text (at least 18pt regular or 14pt bold) / immediate surface | 3:1 |
| essential icon, connector, boundary, or state mark / adjacent surface | 3:1 |
| disabled/decorative mark | may be lower only when it carries no independent meaning |

Do not infer foreground from the page theme. Every text element inside a bounded colored shape must use the
shape's on-surface semantic role. Re-test both modes when either side of a pair changes; passing light mode does not
predict dark-mode contrast.

## Appearance Contract

| Field | Allowed values | Effect |
| --- | --- | --- |
| `preset` | `casual`, `formal`, `sharp`, `simple`, `friendly`, or custom | records the starting personality |
| `fontFamily` | self-contained CSS font stack | all generated SVG text |
| `cornerRadius` | `0–32` | maximum regular container radius |
| `pillRadius` | `0–64` | chip/pill radius |
| `strokeWidth` | `0.5–6` | primary outline weight |
| `connectorWidth` | `0.5–6` | relationship/axis weight |
| `lineCap` | `butt`, `round`, `square` | endpoint character |
| `lineJoin` | `miter`, `round`, `bevel` | corner character |
| `dash` | array of non-negative numbers | optional connector/outline rhythm |
| `density` | `compact`, `comfortable`, `spacious` | spacing and annotation density |
| `depth` | `flat`, `outlined`, `layered`, `shadowed` | surface separation strategy |

Use these as generator parameters, not post-generation search/replace targets.

## Preset Character

### Casual

- Round caps and joins, medium-heavy strokes, comfortable spacing.
- Two or three lively accents are acceptable when semantic.
- Layered depth may use offset flat shadows; avoid blur in restricted profiles.
- Best for approachable explainers, workshops, and informal education.

### Formal

- Small radii, thin precise strokes, restrained color count, compact spacing.
- Prefer aligned baselines, direct labels, and flat depth.
- Use serif typography only when the document/brand supplies a reliable font.
- Best for reports, policy, governance, and enterprise documentation.

### Sharp

- Near-square corners, square caps, miter joins, high contrast.
- Strong orthogonal routes and taut spacing.
- Avoid soft shadows, playful bubbles, and excessive rounded pills.
- Best for engineering, security, and high-precision technical subjects.

### Simple

- One accent plus neutrals, moderate small radius, thin consistent strokes.
- Spacious layout, flat depth, little decoration.
- Best default when audience, brand, or target renderer is uncertain.

### Friendly

- Rounded containers and pills, round caps/joins, warm secondary surfaces.
- Clear positive states and comfortable spacing.
- Keep body text and factual marks crisp; friendly does not mean childish.
- Best for onboarding, product storytelling, learning, and community tools.

## Light Mode Design

- Avoid using pure white for every surface; use subtle value differences to show grouping.
- Primary text should normally be a near-black chromatic neutral rather than `#000000`.
- Meaningful lines and axes require 3:1 contrast against their immediate background.
- Decorative grids may be subtler if they carry no information independently.
- Ensure pale accent surfaces still distinguish from canvas without depending on shadows.

## Dark Mode Design

- Build a separate palette; do not invert channels.
- Use at least two dark surface levels so grouping remains visible.
- Avoid pure white body text across large areas; a slightly softened white reduces glare.
- Lighten/desaturate saturated accents as needed; test color vibration and halos.
- Re-evaluate every pair: text/canvas, text/surface, line/canvas, on-accent/accent, and status surfaces.
- Keep factual swatches exact and give them borders that remain visible in the dark mode.

## Generator Integration

Load the JSON once, select a mode, then assign role values to rendering primitives:

```python
theme = json.loads(Path("theme.json").read_text(encoding="utf-8"))
mode = theme["modes"][selected_mode]
appearance = theme["appearance"]

CANVAS = mode["canvas"]
INK = mode["text"]
LINE = mode["line"]
RADIUS = appearance["cornerRadius"]
STROKE_WIDTH = appearance["strokeWidth"]
```

Generate every supported mode from the same geometry/data pass. Use deterministic names such as:

```text
architecture-light.svg
architecture-dark.svg
architecture-print.svg
```

If backward compatibility requires an unsuffixed filename, make it the documented default mode and still emit the
explicit variant pair.

## Embedding Strategies

### Inline SVG with host variables

Best for web apps that control the DOM. Define semantic properties in host CSS and use them in SVG attributes:

```css
:root {
  --svg-canvas: #ffffff;
  --svg-text: #1f2937;
  --svg-line: #64748b;
  --svg-accent: #0f6cbd;
}

[data-theme="dark"] {
  --svg-canvas: #1f1f1f;
  --svg-text: #f5f5f5;
  --svg-line: #adadad;
  --svg-accent: #479ef5;
}
```

```xml
<rect width="100%" height="100%" fill="var(--svg-canvas)" />
<text fill="var(--svg-text)">Label</text>
```

Confirm that the sanitizer and target browser preserve custom properties.

For Slate inline profiles, prefer the existing host semantic roles such as
`--color-neutral-bg-1`, `--color-neutral-fg-1`, `--color-brand-bg`, and status roles rather
than defining illustration-only variables. Test the final frame and every motion proof state in
light, dark, and each applicable host color theme. Theme changes must not alter motion order,
geometry, timing, or the meaning encoded by color.

Use `--color-on-brand` for all text and essential symbols on `--color-brand-bg`. For configured custom brand
colors, Slate derives black or white by the stronger WCAG contrast; a host override must still prove 4.5:1. On
status surfaces, use primary neutral foreground only when it passes 4.5:1 and use the matching status foreground
for secondary text. Never use `--color-neutral-fg-3` on a status or brand surface.

### External SVG controlled by the host

External images do not inherit page CSS variables. Generate a pair and author:

```html
<img src="figure-light.svg"
     data-src-light="figure-light.svg"
     data-src-dark="figure-dark.svg"
     alt="..." />
```

When the host theme changes, resolve and assign the matching source. Preserve the same alt text, dimensions, aspect
ratio, title, description, and geometry in both variants.

### Standalone SVG controlled by the operating system

When embedded `<style>` is permitted, one file may use `prefers-color-scheme`. This follows the operating system,
not necessarily an application-level theme toggle. Always include a static default.

### Fixed-output variants

Office, print, email, and strict sanitized profiles should receive explicit files per mode. Never rely on CSS media
queries or inherited variables in those environments.

## Custom Brand Workflow

1. Copy `assets/theme-template.json` beside the project generator.
2. Replace semantic role values, not geometry constants.
3. Choose a preset and override only needed appearance fields.
4. Run `scripts/validate_theme.py`.
5. Generate every supported mode.
6. Render representative sparse, dense, data, and status-heavy figures.
7. Inspect light/dark switching in the real host.
8. Record known limitations, fonts, and approved brand values.

## Validation Beyond Contrast

Theme changes can cause non-color failures:

- thicker strokes crop at the viewBox edge or close small gaps;
- larger radii distort narrow nodes and bars;
- different fonts overflow containers;
- compact density creates connector/label collisions;
- shadows disappear on dark canvases;
- muted surfaces become indistinguishable;
- status colors no longer have distinct grayscale values.

Re-run the SVG illustration visual-validation loop after every theme or preset change.