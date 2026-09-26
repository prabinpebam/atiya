# Presentation Motion v1

Status: experimental WAAPI runtime

Slate presentation motion adds presenter-controlled navigation, fragment reveals, fitted audience
stages, speaker notes, and interruptible browser animation without allowing scripts or styles in
content pages. The semantic deck remains complete in ordinary reading mode.

## Authoring contract

For a new presentation, use `authoringMode: "generated"`. Generated mode is the quality gate: every
slide must declare its claim, blueprint, visual mechanism, reduced-motion state, and at least one
explicit semantic motion target. Use `retrofit` only when intentionally adapting an existing deck.

1. Write the claim and motion thesis before slide markup.
2. Generate the bespoke semantic visual (usually inline SVG) and its complete final state.
3. Give every `.slate-slide` a stable lowercase `id`.
4. Give each planned motion subject a stable `id` or `data-motion-id`.
5. Mark meaningful reveal holds with `data-motion-fragment="<stable-id>"`.
6. Choose recipes that animate the semantic subjects, not only the slide/container.
7. Create a sibling motion JSON file validated by
   [`presentation-motion.schema.json`](../schema/presentation-motion.schema.json).
8. Register it on the page's `docs-manifest.json` entry:

```json
{
  "path": "presentations/example.html",
  "title": "Example deck",
  "type": "page",
  "presentation": { "motion": "example.motion.json" }
}
```

The motion path is relative to the presentation page. Authors must not add `<script>`, `<style>`,
inline `style`, event handlers, JavaScript expressions, selectors, or remote runtime URLs.

## Supported v1 vocabulary

Recipes:

- `fade-in`
- `fade-rise`
- `fade-left`
- `scale-in`
- `draw-stroke` for SVG geometry that implements `getTotalLength()`
- `shape-pop`
- `bar-grow`
- `line-grow`
- `wipe-reveal`
- `spin-settle`
- `path-travel` with `pathId` pointing to an SVG path in the same slide

Transitions:

- `cut`
- `crossfade-short`
- `shared-axis-x`
- `shared-axis-x-reverse`

Motion modes:

- `full`
- `reduced`
- `off`

The preference is saved in the current browser. Reduced/off modes keep the same slide and fragment
meaning. If the motion file is missing, invalid, late, or unsupported, the deck remains presentable
with default safe entrance/transition behavior; the reading page is always complete.

Retrofit slides without an explicit target plan still receive content-aware choreography rather than
moving one flat screenshot of the slide:

- slide-level and card-level SVG geometry draws, travels, or scales by shape type;
- illustrated cards sequence the card surface, figure, title, and body independently;
- metric tiles sequence the tile and value emphasis;
- kicker, title, lead, and callouts establish hierarchy without moving layout boxes;
- all internal animations remain owned by the WAAPI adapter and cancel on navigation, resize, theme
  change, watchdog settlement, or exit.

Generated slides must not rely on this automatic fallback as their dominant motion. Their manifest
must name the visual mechanism and explicit subjects. The generated proof deck demonstrates journey,
relationship, quantity, system, and decision blueprints with purpose-built SVGs.

## Navigation behavior

- Next reveals the next fragment, then advances to the next slide.
- Previous hides the previous fragment, then enters the previous slide at its final fragment.
- Home/End jump directly without traversing intermediate slides.
- `R` restarts the current slide.
- Arrow keys, Page Up/Down, Space, and Shift+Space navigate when focus is not inside a control or
  notes editor.
- Browser history restores stable slide/fragment state.
- Rapid input is interruption-safe: the newest destination becomes the only active slide.

Presentation mode uses a logical stage (default 1600 x 900) uniformly fitted into the available
viewport. At constrained dimensions it enters a scrolling reflow escape instead of shrinking below
readable limits. Reading mode remains responsive document flow.

Generated mode enters on the first declared fragment so the slide is never visually blank. It does
not run automatic retrofit choreography: only explicitly authored semantic targets animate, at the
presenter fragment that owns them. Aim for 2-3 stable proof holds per slide and short local motion,
not a continuously flowing video timeline.

## Presenter and audience UX

The Present control opens a presenter surface with:

- current slide and next-slide preview;
- canonical talking track (read-only);
- browser-local personal notes;
- slide/fragment progress and elapsed time;
- motion and theme controls;
- audience-window launch and connection state.

Personal notes are keyed by page, source revision, and stable slide ID. They never enter audience
markup or synchronization messages. The audience receives stable slide/fragment/theme/motion
snapshots through a same-origin `BroadcastChannel` and has fullscreen only; it cannot navigate
independently.

## Current manifest semantics

- `stage.width` / `stage.height` control the logical presentation stage.
- `defaultRevisit` and slide `revisit` control direct-selection behavior.
- Fragment order and IDs drive presenter navigation. `atMs` is retained for diagnostics and future
  timeline tools; v1 interaction advances by semantic hold, not elapsed time.
- Target `recipe`, `startMs`, and `durationMs` configure WAAPI entrance/reveal animation.
- Slide `durationMs` is an authoring/diagnostic bound; it does not auto-advance slides.
- Slide `fallback` documents the intended static state; semantic reading content remains fully
  visible and presentation fallback currently uses the selected stable hold.

## Validate and preview

```powershell
node .\slate\scripts\analyze-presentation-motion.mjs `
  --page .\docs\presentations\example.html `
  --motion .\docs\presentations\example.motion.json
node .\slate\scripts\validate-presentation-motion.mjs `
  --page .\docs\presentations\example.html `
  --motion .\docs\presentations\example.motion.json
node .\slate\scripts\presentation-motion-map.mjs --motion .\docs\presentations\example.motion.json
npm run test:presentation-motion --prefix .\slate
python -m http.server 8080 --bind 127.0.0.1
```

The opportunity analyzer proposes communication-oriented subjects and safe recipe candidates but
does not mutate the deck. The motion map expands timing, fragment, revisit, fallback, and warning
information for review. Human/agent judgment still decides whether motion improves comprehension.

Then verify reading, presenter, audience, light/dark, full/reduced/off, forward/back, direct jumps,
rapid interruption, browser history, constrained reflow, notes persistence, and popup failure.

A runnable reference lives at [`demo/presentation-motion.html`](../demo/presentation-motion.html).
The normative from-scratch reference is
[`demo/generated-motion.html`](../demo/generated-motion.html) with its
[`generated motion manifest`](../demo/generated-motion.json). Start new motion manifests from
[`templates/presentation-motion.json`](../templates/presentation-motion.json).

## Capability boundary

This is not blanket HyperFrames parity. See [`hyperframes-parity.json`](hyperframes-parity.json) for
capability-level status and [`hyperframes-provenance.json`](hyperframes-provenance.json) for the
pinned clean-room adaptation record. GSAP, Lottie, Three.js/WebGL, Anime.js, WebGPU, media generation,
video rendering, and cloud rendering are not part of v1.
