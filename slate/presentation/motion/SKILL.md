---
name: slate-presentation-motion
title: Slate Presentation Motion
description: Plan, author, validate, and review presenter-controlled motion in a Slate deck. Use for slide animation, fragment reveals, transitions, motion opportunity analysis, presenter/audience behavior, or HyperFrames-derived presentation motion. Do not use for rendered video.
version: 0.1.0
---

# Slate Presentation Motion

Add motion beneath Slate's discrete presentation state machine. Navigation always wins: a presenter
can move forward/back, reveal fragments, jump, skip, restart, switch theme/motion mode, or leave the
deck while animation is active.

Read in this order:

1. [`../motion-authoring.md`](../motion-authoring.md) - implemented v1 contract and commands.
2. [`../motion-architecture.md`](../motion-architecture.md) - architecture, UX, security, and roadmap.
3. [`catalog.json`](catalog.json) - approved recipe/transition vocabulary and usage constraints.
4. [`../slide-design.md`](../slide-design.md) - static visual composition remains authoritative.
5. [Slate SVG Illustration](../../visualization/skills/svg-illustration/SKILL.md) - native
   production profiles, semantic subject IDs, accessibility, and render validation for bespoke vectors.

## Workflow

The default workflow is **generative**, not retrofit. Do not begin from a generic card grid and ask
which entrance effect to add. Begin from the claim and design the visual mechanism and its motion as
one argument.

1. **Write the narrative spine and one claim per slide.** Name what changes in the audience's mind
   from the start of the slide to its proof state.
2. **Write a motion thesis per slide** using this compact contract:

   ```text
   claim: the one sentence the slide proves
   visual mechanism: the picture/diagram/data object that makes the claim visible
   subject identity: the object(s) that persist through the motion
   states: initial -> proof states/fragments -> final hold
   presenter control: where Next pauses; what Previous restores
   reduced/off: the same meaning without motion
   ```

3. **Choose or generate the visual mechanism before composing the slide.** Route custom vectors
   through the Slate SVG Illustration skill using the `slate-motion-subject` profile. Use a complete card set
   only when the set itself is the argument. Otherwise prefer a bespoke inline SVG diagram, chart,
   process, journey, state machine, relationship model, or spatial metaphor. Generate new SVG when
   the existing component vocabulary cannot show the claim directly; do not accept a generic icon
   row merely because it already exists.
4. **Author the static final composition first.** The final DOM/SVG state is complete, legible, and
   theme-aware. Motion reconstructs how the audience arrives there; it does not compensate for a
   weak final slide.
5. **Decompose the visual into stable motion subjects.** Assign IDs to every path, node, bar, marker,
   label group, or evidence layer that needs independent motion. Preserve one DOM identity per
   subject across all states.
6. **Choose the smallest semantic recipes** from `catalog.json`: draw relationships, grow quantities,
   move a marker along a journey, pop milestones, wipe a layer, or settle a mechanism. Use generic
   fades only for hierarchy and supporting copy, never as the slide's main idea.
7. **Create named fragments only at meaningful proof states.** Each fragment should answer a question
   or add a necessary part of the argument. Do not fragment every object for spectacle.
8. **Write the companion motion manifest** with timings derived from the scene's actual geometry and
   speaking rhythm, then register it through `presentation.motion`.
9. **Validate, inspect, and review painted motion**, not only manifest metadata:

   ```powershell
   node .\slate\scripts\validate-presentation-motion.mjs --page <deck.html> --motion <motion.json>
   node .\slate\scripts\presentation-motion-map.mjs --motion <motion.json>
   npm run test:presentation-motion --prefix .\slate
   ```

10. Serve over loopback and review every slide in reading, presenter, and audience modes. Inspect the
    initial hold, each fragment, final hold, backward navigation, direct jump, interruption, theme,
    full/reduced/off, and constrained reflow.

### Existing-deck fallback

When explicitly animating an existing deck rather than creating one, first run:

