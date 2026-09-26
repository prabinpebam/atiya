# Illustration Techniques

This reference covers depictions rather than abstract box-and-arrow diagrams: people, animals, objects,
environments, editorial scenes, cutaways, maps, icons, and generative compositions.

## Universal Construction Order

1. **Reference and identify:** subject, viewpoint, pose/state, distinctive features, and required fidelity.
2. **Gesture or axis:** dominant action line, orientation, or perspective axes.
3. **Silhouette:** outer contour and major negative spaces.
4. **Proportion:** relative masses, lengths, and placement.
5. **Construction:** overlapping major forms and joints.
6. **Depth:** foreground/background order, occlusion, perspective, and cast relationships.
7. **Value and color:** light direction, material families, and focal contrast.
8. **Details:** facial features, texture, seams, labels, and secondary marks.
9. **Reduction test:** inspect as a monochrome silhouette and at final display size.

Details added before silhouette and proportion usually create a polished but unconvincing subject.

## Organic Subjects

### Silhouette first

Real subjects are rarely recognizable as stacks of perfect circles and rectangles. Use Bézier paths for organic
contours and asymmetry. Primitive shapes are useful as hidden construction guides, not necessarily as the final
outline.

Run the silhouette test:

- temporarily use one dark fill;
- hide interior detail and color variation;
- view at thumbnail size;
- ask whether the species, object class, pose, and direction remain clear.

If recognition depends on eyes, labels, or accessories, revise the contour and major masses.

### People

- Establish head, ribcage, pelvis, limb axes, hands, and feet before clothing.
- Use a clear neck-to-shoulder transition; avoid a head placed directly on a rectangular torso.
- Count both arms and legs and check joint direction.
- Let pose carry intent through weight distribution, spine curve, shoulder/hip tilt, and hand action.
- Avoid tokenized identity. Represent age, body shape, mobility, clothing, and culture through researched, respectful
  features rather than stereotypes.
- Facial features should follow the head plane and perspective, not float on a circle.

### Animals

- Verify species-specific anatomy: spine, neck, head profile, limb count, joint placement, feet/hooves/paws, tail,
  ears, wings, fins, or horns.
- Exaggerate one or two true identifying features, not generic “cute animal” features.
- For quadrupeds in side view, show enough near/far limb separation to make four-legged construction believable.
- Use overlap and value shifts to distinguish far limbs rather than deleting them.
- Research reference proportions. A horse, dog, cat, and rabbit need different head, neck, body, and limb ratios.

### Plants and natural forms

- Build from growth logic: trunk to branch, stem to leaf, vein to edge, terrain mass to erosion detail.
- Introduce controlled variation in angle, length, curvature, and clustering.
- Preserve a large-scale rhythm; random micro-variation without growth structure reads as noise.

## Objects and Products

- Identify the construction system: extruded volume, revolved body, folded sheet, soft form, or assembled parts.
- Pick orthographic, axonometric, or perspective projection deliberately.
- Keep parallel edges and ellipses consistent with the projection.
- Use seams, handles, controls, and openings to explain function.
- Material differences need more than color: vary highlight shape, edge sharpness, texture density, and reflection logic.
- For exploded views, keep a shared axis and use leaders or numbering to preserve assembly order.
- For cutaways, differentiate cut surfaces from visible interior and exterior surfaces.

## Environments and Scenes

### Depth plan

Separate foreground, middle ground, and background. Control depth with:

- overlap and occlusion;
- scale change;
- vertical placement;
- value/contrast reduction with distance;
- detail density;
- perspective convergence when applicable.

### Perspective

- **Orthographic:** measurable plans, elevations, UI-like diagrams.
- **Axonometric/isometric:** systems and spaces where multiple faces should remain visible without convergence.
- **One-point:** corridors, interiors, and frontal depth.
- **Two-point:** objects and buildings viewed from a corner.
- **Schematic:** topological relationships where distance is intentionally nonliteral.

Declare schematic distortion in maps or spatial diagrams. Do not imply measurement accuracy unless the geometry is
actually scaled.

### Lighting

Choose one primary light direction and maintain it. Build a limited value structure:

- light-facing plane;
- local/base plane;
- shadow-facing plane;
- occlusion/contact shadow;
- accent highlight only where material and focus justify it.

Complex gradients are not required for credible volume. Consistent plane values often export more reliably.

## Editorial and Narrative Illustration

