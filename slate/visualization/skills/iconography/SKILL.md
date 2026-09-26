---
name: iconography
description: "Use when any Slate visual needs an icon - inside a chart, an SVG illustration, a card, a tile, a legend, an annotation, or a navigation entry. Defines the three approved icon sources, the one-source rule, provenance, theming, and accessibility. Icons are always sourced from an approved library, never drawn from memory and never emoji."
---

# Iconography

Slate uses icons from **three approved sources only**. Pick one source per artifact and stay inside
it.

| Source | Use it for | Where to get it |
| --- | --- | --- |
| **Fluent Icons** | Microsoft and Windows subjects; product and system concepts in a Microsoft context | <https://github.com/microsoft/fluentui-system-icons> |
| **Google Material Symbols** | General UI, navigation, and document concepts. Slate's own viewer chrome uses this set | <https://fonts.google.com/icons> |
| **Font Awesome** | General-purpose glyphs when neither of the above has a suitable symbol | <https://fontawesome.com/icons> |

Prefer **Fluent** for Microsoft and Windows subjects. Prefer **Material Symbols** when the icon sits
next to Slate's own chrome, because the viewer already ships that set self-hosted at
`shell/vendor/material-symbols-outlined.ttf`.

## The one-source rule

**Choose exactly one source per SVG, chart, or page component, and use it exclusively.**

Mixing libraries is the single most common way a set of visuals starts to look untrustworthy: stroke
weights, corner radii, optical sizing, and metaphor conventions differ between families. Within one
source, also keep one family and variant - for example Fluent System Regular 24 throughout - unless
brand identity requires an official product icon.

## Where icons belong

### In charts

Icons are supporting, never the data encoding. Use them for:

- **Category identity** beside an axis label or legend entry, when the categories are products,
  platforms, devices, or people groups that readers recognise faster by symbol than by name.
- **Annotation markers** that point at a threshold, an incident, or a callout.
- **KPI and big-number figures**, where one icon carries the subject and the number carries the
  value.

Never encode a *quantity* with an icon size, and never replace an axis label with a bare icon that
has no accessible name. See [`chart`](../chart/SKILL.md).

### In SVG illustrations

Treat any familiar UI glyph, status mark, product symbol, or common pictogram as sourced
iconography rather than bespoke geometry. Run the semantic icon pass, reserve a non-overlapping icon
box, and record provenance. The complete contract lives in
[`svg-illustration`](../svg-illustration/SKILL.md#icon-sourcing-and-consistency).

### In pages and navigation

A manifest entry's `icon` key is a **Material Symbol name**, rendered by the viewer as a ligature
span. Give every page a content-appropriate icon; never leave the default document icon on
everything. See [`assets/icons/README.md`](../../../assets/icons/README.md).

## Sourcing an icon correctly

1. **Resolve meaning first.** Name the product, capability, state, action, device, person group, or
   content type the icon represents. Select by meaning, not silhouette.
2. **Copy the official vector geometry** from the chosen source. Do not trace it, approximate it
   from memory, or combine paths from multiple libraries.
3. **Use a product icon only for the actual product.** Use a system icon for concepts such as
   safety, storage, gaming, learning, devices, or people.
4. **Record provenance** on the icon group:

   ```html
   <g data-slate-icon-source="fluent" data-slate-icon-name="shield-checkmark-regular-24">
     <!-- official path geometry -->
   </g>
   ```

   Record the source path, version, and license in the visual brief or an adjacent comment.

5. **Never substitute a placeholder.** A generic dot, circle, sparkle, initial, or hand-drawn
   mini-symbol is not acceptable when the library contains a clear icon for the concept. If no
   suitable icon exists, omit the icon or redesign the element.

## Theming and contrast

- Inline icon SVG uses **presentation attributes**, never `<style>` blocks, so it survives Slate's
  sanitizer.
- Colour icons with semantic tokens or `currentColor` so they adapt to light and dark:
  `fill="var(--color-neutral-fg-2, #616161)"`.
- An icon that carries meaning must pass **3:1 contrast** against its immediate surface.
- Do not distort the source aspect ratio or redraw the silhouette when resizing. Normalise optical
  size and alignment instead.

## Accessibility

- A **decorative** icon beside a visible text label is hidden from assistive technology:
  `aria-hidden="true"`.
- A **meaningful** icon with no adjacent text needs an accessible name: `role="img"` plus a
  `<title>`, or an `aria-label` on the wrapping element.
- Never rely on an icon alone to convey state. Pair it with text, shape, or position.
- The same concept keeps the same icon across desktop and mobile layouts, and across a document set.

## Guardrails

- Never use emoji as an icon, anywhere - content, labels, status, tooltips, or navigation.
- Never mix icon libraries inside one SVG, chart, or component.
- Never redraw, trace, or invent a familiar icon.
- Never fetch icons from an unapproved remote service at author time or run time; Slate content is
  static, offline-capable, and must not depend on a third-party icon endpoint.
- Never let an icon overlap its label box, container padding, node stroke, or connector envelope.
- Never use an icon where a word is clearer.