```powershell
node .\slate\scripts\analyze-presentation-motion.mjs --page <deck.html> --motion <motion.json>
```

Treat its suggestions as a gap report, not a design. If the source slide lacks a visual mechanism,
redesign the slide and generate a new SVG instead of accepting container fades as the result.

## Visual mechanism selection

| The claim depends on... | Generate... | Primary motion proof |
| --- | --- | --- |
| relationship or intersection | Venn, orbit, linked nodes, nested regions | draw connectors, move/merge subjects, emphasize overlap |
| process or handoff | path, staged flow, state machine | draw route, path-travel marker, pop milestones |
| quantity or comparison | bars, slope, dot plot, proportional shapes | grow from a shared baseline, sequence labels after values |
| change over time | line/area chart, before-after state | draw trend, reveal inflection, hold final value |
| hierarchy or system | tree, hub-and-spoke, layered architecture | assemble parent/child structure in reading order |
| tradeoff or decision | balance, split field, two-axis map | move evidence toward decision boundary |
| one complete factual set | full tile/icon set | sequence groups while keeping the set complete |

Every generated SVG must pass `slate-motion-subject`: `viewBox`, Slate semantic colors, stable scoped
subject IDs, `<title>/<desc>` accessibility, no embedded style/script/animation, and a readable static
final state in light/dark. Decorative shapes are `aria-hidden`; functional labels remain semantic HTML
when possible. The motion manifest is the only timeline.

## Presentation pacing (not video pacing)

HyperFrames video motion can chain many beats because time advances automatically. A live presenter
needs stable places to speak, skip, reverse, and respond. Apply these defaults:

- Enter every generated slide on its **first meaningful hold**, never a blank pre-roll.
- Use **2-3 semantic fragments per slide** by default. Use one when the claim is atomic; exceed three
   only when the complete factual sequence genuinely requires it.
- Keep motion within one presenter action focused: normally **250-700ms**, occasionally up to 1200ms
   for a visible journey/path. The presenter controls when the next phase starts.
- Do not autoplay later proof phases on slide entry. Targets belong to fragments and animate relative
   to that reveal using `fragmentId` and `revealOffsetMs`.
- Let the first hold establish enough visual context to avoid an empty canvas. Let the final hold
   remain fully readable for discussion.
- Use stagger inside one semantic group, not across the entire slide. A group is revealed, settles,
   and holds before the presenter advances.
- Transitions between slides stay short (150-500ms). The meaningful motion belongs inside the slide.
- Previous removes one semantic phase or moves to the prior slide; it never reverses a cinematic
   autoplay timeline through every micro-beat.

## Hard rules

- Authored pages remain body fragments: no scripts, styles, handlers, expressions, or remote runtime.
- Motion cannot be required to discover or understand content.
- The slide's dominant motion must animate the **semantic visual subject**, not only its container.
- If a claim describes a relationship, flow, quantity, sequence, or state change and no suitable
   visual exists, generate a new inline SVG rather than falling back to prose/cards.
- Generic fade/translate entrances may establish hierarchy but do not satisfy the visual-motion
   obligation by themselves.
- Use one dominant motion event at a time; continuous decorative motion is off by default.
- Preserve reading order, text line boxes, subject identity, and exact final state.
- Use stable IDs, not selectors or slide indexes.
- Direct jumps never play intermediate slides.
- Audience surfaces never navigate independently and never receive notes.
- Light/dark, reduced/off, static reading, and failed-manifest behavior must preserve meaning.
- Do not claim blanket HyperFrames parity; update the capability matrix only with proof.

## Runtime boundary

v1 is a trusted Slate WAAPI runtime with a closed recipe vocabulary. GSAP, Lottie, Three.js,
Anime.js, WebGPU, video rendering, and cloud rendering are unsupported until separate adapter
contracts and evidence ship. Do not paste HyperFrames runtime snippets into Slate content.