- Translate the abstract topic into a concrete visual metaphor, then check that the metaphor does not distort the
  facts or stigmatize people.
- Use one focal action and a few supporting symbols rather than an inventory of icons.
- Let scale and juxtaposition carry the argument.
- Prefer a scene, transformation, tension, or visual consequence over a decorative collage.
- When the audience may not share the metaphor, add a concise label or caption.

## Educational Mechanisms and Cutaways

- Show inputs, internal transformation, and outputs in one readable direction.
- Use cut surfaces, ghosted shells, or exploded parts only when the target profile supports them clearly.
- Label the real mechanism, not merely the outer object.
- Use sequential panels when simultaneous overlays would obscure change.
- Include actual states or examples: sample payload, before/after material, force direction, or measured result.

## Maps and Spatial Illustration

- Decide whether position, direction, distance, area, and adjacency are literal or schematic.
- Use a consistent projection and scale when quantitative geography matters.
- Include orientation and scale only when meaningful.
- Encode routes with line hierarchy and distinguish stops, junctions, and regions using more than color.
- Put labels on open areas; use halos or knockout backgrounds over textured regions.
- Avoid placing decorative geography where it could be mistaken for data.

## Icons and Symbols

- Use an established project icon library before drawing new system icons.
- Choose a canonical grid such as 16, 20, 24, or 32 units based on the target.
- Align primary strokes and extrema to the pixel grid for the rendered size.
- Maintain one stroke width, cap, join, corner, and optical-weight language across a set.
- Simplify more aggressively as size decreases.
- Test silhouette and recognition without color.
- Avoid text inside icons. Provide accessible labels in the surrounding interface.

## Patterns and Generative Compositions

Good uses include backgrounds, textures, fields, ornaments, repeated systems, and visualized algorithms.

- Parameterize canvas, count, spacing, scale, palette, and seed.
- Use a deterministic pseudo-random seed and record it.
- Establish a macro-structure before adding noise.
- Bound element count; SVG DOM performance degrades with excessive marks.
- Reuse symbols when repetition is exact.
- Bake generated results to plain SVG for portability; do not require the generation runtime to display them.
- Inspect for accidental clumps, tangencies, banding, moiré, and edge cropping.

## Path Craft

- Use as few anchors as needed to describe the form cleanly.
- Place anchors at extrema and major curvature changes.
- Keep Bézier handles tangent to the contour for smooth transitions.
- Avoid many tiny segments from auto-tracing; redraw or simplify important silhouettes.
- Use closed paths for filled forms and open paths for strokes.
- Maintain winding direction when morphing or applying fill rules.
- Use `fill-rule="evenodd"` deliberately for holes; do not depend on accidental winding.

## Texture and Material

Texture should describe surface, scale, or depth rather than fill empty space.

- wood: directional grain following form;
- metal: sharp value transitions and controlled highlights;
- fabric: folds driven by support and tension points;
- glass: edge cues, overlap, and sparse highlights;
- stone: irregular plane changes and clustered marks;
- foliage: grouped masses before individual leaves.

Use patterns, clips, and masks only in profiles that support them. For Office and sanitized docs, replace complex
effects with explicit vector marks or flat shape layers.

## Style Coherence

Define these before detailing:

- contour: none, uniform, or variable;
- corners: geometric, rounded, or organic;
- fill: flat, plane-based, gradient, patterned, or sketchy;
- depth: flat, layered, axonometric, or perspective;
- detail level: icon, spot illustration, editorial, or technical plate;
- texture density and mark vocabulary;
- palette and lighting direction.

Do not mix stock icons, geometric primitives, and organic paths with unrelated visual weights.

## Common Failures

| Failure | Likely cause | Repair |
| --- | --- | --- |
| Subject looks like stacked primitives | detail-first construction | redraw one readable silhouette with organic paths |
| Species/object is ambiguous | missing distinctive profile or proportion | research and exaggerate true identifying features |
| Limbs or parts are missing | no construction pass | count anatomy/components before finishing |
| Flat scene | no overlap or depth plan | define planes and reorder foreground/mid/background |
| Inconsistent object geometry | mixed projection | redraw against one axis/perspective system |
| Decorative but uninformative | no visual thesis | identify the claim and rebuild around its verb |
| Procedural noise | random variation without macro structure | establish field, rhythm, or growth logic first |
| Detail disappears at delivery size | authored while zoomed in | simplify and increase primary shape contrast |